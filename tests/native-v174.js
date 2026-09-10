const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
const check=(ok,name,detail)=>{checks.push({name,passed:!!ok,detail});};
const visible=e=>!!e&&e.getClientRects().length>0;
const inside=(el,parent)=>{const a=el.getBoundingClientRect(),b=parent.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1&&a.top>=b.top-1&&a.bottom<=b.bottom+1;};
const chooseTool=tool=>{if(!document.querySelector(`#tools [data-tool="${tool}"]`))$('tool-page').click();document.querySelector(`#tools [data-tool="${tool}"]`).click();};
const idle=async()=>{for(let i=0;i<600&&document.body.hasAttribute('aria-busy');i++)await pause(20);await pause(50);};
try {
 const canvas=$('painting');canvas.setPointerCapture=()=>{};
 const pointer=(type,x,y)=>{const r=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:99,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:r.left+r.width*x,clientY:r.top+r.height*y}));};
 const stroke=(x,y,a,b)=>{pointer('pointerdown',x,y);pointer('pointermove',a,b);pointer('pointerup',a,b);};
 const color=c=>{$('color').value=c;$('color').dispatchEvent(new Event('input',{bubbles:true}));};
 const snapshot=()=>window.LUOYEFlushBeforeClose();
 for(const tool of ['pen','fill','line']){
  chooseTool(tool);$('paint-color-open').click();check($('palette-dialog').open&&!$('choice-dialog').open,`${tool} 色彩打开调色板`);$('palette-cancel').click();
 }
 chooseTool('pen');$('paper-grain-choose').click();await pause(350);
 const images=[...document.querySelectorAll('#choice-grid .choice-picture img')];
 check(images.length>5&&images.every(img=>img.complete&&img.naturalWidth>0&&inside(img,img.parentElement)&&inside(img,img.closest('.choice-card'))),'画纸缩略图完整且没有越过卡片');
 $('choice-cancel').click();
 check(!canvas.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2})),'画板右键默认菜单已阻止');
 chooseTool('line');$('shape-filled').checked=true;color('#ff0000');$('size').value=12;stroke(.15,.25,.65,.25);await pause(100);
 let saved=await snapshot();const image=new Image();image.src=saved.png;await image.decode();const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);const px=ctx.getImageData(Math.round(c.width*.4),Math.round(c.height*.25),1,1).data;
 check(px[0]>200&&px[1]<50&&px[2]<50,'即使之前勾选实心也能画出红色直线',Array.from(px));
 $('geometry').value='rect';$('geometry').dispatchEvent(new Event('change',{bubbles:true}));stroke(.3,.4,.6,.6);await pause(50);const shape=await snapshot();
 chooseTool('fill');color('#0000ff');const after=await snapshot();
 check(shape.png===after.png&&shape.project.layers.every((l,i)=>l.image===after.project.layers[i].image),'图形颜色 A 不随油漆桶颜色 B 改变');
 // Filling a separate region must preserve the existing red shape.
 stroke(.85,.8,.85,.8);await pause(100);saved=await snapshot();image.src=saved.png;await image.decode();ctx.clearRect(0,0,c.width,c.height);ctx.drawImage(image,0,0);const red=ctx.getImageData(c.width*.45,c.height*.5,1,1).data;
 check(red[0]>200&&red[2]<50,'油漆桶填外侧区域后原有实心图形仍为 A 色',Array.from(red));
 for(const size of ['auto','large','largest']){
  $('display-open').click();document.querySelector(`[data-ui-size="${size}"]`).click();$('display-close').click();await pause(100);
  for(const tool of ['pen','eraser','fill','line','text','move','select','magic','warp','board-filter','clone','fractal','picker']){
   chooseTool(tool);await pause(30);
   if(tool==='board-filter'){$('board-filter-kind').value='waterfall';$('board-filter-kind').dispatchEvent(new Event('change'));}
   const root=document.querySelector('.classic-parameters');
   const controls=[...root.querySelectorAll('button,input[type=range],.number-stepper')].filter(visible);
   const overflow=controls.filter(el=>!inside(el,root)).map(el=>el.id||el.className);
   check(!overflow.length,`${size} ${tool} 参数在栏内`,overflow);
   check(inside(document.querySelector('.more-colors'),document.querySelector('.quick-palette')),`${size} ${tool} 颜色按钮在栏内`);
  }
 }
 $('display-open').click();document.querySelector('[data-ui-size="auto"]').click();$('display-close').click();chooseTool('pen');
 const before=$('viewport').getBoundingClientRect();$('mode-library').click();await pause(120);const afterRect=$('viewport').getBoundingClientRect();
 check(Math.abs(before.height-afterRect.height)<1,'打开图库不改变画板高度');
 check([...document.querySelectorAll('#asset-grid .asset')].every(el=>inside(el,$('asset-grid'))),'图库卡片不越界');$('mode-board').click();
 return {passed:checks.every(c=>c.passed),checks,viewport:{width:innerWidth,height:innerHeight},shelf:document.querySelector('.tool-dock').getBoundingClientRect().height};
} catch(error){return {passed:false,checks,failure:error.message,stack:error.stack};}
