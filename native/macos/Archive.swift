import Foundation

/// Publish the project and its image together. A repeated close request is idempotent.
struct StudioArchive {
    let root: URL

    func save(_ payload: Any) throws -> URL {
        guard let value = payload as? [String: Any],
              let session = value["sessionId"] as? String, UUID(uuidString: session) != nil,
              let revision = value["revision"] as? Int, revision >= 0,
              let project = value["project"] as? [String: Any],
              let image = value["png"] as? String, image.hasPrefix("data:image/png;base64,"),
              image.utf8.count < 180 * 1024 * 1024,
              let png = Data(base64Encoded: String(image.dropFirst(22))), png.starts(with: [137,80,78,71,13,10,26,10]) else {
            throw NSError(domain: "StudioArchive", code: 1, userInfo: [NSLocalizedDescriptionKey: "自动保存的作品数据不完整。"])
        }
        let json = try JSONSerialization.data(withJSONObject: project, options: [.sortedKeys])
        guard json.count <= 128 * 1024 * 1024 else {
            throw NSError(domain: "StudioArchive", code: 2, userInfo: [NSLocalizedDescriptionKey: "工程超过自动保存的大小限制，请先减少图层。"])
        }
        let destination = root.appendingPathComponent(session + "-" + String(revision), isDirectory: true)
        let files = FileManager.default
        try files.createDirectory(at: root, withIntermediateDirectories: true)
        if files.fileExists(atPath: destination.path) {
            // Compare bytes before acknowledging a retry; never silently replace another snapshot.
            if try Data(contentsOf: destination.appendingPathComponent("作品.luoyex")) == json,
               try Data(contentsOf: destination.appendingPathComponent("作品.png")) == png { return destination }
            throw NSError(domain: "StudioArchive", code: 3, userInfo: [NSLocalizedDescriptionKey: "保存编号重复，但作品内容不同。请重试保存。"])
        }
        let staging = root.appendingPathComponent(".saving-" + UUID().uuidString, isDirectory: true)
        try files.createDirectory(at: staging, withIntermediateDirectories: false)
        defer { try? files.removeItem(at: staging) }
        try json.write(to: staging.appendingPathComponent("作品.luoyex"), options: .atomic)
        try png.write(to: staging.appendingPathComponent("作品.png"), options: .atomic)
        let metadata: [String: Any] = ["title": project["title"] as? String ?? "我的画", "savedAt": ISO8601DateFormatter().string(from: Date()), "sessionId": session, "revision": revision]
        try JSONSerialization.data(withJSONObject: metadata, options: [.prettyPrinted, .sortedKeys]).write(to: staging.appendingPathComponent("作品信息.json"), options: .atomic)
        try files.moveItem(at: staging, to: destination)
        return destination
    }
}
