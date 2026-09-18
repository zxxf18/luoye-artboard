const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
const check=(ok,name)=>{checks.push({name,passed:!!ok});if(!ok)throw Error(name);};
const idle=async()=>{await pause(25);for(let i=0;i<1500&&document.body.hasAttribute('aria-busy');i++)await pause(20);check(!document.body.hasAttribute('aria-busy'),'界面操作恢复响应');await pause(30);};
const click=async id=>{$(id).click();await idle();};
try{
 check(window.LUOYE_VERSION==='1.10.2','原生客户端载入 1.10.2');
 await window.LUOYEMusicState();await click('music-open');$('music-volume').value='0';$('music-volume').dispatchEvent(new Event('change'));await idle();
 for(let i=0;i<20;i++){$('music-track-choose').click();document.querySelector(`#choice-grid [data-value="${i}"]`).click();await idle();const state=await window.LUOYEMusicState();check(state.playing&&state.duration>0&&state.name===window.LUOYE_MUSIC_TRACKS[i].label,'真实 MIDI 播放音乐 '+(i+1));}
 for(const id of ['music-stop','music-play','music-prev','music-next'])await click(id);
 const midi=new Uint8Array([77,84,104,100,0,0,0,6,0,0,0,1,0,96,77,84,114,107,0,0,0,12,0,144,60,80,96,128,60,0,0,255,47,0]);const transfer=new DataTransfer();transfer.items.add(new File([midi],'测试.mid',{type:'audio/midi'}));$('music-file').files=transfer.files;$('music-file').dispatchEvent(new Event('change'));await idle();check((await window.LUOYEMusicState()).name==='测试.mid','原生 MIDI 导入');await click('music-stop');await click('music-close');
 const canvas=$('painting');canvas.setPointerCapture=()=>{};const r=canvas.getBoundingClientRect();for(const [type,x] of [['pointerdown',.2],['pointermove',.6],['pointerup',.6]])canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:83,pointerType:'mouse',button:0,buttons:type==='pointerup'?0:1,clientX:r.x+r.width*x,clientY:r.y+r.height*.4}));await idle();
 const original=canvas.toDataURL();await click('layer-menu');await click('mirror-x');await click('mirror-y');$('layer-dialog').querySelector('[data-close]').click();await idle();await click('undo');await click('undo');check(canvas.toDataURL()===original,'原生镜像撤销恢复画面');
 if(fileChecks){$('title').value='原生界面验收';await click('save');check($('tool-hint').textContent==='文件已保存','原生工程文件写入');for(const format of ['png','jpeg']){await click('export');$('export-format').value=format;$('export-dialog').querySelector('[value=export]').click();await idle();check($('tool-hint').textContent==='文件已保存','原生 '+format+' 导出');}await click('layer-menu');await click('export-layer');check($('tool-hint').textContent==='文件已保存','原生透明图层导出');$('layer-dialog').querySelector('[data-close]').click();}
 return {passed:true,checks};
}catch(error){return {passed:false,checks,error:error.message};}
