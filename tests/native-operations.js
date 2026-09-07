const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
const check=(ok,name)=>{checks.push({name,passed:!!ok});if(!ok)throw Error(name);};
const idle=async()=>{for(let i=0;i<1200&&document.body.hasAttribute('aria-busy');i++)await pause(20);check(!document.body.hasAttribute('aria-busy'),'操作恢复响应');await pause(60);};
const tool=id=>{if(!document.querySelector('#tools [data-tool="'+id+'"]'))$('tool-page').click();document.querySelector('#tools [data-tool="'+id+'"]').click();};
const canvas=$('painting');canvas.setPointerCapture=()=>{};
const send=(type,x,y)=>{const r=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:71,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:r.x+x*r.width,clientY:r.y+y*r.height}));};
const stroke=()=>{send('pointerdown',.25,.3);send('pointermove',.65,.65);send('pointerup',.65,.65);};
const picture=()=>canvas.toDataURL();
try{
 for(const option of [...$('geometry').options]){
  $('geometry').value=option.value;$('geometry').dispatchEvent(new Event('change'));await pause(50);const before=picture();
  if(['polygon','bezier'].includes(option.value)){for(const [x,y] of [[.2,.2],[.65,.2],[.65,.65],[.2,.65]]){send('pointerdown',x,y);send('pointerup',x,y);}canvas.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));}else stroke();
  await idle();check(picture()!==before,'几何实际作画 '+option.value);$('undo').click();await idle();check(picture()===before,'几何撤销 '+option.value);
 }
 tool('fill');for(const option of [...$('fill-mode').options]){$('fill-mode').value=option.value;$('fill-mode').dispatchEvent(new Event('change'));const before=picture();stroke();await idle();check(picture()!==before,'油漆桶实际填色 '+option.value);$('undo').click();await idle();}
 tool('pen');document.querySelector('[data-brush="tube"]').click();stroke();await idle();
 $('select-all').click();await idle();$('copy').click();await idle();const count=window.LUOYEPerformance().layers;$('paste').click();await idle();check(window.LUOYEPerformance().layers===count+1,'圈选复制粘贴');$('undo').click();$('select-none').click();await idle();
 for(const kind of ['ifs','mandel','julia','norton']){
  tool('fractal');$('fractal-open').click();$('fractal-kind').value=kind;$('fractal-kind').dispatchEvent(new Event('change'));$('fractal-width').value=320;$('fractal-height').value=240;await pause(200);const count=window.LUOYEPerformance().layers;$('fractal-add').click();await idle();check(window.LUOYEPerformance().layers===count+1,'分形生成并放入 '+kind);$('undo').click();await idle();
 }
 tool('warp');const beforeWarp=picture();stroke();await idle();check(picture()!==beforeWarp,'变形工具实际修改画面');$('undo').click();await idle();
 tool('stamp');document.querySelector('[data-fairy-mode=dynamic]').click();document.querySelector('[data-asset-id="girl-2-1"]').click();await idle();stroke();await idle();tool('pen');$('recordings').click();await idle();$('record-start').click();await idle();stroke();await idle();tool('eraser');$('clear-animations').click();await idle();$('recordings').click();await idle();$('record-stop').click();await idle();check(Number($('record-position').max)>0,'录像记录绘画操作');$('record-last').click();await idle();check($('record-preview').querySelector('canvas').toDataURL().length>100,'录像可以回放');$('record-close').click();
 return {passed:true,checks};
}catch(error){return {passed:false,checks,error:error.message};}
