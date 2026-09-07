const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms));
const idle=async()=>{for(let n=0;n<600&&document.body.hasAttribute('aria-busy');n++)await pause(20);};
const tool=id=>{if(!document.querySelector('#tools [data-tool="'+id+'"]'))$('tool-page').click();document.querySelector('#tools [data-tool="'+id+'"]').click();};
tool('stamp');document.querySelector('#library-groups [data-fairy-mode=dynamic]').click();document.querySelector('[data-asset-id="girl-2-1"]').click();await idle();
$('size').value=100;$('size').dispatchEvent(new Event('input'));
const canvas=$('painting'),r=canvas.getBoundingClientRect();canvas.setPointerCapture=()=>{};
const original=CanvasRenderingContext2D.prototype.drawImage;let draws=0;
CanvasRenderingContext2D.prototype.drawImage=function(...args){draws++;return original.apply(this,args);};
const send=(type,x,y)=>canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:91,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:r.x+x*r.width,clientY:r.y+y*r.height}));
const durations=[],counts=[];let maxGap=0,last=performance.now();const heartbeat=setInterval(()=>{const now=performance.now();maxGap=Math.max(maxGap,now-last);last=now;},16);
for(let stroke=0;stroke<150;stroke++){
 const start=performance.now(),before=draws;send('pointerdown',.1,.15);
 for(let i=1;i<=40;i++){const row=Math.floor(i/10),fraction=(i%10)/9;send('pointermove',.1+.8*(row%2?1-fraction:fraction),.15+row*.13);}
 send('pointerup',.1,.67);durations.push(performance.now()-start);counts.push(draws-before);await pause(35);
}
await pause(150);const first=canvas.toDataURL();await pause(200);const animates=first!==canvas.toDataURL();
const placed=window.LUOYEPerformance?.().sprites;const renderSamples=[];for(let i=0;i<12;i++){await pause(100);const t=performance.now();canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);renderSamples.push(performance.now()-t);}
tool('eraser');$('eraser-mode').value='rect';$('eraser-mode').dispatchEvent(new Event('change'));send('pointerdown',0,0);send('pointermove',1,1);send('pointerup',1,1);await pause(250);
const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;let colored=0;for(let i=0;i<data.length;i+=4)if(data[i]<250||data[i+1]<250||data[i+2]<250)colored++;
const project=(await window.LUOYEFlushBeforeClose()).project;
clearInterval(heartbeat);CanvasRenderingContext2D.prototype.drawImage=original;
setInterval(()=>{if($('close-dialog').open)document.querySelector('#close-dialog [value=discard]').click();},100);
return {passed:placed===14400&&colored===0&&project.layers.every(l=>!l.sprites?.length),placed,renderSamples,sprites:project.layers.reduce((n,l)=>n+(l.sprites?.length||0),0),coloredPixelsAfterErase:colored,notice:$('tool-hint').textContent,maxGap};
