import Foundation
@main struct ArchiveSmoke {
    static func main() throws {
        let root=URL(fileURLWithPath:CommandLine.arguments[1],isDirectory:true)
        let writer=StudioArchive(root:root)
        let payload:[String:Any] = ["sessionId":UUID().uuidString,"revision":1,"project":["title":"关闭保存验证","layers":[]],"png":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg=="]
        let first=try writer.save(payload),retry=try writer.save(payload)
        precondition(first==retry)
        precondition(FileManager.default.fileExists(atPath:first.appendingPathComponent("作品.png").path))
        var different=payload;different["project"]=["title":"不能覆盖"]
        do {_=try writer.save(different);fatalError("Collision replaced a snapshot")} catch {}
        var invalid=payload;invalid["sessionId"]="../../escape"
        do {_=try writer.save(invalid);fatalError("Invalid ID accepted")} catch {}
        let blocked=root.appendingPathComponent("not-a-directory")
        try Data("blocked".utf8).write(to:blocked)
        do {_=try StudioArchive(root:blocked).save(payload);fatalError("Write failure acknowledged")} catch {}
        print("PASS pair publication, idempotent retry, collision protection, path validation, write failure")
    }
}
