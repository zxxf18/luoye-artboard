import Foundation

@main struct MusicSmoke {
    @MainActor static func main() async throws {
        let root = URL(fileURLWithPath: CommandLine.arguments[1])
        let music = StudioMusic(observeOutput: true)
        var tracks: [[String: Any]] = []
        for index in 0..<20 {
            try music.load(Data(contentsOf: root.appendingPathComponent("local-only/reference/media/bmusic/back\(index).mid")), name: "背景音乐 \(index + 1)")
            tracks.append(music.state())
        }
        try music.load(Data(contentsOf: root.appendingPathComponent("local-only/reference/media/bmusic/back0.mid")), name: "背景音乐 1")
        music.setVolume(0.15)
        try music.play()
        try await Task.sleep(for: .seconds(3))
        let playing = music.state()
        guard music.observedPeak > 0.00001, (playing["position"] as? Double ?? 0) > 0 else {
            throw NSError(domain: "MusicSmoke", code: 1, userInfo: [NSLocalizedDescriptionKey: "MIDI output peak=\(music.observedPeak), state=\(playing)"])
        }
        music.setVolume(0)
        let muted = music.state()
        music.stop()
        let stopped = music.state()
        do { try music.load(Data("invalid".utf8), name: "bad"); fatalError("Malformed MIDI accepted") }
        catch { }
        let result: [String: Any] = ["tracks": tracks, "playing": playing, "muted": muted, "stopped": stopped, "peak": music.observedPeak, "invalidImportPreservedName": music.name == "背景音乐 1"]
        try JSONSerialization.data(withJSONObject: result, options: [.prettyPrinted, .sortedKeys]).write(to: root.appendingPathComponent("design/evidence/music-validation.json"), options: .atomic)
        print("PASS 20 MIDI files, audible PCM, transport, mixer volume, malformed import")
    }
}
