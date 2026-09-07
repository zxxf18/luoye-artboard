try{
 const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
 const check=(v,name)=>{checks.push({name,passed:!!v});if(!v)throw Error(name);};
 const visible=e=>e.getClientRects().length>0,box=e=>e.getBoundingClientRect();
 const paper=box($('viewport')),dock=box(document.querySelector('.tool-dock'));
 $('mode-library').click();await pause(60);
 document.querySelector('[data-category=background]').click();await pause(60);
 document.querySelector('[data-tool=stamp]').click();await pause(60);
 check($('library-groups').querySelectorAll('[data-fairy-mode]').length===3,'魔法袋左侧有三个原版分类');
 document.querySelector('#library-groups [data-fairy-mode=dynamic]').click();await pause(60);
 check([...$('asset-grid').children].every(e=>e.dataset.assetId.startsWith('girl-2-')),'会动图案只展示动态组合');
 check([...$('categories').children].filter(visible).length===1,'魔法袋不混用图库导航');
 check(Math.abs(box($('viewport')).height-paper.height)<1,'开关素材不压缩画纸');
 $('mode-library').click();await pause(60);
 check(document.querySelector('[data-category=background]').getAttribute('aria-pressed')==='true','图库恢复自己的背景分类');
 $('mode-board').click();await pause(60);
 $('layer-menu').click();await pause(60);
 check($('move-selected-layer').textContent==='移动','图层移动短标签');
 for(const b of document.querySelectorAll('.layer-actions button'))check(b.scrollWidth<=b.clientWidth+1,'图层按钮无溢出 '+b.id);
 $('layer-dialog').close();
 for(const page of [0,1]){
  if(($('tool-page').textContent.includes('1 / 2')?0:1)!==page)$('tool-page').click();
  const ids=[...$('tools').children].map(e=>e.dataset.tool);
  for(const id of ids){
   document.querySelector('[data-tool="'+id+'"]').click();await pause(30);
   const root=document.querySelector('.classic-parameters'),r=box(root);
   for(const b of root.querySelectorAll('button')){
    if(!visible(b))continue;
    const q=box(b),scroll=b.closest('.primary-brush-options');
    check(q.height>=40&&q.top>=r.top-1&&q.bottom<=r.bottom+1,'底栏按钮完整 '+id+' '+b.id);
    if(!scroll)check(q.left>=r.left-1&&q.right<=r.right+1,'底栏按钮横向完整 '+id+' '+b.id);
   }
  }
 }
 document.querySelector('[data-brush=pencil]').click();
 return {passed:true,checks,viewport:[innerWidth,innerHeight],dock:dock.height,paper:paper.height};
}catch(e){return {passed:false,error:e.message,stack:e.stack};}
