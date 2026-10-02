const checks=[];
try{
 const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const check=(ok,name)=>{checks.push({passed:!!ok,name});if(!ok)throw Error(name);};
 const idle=async()=>{for(let i=0;i<600&&document.body.hasAttribute('aria-busy');i++)await pause(25);check(!document.body.hasAttribute('aria-busy'),'操作结束后恢复响应');await pause(100);};
 const project=async()=> (await window.LUOYEFlushBeforeClose()).project;
 const compact=matchMedia('(max-width: 860px), (max-height: 600px)').matches;
 const tool=id=>{if(!document.querySelector(`#tools [data-tool="${id}"]`))$('tool-page').click();document.querySelector(`#tools [data-tool="${id}"]`).click();};
 const openLibrary=async()=>{
   const command=document.querySelector('.mobile-command[data-mobile-panel="library"]');
   if(compact&&command){if(document.body.dataset.mobilePanel!=='library'){command.click();await pause(80);}}
   else if(!document.body.classList.contains('library-open')){$('mode-library').click();await pause(40);}
 };
 const closeLibrary=async()=>{const focus=document.querySelector('.mobile-command[data-mobile-panel="focus"]');if(compact&&focus&&document.body.dataset.mobilePanel!=='focus'){focus.click();await pause(80);}};
 const openOptions=async()=>{const options=document.querySelector('.mobile-command[data-mobile-panel="options"]');if(compact&&options&&document.body.dataset.mobilePanel!=='options'){options.click();await pause(80);}};
 const library=async category=>{await openLibrary();const button=document.querySelector(`[data-category="${category}"]`);check(button,'素材分类不可用 '+category);button.click();await pause(40);};
 // A compact phone shows only a few cards per page.  Select the collection
 // first when the requested asset belongs to one, then walk the real pager
 // instead of assuming the first page contains a particular id.
 const collectionFor=id=>id.startsWith('bg170-space')?'太空':id.startsWith('bg170-')?'全部图案':'';
 const selectAsset=async(category,id)=>{
   await library(category);
   const collection=collectionFor(id);
   if(collection){const group=[...document.querySelectorAll('#library-groups button')].find(b=>b.textContent.trim()===collection);if(group){group.click();await pause(30);}}
   for(let page=0;page<80;page++){
     const card=document.querySelector(`[data-asset-id="${id}"]`);
     if(card){card.click();await idle();return card;}
     const next=document.querySelector('#library-pagination button[aria-label="下一页"]');
     if(!next||next.disabled)break;
     next.click();await pause(30);
   }
   check(false,'素材可选 '+id);return null;
 };
 const add=async(category,id)=>{await selectAsset(category,id);};
 await add('background','bg170-space-comic-01');
 await add('sticker','role0-1');
 await add('animation','animation-0');
 await closeLibrary();
 tool('move');
 await openOptions();
 let p=await project(),object=p.layers.at(-1),scale=object.scale;
 check(object.frames?.length>1,'放入会动的小伙伴');
 const objectControls=$('object-controls');check(objectControls&&!objectControls.hidden&&objectControls.getBoundingClientRect().height>0,'放入后直接显示大小按钮：hidden='+objectControls?.hidden+' tool='+$('painting').dataset.tool+' panel='+document.body.dataset.mobilePanel+' layers='+p.layers.length);
 $('object-bigger').click();await idle();p=await project();
 check(p.layers.at(-1).scale>scale&&p.layers.at(-1).frames.length===object.frames.length,'变大保持动画帧');
 $('undo').click();await idle();check((await project()).layers.at(-1).scale===scale,'大小调整可撤销');
 await closeLibrary();
 const panel=document.querySelector('.classic-colors'),panelHeight=panel.getBoundingClientRect().height;
 $('foreground-palette').click();document.querySelector('.preset-color[aria-label="苹果红"]').click();$('palette-apply').click();
 check($('foreground-palette').style.background==='rgb(239, 83, 80)','一键选儿童常用颜色');
 check(panel.getBoundingClientRect().height===panelHeight,'历史色不把左边面板越撑越高');
 $('foreground-palette').click();document.querySelector('.preset-color[aria-label="天空蓝"]').click();$('palette-cancel').click();
 check($('foreground-palette').style.background==='rgb(239, 83, 80)','取消选色保持原画笔色');
 tool('stamp');await pause(80);
 // The stamp tool opens the library sheet on compact screens. Its three
 // mode cards are the user-facing controls in the library drawer.
 await pause(120);const modes=[...document.querySelectorAll('#library-groups [data-fairy-mode]')];const group=document.querySelector('#library-groups');const chain=[];for(let n=group;n&&chain.length<4;n=n.parentElement){const r=n.getBoundingClientRect();chain.push(`${n.tagName}.${n.className||''}:${getComputedStyle(n).display}:${Math.round(r.width)}x${Math.round(r.height)}`);}check(modes.length===3&&modes.every(b=>{const r=b.getBoundingClientRect();return r.height>=40&&r.width>=100&&r.bottom>=0&&r.top<=innerHeight;}),'魔法袋三种玩法直接可见且按钮足够大：'+modes.map(b=>{const r=b.getBoundingClientRect();return [Math.round(r.width),Math.round(r.height),Math.round(r.bottom)]})+' tool='+$('painting').dataset.tool+' panel='+document.body.dataset.mobilePanel+' chain='+chain.join('|'));const dynamic=modes.find(b=>b.textContent.includes('会动图案'));check(dynamic,'会动图案入口缺失');dynamic.click();
 await selectAsset('fairy','girl-2-0');
 await closeLibrary();
 $('size').value=180;$('size').dispatchEvent(new Event('input'));
 const paperForStamp=$('painting'),r=paperForStamp.getBoundingClientRect(),capture=paperForStamp.setPointerCapture;paperForStamp.setPointerCapture=()=>{};
 for(let i=0;i<=8;i++)paperForStamp.dispatchEvent(new PointerEvent(i===0?'pointerdown':i===8?'pointerup':'pointermove',{bubbles:true,pointerId:87,pointerType:'mouse',button:0,buttons:i===8?0:1,clientX:r.x+r.width*(.30+i*.035),clientY:r.y+r.height*.74}));
 paperForStamp.setPointerCapture=capture;await idle();p=await project();const fairy=p.layers.find(l=>l.sprites?.length);
 check(fairy?.sprites.length>1,'按住拖动连续放入动态仙女袋');
 check(fairy.spriteGroups.every(g=>g.frames.length===8),'新版动态图案使用八个新关键帧');
 tool('move');const fairyScale=fairy.scale;$('object-bigger').click();await idle();check((await project()).layers.find(l=>l.id===fairy.id).scale>fairyScale,'动态仙女袋画好后可直接放大');
 tool('board-filter');$('board-filter-kind').value='waterfall';$('board-filter-kind').dispatchEvent(new Event('change',{bubbles:true}));$('creative-radius').value=600;
 $('filter-preview-button').click();await idle();check($('board-preview').closest('dialog').open,'组合画面可以预览瀑布');
 let ticks=0,maxGap=0,previous=performance.now();const heartbeat=setInterval(()=>{ticks++;maxGap=Math.max(maxGap,performance.now()-previous);previous=performance.now();},16),began=performance.now();
 $('board-apply').click();await idle();const filterMilliseconds=performance.now()-began;clearInterval(heartbeat);
 check(!document.querySelector('dialog[open]'),'确定滤镜后没有遗留模态窗口挡住点击');
 p=await project();const filtered=p.layers.find(l=>l.id===object.id);check(p.layers.find(l=>l.id===fairy.id)?.spriteGroups.every(g=>g.frames.length===8),'混合场景滤镜保留重绘仙女袋的每组动画');
 check(filtered?.frames?.length===object.frames.length,'背景和普通伙伴并存时，瀑布保留动画');
 const paper=$('painting');const first=paper.toDataURL();await pause(220);check(paper.toDataURL()!==first,'瀑布完成后屏幕动画仍在播放');
 tool('pen');check(paper.dataset.tool==='pen','滤镜后画笔按钮能继续使用');
 $('undo').click();await idle();$('redo').click();await idle();check((await project()).layers.find(l=>l.id===object.id)?.frames?.length===object.frames.length,'滤镜撤销重做仍保留动画');
 const beforeCancel=await project();tool('board-filter');$('filter-preview-button').click();await idle();$('board-apply').click();check(!$('effect-progress').hidden,'处理时提供可见取消入口');$('cancel-effect').click();await idle();const afterCancel=await project();check(afterCancel.layers.every((l,i)=>l.image===beforeCancel.layers[i].image),'取消滤镜后整幅原画保持不变');
 return {passed:true,checks,filterMilliseconds,heartbeatTicks:ticks,maxEventLoopGapMilliseconds:maxGap};
}catch(error){return {passed:false,checks,error:error.message,stack:error.stack};}
