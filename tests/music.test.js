import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {readMidi,writeMidi} from '../tools/music-midi.mjs';
const directory=new URL('../public/music/',import.meta.url);
test('all twenty music tracks are instrumental and end without held notes',async()=>{
 const catalog=JSON.parse(await readFile(new URL('tracks.json',directory),'utf8'));
 assert.equal(catalog.length,20);
 assert.deepEqual((await readdir(directory)).filter(file=>file.endsWith('.mid')).sort(),catalog.map(track=>track.file).sort());
 for(const [index,track] of catalog.entries()){
  assert.equal(track.label,`音乐${index+1}`);
  assert(Number.isFinite(track.gain)&&track.gain>=.1&&track.gain<=16);
  const bytes=await readFile(new URL(track.file,directory)),midi=readMidi(bytes);assert.deepEqual(writeMidi(midi),bytes);
  let noteCount=0,tempo=500000,previous=0,seconds=0;const active=new Map();
  for(const event of midi.tracks.flat().sort((a,b)=>a.tick-b.tick)){
   seconds+=(event.tick-previous)*tempo/(midi.division*1e6);previous=event.tick;
   if(event.status===255){assert.notEqual(event.type,5,'No lyrics');if(event.type===81)tempo=event.data.readUIntBE(0,3);continue;}
   assert.notEqual(event.status&15,9,'No percussion channel');
   const kind=event.status&240,key=(event.status&15)+':'+event.data[0];
   if(kind===192)assert.equal(event.data[0],0,'Piano only');
   if(kind===144&&event.data[1]){noteCount++;active.set(key,(active.get(key)||0)+1);}
   if(kind===128||(kind===144&&!event.data[1])){assert((active.get(key)||0)>0,'No orphan note-off');active.set(key,active.get(key)-1);}
  }
  assert(noteCount>40);assert(seconds>20&&seconds<240);assert([...active.values()].every(count=>count===0),'No held notes at the loop boundary');
 }
});
