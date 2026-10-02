import Foundation
import UIKit
import UniformTypeIdentifiers
import WebKit

@MainActor
final class LuoyeBridge: NSObject, WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate, UIDocumentPickerDelegate {
    weak var webView: WKWebView?
    weak var presenter: UIViewController?
    private weak var host: LuoyeWebViewController?
    private var pendingExport: (id: String, url: URL)?
    private var pendingOpen: (([URL]?) -> Void)?
    private var music: LuoyeMusic?
    private let smokeFileOutputURL: URL?

    init(host: LuoyeWebViewController?, smokeFileOutputURL: URL? = nil) {
        self.host = host
        self.smokeFileOutputURL = smokeFileOutputURL
        super.init()
    }

    func setHost(_ host: LuoyeWebViewController) { self.host = host }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.protocol == "file" else { return }
        switch message.name {
        case "ready":
            host?.interfaceReady = true
            host?.runSmokeIfRequested()
        case "files": handleFile(message.body)
        case "music": handleMusic(message.body)
        case "display": handleDisplay(message.body)
        case "assets": handleAsset(message.body)
        default: break
        }
    }

    // iOS enables file inputs by default, but using a document picker here
    // makes .luoyex and cloud-provider imports behave consistently on iPhone
    // and iPad. The copied URL stays inside the app's temporary directory.
    @available(iOS 18.4, *)
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping @MainActor ([URL]?) -> Void) {
        guard let presenter else { completionHandler(nil); return }
        pendingOpen = completionHandler
        let types: [UTType] = [.data, .image, .audio]
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: types, asCopy: true)
        picker.delegate = self
        picker.allowsMultipleSelection = false
        presenter.present(picker, animated: true)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping @MainActor (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        let site = Bundle.main.resourceURL?.appendingPathComponent("site", isDirectory: true).standardizedFileURL.path ?? ""
        let allowed = site + "/"
        if url.isFileURL {
            decisionHandler(url.standardizedFileURL.path.hasPrefix(allowed) ? .allow : .cancel)
            return
        }
        let external = ["https://github.com/zxxf18/luoye-artboard", "https://index.yebuluo.com.cn/donate/"]
        if navigationAction.navigationType == .linkActivated, external.contains(url.absoluteString) {
            decisionHandler(.cancel)
            UIApplication.shared.open(url)
        } else { decisionHandler(.cancel) }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        host?.showError("画板资源没有打开：" + error.localizedDescription)
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        if let pendingOpen {
            defer { self.pendingOpen = nil }
            guard let source = urls.first else { pendingOpen(nil); return }
            do {
                let destination = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + "-" + source.lastPathComponent)
                try FileManager.default.copyItem(at: source, to: destination)
                pendingOpen([destination])
            } catch { pendingOpen(nil) }
            return
        }
        guard let pendingExport else { return }
        self.pendingExport = nil
        sendFileResult(id: pendingExport.id, saved: true)
        try? FileManager.default.removeItem(at: pendingExport.url)
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        if let pendingOpen { self.pendingOpen = nil; pendingOpen(nil); return }
        if let pendingExport { self.pendingExport = nil; sendFileResult(id: pendingExport.id, saved: false); try? FileManager.default.removeItem(at: pendingExport.url) }
    }

    private func handleFile(_ body: Any) {
        guard let value = body as? [String: Any],
              let id = value["id"] as? String, id.count <= 100,
              let name = value["name"] as? String,
              let mime = value["mime"] as? String,
              let content = value["content"] as? String else { return }
        do {
            let data = try decodeFile(mime: mime, content: content)
            guard data.count <= 180 * 1024 * 1024 else { throw BridgeError.invalidFile("文件超过 180 MiB 上限") }
            guard pendingExport == nil else { throw BridgeError.invalidFile("已有文件保存窗口打开") }
            let extensionName = mime == "image/png" ? "png" : mime == "image/jpeg" ? "jpg" : "luoyex"
            let safeName = sanitize(name, fallback: "落叶画板文件")
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + "-" + (safeName as NSString).deletingPathExtension + "." + extensionName)
            try data.write(to: url, options: .atomic)
            #if DEBUG
            if let smokeFileOutputURL {
                let outputName = ["", ".", ".."].contains(safeName) ? "落叶画板文件" : safeName
                let destination = URL(fileURLWithPath: smokeFileOutputURL.path + "." + outputName)
                try data.write(to: destination, options: .atomic)
                sendFileResult(id: id, saved: true)
                try? FileManager.default.removeItem(at: url)
                return
            }
            #endif
            guard let presenter else { throw BridgeError.invalidFile("当前页面没有可用的保存窗口") }
            let picker = UIDocumentPickerViewController(forExporting: [url], asCopy: true)
            picker.delegate = self
            pendingExport = (id, url)
            presenter.present(picker, animated: true)
        } catch { sendFileResult(id: id, error: error.localizedDescription) }
    }

    private func handleMusic(_ body: Any) {
        guard let value = body as? [String: Any], let id = value["id"] as? String else { return }
        do {
            if music == nil { music = try LuoyeMusic() }
            guard let music else { throw BridgeError.invalidMusic }
            let action = value["action"] as? String ?? ""
            switch action {
            case "track":
                guard let index = value["index"] as? Int, (0..<20).contains(index),
                      let root = Bundle.main.resourceURL else { throw BridgeError.invalidMusic }
                let file = root.appendingPathComponent("site/music/back\(index).mid")
                try music.load(Data(contentsOf: file), name: "音乐\(index + 1)")
                if value["autoplay"] as? Bool ?? true { try music.play() }
            case "import":
                guard let base64 = value["data"] as? String, base64.utf8.count <= 12 * 1024 * 1024,
                      let data = Data(base64Encoded: base64), let name = value["name"] as? String else { throw BridgeError.invalidMusic }
                try music.load(data, name: name)
                try music.play()
            case "play": try music.play()
            case "stop": music.stop()
            case "volume":
                guard let volume = value["volume"] as? Double, volume.isFinite else { throw BridgeError.invalidMusic }
                music.setVolume(Float(volume))
            case "state": break
            default: throw BridgeError.invalidMusic
            }
            sendMusicResult(id: id, state: music.state())
        } catch { sendMusicResult(id: id, error: error.localizedDescription) }
    }

    private func handleDisplay(_ body: Any) {
        guard let action = (body as? [String: Any])?["action"] as? String else { return }
        guard ["fit", "1080", "2k", "fullscreen"].contains(action) else { return }
        if action == "fullscreen" { host?.toggleImmersive() }
        host?.publishDisplaySize()
    }

    private func handleAsset(_ body: Any) {
        guard let value = body as? [String: Any], let id = value["id"] as? String,
              let path = value["path"] as? String, id.count <= 100,
              path.range(of: #"^(assets|classic)/[A-Za-z0-9_./-]+\.(png|jpg|jpeg|webp)$"#, options: .regularExpression) != nil,
              let root = Bundle.main.resourceURL?.appendingPathComponent("site", isDirectory: true) else { return }
        do {
            let file = root.appendingPathComponent(path).standardizedFileURL
            guard file.path.hasPrefix(root.standardizedFileURL.path + "/"),
                  let size = try file.resourceValues(forKeys: [.fileSizeKey]).fileSize,
                  size < 32 * 1024 * 1024 else { throw BridgeError.invalidFile("素材路径或大小无效") }
            let ext = file.pathExtension.lowercased()
            let mime = ext == "jpg" || ext == "jpeg" ? "jpeg" : ext
            let result: [String: Any] = ["id": id, "data": "data:image/\(mime);base64," + (try Data(contentsOf: file)).base64EncodedString()]
            sendEvent("native-asset-result", detail: result)
        } catch { sendEvent("native-asset-result", detail: ["id": id, "error": "素材没有读出来：\(error.localizedDescription)"]) }
    }

    private func decodeFile(mime: String, content: String) throws -> Data {
        guard ["application/json", "image/png", "image/jpeg"].contains(mime) else { throw BridgeError.invalidFile("不支持的文件格式") }
        if mime == "application/json" { guard let data = content.data(using: .utf8) else { throw BridgeError.invalidFile("工程内容不是 UTF-8") }; return data }
        let prefix = "data:\(mime);base64,"
        guard content.hasPrefix(prefix), let data = Data(base64Encoded: String(content.dropFirst(prefix.count))) else { throw BridgeError.invalidFile("图片内容无法识别") }
        return data
    }

    private func sanitize(_ value: String, fallback: String) -> String {
        let name = value.split(whereSeparator: { $0 == "/" || $0 == "\\" }).last.map(String.init) ?? fallback
        return String(name.prefix(120)).isEmpty ? fallback : String(name.prefix(120))
    }

    private func sendFileResult(id: String, saved: Bool = false, error: String? = nil) {
        var detail: [String: Any] = ["id": id, "saved": saved]
        if let error { detail["error"] = error }
        sendEvent("native-file-result", detail: detail)
    }

    private func sendMusicResult(id: String, state: [String: Any]? = nil, error: String? = nil) {
        var detail: [String: Any] = ["id": id]
        if let state { detail["state"] = state }
        if let error { detail["error"] = error }
        sendEvent("native-music-result", detail: detail)
    }

    private func sendEvent(_ name: String, detail: [String: Any]) {
        guard let data = try? JSONSerialization.data(withJSONObject: detail), let json = String(data: data, encoding: .utf8) else { return }
        webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('\(name)',{detail:\(json)}))")
    }

    private enum BridgeError: LocalizedError {
        case invalidFile(String)
        case invalidMusic
        var errorDescription: String? {
            switch self { case .invalidFile(let message): return message; case .invalidMusic: return "音乐操作参数无效。" }
        }
    }
}
