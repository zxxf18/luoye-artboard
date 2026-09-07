import { makeCanvas } from './engine.js';

export function renderStyledText(spec,texture=null) {
  const s={size:72,font:'sans-serif',color:'#000000',background:'#ffffff',antialias:true,...spec};
  if(typeof s.text!=='string'||s.text.length>1000||!Number.isFinite(s.size)||s.size<12||s.size>400||typeof s.font!=='string'||s.font.length>120)throw new Error('文字最多 1000 字，字号需在 12～400 之间。');
  const lines=s.text.split('\n');if(lines.length>20)throw new Error('每个文字图层最多 20 行。');
  const font=`${s.italic?'italic ':''}${s.bold?'bold ':''}${s.size}px ${JSON.stringify(s.font)}, sans-serif`;
  const probe=makeCanvas(1,1).getContext('2d');probe.font=font;const pad=Math.ceil(s.size*.45),lineHeight=Math.ceil(s.size*1.35),width=Math.ceil(Math.max(1,...lines.map(line=>probe.measureText(line).width)))+pad*2,height=lineHeight*lines.length+pad*2;
  if(width>4096||height>4096||width*height>8388608)throw new Error('文字太宽或太高，请换行或减小字号。');
  const mask=makeCanvas(width,height),ctx=mask.getContext('2d');ctx.font=font;ctx.textBaseline='alphabetic';ctx.fillStyle='#ffffff';ctx.strokeStyle='#ffffff';ctx.lineWidth=Math.max(1,s.size/24);ctx.lineJoin='round';
  for(let i=0;i<lines.length;i++){const y=pad+s.size+i*lineHeight,line=lines[i],w=probe.measureText(line).width;if(s.outline)ctx.strokeText(line,pad,y);else ctx.fillText(line,pad,y);const t=Math.max(1,Math.round(s.size/18));if(s.underline)ctx.fillRect(pad,y+s.size*.13,w,t);if(s.strike)ctx.fillRect(pad,y-s.size*.33,w,t);}
  if(!s.antialias){const p=ctx.getImageData(0,0,width,height);for(let i=3;i<p.data.length;i+=4)p.data[i]=p.data[i]>=128?255:0;ctx.putImageData(p,0,0);}
  const glyph=makeCanvas(width,height),g=glyph.getContext('2d');g.drawImage(mask,0,0);g.globalCompositeOperation='source-in';
  if(texture)g.fillStyle=g.createPattern(texture,'repeat');else if(s.gradient){const gradient=g.createLinearGradient(0,pad,0,height-pad);gradient.addColorStop(0,s.color);gradient.addColorStop(1,s.background);g.fillStyle=gradient;}else g.fillStyle=s.color;g.fillRect(0,0,width,height);
  const composed=makeCanvas(width,height),c=composed.getContext('2d');if(s.shadow){const shadow=makeCanvas(width,height),sc=shadow.getContext('2d');sc.drawImage(mask,0,0);sc.globalCompositeOperation='source-in';sc.fillStyle=s.background;sc.fillRect(0,0,width,height);c.drawImage(shadow,Math.max(2,s.size*.08),Math.max(2,s.size*.08));}c.drawImage(glyph,0,0);
  if(!s.flipX&&!s.flipY)return composed;const output=makeCanvas(width,height),o=output.getContext('2d');o.translate(s.flipX?width:0,s.flipY?height:0);o.scale(s.flipX?-1:1,s.flipY?-1:1);o.drawImage(composed,0,0);return output;
}
