import AppKit
import WebKit
import UniformTypeIdentifiers
import os

@MainActor
final class StudioDelegate: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate, WKScriptMessageHandler, NSWindowDelegate {
    private var window: NSWindow?
    private var webView: WKWebView?
    private var terminationPending = false
    private let logger = Logger(subsystem: "local.jshw.studio", category: "desktop")
    private let smokePath = ProcessInfo.processInfo.environment["JSHW_SMOKE_OUTPUT"]
    private lazy var music = StudioMusic()

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
        if smokePath != nil { configuration.websiteDataStore = .nonPersistent() }
        configuration.userContentController.add(self, name: "files")
        configuration.userContentController.add(self, name: "ready")
        configuration.userContentController.add(self, name: "music")
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.uiDelegate = self
        view.navigationDelegate = self
        if #available(macOS 13.3, *) { view.isInspectable = true }
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1380, height: 900),
                              styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.delegate = self
        window.title = "画王 · 经典创作室"
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

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        NSApp.terminate(nil)
        return false
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        guard let webView else { return .terminateNow }
        if terminationPending { return .terminateCancel }
        terminationPending = true
        webView.callAsyncJavaScript("return window.JSHWFlushBeforeClose ? await window.JSHWFlushBeforeClose() : true;",
                                   arguments: [:], in: nil, in: .page) { result in
            self.terminationPending = false
            switch result {
            case .success:
                if let path = self.smokePath {
                    do { try Data("{\"draftFlush\":true,\"terminationApproved\":true}".utf8).write(to: URL(fileURLWithPath: path + ".close.json"), options: .atomic) }
                    catch { self.logger.error("Close report failed: \(error.localizedDescription)") }
                }
                sender.reply(toApplicationShouldTerminate: true)
            case .failure(let error):
                self.logger.error("Draft flush failed: \(error.localizedDescription)")
                let alert = NSAlert()
                alert.messageText = "草稿未能保存"
                alert.informativeText = "创作室将保持打开。请先将作品保存为工程文件，再重试退出。"
                alert.addButton(withTitle: "继续画画")
                alert.runModal()
                sender.reply(toApplicationShouldTerminate: false)
            }
        }
        return .terminateLater
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
            if let data = try? JSONSerialization.data(withJSONObject: NSFontManager.shared.availableFontFamilies.sorted()),
               let json = String(data: data, encoding: .utf8) {
                webView?.evaluateJavaScript("window.JSHWSetFonts(\(json))")
            }
            if let smokePath, let view = webView {
                do {
                    let data = try JSONSerialization.data(withJSONObject: message.body, options: [.prettyPrinted, .sortedKeys])
                    try data.write(to: URL(fileURLWithPath: smokePath), options: .atomic)
                } catch { logger.error("Smoke report failed: \(error.localizedDescription)") }
                if ProcessInfo.processInfo.environment["JSHW_SMOKE_MUSIC"] == "1" {
                    view.callAsyncJavaScript("return await window.JSHWMusicSmoke();", arguments: [:], in: nil, in: .page) { result in
                        let value: [String: Any]
                        switch result {
                        case .success(let payload): value = ["ok": true, "result": payload]
                        case .failure(let error): value = ["ok": false, "error": error.localizedDescription]
                        }
                        do { try JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: smokePath + ".music.json"), options: .atomic) }
                        catch { self.logger.error("Music smoke report failed: \(error.localizedDescription)") }
                        self.finishSmoke(view: view, path: smokePath)
                    }
                } else { finishSmoke(view: view, path: smokePath) }

            }
            return
        }
        if message.name == "music" { handleMusic(message.body); return }
        guard message.name == "files", let body = message.body as? [String: String],
              let id = body["id"], let name = body["name"], let content = body["content"],
              let mime = body["mime"], ["image/png", "image/jpeg", "application/json"].contains(mime),
              content.utf8.count <= 180 * 1024 * 1024 else { return }
        let data: Data?
        let imagePrefix = "data:" + mime + ";base64,"
        if mime.hasPrefix("image/"), content.hasPrefix(imagePrefix) {
            data = Data(base64Encoded: String(content.dropFirst(imagePrefix.count)))
        } else if mime == "application/json" { data = content.data(using: .utf8) }
        else { data = nil }
        guard let data else { reply(id: id, error: "文件内容无法识别。"); return }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = String(name.split(separator: "/").last ?? "我的画")
        let extensionName = (name as NSString).pathExtension.lowercased()
        if mime == "image/png" { panel.allowedContentTypes = [.png] }
        else if mime == "image/jpeg" { panel.allowedContentTypes = [.jpeg] }
        else { panel.allowedContentTypes = [UTType(filenameExtension: extensionName == "jshwr" ? "jshwr" : "jshwx") ?? .data] }
        guard let window else { reply(id: id, error: "窗口不可用。"); return }
        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let url = panel.url else { self.reply(id: id, saved: false); return }
            do { try data.write(to: url, options: .atomic); self.reply(id: id, saved: true) }
            catch { self.reply(id: id, error: error.localizedDescription) }
        }
    }

    private func finishSmoke(view: WKWebView, path: String) {
        view.takeSnapshot(with: nil) { image, _ in
            guard let image, let data = image.tiffRepresentation,
                  let bitmap = NSBitmapImageRep(data: data),
                  let png = bitmap.representation(using: .png, properties: [:]) else { return }
            do { try png.write(to: URL(fileURLWithPath: path + ".png"), options: .atomic) }
            catch { self.logger.error("Snapshot write failed: \(error.localizedDescription)") }
            if ProcessInfo.processInfo.environment["JSHW_SMOKE_EXIT"] == "1" { NSApp.terminate(nil) }
        }
    }

    private func handleMusic(_ message: Any) {
        guard let body = message as? [String: Any], let id = body["id"] as? String,
              let action = body["action"] as? String, id.count < 100 else { return }
        var result: [String: Any] = ["id": id]
        do {
            switch action {
            case "track":
                guard let index = body["index"] as? Int, (0..<20).contains(index),
                      let root = Bundle.main.resourceURL else { throw MusicMessageError.invalid }
                let url = root.appendingPathComponent("site/music/back\(index).mid")
                try music.load(Data(contentsOf: url), name: "背景音乐 \(index + 1)")
                try music.play()
            case "import":
                guard let base64 = body["data"] as? String, base64.count <= 12 * 1024 * 1024,
                      let data = Data(base64Encoded: base64), let name = body["name"] as? String else { throw MusicMessageError.invalid }
                try music.load(data, name: name)
                try music.play()
            case "play": try music.play()
            case "stop": music.stop()
            case "volume":
                guard let volume = body["volume"] as? Float, volume.isFinite else { throw MusicMessageError.invalid }
                music.setVolume(volume)
            case "state": break
            default: throw MusicMessageError.invalid
            }
            result["state"] = music.state()
        } catch { result["error"] = error.localizedDescription; logger.error("Music operation failed: \(error.localizedDescription)") }
        if let data = try? JSONSerialization.data(withJSONObject: result), let json = String(data: data, encoding: .utf8) {
            webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('native-music-result', {detail: \(json)}))")
        }
    }

    private enum MusicMessageError: LocalizedError {
        case invalid
        var errorDescription: String? { "音乐操作参数无效。" }
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

@main
struct StudioApplication {
    @MainActor static func main() {
        let application = NSApplication.shared
        let delegate = StudioDelegate()
        application.delegate = delegate
        application.setActivationPolicy(.regular)
        withExtendedLifetime(delegate) { application.run() }
    }
}
