import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {root} from './bundle.mjs';
import {backgroundSVG} from './background-art-v162.mjs';
const sharp=createRequire(import.meta.url)(process.env.LUOYE_SHARP||'sharp');
const out=path.join(root,'public/assets/backgrounds-v162');
for(const d of ['vectors','sprites','thumbs'])await mkdir(path.join(out,d),{recursive:true});
const catalog=JSON.parse(await readFile(path.join(root,'public/assets/catalog.json'),'utf8'));
const items=catalog.filter(a=>a.category==='background'&&!a.coloring),records=[];
for(const [i,item] of items.entries()){
 const {name,svg}=backgroundSVG(i);
 await writeFile(path.join(out,'vectors',item.id+'.svg'),svg);
 for(const [dir,width] of [['sprites',2560],['thumbs',432]])await sharp(Buffer.from(svg)).resize(width).webp({quality:95}).toFile(path.join(out,dir,item.id+'.webp'));
 Object.assign(item,{name,src:'assets/backgrounds-v162/sprites/'+item.id+'.webp',thumbnail:'assets/backgrounds-v162/thumbs/'+item.id+'.webp',width:2560,height:1440,artNote:'独立程序化矢量构图，未读取或描摹原版背景；ID 仅用于兼容目录。',masterSource:'assets/backgrounds-v162/vectors/'+item.id+'.svg'});
 records.push({id:item.id,name,master:item.masterSource,referenceImageUsed:false});
}
await writeFile(path.join(root,'public/assets/catalog.json'),JSON.stringify(catalog,null,2)+'\n');
await writeFile(path.join(root,'public/assets/catalog.js'),'window.LUOYE_ASSETS = '+JSON.stringify(catalog)+';\n');
await mkdir(path.join(root,'design/versions/v1.6.2/evidence'),{recursive:true});
await writeFile(path.join(root,'design/versions/v1.6.2/evidence/backgrounds.json'),JSON.stringify(records,null,2)+'\n');
console.log('Published '+items.length+' independently composed 2K backgrounds.');
