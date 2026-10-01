import Foundation
import UIKit
import WebKit

@MainActor
final class LuoyeWebViewController: UIViewController {
    let webView: WKWebView
    private let bridge: LuoyeBridge
    var interfaceReady = false
    private var immersive = false

    init() {
        let content = WKUserContentController()
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = WKWebsiteDataStore.default()
        configuration.userContentController = content
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = [.audio]
        let view = WKWebView(frame: .zero, configuration: configuration)
        webView = view
        bridge = LuoyeBridge(host: nil)
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

    override func loadView() { view = webView }

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
            html.ios-shell .app-header { padding-top: max(8px, var(--ios-safe-top)); padding-left: max(16px, var(--ios-safe-left)); padding-right: max(16px, var(--ios-safe-right)); }
            html.ios-shell .workspace { padding-left: max(12px, var(--ios-safe-left)); padding-right: max(12px, var(--ios-safe-right)); padding-bottom: max(12px, var(--ios-safe-bottom)); }
            html.ios-shell dialog { max-height: calc(100dvh - var(--ios-safe-top) - var(--ios-safe-bottom) - 24px); }
          `;
          document.head.append(style);
        })();
        """, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
        webView.configuration.userContentController.addUserScript(script)
        guard let root = Bundle.main.resourceURL?.appendingPathComponent("site", isDirectory: true) else {
            showError("应用内没有找到画板资源。"); return
        }
        webView.loadFileURL(root.appendingPathComponent("index.html"), allowingReadAccessTo: root)
    }

    override var prefersStatusBarHidden: Bool { immersive }
    override var prefersHomeIndicatorAutoHidden: Bool { immersive }

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
