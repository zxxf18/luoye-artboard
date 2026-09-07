const el=id=>document.getElementById(id),checked=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const paper=[el('painting').width,el('painting').height];el('display-open').click();
for(const label of ['1080 工作区','2K 工作区','适合屏幕']){
 const button=[...el('window-sizes').children].find(b=>b.textContent===label);
 if(button.disabled)throw Error('客户端窗口按钮未启用');button.click();await pause(300);
 if(innerWidth>screen.availWidth+2||innerHeight>screen.availHeight+2)throw Error('窗口超出屏幕');
 checked.push({label,width:innerWidth,height:innerHeight,note:el('display-note').textContent});
}
const full=[...el('window-sizes').children].find(b=>b.textContent==='全屏／返回');full.click();await pause(1600);checked.push({label:'全屏',width:innerWidth,height:innerHeight});full.click();await pause(1600);checked.push({label:'退出全屏',width:innerWidth,height:innerHeight});
if(paper[0]!==el('painting').width||paper[1]!==el('painting').height)throw Error('调整窗口改变了画纸');
full.click();await pause(1600);[...el('window-sizes').children].find(b=>b.textContent==='1080 工作区').click();await pause(1800);if(innerWidth!==1920||innerHeight!==1080)throw Error('全屏中选择窗口尺寸没有生效');checked.push({label:'全屏中切换1080窗口',width:innerWidth,height:innerHeight});el('display-close').click();return {passed:true,paper,checked};
