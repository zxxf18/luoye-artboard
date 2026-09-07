import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const sharp=createRequire(import.meta.url)(process.env.LUOYE_SHARP||'sharp');
const assets=JSON.parse(await fs.readFile('public/assets/catalog.json','utf8'));
const animated=assets.filter(a=>a.fairyMode==='dynamic'||a.category==='animation');
const checks=[],tiles=[];
for(const [i,a] of animated.entries()){
 for(const group of a.fairyGroups||[{frames:a.frames}]){
  const hashes=await Promise.all(group.frames.map(async f=>createHash('sha256').update(await fs.readFile('public/'+f)).digest('hex')));
  checks.push({id:a.id,distinctFrames:new Set(hashes).size,passed:new Set(hashes).size>1});
 }
 const picture=await sharp('public/'+a.src).resize(128,128,{fit:'contain',background:'#fff8e8'}).flatten({background:'#fff8e8'}).png().toBuffer();
 tiles.push({input:picture,left:(i%9)*140,top:Math.floor(i/9)*155});
 const label=Buffer.from('<svg width="140" height="25"><text x="3" y="17" font-size="11">'+a.id+'</text></svg>');
 tiles.push({input:label,left:i%9*140,top:Math.floor(i/9)*155+128});
}
const output='design/versions/v1.6.2/evidence/';
await sharp({create:{width:1260,height:Math.ceil(animated.length/9)*155,channels:3,background:'#fff8e8'}}).composite(tiles).png().toFile(output+'motion-contact.png');
await fs.writeFile(output+'motion-frame-audit.json',JSON.stringify({passed:checks.every(c=>c.passed),checks},null,2));
console.log(checks.filter(c=>!c.passed));
