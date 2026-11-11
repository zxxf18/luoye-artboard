// Inverse mapping prevents holes; interpolate premultiplied colors at transparent edges.
export function warpPixels(source,width,height,options,originY=0) {
  const kinds=['push','zoom','ripple','twist','waterfall','point-light','direction-light'];
  if(!kinds.includes(options.kind)||source.length!==width*height*4)throw new Error('变形参数无效。');
  const number=(key,fallback,min,max)=>{const v=options[key]??fallback;if(!Number.isFinite(v))throw new Error('变形参数必须为有限数值。');return Math.max(min,Math.min(max,v));};
  const kind=options.kind,cx=number('x',width/2,-100000,100000),cy=number('y',height/2,-100000,100000),radius=number('radius',120,1,4096),speed=number('speed',50,-100,100)/100,dx=number('dx',0,-4096,4096),dy=number('dy',0,-4096,4096),density=number('density',50,0,100)/100,angle=number('angle',0,-360,360)*Math.PI/180,curvature=number('curvature',120,-720,720)*Math.PI/180,spread=number('spread',30,0,100)/100,depth=number('height',50,0,100)/100;
  const output=new Uint8ClampedArray(source),left=Math.max(0,Math.floor(cx-radius)),right=Math.min(width-1,Math.ceil(cx+radius)),top=Math.max(0,Math.floor(cy-radius)),bottom=Math.min(height-1,Math.ceil(cy+radius));
  function sample(x,y,i){
    x=Math.max(0,Math.min(width-1,x));y=Math.max(0,Math.min(height-1,y));const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1),fx=x-x0,fy=y-y0;
    const i00=(y0*width+x0)*4,i10=(y0*width+x1)*4,i01=(y1*width+x0)*4,i11=(y1*width+x1)*4;
    const a00=source[i00+3]*((1-fx)*(1-fy)),a10=source[i10+3]*(fx*(1-fy));
    const a01=source[i01+3]*((1-fx)*fy),a11=source[i11+3]*(fx*fy);
    const alpha=a00+a10+a01+a11;
    output[i+3]=alpha;
    for(let k=0;k<3;k++)output[i+k]=alpha?(source[i00+k]*a00+source[i10+k]*a10+source[i01+k]*a01+source[i11+k]*a11)/alpha:0;
  }
  const squaredRadius=radius*radius,light=kind==='point-light'||kind==='direction-light';
  const cos=Math.cos(angle),sin=Math.sin(angle);
  const waterfall=kind==='waterfall'?(options.direction==='left'?-1:1)*radius*spread*.15:0;
  for(let y=top;y<=bottom;y++){
    const oy=y-cy,ySquared=oy*oy;
    const wave=waterfall?Math.sin((y+originY)/radius*(2+density*25)*Math.PI)*waterfall:0;
    for(let x=left;x<=right;x++){
      const ox=x-cx,dSquared=ox*ox+ySquared;if(dSquared>=squaredRadius)continue;
      const d=Math.sqrt(dSquared),t=1-d/radius,falloff=t*t*(3-2*t),i=(y*width+x)*4;
      if(light){
        const directional=kind==='point-light'?1:Math.max(0,1-Math.abs(ox*cos+oy*sin)/radius);
        const gain=density*falloff*directional;
        for(let k=0;k<3;k++)output[i+k]=source[i+k]+(255-source[i+k])*gain;
        continue;
      }
      let sx=x,sy=y;
      if(kind==='push'){sx-=dx*speed*falloff;sy-=dy*speed*falloff;}
      if(kind==='zoom'){const scale=Math.exp(-speed*.65*falloff);sx=cx+ox*scale;sy=cy+oy*scale;}
      if(kind==='ripple'&&d){const offset=Math.sin(d/radius*Math.PI*12)*radius*.035*falloff;sx+=ox/d*offset;sy+=oy/d*offset;}
      if(kind==='twist'){const a=curvature*falloff;sx=cx+ox*Math.cos(a)-oy*Math.sin(a);sy=cy+ox*Math.sin(a)+oy*Math.cos(a);}
      if(kind==='waterfall'){sx+=wave*falloff;sy-=radius*depth*.35*falloff;}
      sample(sx,sy,i);
    }
  }
  return output;
}

// Read only the affected pixels and the neighboring source pixels needed by
// inverse sampling. Selection alpha is applied in the original layer space.
export function applyWarpRegion(ctx,options,mask){
  const {width,height}=ctx.canvas;
  if(options.kind==='push'&&(!options.dx&&!options.dy||options.speed===0))return;
  const cx=options.x??width/2,cy=options.y??height/2;
  const radius=Math.max(1,Math.min(4096,options.radius??120));
  const left=Math.max(0,Math.floor(cx-radius)),top=Math.max(0,Math.floor(cy-radius));
  const right=Math.min(width,Math.ceil(cx+radius)+1),bottom=Math.min(height,Math.ceil(cy+radius)+1);
  if(left>=right||top>=bottom)return;
  const shift=options.kind==='push'?Math.max(Math.abs(options.dx||0),Math.abs(options.dy||0))
    :options.kind==='zoom'&&(options.speed??50)<0?radius:options.kind==='waterfall'?radius*.35:options.kind==='ripple'?radius*.035:0;
  const pad=Math.ceil(shift)+1;
  const x=Math.max(0,left-pad),y=Math.max(0,top-pad);
  const w=Math.min(width,right+pad)-x,h=Math.min(height,bottom+pad)-y;
  const before=ctx.getImageData(x,y,w,h);
  let hasPaint=false;
  for(let i=3;i<before.data.length;i+=4)if(before.data[i]){hasPaint=true;break;}
  if(!hasPaint)return;
  const after=warpPixels(before.data,w,h,{...options,x:cx-x,y:cy-y,radius},y);
  if(mask)for(let py=top;py<bottom;py++)for(let px=left;px<right;px++){
    const opacity=mask[py*width+px]/255;
    if(opacity===1)continue;
    const i=((py-y)*w+px-x)*4;
    for(let k=0;k<4;k++)after[i+k]=before.data[i+k]+(after[i+k]-before.data[i+k])*opacity;
  }
  ctx.putImageData(new ImageData(after,w,h),x,y,left-x,top-y,right-left,bottom-top);
}
