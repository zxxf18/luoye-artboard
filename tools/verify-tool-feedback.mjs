import {createRequire} from 'node:module';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root} from './bundle.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.LUOYE_PLAYWRIGHT||'playwright');
const output=path.resolve(root,process.env.LUOYE_FEEDBACK_EVIDENCE||'build/feedback-acceptance');
const profile=path.join(output,'profile'),url=process.env.LUOYE_TEST_URL||'http://127.0.0.1:4187';
await mkdir(output,{recursive:true});await rm(profile,{recursive:true,force:true});
const checks=[],errors=[];let context;
const record=(name,detail)=>{checks.push({name,passed:true,detail});console.log('PASS '+name);};
async function launch(native=true){
 context=await chromium.launchPersistentContext(profile,{headless:true,channel:'chrome',viewport:{width:1440,height:900}});
 await context.addInitScript(({native})=>{
  window.feedbackOscillators=0;
  const create=AudioContext.prototype.createOscillator;
  AudioContext.prototype.createOscillator=function(){window.feedbackOscillators++;return create.call(this);};
  if(!native)return;
  // Test-only desktop transport. Real MIDI playback is checked by the native harness.
  window.musicRequests=[];const state={name:'尚未选择音乐',position:0,duration:60,volume:.35,playing:false};
  window.webkit={messageHandlers:{music:{postMessage(message){
   window.musicRequests.push(message);const {action,index,volume,autoplay}=message;
   if(action==='volume')state.volume=volume;
   if(action==='track'){state.name='音乐'+(index+1);state.playing=autoplay!==false;}
   if(action==='play')state.playing=true;if(action==='stop')state.playing=false;
   queueMicrotask(()=>window.dispatchEvent(new CustomEvent('native-music-result',{detail:{id:message.id,state:{...state}}})));
  }}}};
 },{native});
 const page=context.pages()[0];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 await page.waitForSelector('body[data-app-ready=true]');if(native)await page.evaluate(()=>window.LUOYEMusicState());return page;
}
async function tool(page,id){if(!await page.locator(`#tools [data-tool="${id}"]`).count())await page.locator('#tool-page').click();await page.locator(`#tools [data-tool="${id}"]`).click();}
const idle=page=>page.waitForFunction(()=>!document.body.hasAttribute('aria-busy'));
try{
 let page=await launch();
 const entries=await page.evaluate(async()=>{const {TOOL_FEEDBACK}=await import('/src/tool-feedback.js');return TOOL_FEEDBACK;});
 // Every visible tool and subtype drives the same cursor and sound identity.
 for(const entry of entries){
  await tool(page,entry.tool==='geometry'?'line':entry.tool);
  if(entry.tool==='pen')await page.locator(`.brush-box [data-brush="${entry.value}"]`).click();
  else if(entry.tool==='stamp')await page.locator(`#library-groups [data-fairy-mode="${entry.value}"]`).click();
  else if(entry.control){
   const value=entry.value.replace(/^(ellipse|rect)-gradient$/,'$1');
   const label=await page.locator('#'+entry.control).evaluate((el,value)=>[...el.options].find(o=>o.value===value).textContent,value);
   await page.locator('.subtool-box button').filter({hasText:new RegExp('^'+label+'$')}).click();
   if(entry.tool==='fill'&&['rect','ellipse'].includes(value))await page.locator('#fill-gradient').setChecked(entry.value.endsWith('-gradient'));
  }
  assert.equal(await page.locator('#painting').getAttribute('data-cursor'),entry.key);
  assert.match(await page.locator('#painting').evaluate(e=>getComputedStyle(e).cursor),/^url\("data:image\/svg\+xml,/);
 }
 record('all '+entries.length+' brush/tool variants use illustrated cursors');
 await tool(page,'pen');await page.locator('.brush-box [data-brush="crayon"]').click();
 const once=await page.evaluate(()=>window.feedbackOscillators);
 await page.locator('.brush-box [data-brush="crayon"]').click();assert.equal(await page.evaluate(()=>window.feedbackOscillators),once);
 await page.locator('.brush-box [data-brush="pencil"]').click();assert.equal(await page.evaluate(()=>window.feedbackOscillators),once+2);
 record('one sound per changed brush; reselecting the same brush stays quiet');
 await page.locator('#music-open').click();assert.equal(await page.locator('#ui-sounds').isChecked(),true);
 await page.locator('#ui-sounds').uncheck();await page.locator('#music-close').click();
 const muted=await page.evaluate(()=>window.feedbackOscillators);await tool(page,'eraser');await tool(page,'fill');assert.equal(await page.evaluate(()=>window.feedbackOscillators),muted);
 record('music switch mutes all brush/tool feedback');
 // Decode and rasterize the actual cursor SVGs, and render the actual sound graph.
 const rendered=await page.evaluate(async()=>{
  const {TOOL_FEEDBACK,toolCursorSVG,scheduleToolSound}=await import('/src/tool-feedback.js');const result=[];
  const hash=async data=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(x=>x.toString(16).padStart(2,'0')).join('');
  for(const entry of TOOL_FEEDBACK){
   const svg=toolCursorSVG(entry),image=new Image();image.src='data:image/svg+xml,'+encodeURIComponent(svg);await image.decode();
   const c=document.createElement('canvas');c.width=c.height=40;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const rgba=ctx.getImageData(0,0,40,40).data;
   const audio=new OfflineAudioContext(1,Math.ceil(44100*.4),44100);scheduleToolSound(audio,entry.sound);const pcm=(await audio.startRendering()).getChannelData(0);
   result.push({key:entry.key,label:entry.label,svg,png:c.toDataURL(),imageHash:await hash(rgba),soundHash:await hash(pcm),peak:Math.max(...pcm.map(Math.abs)),samples:Array.from(pcm)});
  }return result;
 });
 assert.equal(new Set(rendered.map(r=>r.imageHash)).size,entries.length);assert.equal(new Set(rendered.map(r=>r.soundHash)).size,entries.length);assert(rendered.every(r=>r.peak>.005&&r.peak<.1));
 record('54 actual rasterized icons and PCM sounds are distinct; sound peaks are bounded');
 const sample=rendered.slice(0,20).flatMap(r=>[...r.samples,...Array(4410).fill(0)]),wav=Buffer.alloc(44+sample.length*2);
 wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(44100,24);wav.writeUInt32LE(88200,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(sample.length*2,40);sample.forEach((v,i)=>wav.writeInt16LE(Math.round(v*32767),44+i*2));await writeFile(path.join(output,'tool-sounds.wav'),wav);
 const gallery=await context.newPage();await gallery.setContent('<html><head><meta charset="utf-8"><style>body{font:15px system-ui;background:#fff6e2;color:#705142;padding:24px}main{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}article{background:#fffdf6;border:1px solid #dec6a1;border-radius:12px;padding:12px;text-align:center}img{width:40px;height:40px}p{margin:4px}</style></head><body><h1>画笔与工具光标 · 40 px 实际尺寸</h1><main>'+rendered.map(r=>`<article><img src="${r.png}"><p>${r.label}</p></article>`).join('')+'</main></body></html>');await gallery.screenshot({path:path.join(output,'cursor-gallery.png'),fullPage:true});await gallery.close();
 await page.locator('#music-open').click();await page.locator('#music-track-choose').click();await page.locator('#choice-grid [data-value="16"]').click();await idle(page);
 await page.locator('#music-volume').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await idle(page);
 await page.locator('#music-stop').click();await idle(page);
 const before=await page.evaluate(()=>({music:JSON.parse(localStorage.getItem('luoye-music-settings')),sounds:localStorage.getItem('luoye-ui-sounds')}));assert.deepEqual(before,{music:{index:16,volume:.02,playing:false},sounds:'off'});
 await context.close();page=await launch();
 assert.equal(await page.locator('#music-track').inputValue(),'16');assert.equal(await page.locator('#music-volume').inputValue(),'2');assert.equal(await page.locator('#ui-sounds').isChecked(),false);
 const restored=await page.evaluate(()=>({state:document.getElementById('music-state').textContent,requests:window.musicRequests}));assert(restored.state.includes('已停止'));assert.deepEqual(restored.requests.find(r=>r.action==='track').autoplay,false);
 record('full browser restart restores music 17, volume 2%, stopped state and muted effects');
 await page.locator('#music-open').click();await page.locator('#ui-sounds').check();await page.locator('#music-play').click();await idle(page);
 await page.screenshot({path:path.join(output,'music-preferences.png')});
 await page.setViewportSize({width:900,height:650});await page.locator('#ui-sounds').focus();await page.keyboard.press('Space');assert.equal(await page.locator('#ui-sounds').isChecked(),false);await page.keyboard.press('Space');assert.equal(await page.locator('#ui-sounds').isChecked(),true);await page.locator('#music-close').scrollIntoViewIfNeeded();
 const bounds=await page.locator('#music-dialog').boundingBox();assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=900&&bounds.y+bounds.height<=650);await page.screenshot({path:path.join(output,'music-compact.png')});record('900x650 music dialog fits; sound toggle works with keyboard');await page.locator('#music-close').click();
 await context.close();page=await launch();assert(await page.locator('#ui-sounds').isChecked());assert((await page.evaluate(()=>window.LUOYEMusicState())).playing);record('enabled effects and playing state also survive restart');
 await context.close();page=await launch(false);await page.locator('#music-open').click();assert(await page.locator('#ui-sounds').isEnabled());await page.locator('#ui-sounds').uncheck();record('sound toggle works even without desktop MIDI bridge');
 assert.deepEqual(errors,[]);record('no uncaught browser errors');
 await writeFile(path.join(output,'browser-report.json'),JSON.stringify({checks,errors,renders:rendered.map(({samples,svg,png,...r})=>r)},null,2)+'\n');
}catch(error){await context?.pages()[0]?.screenshot({path:path.join(output,'failure.png')});throw error;}finally{await context?.close();await rm(profile,{recursive:true,force:true});}
