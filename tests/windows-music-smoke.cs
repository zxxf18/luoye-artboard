using MeltySynth;
using System.Text.Json;
var root=args[0];var synth=new Synthesizer(Path.Combine(root,"native/windows/audio/GeneralUser-GS.sf2"),44100);var seq=new MidiFileSequencer(synth);
if(args.Length>1&&args[1]=="--levels") {
 var levels=new List<object>();
 foreach(var folder in new[]{"local-only/music-backup/original-v1.7.1","public/music"})foreach(var file in Directory.GetFiles(Path.Combine(root,folder),"*.mid")){
  var song=new MidiFile(file);synth.Reset();seq.Play(song,false);var samples=new float[4096];double energy=0;long count=0;float peak=0;
  var blocks=(int)Math.Ceiling(Math.Min(60,song.Length.TotalSeconds)*44100*2/samples.Length);
  for(var block=0;block<blocks;block++){seq.RenderInterleaved(samples);double sum=0;foreach(var value in samples){sum+=value*value;peak=Math.Max(peak,Math.Abs(value));}if(sum/samples.Length>1e-6){energy+=sum;count+=samples.Length;}}
  levels.Add(new{folder,file=Path.GetFileName(file),rms=Math.Sqrt(energy/Math.Max(1,count)),peak});seq.Stop();
 }
 File.WriteAllText(Path.Combine(root,"build/music-levels.json"),JsonSerializer.Serialize(levels,new JsonSerializerOptions{WriteIndented=true}));Console.WriteLine("Measured old and new music levels.");return;
}
using var catalog=JsonDocument.Parse(File.ReadAllText(Path.Combine(root,"public/music/tracks.json")));
var results=new List<object>();
foreach(var track in catalog.RootElement.EnumerateArray()) {
 var file=track.GetProperty("file").GetString()!;
 var gain=track.GetProperty("gain").GetDouble();
 var midi=new MidiFile(Path.Combine(root,"public/music",file));synth.Reset();seq.Play(midi,true);
 var buffer=new float[4096];float peak=0,repeatPeak=0;var wraps=0;double previous=0;
 var blocks=(int)Math.Ceiling((midi.Length.TotalSeconds*2+3)*44100*2/buffer.Length);
 for(var j=0;j<blocks;j++) {
  seq.RenderInterleaved(buffer);var position=seq.Position.TotalSeconds;if(position<previous)wraps++;previous=position;
  foreach(var sample in buffer){if(!float.IsFinite(sample))throw new Exception("Nonfinite PCM: "+file);peak=Math.Max(peak,Math.Abs(sample));if(wraps>0)repeatPeak=Math.Max(repeatPeak,Math.Abs(sample));}
 }
 if(peak<.00001||repeatPeak<.00001||wraps<2)throw new Exception("Silent or nonlooping MIDI: "+file);
 if(peak*gain>=1)throw new Exception("Clipping at full volume: "+file);
 results.Add(new{file,duration=midi.Length.TotalSeconds,peak,repeatPeak,gain,normalizedPeak=peak*gain,wraps});seq.Stop();
}
Directory.CreateDirectory(Path.Combine(root,"build"));
File.WriteAllText(Path.Combine(root,"build/windows-midi-pcm.json"),JsonSerializer.Serialize(results,new JsonSerializerOptions{WriteIndented=true}));
Console.WriteLine($"PASS {results.Count} piano tracks: audible PCM, two loop boundaries each, no clipping at full volume.");
