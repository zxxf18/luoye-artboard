import { mountPalette } from './palette-ui.js';

export function mountClassic({setTool,getColor,setColor}) {
  const el=id=>document.getElementById(id);document.body.classList.add('classic');
  const left=document.createElement('aside');left.className='classic-left';left.setAttribute('aria-label','辅助工具');document.querySelector('.workspace').append(left);
  const tabs=document.querySelector('.workspace-tabs');document.querySelector('.tool-rail').prepend(tabs);
  const parameters=document.createElement('section');parameters.className='classic-parameters';parameters.setAttribute('aria-label','当前工具参数');parameters.append(document.querySelector('.options-bar'),document.querySelector('.detail-bar'));document.querySelector('.studio').append(parameters);
  const command=document.querySelector('.edit-commands');document.querySelector('.header-actions').prepend(command);
  const bar=el('tools');bar.replaceChildren();let page=0;
  const groups=[['pen','笔',0],['eraser','橡皮',1],['stamp','仙女袋',9],['fill','倒色',2],['picker','吸色管',3],['line','几何图形',4],['text','文字',5],['select','区域',6],['magic','魔力棒',7],['move','操纵器',8],['warp','变形',13],['board-filter','滤镜',11],['clone','仿制印章',10],['fractal','分形',12]];
  const geometryTools=['line','triangle','rect','pentagon','hexagon','roundrect','ellipse','star','polygon','bezier'];
  const groupTool=()=>geometryTools.includes(el('painting').dataset.tool)?'line':el('painting').dataset.tool;
  const flip=document.createElement('button');flip.id='tool-page';flip.title='工具翻页';flip.setAttribute('aria-label','工具翻页');flip.onclick=()=>{page=1-page;render();};
  function render(){bar.replaceChildren();for(const [name,label,index] of groups.slice(page*7,page*7+7)){const b=document.createElement('button');b.className='tool-button';b.dataset.tool=name;b.title=label;b.setAttribute('aria-label',label);b.innerHTML=`<span class="legacy-tool-art" style="background-image:url('classic/paint/but${index}.jpg')"></span><span>${label}</span>`;b.onclick=()=>{if(document.body.hasAttribute('aria-busy'))return;setTool(name);if(name==='stamp'){document.querySelector('[data-category="fairy"]').click();document.body.classList.add('library-open');}};bar.append(b);}flip.textContent=page?'◀ 第一页':'第二页 ▶';bar.append(flip);const tool=groupTool();for(const b of bar.querySelectorAll('[data-tool]'))b.setAttribute('aria-pressed',b.dataset.tool===tool);}
  render();
  const pens=document.createElement('div');pens.className='classic-pens';pens.setAttribute('aria-label','九种画笔');
  [...el('brush').options].forEach((o,i)=>{const b=document.createElement('button');b.title=o.textContent;b.setAttribute('aria-label',o.textContent);b.dataset.brush=o.value;b.innerHTML=`<span style="background-image:url('classic/recent/pen${i}.jpg')"></span><small>${o.textContent}</small>`;b.onclick=()=>{if(document.body.hasAttribute('aria-busy'))return;el('brush').value=o.value;setTool('pen');sync();};pens.append(b);});left.append(pens);
  const subtools=document.createElement('div');subtools.className='classic-pens classic-subtools';left.append(subtools);
  function sync(){
    const tool=el('painting').dataset.tool;for(const b of pens.children)b.setAttribute('aria-pressed',b.dataset.brush===el('brush').value);pens.hidden=tool!=='pen';subtools.replaceChildren();
    for(const b of bar.querySelectorAll('[data-tool]'))b.setAttribute('aria-pressed',b.dataset.tool===groupTool());
    const geometry=geometryTools.includes(tool);
    const map={eraser:['eraser-mode','rubber'],fill:['fill-mode','fill'],select:['selection-shape','rgn'],warp:['warp-kind','krew'],'board-filter':['board-filter-kind','effect']};
    const config=geometry?['geometry','draw']:map[tool];if(!config)return;const select=el(config[0]);if(!select)return;
    const shapes={line:0,triangle:1,rect:2,pentagon:3,hexagon:4,roundrect:5,ellipse:6,polygon:7,bezier:8};
    const regions={triangle:0,rect:1,pentagon:2,hexagon:3,roundrect:4,ellipse:5,free:6,bezier:7};
    const fills={all:0,gradient:1,region:2,'region-gradient':3,ellipse:4,rect:5};
    [...select.options].forEach((option,i)=>{const index=geometry?shapes[option.value]:tool==='select'?regions[option.value]:tool==='fill'?fills[option.value]:i;const b=document.createElement('button');b.title=option.textContent;b.textContent=option.textContent;b.setAttribute('aria-pressed',select.value===option.value);if(index!==undefined){const art=document.createElement('span');art.style.backgroundImage=`url('classic/recent/${config[1]}${index}.jpg')`;b.prepend(art);}b.onclick=()=>{if(document.body.hasAttribute('aria-busy'))return;select.value=option.value;select.dispatchEvent(new Event('change'));sync();};subtools.append(b);});
  }
  document.addEventListener('change',e=>{if(['brush','geometry','eraser-mode','fill-mode','selection-shape','warp-kind','board-filter-kind'].includes(e.target.id))sync();});document.addEventListener('toolchange',()=>{const index=groups.findIndex(g=>g[0]===groupTool());if(index>=0&&Math.floor(index/7)!==page){page=Math.floor(index/7);render();}sync();});sync();
  el('mode-library').onclick=()=>{document.body.classList.toggle('library-open');el('mode-library').setAttribute('aria-pressed',document.body.classList.contains('library-open'));};
  el('mode-board').addEventListener('click',()=>document.body.classList.remove('library-open'));
  const close=document.createElement('button');close.className='library-close';close.textContent='返回画板';close.onclick=()=>document.body.classList.remove('library-open');document.querySelector('.right-panel').prepend(close);
  el('layer-menu').textContent='图层';left.append(el('layer-menu'));el('selection-menu').textContent='选区操作';
  document.querySelector('.canvas-heading').hidden=true;document.querySelector('.panel-heading h2').textContent='图库';document.querySelector('.panel-description').textContent='背景、角色、动画、相框、仙女袋、纸样、纹理';
  document.querySelector('.brand small').textContent='经典创作室';el('tool-hint').textContent='选择右侧工具，在画纸上创作';
  const titleDialog=document.createElement('dialog');titleDialog.id='title-dialog';titleDialog.innerHTML='<h2>作品名称</h2><div class="dialog-actions"><button id="title-done">确定</button></div>';titleDialog.prepend(document.querySelector('.document-name'));document.body.append(titleDialog);const rename=document.createElement('button');rename.textContent='作品名称';rename.onclick=()=>titleDialog.showModal();left.append(rename);el('title-done').onclick=()=>titleDialog.close();
  mountPalette({getColor,setColor});
  return {groups};
}
