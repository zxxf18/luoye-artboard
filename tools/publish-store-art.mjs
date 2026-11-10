import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const sharp=createRequire(import.meta.url)(process.env.LUOYE_SHARP||'/Users/zhaoxin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(import.meta.dirname,'..');
const plan=JSON.parse(await readFile(path.join(root,'tools/art/store-refresh.json'),'utf8'));
const source=path.join(root,'local-only/store-art/masters');
const output=path.join(root,'public/assets/store-original');
const catalog=JSON.parse(await readFile(path.join(root,'public/assets/catalog.json'),'utf8'));
// Fail before touching the catalog if the batch is incomplete.
for(const job of plan)await access(path.join(source,job.id+'.png'));
await mkdir(path.join(output,'sprites'),{recursive:true});
await mkdir(path.join(output,'thumbs'),{recursive:true});
const records=[];
for(const job of plan){
 const item=catalog.find(x=>x.id===job.id);if(!item)throw Error('Unknown asset '+job.id);
 const bytes=await readFile(path.join(source,job.id+'.png')),meta=await sharp(bytes).metadata();
 const prefix='assets/store-original/';
 if(job.mode==='background'){
  await sharp(bytes).resize(1600,900,{fit:'cover'}).webp({quality:90}).toFile(path.join(output,'sprites',job.id+'.webp'));
  Object.assign(item,{src:prefix+'sprites/'+job.id+'.webp',width:1600,height:900});
 }else{
  const stats=await sharp(bytes).stats();
  if(!meta.hasAlpha||stats.channels[3].min!==0)throw Error('Sheet is not transparent: '+job.id);
  const groups=job.mode==='static'?item.fairyGroups.length:job.mode==='dynamic'?item.fairyGroups.length:1;
  const size=job.mode==='animation'?640:480;
  const all=[];
  for(let g=0;g<groups;g++){
   const frames=[];const count=job.mode==='static'?1:job.count;
   for(let f=0;f<count;f++){
    const cell=job.mode==='static'?g:f,col=cell%job.cols,row=Math.floor(cell/job.cols);
    const left=Math.round(col*meta.width/job.cols),top=Math.round(row*meta.height/job.rows);
    const width=Math.round((col+1)*meta.width/job.cols)-left,height=Math.round((row+1)*meta.height/job.rows)-top;
    const filename=`${job.id}-g${g}-f${f}.webp`;
    let pipeline=sharp(bytes).extract({left,top,width,height}).resize(size,size,{fit:'contain',background:'#00000000'});
    // Dynamic bag groups retain their independent color variants and frame counts.
    if(job.mode==='dynamic'&&g>0)pipeline=pipeline.modulate({hue:g*18});
    await pipeline.webp({quality:91,alphaQuality:100}).toFile(path.join(output,'sprites',filename));
    frames.push(prefix+'sprites/'+filename);
   }
   all.push(frames);
  }
  if(item.fairyGroups)item.fairyGroups.forEach((group,g)=>Object.assign(group,{frames:all[g],width:size,height:size}));
  else item.frames=all[0];
  Object.assign(item,{src:all[0][job.mode==='dynamic'?all[0].length-1:0],width:size,height:size});
 }
 item.thumbnail=prefix+'thumbs/'+job.id+'.webp';
 await sharp(path.join(root,'public',item.src)).resize(240,240,{fit:'inside'}).webp({quality:88,alphaQuality:100}).toFile(path.join(output,'thumbs',job.id+'.webp'));
 Object.assign(item,{quality:'original-imagegen-preschool-store',artDirection:job.artDirection||'原创幼儿绘本水粉风格；无品牌与知名角色；保持既有主题与分类。',artNote:job.mode==='background'?'ImageGen 原创无品牌背景；独立场景。':'ImageGen 原创帧表；逐格裁切，动态分组保留配色变体。',masterSource:'local-only/store-art/masters/'+job.id+'.png'});
 records.push({id:job.id,name:job.name,mode:job.mode,sha256:createHash('sha256').update(bytes).digest('hex'),prompt:job.prompt,edits:job.edits||[],method:'built-in-imagegen',sourceWidth:meta.width,sourceHeight:meta.height});
}
await writeFile(path.join(root,'public/assets/catalog.json'),JSON.stringify(catalog,null,2)+'\n');
await writeFile(path.join(root,'public/assets/catalog.js'),'window.LUOYE_ASSETS = '+JSON.stringify(catalog)+';\n');
await writeFile(path.join(root,'tools/art/store-refresh-provenance.json'),JSON.stringify(records,null,2)+'\n');
console.log(`Published ${records.length} original replacements; catalog IDs, categories and groups preserved.`);
