import { readFile, access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { root } from './bundle.mjs';
const sharp=createRequire(import.meta.url)(process.env.LUOYE_SHARP||'/Users/zhaoxin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const plan=JSON.parse(await readFile(path.join(root,'tools/art/everyday-v180.json'),'utf8'));
const source=path.join(root,'local-only/everyday-v180/masters'),out=path.join(root,'public/assets/everyday-v180');
if(new Set(plan.map(p=>p.id)).size!==plan.length)throw Error('Duplicate everyday asset id');
await Promise.all(plan.map(p=>access(path.join(source,p.id+'.png'))));
await Promise.all(['sprites','thumbs'].map(d=>mkdir(path.join(out,d),{recursive:true})));
const additions=[];
for(const p of plan){
 const input=path.join(source,p.id+'.png'),meta=await sharp(input).metadata();
 if(!meta.hasAlpha)throw Error('Everyday asset lacks alpha '+p.id);
 if(meta.width>1600||meta.height>1600)throw Error('Everyday master is too large '+p.id);
 const base=p.id;
 await sharp(input).resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).webp({quality:92,alphaQuality:100}).toFile(path.join(out,'sprites',base+'.webp'));
 await sharp(input).resize(240).webp({quality:88,alphaQuality:100}).toFile(path.join(out,'thumbs',base+'.webp'));
 additions.push({id:base,name:p.name,category:'sticker',collection:p.collection,kind:p.subject,style:p.style,styleName:p.styleName,quality:'original-imagegen-v180',src:`assets/everyday-v180/sprites/${base}.webp`,thumbnail:`assets/everyday-v180/thumbs/${base}.webp`,width:meta.width,height:meta.height,alphaRequired:true,artDirection:'独立生成的高质量儿童绘画素材；透明背景、完整主体、可直接贴到画板，不含文字和水印。'});
}
const catalog=JSON.parse(await readFile(path.join(root,'public/assets/catalog.json'),'utf8'));
const old=catalog.filter(x=>!additions.some(a=>a.id===x.id));
const next=[...additions,...old];
await writeFile(path.join(root,'public/assets/catalog.json'),JSON.stringify(next,null,2)+'\n');
await writeFile(path.join(root,'public/assets/catalog.js'),'window.LUOYE_ASSETS = '+JSON.stringify(next)+';\n');
console.log(`Published ${additions.length} everyday illustration assets; catalog ${next.length}`);
