import { seededRandom } from './pixels.js';

export const brushSeedNamespace = 'b34c1ad3e29cce87129537a0b86d25e6';
const brushSeedSalt = brushSeedNamespace.match(/.{8}/g)
  .reduce((seed, word) => seed ^ Number.parseInt(word, 16), 0);

export function brushSeedFromEntropy(entropy) {
  return (entropy ^ brushSeedSalt) >>> 0;
}

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
  {id:'duotone',name:'渐变色',hint:'两种颜色慢慢变',size:24,color:'#ef5350'},
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
function rainbowHue(hue){
  const chroma=1,hh=((hue%360)+360)%360/60,x=chroma*(1-Math.abs(hh%2-1));let rgb;
  if(hh<1)rgb=[chroma,x,0];else if(hh<2)rgb=[x,chroma,0];else if(hh<3)rgb=[0,chroma,x];else if(hh<4)rgb=[0,x,chroma];else if(hh<5)rgb=[x,0,chroma];else rgb=[chroma,0,x];
  return rgbHex(rgb.map(value=>value*255));
}
function rainbowProgressColorAt(progress,seed=0){return rainbowHue(seedUnit(seed)*360+progress*360);}
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
  return rainbowHue(seedUnit(seed)*360+gradientScalar(point,origin)/Math.max(1,length)*360);
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

function watercolorGradient(ctx, color, width, center = 0) {
  const gradient = ctx.createRadialGradient(center, center, width * .08, center, center, width * .52);
  gradient.addColorStop(0, color + '10');
  gradient.addColorStop(.55, color + '25');
  gradient.addColorStop(.83, color + '18');
  gradient.addColorStop(1, color + '00');
  return gradient;
}

function watercolorTip(ctx, gesture, width, color, alpha) {
  if (width < 8) return null;
  const owner = gesture.brushTipOwner ?? gesture;
  const cached = owner.watercolorTip;
  if (cached?.width === width && cached.color === color && cached.alpha === alpha) return cached.canvas;
  const canvas = ctx.canvas?.ownerDocument?.createElement('canvas');
  if (!canvas) return null;
  // The pigment profile stays constant through a stroke. Rasterize it once
  // instead of evaluating a new radial gradient for every dab and every axis.
  // Keep tiny tips on the exact gradient path. Bound the raster for very
  // large layer-space tips because the profile scales smoothly.
  const resolution = Math.min(512, Math.ceil(width * 1.08));
  canvas.width = resolution; canvas.height = resolution;
  const tip = canvas.getContext('2d', { willReadFrequently: true });
  if (!tip) return null;
  tip.globalAlpha = alpha;
  tip.fillStyle = watercolorGradient(tip, color, Math.min(width, resolution / 1.08), resolution / 2);
  tip.fillRect(0, 0, resolution, resolution);
  owner.watercolorTip = { width, color, alpha, canvas };
  return canvas;
}

function walkDabs(gesture, a, b, spacing, dab) {
  if (!gesture.dabStarted) {
    dab(a.x, a.y);
    gesture.dabStarted = true;
    gesture.dabTravel = 0;
  }
  const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
  if (!distance) return;
  const travel = gesture.dabTravel || 0;
  for (let d = spacing - travel; d <= distance; d += spacing) dab(a.x + dx * d / distance, a.y + dy * d / distance);
  gesture.dabTravel = (travel + distance) % spacing;
}

