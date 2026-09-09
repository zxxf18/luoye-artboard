import { runPaperEffect } from './animated-effects.js';
import { PaintEngine, makeCanvas, loadImage } from './engine.js';
import { toLayerPoint } from './core.js';
import { regionMask, combineMasks, blendMasked, applyEffect, rgb } from './pixels.js';
import { shapePath } from './geometry.js';

export class EditorEngine extends PaintEngine {
  reset(width,height) { this.selection=null;this.selectionCanvas=null;this.selectionBounds=null;super.reset(width,height);this.onSelectionChange?.(); }
  async restore(raw) { const title=await super.restore(raw);this.clearSelection();return title; }
  paint(ctx,guides=false) {
    super.paint(ctx,guides);
    if(!guides)return;
    ctx.save();ctx.setTransform(1,0,0,1,0,0);
    if(this.selectionCanvas){ctx.globalAlpha=.16;ctx.drawImage(this.selectionCanvas,0,0);ctx.globalAlpha=1;const b=this.selectionBounds;if(b){ctx.strokeStyle='#285b49';ctx.lineWidth=2;ctx.setLineDash([8,6]);ctx.strokeRect(b.x,b.y,b.width,b.height);}}
    const g=this.gesture;
    if(g?.kind==='select'){ctx.strokeStyle='#285b49';ctx.lineWidth=2;ctx.setLineDash([8,6]);ctx.stroke(shapePath(g.options.selectionShape||'rect',g.start,g.end,g.points));}
    if(g?.kind==='shape'){ctx.save();this.transform(ctx,g.layer);this.drawShape(ctx,g);ctx.restore();}
    ctx.restore();
  }
  setSelection(mask,operation='replace') {
    this.selection=combineMasks(this.selection,mask,operation);
    const c=makeCanvas(this.width,this.height),ctx=c.getContext('2d'),image=ctx.createImageData(this.width,this.height);
    let left=this.width,top=this.height,right=-1,bottom=-1;
    for(let i=0;i<mask.length;i++){image.data[i*4+1]=160;image.data[i*4+3]=this.selection[i];if(this.selection[i]){const x=i%this.width,y=Math.floor(i/this.width);left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}}
    ctx.putImageData(image,0,0);this.selectionCanvas=c;this.selectionBounds=right<0?null:{x:left,y:top,width:right-left+1,height:bottom-top+1};this.onSelectionChange?.();this.render();
  }
  selectShape(kind,a,b,operation='replace',points=[]) {
    const c=makeCanvas(this.width,this.height),ctx=c.getContext('2d');ctx.fill(shapePath(kind,a,b,points));
    const data=ctx.getImageData(0,0,this.width,this.height).data,mask=new Uint8ClampedArray(this.width*this.height);
    for(let i=0;i<mask.length;i++)mask[i]=data[i*4+3]>=128?255:0;this.setSelection(mask,operation);
  }
  clearSelection(){this.selection=null;this.selectionCanvas=null;this.selectionBounds=null;this.onSelectionChange?.();this.render();}
  selectAll(){this.setSelection(new Uint8ClampedArray(this.width*this.height).fill(255));}
  invertSelection(){this.setSelection(this.selection?this.selection.map(v=>255-v):new Uint8ClampedArray(this.width*this.height).fill(255));}
  layerOnPaper(layer) {
    const c=makeCanvas(this.width,this.height),ctx=c.getContext('2d');ctx.save();ctx.globalAlpha=layer.opacity;this.transform(ctx,layer);this.drawLayer(ctx,layer);ctx.restore();return c;
  }
  magicSelect(point,tolerance=20,operation='replace') {
    const c=this.paperMode?makeCanvas(this.width,this.height):this.layerOnPaper(this.active);if(this.paperMode)this.paint(c.getContext('2d'));const data=c.getContext('2d').getImageData(0,0,this.width,this.height).data;
    this.setSelection(regionMask(data,this.width,this.height,point.x,point.y,tolerance),operation);
  }
  selectionInLayer(layer) {
    if(!this.selectionCanvas)return null;
    const c=makeCanvas(layer.width,layer.height),ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;
    ctx.translate(layer.width/2,layer.height/2);ctx.scale(1/layer.scale,1/layer.scale);ctx.rotate(-layer.rotation*Math.PI/180);ctx.translate(-layer.x,-layer.y);ctx.drawImage(this.selectionCanvas,0,0);
    return c;
  }
  layerMask(layer) {
    const c=this.selectionInLayer(layer);if(!c)return null;
    const data=c.getContext('2d').getImageData(0,0,layer.width,layer.height).data,mask=new Uint8ClampedArray(layer.width*layer.height);
    for(let i=0;i<mask.length;i++)mask[i]=data[i*4+3]>=128?255:0;return mask;
  }
  maskTiles(layer,tiles,mask=this.layerMask(layer),bounds=null) {
    if(!mask)return;const ctx=layer.canvas.getContext('2d');
    for(const t of tiles.values()){
      if(bounds&&(t.x+t.before.width<bounds.x||t.y+t.before.height<bounds.y||t.x>bounds.x+bounds.width||t.y>bounds.y+bounds.height))continue;
      const image=ctx.getImageData(t.x,t.y,t.before.width,t.before.height);
      for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(!mask[(y+t.y)*layer.width+x+t.x]){const i=(y*image.width+x)*4;image.data.set(t.before.data.subarray(i,i+4),i);}
      ctx.putImageData(image,t.x,t.y);
    }
  }
  segment(a,b){super.segment(a,b);const g=this.gesture;if(g.selectionMask===undefined)g.selectionMask=this.layerMask(g.layer);this.maskTiles(g.layer,g.tiles,g.selectionMask);}
  recordPixels(layer,tiles){this.maskTiles(layer,tiles);super.recordPixels(layer,tiles);}
  assertRaster(){if(!this.active?.visible)throw new Error('请先显示当前图层。');if(this.active.frames?.length||this.active.sprites)throw new Error('动画层请先定格为图片，再修改像素。');}
  mutatePixels(callback) {
    this.assertRaster();const layer=this.active,ctx=layer.canvas.getContext('2d'),before=ctx.getImageData(0,0,layer.width,layer.height);
    const candidate=callback(new Uint8ClampedArray(before.data),layer.width,layer.height);
    const after=new ImageData(blendMasked(before.data,candidate,this.layerMask(layer)),layer.width,layer.height);
    ctx.putImageData(after,0,0);this.history.push({bytes:before.data.byteLength*2,undo:()=>ctx.putImageData(before,0,0),redo:()=>ctx.putImageData(after,0,0)});this.changed();
  }
  mutatePaper(callback){return runPaperEffect(this,callback);}
  clearPixels(){this.mutatePixels(data=>{for(let i=3;i<data.length;i+=4)data[i]=0;return data;});}
  applyDarkroom(kind,options={}){if(this.paperMode){const effect=(data,w,h)=>applyEffect(data,w,h,kind,options);effect.spaceIndependent=true;return this.mutatePaper(effect);}this.mutatePixels((data,w,h)=>applyEffect(data,w,h,kind,options));}
  effectPreview(kind,options={}){
    if(!this.paperMode)this.assertRaster();const layer=this.paperMode?{canvas:makeCanvas(this.width,this.height),width:this.width,height:this.height}:this.active;if(this.paperMode)this.paint(layer.canvas.getContext('2d'));const fit=Math.min(1,320/Math.max(layer.width,layer.height)),c=makeCanvas(Math.max(1,Math.round(layer.width*fit)),Math.max(1,Math.round(layer.height*fit))),ctx=c.getContext('2d');ctx.drawImage(layer.canvas,0,0,c.width,c.height);
    const pixels=ctx.getImageData(0,0,c.width,c.height);pixels.data.set(applyEffect(pixels.data,c.width,c.height,kind,options));ctx.putImageData(pixels,0,0);return c;
  }
  copySelection(cut=false){
    if(!this.paperMode)this.assertRaster();const bounds=this.selection?this.selectionBounds:{x:0,y:0,width:this.width,height:this.height};if(!bounds)throw new Error('选区是空的。');
    const paper=this.paperMode?makeCanvas(this.width,this.height):this.layerOnPaper(this.active),ctx=paper.getContext('2d');if(this.paperMode)this.paint(ctx);if(this.selectionCanvas){ctx.globalCompositeOperation='destination-in';ctx.drawImage(this.selectionCanvas,0,0);}
    const c=makeCanvas(bounds.width,bounds.height);c.getContext('2d').drawImage(paper,bounds.x,bounds.y,bounds.width,bounds.height,0,0,bounds.width,bounds.height);this.clipboard={canvas:c,bounds};if(cut)this.deleteSelection();return this.clipboard;
  }
  deleteSelection(){
    this.end();
    if(!this.paperMode){this.clearPixels();return;}
    const bounds=this.selection?this.selectionBounds:{x:0,y:0,width:this.width,height:this.height};
    if(!bounds)throw new Error('选区是空的。');
    // Share the paper eraser's masks, animation support and single undo entry.
    this.begin({x:bounds.x,y:bounds.y},{tool:'eraser',eraserMode:'rect',size:12,opacity:1});
    this.update({x:bounds.x+bounds.width,y:bounds.y+bounds.height});this.end();
  }
  paste(){if(!this.clipboard)throw new Error('请先复制或剪切一块画面。');const {canvas,bounds}=this.clipboard,c=makeCanvas(canvas.width,canvas.height);c.getContext('2d').drawImage(canvas,0,0);const layer=this.addLayer('粘贴的画',c,true,{x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2});this.clearSelection();return layer;}
  duplicateLayer(){const layer=this.active,c=makeCanvas(layer.width,layer.height);c.getContext('2d').drawImage(layer.canvas,0,0);const {id,canvas,role,...props}=layer;if(role==='background')delete props.sourceId;return this.addLayer(layer.name.slice(0,116)+' 副本',c,true,{...props,name:layer.name.slice(0,116)+' 副本'});}
  flipLayer(axis){
    this.assertRaster();if(this.selection)throw new Error('请先剪切并粘贴选区为独立层，再翻转。');
    const layer=this.active,before={canvas:layer.canvas,eraseMask:layer.eraseMask},c=makeCanvas(layer.width,layer.height),ctx=c.getContext('2d');
    ctx.translate(axis==='x'?layer.width:0,axis==='y'?layer.height:0);ctx.scale(axis==='x'?-1:1,axis==='y'?-1:1);this.drawLayer(ctx,layer);
    const apply=()=>{layer.canvas=c;delete layer.eraseMask;};apply();this.history.push({bytes:layer.width*layer.height*8,undo:()=>Object.assign(layer,before),redo:apply});this.changed();
  }

