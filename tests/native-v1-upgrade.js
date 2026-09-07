try {
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
assert(!document.querySelector('#recover-dialog[open]'),'Startup must show a new sheet without a recovery dialog');
await pause(3500);
const music=await window.LUOYEMusicState();
assert(music.playing&&music.volume>0&&music.peak>0.00001,'Startup must produce audible MIDI PCM');
for(const id of ['copy','cut','paste','select-all','select-none','use-stamp','duplicate-layer','flip-x','record-play','text-import-texture'])assert(document.getElementById(id).querySelector('svg,img'),'Tool action missing picture: '+id);
for(const id of ['mode-board','darkroom','mode-library'])assert(document.getElementById(id).querySelector('svg,img'),'Workspace button missing image: '+id);
for(const tool of ['eraser','fill','select','warp','board-filter','line']){
 let b=document.querySelector(`#tools [data-tool="${tool}"]`);if(!b){document.getElementById('tool-page').click();b=document.querySelector(`#tools [data-tool="${tool}"]`);}b.click();
 for(const c of document.querySelectorAll('.subtool-card'))assert(c.querySelector('svg,img,canvas')&&c.textContent.trim(),'Choice needs both picture and words');
}
document.getElementById('mode-library').click();await pause(200);
const tray=document.querySelector('.right-panel').getBoundingClientRect(),paper=document.getElementById('viewport').getBoundingClientRect();
assert(tray.top>=paper.bottom-1&&tray.height>90&&paper.height>=100,'Library must sit below the usable canvas');
const saved=await window.LUOYEFlushBeforeClose();
assert(saved.project&&saved.png.startsWith('data:image/png;base64,')&&saved.sessionId,'Close must deliver a recoverable project and image');
return {music,tray:{top:tray.top,height:tray.height},paper:{bottom:paper.bottom,height:paper.height},archive:!!saved.project};

} catch(error) { return {failure:error.message,stack:error.stack,music:await window.LUOYEMusicState?.()}; }
