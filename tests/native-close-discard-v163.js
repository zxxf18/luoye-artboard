const title=document.getElementById('title');title.value='退出时放弃的测试画';title.dispatchEvent(new Event('change'));
const choice=window.JSHWRequestClose();
if(!document.getElementById('close-dialog').open)throw Error('退出询问未显示');
setTimeout(()=>document.querySelector('#close-dialog button[value=discard]').click(),2500);
// Return while the real modal is visible: the host snapshots it and requests quit.
// That native request must share this same decision, exit, and create no archive.
return {passed:true,visibleChoices:[...document.querySelectorAll('#close-dialog button')].map(b=>b.textContent)};
