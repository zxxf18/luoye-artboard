import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const root = fileURLToPath(new URL('../', import.meta.url));

// The offline hosts load one classic script. Follow the app's named relative
// imports and emit each module once, after its dependencies.
const namedImport = /^import[ \t]+\{([\w$, \t]+)\}[ \t]+from[ \t]+(['"])([^'"\r\n]+)\2;[ \t]*\r?\n/gm;

async function appModules() {
  const ordered = new Map();
  const visiting = new Set();

  async function visit(file) {
    if (ordered.has(file)) return;
    if (visiting.has(file)) throw new Error(`Circular app import: ${[...visiting, file].join(' → ')}`);
    visiting.add(file);
    const source = await readFile(path.join(root, 'src', file), 'utf8');
    const dependencies = [];
    const content = source.replace(namedImport, (_, names, quote, specifier) => {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
      if (!/^\.\.?\//.test(specifier) || !/^(core|ui|platform)\/[\w/.-]+\.js$/.test(target) ||
          /\s+as\s+/.test(names)) {
        throw new Error(`Unsupported app import in ${file}: ${specifier}`);
      }
      dependencies.push(target);
      return '';
    });
    if (/^import\b/m.test(content)) throw new Error(`Unsupported app import syntax in ${file}`);

    for (const dependency of dependencies) await visit(dependency);
    visiting.delete(file);
    ordered.set(file, content.replace(/^export[ \t]+\{[^\r\n]*\};[ \t]*\r?\n/gm, '').replace(/^export /gm, ''));
  }

  await visit('platform/app.js');
  return ordered;
}

export async function bundle() {
  const [modules, manifest, tracks] = await Promise.all([
    appModules(),
    readFile(path.join(root, 'package.json'), 'utf8'),
    readFile(path.join(root, 'public/music/tracks.json'), 'utf8'),
  ]);
  const { version } = JSON.parse(manifest);
  const music = JSON.parse(tracks);
  const script = Array.from(modules, ([file, content]) => `// ${file}\n${content}`).join('\n');
  return `'use strict';\n(() => {\nwindow.LUOYE_VERSION=${JSON.stringify(version)};\nwindow.LUOYE_MUSIC_TRACKS=${JSON.stringify(music)};\n${script}\n})();\n`;
}
