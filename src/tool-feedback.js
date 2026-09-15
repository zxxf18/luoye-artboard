import { BRUSHES } from './brushes.js';
import { toolCursor } from './tool-cursors.js';

const feedbackShapes = {line:'直线',triangle:'三角形',rect:'矩形',pentagon:'五角形',hexagon:'六角形',roundrect:'圆矩形',ellipse:'圆形',star:'星形',polygon:'多边形',bezier:'曲线'};
export const TOOL_FEEDBACK = [];
function feedbackGroup(tool, choices, icon, control, wave, base, duration) {
  Object.entries(choices).forEach(([value,label],i) => TOOL_FEEDBACK.push({
    key: `${tool}:${value}`, tool, value, label, icon: typeof icon === 'function' ? icon(value) : icon, control,
    sound: {wave, frequencies:[base+i*37, (base+i*37)*(1.12+i*.08)], duration:duration+i*.004},
  }));
}
feedbackGroup('pen',Object.fromEntries(BRUSHES.map(b=>[b.id,b.name])),v=>v,null,'triangle',400,.13);
const brushSounds = [
  ['triangle',[760,510],.09], ['sawtooth',[290,420,330],.19], ['sine',[520,740,620],.24],
  ['triangle',[220,290],.16], ['square',[360,480],.11], ['sawtooth',[185,260],.14],
  ['triangle',[930,690,460],.17], ['sine',[170,310,240],.2], ['sine',[880,1175,1568],.27],
];
TOOL_FEEDBACK.forEach((entry,i)=>{const [wave,frequencies,duration]=brushSounds[i];entry.sound={wave,frequencies,duration};});
feedbackGroup('eraser',{hard:'硬橡皮',soft:'软橡皮',rect:'矩形清除'},'eraser','eraser-mode','triangle',240,.12);
feedbackGroup('fill',{region:'区域填色',all:'完全填色',gradient:'前景／背景渐变','region-gradient':'区域渐变',ellipse:'圆形填色',rect:'矩形填色','ellipse-gradient':'圆形渐变','rect-gradient':'矩形渐变'},'fill','fill-mode','sine',180,.2);
feedbackGroup('stamp',{single:'单张图案',static:'组合图案',dynamic:'会动图案'},v=>({single:'stamp',static:'friend',dynamic:'butterfly'}[v]),null,'sine',660,.21);
feedbackGroup('select',{rect:'矩形圈选',ellipse:'圆形圈选',triangle:'三角形圈选',pentagon:'五角形圈选',hexagon:'六角形圈选',roundrect:'圆矩形圈选',free:'自由套索',bezier:'曲线圈选'},'select','selection-shape','triangle',530,.1);
feedbackGroup('geometry',feedbackShapes,'line','geometry','triangle',310,.13);
feedbackGroup('warp',{push:'推拉变形',zoom:'缩放变形'},'warp','warp-kind','sine',270,.24);
feedbackGroup('board-filter',{ripple:'水纹滤镜',twist:'扭曲滤镜',waterfall:'瀑布滤镜','point-light':'点光源滤镜','direction-light':'方向光源滤镜'},'board-filter','board-filter-kind','sine',430,.23);
for(const [tool,label,wave,base] of [['picker','取色器','sine',1320],['magic','魔法棒','sine',1040],['move','移动','triangle',155],['text','文字','square',450],['clone','仿制印章','triangle',200],['fractal','分形','sine',810]]) {
  feedbackGroup(tool,{default:label},tool,null,wave,base,.18);
}

export function getToolFeedback(options) {
  const tool = options.tool in feedbackShapes ? 'geometry' : options.tool;
  let value = tool === 'geometry' ? options.tool : options[tool] || 'default';
  if(tool === 'fill' && options.gradient && ['ellipse','rect'].includes(value))value += '-gradient';
  return TOOL_FEEDBACK.find(entry=>entry.key===`${tool}:${value}`) || TOOL_FEEDBACK[0];
}

export function toolCursorSVG(entry) { return toolCursor(entry).svg; }

export function scheduleToolSound(context, profile, volume=.6) {
  const level=.15*Math.max(0,Math.min(1,volume));
  if(!level)return ()=>{};
  const nodes=[],at=context.currentTime,step=profile.duration/profile.frequencies.length;
  for(const [i,frequency] of profile.frequencies.entries()) {
    const oscillator=context.createOscillator(),gain=context.createGain(),start=at+i*step,end=start+step;
    oscillator.type=profile.wave;oscillator.frequency.setValueAtTime(frequency,start);
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(level,start+Math.min(.008,step/4));gain.gain.exponentialRampToValueAtTime(.0001,end);
    oscillator.connect(gain);gain.connect(context.destination);oscillator.start(start);oscillator.stop(end+.005);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};nodes.push({oscillator,gain});
  }
  return ()=>{for(const {oscillator,gain} of nodes){gain.disconnect();try{oscillator.stop();}catch{}}};
}

export function createToolSoundPlayer(preferences, makeContext=()=>new (window.AudioContext||window.webkitAudioContext)()) {
  let context,stop,revision=0;
  const silence=()=>{revision++;stop?.();stop=null;};
  return {
    silence,
    async play(entry) {
      silence();if(!preferences.sounds||!preferences.soundVolume)return;
      const own=revision;
      try {
        context ||= makeContext();
        if(context.state==='suspended')await context.resume();
        if(own===revision&&preferences.sounds)stop=scheduleToolSound(context,entry.sound,preferences.soundVolume);
      } catch { /* Audio unavailable: the illustrated cursor still identifies the tool. */ }
    },
  };
}

export function mountToolFeedback(preferences) {
  const canvas=document.getElementById('painting'),player=createToolSoundPlayer(preferences),cursors=new Map();let previous;
  const value=id=>document.getElementById(id)?.value;
  function sync(audible=true) {
    const entry=getToolFeedback({tool:canvas.dataset.tool,pen:value('brush'),eraser:value('eraser-mode'),fill:value('fill-mode'),gradient:document.getElementById('fill-gradient')?.checked,stamp:document.body.dataset.fairyMode||'single',select:value('selection-shape'),warp:value('warp-kind'),'board-filter':value('board-filter-kind')});
    if(entry.key===previous)return;
    if(!cursors.has(entry.key)) {
      const {svg,hotspot}=toolCursor(entry);
      cursors.set(entry.key,`url("data:image/svg+xml,${encodeURIComponent(svg)}") ${hotspot.join(' ')}, crosshair`);
    }
    canvas.style.setProperty('--drawing-cursor',cursors.get(entry.key));canvas.dataset.cursor=entry.key;
    if(audible&&previous)player.play(entry);previous=entry.key;
  }
  for(const event of ['toolchange','change','controlschange','fairymodechange'])document.addEventListener(event,()=>sync());
  document.addEventListener('soundsettingchange',()=>{if(!preferences.sounds)player.silence();});
  document.addEventListener('soundvolumechange',event=>{
    player.silence();
    if(event.detail?.preview)player.play(TOOL_FEEDBACK.find(entry=>entry.key===previous));
  });
  sync(false);
}
