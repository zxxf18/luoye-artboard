const frame=document.querySelector('iframe'),results=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function assert(value,message){if(!value)throw Error(message);}
function isVisible(el){return el.getClientRects().length>0;}
function inside(el,root){const a=el.getBoundingClientRect(),b=root.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1&&a.top>=b.top-1&&a.bottom<=b.bottom+1;}
for(const [width,height] of [[900,650],[1280,720],[1920,1080],[2560,1440]]){
 frame.style.width=width+'px';frame.style.height=height+'px';frame.style.transform=`scale(${Math.min(1,1100/width)})`;
 await new Promise(resolve=>{frame.onload=resolve;frame.src='/';});const doc=frame.contentDocument;
 for(let i=0;i<200&&!doc.querySelector('#display-open');i++)await pause(30);
 await pause(200);doc.querySelector('#recover-dialog[open] [value="cancel"]')?.click();
 let previousScale=0;
 for(const size of ['auto','large','largest']){
  const name=`${width}×${height} · ${size}`;try{
   doc.querySelector('#display-open').click();doc.querySelector(`[data-ui-size="${size}"]`).click();doc.querySelector('#display-close').click();await pause(150);
   const scale=Number(doc.body.style.getPropertyValue('--u'));assert(scale>previousScale,'大按钮没有变大');previousScale=scale;
   const viewport=doc.querySelector('#viewport'),r=viewport.getBoundingClientRect();assert(r.width>=200&&r.height>=100,'画纸被挤压');
   for(const id of ['display-open','new','tool-page','tool-settings-open'])assert(inside(doc.getElementById(id),doc.body),'控件超出窗口 '+id);
   const header=[...doc.querySelectorAll('.brand,.header-actions button')];for(let i=1;i<header.length;i++)assert(header[i-1].getBoundingClientRect().right<=header[i].getBoundingClientRect().left+1,'顶部按钮互相覆盖');
   const parameters=doc.querySelector('.classic-parameters');assert(parameters.scrollWidth<=parameters.clientWidth+2,'画笔参数溢出');
   const pens=doc.querySelector('.brush-box'),cards=[...pens.children],clipped=cards.some(c=>!inside(c,pens));
   if(clipped){const expand=doc.querySelector('#all-brushes-open');assert(isVisible(expand),'有画笔被裁切但无展开入口');expand.click();const picks=doc.querySelectorAll('[data-pick-brush]');assert(picks.length===9,'展开后不足九支画笔');for(const b of picks)assert(b.getBoundingClientRect().width>=80&&b.getBoundingClientRect().height>=100,'展开笔盒按钮太小');doc.querySelector('#all-brushes-close').click();}
   const targets=[...doc.querySelectorAll('.header-actions button,.brush-card,.tool-button,.swatch,.left-actions button')].filter(isVisible);assert(targets.every(b=>b.getBoundingClientRect().width>=43.5&&b.getBoundingClientRect().height>=43.5),'点击区域小于44');
   assert(![...doc.querySelectorAll('select')].some(isVisible),'出现默认下拉框');
   doc.querySelector('#mode-library').click();await pause(100);
   const tray=doc.querySelector('.right-panel').getBoundingClientRect(),paper=viewport.getBoundingClientRect();
   assert(tray.top>=paper.bottom-1,'素材遮挡画纸');assert(paper.height>=100,'素材栏挤掉画纸');
   assert(inside(doc.querySelector('.right-panel'),doc.body),'素材栏超出窗口');
   assert(inside(doc.querySelector('#tool-settings-open'),doc.body),'素材打开后工具参数超出窗口');
   doc.querySelector('#mode-board').click();
   results.push({name,passed:true,canvas:{width:Math.round(r.width),height:Math.round(r.height)},expandedBrushBox:clipped});
  }catch(error){results.push({name,passed:false,error:error.message});for(const dialog of doc.querySelectorAll('dialog[open]'))dialog.close();}
 }
 doc.querySelector('#display-open').click();doc.querySelector('[data-ui-size="auto"]').click();doc.querySelector('#display-close').click();
}
document.querySelector('#results').replaceChildren(...results.map(result=>{const li=document.createElement('li');li.textContent=(result.passed?'通过 ':'失败 ')+result.name+(result.error?' — '+result.error:'');return li;}));
const passed=results.filter(r=>r.passed).length;document.querySelector('#summary').textContent=`${passed}/${results.length} 通过`;document.body.dataset.results=JSON.stringify(results);
