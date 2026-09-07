try {
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const el=id=>document.getElementById(id);
const visible=node=>node?.getClientRects().length>0;
const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
const inside=(node,root)=>{const a=rect(node),b=rect(root);return a.x>=b.x-1&&a.right<=b.right+1&&a.y>=b.y-1&&a.bottom<=b.bottom+1;};
function assert(value,message){if(!value)throw Error(message);}
const header=rect(document.querySelector('.app-header')),dock=rect(document.querySelector('.tool-dock')),paperBefore=rect(el('viewport'));
assert(header.height<=72,'顶部操作区过高');
assert(dock.height<=Math.min(252,Math.max(186,innerHeight*.21)),'底部状态选择区过高');
assert(paperBefore.width>=200&&paperBefore.height>=100,'画板被工具栏挤压');
const targets=[...document.querySelectorAll('.header-actions button,.brush-card,.tool-button,.swatch,.left-actions button')].filter(visible);
assert(targets.every(node=>{const r=rect(node);return r.width>=43.5&&r.height>=43.5;}),'存在小于44像素的点击区域');
assert(![...document.querySelectorAll('select')].some(visible),'出现系统默认下拉框');
assert(document.querySelector('.classic-parameters').scrollWidth<=document.querySelector('.classic-parameters').clientWidth+2,'画笔参数横向溢出');
el('mode-library').click();await pause(300);
const paperAfter=rect(el('viewport')),tray=rect(document.querySelector('.right-panel'));
assert(tray.y>=paperAfter.bottom-1,'素材栏遮挡画板');
assert(Math.abs(paperAfter.width-paperBefore.width)<1&&Math.abs(paperAfter.height-paperBefore.height)<1,'打开素材后画板尺寸改变');
assert(inside(document.querySelector('.right-panel'),document.body),'素材栏超出窗口');
return {passed:true,viewport:{width:innerWidth,height:innerHeight},headerHeight:Math.round(header.height),dockHeight:Math.round(dock.height),paper:{width:Math.round(paperAfter.width),height:Math.round(paperAfter.height)},targets:targets.length};
} catch (error) {
return {passed:false,error:error.message,viewport:{width:innerWidth,height:innerHeight}};
}
