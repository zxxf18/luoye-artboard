import { sourceUICopy, sourceUIAttribute } from './i18n.js';
import { choiceChevron, playfulIcon } from './playful-icons.js';
import { choiceArt } from './choice-art.js';

export function mountPlayfulControls(){
  let serial=0,source=null,returnFocus=null;
  const chooser=document.createElement('dialog');chooser.className='choice-dialog';chooser.id='choice-dialog';chooser.setAttribute('aria-labelledby','choice-title');
  chooser.innerHTML='<h2 id="choice-title">选一个喜欢的</h2><input id="choice-search" type="search" placeholder="找一找…" aria-label="查找选项" hidden><div id="choice-grid" class="choice-grid"></div><div class="dialog-actions"><button id="choice-cancel">返回</button></div>';document.body.append(chooser);
  const grid=chooser.querySelector('#choice-grid'),search=chooser.querySelector('#choice-search');
  function labelFor(control){const aria=sourceUIAttribute(control,'aria-label');if(aria)return aria;const label=control.labels?.[0];if(!label)return '选一个';return sourceUICopy(label, 'input,select,button,output,.number-stepper').trim()||'选一个';}
  const names={'stroke-mode':'画法','brush-ratio':'笔头宽窄','paint-source':'纹理','paper-grain':'笔触纸感','text-size':'字有多大','preset':'选一张画纸','effect-kind':'试试这个效果','fractal-kind':'神奇分形','music-track':'选一首音乐'};
  function renderChoices(){grid.replaceChildren();if(!source)return;[...source.options].forEach((option,i)=>{if(option.hidden||!option.textContent.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()))return;const b=document.createElement('button');b.type='button';b.className='choice-card';b.dataset.value=option.value;b.disabled=option.disabled;b.setAttribute('aria-pressed',option.selected);b.append(choiceArt(source,option));const name=document.createElement('span');name.textContent=sourceUICopy(option);b.append(name);b.onclick=()=>{const control=source;control.value=option.value;chooser.close();control.dispatchEvent(new Event('input',{bubbles:true}));control.dispatchEvent(new Event('change',{bubbles:true}));sync(control);};grid.append(b);});if(!grid.children.length){const p=document.createElement('p');p.textContent='没找到，换个名字试试。';grid.append(p);}}
  function sync(control){
    const button=control._choice;
    if(!button)return;
    const label=names[control.id]||labelFor(control),value=sourceUICopy(control.selectedOptions[0])||'请选择';
    const key=label+'|'+value;
    if(button.disabled!==control.disabled)button.disabled=control.disabled;
    if(button.dataset.state===key)return;
    button.dataset.state=key;
    button.setAttribute('aria-label',label+'：'+value);
    button.replaceChildren();
    const valueNode=document.createElement('span');
    valueNode.textContent=value;
    if(control.selectedOptions[0])button.append(choiceArt(control,control.selectedOptions[0]));
    button.append(valueNode);
    button.insertAdjacentHTML('beforeend',choiceChevron());
  }
  const actionPictures={'music-play':'play','music-stop':'stop','music-import':'folder','music-prev':'undo','music-next':'redo',copy:'copy',cut:'cut',paste:'paste','selection-menu':'select',recordings:'play','import-image':'folder','select-all':'select','select-none':'eraser','select-inverse':'magic','clear-selection-pixels':'eraser','use-stamp':'stamp','duplicate-layer':'copy','clear-layer':'eraser','merge-bottom':'layers','flip-x':'warp','flip-y':'warp','rotate-90':'rotate','export-layer':'download','animation-toggle':'play','freeze-animation':'stop','clone-source':'clone','background-picker-open':'palette','filter-preview-button':'board-filter','fractal-open':'fractal','text-import-texture':'folder','text-clear-texture':'eraser','record-start':'play','record-stop':'stop','record-export':'download','record-import':'folder','record-first':'undo','record-prev':'undo','record-next':'redo','record-last':'redo','record-play':'play','record-pause':'stop','record-truncate':'cut','gallery-save':'save'};
  function enhanceAction(button){
    const picture=actionPictures[button.id]||(button.parentElement?.id==='darkroom-categories'?'board-filter':null);
    if(!picture||button.querySelector('svg,img,canvas'))return;
    const label=document.createElement('span');label.textContent=sourceUICopy(button);
    button.replaceChildren();button.insertAdjacentHTML('afterbegin',playfulIcon(picture));
    button.append(label);button.classList.add('picture-action');
  }

  function enhanceSelect(select){
    if(select._choice||select.dataset.directChoice)return;
    if(!select.id)select.id='play-choice-'+(++serial);
    const button=document.createElement('button');
    button.id=select.id+'-choose';button.type='button';button.className='choice-button';
    button.setAttribute('aria-haspopup','dialog');
    button.setAttribute('aria-controls',chooser.id);
    button.setAttribute('aria-expanded','false');
    select.classList.add('choice-source');select.tabIndex=-1;select.after(button);select._choice=button;
    button.onclick=()=>{
      if(document.body.hasAttribute('aria-busy'))return;
      source=select;returnFocus=button;chooser.querySelector('h2').textContent=names[select.id]||labelFor(select);
      search.hidden=select.options.length<15;search.value='';renderChoices();chooser.showModal();
      button.setAttribute('aria-expanded','true');
      (grid.querySelector('[aria-pressed=true]')||grid.querySelector('button'))?.focus();
    };
    sync(select);
  }

  function enhanceNumber(input){
    if(input.closest('.number-stepper'))return;
    const label=names[input.id]||labelFor(input),wrap=document.createElement('span');wrap.className='number-stepper';input.before(wrap);
    const minus=document.createElement('button'),plus=document.createElement('button');
    for(const [button,text,delta] of [[minus,'−',-1],[plus,'＋',1]]){
      button.type='button';button.textContent=text;button.setAttribute('aria-label',(delta<0?'减小':'增大')+label);
      button.onclick=()=>{
        if(input.disabled||document.body.hasAttribute('aria-busy'))return;
        if(delta<0)input.stepDown();else input.stepUp();
        input.dispatchEvent(new Event('input',{bubbles:true}));
        input.dispatchEvent(new Event('change',{bubbles:true}));
      };
    }
    wrap.append(minus,input,plus);
  }

  function enhanceControl(control){
    if(control.localName==='button')enhanceAction(control);
    else if(control.localName==='select')enhanceSelect(control);
    else if(control.type==='number')enhanceNumber(control);
  }

  const controlSelector='button[id], #darkroom-categories > button, select, input[type="number"]';
  function enhance(root){
    if(root.nodeType===1){
      // Controls cannot contain other controls. Gallery cards, toolbar icons
      // and canvas updates also need no descendant scans.
      if(['button','select','input'].includes(root.localName)){enhanceControl(root);return;}
      if(!root.childElementCount||root.namespaceURI!=='http://www.w3.org/1999/xhtml')return;
    }
    for(const control of root.querySelectorAll(controlSelector))enhanceControl(control);
  }
  search.oninput=renderChoices;chooser.querySelector('#choice-cancel').onclick=()=>chooser.close();chooser.addEventListener('close',()=>{
    if(chooser.open)return;
    returnFocus?.setAttribute('aria-expanded','false');
    returnFocus?.focus();
    source=returnFocus=null;
  });
  function syncAll(){document.querySelectorAll('select.choice-source').forEach(sync);}
  const syncSelect=event=>{if(event.target.localName==='select')sync(event.target);};
  for(const event of ['change','input'])document.addEventListener(event,syncSelect);
  for(const event of ['toolchange','controlschange'])document.addEventListener(event,syncAll);
  new MutationObserver(records=>{
    const changedSelects=new Set();
    for(const {target,addedNodes} of records){
      for(const node of addedNodes)if(node.nodeType===1&&node.isConnected)enhance(node);
      if(target.localName==='button'&&target.classList.contains('picture-action'))enhanceAction(target);
      const select=target.localName==='select'?target:
        ['option','optgroup'].includes(target.localName)?target.closest('select'):null;
      if(select?._choice)changedSelects.add(select);
    }
    changedSelects.forEach(sync);
  }).observe(document.body,{childList:true,subtree:true});
  enhance(document);return {sync:syncAll};
}
