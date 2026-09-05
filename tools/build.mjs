import { mkdir, cp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { bundle, root } from './bundle.mjs';
import { canvasAssets } from './canvas-assets.mjs';
const output = path.join(root, 'dist');
// Remove generated output so old or rejected assets cannot survive a rebuild.
await rm(output, { recursive:true, force:true });
await mkdir(output, { recursive:true });
await cp(path.join(root, 'public'), output, { recursive:true,
  filter: source => !['public/assets/candidates','public/assets/fairy-v15/masters','public/assets/fairy-v15/motion-masters','public/assets/fairy-v15/vectors'].some(directory => source === path.join(root, directory)) });
await writeFile(path.join(output, 'app.js'), await bundle());
await writeFile(path.join(output, 'canvas-assets.js'), await canvasAssets(path.join(root,'public')));
console.log(`Desktop interface resources built: ${output}`);
