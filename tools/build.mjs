import { mkdir, cp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { bundle, root } from './bundle.mjs';
import { canvasAssets } from './canvas-assets.mjs';
import { Script } from 'node:vm';
import {mkdirSync,rmSync} from 'node:fs';
const lock=path.join(root,'build/desktop-build.lock');
mkdirSync(path.dirname(lock),{recursive:true});
try{mkdirSync(lock);}catch(error){throw new Error('另一个桌面构建正在使用资源目录，请等它完成后重试。',{cause:error});}
process.on('exit',()=>rmSync(lock,{recursive:true,force:true}));
const script=await bundle();
new Script(script,{filename:'app.js'});
const output = path.join(root, 'dist');
// Remove generated output so old or rejected assets cannot survive a rebuild.
await rm(output, { recursive:true, force:true });
await mkdir(output, { recursive:true });
await cp(path.join(root, 'public'), output, { recursive:true,
  filter: source => !['public/assets/candidates','public/assets/original','public/assets/thumbs','public/assets/illustrated','public/assets/redrawn-v14','public/assets/fairy-v15','public/assets/library-v16/masters'].some(directory => source === path.join(root, directory)) });
await writeFile(path.join(output, 'app.js'), script);
await writeFile(path.join(output, 'canvas-assets.js'), await canvasAssets(path.join(root,'public')));
console.log(`Desktop interface resources built: ${output}`);
