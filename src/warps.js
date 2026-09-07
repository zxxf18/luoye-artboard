// Inverse mapping prevents holes; interpolate premultiplied colors at transparent edges.
export function warpPixels(source,width,height,options) {
  const kinds=['push','zoom','ripple','twist','waterfall','point-light','direction-light'];
  if(!kinds.includes(options.kind)||source.length!==width*height*4)throw new Error('变形参数无效。');
  const number=(key,fallback,min,max)=>{const v=options[key]??fallback;if(!Number.isFinite(v))throw new Error('变形参数必须为有限数值。');return Math.max(min,Math.min(max,v));};
  const kind=options.kind,cx=number('x',width/2,-100000,100000),cy=number('y',height/2,-100000,100000),radius=number('radius',120,1,4096),speed=number('speed',50,-100,100)/100,dx=number('dx',0,-4096,4096),dy=number('dy',0,-4096,4096),density=number('density',50,0,100)/100,angle=number('angle',0,-360,360)*Math.PI/180,curvature=number('curvature',120,-720,720)*Math.PI/180,spread=number('spread',30,0,100)/100,depth=number('height',50,0,100)/100;
  const output=new Uint8ClampedArray(source),left=Math.max(0,Math.floor(cx-radius)),right=Math.min(width-1,Math.ceil(cx+radius)),top=Math.max(0,Math.floor(cy-radius)),bottom=Math.min(height-1,Math.ceil(cy+radius));
  function sample(x,y,i){
    x=Math.max(0,Math.min(width-1,x));y=Math.max(0,Math.min(height-1,y));const x0=Math.floor(x),y0=Math.floor(y),x1=Math.min(width-1,x0+1),y1=Math.min(height-1,y0+1),fx=x-x0,fy=y-y0;
    const indices=[(y0*width+x0)*4,(y0*width+x1)*4,(y1*width+x0)*4,(y1*width+x1)*4],weights=[(1-fx)*(1-fy),fx*(1-fy),(1-fx)*fy,fx*fy];let a=0;const c=[0,0,0];
    for(let j=0;j<4;j++){const alpha=source[indices[j]+3]*weights[j];a+=alpha;for(let k=0;k<3;k++)c[k]+=source[indices[j]+k]*alpha;}output[i+3]=a;for(let k=0;k<3;k++)output[i+k]=a?c[k]/a:0;
  }
  for(let y=top;y<=bottom;y++)for(let x=left;x<=right;x++){
    const ox=x-cx,oy=y-cy,d=Math.hypot(ox,oy);if(d>=radius)continue;const t=1-d/radius,falloff=t*t*(3-2*t),i=(y*width+x)*4;
    if(kind==='point-light'||kind==='direction-light'){const directional=Math.max(0,1-Math.abs(ox*Math.cos(angle)+oy*Math.sin(angle))/radius),gain=density*falloff*(kind==='point-light'?1:directional);for(let k=0;k<3;k++)output[i+k]=source[i+k]+(255-source[i+k])*gain;continue;}
    let sx=x,sy=y;
    if(kind==='push'){sx-=dx*speed*falloff;sy-=dy*speed*falloff;}
    if(kind==='zoom'){const scale=Math.exp(-speed*.65*falloff);sx=cx+ox*scale;sy=cy+oy*scale;}
    if(kind==='ripple'&&d){const offset=Math.sin(d/radius*Math.PI*12)*radius*.035*falloff;sx+=ox/d*offset;sy+=oy/d*offset;}
    if(kind==='twist'){const a=curvature*falloff;sx=cx+ox*Math.cos(a)-oy*Math.sin(a);sy=cy+ox*Math.sin(a)+oy*Math.cos(a);}
    if(kind==='waterfall'){sx+=Math.sin(y/radius*(2+density*25)*Math.PI)*radius*spread*.15*falloff*(options.direction==='left'?-1:1);sy-=radius*depth*.35*falloff;}
    sample(sx,sy,i);
  }
  return output;
}
