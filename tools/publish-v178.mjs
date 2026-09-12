import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { root } from './bundle.mjs';
const sharp=createRequire(import.meta.url)(process.env.LUOYE_SHARP||'/Users/zhaoxin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const plan=JSON.parse(await readFile(path.join(root,'tools/art/places-v178.json'),'utf8'));
const source=path.join(root,'local-only/places-v178/masters'),out=path.join(root,'public/assets/places-v178');
if(plan.length!==75||new Set(plan.map(p=>p.id)).size!==75)throw Error('Expected 75 unique themed backgrounds');
await Promise.all(plan.map(p=>access(path.join(source,p.id+'.png'))));
await mkdir(path.join(out,'sprites'),{recursive:true});await mkdir(path.join(out,'thumbs'),{recursive:true});
const additions=[];
for(const p of plan){const input=path.join(source,p.id+'.png'),meta=await sharp(input).metadata();if(meta.width<1600||Math.abs(meta.width/meta.height-16/9)>.03)throw Error('Invalid image '+p.id+' '+meta.width+'x'+meta.height);const base='bg178-'+p.id;await sharp(input).webp({quality:92}).toFile(path.join(out,'sprites',base+'.webp'));await sharp(input).resize(432).webp({quality:86}).toFile(path.join(out,'thumbs',base+'.webp'));additions.push({id:base,name:p.name,category:'background',collection:'bg-'+p.theme,theme:p.theme,themeName:p.themeName,style:p.style,styleName:p.styleName,quality:'original-background-v178',src:`assets/places-v178/sprites/${base}.webp`,thumbnail:`assets/places-v178/thumbs/${base}.webp`,width:meta.width,height:meta.height,artDirection:p.styleName+'；独立场景、儿童绘本质感、留白可绘画。'});}
const catalog=JSON.parse(await readFile(path.join(root,'public/assets/catalog.json'),'utf8'));const old=catalog.filter(x=>!/^bg178-(mall|outdoor-play|indoor-play|sports-pool|school)-/.test(x.id));const next=[...additions,...old];await writeFile(path.join(root,'public/assets/catalog.json'),JSON.stringify(next,null,2)+'\n');await writeFile(path.join(root,'public/assets/catalog.js'),'window.LUOYE_ASSETS = '+JSON.stringify(next)+';\n');console.log(`Published ${additions.length} themed backgrounds`);
