import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export const root = fileURLToPath(new URL('../', import.meta.url));
// Fixed dependency order for this small dependency-free codebase. No arbitrary modules.
// Three layers: core (engine, models, algorithms, serialization) → ui (toolbars, panels, editors) → platform (shell bootstrap, persistence).
export async function bundle() {
const files = ['core/core.js', 'core/document.js', 'core/pointer.js', 'core/operations.js', 'core/tool-registry.js', 'core/pixels.js', 'core/warps.js','core/geometry.js', 'core/bundled-images.js','core/engine.js', 'core/animated-effects.js', 'core/editor.js','core/brushes.js','core/shape-eraser.js','core/materials.js','core/paper-tools.js','core/assist.js','core/drawing.js', 'core/storage-format.js', 'platform/storage.js', 'ui/icons.js', 'ui/studio-ui.js','core/legacy.js','ui/gallery-ui.js','ui/recording.js','ui/recorder-ui.js','core/text.js','ui/text-ui.js','ui/creative-ui.js','ui/palette-ui.js','core/input-sampling.js','ui/playful-icons.js','ui/animation-editor.js','ui/pixel-art.js','ui/choice-art.js','ui/classic-scratch.js','ui/classic-mobile.js','ui/fractal-studio.js','ui/classic-ui.js','ui/assist-ui.js','ui/playful-controls.js','ui/display-ui.js','ui/audio-preferences.js','ui/tool-cursors.js','ui/tool-feedback.js','ui/music-ui.js','ui/materials-ui.js','ui/theme-scenes.js','ui/theme-ui.js', 'platform/app.js'];
  files.splice(files.indexOf('platform/app.js'),0,'platform/close-flow.js');
  const contents = await Promise.all(files.map(name => readFile(path.join(root, 'src', name), 'utf8')));
  const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const music = JSON.parse(await readFile(path.join(root, 'public/music/tracks.json'), 'utf8'));
  return `'use strict';\n(() => {\nwindow.LUOYE_VERSION=${JSON.stringify(version)};\nwindow.LUOYE_MUSIC_TRACKS=${JSON.stringify(music)};\n${contents.map((text, i) => `// ${files[i]}\n` + text.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '')).join('\n')}\n})();\n`;
}
