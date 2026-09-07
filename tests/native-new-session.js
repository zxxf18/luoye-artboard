const wait=ms=>new Promise(r=>setTimeout(r,ms));
function assert(ok,message){if(!ok)throw Error(message);}
const marker='luoye-startup-preservation-test';
if(!localStorage.getItem(marker)){
 const canvas=document.getElementById('painting'),r=canvas.getBoundingClientRect();canvas.setPointerCapture=()=>{};
 for(const [type,x] of [['pointerdown',.25],['pointermove',.55],['pointerup',.6]])canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:1,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:r.x+r.width*x,clientY:r.y+r.height*.4}));
 document.getElementById('title').value='必须留下的旧画';await window.LUOYEFlushBeforeClose();
 localStorage.setItem(marker,'seeded');return {reloadForTest:true};
}
assert(!document.querySelector('#recover-dialog[open]'),'Unexpected restore prompt');
const current=await window.LUOYEFlushBeforeClose();assert(current.project.title!=='必须留下的旧画','Old work opened instead of a blank sheet');
const canvas=document.getElementById('painting'),ctx=canvas.getContext('2d'),pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
let colored=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]<230||pixels[i+1]<230||pixels[i+2]<230)colored++;
assert(colored===0,'New session canvas is not blank');
const items=await new Promise((resolve,reject)=>{const request=indexedDB.open('luoye-studio',2);request.onsuccess=()=>{const db=request.result,r=db.transaction('gallery').objectStore('gallery').getAll();r.onsuccess=()=>{db.close();resolve(r.result);};r.onerror=()=>reject(r.error);};request.onerror=()=>reject(request.error);});
assert(items.some(x=>x.project.title==='必须留下的旧画'),'Old draft lost while starting a blank sheet');
return {blankPixels:colored,oldDraftPreserved:true,galleryEntries:items.length};
