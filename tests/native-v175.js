const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
const check=(ok,name,detail)=>{checks.push({name,passed:!!ok,detail});if(!ok)throw Error(name);};
const visible=e=>!!e&&e.getClientRects().length>0;
const inside=(e,parent)=>{const a=e.getBoundingClientRect(),b=parent.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1&&a.top>=b.top-1&&a.bottom<=b.bottom+1;};
const tool=async id=>{for(let i=0;i<600&&document.body.hasAttribute('aria-busy');i++)await pause(20);check(!document.body.hasAttribute('aria-busy'),'切工具前等待界面操作完成');if(!document.querySelector(`#tools [data-tool="${id}"]`))$('tool-page').click();document.querySelector(`#tools [data-tool="${id}"]`).click();};
const canvas=$('painting');canvas.setPointerCapture=()=>{};
const send=(type,x,y)=>{const r=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:78,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:r.x+x*r.width,clientY:r.y+y*r.height}));};
const stroke=(x,y,a,b)=>{send('pointerdown',x,y);send('pointermove',a,b);send('pointerup',a,b);};
const png=async()=>(await window.LUOYEFlushBeforeClose()).png;
try{
 check(!$('all-brushes-open')&&!$('all-brushes-dialog'),'移除展开画笔盒按钮和弹窗');
 const pens=document.querySelector('.brush-box'),cards=[...pens.querySelectorAll('.brush-card')];check(cards.length===9,'保留九支画笔');
 for(const card of cards){card.scrollIntoView({block:'nearest'});check(inside(card,pens),'画笔可在原笔盒滚动访问 '+card.dataset.brush);}pens.scrollTop=0;
 check(document.querySelector('.swatch[aria-pressed=true]')?.dataset.color==='#000000','默认黑色在颜色栏明确选中');
 // A fresh shape does not inherit a transparent brush/eraser setting.
 await tool('eraser');$('opacity').value=0;$('opacity').dispatchEvent(new Event('input'));await tool('line');
 check($('opacity').value==='100'&&Number($('size').value)>0,'第一次进入图形有可见的默认参数');
 const empty=await png();stroke(.1,.2,.8,.2);await pause(100);check(await png()!==empty,'不打开调色板也能直接画默认直线');
 $('shape-filled').checked=true;$('geometry').value='rect';$('geometry').dispatchEvent(new Event('change'));const beforeRect=await png();stroke(.35,.35,.6,.6);await pause(100);check(await png()!==beforeRect,'不重新选颜色即可画实心矩形');
 $('opacity').value=65;await tool('pen');await tool('line');check($('opacity').value==='65','图形自己的不透明度设置保留');
 await tool('pen');$('paint-color-open').click();check($('palette-dialog').open,'色彩仍直接打开调色板');check($('paint-source-choose').textContent.includes('不使用纹理'),'纹理关闭状态名称明确');$('palette-cancel').click();
 await tool('stamp');check(!visible(document.querySelector('.library-close')),'魔法袋中没有收起素材按钮');await tool('pen');$('mode-library').click();check(!document.querySelector('.library-close'),'普通图库也移除收起素材按钮');$('mode-board').click();await pause(80);
 await tool('select');check(!visible($('selection-mode-choose')),'圈选组合不再弹窗选择');
 const buttons=[...document.querySelectorAll('#selection-combination button')];check(buttons.length===4&&buttons.every(visible),'四种圈选组合直接展开');
 document.querySelector('[data-selection-mode=union]').click();check($('selection-mode').value==='union','展开组合按钮修改实际选区模式');
 document.querySelector('[data-selection-mode=replace]').click();stroke(.25,.3,.65,.65);await pause(80);check(visible($('selection-reset')),'圈选生效');
 $('inline-copy').click();await pause(80);check(visible($('selection-reset')),'复制操作保留当前圈选');
 await tool('line');check(!visible($('selection-reset')),'切工具清除圈选与边框');
 const beforeOutside=await png();stroke(.1,.8,.8,.8);await pause(80);check(await png()!==beforeOutside,'切工具后可在旧选区外绘制');
 for(const next of ['pen','fill','move','text','stamp','magic']){await tool('select');$('inline-select-all').click();check(visible($('selection-reset')),'全选直接生效');await tool(next);check(!visible($('selection-reset')),'切换 '+next+' 自动取消圈选');}
 for(const size of ['auto','large','largest']){
  $('display-open').click();document.querySelector(`[data-ui-size="${size}"]`).click();$('display-close').click();
  for(const mode of ['select','magic']){await tool(mode);await pause(80);const root=document.querySelector('.classic-parameters'),els=[...root.querySelectorAll('button,input')].filter(visible);const overflow=els.filter(e=>!inside(e,root)).map(e=>e.id||e.textContent);check(!overflow.length,`${size} ${mode} 展开参数不越界`,overflow);}
 }
 $('display-open').click();document.querySelector('[data-ui-size="auto"]').click();$('display-close').click();await tool('select');$('inline-select-none').click();
 return {passed:true,checks,viewport:{width:innerWidth,height:innerHeight}};
}catch(error){return {passed:false,checks,failure:error.message,stack:error.stack};}
