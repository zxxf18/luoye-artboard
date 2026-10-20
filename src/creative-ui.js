import { makeCanvas, loadImage } from './engine.js';
import { warpPixels } from './warps.js';

export function mountCreative({engine,run,toast,getColor,setTool,getTool}) {
  const el=id=>document.getElementById(id),detail=document.querySelector('.detail-bar');
  const extra=document.createElement('div');extra.className='creative-options';extra.innerHTML=`
    <label data-option="warp">变形 <select id="warp-kind"><option value="push">推拉变形</option><option value="zoom">缩放变形</option></select></label><label data-option="warp">速度 <input id="warp-speed" type="range" min="-100" max="100" value="50"></label>
    <label data-option="warp board-filter">半径 <input id="creative-radius" type="range" min="10" max="600" value="120"></label>
    <label data-option="board-filter">滤镜 <select id="board-filter-kind"><option value="ripple">水纹滤镜</option><option value="twist">扭曲滤镜</option><option value="waterfall">瀑布滤镜</option><option value="point-light">点光源滤镜</option><option value="direction-light">方向光源滤镜</option></select></label>
    <label data-option="board-filter" data-filter="twist">曲度 <input id="filter-curvature" type="range" min="-360" max="360" value="120"></label><label data-option="board-filter" data-filter="waterfall point-light direction-light">密度 <input id="filter-density" type="range" min="0" max="100" value="50"></label>
    <label data-option="board-filter" data-filter="waterfall">扩展度 <input id="filter-spread" type="range" min="0" max="100" value="30"></label><label data-option="board-filter" data-filter="waterfall">高度 <input id="filter-height" type="range" min="0" max="100" value="50"></label><label data-option="board-filter" data-filter="waterfall">方向 <select id="filter-direction"><option value="right">向右</option><option value="left">向左</option></select></label>
    <label data-option="board-filter" data-filter="direction-light">角度 <input id="filter-angle" type="range" min="0" max="360" value="45"></label><button id="filter-preview-button" data-option="board-filter">预览／确定</button>`;
  detail.append(extra);
  for(const id of ['warp-kind','board-filter-kind']){
    const control=el(id);control.dataset.directChoice='true';control.hidden=true;
    control.closest('label').classList.add('sidebar-choice-source');
  }
  for(const input of extra.querySelectorAll('input[type=range]')){const output=document.createElement('output');output.textContent=input.value;input.after(output);input.oninput=()=>output.textContent=input.value;}
  function options(){return {warpKind:el('warp-kind').value,speed:Number(el('warp-speed').value),radius:Number(el('creative-radius').value),filterKind:el('board-filter-kind').value,curvature:Number(el('filter-curvature').value),density:Number(el('filter-density').value),spread:Number(el('filter-spread').value),height:Number(el('filter-height').value),direction:el('filter-direction').value,angle:Number(el('filter-angle').value)};}
  function showOptions(){const tool=el('painting').dataset.tool;for(const item of extra.querySelectorAll('[data-option]'))item.hidden=!item.dataset.option.split(' ').includes(tool)||(item.dataset.filter&&!item.dataset.filter.split(' ').includes(el('board-filter-kind').value));}
  document.addEventListener('toolchange',showOptions);el('board-filter-kind').onchange=showOptions;showOptions();
  const filterDialog=document.createElement('dialog');filterDialog.className='wide-dialog';filterDialog.innerHTML='<h2>画板滤镜</h2><div class="effect-preview" id="board-preview"></div><p>预览以画纸中心为作用点；也可关闭后点击画纸指定位置。小伙伴会继续播放动画。</p><div class="dialog-actions"><button id="board-cancel">取消</button><button id="board-apply" class="primary">确定</button></div>';document.body.append(filterDialog);
  el('filter-preview-button').onclick=()=>run(()=>{
    const width=engine.paperMode?engine.width:engine.active.width,height=engine.paperMode?engine.height:engine.active.height,scale=Math.min(1,400/Math.max(width,height));
    const original=makeCanvas(width,height);if(engine.paperMode)engine.paint(original.getContext('2d'));else engine.drawLayer(original.getContext('2d'),engine.active);
    const c=makeCanvas(Math.max(1,Math.round(width*scale)),Math.max(1,Math.round(height*scale))),ctx=c.getContext('2d');ctx.drawImage(original,0,0,c.width,c.height);
    const data=ctx.getImageData(0,0,c.width,c.height);data.data.set(warpPixels(data.data,c.width,c.height,{...options(),kind:options().filterKind,radius:options().radius/(engine.paperMode?1:engine.active.scale)*scale}));ctx.putImageData(data,0,0);el('board-preview').replaceChildren(c);filterDialog.showModal();
  });
  el('board-cancel').onclick=()=>filterDialog.close();el('board-apply').onclick=()=>run(async()=>{filterDialog.close();el('tool-settings')?.close();await engine.applyBoardFilter(options().filterKind,{...options(),radius:options().radius/(engine.paperMode?1:engine.active.scale)});});
  return {options,open};
}
