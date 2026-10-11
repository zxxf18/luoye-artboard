import { seededRandom } from './pixels.js';
import { legacyBrushSegment } from './brushes-legacy.js';

export const DEFAULT_BRUSH_SIZE=16;
export const BRUSHES=[
  {id:'pencil',name:'铅笔',hint:'细细的线，勾轮廓',size:14,color:'#eca73b'},
  {id:'spray',name:'喷笔',hint:'点点雾气，轻轻喷',size:34,color:'#69abc1'},
  {id:'watercolor',name:'水彩',hint:'透明水色，叠着画',size:30,color:'#7b9cce'},
  {id:'brush',name:'刷子',hint:'一束笔毛，刷出纹路',size:26,color:'#b97c50'},
  {id:'marker',name:'麦克笔',hint:'扁扁笔头，涂大块',size:24,color:'#b287c8'},
  {id:'crayon',name:'蜡笔',hint:'厚厚蜡粒，沙沙画',size:22,color:'#ee8573'},
  {id:'chalk',name:'粉笔',hint:'软软粉末，毛茸茸',size:24,color:'#91b982'},
  {id:'tube',name:'颜料管',hint:'挤出颜料，亮亮的',size:20,color:'#f4ac59'},
  {id:'effect',name:'星光笔',hint:'拖一拖，撒下星星',size:28,color:'#df91b7'},
  {id:'rainbow',name:'彩虹笔',hint:'一笔画出彩虹',size:24,color:'#ef5350'},
  {id:'duotone',name:'双色渐变',hint:'两种颜色慢慢变',size:24,color:'#ef5350'},
];
const brushTau=Math.PI*2;
function tint(hex,amount){return '#'+hex.slice(1).match(/../g).map(n=>{const c=parseInt(n,16);return Math.round(amount>0?c+(255-c)*amount:c*(1+amount)).toString(16).padStart(2,'0');}).join('');}
function ribbon(ctx,a,b,width,color,alpha,ox=0,oy=0){ctx.strokeStyle=color;ctx.fillStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();if(a.x===b.x&&a.y===b.y){ctx.arc(a.x+ox,a.y+oy,width/2,0,brushTau);ctx.fill();}else{ctx.moveTo(a.x+ox,a.y+oy);ctx.lineTo(b.x+ox,b.y+oy);ctx.stroke();}}
function starPath(ctx,r){ctx.beginPath();for(let i=0;i<10;i++){const angle=i*Math.PI/5-Math.PI/2,rad=i%2?r*.43:r;const x=Math.cos(angle)*rad,y=Math.sin(angle)*rad;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();}

function hexRgb(hex,fallback='#000000'){
  const value=typeof hex==='string'&&/^#[\da-f]{6}$/i.test(hex)?hex:fallback;
  return [parseInt(value.slice(1,3),16),parseInt(value.slice(3,5),16),parseInt(value.slice(5,7),16)];
}
function rgbHex(rgb){return '#'+rgb.map(value=>Math.max(0,Math.min(255,Math.round(value))).toString(16).padStart(2,'0')).join('');}
function seedUnit(seed){
  let value=Number.isFinite(Number(seed))?Number(seed)>>>0:0;
  // A small integer mixer gives adjacent recorded seeds visibly different
  // starting colors without keeping a mutable random stream on the gesture.
  value=(value+0x9e3779b9)>>>0;value^=value>>>16;value=Math.imul(value,0x21f0aaad)>>>0;value^=value>>>15;value=Math.imul(value,0x735a2d97)>>>0;value^=value>>>15;
  return (value>>>0)/4294967296;
}
function gradientScalar(point,origin){const dx=point.x-origin.x,dy=point.y-origin.y,dir=origin.direction;return dir?dx*dir.x+dy*dir.y:dx;}
function normalizeProgress(point,origin,length,seed=0){return Math.max(0,Math.min(1,gradientScalar(point,origin,seed)/Math.max(1,length)));}

/** Return a deterministic rainbow color for a canvas position. */
export function rainbowColorAt(point,origin,seed=0,length=260){
  const hue=(seedUnit(seed)*360+gradientScalar(point,origin)/Math.max(1,length)*360+360)%360;
  const chroma=1,hh=hue/60,x=chroma*(1-Math.abs(hh%2-1));let rgb;
  if(hh<1)rgb=[chroma,x,0];else if(hh<2)rgb=[x,chroma,0];else if(hh<3)rgb=[0,chroma,x];else if(hh<4)rgb=[0,x,chroma];else if(hh<5)rgb=[x,0,chroma];else rgb=[chroma,0,x];
  return rgbHex(rgb.map(value=>value*255));
}

/** Return a deterministic foreground-to-secondary color for a canvas position. */
export function gradientColorAt(point,origin,foreground,secondary,length=260,seed=0){
  const t=normalizeProgress(point,origin,length,0),a=hexRgb(foreground),b=hexRgb(secondary,'#ffffff');
  return rgbHex(a.map((value,index)=>value+(b[index]-value)*t));
}

function gradientOrigin(gesture,point){
  if(gesture.gradientOrigin&&Number.isFinite(gesture.gradientOrigin.x)&&Number.isFinite(gesture.gradientOrigin.y))return gesture.gradientOrigin;
  if(gesture.start&&Number.isFinite(gesture.start.x)&&Number.isFinite(gesture.start.y))return gesture.gradientOrigin={x:gesture.start.x,y:gesture.start.y};
  return gesture.gradientOrigin??=({...point});
}
function segmentGradient(ctx,a,b,stops){
  if(a.x===b.x&&a.y===b.y)return null;
  const gradient=ctx.createLinearGradient(a.x,a.y,b.x,b.y);
  // Several stops keep the hue smooth even when a segment spans a full color
  // cycle. Every stop is derived from its position, so pointer event density
  // cannot change the result.
  for(let i=0;i<stops.length;i++)gradient.addColorStop(i/8,stops[i]);
  return gradient;
}
function gradientRibbon(ctx,a,b,width,stops,alpha){
  if(a.x===b.x&&a.y===b.y){ribbon(ctx,a,b,width,stops[0],alpha);return;}
  ribbon(ctx,a,b,width,segmentGradient(ctx,a,b,stops),alpha);
}

/**
 * Prepare the nine colour stops used by a gradient brush. The source segment
 * is shared by all assisted copies, while each copy still creates its own
 * CanvasGradient so its transformed coordinates keep the original visual
 * direction. Keeping this cache on the gesture removes the expensive colour
 * conversion work from every symmetry copy without sharing mutable brush
 * state such as randomness or dab travel.
 */
export function prepareGradientStops(gesture, a, b) {
  const key=gesture?.options?.brush;
  if(key!=='rainbow'&&key!=='duotone')return null;
  const origin=gradientOrigin(gesture,a);
  if(!origin.direction&&(a.x!==b.x||a.y!==b.y)){
    const distance=Math.hypot(b.x-a.x,b.y-a.y);
    if(distance)origin.direction={x:(b.x-a.x)/distance,y:(b.y-a.y)/distance};
  }
  const width=Math.max(1,Number(gesture.options.size||0)/Math.max(.01,Number(gesture.layer?.scale)||1));
  const length=Math.max(96,width*5),seed=gesture.options.seed??0;
  const signature=[key,a.x,a.y,b.x,b.y,origin.x,origin.y,origin.direction?.x||0,origin.direction?.y||0,length,seed,gesture.options.color,gesture.options.secondaryColor||'#ffffff'].join('|');
  if(gesture.gradientStopsSignature===signature&&gesture.gradientStops?.length===9)return gesture.gradientStops;
  const colorAt=key==='rainbow'
    ?point=>rainbowColorAt(point,origin,seed,length)
    :point=>gradientColorAt(point,origin,gesture.options.color,gesture.options.secondaryColor||'#ffffff',length,seed);
  const stops=[];
  for(let i=0;i<=8;i++){const t=i/8;stops.push(colorAt({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}));}
  gesture.gradientStopsSignature=signature;gesture.gradientStops=stops;
  if(gesture.engineMetrics)gesture.engineMetrics.gradientStopCalculations=(gesture.engineMetrics.gradientStopCalculations||0)+stops.length;
  return stops;
}

export function brushSegment(ctx,g,a,b){
  const o=g.options;
  // Recordings without a version keep the 0.2/0.3 rendering rules.
  if(o.brushVersion!==2||o.tool==='eraser'||o.tool==='scratch')return legacyBrushSegment(ctx,g,a,b);
  const key=o.brush||'pencil',w=o.size/g.layer.scale,ratio=Math.max(.15,Math.min(2,o.ratio??1)),alpha=o.opacity,random=g.random||(g.random=seededRandom(o.seed??1));
  ctx.save();ctx.fillStyle=o.color;ctx.strokeStyle=o.color;ctx.globalAlpha=alpha;
  if(key==='rainbow'||key==='duotone'){
    const origin=gradientOrigin(g,a);if(!origin.direction&&(a.x!==b.x||a.y!==b.y)){const distance=Math.hypot(b.x-a.x,b.y-a.y);if(distance)origin.direction={x:(b.x-a.x)/distance,y:(b.y-a.y)/distance};}
    // Keep the colour journey visible on a child's short stroke while still
    // giving long strokes room to show several rainbow bands.
    const stops=g.gradientStops?.length===9?g.gradientStops:prepareGradientStops(g,a,b);
    gradientRibbon(ctx,a,b,Math.max(1,w*.72)*ratio,stops,alpha);
  }else if(key==='pencil'){
    ribbon(ctx,a,b,Math.max(1,w*.26)*ratio,o.color,alpha*.94);
    ribbon(ctx,a,b,Math.max(.5,w*.05),o.color,alpha*.24,-w*.13,-w*.1);
  }else if(key==='tube'){
    ribbon(ctx,a,b,w*ratio,tint(o.color,-.3),alpha,w*.09,w*.09);
    ribbon(ctx,a,b,w*.82*ratio,o.color,alpha);
    ribbon(ctx,a,b,w*.2*ratio,tint(o.color,.78),alpha*.92,-w*.15,-w*.16);
    ribbon(ctx,a,b,w*.07*ratio,'#ffffff',alpha*.8,-w*.18,-w*.2);
  }else if(key==='marker'){
    const vx=w*.38*ratio,vy=-w*.3;
    ctx.globalAlpha=alpha*.82;ctx.beginPath();ctx.moveTo(a.x-vx,a.y-vy);ctx.lineTo(b.x-vx,b.y-vy);ctx.lineTo(b.x+vx,b.y+vy);ctx.lineTo(a.x+vx,a.y+vy);ctx.closePath();ctx.fill();
    if(a.x===b.x&&a.y===b.y)ribbon(ctx,{x:a.x-vx,y:a.y-vy},{x:a.x+vx,y:a.y+vy},Math.max(2,w*.12),o.color,alpha*.82);
  }else if(key==='brush'){
    g.bristles ||= Array.from({length:17},()=>({offset:(random()-.5)*w,thickness:w*(.014+random()*.028),alpha:.22+random()*.55}));
    for(const bristle of g.bristles)ribbon(ctx,a,b,Math.max(.6,bristle.thickness),o.color,alpha*bristle.alpha,bristle.offset*.25*ratio,bristle.offset*ratio);
  }else{
    const spacing=Math.max(.8,w*(key==='effect'?.85:key==='spray'?.12:.12)),distance=Math.hypot(b.x-a.x,b.y-a.y);
    const dab=(x,y)=>{ctx.save();ctx.translate(x,y);ctx.scale(ratio,1);ctx.globalAlpha=alpha;
      if(key==='watercolor'){
        const gradient=ctx.createRadialGradient(0,0,w*.08,0,0,w*.52);gradient.addColorStop(0,o.color+'10');gradient.addColorStop(.55,o.color+'25');gradient.addColorStop(.83,o.color+'18');gradient.addColorStop(1,o.color+'00');ctx.fillStyle=gradient;ctx.fillRect(-w*.54,-w*.54,w*1.08,w*1.08);
      }else if(key==='spray'){
        for(let i=0;i<22;i++){const angle=random()*brushTau,r=Math.min(w*.78,Math.sqrt(-2*Math.log(Math.max(.00001,random())))*w*.19),size=Math.max(.55,w*(.006+random()*.014));ctx.globalAlpha=alpha*(.25+random()*.65);ctx.beginPath();ctx.arc(Math.cos(angle)*r,Math.sin(angle)*r,size,0,brushTau);ctx.fill();}
      }else if(key==='crayon'||key==='chalk'){
        const chalk=key==='chalk',count=Math.min(180,Math.max(40,Math.round(w*(chalk?1.4:3))));
        for(let i=0;i<count;i++){const angle=random()*brushTau,r=Math.sqrt(random())*w*(chalk?.58:.48),size=Math.max(.6,w*(chalk?.045:.025)*(0.5+random()));ctx.globalAlpha=alpha*(chalk?.12+random()*.3:.45+random()*.5);ctx.fillRect(Math.cos(angle)*r,Math.sin(angle)*r,size*(chalk?1:2),size);}
      }else if(key==='effect'){
        ctx.rotate((random()-.5)*.7);ctx.fillStyle=o.color;ctx.strokeStyle=tint(o.color,-.2);ctx.lineWidth=Math.max(.8,w*.028);starPath(ctx,w*.45);ctx.fill();ctx.stroke();ctx.fillStyle=tint(o.color,.8);starPath(ctx,w*.2);ctx.fill();ctx.fillStyle=o.color;ctx.globalAlpha=alpha*.6;ctx.beginPath();ctx.arc(w*.5,-w*.38,w*.055,0,brushTau);ctx.fill();
      }
      ctx.restore();
    };
    if(!g.dabStarted){dab(a.x,a.y);g.dabStarted=true;g.dabTravel=0;}
    if(distance){for(let d=spacing-(g.dabTravel||0);d<=distance;d+=spacing)dab(a.x+(b.x-a.x)*d/distance,a.y+(b.y-a.y)*d/distance);g.dabTravel=((g.dabTravel||0)+distance)%spacing;}
  }
  ctx.restore();
}
