import { readFileSync } from 'node:fs';
import path from 'node:path';
import { root } from './bundle.mjs';
export const version=JSON.parse(readFileSync(path.join(root,'package.json'),'utf8')).version;
export const releaseRoot=path.join(root,'build/releases','v'+version);
export const versionDocs=path.join(root,'design/versions','v'+version);
