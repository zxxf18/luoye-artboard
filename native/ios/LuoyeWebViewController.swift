import Foundation
import UIKit
import WebKit

private struct LuoyeSmokeConfiguration {
    let scriptName: String
    let outputURL: URL
    let fileChecks: Bool
    let usePersistentStore: Bool
    let reloadForTest: Bool
    let orientation: UIInterfaceOrientationMask?
}

@MainActor
final class LuoyeWebViewController: UIViewController {
    let webView: WKWebView
    private let bridge: LuoyeBridge
    private let smoke: LuoyeSmokeConfiguration?
    private var smokeRunning = false
    private var smokeOrientationReady = true
    private var initialGeometryRequested = false
    var interfaceReady = false
    private var immersive = false

    init() {
        let smoke = Self.readSmokeConfiguration()
        let content = WKUserContentController()
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = smoke?.usePersistentStore == true
            ? WKWebsiteDataStore.default()
            : (smoke == nil ? WKWebsiteDataStore.default() : WKWebsiteDataStore.nonPersistent())
        configuration.userContentController = content
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = [.audio]
        let view = WKWebView(frame: .zero, configuration: configuration)
        webView = view
        bridge = LuoyeBridge(host: nil, smokeFileOutputURL: smoke?.fileChecks == true ? smoke?.outputURL : nil)
        self.smoke = smoke
        smokeOrientationReady = smoke == nil
        super.init(nibName: nil, bundle: nil)
        bridge.setHost(self)
        bridge.webView = view
        bridge.presenter = self
        for name in ["ready", "files", "music", "display", "assets"] {
            content.add(bridge, name: name)
        }
        view.uiDelegate = bridge
        view.navigationDelegate = bridge
        view.scrollView.contentInsetAdjustmentBehavior = .never
        view.allowsBackForwardNavigationGestures = false
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("Storyboard is not used") }

