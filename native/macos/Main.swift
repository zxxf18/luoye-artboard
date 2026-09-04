import AppKit
import WebKit
import UniformTypeIdentifiers
import os

@MainActor
final class StudioDelegate: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    private var window: NSWindow?
    private var webView: WKWebView?
    private let logger = Logger(subsystem: "local.jshw.studio", category: "desktop")
    private let smokePath = ProcessInfo.processInfo.environment["JSHW_SMOKE_OUTPUT"]

    func applicationDidFinishLaunching(_ notification: Notification) {
        let menu = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "退出画王", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        menu.addItem(appItem)
        let editItem = NSMenuItem(title: "编辑", action: nil, keyEquivalent: "")
        let editMenu = NSMenu(title: "编辑")
        editMenu.addItem(withTitle: "复制", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "剪切", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "粘贴", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "全选", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = editMenu
        menu.addItem(editItem)
        NSApp.mainMenu = menu

        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(self, name: "files")
        configuration.userContentController.add(self, name: "ready")
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.uiDelegate = self
        view.navigationDelegate = self
        if #available(macOS 13.3, *) { view.isInspectable = true }
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1380, height: 900),
                              styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "画王 · 小小创作室"
        window.minSize = NSSize(width: 900, height: 650)
        window.contentView = view
        window.center()
        window.makeKeyAndOrderFront(nil)
        self.window = window
        self.webView = view
        guard let resources = Bundle.main.resourceURL else {
            showError("无法找到应用资源。")
            return
        }
        let site = resources.appendingPathComponent("site", isDirectory: true)
        view.loadFileURL(site.appendingPathComponent("index.html"), allowingReadAccessTo: site)
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url,
              let resources = Bundle.main.resourceURL else { decisionHandler(.cancel); return }
        let permitted = resources.appendingPathComponent("site", isDirectory: true).standardizedFileURL.path + "/"
        decisionHandler(url.isFileURL && url.standardizedFileURL.path.hasPrefix(permitted) ? .allow : .cancel)
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: any Error) {
        showError(error.localizedDescription)
    }

    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping @MainActor ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = false
        panel.canChooseFiles = true
        panel.allowsMultipleSelection = false
        guard let window else { completionHandler(nil); return }
        panel.beginSheetModal(for: window) { response in completionHandler(response == .OK ? panel.urls : nil) }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.request.url?.isFileURL == true else { return }
        if message.name == "ready" {
            logger.notice("Painting interface loaded")
            if let smokePath, let view = webView {
                do {
                    let data = try JSONSerialization.data(withJSONObject: message.body, options: [.prettyPrinted, .sortedKeys])
                    try data.write(to: URL(fileURLWithPath: smokePath), options: .atomic)
                } catch { logger.error("Smoke report failed: \(error.localizedDescription)") }
                view.takeSnapshot(with: nil) { image, error in
                    guard let image, let data = image.tiffRepresentation,
                          let bitmap = NSBitmapImageRep(data: data),
                          let png = bitmap.representation(using: .png, properties: [:]) else { return }
                    do { try png.write(to: URL(fileURLWithPath: smokePath + ".png"), options: .atomic) }
                    catch { self.logger.error("Snapshot write failed: \(error.localizedDescription)") }
                }
            }
            return
        }
        guard message.name == "files", let body = message.body as? [String: String],
              let id = body["id"], let name = body["name"], let content = body["content"],
              let mime = body["mime"], ["image/png", "application/json"].contains(mime),
              content.utf8.count <= 180 * 1024 * 1024 else { return }
        let data: Data?
        if mime == "image/png", content.hasPrefix("data:image/png;base64,") {
            data = Data(base64Encoded: String(content.dropFirst("data:image/png;base64,".count)))
        } else if mime == "application/json" { data = content.data(using: .utf8) }
        else { data = nil }
        guard let data else { reply(id: id, error: "文件内容无法识别。"); return }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = String(name.split(separator: "/").last ?? "我的画")
        panel.allowedContentTypes = mime == "image/png" ? [.png] : [UTType(filenameExtension: "jshwx") ?? .data]
        guard let window else { reply(id: id, error: "窗口不可用。"); return }
        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let url = panel.url else { self.reply(id: id, saved: false); return }
            do { try data.write(to: url, options: .atomic); self.reply(id: id, saved: true) }
            catch { self.reply(id: id, error: error.localizedDescription) }
        }
    }

    private func reply(id: String, saved: Bool = false, error: String? = nil) {
        var value: [String: Any] = ["id": id, "saved": saved]
        if let error { value["error"] = error }
        do {
            let data = try JSONSerialization.data(withJSONObject: value)
            guard let json = String(data: data, encoding: .utf8) else { return }
            webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('native-file-result', {detail: \(json)}))")
        } catch { logger.error("File result failed: \(error.localizedDescription)") }
    }

    private func showError(_ message: String) {
        logger.error("Load failed: \(message)")
        let alert = NSAlert()
        alert.messageText = "创作室暂时没有打开"
        alert.informativeText = message
        alert.runModal()
    }
}

let application = NSApplication.shared
let delegate = StudioDelegate()
application.delegate = delegate
application.setActivationPolicy(.regular)
application.run()
