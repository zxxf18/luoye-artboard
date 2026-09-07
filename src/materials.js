import { makeCanvas } from './engine.js';
import { brushSegment } from './brushes.js';

export function textureData(image){
  if(!image)return null;if(image.width<1||image.height<1||image.width>2048||image.height>2048)throw new Error('纹理边长最多 2048。');
  const canvas=makeCanvas(image.width,image.height);canvas.getContext('2d').drawImage(image,0,0);return {canvas,width:canvas.width,height:canvas.height,pixels:canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data};
}

export function materialSegment(ctx,g,a,b,texture,paper,bounds){
  const left=Math.max(0,Math.floor(bounds.x)),top=Math.max(0,Math.floor(bounds.y)),right=Math.min(g.layer.width,Math.ceil(bounds.x+bounds.width)),bottom=Math.min(g.layer.height,Math.ceil(bounds.y+bounds.height));if(right<=left||bottom<=top)return;
  const c=makeCanvas(right-left,bottom-top),tmp=c.getContext('2d');tmp.translate(-left,-top);brushSegment(tmp,g,a,b);tmp.setTransform(1,0,0,1,0,0);const image=tmp.getImageData(0,0,c.width,c.height);
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
    const i=(y*c.width+x)*4;if(!image.data[i+3])continue;
    if(texture){const n=(((y+top)%texture.height)*texture.width+(x+left)%texture.width)*4;for(let k=0;k<3;k++)image.data[i+k]=texture.pixels[n+k];image.data[i+3]*=texture.pixels[n+3]/255;}
    if(paper){const n=(((y+top)%paper.height)*paper.width+(x+left)%paper.width)*4;const light=(paper.pixels[n]+paper.pixels[n+1]+paper.pixels[n+2])/765;image.data[i+3]*=1-Math.max(0,Math.min(1,g.options.paperGrain||0))*(1-light)*.8;}
  }
  tmp.putImageData(image,0,0);ctx.drawImage(c,left,top);
}
