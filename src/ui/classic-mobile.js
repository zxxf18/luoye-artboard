/**
 * 小屏（≤860px 宽或 ≤600px 高）时的抽屉层：画笔／工具／参数／素材变成
 * 底部命令条驱动的互斥面板。节点仍留在原 DOM 容器中，仅以 aria-hidden
 * 与挂载位置切换，保证既有焦点与事件接线继续生效。
 */

export function mountMobileShelf({ left, subtools, parameter, dock, onNarrowChanged }) {
  const mobileScrim=document.createElement('div');mobileScrim.className='mobile-scrim';mobileScrim.setAttribute('aria-hidden','true');document.body.append(mobileScrim);
  const mobileCommands=document.createElement('div');mobileCommands.className='mobile-commands';mobileCommands.setAttribute('aria-label','小屏工具栏');
  const mobileItems=[['brushes','画笔','classic-left'],['tools','工具','tool-rail'],['options','参数','tool-dock'],['library','素材','tool-dock']];
  const mobileButtons=new Map();
  for(const [panel,label,target] of mobileItems){const button=document.createElement('button');button.type='button';button.className='mobile-command';button.dataset.mobilePanel=panel;button.textContent=label;button.setAttribute('aria-controls',target);button.setAttribute('aria-expanded','false');button.onclick=()=>setMobilePanel(panel);mobileCommands.append(button);mobileButtons.set(panel,button);}
  const focusButton=document.createElement('button');focusButton.type='button';focusButton.className='mobile-command mobile-focus-command';focusButton.textContent='画布';focusButton.setAttribute('aria-controls','viewport');focusButton.setAttribute('aria-expanded','true');focusButton.onclick=()=>setMobilePanel('focus');mobileCommands.append(focusButton);mobileButtons.set('focus',focusButton);
  document.querySelector('.canvas-topbar').append(mobileCommands);
  let narrowWindow=false;
  function syncMobileShelfControls(panel){
    const library=document.querySelector('.library');
    const pager=document.querySelector('#library-pagination');
    const instruction=document.querySelector('#library-instruction');
    const fairyGroups=document.querySelector('#library-groups');
    if(fairyGroups){
      if(panel==='library'&&fairyGroups.parentElement!==library){
        library?.prepend(fairyGroups);
      }else if(panel!=='library'&&fairyGroups.parentElement!==left){
        left.insertBefore(fairyGroups,subtools);
      }
    }
    if(panel==='library'){
      if(pager&&library&&pager.parentElement!==library)library.append(pager);
      if(instruction&&library&&instruction.parentElement!==library)library.append(instruction);
    }else{
      if(pager&&pager.parentElement!==parameter)parameter.append(pager);
      if(instruction&&instruction.parentElement!==parameter)parameter.append(instruction);
    }
  }
  function setMobilePanel(panel,manual=true){
    if(!narrowWindow&&panel!=='focus')return;
    if(panel!=='focus'&&document.body.dataset.mobilePanel===panel)panel='focus';
    if(panel==='library'&&!document.body.classList.contains('library-open'))document.getElementById('mode-library').click();
    if(panel!=='library'&&document.body.classList.contains('library-open'))document.getElementById('mode-board').click();
    document.body.dataset.mobilePanel=panel;
    document.body.dataset.mobileFocus=String(panel==='focus');
    if(manual)document.body.dataset.mobileUser='true';
    for(const [name,button] of mobileButtons){const active=name===panel;button.setAttribute('aria-expanded',String(active));button.setAttribute('aria-pressed',String(active));}
    const toolRail=document.querySelector('.tool-rail');
    for(const [name,node] of [['brushes',left],['tools',toolRail],['dock',dock]]){const open=node===dock?(panel==='options'||panel==='library'):panel===name;node?.setAttribute('aria-hidden',String(!open));}
    syncMobileShelfControls(panel);
  }
  function syncMobileLayout(){
    const next=matchMedia('(max-width: 860px), (max-height: 600px)').matches;
    const changed=next!==narrowWindow;
    if(next&&!narrowWindow){document.body.removeAttribute('data-mobile-user');setMobilePanel('focus',false);}
    if(!next&&narrowWindow){document.body.removeAttribute('data-mobile-panel');document.body.removeAttribute('data-mobile-focus');document.body.removeAttribute('data-mobile-user');for(const node of [left,document.querySelector('.tool-rail'),dock])node?.removeAttribute('aria-hidden');syncMobileShelfControls('focus');}
    narrowWindow=next;
    if(changed)onNarrowChanged?.();
    if(next&&document.body.dataset.mobilePanel!=='focus'&&document.body.dataset.mobilePanel!=='brushes'&&document.body.dataset.mobilePanel!=='tools'&&document.body.dataset.mobilePanel!=='options'&&document.body.dataset.mobilePanel!=='library')setMobilePanel('focus',false);
  }
  mobileScrim.onclick=()=>setMobilePanel('focus');
  window.addEventListener('resize',syncMobileLayout);document.addEventListener('keydown',event=>{if(event.key==='Escape'&&narrowWindow&&document.body.dataset.mobilePanel!=='focus')setMobilePanel('focus');});
  syncMobileLayout();
  return { setMobilePanel, syncMobileLayout, isNarrow: () => narrowWindow };
}