  mergeToBottom(){
    const layer=this.active,bottom=this.layers[0];if(layer===bottom)throw new Error('当前已经是最底层。');if(!layer.visible||!bottom.visible)throw new Error('合并前请先显示当前层和最底层。');if(layer.frames?.length||bottom.frames?.length||layer.sprites||bottom.sprites)throw new Error('合并前请先将动画层定格。');
    const before=this.layers.slice(),activeId=this.activeId,c=this.layerOnPaper(bottom),ctx=c.getContext('2d');ctx.globalAlpha=layer.opacity;this.transform(ctx,layer);this.drawLayer(ctx,layer);
    const merged={...bottom,canvas:c,width:this.width,height:this.height,x:this.width/2,y:this.height/2,scale:1,rotation:0,opacity:1,visible:true};
    delete merged.eraseMask;
    const after=[merged,...this.layers.slice(1).filter(l=>l!==layer)];this.layers=after;this.activeId=merged.id;
    this.history.push({bytes:(c.width*c.height+bottom.width*bottom.height+layer.width*layer.height)*4,undo:()=>{this.layers=before;this.activeId=activeId;},redo:()=>{this.layers=after;this.activeId=merged.id;}});this.changed();
  }
  freezeAnimation(){
    const layer=this.active;if(!layer.frames?.length&&!layer.sprites)return;
    const before={frames:layer.frames,sprites:layer.sprites,spriteGroups:layer.spriteGroups,spriteMask:layer.spriteMask,spriteClip:layer.spriteClip,canvas:layer.canvas,eraseMask:layer.eraseMask};
    const c=makeCanvas(layer.width,layer.height);this.drawLayer(c.getContext('2d'),layer);
    const freeze=()=>{layer.canvas=c;for(const key of ['frames','sprites','spriteGroups','spriteMask','spriteClip','eraseMask'])delete layer[key];};
    freeze();this.history.push({bytes:c.width*c.height*4,undo:()=>Object.assign(layer,before),redo:freeze});this.changed();
  }
  frameIndex(layer){return Math.floor((this.playing?performance.now()-this.animationStart:this.animationTime||0)/layer.frameDuration)%layer.frames.length;}
  toggleAnimation(){if(this.playing){this.animationTime=performance.now()-this.animationStart;this.playing=false;}else{this.animationStart=performance.now()-(this.animationTime||0);this.playing=true;}this.staticComposite=null;this.render();}
  begin(point,options){
    if(options.tool==='select'){this.gesture={kind:'select',options:{...options},start:point,end:point,points:[point]};return;}
    if(options.tool==='magic'){this.magicSelect(point,options.tolerance,options.selectionMode);return;}
    if(options.tool==='fill'){
      this.assertRaster();if(['region','all'].includes(options.fillMode||'region')){this.fillAt(point,options);return;}
      this.gesture={kind:'fill',options:{...options},start:point,end:point};return;
    }
    if(['triangle','pentagon','hexagon','roundrect','star'].includes(options.tool)){
      this.assertRaster();const local=toLayerPoint(point,this.active);this.gesture={kind:'shape',layer:this.active,options:{...options},start:local,end:local,tiles:new Map()};return;
    }
    super.begin(point,options);
  }
  update(point){const g=this.gesture;if(g?.kind){g.end=g.kind==='shape'?toLayerPoint(point,g.layer):point;if(g.points)g.points.push(point);this.render();return;}super.update(point);}
  end(cancel=false){
    const g=this.gesture;if(!g?.kind){super.end(cancel);return;}this.gesture=null;
    if(!cancel){if(g.kind==='select')this.selectShape(g.options.selectionShape||'rect',g.start,g.end,g.options.selectionMode,g.points);
      if(g.kind==='fill')this.fillAt(g.start,g.options,g.end);
      if(g.kind==='shape'){this.captureTiles(g.layer,{x:0,y:0,width:g.layer.width,height:g.layer.height},g.tiles);const ctx=g.layer.canvas.getContext('2d');ctx.save();this.drawShape(ctx,g);ctx.restore();this.recordPixels(g.layer,g.tiles);this.changed();}}
    this.render();
  }
  drawShape(ctx,g){const o=g.options,paint=o.fillSource==='texture'&&this.paintTexture?ctx.createPattern(this.paintTexture.canvas,'repeat'):o.color;ctx.strokeStyle=paint;ctx.fillStyle=paint;ctx.lineWidth=o.size/g.layer.scale;ctx.globalAlpha*=o.opacity;ctx.lineCap='round';if(o.dashed)ctx.setLineDash([ctx.lineWidth*3,ctx.lineWidth*2]);const path=shapePath(o.tool,g.start,g.end,g.points);if(o.filled)ctx.fill(path);else ctx.stroke(path);}
  fillAt(point,options,end=point){
    const layer=this.active,start=toLayerPoint(point,layer),finish=toLayerPoint(end,layer),mode=options.fillMode||'region';
    const composite=this.paperMode?makeCanvas(this.width,this.height):null;if(composite)this.paint(composite.getContext('2d'));
    const color=rgb(options.color||'#285b49'),background=rgb(options.background||'#ffffff'),alpha=Math.round((options.opacity??1)*255);
    this.mutatePixels((data,w,h)=>{
      const selected=mode.startsWith('region')?regionMask(composite?composite.getContext('2d').getImageData(0,0,w,h).data:data,w,h,start.x,start.y,options.tolerance??20):null;
      const dx=finish.x-start.x,dy=finish.y-start.y,length=dx*dx+dy*dy;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const n=y*w+x;if(selected&&!selected[n])continue;
        if(mode==='rect'&&(x<Math.min(start.x,finish.x)||x>Math.max(start.x,finish.x)||y<Math.min(start.y,finish.y)||y>Math.max(start.y,finish.y)))continue;
        if(mode==='ellipse'&&((x-(start.x+finish.x)/2)**2/Math.max(.01,dx*dx/4)+(y-(start.y+finish.y)/2)**2/Math.max(.01,dy*dy/4)>1))continue;
        const t=mode.includes('gradient')||options.gradient?Math.max(0,Math.min(1,length?((x-start.x)*dx+(y-start.y)*dy)/length:0)):0;
        const texture=options.fillSource==='texture'?this.paintTexture:null;
        if(texture){const index=((y%texture.height)*texture.width+x%texture.width)*4;for(let k=0;k<3;k++)data[n*4+k]=texture.pixels[index+k];data[n*4+3]=alpha*texture.pixels[index+3]/255;}
        else{for(let k=0;k<3;k++)data[n*4+k]=color[k]+(background[k]-color[k])*t;data[n*4+3]=alpha;}
      }
      return data;
    });
  }
}
