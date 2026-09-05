import { readFile,writeFile,mkdir } from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fairyMotionSVG} from './fairy-motion-art.mjs';
const require=createRequire(import.meta.url),sharp=require(process.env.LUOYE_SHARP || 'sharp');
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'public/assets/fairy-v15');
const jobs=JSON.parse(await readFile(path.join(root,'design/evidence/v1.5/fairy-jobs.json'),'utf8')).filter(j=>j.mode==='dynamic');
await mkdir(path.join(out,'vectors'),{recursive:true});await mkdir(path.join(out,'motion-masters'),{recursive:true});
const records=[];
for(const job of jobs){
 const kind=Number(job.assetId.split('-')[2]),frames=[];
 for(let frame=0;frame<8;frame++){
  const name=job.id+'-f'+frame,svg=fairyMotionSVG(kind,job.group,frame),source=path.join(out,'vectors',name+'.svg');
  await writeFile(source,svg);await sharp(Buffer.from(svg)).png().toFile(path.join(out,'motion-masters',name+'.png'));frames.push('assets/fairy-v15/motion-masters/'+name+'.png');
 }
 records.push({...job,method:'original-vector-animation',frames,masterSize:[2048,2048]});
}
await writeFile(path.join(root,'design/evidence/v1.5/vector-motion.json'),JSON.stringify({sharpVersion:sharp.versions.sharp,groups:records},null,2)+'\n');
console.log(`Rendered ${records.length} original vector animation groups at 2048 x 2048.`);
