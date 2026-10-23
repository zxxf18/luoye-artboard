import { playfulIcon } from './playful-icons.js';
export function mountMusic({run,toast,preferences}) {
  const tracks=window.LUOYE_MUSIC_TRACKS;
  const el=id=>document.getElementById(id),button=document.createElement('button');button.id='music-open';button.className='header-command';button.innerHTML=playfulIcon('music')+'<span>音乐</span>';button.title='音乐盒';document.querySelector('.header-actions').append(button);
  const dialog=document.createElement('dialog');dialog.id='music-dialog';dialog.className='music-dialog';dialog.innerHTML=`<h2>音乐盒</h2><label for="music-track">背景音乐</label><div class="music-tracks"><button id="music-prev" aria-label="上一首">◀</button><select id="music-track">${tracks.map((_,i)=>`<option value="${i}">音乐${i+1}</option>`).join('')}</select><button id="music-next" aria-label="下一首">▶</button></div><p id="music-state" role="status">点击播放，边听边画。每首音乐会重复播放。</p><div class="music-transport"><button id="music-play">▶ 播放</button><button id="music-stop">■ 停止</button></div><label>背景音乐音量 <input id="music-volume" type="range" min="0" max="100" value="35"><output id="music-volume-value">35%</output></label><label class="sound-toggle"><input id="ui-sounds" type="checkbox" checked> 画笔与工具切换音效</label><label>工具音效音量 <input id="ui-sound-volume" type="range" min="0" max="100" value="60"><output id="ui-sound-volume-value">60%</output></label><p class="music-preference-hint">下次打开，沿用这次的音乐和音效设置。</p><button id="music-import">输入 MIDI 音乐</button><input id="music-file" type="file" accept=".mid,.midi,audio/midi" hidden><div class="dialog-actions"><button id="music-close" class="primary">确定</button></div>`;document.body.append(dialog);
  const pending=new Map(),soundToggle=el('ui-sounds'),bridge=window.webkit?.messageHandlers?.music;let loaded=false,poll=null;
  function request(action,args={}) {
    if(!bridge)return Promise.reject(new Error('请在桌面客户端中播放音乐。'));
    const id=crypto.randomUUID();return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(id);reject(new Error('音乐播放器没有响应，请重试。'));},20000);
      pending.set(id,{resolve,reject,timer});bridge.postMessage({id,action,...args});
    });
  }
  function state(value) {
    if(!value)return;const format=n=>Math.floor(n/60)+':'+String(Math.floor(n%60)).padStart(2,'0');
    el('music-state').textContent=`${value.name} · ${value.playing?'单曲循环中':'已停止'} ${format(value.position)} / ${format(value.duration)}`;
    el('music-volume').value=Math.round(value.volume*100);el('music-volume-value').textContent=Math.round(value.volume*100)+'%';
    button.setAttribute('aria-label',value.playing?'音乐：播放中':'音乐：已停止');button.dataset.playing=String(value.playing);
  }
  window.addEventListener('native-music-result',event=>{
    const r=event.detail,p=pending.get(r.id);if(!p)return;clearTimeout(p.timer);pending.delete(r.id);
    if(r.error)p.reject(new Error(r.error));else{state(r.state);p.resolve(r.state);}
  });
  const remember=(value,extra={})=>{preferences.saveMusic({volume:Math.round(value.volume*100)/100,playing:value.playing,...extra});return value;};
  async function track(index=Number(el('music-track').value),autoplay=true) {
    try {
      const value=await request('track',{index,autoplay});loaded=true;el('music-track').value=index;
      document.dispatchEvent(new Event('controlschange'));return remember(value,{index});
    } catch(error) {el('music-track').value=preferences.music.index;document.dispatchEvent(new Event('controlschange'));throw error;}
  }
  const saved=preferences.music;
  el('music-track').value=saved.index;el('music-volume').value=Math.round(saved.volume*100);el('music-volume-value').textContent=Math.round(saved.volume*100)+'%';
  soundToggle.checked=preferences.sounds;
  const soundVolume=el('ui-sound-volume');
  soundVolume.value=Math.round(preferences.soundVolume*100);el('ui-sound-volume-value').textContent=soundVolume.value+'%';
  function changeSoundVolume(preview) {
    preferences.setSoundVolume(Number(soundVolume.value)/100);el('ui-sound-volume-value').textContent=soundVolume.value+'%';
    document.dispatchEvent(new CustomEvent('soundvolumechange',{detail:{preview}}));
  }
  soundVolume.oninput=()=>changeSoundVolume(false);soundVolume.onchange=()=>changeSoundVolume(true);
  soundToggle.onchange=()=>{preferences.setSounds(soundToggle.checked);document.dispatchEvent(new Event('soundsettingchange'));};
  const started=bridge?(async()=>{await request('volume',{volume:saved.volume});await track(saved.index,saved.playing);})().catch(e=>toast('音乐暂时没响起来：'+e.message)):Promise.resolve();
  // Wait for restoration before accepting playback commands, without blocking drawing.
  const action=fn=>()=>run(async()=>{await started;return fn();});
  button.onclick=()=>{dialog.showModal();if(bridge){started.then(()=>request('state')).catch(e=>toast(e.message));poll=setInterval(()=>request('state').catch(()=>{}),1000);}else el('music-state').textContent='背景音乐需在桌面客户端播放；画笔与工具音效可在这里开关。';};
  el('music-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{clearInterval(poll);poll=null;});
  el('music-play').onclick=action(async()=>loaded?remember(await request('play')):track());
  el('music-stop').onclick=action(async()=>remember(await request('stop')));
  el('music-track').onchange=()=>{const index=Number(el('music-track').value);return action(()=>track(index))();};
  for(const [id,delta] of [['music-prev',-1],['music-next',1]])el(id).onclick=action(()=>track((Number(el('music-track').value)+delta+tracks.length)%tracks.length));
  el('music-volume').oninput=()=>el('music-volume-value').textContent=el('music-volume').value+'%';
  el('music-volume').onchange=()=>{const volume=Number(el('music-volume').value)/100;return action(async()=>remember(await request('volume',{volume})))();};
  el('music-import').onclick=()=>el('music-file').click();el('music-file').onchange=action(async()=>{
    const file=el('music-file').files[0];el('music-file').value='';if(!file)return;
    if(file.size>8*1024*1024)throw new Error('MIDI 文件不能超过 8 MiB。');
    const data=new Uint8Array(await file.arrayBuffer());if(String.fromCharCode(...data.subarray(0,4))!=='MThd')throw new Error('请选择标准 MIDI 文件。');
    let binary='';for(let i=0;i<data.length;i+=8192)binary+=String.fromCharCode(...data.subarray(i,i+8192));
    remember(await request('import',{data:btoa(binary),name:file.name}));loaded=true;
  });
  if(!bridge)for(const id of ['music-prev','music-next','music-track','music-play','music-stop','music-volume','music-import','music-file'])el(id).disabled=true;
  window.LUOYEMusicState=async()=>{await started;return request('state');};
  window.LUOYEMusicSmoke=async()=>{
    await started;const before=await request('state'),index=Number(el('music-track').value);
    try {await request('volume',{volume:0});const playing=await request('track',{index:0});if(!playing.playing||playing.volume!==0)throw new Error('MIDI bridge did not start muted playback');const stopped=await request('stop');if(stopped.playing)throw new Error('MIDI bridge did not stop');return {playing,stopped,tracks:tracks.length};}
    finally {await request('volume',{volume:before.volume});await request('track',{index,autoplay:before.playing});}
  };
  return {request};
}
