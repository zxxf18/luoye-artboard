const checks=[];try{
 const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const check=(ok,name)=>{checks.push({name,passed:!!ok});if(!ok)throw new Error(name);};
 const idle=async()=>{for(let i=0;i<200&&document.body.hasAttribute('aria-busy');i++)await pause(30);await pause(80);};
 const tool=id=>{if(!document.querySelector(`#tools [data-tool="${id}"]`))$('tool-page').click();document.querySelector(`#tools [data-tool="${id}"]`).click();};
 const paper=$('painting'),capture=paper.setPointerCapture;paper.setPointerCapture=()=>{};
 const stroke=(fx,fy,tx,ty)=>{const r=paper.getBoundingClientRect();for(let i=0;i<=12;i++){const end=i===12;paper.dispatchEvent(new PointerEvent(i===0?'pointerdown':end?'pointerup':'pointermove',{bubbles:true,pointerId:97,pointerType:'mouse',button:0,buttons:end?0:1,clientX:r.x+r.width*(fx+(tx-fx)*i/12),clientY:r.y+r.height*(fy+(ty-fy)*i/12)}));}};
 const pixels=()=>Array.from(paper.getContext('2d').getImageData(Math.floor(paper.width*.3),Math.floor(paper.height*.42),Math.floor(paper.width*.25),Math.floor(paper.height*.16)).data);
 const changed=(a,b)=>a.some((v,i)=>v!==b[i]);
 for(const mode of ['hard','soft','rect']){
  tool('pen');document.querySelector('[data-brush="marker"]').click();document.querySelector('[data-color="#d9715f"]').click();$('size').value=110;$('size').dispatchEvent(new Event('input'));stroke(.32,.5,.52,.5);await idle();const painted=pixels();
  tool('eraser');$('eraser-mode').value=mode;$('eraser-mode').dispatchEvent(new Event('change',{bubbles:true}));$('size').value=140;$('size').dispatchEvent(new Event('input'));
  if(mode==='rect')stroke(.3,.42,.55,.58);else stroke(.32,.5,.52,.5);await idle();const erased=pixels();check(changed(painted,erased),mode+' 橡皮在屏幕上擦除了笔迹');
  document.querySelector('[data-brush="crayon"]')?.click();tool('pen');document.querySelector('[data-brush="tube"]').click();document.querySelector('[data-color="#285b49"]').click();stroke(.33,.5,.50,.5);await idle();check(changed(erased,pixels()),mode+' 擦过的位置能重新画');
  if(!document.body.classList.contains('library-open'))$('mode-library').click();document.querySelector('[data-category="background"]').click();[...document.querySelectorAll('#library-groups button')].find(b=>b.textContent==='太空').click();document.querySelector('[data-asset-id="'+(mode==='soft'?'bg170-space-oil-01':'bg170-space-comic-01')+'"]').click();await idle();
  const project=(await window.LUOYEFlushBeforeClose()).project;check(project.layers.filter(l=>l.role==='background').length===1,mode+' 擦过之后切换背景不堆叠旧背景');
  const corner=paper.getContext('2d').getImageData(5,5,1,1).data;check(corner[0]<250||corner[1]<250||corner[2]<250,mode+' 新背景在屏幕上铺满而非白板');
 }
 tool('select');stroke(.1,.1,.2,.2);await idle();check(!$('selection-reset').hidden,'选区限制有明显提示');$('selection-reset').click();check($('selection-reset').hidden,'一键取消圈选后整张画纸可画');
 $('layer-menu').click();await idle();const rows=[...document.querySelectorAll('.layer-name')];rows.at(-1).click();await idle();check($('layer-up').disabled&&$('layer-down').disabled,'背景不会误移到前面挡住画');
 rows[0].click();$('duplicate-layer').click();await idle();const duplicated=(await window.LUOYEFlushBeforeClose()).project.layers.length;$('delete-layer').click();await idle();check((await window.LUOYEFlushBeforeClose()).project.layers.length===duplicated-1,'卡片复制和移走生效');$('undo').click();await idle();check((await window.LUOYEFlushBeforeClose()).project.layers.length===duplicated,'移走卡片可以撤销找回');
 $('layer-dialog').querySelector('[data-close]').click();
 if(!document.body.classList.contains('library-open'))$('mode-library').click();document.querySelector('[data-category="sticker"]').click();document.querySelector('[data-asset-id="role0-1"]').click();await idle();
 let movedProject=(await window.LUOYEFlushBeforeClose()).project;const elephant=movedProject.layers.at(-1);tool('move');stroke(.5,.5,.65,.6);await idle();
 movedProject=(await window.LUOYEFlushBeforeClose()).project;const moved=movedProject.layers.find(l=>l.id===elephant.id);check(moved.x>elephant.x+100&&moved.y>elephant.y,'直接点中小象移动，透明画纸不挡住选择');
 const background=movedProject.layers.find(l=>l.role==='background');stroke(.01,.01,.1,.1);await idle();const still=(await window.LUOYEFlushBeforeClose()).project.layers.find(l=>l.id===background.id);check(still.x===background.x&&still.y===background.y,'点空白区域不会把背景拖走');
 tool('pen');paper.setPointerCapture=capture;await pause(80);return {passed:true,checks};
}catch(error){return {passed:false,checks,failure:error.message,stack:error.stack};}
