const $=id=>document.getElementById(id),pause=ms=>new Promise(r=>setTimeout(r,ms)),checks=[];
const check=(ok,name,detail)=>{checks.push({name,passed:!!ok,detail});if(!ok)throw Error(name);};
const idle=async()=>{for(let i=0;i<500&&document.body.hasAttribute('aria-busy');i++)await pause(20);};
const tool=id=>{if(!document.querySelector(`#tools [data-tool="${id}"]`))$('tool-page').click();document.querySelector(`#tools [data-tool="${id}"]`).click();};
try {
 const native=await window.LUOYEMusicState();
 if(localStorage.getItem('luoye-feedback-test-phase')==='reopen') {
  checks.push(...JSON.parse(localStorage.getItem('luoye-feedback-first-checks')||'[]'));
  check($('ui-sound-volume').value==='37'&&$('ui-sound-volume-value').textContent==='37%','WKWebView reload remembers independent effect volume');
  check(!$('ui-sounds').checked,'WKWebView reload remembers muted tool effects');
  check($('music-track').value==='16'&&$('music-track-choose').textContent.includes('17'),'WKWebView reload restores music 17 in both selectors');
  check(!native.playing&&native.name===window.LUOYE_MUSIC_TRACKS[16].label&&Math.abs(native.volume-.23)<.001,'actual native MIDI reload restores selected track, stopped state and volume',native);
  $('music-open').click();return {passed:true,checks};
 }
 check($('ui-sounds').checked,'tool effects default on');
 check($('ui-sound-volume').value==='60','tool effect volume defaults to 60%');
 const contexts=[],base=AudioContext.prototype.createOscillator;let oscillators=0;
 AudioContext.prototype.createOscillator=function(){oscillators++;if(!contexts.includes(this))contexts.push(this);return base.call(this);};
 const analyzer=AudioContext.prototype.createGain;
 const meters=[];
 AudioContext.prototype.createGain=function(){const gain=analyzer.call(this),meter=this.createAnalyser();meter.fftSize=2048;gain.connect(meter);meters.push(meter);return gain;};
 let peak=0;
 for(const brush of ['crayon','pencil','spray']) {
  tool('pen');document.querySelector(`.brush-box [data-brush="${brush}"]`).click();await pause(30);
  const contact={crayon:'10 35',pencil:'8 36',spray:'25 8'}[brush];
  check($('painting').dataset.cursor==='pen:'+brush&&getComputedStyle($('painting')).cursor.endsWith(contact+', crosshair'),'WKWebView illustrated cursor and contact '+brush);
  for(const meter of meters){const samples=new Float32Array(meter.fftSize);meter.getFloatTimeDomainData(samples);peak=Math.max(peak,...samples.map(Math.abs));}
 }
 check(oscillators>=7&&contexts.length===1,'distinct brush sounds reuse one AudioContext',{oscillators,contexts:contexts.map(c=>c.state)});
 check(peak>0,'real Web Audio graph produces nonzero tool sound samples',{peak});
 $('music-open').click();$('ui-sound-volume').value='37';$('ui-sound-volume').dispatchEvent(new Event('change'));
 check(localStorage.getItem('luoye-ui-sound-volume')==='0.37'&&$('ui-sound-volume-value').textContent==='37%','native music panel adjusts and saves effect volume');
 $('ui-sounds').checked=false;$('ui-sounds').dispatchEvent(new Event('change',{bubbles:true}));$('music-close').click();const silent=oscillators;
 tool('eraser');$('eraser-mode').value='soft';$('eraser-mode').dispatchEvent(new Event('change',{bubbles:true}));tool('fill');$('fill-mode').value='gradient';$('fill-mode').dispatchEvent(new Event('change',{bubbles:true}));await pause(80);
 check(oscillators===silent&&$('painting').dataset.cursor==='fill:gradient','music switch silences tool feedback; fill mode updates cursor');
 const image=new Image();image.src=getComputedStyle($('painting')).cursor.match(/url\("([^"]+)/)[1];await image.decode();check(image.width===40&&image.height===40&&getComputedStyle($('painting')).cursor.endsWith('33 38, crosshair'),'WKWebView decodes pouring bucket cursor with paint-end contact');
 $('music-open').click();$('music-track').value='16';$('music-track').dispatchEvent(new Event('change',{bubbles:true}));await idle();$('music-volume').value='23';$('music-volume').dispatchEvent(new Event('change',{bubbles:true}));await idle();$('music-stop').click();await idle();
 const stopped=await window.LUOYEMusicState();check(!stopped.playing&&Math.abs(stopped.volume-.23)<.001,'actual native MIDI volume and stop commands succeed',stopped);
 localStorage.setItem('luoye-feedback-test-phase','reopen');localStorage.setItem('luoye-feedback-first-checks',JSON.stringify(checks));return {reloadForTest:true};
} catch(error) {return {passed:false,checks,failure:error.message};}
