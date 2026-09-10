// Runs in the shipped WKWebView with an isolated document and storage.
const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
const check=(ok,name,detail)=>{checks.push({name,passed:!!ok,detail});if(!ok)throw Error(name);};
const visible=e=>!!e&&e.getClientRects().length>0;
const idle=async()=>{for(let i=0;i<600&&document.body.hasAttribute('aria-busy');i++)await pause(20);check(!document.body.hasAttribute('aria-busy'),'界面操作完成');await pause(60);};
const tool=id=>{if(!document.querySelector(`#tools [data-tool="${id}"]`))$('tool-page').click();document.querySelector(`#tools [data-tool="${id}"]`).click();};
const canvas=$('painting');canvas.setPointerCapture=()=>{};
const send=(type,x,y)=>{const r=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:76,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:r.x+x*r.width,clientY:r.y+y*r.height}));};
const stroke=(x,y,a,b)=>{send('pointerdown',x,y);send('pointermove',a,b);send('pointerup',a,b);};
const snapshot=()=>window.LUOYEFlushBeforeClose();
const pixels=async url=>{const img=new Image();img.src=url;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;c.getContext('2d').drawImage(img,0,0);return c;};
const pixel=(c,x,y)=>[...c.getContext('2d').getImageData(Math.round(x*c.width),Math.round(y*c.height),1,1).data];
const chooseBackground=async()=>{
 $('mode-library').click();document.querySelector('[data-category="background"]').click();await idle();
 const asset=document.querySelector('#asset-grid [data-asset-id]');check(!!asset,'图库有背景素材');asset.click();await idle();$('mode-board').click();
};
try{
 tool('select');document.querySelector('[data-selection-mode=intersect]').click();
 check(visible($('selection-combination'))&&visible($('selection-actions')),'圈选组合和操作保持展开');
 tool('magic');check(!visible($('selection-combination'))&&!visible($('selection-actions'))&&!visible($('selection-shape')),'魔力棒不残留圈选参数');
 check(visible($('tolerance')),'魔力棒显示自己的公差');stroke(.5,.5,.5,.5);await idle();check(visible($('selection-reset')),'魔力棒不继承隐藏的只留重叠模式，能够正常选色');
 tool('select');check($('selection-mode').value==='intersect','圈选自身组合设置保留');
 $('mode-library').click();check(!document.querySelector('.library-close'),'图库彻底移除收起素材按钮');$('mode-board').click();check(!document.body.classList.contains('library-open'),'画板按钮可以退出图库');
 tool('stamp');check(!document.querySelector('.library-close'),'魔法袋同样没有收起按钮');tool('pen');
 await chooseBackground();const original=await snapshot(),background=original.project.layers.find(l=>l.role==='background');check(!!background,'实际图库背景已加入工程');
 // Choose a nonwhite background pixel for all three eraser modes.
 const before=await pixels(original.png);let point;
 for(const x of [.3,.4,.5,.6,.7])for(const y of [.3,.4,.5,.6,.7])if(pixel(before,x,y).slice(0,3).some(v=>v<230))point={x,y};
 check(!!point,'测试位置有背景颜色');const {x,y}=point,initial=pixel(before,x,y);
 for(const mode of ['hard','soft','rect']){
  tool('eraser');$('eraser-mode').value=mode;$('eraser-mode').dispatchEvent(new Event('change'));$('opacity').value=100;$('opacity').dispatchEvent(new Event('input'));$('size').value=120;$('size').dispatchEvent(new Event('input'));
  if(mode==='rect')stroke(x-.04,y-.04,x+.04,y+.04);else{send('pointerdown',x,y);for(let i=0;i<(mode==='soft'?12:1);i++)send('pointermove',x,y);send('pointerup',x,y);}await idle();
  const erased=await snapshot(),layer=erased.project.layers.find(l=>l.role==='background');check(!!layer.eraseMask,mode+' 为图库背景保存擦除蒙版');
  const result=pixel(await pixels(erased.png),x,y);check(result.slice(0,3).reduce((a,b)=>a+b,0)>initial.slice(0,3).reduce((a,b)=>a+b,0),mode+' 确实擦淡背景像素',{initial,result});
  if(mode!=='soft')check(result.slice(0,3).every(v=>v===255),mode+' 擦干净后露出白色画纸');
  $('undo').click();await idle();check((await snapshot()).png===original.png,mode+' 撤销恢复原图逐像素一致');
  $('redo').click();await idle();check((await snapshot()).png===erased.png,mode+' 重做恢复擦除逐像素一致');
  if(mode!=='rect'){$('undo').click();await idle();}
 }
 const erased=await snapshot(),transfer=new DataTransfer();transfer.items.add(new File([JSON.stringify(erased.project)],'background-eraser.luoyex',{type:'application/json'}));$('file-input').files=transfer.files;$('file-input').dispatchEvent(new Event('change'));await idle();
 check((await snapshot()).png===erased.png,'擦除背景保存重开逐像素一致');
 await chooseBackground();const replaced=await snapshot();check(!replaced.project.layers.find(l=>l.role==='background').eraseMask,'重新选背景不继承擦除蒙版');check(replaced.png===original.png,'换回同一背景完整恢复');
 $('undo').click();await idle();check((await snapshot()).png===erased.png,'撤销换背景恢复原来的擦除状态');
 tool('pen');document.querySelector('[data-brush=tube]').click();stroke(x-.02,y,x+.02,y);await idle();check((await snapshot()).png!==erased.png,'擦除位置可以重新绘画');
 tool('magic');
 return {passed:true,checks,viewport:{width:innerWidth,height:innerHeight}};
}catch(error){return {passed:false,checks,failure:error.message,stack:error.stack};}
