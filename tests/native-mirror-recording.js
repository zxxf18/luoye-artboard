const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
const assert=(ok,name)=>{checks.push({name,passed:!!ok});if(!ok)throw Error(name);};
const idle=async()=>{await pause(25);for(let i=0;i<1500&&document.body.hasAttribute('aria-busy');i++)await pause(20);if(document.body.hasAttribute('aria-busy'))throw Error('操作超时');await pause(50);};
const click=async id=>{$(id).click();await idle();};
const tool=async id=>{if(!document.querySelector(`#tools [data-tool="${id}"]`))$('tool-page').click();document.querySelector(`#tools [data-tool="${id}"]`).click();await idle();};
const paper=$('painting');paper.setPointerCapture=()=>{};
async function stroke(x,y,endX=x,endY=y){const r=paper.getBoundingClientRect();for(const [type,px,py] of [['pointerdown',x,y],['pointermove',endX,endY],['pointerup',endX,endY]])paper.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:74,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:r.x+px*r.width,clientY:r.y+py*r.height}));await idle();}
const png=async()=>(await window.LUOYEFlushBeforeClose()).png;
try{
 document.querySelector('[data-brush=tube]').click();await stroke(.2,.2,.35,.3);await click('layer-menu');await click('mirror-x');await click('mirror-y');$('layer-dialog').querySelector('[data-close]').click();const mirrored=await png();
 await click('darkroom');[...$('darkroom-categories').children].find(b=>b.textContent==='色彩调节').click();$('effect-kind').value='brightness';$('effect-kind').dispatchEvent(new Event('change'));await click('apply-effect');assert(await png()===mirrored,'WKWebView 暗房保持已镜像画面方向');
 await tool('clone');await click('clone-source');await stroke(.72,.75);await click('recordings');await click('record-start');await stroke(.4,.6,.5,.6);const cloned=await png();await click('recordings');await click('record-stop');await click('record-last');assert($('record-preview').querySelector('canvas').toDataURL()===cloned,'WKWebView 仿制录像逐像素回放一致');await click('record-close');
 await tool('stamp');document.querySelector('#library-groups [data-fairy-mode=static]').click();$('asset-grid').children[0].click();await idle();await stroke(.4,.2);await click('recordings');await click('record-start');await stroke(.6,.2);const stamped=await png();await click('recordings');await click('record-stop');await click('record-last');assert($('record-preview').querySelector('canvas').toDataURL()===stamped,'WKWebView 组合魔法袋中途录像保持图案顺序');await click('record-close');
 return {passed:true,checks};
}catch(error){return {passed:false,checks,error:error.message};}