function particleDab(ctx, brush, width, alpha, random) {
  if (brush === 'spray') {
    for (let i = 0; i < 22; i++) {
      const angle = random() * brushTau;
      const radius = Math.min(width * .78, Math.sqrt(-2 * Math.log(Math.max(.00001, random()))) * width * .19);
      const size = Math.max(.55, width * (.006 + random() * .014));
      ctx.globalAlpha = alpha * (.25 + random() * .65);
      ctx.beginPath(); ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius, size, 0, brushTau); ctx.fill();
    }
    return;
  }
  const chalk = brush === 'chalk', count = Math.min(180, Math.max(40, Math.round(width * (chalk ? 1.4 : 3))));
  for (let i = 0; i < count; i++) {
    const angle = random() * brushTau, radius = Math.sqrt(random()) * width * (chalk ? .58 : .48);
    const size = Math.max(.6, width * (chalk ? .045 : .025) * (.5 + random()));
    ctx.globalAlpha = alpha * (chalk ? .12 + random() * .3 : .45 + random() * .5);
    ctx.fillRect(Math.cos(angle) * radius, Math.sin(angle) * radius, size * (chalk ? 1 : 2), size);
  }
}

function drawSharedParticles(ctx, gesture, a, b, width, ratio, random, paint) {
  const owner = gesture.particleScratchOwner;
  // Large particle tips draw fewer dabs. Compositing their mostly empty
  // rotated footprints can cost more than drawing the particles directly.
  const maxWidth = gesture.options.brush === 'spray' ? 40 : 64;
  if (!owner || width > maxWidth || !random.snapshot) return false;
  const seed = random.snapshot(), started = gesture.dabStarted, travel = gesture.dabTravel;
  let scratch = owner.particleScratch;
  if (scratch?.a === a && scratch.b === b) {
    // Copies can diverge when a segment sits on an axis and identical copies
    // are omitted. Keep their individual random and spacing state.
    if (scratch.seed !== seed || scratch.started !== started || scratch.travel !== travel) return false;
    random.restore(scratch.nextSeed);
    gesture.dabStarted = scratch.nextStarted;
    gesture.dabTravel = scratch.nextTravel;
  } else {
    const pad = Math.ceil(width * Math.max(1, ratio)) + 2;
    const left = Math.floor(Math.min(a.x, b.x)) - pad, top = Math.floor(Math.min(a.y, b.y)) - pad;
    const w = Math.ceil(Math.max(a.x, b.x)) + pad - left, h = Math.ceil(Math.max(a.y, b.y)) + pad - top;
    const maxPixels = 512 * 512;
    if (w > 1024 || h > 1024 || w * h > maxPixels) return false;
    if (!scratch || scratch.canvas.width < w || scratch.canvas.height < h) {
      const canvas = ctx.canvas?.ownerDocument?.createElement('canvas');
      if (!canvas) return false;
      // Grow in blocks so changes in segment length reuse the same surface.
      const growW = Math.max(scratch?.canvas.width || 0, Math.ceil(w / 32) * 32);
      const growH = Math.max(scratch?.canvas.height || 0, Math.ceil(h / 32) * 32);
      canvas.width = growW * growH <= maxPixels ? growW : w;
      canvas.height = growW * growH <= maxPixels ? growH : h;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) return false;
      scratch = owner.particleScratch = { canvas, context };
    }
    const { context } = scratch;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, w, h);
    context.setTransform(1, 0, 0, 1, -left, -top);
    context.fillStyle = gesture.options.color;
    paint(context);
    Object.assign(scratch, { a, b, seed, started, travel, left, top, w, h,
      nextSeed: random.snapshot(), nextStarted: gesture.dabStarted, nextTravel: gesture.dabTravel });
  }
  ctx.globalAlpha = 1;
  ctx.drawImage(scratch.canvas, 0, 0, scratch.w, scratch.h, scratch.left, scratch.top, scratch.w, scratch.h);
  return true;
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
  const pathDistance=Math.max(0,Number(gesture.gradientDistance)||0),segmentDistance=Math.hypot(b.x-a.x,b.y-a.y);
  const signature=[key,a.x,a.y,b.x,b.y,pathDistance,segmentDistance,origin.x,origin.y,origin.direction?.x||0,origin.direction?.y||0,length,seed,gesture.options.color,gesture.options.secondaryColor||'#ffffff'].join('|');
  if(gesture.gradientStopsSignature===signature&&gesture.gradientStops?.length===9)return gesture.gradientStops;
  const colorAt=key==='rainbow'
    ?point=>rainbowProgressColorAt((pathDistance+(segmentDistance?Math.hypot(point.x-a.x,point.y-a.y):0))/length,seed)
    :point=>gradientColorAt(point,origin,gesture.options.color,gesture.options.secondaryColor||'#ffffff',length,seed);
  const stops=[];
  for(let i=0;i<=8;i++){const t=i/8;stops.push(colorAt({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}));}
  gesture.gradientStopsSignature=signature;gesture.gradientStops=stops;
  if(gesture.engineMetrics)gesture.engineMetrics.gradientStopCalculations=(gesture.engineMetrics.gradientStopCalculations||0)+stops.length;
  return stops;
}

