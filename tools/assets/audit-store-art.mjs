import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
const sharp=createRequire(import.meta.url)(process.env.LUOYE_SHARP||'/Users/zhaoxin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(import.meta.dirname,'../..'),plan=JSON.parse(await readFile(path.join(root,'tools/assets/manifests/store-refresh.json'))),errors=[],sheets=[];
for(const p of plan.filter(x=>x.mode!=='background')){
 const {data,info}=await sharp(path.join(root,'local-only/store-art/masters',p.id+'.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const cells=[];
 for(let f=0;f<p.count;f++){
  const col=f%p.cols,row=Math.floor(f/p.cols),left=Math.round(col*info.width/p.cols),top=Math.round(row*info.height/p.rows),right=Math.round((col+1)*info.width/p.cols),bottom=Math.round((row+1)*info.height/p.rows);
  let min=255,max=0,sum=0,edge=0;const hash=createHash('sha256');
  for(let y=top;y<bottom;y++){
   hash.update(data.subarray((y*info.width+left)*4,(y*info.width+right)*4));
   for(let x=left;x<right;x++){const alpha=data[(y*info.width+x)*4+3];min=Math.min(min,alpha);max=Math.max(max,alpha);sum+=alpha;if(alpha>32&&(x===left||x===right-1||y===top||y===bottom-1))edge++;}
  }
  const mean=sum/((right-left)*(bottom-top));cells.push({frame:f,min,max,mean,edgePixels:edge,sha256:hash.digest('hex')});
  if(min!==0||max<32||mean<1)errors.push({id:p.id,frame:f,min,max,mean});
 }
 const distinct=new Set(cells.map(x=>x.sha256)).size;if(p.mode!=='static'&&distinct<3)errors.push({id:p.id,distinct});
 sheets.push({id:p.id,distinct,cells});
}
await mkdir(path.join(root,'build'),{recursive:true});await writeFile(path.join(root,'build/store-art-alpha-audit.json'),JSON.stringify({sheets:sheets.length,errors,details:sheets},null,2));
console.log(JSON.stringify({sheets:sheets.length,errors,edgeWarnings:sheets.flatMap(x=>x.cells.filter(c=>c.edgePixels>30).map(c=>({id:x.id,frame:c.frame,edges:c.edgePixels})))},null,2));if(errors.length)process.exitCode=1;