    override func loadView() {
        view = UIView()
        view.backgroundColor = .systemBackground
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        // Keep the complete web viewport inside the system safe area. CSS
        // padding alone clips a fixed-height toolbar on compact iPhones.
        // https://developer.apple.com/documentation/uikit/uiview/safearealayoutguide
        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: safe.topAnchor),
            webView.leadingAnchor.constraint(equalTo: safe.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: safe.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: safe.bottomAnchor)
        ])
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        // The bundled page declares viewport-fit=cover; this injected rule
        // keeps the same safe-area contract when an older cached page loads.
        let script = WKUserScript(source: """
        (() => {
          window.LUOYE_PLATFORM = 'ios';
          document.documentElement.classList.add('ios-shell');
          const style = document.createElement('style');
          style.textContent = `
            :root { --ios-safe-top: env(safe-area-inset-top); --ios-safe-right: env(safe-area-inset-right); --ios-safe-bottom: env(safe-area-inset-bottom); --ios-safe-left: env(safe-area-inset-left); }
            html.ios-shell dialog { max-height: calc(100dvh - var(--ios-safe-top) - var(--ios-safe-bottom) - 24px); }
          `;
          document.head.append(style);
        })();
        """, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        webView.configuration.userContentController.addUserScript(script)
        webView.configuration.userContentController.addUserScript(WKUserScript(
            source: "window.LUOYE_PLATFORM = 'ios';",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))
        guard let root = Bundle.main.resourceURL?.appendingPathComponent("site", isDirectory: true) else {
            showError("应用内没有找到画板资源。"); return
        }
        webView.loadFileURL(root.appendingPathComponent("index.html"), allowingReadAccessTo: root)
    }

    override var prefersStatusBarHidden: Bool { immersive }
    override var prefersHomeIndicatorAutoHidden: Bool { immersive }
    override var preferredInterfaceOrientationForPresentation: UIInterfaceOrientation { .landscapeRight }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard let scene = view.window?.windowScene else { return }
        #if DEBUG
        let orientation = smoke?.orientation ?? [.landscapeLeft, .landscapeRight]
        #else
        let orientation: UIInterfaceOrientationMask = [.landscapeLeft, .landscapeRight]
        #endif
        guard !initialGeometryRequested else {
            runSmokeIfRequested()
            return
        }
        initialGeometryRequested = true
        // The app starts in a landscape workspace on both iPhone and iPad.
        // A later user rotation remains allowed by Info.plist and UIKit.
        scene.requestGeometryUpdate(.iOS(interfaceOrientations: orientation)) { error in
            NSLog("Luoye initial orientation request failed: %@", error.localizedDescription)
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in
            guard let self else { return }
            self.smokeOrientationReady = true
            self.runSmokeIfRequested()
        }
    }

    func toggleImmersive() {
        immersive.toggle()
        setNeedsStatusBarAppearanceUpdate()
        setNeedsUpdateOfHomeIndicatorAutoHidden()
    }

    func publishDisplaySize() {
        let size = webView.bounds.size
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('native-display-result',{detail:{width:\(size.width),height:\(size.height)}}))")
    }

    func flushDraft() {
        guard interfaceReady else { return }
        webView.callAsyncJavaScript("return await window.LUOYEFlushBeforeClose?.();", arguments: [:], in: nil, in: .page, completionHandler: nil)
    }

    /// Debug-only runner for the existing native JS journeys. The script and
    /// output prefix are selected with launch arguments so normal app launches
    /// never execute test code or write evidence files.
    func runSmokeIfRequested() {
        #if DEBUG
        guard let smoke, interfaceReady, smokeOrientationReady, !smokeRunning else { return }
        let smokeRoot = Bundle.main.resourceURL?.appendingPathComponent("smoke", isDirectory: true)
        let scriptURL = smokeRoot?.appendingPathComponent(smoke.scriptName)
        guard let scriptURL, let script = try? String(contentsOf: scriptURL, encoding: .utf8) else {
            finishSmoke(["ok": false, "error": "找不到烟测脚本 \(smoke.scriptName)。"])
            return
        }
        smokeRunning = true
        webView.callAsyncJavaScript(script, arguments: ["fileChecks": smoke.fileChecks], in: nil, in: .page) { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let payload):
                if smoke.reloadForTest,
                   let report = payload as? [String: Any],
                   report["reloadForTest"] as? Bool == true {
                    self.smokeRunning = false
                    self.webView.reload()
                    return
                }
                self.finishSmoke(["ok": true, "result": payload])
            case .failure(let error):
                self.finishSmoke(["ok": false, "error": error.localizedDescription])
            }
        }
        #endif
    }

    private func finishSmoke(_ value: [String: Any]) {
        #if DEBUG
        guard let smoke else { return }
        smokeRunning = false
        webView.takeSnapshot(with: nil) { image, error in
            if let image {
                do {
                    guard let data = image.pngData() else { throw SmokeError.snapshotEncoding }
                    try data.write(to: smoke.outputURL.appendingPathExtension("png"), options: .atomic)
                } catch { NSLog("Luoye smoke snapshot failed: %@", error.localizedDescription) }
            } else if let error { NSLog("Luoye smoke snapshot failed: %@", error.localizedDescription) }
            do {
                let data = try JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys])
                try data.write(to: smoke.outputURL.appendingPathExtension("checks.json"), options: .atomic)
            } catch { NSLog("Luoye smoke report failed: %@", error.localizedDescription) }
        }
        #endif
    }

    private enum SmokeError: LocalizedError {
        case snapshotEncoding
        var errorDescription: String? { "无法编码烟测截图。" }
    }

    private static func readSmokeConfiguration() -> LuoyeSmokeConfiguration? {
        #if DEBUG
        let arguments = ProcessInfo.processInfo.arguments
        func value(_ name: String) -> String? {
            guard let index = arguments.firstIndex(of: "-" + name), arguments.index(after: index) < arguments.endIndex else { return nil }
            return arguments[arguments.index(after: index)]
        }
        func flag(_ name: String) -> Bool {
            guard let raw = value(name)?.lowercased() else { return false }
            return ["1", "true", "yes", "on"].contains(raw)
        }
        guard let script = value("LUOYE_SMOKE_SCRIPT"),
              script.range(of: #"^native-[a-z0-9-]+\.js$"#, options: .regularExpression) != nil else { return nil }
        let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let requestedOutput = value("LUOYE_SMOKE_OUTPUT") ?? "luoye-smoke"
        // Keep evidence inside the app container even when a caller supplies
        // an absolute host path; simctl can retrieve Documents afterwards.
        let requestedName = URL(fileURLWithPath: requestedOutput).lastPathComponent
        let outputName = ["", ".", ".."].contains(requestedName) ? "luoye-smoke" : requestedName
        let output = documents.appendingPathComponent(outputName.isEmpty ? "luoye-smoke" : outputName)
        let orientation: UIInterfaceOrientationMask? = switch value("LUOYE_SMOKE_ORIENTATION") {
        case "landscape": .landscapeLeft
        case "portrait": .portrait
        default: nil
        }
        try? FileManager.default.createDirectory(at: documents, withIntermediateDirectories: true)
        try? FileManager.default.removeItem(at: output.appendingPathExtension("checks.json"))
        try? FileManager.default.removeItem(at: output.appendingPathExtension("png"))
        return LuoyeSmokeConfiguration(scriptName: script, outputURL: output,
                                        fileChecks: flag("LUOYE_SMOKE_FILES"),
                                        usePersistentStore: flag("LUOYE_SMOKE_PERSISTENT"),
                                        reloadForTest: flag("LUOYE_SMOKE_RELOAD"), orientation: orientation)
        #else
        return nil
        #endif
    }

    func showError(_ message: String) {
        guard presentedViewController == nil else { return }
        let alert = UIAlertController(title: "画板暂时没有打开", message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "好", style: .default))
        present(alert, animated: true)
    }
}

@MainActor
final class LuoyeSceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = LuoyeWebViewController()
        self.window = window
        window.makeKeyAndVisible()
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        (window?.rootViewController as? LuoyeWebViewController)?.flushDraft()
    }

    func sceneWillResignActive(_ scene: UIScene) {
        // Save while the scene is still interactive; didEnterBackground is a
        // second safety net because iOS may suspend the app shortly after it.
        (window?.rootViewController as? LuoyeWebViewController)?.flushDraft()
    }
}

@main
final class LuoyeApplication: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let configuration = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
        configuration.delegateClass = LuoyeSceneDelegate.self
        return configuration
    }
}