export function brushSegment(ctx,g,a,b,gradientStops=null,dabTransform=null){
  const o=g.options;
  // One pipeline: pen brushes always use the current segmenter; eraser and
  // scratch share the destination-out ribbon below.
  if(o.tool==='eraser'||o.tool==='scratch')return eraserRibbonSegment(ctx,g,a,b);
  const key=o.brush||'pencil',w=o.size/g.layer.scale,ratio=Math.max(.15,Math.min(2,o.ratio??1)),alpha=o.opacity,random=g.random||(g.random=seededRandom(o.seed??1));
  ctx.save();ctx.fillStyle=o.color;ctx.strokeStyle=o.color;ctx.globalAlpha=alpha;
  if(key==='rainbow'||key==='duotone'){
    const stops=gradientStops?.length===9?gradientStops:g.gradientStops?.length===9?g.gradientStops:prepareGradientStops(g,a,b);
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
    const spacing=Math.max(.8,w*(key==='effect'?.85:.12));
    const tip=key==='watercolor'?watercolorTip(ctx,g,w,o.color,alpha):null;
    if(tip)ctx.globalAlpha=1;
    if(key==='spray'||key==='crayon'||key==='chalk'){
      const paint=target=>walkDabs(g,a,b,spacing,(x,y)=>{
        target.save();target.translate(x,y);target.scale(ratio,1);
        particleDab(target,key,w,alpha,random);
        target.restore();
      });
      if(!drawSharedParticles(ctx,g,a,b,w,ratio,random,paint))paint(ctx);
      ctx.restore();
      return;
    }
    const dab=(x,y)=>{
      if(dabTransform){
        const {a,b,c,d,e,f}=dabTransform;
        const sourceX=x;
        x=a*sourceX+c*y+e;
        y=b*sourceX+d*y+f;
      }
      if(tip){
        const width=Math.ceil(w*1.08);
        if(ratio===1&&width===tip.width)ctx.drawImage(tip,Math.round(x-width/2),Math.round(y-width/2));
        else ctx.drawImage(tip,x-width*ratio/2,y-width/2,width*ratio,width);
        return;
      }
      ctx.save();ctx.translate(x,y);ctx.scale(ratio,1);ctx.globalAlpha=alpha;
      if(key==='watercolor'){
        ctx.fillStyle=watercolorGradient(ctx,o.color,w);ctx.fillRect(-w*.54,-w*.54,w*1.08,w*1.08);
      }else if(key==='effect'){
        ctx.rotate((random()-.5)*.7);ctx.fillStyle=o.color;ctx.strokeStyle=tint(o.color,-.2);ctx.lineWidth=Math.max(.8,w*.028);starPath(ctx,w*.45);ctx.fill();ctx.stroke();ctx.fillStyle=tint(o.color,.8);starPath(ctx,w*.2);ctx.fill();ctx.fillStyle=o.color;ctx.globalAlpha=alpha*.6;ctx.beginPath();ctx.arc(w*.5,-w*.38,w*.055,0,brushTau);ctx.fill();
      }
      ctx.restore();
    };
    walkDabs(g,a,b,spacing,dab);
  }
  ctx.restore();
}

