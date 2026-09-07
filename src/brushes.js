import { seededRandom } from './pixels.js';
import { legacyBrushSegment } from './brushes-legacy.js';

export const BRUSHES=[
  {id:'pencil',name:'铅笔',hint:'细细的线，勾轮廓',size:14,color:'#eca73b'},
  {id:'spray',name:'喷笔',hint:'点点雾气，轻轻喷',size:76,color:'#69abc1'},
  {id:'watercolor',name:'水彩',hint:'透明水色，叠着画',size:64,color:'#7b9cce'},
  {id:'brush',name:'刷子',hint:'一束笔毛，刷出纹路',size:42,color:'#b97c50'},
  {id:'marker',name:'麦克笔',hint:'扁扁笔头，涂大块',size:38,color:'#b287c8'},
  {id:'crayon',name:'蜡笔',hint:'厚厚蜡粒，沙沙画',size:36,color:'#ee8573'},
  {id:'chalk',name:'粉笔',hint:'软软粉末，毛茸茸',size:44,color:'#91b982'},
  {id:'tube',name:'颜料管',hint:'挤出颜料，亮亮的',size:32,color:'#f4ac59'},
  {id:'effect',name:'星光笔',hint:'拖一拖，撒下星星',size:48,color:'#df91b7'},
];
const brushTau=Math.PI*2;
function tint(hex,amount){return '#'+hex.slice(1).match(/../g).map(n=>{const c=parseInt(n,16);return Math.round(amount>0?c+(255-c)*amount:c*(1+amount)).toString(16).padStart(2,'0');}).join('');}
function ribbon(ctx,a,b,width,color,alpha,ox=0,oy=0){ctx.strokeStyle=color;ctx.fillStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=width;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();if(a.x===b.x&&a.y===b.y){ctx.arc(a.x+ox,a.y+oy,width/2,0,brushTau);ctx.fill();}else{ctx.moveTo(a.x+ox,a.y+oy);ctx.lineTo(b.x+ox,b.y+oy);ctx.stroke();}}
function starPath(ctx,r){ctx.beginPath();for(let i=0;i<10;i++){const angle=i*Math.PI/5-Math.PI/2,rad=i%2?r*.43:r;const x=Math.cos(angle)*rad,y=Math.sin(angle)*rad;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.closePath();}

export function brushSegment(ctx,g,a,b){
  const o=g.options;
  // Recordings without a version keep the 0.2/0.3 rendering rules.
  if(o.brushVersion!==2||o.tool==='eraser')return legacyBrushSegment(ctx,g,a,b);
  const key=o.brush||'pencil',w=o.size/g.layer.scale,ratio=Math.max(.15,Math.min(2,o.ratio??1)),alpha=o.opacity,random=g.random||(g.random=seededRandom(o.seed??1));
  ctx.save();ctx.fillStyle=o.color;ctx.strokeStyle=o.color;ctx.globalAlpha=alpha;
  if(key==='pencil'){
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
