import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {root} from './bundle.mjs';
const sharp=createRequire(import.meta.url)(process.env.LUOYE_SHARP||'sharp');
const plan=JSON.parse(await readFile(path.join(root,'design/versions/v1.7.0/background-production-plan.json'),'utf8'));
const source=path.join(root,'local-only/background-production-v170');
const out=path.join(root,'public/assets/backgrounds-v170');
// Fail before touching the published catalogue if any production image is missing.
if(plan.length!==360||new Set(plan.map(p=>p.id)).size!==360||new Set(plan.map(p=>p.scene)).size!==360)throw Error('Expected 360 unique backgrounds and scenes');
await Promise.all(plan.map(p=>access(path.join(source,p.id+'.png'))));
for(const dir of ['sprites','thumbs'])await mkdir(path.join(out,dir),{recursive:true});
const additions=[];
for(const p of plan){
 const file=path.join(source,p.id+'.png'),meta=await sharp(file).metadata();
 if(meta.width<1600||Math.abs(meta.width/meta.height-16/9)>.02)throw Error('Invalid dimensions: '+p.id);
 await sharp(file).webp({quality:92}).toFile(path.join(out,'sprites',p.id+'.webp'));
 await sharp(file).resize(432).webp({quality:84}).toFile(path.join(out,'thumbs',p.id+'.webp'));
 additions.push({id:'bg170-'+p.id,name:p.name,category:'background',collection:'bg-'+p.theme,style:p.style,styleName:p.styleName,theme:p.theme,quality:'original-background-v170',src:'assets/backgrounds-v170/sprites/'+p.id+'.webp',thumbnail:'assets/backgrounds-v170/thumbs/'+p.id+'.webp',width:meta.width,height:meta.height,artNote:'独立生成的新构图；原生尺寸保存，未使用原版图片像素。'});
}
const coloring=JSON.parse(await readFile(path.join(root,'design/versions/v1.7.0/samples-simple/prompts.json'),'utf8')).filter(p=>p.id.endsWith('-coloring'));
for(const p of coloring){
 const file=path.join(root,'design/versions/v1.7.0/samples-simple',p.id+'.png'),meta=await sharp(file).metadata();
 await sharp(file).webp({lossless:true}).toFile(path.join(out,'sprites',p.id+'.webp'));
 await sharp(file).resize(432).webp({quality:90}).toFile(path.join(out,'thumbs',p.id+'.webp'));
 additions.push({id:'bg170-'+p.id,name:p.name,category:'background',collection:'simple-coloring',coloring:true,quality:'original-background-v170',src:'assets/backgrounds-v170/sprites/'+p.id+'.webp',thumbnail:'assets/backgrounds-v170/thumbs/'+p.id+'.webp',width:meta.width,height:meta.height});
}
const old=JSON.parse(await readFile(path.join(root,'public/assets/catalog.json'),'utf8')).filter(p=>!p.id.startsWith('bg170-'));
const boat=old.find(p=>p.id==='legacy-sailboat-variant');if(boat){boat.name='帆船';boat.collection='role6';}
const catalog=[...additions,...old];
await writeFile(path.join(root,'public/assets/catalog.json'),JSON.stringify(catalog,null,2)+'\n');
await writeFile(path.join(root,'public/assets/catalog.js'),'window.LUOYE_ASSETS = '+JSON.stringify(catalog)+';\n');
console.log('Published',additions.length,'independent backgrounds');
