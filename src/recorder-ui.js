import { Recorder } from './recording.js';
import { deliverFile, writeRecordingDraft, readRecordingDraft } from './storage.js';

export function mountRecorder({engine,run,toast,getColor,getTitle}){
  const button=document.createElement('button');button.id='recordings';button.textContent='绘画录像';document.querySelector('.edit-commands').append(button);
  const dialog=document.createElement('dialog');dialog.id='recording-dialog';dialog.className='wide-dialog';dialog.innerHTML=`<h2>绘画录像</h2><p>保存每一步笔触和编辑。五个录像段分别保留；导出录像后可再次打开。</p><div class="record-controls"><label>录像段 <select id="record-slot" aria-label="录像段">${[1,2,3,4,5].map(i=>`<option value="${i-1}">第 ${i} 段</option>`).join('')}</select></label><button id="record-start">开始新录制</button><button id="record-stop">结束录制</button><button id="record-export">导出录像</button><button id="record-import">导入录像</button></div><p id="record-state" role="status"></p><div id="record-preview"><canvas width="1920" height="1080" aria-label="录像预览"></canvas></div><div class="record-controls"><button id="record-first">起点</button><button id="record-prev">上一步</button><input id="record-position" type="range" aria-label="录像进度" min="0" max="0" value="0"><button id="record-next">下一步</button><button id="record-last">终点</button></div><div class="record-controls"><label><input id="record-current-color" type="checkbox">用当前颜色／透明度播放</label><button id="record-play">播放</button><button id="record-pause">停止</button><button id="record-truncate">截去当前位置以后</button></div><p class="muted">预览不修改当前作品。撤销、恢复或更换作品会结束本段录制。再次开始会替换所选录像段。</p><div class="dialog-actions"><button id="record-close">关闭</button></div><input id="record-file" type="file" accept=".jshwr,.json" hidden>`;document.body.append(dialog);
  const el=id=>document.getElementById(id),slot=()=>Number(el('record-slot').value);let controller=null,previewBusy=false,draftTimer;
  const recorder=new Recorder(engine,reason=>{const count=recorder?.slots[slot()]?.events.length||0;el('record-state').textContent=recorder.recording?`正在录制第 ${recorder.slot+1} 段 · ${count} 个操作`:`第 ${slot()+1} 段 · ${count} 个操作`;button.textContent=recorder.recording?'● 正在录制':'绘画录像';el('record-start').disabled=recorder.recording;el('record-stop').disabled=!recorder.recording;el('record-position').max=count;if(reason)toast(reason);clearTimeout(draftTimer);draftTimer=setTimeout(()=>writeRecordingDraft(recorder.export()).catch(()=>toast('录像草稿保存失败，请导出录像文件')),600);});
  async function preview(count,animate=false){
    if(previewBusy)return;previewBusy=true;controller=new AbortController();for(const e of dialog.querySelectorAll('button,input,select'))if(!['record-pause','record-close'].includes(e.id))e.disabled=true;
    el('record-position').value=0;
    try{await recorder.replay(slot(),count,el('record-preview').querySelector('canvas'),el('record-current-color').checked?{color:getColor(),opacity:Number(el('opacity').value)/100,animate}:{animate},n=>{el('record-position').value=n;},controller.signal);}
    finally{previewBusy=false;for(const e of dialog.querySelectorAll('button,input,select'))e.disabled=false;recorder.onState();}
  }
  function action(id,fn){el(id).onclick=()=>run(fn);}
  action('recordings',()=>{engine.end();el('record-position').value=0;recorder.onState();dialog.showModal();});
  action('record-start',async()=>{await recorder.start(slot(),getTitle());dialog.close();toast('开始记录每一步；点击「正在录制」结束或查看');});
  action('record-stop',()=>recorder.stop());
  action('record-export',async()=>toast(await deliverFile('我的绘画录像.jshwr','application/json',JSON.stringify(recorder.export()))));
  action('record-import',()=>el('record-file').click());el('record-file').onchange=()=>run(async()=>{const file=el('record-file').files[0];el('record-file').value='';if(!file)return;if(file.size>64*1024*1024)throw new Error('录像文件不能超过 64 MiB。');recorder.import(JSON.parse(await file.text()));el('record-position').value=0;toast('五段录像已打开');});
  action('record-first',()=>preview(0));action('record-prev',()=>preview(Math.max(0,Number(el('record-position').value)-1)));action('record-next',()=>preview(Number(el('record-position').value)+1));action('record-last',()=>preview(Number(el('record-position').max)));action('record-play',()=>preview(Number(el('record-position').max),true));
  el('record-pause').onclick=()=>controller?.abort();el('record-close').onclick=()=>{controller?.abort();dialog.close();};dialog.addEventListener('cancel',()=>controller?.abort());
  el('record-position').onchange=()=>run(()=>preview(Number(el('record-position').value)));el('record-slot').onchange=()=>{el('record-position').value=0;recorder.onState();};
  action('record-truncate',()=>{if(recorder.recording)throw new Error('请先结束录制，再截断录像。');recorder.truncate(slot(),Number(el('record-position').value));toast('本段录像已截断，请重新导出以保存');});
  recorder.flush=async()=>{clearTimeout(draftTimer);await writeRecordingDraft(recorder.export());};
  readRecordingDraft().then(raw=>{if(raw&&!recorder.recording)recorder.import(raw);}).catch(()=>toast('录像草稿读取失败，可通过导入录像恢复'));
  return recorder;
}
