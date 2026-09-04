using MeltySynth;
using System.Text.Json;
var root=args[0];var synth=new Synthesizer(Path.Combine(root,"native/windows/audio/GeneralUser-GS.sf2"),44100);var seq=new MidiFileSequencer(synth);
var results=new List<object>();
for(var i=0;i<20;i++){
 var midi=new MidiFile(Path.Combine(root,$"public/music/back{i}.mid"));synth.Reset();seq.Play(midi,false);var buffer=new float[44100*2];float peak=0;
 for(var j=0;j<4;j++){seq.RenderInterleaved(buffer);peak=Math.Max(peak,buffer.Max(x=>Math.Abs(x)));}
 if(peak<.00001)throw new Exception("Silent MIDI "+i);results.Add(new{track=i+1,duration=midi.Length.TotalSeconds,peak});seq.Stop();
}
File.WriteAllText(Path.Combine(root,"design/evidence/windows-midi-pcm.json"),JsonSerializer.Serialize(results,new JsonSerializerOptions{WriteIndented=true}));Console.WriteLine("PASS all 20 tracks produce nonzero PCM with the Windows software synthesizer (audio device not tested on macOS)");
