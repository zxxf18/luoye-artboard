import { seededRandom, rgb } from './pixels.js';

export async function generateFractal(options,{signal,onProgress=()=>{}}={}) {
  const {kind,width,height}=options;
  if(!['ifs','mandel','julia'].includes(kind))throw new Error('此分形公式尚未核实，不能作为已还原算法生成。');
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<16||height<16||width>2560||height>2560||width*height>4000000)throw new Error('分形需在 16～2560 边长和 4 百万像素内。');
  const value=(key,fallback,min,max)=>{const n=options[key]??fallback;if(!Number.isFinite(n))throw new Error('分形参数无效。');return Math.max(min,Math.min(max,n));};
  const check=()=>{if(signal?.aborted)throw new DOMException('已取消生成','AbortError');};check();
  const data=new Uint8ClampedArray(width*height*4),preset=Math.floor(value('preset',0,0,19)),random=seededRandom(value('seed',1,0,0xffffffff));
  if(kind==='ifs'){
    const density=value('density',50,1,100),count=Math.round(width*height*density/10),color=rgb(options.color||'#ff40b5');let x=0,y=0;
    for(let i=0;i<count;i++){
      const r=random(),oldX=x,oldY=y;let px,py;
      if(preset%3===0){if(r<.01){x=0;y=.16*oldY;}else if(r<.86){x=.85*oldX+.04*oldY;y=-.04*oldX+.85*oldY+1.6;}else if(r<.93){x=.2*oldX-.26*oldY;y=.23*oldX+.22*oldY+1.6;}else{x=-.15*oldX+.28*oldY;y=.26*oldX+.24*oldY+.44;}px=(x+2.5)/5;py=1-y/10;}
      else if(preset%3===1){if(r<.1){x=.05*oldX;y=.6*oldY;}else{const a=(r<.55?1:-1)*.48;x=.72*(oldX*Math.cos(a)-oldY*Math.sin(a));y=.72*(oldX*Math.sin(a)+oldY*Math.cos(a))+.55;}px=(x+1.3)/2.6;py=1-y/2.4;}
      else{const a=Math.floor(r*6)*Math.PI/3;x=.36*oldX+.62*Math.cos(a);y=.36*oldY+.62*Math.sin(a);px=(x+1.05)/2.1;py=(y+1.05)/2.1;}
      if(i>20){const ix=Math.floor(px*(width-1)),iy=Math.floor(py*(height-1));if(ix>=0&&ix<width&&iy>=0&&iy<height)data.set([...color,255],(iy*width+ix)*4);}
      if(i%24000===0){check();onProgress(i/count);await new Promise(resolve=>setTimeout(resolve,0));}
    }
  }else{
    const left=value('left',kind==='mandel'?-2.3:-1.8,-10,10),right=value('right',kind==='mandel'?1:1.8,-10,10),top=value('top',-1.3,-10,10),bottom=value('bottom',1.3,-10,10);if(right<=left||bottom<=top)throw new Error('右边界必须大于左边界，下边界必须大于上边界。');
    const constants=[[-.8,.156],[-.4,.6],[.285,.01],[-.70176,-.3842]],limit=180,[jx,jy]=constants[preset%constants.length];
    for(let y=0;y<height;y++){
      for(let x=0;x<width;x++){
        const px=left+x/(width-1)*(right-left),py=top+y/(height-1)*(bottom-top);let zx=kind==='julia'?px:0,zy=kind==='julia'?py:0,cx=kind==='julia'?jx:px,cy=kind==='julia'?jy:py,n=0;
        while(zx*zx+zy*zy<4&&n<limit){const next=zx*zx-zy*zy+cx;zy=2*zx*zy+cy;zx=next;n++;}
        const i=(y*width+x)*4;data[i+3]=255;if(n===limit)continue;const t=n*.09+preset*.45;data[i]=127+127*Math.sin(t);data[i+1]=127+127*Math.sin(t+2.1);data[i+2]=127+127*Math.sin(t+4.2);
      }
      if(y%8===0){check();onProgress(y/height);await new Promise(resolve=>setTimeout(resolve,0));}
    }
  }
  check();onProgress(1);return {width,height,data};
}
