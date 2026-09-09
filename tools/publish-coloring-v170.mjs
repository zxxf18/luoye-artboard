import {readFile,writeFile,mkdir,rm,readdir} from 'node:fs/promises';
import path from 'node:path';import {createRequire} from 'node:module';import {root} from './bundle.mjs';
const sharp=createRequire(import.meta.url)(process.env.LUOYE_SHARP||'sharp');
const source=path.join(root,'local-only/coloring-production-v170');const out=path.join(root,'public/assets/backgrounds-v170');
const catalog=JSON.parse(await readFile(path.join(root,'public/assets/catalog.json'),'utf8'));
const plan=JSON.parse(await readFile(path.join(root,'design/versions/v1.7.0/coloring-production-plan.json'),'utf8'));
const files=(await readdir(source)).filter(n=>n.endsWith('.png'));if(files.length!==50)throw Error(`Expected 50 finals, found ${files.length}`);
const old= catalog.filter(a=>a.category!=='background');
const backgrounds=catalog.filter(a=>a.category==='background' && a.id.startsWith('bg170-')).map(a=>({...a,name:shortName(a.name)}));
const additions=[];
for(const p of plan){const [,theme,style]=p.id.split('-');const file=path.join(source,p.id+'.png');const meta=await sharp(file).metadata();if(meta.width<1400||meta.height<700)throw Error('Invalid '+p.id);const id='bg170-'+p.id;await sharp(file).webp({lossless:true}).toFile(path.join(out,'sprites',id+'.webp'));await sharp(file).resize(432).webp({lossless:true}).toFile(path.join(out,'thumbs',id+'.webp')); additions.push({id,name:shortName(p.name),category:'background',collection:'bg-'+theme,coloring:true,theme,style,quality:'original-background-v170',src:`assets/backgrounds-v170/sprites/${id}.webp`,thumbnail:`assets/backgrounds-v170/thumbs/${id}.webp`,width:meta.width,height:meta.height,artNote:'独立生成的幼儿线稿；黑白闭合线条，保留大块涂色区域。'});}
const result=[...additions,...backgrounds,...old];const ids=new Set();for(const a of result){if(ids.has(a.id))throw Error('duplicate '+a.id);ids.add(a.id);}
await writeFile(path.join(root,'public/assets/catalog.json'),JSON.stringify(result,null,2)+'\n');await writeFile(path.join(root,'public/assets/catalog.js'),'window.LUOYE_ASSETS = '+JSON.stringify(result)+';\n');console.log(`Published ${additions.length} coloring pages; retained ${backgrounds.length} new backgrounds; catalog ${result.length}`);
function shortName(name){const parts=String(name).split('·').map(s=>s.trim()).filter(Boolean);return parts.length>=2?parts[1].replace(/大块涂色$/,'涂色'):String(name).replace(/ · (漫画|油画|水彩|铅笔|写实|剪纸|大块涂色)$/,'').replace(/^各种天气$/,'天气').replace(/^自然动物$/,'动物').replace(/^海底世界$/,'海底').replace(/^河流湖泊$/,'河湖');}