// Eraser and scratch share one destination-out ribbon; a stroke owns its
// random stream so event timing never changes its texture.
export function eraserRibbonSegment(ctx, gesture, a, b) {
  const o=gesture.options, width=o.size/gesture.layer.scale, ratio=Math.max(.15,Math.min(2,o.ratio??1));
  const brush=o.tool==='eraser'?(o.eraserMode==='soft'?'soft-eraser':'eraser'):o.tool==='scratch'?'eraser':o.brush||'pencil';
  const random=gesture.random||(gesture.random=seededRandom(o.seed??1));
  const spacing=Math.max(.6,width*(brush==='spray'?.15:.12)),distance=Math.hypot(b.x-a.x,b.y-a.y);
  const steps=Math.max(1,Math.ceil(distance/spacing));
  ctx.save();ctx.fillStyle=o.color;ctx.strokeStyle=o.color;ctx.globalAlpha=o.opacity;
  if(o.tool==='eraser'||o.tool==='scratch')ctx.globalCompositeOperation='destination-out';
  // Marker and pencil use a continuous ribbon without overlapping translucent dabs.
  if(['pencil','marker','eraser'].includes(brush)&&ratio===1){
    ctx.lineWidth=width;ctx.lineCap=brush==='marker'?'square':'round';ctx.lineJoin='round';
    if(distance===0){ctx.beginPath();ctx.arc(a.x,a.y,width/2,0,Math.PI*2);ctx.fill();}
    else {ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}
  } else for(let step=distance===0?0:1;step<=steps;step++){
    if(distance===0&&step>0)break;
    const x=a.x+(b.x-a.x)*step/steps,y=a.y+(b.y-a.y)*step/steps;
    ctx.save();ctx.translate(x,y);ctx.scale(ratio,1);
    if(['spray','crayon','chalk'].includes(brush)){
      const count=brush==='spray'?32:24;ctx.globalAlpha*=brush==='chalk'?.5:.7;
      for(let j=0;j<count;j++){const angle=random()*Math.PI*2,r=Math.sqrt(random())*width/2,size=brush==='spray'?Math.max(.7,width/40):Math.max(1,width/12);ctx.fillRect(Math.cos(angle)*r,Math.sin(angle)*r,size,size);}
    } else if(['watercolor','soft','soft-eraser'].includes(brush)){
      const gradient=ctx.createRadialGradient(0,0,0,0,0,width/2);gradient.addColorStop(0,o.color);gradient.addColorStop(1,o.color+'00');ctx.fillStyle=gradient;ctx.globalAlpha*=brush==='soft-eraser'?.6:.15;ctx.fillRect(-width/2,-width/2,width,width);
    } else if(brush==='marker'){
      ctx.fillRect(-width/2,-width*.22,width,width*.44);
    } else if(brush==='brush'){
      ctx.globalAlpha*=.22;for(let j=0;j<7;j++){ctx.beginPath();ctx.ellipse((j-3)*width/9,0,width/13,width/2,0,0,Math.PI*2);ctx.fill();}
    } else if(brush==='tube'){
      ctx.beginPath();ctx.arc(0,0,width/2,0,Math.PI*2);ctx.fill();ctx.globalAlpha*=.4;ctx.fillStyle='#ffffff';ctx.beginPath();ctx.ellipse(-width*.15,-width*.15,width*.14,width*.32,-.6,0,Math.PI*2);ctx.fill();
    } else if(brush==='effect'){
      ctx.rotate(random()*Math.PI);ctx.lineWidth=Math.max(1,width/10);ctx.beginPath();ctx.moveTo(-width/2,0);ctx.lineTo(width/2,0);ctx.moveTo(0,-width/2);ctx.lineTo(0,width/2);ctx.stroke();
    } else {ctx.beginPath();ctx.ellipse(0,0,width/2,width/2,0,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
  ctx.restore();
}
