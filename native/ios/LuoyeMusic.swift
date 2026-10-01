import AVFoundation
import AudioToolbox
import Foundation

/// The iOS music adapter intentionally uses a bundled SoundFont instead of
/// assuming macOS's DLS synth exists on an iPhone or iPad.
@MainActor
final class LuoyeMusic {
    private let engine = AVAudioEngine()
    private let sampler = AVAudioUnitSampler()
    private var sequencer: AVAudioSequencer?
    private(set) var name = "尚未选择音乐"
    private(set) var duration: Double = 0

    init() throws {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .default, options: [.mixWithOthers])
        try session.setActive(true)
        engine.attach(sampler)
        engine.connect(sampler, to: engine.mainMixerNode, format: nil)
        guard let bank = Bundle.main.url(forResource: "GeneralUser-GS", withExtension: "sf2", subdirectory: "audio") else {
            throw NSError(domain: "LuoyeMusic", code: 1, userInfo: [NSLocalizedDescriptionKey: "音乐音色库没有打包。"])
        }
        try sampler.loadSoundBankInstrument(at: bank, program: 0,
                                            bankMSB: UInt8(kAUSampler_DefaultMelodicBankMSB),
                                            bankLSB: UInt8(kAUSampler_DefaultBankLSB))
        engine.mainMixerNode.outputVolume = 0.35
        NotificationCenter.default.addObserver(self, selector: #selector(interrupted), name: AVAudioSession.interruptionNotification, object: session)
    }

    deinit { NotificationCenter.default.removeObserver(self) }

    func load(_ data: Data, name: String) throws {
        guard data.count >= 14, data.count <= 8 * 1024 * 1024,
              data.prefix(4) == Data("MThd".utf8) else {
            throw NSError(domain: "LuoyeMusic", code: 2, userInfo: [NSLocalizedDescriptionKey: "请选择 8 MiB 以内的标准 MIDI 文件。"])
        }
        let next = AVAudioSequencer(audioEngine: engine)
        try next.load(from: data, options: [])
        let length = next.tracks.map(\.lengthInSeconds).max() ?? 0
        guard !next.tracks.isEmpty, length.isFinite, length > 0, length < 86400 else {
            throw NSError(domain: "LuoyeMusic", code: 3, userInfo: [NSLocalizedDescriptionKey: "音乐没有可播放的轨道，或时长超出范围。"])
        }
        stop()
        let beats = next.tracks.map(\.lengthInBeats).max() ?? 0
        for track in next.tracks {
            track.destinationAudioUnit = sampler
            track.loopRange = AVBeatRange(start: 0, length: beats)
            track.numberOfLoops = AVMusicTrackLoopCount.forever.rawValue
            track.isLoopingEnabled = true
        }
        sequencer = next
        duration = length
        self.name = String(name.prefix(120))
    }

    func play() throws {
        guard let sequencer else { return }
        if sequencer.currentPositionInSeconds >= duration { sequencer.currentPositionInSeconds = 0 }
        if !engine.isRunning { try engine.start() }
        sequencer.prepareToPlay()
        try sequencer.start()
    }

    func stop() {
        sequencer?.stop()
        sequencer?.currentPositionInSeconds = 0
        for channel in UInt8(0)..<UInt8(16) {
            sampler.sendController(64, withValue: 0, onChannel: channel)
            sampler.sendController(123, withValue: 0, onChannel: channel)
            sampler.sendController(120, withValue: 0, onChannel: channel)
        }
    }

    func setVolume(_ volume: Float) {
        guard volume.isFinite else { return }
        engine.mainMixerNode.outputVolume = min(1, max(0, volume))
    }

    func state() -> [String: Any] {
        let position = sequencer?.currentPositionInSeconds ?? 0
        return [
            "name": name,
            "duration": duration,
            "position": duration > 0 ? position.truncatingRemainder(dividingBy: duration) : 0,
            "playing": sequencer?.isPlaying ?? false,
            "volume": engine.mainMixerNode.outputVolume,
            "peak": 0,
        ]
    }

    @objc private func interrupted(_ note: Notification) {
        guard let info = note.userInfo,
              let typeValue = info[AVAudioSessionInterruptionTypeKey] as? UInt,
              let type = AVAudioSession.InterruptionType(rawValue: typeValue) else { return }
        if type == .began { sequencer?.stop() }
    }
}
