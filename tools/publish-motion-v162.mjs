import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fairyMotionSVG} from './fairy-motion-v162.mjs';
import {characterSpecs,characterSVG} from './character-motion-v162.mjs';
import {root} from './bundle.mjs';
const require=createRequire(import.meta.url);
const sharp=require(process.env.LUOYE_SHARP||'sharp');
const base=path.join(root,'public/assets/motion-v162');
for(const dir of ['vectors','sprites','thumbs'])await mkdir(path.join(base,dir),{recursive:true});
const catalog=JSON.parse(await readFile(path.join(root,'public/assets/catalog.json'),'utf8'));
const profiles=['grow-bloom','grow','rise','bubbles','grow-bloom','grow-bloom','grow-bloom','grow','grow','seed-head','crawl','wing-flap','grow-bloom','spin','tail-swim','current','branch-grow','bubbles','mushroom-grow','rotor','fall','flutter'];
const records=[];
for(const item of catalog.filter(a=>a.fairyMode==='dynamic')){
 const kind=Number(item.id.split('-')[2]);
 for(const [g,group] of item.fairyGroups.entries()){
  const frames=[];
  for(let f=0;f<8;f++){
   const name=item.id+'-g'+g+'-f'+f,svg=fairyMotionSVG(kind,g,f,8,2048);
   await writeFile(path.join(base,'vectors',name+'.svg'),svg);
   await sharp(Buffer.from(svg)).resize(480,480).webp({quality:95}).toFile(path.join(base,'sprites',name+'.webp'));
   frames.push('assets/motion-v162/sprites/'+name+'.webp');
  }
  Object.assign(group,{frames,width:480,height:480});
 }
 Object.assign(item,{src:item.fairyGroups[0].frames[7],width:480,height:480,motionProfile:profiles[kind],artNote:'逐部件矢量重绘动作；固定画幅，保留原分组与帧间隔。'});
 item.thumbnail='assets/motion-v162/thumbs/'+item.id+'.webp';
 await sharp(path.join(root,'public',item.src)).resize(288,288).webp({quality:95}).toFile(path.join(root,'public',item.thumbnail));
 records.push({id:item.id,profile:profiles[kind],groups:item.fairyGroups.length});
}
// The installed desk lamp is animation-4-2 (previously labelled "other animation").
const lamp=catalog.find(a=>a.id==='animation-4-2');lamp.frames=[];
for(let f=0;f<8;f++){
 const brightness=f/7,svg='<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 512 512"><defs><radialGradient id="light"><stop stop-color="#fff5a8" stop-opacity="'+brightness+'"/><stop offset="1" stop-color="#ffd064" stop-opacity="0"/></radialGradient></defs><ellipse cx="278" cy="361" rx="192" ry="110" fill="url(#light)"/><g stroke="#727a5e" stroke-width="8" stroke-linejoin="round"><path d="M248 425L207 284 281 178" fill="none"/><ellipse cx="259" cy="439" rx="90" ry="20" fill="#a8bb8b"/><path d="M207 143Q247 93 304 138L345 230 169 230Z" fill="#bdd390"/><ellipse cx="258" cy="230" rx="88" ry="18" fill="'+(f<2?'#8e9980':'#fff2ac')+'"/></g><ellipse cx="259" cy="235" rx="37" ry="10" fill="#fff5b5" opacity="'+brightness+'"/></svg>';
 const name='lamp-f'+f;await writeFile(path.join(base,'vectors',name+'.svg'),svg);await sharp(Buffer.from(svg)).resize(640,640).webp({quality:95}).toFile(path.join(base,'sprites',name+'.webp'));
 lamp.frames.push('assets/motion-v162/sprites/'+name+'.webp');
}
Object.assign(lamp,{name:'渐渐亮起的台灯',src:lamp.frames[7],width:640,height:640,motionProfile:'lamp-light',thumbnail:'assets/motion-v162/thumbs/lamp.webp'});
await sharp(path.join(root,'public',lamp.src)).resize(288,288).webp({quality:95}).toFile(path.join(root,'public',lamp.thumbnail));
for(const spec of characterSpecs.filter(s=>s[2]!=='lamp')){
 const item=catalog.find(a=>a.id===spec[0]),frames=[];
 for(let f=0;f<8;f++){
  const name=item.id+'-f'+f,svg=characterSVG(spec,f);
  await writeFile(path.join(base,'vectors',name+'.svg'),svg);
  await sharp(Buffer.from(svg)).resize(640,640).webp({quality:95}).toFile(path.join(base,'sprites',name+'.webp'));
  frames.push('assets/motion-v162/sprites/'+name+'.webp');
 }
 Object.assign(item,{name:spec[1],src:frames[0],frames,width:640,height:640,motionProfile:spec[3],thumbnail:'assets/motion-v162/thumbs/'+item.id+'.webp'});
 await sharp(path.join(root,'public',item.src)).resize(288,288).webp({quality:95}).toFile(path.join(root,'public',item.thumbnail));
}
for(const item of catalog.filter(a=>a.fairyMode==='dynamic'||a.category==='animation')){
 item.masterSource=item.id===lamp.id?'assets/motion-v162/vectors/lamp-f7.svg':'assets/motion-v162/vectors/'+item.id+(item.fairyMode==='dynamic'?'-g0-f7':'-f0')+'.svg';
 item.artNote='独立矢量部件绘制；无原版位图取样，动作按物品结构制作。';
}
await writeFile(path.join(root,'public/assets/catalog.json'),JSON.stringify(catalog,null,2)+'\n');
await writeFile(path.join(root,'public/assets/catalog.js'),'window.JSHW_ASSETS = '+JSON.stringify(catalog)+';\n');
await mkdir(path.join(root,'design/versions/v1.6.2/evidence'),{recursive:true});
await writeFile(path.join(root,'design/versions/v1.6.2/evidence/motion.json'),JSON.stringify({records,characters:characterSpecs,method:'independent vector parts; no bitmap sheet slicing'},null,2)+'\n');
console.log('Published '+records.length+' magic packs and '+characterSpecs.length+' animated companions.');
