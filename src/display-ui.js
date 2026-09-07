import { playfulIcon } from './playful-icons.js';

export function mountDisplay(){
  const dialog=document.createElement('dialog');dialog.className='display-dialog';dialog.id='display-dialog';dialog.innerHTML='<h2>让画室更好用</h2><h3>按钮和文字大小</h3><div class="display-options" id="ui-sizes"></div><h3>画室窗口</h3><div class="display-options" id="window-sizes"></div><p id="display-note">窗口会适应你的屏幕，画纸大小不会改变。</p><div class="dialog-actions"><button id="display-close" class="primary">就这样，去画画</button></div>';document.body.append(dialog);
  const button=document.createElement('button');button.id='display-open';button.className='header-command';button.setAttribute('aria-label','界面大小');button.innerHTML=playfulIcon('display')+'<span>界面大小</span>';button.onclick=()=>dialog.showModal();document.querySelector('.header-actions').append(button);dialog.querySelector('#display-close').onclick=()=>dialog.close();
  let selected='auto';try{selected=localStorage.getItem('jshw-ui-size')||'auto';}catch{}
  const choices=[['auto','舒适',1],['large','大按钮',1.18],['largest','特大按钮',1.35]];
  function apply(value){selected=choices.some(c=>c[0]===value)?value:'auto';const base=innerWidth>=2200?1.2:innerWidth>=1800?1.08:1,scale=base*choices.find(c=>c[0]===selected)[2];document.body.style.setProperty('--u',scale);document.body.dataset.uiSize=selected;for(const b of dialog.querySelectorAll('[data-ui-size]'))b.setAttribute('aria-pressed',b.dataset.uiSize===selected);try{localStorage.setItem('jshw-ui-size',selected);}catch{}document.dispatchEvent(new Event('uisizechange'));}
  for(const [id,label] of choices){const b=document.createElement('button');b.dataset.uiSize=id;b.textContent=label;b.onclick=()=>apply(id);dialog.querySelector('#ui-sizes').append(b);}apply(selected);window.addEventListener('resize',()=>apply(selected));
  const bridge=window.webkit?.messageHandlers?.display;
  for(const [action,name] of [['fit','适合屏幕'],['1080','1080 工作区'],['2k','2K 工作区'],['fullscreen','全屏／返回']]){const b=document.createElement('button');b.textContent=name;b.disabled=!bridge;b.onclick=()=>bridge.postMessage({action});dialog.querySelector('#window-sizes').append(b);}
  if(!bridge)dialog.querySelector('#display-note').textContent='界面大小可以直接调整。窗口与全屏请在桌面客户端使用。';
  window.addEventListener('native-display-result',event=>{const value=event.detail;dialog.querySelector('#display-note').textContent=`窗口已调整为 ${Math.round(value.width)} × ${Math.round(value.height)}，画纸保持不变。`;});
}
