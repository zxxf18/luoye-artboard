import { seededRandom } from './pixels.js';

// A stroke owns its random stream so event timing never changes its texture.
export function legacyBrushSegment(ctx, gesture, a, b) {
  const o=gesture.options, width=o.size/gesture.layer.scale, ratio=Math.max(.15,Math.min(2,o.ratio??1));
  const brush=o.tool==='eraser'?(o.eraserMode==='soft'?'soft-eraser':'eraser'):o.brush||'pencil';
  const random=gesture.random||(gesture.random=seededRandom(o.seed??1));
  const spacing=Math.max(.6,width*(brush==='spray'?.15:.12)),distance=Math.hypot(b.x-a.x,b.y-a.y);
  const steps=Math.max(1,Math.ceil(distance/spacing));
  ctx.save();ctx.fillStyle=o.color;ctx.strokeStyle=o.color;ctx.globalAlpha=o.opacity;
  if(o.tool==='eraser')ctx.globalCompositeOperation='destination-out';
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
