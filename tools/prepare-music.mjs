import {readFile,writeFile,mkdir,unlink,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {root} from './bundle.mjs';
import {readMidi,writeMidi} from './music-midi.mjs';

// Only public-domain Mutopia editions; no third-party performance recordings.
// Mozart's complete source places the theme at beats 368–416 (tracks 17/18).
const selections=[
 {source:'mozart-complete.mid',tracks:[17,18],start:368,end:416,bpm:96},
 {source:'mozart-var5.mid',tracks:[1,2],start:0,end:48,bpm:104},
 {source:'petzold-minuet.mid',tracks:[1],start:0,end:96,bpm:112},
 {source:'bach-prelude.mid',tracks:[1,2],start:0,end:140,bpm:66},
 {source:'brahms/Wiegenlied.mid',tracks:[1,4,5],start:0,end:53.5,bpm:64},
 {source:'tchaikovsky-soldiers.mid',tracks:[1,2],start:0,end:94.5,bpm:126},
 {source:'tchaikovsky-prayer.mid',tracks:[1,2],start:0,end:72,bpm:62},
 {source:'tchaikovsky-french.mid',tracks:[1,2],start:0,end:64.5,bpm:70},
 {source:'beethoven-elise.mid',tracks:[1,2],start:0,end:156.5,bpm:76},
 {source:'joplin-entertainer.mid',tracks:[1,2],start:0,end:303.5,bpm:96},
 {source:'mozart-complete.mid',tracks:[1,2],start:0,end:32,bpm:72},
 {source:'mozart-complete.mid',tracks:[3,4],start:36,end:68,bpm:76},
 {source:'mozart-complete.mid',tracks:[7,8],start:124,end:156,bpm:72},
 {source:'mozart-complete.mid',tracks:[9,10],start:160,end:208,bpm:68},
 {source:'mozart-complete.mid',tracks:[11,12],start:212,end:276,bpm:64},
 {source:'mozart-complete.mid',tracks:[13,14],start:280,end:312,bpm:72},
 {source:'mozart-complete.mid',tracks:[19,20],start:420,end:452,bpm:80},
 {source:'mozart-complete.mid',tracks:[21,22],start:456,end:504,bpm:112},
 {source:'mozart-complete.mid',tracks:[23,24],start:508,end:572,bpm:78},
 {source:'mozart-complete.mid',tracks:[25,26],start:576,end:660,bpm:80}
];
const directory=path.join(root,'public/music'),backup=path.join(root,'local-only/music-backup/original-v1.7.1');
selections.unshift(selections.splice(5,1)[0]); // Start with the playful Wooden Soldiers march.
const levels=JSON.parse(await readFile(path.join(root,'tools/music-sources/levels.json'),'utf8'));
let previous=[];try{previous=JSON.parse(await readFile(path.join(root,'build/music-preparation.json'),'utf8'));}catch{}
const generated=[];
for(const [index,selection] of selections.entries()){
 const source=await readFile(path.join(root,'tools/music-sources',selection.source));
 const midi=readMidi(source),start=Math.round(selection.start*midi.division),end=Math.round(selection.end*midi.division);
 const finish=end-start+midi.division; // A short, musical breath before each repeat.
 const tempo=Buffer.alloc(3);tempo.writeUIntBE(Math.round(60000000/selection.bpm),0,3);
 const events=[{tick:0,status:255,type:81,data:tempo}];
 const channels=new Set();
 for(const trackIndex of selection.tracks)for(const event of midi.tracks[trackIndex]){
  const kind=event.status&240;
  if(![128,144].includes(kind)||event.tick<start||event.tick>end)continue;
  const channel=event.status&15;if(channel===9)throw Error('Percussion is not part of this piano collection');channels.add(channel);
  const data=Buffer.from(event.data);
  if(kind===144&&data[1]>0)data[1]=Math.min(80,Math.max(42,Math.round(data[1]*.78)));
  events.push({...event,tick:event.tick-start,data});
 }
 for(const channel of channels){
  events.unshift({tick:0,status:192|channel,data:Buffer.from([0])});
  events.push({tick:end-start,status:176|channel,data:Buffer.from([64,0])});
  events.push({tick:end-start,status:176|channel,data:Buffer.from([123,0])});
 }
 events.sort((a,b)=>a.tick-b.tick);
 events.push({tick:finish,status:255,type:47,data:Buffer.alloc(0)});
 const gain=levels.tracks.find(track=>track.source===selection.source&&track.start===selection.start&&track.end===selection.end)?.gain;
 if(!Number.isFinite(gain)||gain<.1||gain>16)throw Error('Missing music level calibration');
 generated.push({file:`back${index}.mid`,label:`音乐${index+1}`,gain,bytes:writeMidi({division:midi.division,tracks:[events]})});
}
await mkdir(directory,{recursive:true});
// Never replace an old collection before verifying a byte-identical local backup.
for(const file of (await readdir(directory)).filter(name=>/^back\d+\.mid$/.test(name))){
 const current=await readFile(path.join(directory,file));
 if(generated.some(track=>track.file===file&&track.bytes.equals(current)))continue;
 if(previous.some(track=>track.file===file&&track.sha256===createHash('sha256').update(current).digest('hex')))continue;
 const saved=await readFile(path.join(backup,file));
 if(!current.equals(saved))throw Error(`Unbacked music file: ${file}`);
}
for(const track of generated)await writeFile(path.join(directory,track.file),track.bytes);
for(const file of (await readdir(directory)).filter(name=>/^back\d+\.mid$/.test(name)&&!generated.some(track=>track.file===name)))await unlink(path.join(directory,file));
await writeFile(path.join(directory,'tracks.json'),JSON.stringify(generated.map(({file,label,gain})=>({file,label,gain})),null,2)+'\n');
await mkdir(path.join(root,'build'),{recursive:true});
await writeFile(path.join(root,'build/music-preparation.json'),JSON.stringify(generated.map((track,i)=>({file:track.file,...selections[i],sha256:createHash('sha256').update(track.bytes).digest('hex')})),null,2)+'\n');
console.log(`Prepared ${generated.length} instrumental piano tracks.`);
