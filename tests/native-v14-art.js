const checks=[];
try{
 const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms));
 const check=(ok,name)=>{checks.push({passed:!!ok,name});if(!ok)throw Error(name);};
 const idle=async()=>{for(let i=0;i<200&&document.body.hasAttribute('aria-busy');i++)await pause(30);await pause(100);};
 const paper=$('painting'),view=$('viewport'),rect=view.getBoundingClientRect();
 const pixel=(canvas,x,y)=>canvas.getContext('2d').getImageData(x,y,1,1).data;
 const snapshot=async()=> (await window.LUOYEFlushBeforeClose()).project;
 $('mode-library').click();document.querySelector('[data-category="coloring"]').click();
 check($('library-pagination').textContent.includes('36 个'),'涂色本独立分类包含 36 张底稿');
 check(view.getBoundingClientRect().height===rect.height,'打开底部素材不改变画纸框');
 document.querySelector('[data-asset-id="coloring-train"]').click();await idle();
 let project=await snapshot();check(project.layers.some(l=>l.sourceId==='coloring-train'&&l.role==='background'),'新绘小火车底稿能在原生客户端加载');
 check(document.querySelector('.classic-left>h2').textContent==='找一找图案','选好底稿仍显示正确分类标题');
 document.querySelector('[data-category="background"]').click();check(![...$('asset-grid').children].some(b=>b.dataset.assetId.startsWith('color0-')||b.dataset.assetId.startsWith('coloring-')),'彩色背景入口不混入涂色底稿');
 document.querySelector('[data-category="frame"]').click();
 for(const id of ['frame-autumn','frame-garden','frame-space','frame-ocean']){
  document.querySelector(`[data-asset-id="${id}"]`).click();await idle();project=await snapshot();const frame=project.layers.find(l=>l.sourceId===id);
  check(frame&&frame.width===project.width&&frame.height===project.height&&frame.scale===1,id+' 相框与 1080 画纸匹配');
  const image=new Image();image.src=frame.image;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;c.getContext('2d').drawImage(image,0,0);
  check(pixel(c,c.width/2,c.height/2)[3]===0,id+' 相框中央透明、不盖住作品');
  $('undo').click();await idle();check(!(await snapshot()).layers.some(l=>l.sourceId===id),id+' 撤销可恢复原画');
 }
 document.querySelector('[data-asset-id="frame-autumn"]').click();await idle();
 document.querySelector('[data-category="coloring"]').click();
 check($('painting').dataset.tool==='pen','加入相框后继续使用画笔，不会误拖相框');
 const before=paper.toDataURL();document.querySelector('#tools [data-tool="fill"]').click();document.querySelector('[data-color="#ed9448"]').click();
 const r=paper.getBoundingClientRect(),capture=paper.setPointerCapture;paper.setPointerCapture=()=>{};
 for(const type of ['pointerdown','pointerup'])paper.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:91,pointerType:'mouse',button:0,buttons:type==='pointerdown'?1:0,clientX:r.left+r.width*.42,clientY:r.top+r.height*.75}));paper.setPointerCapture=capture;await idle();
 check(paper.toDataURL()!==before,'加好相框后仍能给底稿分区涂色');
 check(document.querySelector('#toast').getBoundingClientRect().height===0,'操作没有悬浮 toast');
 project=await snapshot();check(project.layers.filter(l=>l.role==='background').length===1,'涂色页保持单一底稿，前景与相框独立');
 return {passed:true,checks};
}catch(error){return {passed:false,checks,error:error.message,stack:error.stack};}
