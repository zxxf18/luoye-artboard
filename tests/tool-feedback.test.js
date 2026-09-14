import test from 'node:test';
import assert from 'node:assert/strict';
import { createAudioPreferences } from '../src/audio-preferences.js';
import { TOOL_FEEDBACK, getToolFeedback, createToolSoundPlayer } from '../src/tool-feedback.js';
import { BRUSHES } from '../src/brushes.js';
const storage=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};};

test('audio preferences remember music and legacy sound mute, including zero volume and stopped playback',()=>{
  const disk=storage(),first=createAudioPreferences(20,disk);
  assert.equal(first.sounds,true);assert.deepEqual(first.music,{index:0,volume:.35,playing:true});
  first.setSounds(false);first.saveMusic({index:16,volume:0,playing:false});
  const reopened=createAudioPreferences(20,disk);
  assert.equal(reopened.sounds,false);assert.deepEqual(reopened.music,{index:16,volume:0,playing:false});
  reopened.setSounds(true);assert.equal(createAudioPreferences(20,disk).sounds,true);
});
test('invalid or unavailable preference storage has safe defaults and remains usable for this session',()=>{
  const disk=storage();disk.setItem('luoye-music-settings',JSON.stringify({index:99,volume:'loud',playing:'yes'}));
  assert.deepEqual(createAudioPreferences(20,disk).music,{index:0,volume:.35,playing:true});
  const broken={getItem(){throw Error('denied');},setItem(){throw Error('full');}},prefs=createAudioPreferences(20,broken);
  prefs.setSounds(false);prefs.saveMusic({index:2});assert.equal(prefs.sounds,false);assert.equal(prefs.music.index,2);
});
test('every brush and tool variant has a distinct short sound and stable identity',()=>{
  assert.equal(new Set(TOOL_FEEDBACK.map(x=>x.key)).size,TOOL_FEEDBACK.length);
  assert.equal(new Set(TOOL_FEEDBACK.map(x=>JSON.stringify(x.sound))).size,TOOL_FEEDBACK.length);
  for(const brush of BRUSHES)assert.equal(getToolFeedback({tool:'pen',pen:brush.id}).key,'pen:'+brush.id);
  for(const entry of TOOL_FEEDBACK){assert(entry.sound.duration<=.3);assert(entry.sound.frequencies.every(n=>n>=100&&n<2000));}
  assert.equal(getToolFeedback({tool:'eraser',eraser:'soft'}).key,'eraser:soft');
  assert.equal(getToolFeedback({tool:'fill',fill:'ellipse',gradient:true}).key,'fill:ellipse-gradient');
  assert.equal(getToolFeedback({tool:'bezier'}).key,'geometry:bezier');
});
test('muting a suspended audio context cancels pending feedback without a delayed sound',async()=>{
  const prefs=createAudioPreferences(20,storage());let created=0,scheduled=0,resume;
  const player=createToolSoundPlayer(prefs,()=>{created++;return {state:'suspended',resume:()=>new Promise(r=>{resume=r;}),createOscillator(){scheduled++;}};});
  prefs.setSounds(false);await player.play(TOOL_FEEDBACK[0]);assert.equal(created,0);
  prefs.setSounds(true);const pending=player.play(TOOL_FEEDBACK[1]);prefs.setSounds(false);player.silence();resume();await pending;
  assert.equal(created,1);assert.equal(scheduled,0);
});
