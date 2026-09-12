const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
const check=(ok,name,detail)=>{checks.push({name,passed:!!ok,detail});if(!ok)throw Error(name);};
const wait=async()=>{for(let i=0;i<500&&document.body.hasAttribute('aria-busy');i++)await pause(20);await pause(50);};
const tool=id=>{const b=document.querySelector(`#tools [data-tool="${id}"]`);if(!b){$('tool-page').click();}document.querySelector(`#tools [data-tool="${id}"]`)?.click();};
try{
 const canvas=$('painting');
 for(const [id,cursor] of [['pen','crosshair'],['fill','cell'],['stamp','copy'],['magic','crosshair'],['move','grab'],['text','text']]){tool(id);await wait();check(getComputedStyle(canvas).cursor===cursor,id+' 工具显示对应画布光标',{cursor:getComputedStyle(canvas).cursor});}
 tool('pen');const brush=document.querySelector('[data-brush="spray"]');brush.click();await wait();check(canvas.dataset.brush==='spray','画笔类型同步到画布光标状态');check((getComputedStyle(canvas).userSelect==='none'||getComputedStyle(canvas).webkitUserSelect==='none'),'画布不可选中文字');check((getComputedStyle(document.body).userSelect==='none'||getComputedStyle(document.body).webkitUserSelect==='none'),'页面默认不可选中文字');
 $('palette-open').click();check($('palette-dialog').open,'调色板打开');check($('color-value').value==='100','调色板默认明度为100');$('color-rgb-array').value='[12, 34, 56]';$('color-rgb-array').dispatchEvent(new Event('change'));check($('color-red').value==='12'&&$('color-green').value==='34'&&$('color-blue').value==='56','RGB数组输入生效');$('palette-apply').click();await wait();
 $('music-open').click();check(!!$('ui-sounds'),'音乐控制提供工具音效开关');$('music-close').click();
 check(document.querySelectorAll('[data-asset-id^="bg-road-"]').length===0,'图库尚未打开');$('mode-library').click();await wait();document.querySelector('[data-category="background"]').click();await wait();[...document.querySelectorAll('#library-groups button')].find(b=>b.textContent.includes('道路'))?.click();await wait();check(document.querySelectorAll('[data-asset-id^="bg-road-"]').length>0,'道路背景素材已加入图库');$('mode-board').click();
 $('new-quick').click();await wait();check(canvas.width===1920&&canvas.height===1080&&$('title').value==='我的奇妙世界','快速新建沿用画纸尺寸并清空标题');
 tool('eraser');$('size').value=222;$('opacity').value=33;$('opacity').dispatchEvent(new Event('input'));$('reset-settings').click();await wait();check($('painting').dataset.tool==='pen'&&$('brush').value==='pencil'&&$('size').value==='14'&&$('opacity').value==='100'&&$('color').value==='#000000','重置恢复工具默认设置',{tool:$('painting').dataset.tool,brush:$('brush').value,size:$('size').value,opacity:$('opacity').value,color:$('color').value});
 return {passed:true,checks,viewport:{width:innerWidth,height:innerHeight}};
}catch(error){return {passed:false,checks,failure:error.message,stack:error.stack};}
