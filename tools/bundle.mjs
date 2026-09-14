import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export const root = fileURLToPath(new URL('../', import.meta.url));
// Fixed dependency order for this small dependency-free codebase. No arbitrary modules.
export async function bundle() {
  const files = ['core.js', 'pixels.js', 'warps.js','fractals.js','geometry.js', 'bundled-images.js','engine.js', 'animated-effects.js', 'editor.js','brushes-legacy.js','brushes.js','materials.js','paper-tools.js','drawing.js', 'storage.js', 'icons.js', 'studio-ui.js','legacy.js','gallery-ui.js','recording.js','recorder-ui.js','text.js','text-ui.js','creative-ui.js','palette-ui.js','playful-icons.js','choice-art.js','classic-ui.js','playful-controls.js','display-ui.js','audio-preferences.js','tool-feedback.js','music-ui.js','materials-ui.js', 'app.js'];
  files.splice(files.indexOf('app.js'),0,'close-flow.js');
  const contents = await Promise.all(files.map(name => readFile(path.join(root, 'src', name), 'utf8')));
  const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const music = JSON.parse(await readFile(path.join(root, 'public/music/tracks.json'), 'utf8'));
  return `'use strict';\n(() => {\nwindow.LUOYE_VERSION=${JSON.stringify(version)};\nwindow.LUOYE_MUSIC_TRACKS=${JSON.stringify(music)};\n${contents.map((text, i) => `// ${files[i]}\n` + text.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '')).join('\n')}\n})();\n`;
}
