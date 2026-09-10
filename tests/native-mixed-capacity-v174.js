const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
const check=(ok,name)=>checks.push({name,passed:!!ok});
const idle=async()=>{for(let i=0;i<1000&&document.body.hasAttribute('aria-busy');i++)await pause(20);await pause(40);};
try{
 const tool=id=>{if(!document.querySelector(`#tools [data-tool="${id}"]`))$('tool-page').click();document.querySelector(`#tools [data-tool="${id}"]`).click();};
 tool('stamp');document.querySelector('#library-groups [data-fairy-mode=dynamic]').click();
 const canvas=$('painting');canvas.setPointerCapture=()=>{};
 const send=(type,x,y)=>{const r=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:77,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:r.x+r.width*x,clientY:r.y+r.height*y}));};
 const expected=window.LUOYE_ASSETS.filter(a=>a.fairyMode==='dynamic').length;
 const used=new Set();let attempts=0;
 while(used.size<expected&&attempts++<50){
  const cards=[...document.querySelectorAll('#asset-grid .asset')];
  for(const card of cards){if(used.has(card.dataset.assetId))continue;card.click();await idle();$('size').value=160;$('size').dispatchEvent(new Event('input'));
   const n=used.size;send('pointerdown',.1+(n%8)*.1,.1+Math.floor(n/8)*.16);send('pointerup',.1+(n%8)*.1,.1+Math.floor(n/8)*.16);used.add(card.dataset.assetId);if(used.size>=expected)break;
  }
  if(used.size<expected){const next=$('library-pagination').querySelectorAll('button')[1];if(next.disabled)break;next.click();await pause(100);}
 }
 send('pointerleave',0,0);await pause(200);const before=canvas.toDataURL();await pause(240);check(before!==canvas.toDataURL(),'混合素材仍在播放动画');
 const snapshot=(await window.LUOYEFlushBeforeClose()).project;
 const sprites=snapshot.layers.reduce((n,l)=>n+(l.sprites?.length||0),0);
 check(used.size===expected&&sprites===expected,'所有内置动态魔法袋均能连续放入画板');
 check(snapshot.layers.filter(l=>l.sprites?.length).length===1,'相邻混合素材共用一个动画层');
 $('undo').click();await pause(100);check(window.LUOYEPerformance().sprites===expected-1,'撤销最后一个动态图案');$('redo').click();await pause(100);check(window.LUOYEPerformance().sprites===expected,'重做恢复动态图案');
 const transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(snapshot)],'mixed-v174.luoyex',{type:'application/json'}));$('file-input').files=transfer.files;$('file-input').dispatchEvent(new Event('change'));await idle();
 const reopened=(await window.LUOYEFlushBeforeClose()).project;
 check(reopened.layers.reduce((n,l)=>n+(l.sprites?.length||0),0)===expected,'混合动态图案可保存并重新打开');
 return {passed:checks.every(c=>c.passed),checks,used:used.size,sprites,metrics:window.LUOYEPerformance()};
}catch(error){return {passed:false,checks,failure:error.message,stack:error.stack};}
