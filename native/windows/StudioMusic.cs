using MeltySynth;
using NAudio.Wave;

namespace Luoye;

// The lock protects the sequencer across the UI and wave output threads.
sealed class StudioMusic : ISampleProvider, IDisposable
{
    private readonly object mutex = new();
    private readonly Synthesizer synth;
    private readonly MidiFileSequencer sequencer;
    private readonly WaveOutEvent output = new();
    private MidiFile? midi;
    private bool playing;
    private float volume = .35f, peak;
    private string name = "尚未选择音乐";
    public WaveFormat WaveFormat { get; } = WaveFormat.CreateIeeeFloatWaveFormat(44100, 2);

    public StudioMusic(string soundFont)
    {
        synth = new Synthesizer(soundFont, WaveFormat.SampleRate);
        sequencer = new MidiFileSequencer(synth);
        output.Init(this); output.Play();
    }
    public void Load(byte[] data, string title)
    {
        if (data.Length < 14 || data.Length > 8 * 1024 * 1024 || !data.AsSpan(0, 4).SequenceEqual("MThd"u8))
            throw new InvalidDataException("请选择 8 MiB 以内的标准 MIDI 文件。");
        // Parse before mutating playback, preserving the previous track on a bad import.
        var next = new MidiFile(new MemoryStream(data, false));
        if (next.Length.TotalSeconds <= 0 || next.Length.TotalSeconds > 86400)
            throw new InvalidDataException("音乐时长超出范围。");
        lock (mutex) { sequencer.Stop(); synth.Reset(); midi = next; name = title[..Math.Min(title.Length,120)]; peak = 0; playing = false; }
    }
    public void Play() { lock (mutex) { if(midi is null)return; sequencer.Play(midi, true); playing = true; } }
    public void Stop() { lock (mutex) { playing = false; sequencer.Stop(); synth.Reset(); } }
    public void SetVolume(double value) { if(!double.IsFinite(value))throw new InvalidDataException("音量无效。");lock(mutex)volume=(float)Math.Clamp(value,0,1); }
    public object State() { lock(mutex)return new { name, duration=midi?.Length.TotalSeconds??0, position=sequencer.Position.TotalSeconds, playing, volume, peak }; }
    public int Read(float[] buffer, int offset, int count)
    {
        lock (mutex) {
            var span = buffer.AsSpan(offset,count);
            if(!playing){span.Clear();return count;}
            sequencer.RenderInterleaved(span);
            for(var i=0;i<span.Length;i++){span[i]*=volume;peak=Math.Max(peak,Math.Abs(span[i]));}
        }
        return count;
    }
    public void Dispose() { output.Stop(); output.Dispose(); }
}
