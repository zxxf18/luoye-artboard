import AVFoundation
import AudioToolbox
import Foundation

@MainActor
final class StudioMusic {
    private let engine = AVAudioEngine()
    private let instrument: AVAudioUnitMIDIInstrument
    private var sequencer: AVAudioSequencer?
    private(set) var name = "尚未选择音乐"
    private(set) var duration: Double = 0
    private(set) var observedPeak: Float = 0

    init(observeOutput: Bool = false) {
        let component = AudioComponentDescription(componentType: kAudioUnitType_MusicDevice,
            componentSubType: kAudioUnitSubType_DLSSynth, componentManufacturer: kAudioUnitManufacturer_Apple,
            componentFlags: 0, componentFlagsMask: 0)
        instrument = AVAudioUnitMIDIInstrument(audioComponentDescription: component)
        engine.attach(instrument)
        engine.connect(instrument, to: engine.mainMixerNode, format: nil)
        engine.mainMixerNode.outputVolume = 0.5
        if observeOutput {
            // Audio taps execute off the main actor; only the measured scalar crosses back.
            engine.mainMixerNode.installTap(onBus: 0, bufferSize: 1024, format: nil) { @Sendable [weak self] buffer, _ in
                guard let samples = buffer.floatChannelData else { return }
                var peak: Float = 0
                for i in 0..<Int(buffer.frameLength) { peak = max(peak, abs(samples[0][i])) }
                let measured = peak
                Task { @MainActor [weak self] in self?.observedPeak = max(self?.observedPeak ?? 0, measured) }
            }
        }
    }

    func load(_ data: Data, name: String) throws {
        guard data.count >= 14, data.count <= 8 * 1024 * 1024, data.prefix(4) == Data("MThd".utf8) else {
            throw NSError(domain: "StudioMusic", code: 1, userInfo: [NSLocalizedDescriptionKey: "请选择 8 MiB 以内的标准 MIDI 文件。"])
        }
        // Parse first, so a rejected import leaves the current track intact.
        let probe = AVAudioSequencer()
        try probe.load(from: data, options: [])
        let length = probe.tracks.map(\.lengthInSeconds).max() ?? 0
        guard !probe.tracks.isEmpty, length.isFinite, length > 0, length < 86400 else {
            throw NSError(domain: "StudioMusic", code: 2, userInfo: [NSLocalizedDescriptionKey: "音乐没有可播放的轨道，或时长超出范围。"])
        }
        stop()
        // Keep one sequencer per engine: destroying a replaced sequencer invalidates engine MIDI rendering.
        let next = sequencer ?? AVAudioSequencer(audioEngine: engine)
        try next.load(from: data, options: [])
        for track in next.tracks { track.destinationAudioUnit = instrument }
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
        // A stopped sequence can leave sustain active; silence all sixteen MIDI channels.
        for channel in UInt8(0)..<UInt8(16) {
            instrument.sendController(64, withValue: 0, onChannel: channel)
            instrument.sendController(123, withValue: 0, onChannel: channel)
            instrument.sendController(120, withValue: 0, onChannel: channel)
        }
    }

    func setVolume(_ volume: Float) {
        guard volume.isFinite else { return }
        engine.mainMixerNode.outputVolume = min(1, max(0, volume))
    }

    func state() -> [String: Any] {
        let position = sequencer?.currentPositionInSeconds ?? 0
        if position >= duration, sequencer?.isPlaying == true { stop() }
        return ["name": name, "duration": duration, "position": sequencer?.currentPositionInSeconds ?? 0,
                "playing": sequencer?.isPlaying ?? false, "volume": engine.mainMixerNode.outputVolume, "peak": observedPeak]
    }
}
