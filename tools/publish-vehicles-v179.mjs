import { readFile, access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { root } from './bundle.mjs';
const sharp=createRequire(import.meta.url)(process.env.LUOYE_SHARP||'/Users/zhaoxin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const plan=JSON.parse(await readFile(path.join(root,'tools/art/vehicles-v179.json'),'utf8'));
const source=path.join(root,'local-only/vehicles-v179/masters'),out=path.join(root,'public/assets/vehicles-v179');
await Promise.all(plan.map(p=>access(path.join(source,p.id+'.png'))));
await Promise.all(['sprites','thumbs'].map(d=>mkdir(path.join(out,d),{recursive:true})));
const additions=[];
for(const p of plan){
 const input=path.join(source,p.id+'.png'),meta=await sharp(input).metadata();
 if(!meta.hasAlpha)throw Error('Vehicle lacks alpha '+p.id);
 const base=p.id;
 await sharp(input).webp({quality:95,alphaQuality:100}).toFile(path.join(out,'sprites',base+'.webp'));
 await sharp(input).resize(240).webp({quality:90,alphaQuality:100}).toFile(path.join(out,'thumbs',base+'.webp'));
 additions.push({id:base,name:p.name,category:'sticker',collection:'vehicles',kind:p.kind,quality:'original-imagegen-v179',src:`assets/vehicles-v179/sprites/${base}.webp`,thumbnail:`assets/vehicles-v179/thumbs/${base}.webp`,width:meta.width,height:meta.height,alphaRequired:true,artDirection:'独立生成的高质量水粉水彩绘本交通工具；透明背景、完整车身、无品牌标志和文字。'});
}
const catalog=JSON.parse(await readFile(path.join(root,'public/assets/catalog.json'),'utf8'));
const old=catalog.filter(x=>!additions.some(a=>a.id===x.id));
const next=[...additions,...old];
await writeFile(path.join(root,'public/assets/catalog.json'),JSON.stringify(next,null,2)+'\n');
await writeFile(path.join(root,'public/assets/catalog.js'),'window.LUOYE_ASSETS = '+JSON.stringify(next)+';\n');
console.log(`Published ${additions.length} traffic vehicles; catalog ${next.length}`);
