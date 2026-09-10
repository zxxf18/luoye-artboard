import { loadImage } from './engine.js';

export function mountMaterials({engine,run,toast,getColor}) {
  const el=id=>document.getElementById(id),panel=document.createElement('div');panel.className='creative-options';
  const drawing='pen fill line rect ellipse triangle pentagon hexagon roundrect star polygon bezier';
  panel.innerHTML=`<label data-option="${drawing}">色彩 <button id="paint-color-open" type="button"><i aria-hidden="true"></i><span>选颜色</span></button></label><label data-option="pen">画纸 <select id="paper-grain"><option value="none">光滑</option><option value="grain-0">纸纹 1</option><option value="grain-1">纸纹 2</option></select></label><label data-option="pen">纸纹强度 <input id="paper-grain-strength" type="range" min="0" max="100" value="70"></label><input id="paint-texture-file" type="file" accept="image/png,image/jpeg,image/webp" hidden>`;
  // Mount the complete panel, including the custom texture file input, before
  // looking up controls or binding handlers. The wrapper uses display:contents.
  document.querySelector('.primary-brush-options').append(panel);
  for(const item of panel.querySelectorAll('[data-option]'))item.hidden=!item.dataset.option.split(' ').includes('pen');
  let source='color',grain='none';
  const textureOption=document.createElement('label');textureOption.className='paint-texture-option';textureOption.innerHTML='纹理 <select id="paint-source"><option value="color">不使用纹理</option><option value="texture-0">纹理 1</option><option value="texture-1">纹理 2</option><option value="custom">输入图片</option></select>';
  el('palette-dialog').querySelector('.dialog-actions').before(textureOption);
  el('paint-color-open').onclick=()=>el('foreground-palette').click();
  const syncColor=()=>{el('paint-color-open').style.setProperty('--paint-color',getColor());};
  document.addEventListener('palettechange',()=>{source='color';engine.setPaintTexture(null);el('paint-source').value='color';syncColor();document.dispatchEvent(new Event('controlschange'));});syncColor();
  const textures=(window.LUOYE_ASSETS||[]).filter(a=>a.category==='texture');
  for(const control of [el('paint-source'),el('paper-grain')])for(const asset of textures){const option=new Option(asset.name,asset.id);if(![...control.options].some(o=>o.value===asset.id))control.add(option);}
  const imagePath=value=>textures.find(a=>a.id===value)?.src||'assets/'+value+'.png';
  el('paint-source').onchange=()=>run(async()=>{const value=el('paint-source').value;if(value==='custom'){el('paint-texture-file').click();el('paint-source').value=source;document.dispatchEvent(new Event('controlschange'));return;}try{if(value==='color')engine.setPaintTexture(null);else engine.setPaintTexture(await loadImage(imagePath(value)));source=value;if(value!=='color')el('palette-dialog').close();}catch(error){el('paint-source').value=source;throw error;}finally{document.dispatchEvent(new Event('controlschange'));}});
  el('paper-grain').onchange=()=>run(async()=>{const value=el('paper-grain').value;try{engine.setPaperTexture(value==='none'?null:await loadImage(imagePath(value)));grain=value;}catch(error){el('paper-grain').value=grain;throw error;}finally{document.dispatchEvent(new Event('controlschange'));}});
  el('paint-texture-file').onchange=()=>run(async()=>{const file=el('paint-texture-file').files[0];el('paint-texture-file').value='';if(!file)return;if(file.size>10*1024*1024)throw new Error('纹理图片不能超过 10 MiB。');const url=URL.createObjectURL(file);try{engine.setPaintTexture(await loadImage(url));source='custom';el('paint-source').value='custom';el('palette-dialog').close();toast('已载入图片纹理');}finally{URL.revokeObjectURL(url);document.dispatchEvent(new Event('controlschange'));}});
  return {options:()=>({fillSource:source==='color'?'color':'texture',paperGrain:grain==='none'?0:Number(el('paper-grain-strength').value)/100})};
}
