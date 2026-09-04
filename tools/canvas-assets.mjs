import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

// file:// images are displayable in WKWebView but taint a canvas. Embed only
// packaged drawing resources, preserving file navigation and storage identity.
export async function canvasAssets(publicRoot) {
  const paths=(await readdir(path.join(publicRoot,'assets'))).filter(n=>/\.png$/i.test(n)).sort().map(n=>'assets/'+n);
  paths.push('classic/paint/fr_kind3.jpg');
  const entries=await Promise.all(paths.map(async name=>[name,'data:image/'+(name.endsWith('.jpg')?'jpeg':'png')+';base64,'+(await readFile(path.join(publicRoot,name))).toString('base64')]));
  return 'window.JSHW_IMAGE_DATA = Object.freeze('+JSON.stringify(Object.fromEntries(entries))+');\n';
}
