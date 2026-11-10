// Only indexed runtime images belong in a distributable; source archives remain outside it.
export function runtimeAssetPaths(catalog) {
 const paths=new Set();
 for(const item of catalog){
  for(const value of [item.src,item.thumbnail,...(item.frames||[]),...(item.fairyGroups||[]).flatMap(g=>g.frames)])if(value)paths.add(value);
 }
 return paths;
}
export function includeAsset(relative, paths) {
 if(relative==='assets/legacy-catalog.json')return false;
 return !/^assets\/.*\.(?:png|jpe?g|webp|gif|svg|bmp)$/i.test(relative)||paths.has(relative);
}
