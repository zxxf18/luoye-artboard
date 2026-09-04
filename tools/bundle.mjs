import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export const root = fileURLToPath(new URL('../', import.meta.url));
// Fixed dependency order for this small dependency-free codebase. No arbitrary modules.
export async function bundle() {
  const files = ['core.js', 'engine.js', 'storage.js', 'icons.js', 'app.js'];
  const contents = await Promise.all(files.map(name => readFile(path.join(root, 'src', name), 'utf8')));
  return `'use strict';\n(() => {\n${contents.map((text, i) => `// ${files[i]}\n` + text.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '')).join('\n')}\n})();\n`;
}
