import AppKit
import WebKit
import UniformTypeIdentifiers
import os

@MainActor
final class StudioDelegate: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate, WKScriptMessageHandler, NSWindowDelegate, NSMenuItemValidation {
    private var window: NSWindow?
    private var webView: WKWebView?
    private var terminationPending = false
    private var interfaceReady = false
    private var pendingWindowSize: String?
    private let logger = Logger(subsystem: "local.luoye.studio", category: "desktop")
    private let smokePath = ProcessInfo.processInfo.environment["LUOYE_SMOKE_OUTPUT"]
    private lazy var music = StudioMusic(observeOutput: true)

    private var uiCopy: [String: String] = [:]
    private var menuState = MenuState()

    private struct MenuState {
        var blocked = true
        var editingText = false
        var canUndo = false
        var canRedo = false
    }

    private enum MenuCommand: String {
        case about = "about-open", settings = "more-open", language = "ui-language-choose"
        case new = "new-quick", open, save, gallery, export
        case undo, redo, cut, copy, paste, selectAll = "select-all"
        case zoomIn = "zoom-in", zoomOut = "zoom-out", fit

        var textAction: Selector? {
            switch self {
            case .cut: #selector(NSText.cut(_:))
            case .copy: #selector(NSText.copy(_:))
            case .paste: #selector(NSText.paste(_:))
            case .selectAll: #selector(NSText.selectAll(_:))
            default: nil
            }
        }

        var editsText: Bool { self == .undo || self == .redo || textAction != nil }
    }

    private func label(_ source: String) -> String { uiCopy[source] ?? source }

