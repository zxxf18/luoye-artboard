const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
const idle=async()=>{for(let i=0;i<1500&&document.body.hasAttribute('aria-busy');i++)await pause(20);if(document.body.hasAttribute('aria-busy'))throw Error('暗房超时');await pause(35);};
try{
 $('new').click();await idle();$('preset').value='1080,1080';$('new-dialog').querySelector('[value=create]').click();await idle();
 const c=$('painting');c.setPointerCapture=()=>{};document.querySelector('[data-brush=tube]').click();const r=c.getBoundingClientRect();
 for(const [type,f] of [['pointerdown',.2],['pointermove',.8],['pointerup',.8]])c.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:73,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:r.x+r.width*f,clientY:r.y+r.height*f}));await idle();
 const before=c.toDataURL();
 for(const category of [...$('darkroom-categories').children]){
  $('darkroom').click();await idle();category.click();const values=[...$('effect-kind').options].map(o=>o.value);$('darkroom-dialog').close();
  for(const value of values){$('darkroom').click();await idle();category.click();$('effect-kind').value=value;$('effect-kind').dispatchEvent(new Event('change'));$('apply-effect').click();await idle();if($('darkroom-dialog').open)throw Error('暗房未应用 '+value);$('undo').click();await idle();if(c.toDataURL()!==before)throw Error('暗房撤销未恢复像素 '+value);checks.push({name:value,passed:true});}
 }
 return {passed:checks.length===32,checks};
}catch(error){return {passed:false,checks,error:error.message};}
