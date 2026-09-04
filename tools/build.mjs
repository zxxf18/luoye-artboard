import { mkdir, cp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { bundle, root } from './bundle.mjs';
const output = path.join(root, 'dist');
// Remove generated output so old or rejected assets cannot survive a rebuild.
await rm(output, { recursive:true, force:true });
await mkdir(output, { recursive:true });
await cp(path.join(root, 'public'), output, { recursive:true,
  filter: source => source !== path.join(root, 'public/assets/candidates') });
await writeFile(path.join(output, 'app.js'), await bundle());
console.log(`Desktop interface resources built: ${output}`);
