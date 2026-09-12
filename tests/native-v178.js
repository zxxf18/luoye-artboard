const $=id=>document.getElementById(id), pause=ms=>new Promise(r=>setTimeout(r,ms)), checks=[];
const check=(ok,name,detail)=>{checks.push({name,passed:!!ok,detail});if(!ok)throw Error(name);};
const idle=async()=>{for(let i=0;i<1000&&document.body.hasAttribute('aria-busy');i++)await pause(20);check(!document.body.hasAttribute('aria-busy'),'界面操作完成');await pause(80);};
const canvas=$('painting');canvas.setPointerCapture=()=>{};
const stroke=()=>{for(const [type,x,y] of [['pointerdown',.2,.3],['pointermove',.8,.7],['pointerup',.8,.7]]){const r=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:82,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:r.x+x*r.width,clientY:r.y+y*r.height}));}};
const snapshot=()=>window.LUOYEFlushBeforeClose();
try{
 const blank=await snapshot();stroke();await idle();check((await snapshot()).png!==blank.png,'先画出真实笔迹');
 $('new-quick').click();await idle();check((await snapshot()).png===blank.png,'顶部新画纸清除实际笔迹');
 const button=$('new-quick'),r=button.getBoundingClientRect();check(r.width>=44&&r.left>=0&&r.right<=innerWidth,'顶部新画纸可见且完整',{left:r.left,right:r.right,width:innerWidth});
 check(button.textContent.trim()==='新画纸','顶部入口明确标注新画纸');
 $('mode-library').click();document.querySelector('[data-category="background"]').click();await idle();document.querySelector('#asset-grid [data-asset-id]').click();await idle();$('mode-board').click();stroke();await idle();
 check((await snapshot()).project.layers.length>1,'已有背景与笔迹');
 $('new').click();await idle();check(!$('new-dialog').open,'左侧新画纸也直接新建，不弹选项');
 const fresh=await snapshot();check(fresh.png===blank.png&&fresh.project.layers.length===1,'新画纸清除背景与所有旧图层');
 check($('undo').disabled,'新画纸没有残留旧文档撤销记录');
 check($('reset-settings').innerHTML!==$('undo').innerHTML&&$('reset-settings').querySelector('[data-reset-symbol]'),'重置使用独立滑杆图标');
 $('paper-size-open').click();$('preset').value='1080,1080';$('new-dialog').querySelector('[value=create]').click();await idle();
 check(canvas.width===1080&&canvas.height===1080,'可从工具箱选择画纸尺寸');stroke();await idle();$('new-quick').click();await idle();
 check(canvas.width===1080&&canvas.height===1080&&(await snapshot()).project.layers.length===1,'快速新建沿用上次的非默认尺寸');
 return {passed:true,checks};
}catch(error){return {passed:false,checks,failure:error.message,stack:error.stack};}
