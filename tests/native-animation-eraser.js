const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
const check=(ok,name)=>{checks.push({name,passed:!!ok});if(!ok)throw Error(name);};
const idle=async()=>{for(let i=0;i<500&&document.body.hasAttribute('aria-busy');i++)await pause(20);await pause(50);};
const tool=id=>{if(!document.querySelector('#tools [data-tool="'+id+'"]'))$('tool-page').click();document.querySelector('#tools [data-tool="'+id+'"]').click();};
const canvas=$('painting'),r=canvas.getBoundingClientRect();canvas.setPointerCapture=()=>{};
const send=(type,x,y)=>{const r=canvas.getBoundingClientRect();return canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:93,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:r.x+x*r.width,clientY:r.y+y*r.height}));};
const area=(x,width)=>{const d=canvas.getContext('2d').getImageData(Math.round(canvas.width*x),Math.round(canvas.height*.42),Math.round(canvas.width*width),Math.round(canvas.height*.16)).data;let darkness=0;for(let i=0;i<d.length;i+=4)darkness+=765-d[i]-d[i+1]-d[i+2];return darkness;};
const peak=async(x,width)=>{let value=0;for(let i=0;i<12;i++){await pause(110);value=Math.max(value,area(x,width));}return value;};
try{
 tool('stamp');document.querySelector('[data-fairy-mode="dynamic"]').click();document.querySelector('[data-asset-id="girl-2-1"]').click();await idle();$('size').value=200;$('size').dispatchEvent(new Event('input'));
 for(const x of [.3,.7]){send('pointerdown',x,.5);send('pointerup',x,.5);}await pause(300);
 const original=await peak(.245,.11);check(original>1000,'动态图案有实际可见像素');
 tool('eraser');$('eraser-mode').value='rect';$('eraser-mode').dispatchEvent(new Event('change'));
 send('pointerdown',.28,.35);send('pointermove',.32,.65);send('pointerup',.32,.65);
 check(await peak(.285,.03)===0,'部分矩形擦除在所有动画帧保持空白');check(await peak(.65,.1)>1000,'旁边动态图案不受影响');
 $('undo').click();await idle();check(await peak(.245,.11)>original*.9,'撤销部分擦除恢复像素');$('redo').click();await idle();check(await peak(.285,.03)===0,'重做部分擦除仍保持空白');$('undo').click();await idle();
 $('eraser-mode').value='soft';$('eraser-mode').dispatchEvent(new Event('change'));$('size').value=300;$('size').dispatchEvent(new Event('input'));
 send('pointerdown',.3,.5);for(let i=0;i<25;i++)send('pointermove',.3,.5);send('pointerup',.3,.5);
 check(await peak(.245,.11)<original*.5,'软橡皮使动态图案实际像素变淡');$('undo').click();await idle();check(await peak(.245,.11)>original*.9,'撤销软橡皮恢复动画');
 $('eraser-mode').value='hard';$('eraser-mode').dispatchEvent(new Event('change'));send('pointerdown',.3,.4);send('pointermove',.3,.6);send('pointerup',.3,.6);
 check(await peak(.245,.11)===0,'硬橡皮擦除所有动画帧');
 tool('pen');document.querySelector('[data-brush="tube"]').click();send('pointerdown',.27,.5);send('pointermove',.33,.5);send('pointerup',.33,.5);await pause(150);check(area(.245,.11)>1000,'擦掉动态图案的位置可以重新画');
 const savedPen=area(.245,.11);tool('eraser');$('clear-animations').click();await idle();check(window.LUOYEPerformance().sprites===0&&area(.245,.11)===savedPen,'一键清除动图保留画笔');$('undo').click();await idle();check(window.LUOYEPerformance().sprites===2,'一键清除可撤销');$('redo').click();await idle();check(window.LUOYEPerformance().sprites===0,'一键清除可重做');
 return {passed:true,checks};
}catch(error){return {passed:false,checks,error:error.message,remaining:area(.285,.03)};}
