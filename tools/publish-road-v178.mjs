import { readFile, access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { root } from './bundle.mjs';
const sharp=createRequire(import.meta.url)(process.env.LUOYE_SHARP||'/Users/zhaoxin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const plan=JSON.parse(await readFile(path.join(root,'tools/art/traffic-v178.json'),'utf8'));
const source=path.join(root,'local-only/traffic-v178/masters'),out=path.join(root,'public/assets/road-v178');
await Promise.all(plan.map(p=>access(path.join(source,p.id+'.png'))));
await Promise.all(['sprites','thumbs'].map(d=>mkdir(path.join(out,d),{recursive:true})));
const additions=[];
for(const p of plan){
 const input=path.join(source,p.id+'.png'),meta=await sharp(input).metadata();
 if(p.category==='background'){
  if(meta.width<1600||Math.abs(meta.width/meta.height-16/9)>.03)throw Error('Invalid background '+p.id);
 }else if(!meta.hasAlpha)throw Error('Traffic sign lacks alpha '+p.id);
 const base=p.category==='background'?'bg178-'+p.id:'road-sign-v178-'+p.id;
 await sharp(input).webp({quality:p.category==='background'?92:94,alphaQuality:100}).toFile(path.join(out,'sprites',base+'.webp'));
 await sharp(input).resize(p.category==='background'?432:240).webp({quality:88,alphaQuality:100}).toFile(path.join(out,'thumbs',base+'.webp'));
 additions.push({id:base,name:p.name,category:p.category,collection:p.category==='background'?'bg-road':'road-signs',theme:p.theme,themeName:p.themeName,style:p.style,styleName:p.styleName,quality:p.category==='background'?'original-background-v178':'preschool-road-sign-v178',src:`assets/road-v178/sprites/${base}.webp`,thumbnail:`assets/road-v178/thumbs/${base}.webp`,width:meta.width,height:meta.height,alphaRequired:p.category==='sticker',artDirection:p.category==='background'?'六种独立画法；开阔中景和安静留白，参考既有儿童绘本背景密度。':'独立生成的水粉水彩绘本交通标志；透明背景、完整支架、符号清晰。'});
}
const catalog=JSON.parse(await readFile(path.join(root,'public/assets/catalog.json'),'utf8'));
const old=catalog.filter(x=>!additions.some(a=>a.id===x.id));
const next=[...additions,...old];
await writeFile(path.join(root,'public/assets/catalog.json'),JSON.stringify(next,null,2)+'\n');
await writeFile(path.join(root,'public/assets/catalog.js'),'window.LUOYE_ASSETS = '+JSON.stringify(next)+';\n');
console.log(`Published ${additions.filter(x=>x.category==='background').length} backgrounds and ${additions.filter(x=>x.category==='sticker').length} traffic signs`);
