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
for(let stroke=0;stroke<30;stroke++){
 const start=performance.now(),before=draws;send('pointerdown',.1,.15);
 for(let i=1;i<=40;i++){const row=Math.floor(i/10),fraction=(i%10)/9;send('pointermove',.1+.8*(row%2?1-fraction:fraction),.15+row*.13);}
 send('pointerup',.1,.67);durations.push(performance.now()-start);counts.push(draws-before);await pause(35);
}
await pause(150);const first=canvas.toDataURL();await pause(200);const animates=first!==canvas.toDataURL();

const checks=[],check=(ok,name)=>{checks.push({passed:!!ok,name});if(!ok)throw Error(name);};
const snapshot=async()=>(await window.LUOYEFlushBeforeClose()).project;
const spriteCount=p=>p.layers.reduce((n,l)=>n+(l.sprites?.length||0),0);
const full=await snapshot();check(spriteCount(full)===2880,'30 strokes retain all 2880 stamps');check(full.layers.filter(l=>l.sprites).length===1,'2880 stamps share a layer below the 10000 rollover');
$('undo').click();await pause(50);check(spriteCount(await snapshot())===2784,'undo removes only last stroke');
$('redo').click();await pause(50);check(spriteCount(await snapshot())===2880,'redo restores last stroke');
send('pointerdown',.2,.2);send('pointermove',.5,.3);send('pointercancel',.5,.3);await pause(50);check(spriteCount(await snapshot())===2880,'cancelled stroke leaves no stamps');
tool('eraser');$('eraser-mode').value='rect';$('eraser-mode').dispatchEvent(new Event('change'));
send('pointerdown',.3,.3);send('pointermove',.4,.4);send('pointerup',.4,.4);await pause(150);
check((await snapshot()).layers.some(l=>l.eraseMask),'erase preserves animation using masks');
let allocations=0;const create=document.createElement;document.createElement=function(name,...args){if(name==='canvas')allocations++;return create.call(this,name,...args);};
const metricsBefore=window.LUOYEPerformance();await pause(500);const maskedIdle={allocations,frames:window.LUOYEPerformance().frames-metricsBefore.frames};document.createElement=create;
check(maskedIdle.frames>0&&maskedIdle.allocations===0,'masked animation reuses canvases between frames');

tool('pen');send('pointerdown',.05,.92);send('pointermove',.9,.92);send('pointerup',.9,.92);await pause(50);
$('stroke-mode').value='line';$('stroke-mode').dispatchEvent(new Event('change'));
send('pointerdown',.1,.85);send('pointermove',.4,.9);await pause(80);
allocations=0;document.createElement=function(name,...args){if(name==='canvas')allocations++;return create.call(this,name,...args);};
for(let i=0;i<10;i++){send('pointermove',.4+i*.025,.85);await pause(20);}
document.createElement=create;check(allocations===0,'line preview reuses buffers throughout drag');send('pointerup',.7,.85);await pause(50);
const serialized=await snapshot(),transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(serialized)],'performance.luoyex',{type:'application/json'}));$('file-input').files=transfer.files;$('file-input').dispatchEvent(new Event('change'));await idle();
check(spriteCount(await snapshot())===spriteCount(serialized),'saved large animated project reopens with all remaining stamps');
const serializeStart=performance.now(),project=(await window.LUOYEFlushBeforeClose()).project,serializationMs=performance.now()-serializeStart;
clearInterval(heartbeat);CanvasRenderingContext2D.prototype.drawImage=original;
const result={checks,maskedIdle,metrics:window.LUOYEPerformance(),strokeMs:durations,drawCallsPerStroke:counts,maxEventLoopGapMs:maxGap,serializationMs,layerCount:project.layers.length,sprites:project.layers.reduce((n,l)=>n+(l.sprites?.length||0),0),animates,penAvailable:!project.layers.at(-1).sprites,notice:$('tool-hint').textContent};
setInterval(()=>{if($('close-dialog').open)document.querySelector('#close-dialog [value=discard]').click();},100);
return result;