    private func configureMenu() {
        let menu = NSMenu()
        func submenu(_ source: String) -> NSMenu {
            let title = label(source)
            let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
            let submenu = NSMenu(title: title)
            item.submenu = submenu
            menu.addItem(item)
            return submenu
        }
        func add(_ command: MenuCommand, _ source: String, to menu: NSMenu, key: String = "",
                 modifiers: NSEvent.ModifierFlags = .command, opensDialog: Bool = false) {
            let title = label(source) + (opensDialog ? "…" : "")
            let item = menu.addItem(withTitle: title, action: #selector(performMenuCommand(_:)), keyEquivalent: key)
            item.target = self
            item.representedObject = command.rawValue
            item.keyEquivalentModifierMask = modifiers
        }

        let appMenu = submenu("落叶画板")
        add(.about, "关于落叶画板", to: appMenu)
        add(.settings, "设置", to: appMenu, key: ",", opensDialog: true)
        add(.language, "语言", to: appMenu)
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: label("退出落叶画板"), action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")

        let fileMenu = submenu("文件")
        add(.new, "新画纸", to: fileMenu, key: "n")
        add(.open, "打开作品", to: fileMenu, key: "o", opensDialog: true)
        add(.save, "保存作品", to: fileMenu, key: "s", opensDialog: true)
        fileMenu.addItem(.separator())
        add(.gallery, "我的画夹", to: fileMenu)
        add(.export, "导出图片", to: fileMenu, opensDialog: true)

        let editMenu = submenu("编辑")
        add(.undo, "撤销", to: editMenu, key: "z")
        add(.redo, "重做", to: editMenu, key: "z", modifiers: [.command, .shift])
        editMenu.addItem(.separator())
        add(.cut, "剪切", to: editMenu, key: "x")
        add(.copy, "复制", to: editMenu, key: "c")
        add(.paste, "粘贴", to: editMenu, key: "v")
        add(.selectAll, "全选", to: editMenu, key: "a")

        let viewMenu = submenu("视图")
        add(.zoomIn, "放大画布", to: viewMenu, key: "+")
        add(.zoomOut, "缩小画布", to: viewMenu, key: "-")
        add(.fit, "适合窗口", to: viewMenu, key: "0")
        viewMenu.addItem(.separator())
        let fullscreen = viewMenu.addItem(withTitle: label("进入全屏"), action: #selector(toggleMenuFullscreen(_:)), keyEquivalent: "f")
        fullscreen.target = self
        fullscreen.keyEquivalentModifierMask = [.control, .command]
        NSApp.mainMenu = menu
    }

    func validateMenuItem(_ item: NSMenuItem) -> Bool {
        guard let window, window.isKeyWindow, window.attachedSheet == nil, !terminationPending else { return false }
        if item.action == #selector(toggleMenuFullscreen(_:)) {
            item.title = label(window.styleMask.contains(.fullScreen) ? "退出全屏" : "进入全屏")
            return true
        }
        guard interfaceReady,
              let name = item.representedObject as? String,
              let command = MenuCommand(rawValue: name) else { return false }
        if menuState.editingText && command.editsText {
            switch command {
            case .undo: return webView?.undoManager?.canUndo == true
            case .redo: return webView?.undoManager?.canRedo == true
            default: return true
            }
        }
        guard !menuState.blocked else { return false }
        switch command {
        case .undo: return menuState.canUndo
        case .redo: return menuState.canRedo
        default: return true
        }
    }

    @objc private func performMenuCommand(_ sender: NSMenuItem) {
        guard validateMenuItem(sender),
              let name = sender.representedObject as? String,
              let command = MenuCommand(rawValue: name) else { return }
        webView?.callAsyncJavaScript("return window.LUOYEPerformMenuCommand(command);",
                                    arguments: ["command": name], in: nil, in: .page) { result in
            // The focused field may have changed since the menu was validated.
            // Let the page check focus before using the current AppKit responder.
            guard case .success(let editingText) = result, editingText as? Bool == true,
                  self.window?.isKeyWindow == true else { return }
            switch command {
            case .undo: self.webView?.undoManager?.undo()
            case .redo: self.webView?.undoManager?.redo()
            default:
                if let action = command.textAction { NSApp.sendAction(action, to: nil, from: sender) }
            }
        }
    }

    @objc private func toggleMenuFullscreen(_ sender: NSMenuItem) {
        guard validateMenuItem(sender) else { return }
        handleDisplay(["action": "fullscreen"])
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        configureMenu()
        let configuration = WKWebViewConfiguration()
        if smokePath != nil { configuration.websiteDataStore = .nonPersistent() }
        configuration.userContentController.add(self, name: "files")
        configuration.userContentController.add(self, name: "ready")
        configuration.userContentController.add(self, name: "locale")
        configuration.userContentController.add(self, name: "menuState")
        configuration.userContentController.add(self, name: "music")
        configuration.userContentController.add(self, name: "display")
        configuration.userContentController.add(self, name: "assets")
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.uiDelegate = self
        view.navigationDelegate = self
        if #available(macOS 13.3, *) { view.isInspectable = smokePath != nil }
        let window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1380, height: 900),
                              styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.delegate = self
        window.title = "落叶画板"
        // Keep the native floor large enough for the three-column studio and
        // parameter shelf to retain their readable controls when resized.
        window.contentMinSize = NSSize(width: 1024, height: 720)
        window.contentView = view
        window.center()
        window.makeKeyAndOrderFront(nil)
        self.window = window
        self.webView = view
        if smokePath != nil,
           let width = Double(ProcessInfo.processInfo.environment["LUOYE_SMOKE_WIDTH"] ?? ""),
           let height = Double(ProcessInfo.processInfo.environment["LUOYE_SMOKE_HEIGHT"] ?? ""),
           (1024...2560).contains(width), (720...1440).contains(height) {
            // Isolated UI checks can inspect a workspace larger than this display.
            window.setContentSize(NSSize(width: width, height: height))
        }
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
        // Before the drawing interface is ready there cannot be a new artwork.
        guard interfaceReady else { return .terminateNow }
        guard let webView else { return .terminateNow }
        if terminationPending { return .terminateCancel }
        terminationPending = true
        webView.callAsyncJavaScript("return await window.LUOYERequestClose();",
                                   arguments: [:], in: nil, in: .page) { result in
            self.terminationPending = false
            switch result {
            case .success(let response):
                guard let decision = response as? [String: Any], let action = decision["action"] as? String else {
                    sender.reply(toApplicationShouldTerminate: false)
                    return
                }
                if action == "cancel" { sender.reply(toApplicationShouldTerminate: false); return }
                if action == "save" {
                do {
                    let root: URL
                    if let path = self.smokePath { root = URL(fileURLWithPath: path + ".archive", isDirectory: true) }
                    else { root = try FileManager.default.url(for: .picturesDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("落叶画板作品", isDirectory: true) }
                    let saved = try StudioArchive(root: root).save(decision["payload"] as Any)
                    self.logger.notice("Artwork archived: \(saved.path)")
                } catch {
                    self.logger.error("Artwork save failed: \(error.localizedDescription)")
                    self.showError("作品还没有保存成功，画室会保持打开。", title: "草稿未能保存")
                    sender.reply(toApplicationShouldTerminate: false)
                    return
                }
                } else if action != "exit" { sender.reply(toApplicationShouldTerminate: false); return }
                if let path = self.smokePath {
                    do { try JSONSerialization.data(withJSONObject: ["action": action, "terminationApproved": true]).write(to: URL(fileURLWithPath: path + ".close.json"), options: .atomic) }
                    catch { self.logger.error("Close report failed: \(error.localizedDescription)") }
                }
                sender.reply(toApplicationShouldTerminate: true)
            case .failure(let error):
                self.logger.error("Draft flush failed: \(error.localizedDescription)")
                let alert = NSAlert()
                alert.messageText = self.label("草稿未能保存")
                alert.informativeText = self.label("创作室将保持打开。请先将作品保存为工程文件，再重试退出。")
                alert.addButton(withTitle: self.label("继续画画"))
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
        let externalLinks = ["https://github.com/zxxf18/luoye-artboard", "https://index.yebuluo.com.cn/donate/"]
        if navigationAction.navigationType == .linkActivated,
           navigationAction.sourceFrame.isMainFrame,
           externalLinks.contains(url.absoluteString) {
            decisionHandler(.cancel)
            if !NSWorkspace.shared.open(url) { showError("无法打开浏览器，请稍后重试") }
            return
        }
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
            interfaceReady = true
            logger.notice("Painting interface loaded")
            if let data = try? JSONSerialization.data(withJSONObject: NSFontManager.shared.availableFontFamilies.sorted()),
               let json = String(data: data, encoding: .utf8) {
                webView?.evaluateJavaScript("window.LUOYESetFonts(\(json))")
            }
            if let smokePath, let view = webView {
                do {
                    let data = try JSONSerialization.data(withJSONObject: message.body, options: [.prettyPrinted, .sortedKeys])
                    try data.write(to: URL(fileURLWithPath: smokePath), options: .atomic)
                } catch { logger.error("Smoke report failed: \(error.localizedDescription)") }
                if let scriptPath = ProcessInfo.processInfo.environment["LUOYE_SMOKE_SCRIPT"],
                   let script = try? String(contentsOfFile: scriptPath, encoding: .utf8) {
                    view.callAsyncJavaScript(script, arguments: ["fileChecks": ProcessInfo.processInfo.environment["LUOYE_SMOKE_FILES"] == "1"], in: nil, in: .page) { result in
                        if case .success(let payload) = result,
                           let report = payload as? [String: Any], report["reloadForTest"] as? Bool == true,
                           ProcessInfo.processInfo.environment["LUOYE_SMOKE_RELOAD"] == "1" {
                            view.reload()
                            return
                        }
                        let value: [String: Any]
                        switch result {
                        case .success(let payload): value = ["ok": true, "result": payload]
                        case .failure(let error): value = ["ok": false, "error": error.localizedDescription]
                        }
                        do { try JSONSerialization.data(withJSONObject: value, options: [.prettyPrinted, .sortedKeys]).write(to: URL(fileURLWithPath: smokePath + ".checks.json"), options: .atomic) }
                        catch { self.logger.error("UI check report failed: \(error.localizedDescription)") }
                        self.finishSmoke(view: view, path: smokePath)
                    }
                } else if ProcessInfo.processInfo.environment["LUOYE_SMOKE_MUSIC"] == "1" {
                    view.callAsyncJavaScript("return await window.LUOYEMusicSmoke();", arguments: [:], in: nil, in: .page) { result in
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
        if message.name == "locale", let labels = message.body as? [String: String], labels.count <= 48 {
            uiCopy = labels.filter { $0.key.count <= 120 && $0.value.count <= 280 }
            window?.title = label("落叶画板")
            configureMenu()
            return
        }
        if message.name == "menuState", let state = message.body as? [String: Bool] {
            menuState = MenuState(blocked: state["blocked"] ?? true, editingText: state["editingText"] ?? false,
                                  canUndo: state["canUndo"] ?? false, canRedo: state["canRedo"] ?? false)
            return
        }
        if message.name == "assets" { handleAsset(message.body); return }
        if message.name == "music" { handleMusic(message.body); return }
        if message.name == "display" { handleDisplay(message.body); return }
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
        if let smokePath, ProcessInfo.processInfo.environment["LUOYE_SMOKE_FILES"] == "1" {
            // Only the explicitly launched isolated smoke process bypasses the save panel.
            let filename = String(name.split(separator: "/").last ?? "我的画")
            do { try data.write(to: URL(fileURLWithPath: smokePath + "." + filename), options: .atomic); reply(id: id, saved: true) }
            catch { reply(id: id, error: error.localizedDescription) }
            return
        }
        let panel = NSSavePanel()
        panel.nameFieldStringValue = String(name.split(separator: "/").last ?? "我的画")
        let extensionName = (name as NSString).pathExtension.lowercased()
        if mime == "image/png" { panel.allowedContentTypes = [.png] }
        else if mime == "image/jpeg" { panel.allowedContentTypes = [.jpeg] }
        else { panel.allowedContentTypes = [UTType(filenameExtension: extensionName == "luoyer" ? "luoyer" : "luoyex") ?? .data] }
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
            if ProcessInfo.processInfo.environment["LUOYE_SMOKE_EXIT"] == "1" { NSApp.terminate(nil) }
        }
    }

    private func handleAsset(_ message: Any) {
        guard let body = message as? [String: String], let id = body["id"], id.count < 100,
              let path = body["path"], let root = Bundle.main.resourceURL?.appendingPathComponent("site", isDirectory: true) else { return }
        var result: [String: String] = ["id": id]
        do {
            let url = root.appendingPathComponent(path).resolvingSymlinksInPath()
            guard (path.hasPrefix("assets/") || path.hasPrefix("classic/")),
                  url.path.hasPrefix(root.resolvingSymlinksInPath().path + "/"),
                  ["png", "jpg", "jpeg", "webp"].contains(url.pathExtension.lowercased()),
                  try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? Int.max < 32 * 1024 * 1024 else {
                throw NSError(domain: "StudioAsset", code: 1, userInfo: [NSLocalizedDescriptionKey: "素材路径或大小无效。"])
            }
            let data = try Data(contentsOf: url)
            let type = url.pathExtension == "jpg" ? "jpeg" : url.pathExtension
            result["data"] = "data:image/" + type + ";base64," + data.base64EncodedString()
        } catch { result["error"] = "素材没有读出来：" + error.localizedDescription }
        if let data = try? JSONSerialization.data(withJSONObject: result), let json = String(data: data, encoding: .utf8) {
            webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('native-asset-result', {detail: \(json)}))")
        }
    }

    private func handleDisplay(_ message: Any) {
        guard let body = message as? [String: String], let action = body["action"],
              let window, let screen = window.screen ?? NSScreen.main else { return }
        if action == "fullscreen" { pendingWindowSize = nil; window.toggleFullScreen(nil); return }
        let desired: NSSize
        switch action {
        case "1080": desired = NSSize(width: 1920, height: 1080)
        case "2k": desired = NSSize(width: 2560, height: 1440)
        case "fit": desired = screen.visibleFrame.size
        default: return
        }
        if window.styleMask.contains(.fullScreen) {
            pendingWindowSize = action
            window.toggleFullScreen(nil)
            return
        }
        let available = window.contentRect(forFrameRect: screen.visibleFrame).size
        window.setContentSize(NSSize(width: min(desired.width, available.width), height: min(desired.height, available.height)))
        window.center()
        publishDisplaySize()
    }

    func windowDidResize(_ notification: Notification) { publishDisplaySize() }

    func windowDidExitFullScreen(_ notification: Notification) {
        guard let action = pendingWindowSize else { return }
        pendingWindowSize = nil
        handleDisplay(["action": action])
    }

    private func publishDisplaySize() {
        guard let view = webView else { return }
        let size = view.bounds.size
        view.evaluateJavaScript("window.dispatchEvent(new CustomEvent('native-display-result', {detail: {width: \(size.width), height: \(size.height)}}))")
    }

    private func handleMusic(_ message: Any) {
        guard let body = message as? [String: Any], let id = body["id"] as? String,
              let action = body["action"] as? String, id.count < 100 else { return }
        var result: [String: Any] = ["id": id]
        do {
            switch action {
            case "track":
                guard let index = body["index"] as? Int,
                      let root = Bundle.main.resourceURL else { throw MusicMessageError.invalid }
                let directory = root.appendingPathComponent("site/music")
                guard let tracks = try JSONSerialization.jsonObject(with: Data(contentsOf: directory.appendingPathComponent("tracks.json"))) as? [[String: Any]],
                      tracks.indices.contains(index), let file = tracks[index]["file"] as? String,
                      let gain = tracks[index]["gain"] as? Double,
                      (file as NSString).lastPathComponent == file, file.hasSuffix(".mid") else { throw MusicMessageError.invalid }
                try music.load(Data(contentsOf: directory.appendingPathComponent(file)), name: tracks[index]["label"] as? String ?? "音乐\(index + 1)", gain: Float(gain))
                if body["autoplay"] as? Bool ?? true { try music.play() }
            case "import":
                guard let base64 = body["data"] as? String, base64.count <= 12 * 1024 * 1024,
                      let data = Data(base64Encoded: base64), let name = body["name"] as? String else { throw MusicMessageError.invalid }
                try music.load(data, name: name)
                try music.play()
            case "play": try music.play()
            case "stop": music.stop()
            case "volume":
                guard let volume = body["volume"] as? Double, volume.isFinite else { throw MusicMessageError.invalid }
                music.setVolume(Float(volume))
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

    private func showError(_ message: String, title: String = "创作室暂时没有打开") {
        logger.error("Load failed: \(message)")
        let alert = NSAlert()
        alert.messageText = label(title)
        alert.informativeText = label(message)
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
