const checks=[],pause=ms=>new Promise(r=>setTimeout(r,ms));
const check=(v,name)=>{checks.push({name,passed:!!v});if(!v)throw Error(name);};
const choose=async value=>{const pending=window.JSHWRequestClose();await pause(40);check(document.getElementById('close-dialog').open,'显示三选退出窗口');document.querySelector('#close-dialog button[value="'+value+'"]').click();return pending;};
const stroke=()=>{const c=document.getElementById('painting'),r=c.getBoundingClientRect();c.setPointerCapture=()=>{};for(const [type,x] of [['pointerdown',.25],['pointermove',.55],['pointerup',.6]])c.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:81,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:r.x+r.width*x,clientY:r.y+r.height*.4}));};
try{
 check((await window.JSHWRequestClose()).action==='exit','空白未修改直接退出');
 stroke();await pause(1100);
 check((await choose('cancel')).action==='cancel','继续画画取消退出');
 check(!document.getElementById('close-dialog').open,'取消后恢复画板');
 const saved=await choose('save');check(saved.action==='save'&&saved.payload.project.layers.length>0,'保存退出提供工程和图片');
 check((await choose('discard')).action==='exit','不保存退出明确放弃本次修改');
 const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('jshw-studio',2);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
 const current=await new Promise(resolve=>{const r=db.transaction('drafts').objectStore('drafts').get('current');r.onsuccess=()=>resolve(r.result);});db.close();
 check(!current,'放弃后不留当前会话自动草稿');
 check((await window.JSHWRequestClose()).action==='exit','重复关闭不再询问');
 if(fileChecks){
  stroke();document.getElementById('save').click();
  for(let i=0;i<200&&document.body.hasAttribute('aria-busy');i++)await pause(30);
  const attempt=window.JSHWRequestClose();await pause(30);
  const unexpected=document.getElementById('close-dialog').open;
  if(unexpected)document.querySelector('#close-dialog button[value=cancel]').click();
  check(!unexpected&&(await attempt).action==='exit','明确保存后没有新修改不再询问');
 }
 stroke();
 // The native harness closes after this result. Exercise its real archive path.
 const poll=setInterval(()=>{if(document.getElementById('close-dialog').open){clearInterval(poll);document.querySelector('#close-dialog button[value=save]').click();}},50);
 return {passed:true,checks};
}catch(error){return {passed:false,checks,error:error.message};}
