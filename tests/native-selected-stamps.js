const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms));
const idle=async()=>{for(let n=0;n<600&&document.body.hasAttribute('aria-busy');n++)await pause(20);};
const tool=id=>{if(!document.querySelector('#tools [data-tool="'+id+'"]'))$('tool-page').click();document.querySelector('#tools [data-tool="'+id+'"]').click();};
tool('stamp');$('asset-grid').children[0].click();await idle();$('select-all').click();await idle();
$('size').value=64;$('size').dispatchEvent(new Event('input'));
const canvas=$('painting'),r=canvas.getBoundingClientRect();canvas.setPointerCapture=()=>{};
const send=(type,x,y)=>canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:91,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:r.x+x*r.width,clientY:r.y+y*r.height}));
const original=CanvasRenderingContext2D.prototype.getImageData;let readPixels=0;
CanvasRenderingContext2D.prototype.getImageData=function(x,y,w,h,...args){readPixels+=w*h;return original.call(this,x,y,w,h,...args);};
const strokeMs=[],pixels=[];
for(let n=0;n<3;n++){
 const start=performance.now(),before=readPixels;send('pointerdown',.05,.1);
 for(let i=0;i<80;i++){const row=Math.floor(i/20),t=i%20/19;send('pointermove',.05+.9*(row%2?1-t:t),.1+row*.25);}
 send('pointerup',.05,.85);strokeMs.push(performance.now()-start);pixels.push(readPixels-before);await pause(100);
}
CanvasRenderingContext2D.prototype.getImageData=original;
tool('pen');$('stroke-mode').value='line';$('stroke-mode').dispatchEvent(new Event('change'));
send('pointerdown',.1,.5);send('pointermove',.5,.5);await pause(80);
const create=document.createElement;let previewCanvases=0;
document.createElement=function(name,...args){if(name==='canvas')previewCanvases++;return create.call(this,name,...args);};
for(let n=0;n<8;n++){send('pointermove',.5+n*.02,.5);await pause(30);}
document.createElement=create;send('pointerup',.7,.5);
return {passed:previewCanvases===0,strokeMs,readPixelsPerStroke:pixels,previewCanvases,metrics:window.LUOYEPerformance()};
