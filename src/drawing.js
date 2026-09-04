import { EditorEngine } from './editor.js';
import { makeCanvas } from './engine.js';
import { toLayerPoint } from './core.js';
import { shapePath } from './geometry.js';
import { brushSegment } from './brushes.js';
import { warpPixels } from './warps.js';

export class DrawingEngine extends EditorEngine {
  applyBoardFilter(kind,options={}){this.mutatePixels((data,w,h)=>warpPixels(data,w,h,{...options,kind}));}
  warpDab(point){
    const g=this.gesture,l=g.layer,radius=Math.max(1,Math.min(600,g.options.radius||120))/l.scale,dx=point.x-g.last.x,dy=point.y-g.last.y,ctx=l.canvas.getContext('2d');
    const pad=Math.ceil(radius+Math.max(Math.abs(dx),Math.abs(dy))+3),x=Math.max(0,Math.floor(point.x-pad)),y=Math.max(0,Math.floor(point.y-pad)),w=Math.min(l.width,x+pad*2)-x,h=Math.min(l.height,y+pad*2)-y;if(w<=0||h<=0){g.last=point;return;}
    const bounds={x,y,width:w,height:h};this.captureTiles(l,bounds,g.tiles);const before=ctx.getImageData(x,y,w,h);before.data.set(warpPixels(before.data,w,h,{...g.options,kind:g.options.warpKind||'push',x:point.x-x,y:point.y-y,dx,dy,radius}));ctx.putImageData(before,x,y);if(g.selectionMask===undefined)g.selectionMask=this.layerMask(l);this.maskTiles(l,g.tiles,g.selectionMask,bounds);g.last=point;this.render();
  }
  reset(w,h){this.path=null;this.cloneSource=null;super.reset(w,h);}
  async restore(raw){const title=await super.restore(raw);this.path=null;this.cloneSource=null;return title;}
  clearLayer(){const selection=this.selection,canvas=this.selectionCanvas,bounds=this.selectionBounds;this.clearSelection();try{this.clearPixels();}finally{this.selection=selection;this.selectionCanvas=canvas;this.selectionBounds=bounds;this.render();}}
  setCloneSource(point){this.cloneSource={point:toLayerPoint(point,this.active),layerId:this.activeId};}
  setStampImages(images){this.fairyGroups=null;this.stampImages=images.map(image=>{const c=makeCanvas(image.width,image.height);c.getContext('2d').drawImage(image,0,0);return c;});}
  setFairyGroups(groups,mode){this.setStampImages(groups.map(group=>group.frames[0]));this.fairyGroups=groups;this.fairyMode=mode;}
  dynamicDab(point){
    const g=this.gesture,group=this.fairyGroups[g.stampIndex++%this.fairyGroups.length],image=group.frames[0],canvas=makeCanvas(image.width,image.height);
    canvas.getContext('2d').drawImage(image,0,0);
    const scale=g.options.size/Math.max(image.width,image.height),mask=this.layerMask({width:canvas.width,height:canvas.height,x:point.x,y:point.y,scale,rotation:0});let frames=group.frames;
    if(mask){const clip=makeCanvas(canvas.width,canvas.height),pixels=clip.getContext('2d').createImageData(clip.width,clip.height);for(let i=0;i<mask.length;i++)pixels.data[i*4+3]=mask[i];clip.getContext('2d').putImageData(pixels,0,0);frames=frames.map(frame=>{const c=makeCanvas(canvas.width,canvas.height),ctx=c.getContext('2d');ctx.drawImage(frame,0,0);ctx.globalCompositeOperation='destination-in';ctx.drawImage(clip,0,0);return c;});canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);canvas.getContext('2d').drawImage(frames[0],0,0);}
    try{this.addLayer('动态仙女袋',canvas,false,{x:point.x,y:point.y,scale,opacity:g.options.opacity,frames,frameDuration:group.frameDuration||160});}
    catch(error){if(!g.limitNotice){this.notice?.(error.message);g.limitNotice=true;}}
  }
  useLayerAsStamp(){this.setStampImages(this.active.frames?.length?this.active.frames:[this.active.canvas]);}
  paint(ctx,guides=false){
    super.paint(ctx,guides);if(!guides)return;
    if(this.path){const p=this.path;ctx.save();if(!p.select)this.transform(ctx,p.layer);ctx.strokeStyle=p.options.color||'#285b49';ctx.lineWidth=2;ctx.stroke(shapePath(p.options.tool,p.points[0],p.points.at(-1),p.points));ctx.setLineDash([5,4]);ctx.beginPath();p.points.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.stroke();for(const v of p.points){ctx.fillStyle='#ffffff';ctx.fillRect(v.x-4,v.y-4,8,8);ctx.strokeRect(v.x-4,v.y-4,8,8);}ctx.restore();}
    const g=this.gesture;if(g?.kind==='brush-line'||g?.kind==='erase-rect'){ctx.save();this.transform(ctx,g.layer);ctx.strokeStyle=g.options.color;ctx.lineWidth=g.options.size/g.layer.scale;ctx.globalAlpha=.5;ctx.beginPath();if(g.kind==='erase-rect')ctx.rect(g.start.x,g.start.y,g.end.x-g.start.x,g.end.y-g.start.y);else{ctx.moveTo(g.start.x,g.start.y);ctx.lineTo(g.end.x,g.end.y);}ctx.stroke();ctx.restore();}
  }
  addVertex(point,options){
    const select=options.tool==='select-bezier';if(!select)this.assertRaster();
    if(!this.path)this.path={select,layer:this.active,options:{...options,tool:select?'bezier':options.tool},points:[]};
    const p=select?point:toLayerPoint(point,this.path.layer);if(this.path.points.length>=1000)throw new Error('此路径最多 1000 个控制点。');
    const last=this.path.points.at(-1);if(!last||Math.hypot(p.x-last.x,p.y-last.y)>1)this.path.points.push(p);this.render();
  }
  finishPath(cancel=false){
    const p=this.path;if(!p)return;
    if(!cancel&&p.options.tool==='bezier'&&(p.points.length<4||(p.points.length-1)%3))throw new Error('Bezier 需要起点，再依次添加两个控制点和一个终点（4、7、10…点）。');
    this.path=null;if(cancel){this.render();return;}
    if(p.points.length<3){this.render();return;}
    const a=p.points[0],b=p.points.at(-1);
    if(p.select)this.selectShape('bezier',a,b,p.options.selectionMode,p.points);
    else {const tiles=new Map();this.captureTiles(p.layer,{x:0,y:0,width:p.layer.width,height:p.layer.height},tiles);const ctx=p.layer.canvas.getContext('2d');ctx.save();this.drawShape(ctx,{...p,start:a,end:b});ctx.restore();this.recordPixels(p.layer,tiles);this.changed();}
    this.render();
  }
  begin(point,options){
    options={...options,seed:options.seed??(Date.now()>>>0)};
    if(options.tool==='warp'){this.assertRaster();const local=toLayerPoint(point,this.active);this.gesture={kind:'warp',layer:this.active,options,last:local,tiles:new Map()};if(options.warpKind==='zoom')this.warpDab(local);return;}
    if(options.tool==='board-filter'){this.assertRaster();const local=toLayerPoint(point,this.active);this.applyBoardFilter(options.filterKind||'ripple',{...options,x:local.x,y:local.y,radius:(options.radius||120)/this.active.scale});return;}
    if((options.tool==='pen'&&options.strokeMode==='line')||(options.tool==='eraser'&&options.eraserMode==='rect')){
      this.assertRaster();const local=toLayerPoint(point,this.active);this.gesture={kind:options.tool==='pen'?'brush-line':'erase-rect',layer:this.active,options,start:local,end:local,tiles:new Map()};return;
    }
    if(options.tool==='stamp'&&this.fairyGroups&&this.fairyMode==='dynamic'){this.gesture={kind:'fairy-dynamic',options,start:point,end:point,last:point,stampIndex:0,travel:0,beforeLayers:this.layers.slice(),beforeActive:this.activeId};this.dynamicDab(point);return;}
    if(['stamp','clone'].includes(options.tool)){
      this.assertRaster();const layer=this.active,local=toLayerPoint(point,layer);
      if(options.tool==='stamp'&&!this.stampImages?.length)throw new Error('先从图层操作中选择「用作印章」。');
      if(options.tool==='clone'&&this.cloneSource?.layerId!==layer.id)throw new Error('请先按住 Ctrl 点击当前层上的仿制源点。');
      const g={kind:options.tool,layer,options,start:local,end:local,last:local,tiles:new Map(),stampIndex:0,travel:0};
      if(options.tool==='clone'){g.source=makeCanvas(layer.width,layer.height);g.source.getContext('2d').drawImage(layer.canvas,0,0);g.offset={x:this.cloneSource.point.x-local.x,y:this.cloneSource.point.y-local.y};}
      this.gesture=g;this.specialDab(local);return;
    }
    super.begin(point,options);
  }
  segment(a,b){
    const g=this.gesture,width=g.options.size/g.layer.scale,pad=width*2+4;
    const bounds={x:Math.min(a.x,b.x)-pad,y:Math.min(a.y,b.y)-pad,width:Math.abs(b.x-a.x)+pad*2,height:Math.abs(b.y-a.y)+pad*2};this.captureTiles(g.layer,bounds,g.tiles);
    brushSegment(g.layer.canvas.getContext('2d'),g,a,b);
    if(g.selectionMask===undefined)g.selectionMask=this.layerMask(g.layer);this.maskTiles(g.layer,g.tiles,g.selectionMask,bounds);this.render();
  }
  specialDab(p){
    const g=this.gesture,o=g.options,ctx=g.layer.canvas.getContext('2d'),size=o.size/g.layer.scale;
    this.captureTiles(g.layer,{x:p.x-size*2,y:p.y-size*2,width:size*4,height:size*4},g.tiles);ctx.save();ctx.globalAlpha=o.opacity;
    if(g.kind==='clone'){ctx.beginPath();ctx.arc(p.x,p.y,size/2,0,Math.PI*2);ctx.clip();ctx.drawImage(g.source,-g.offset.x,-g.offset.y);}
    else{const image=this.stampImages[g.stampIndex++%this.stampImages.length],scale=size/Math.max(image.width,image.height);ctx.drawImage(image,p.x-image.width*scale/2,p.y-image.height*scale/2,image.width*scale,image.height*scale);}
    ctx.restore();if(g.selectionMask===undefined)g.selectionMask=this.layerMask(g.layer);this.maskTiles(g.layer,g.tiles,g.selectionMask);this.render();
  }
  update(point){
    const g=this.gesture;if(!g){super.update(point);return;}
    if(g.kind==='warp'){this.warpDab(toLayerPoint(point,g.layer));return;}
    if(['brush-line','erase-rect'].includes(g.kind)){g.end=toLayerPoint(point,g.layer);this.render();return;}
    if(g.kind==='fairy-dynamic'){const dx=point.x-g.last.x,dy=point.y-g.last.y,distance=Math.hypot(dx,dy),spacing=Math.max(1,g.options.size*(g.options.stampSpacing??.7));for(let d=spacing-g.travel;d<=distance;d+=spacing)this.dynamicDab({x:g.last.x+dx*d/distance,y:g.last.y+dy*d/distance});g.travel=(g.travel+distance)%spacing;g.last=point;g.end=point;return;}
    if(['stamp','clone'].includes(g.kind)){
      const end=toLayerPoint(point,g.layer),dx=end.x-g.last.x,dy=end.y-g.last.y,distance=Math.hypot(dx,dy),spacing=Math.max(.5,g.options.size/g.layer.scale*(g.kind==='clone'?.15:g.options.stampSpacing??.7));
      for(let d=spacing-g.travel;d<=distance;d+=spacing)this.specialDab({x:g.last.x+dx*d/distance,y:g.last.y+dy*d/distance});
      g.travel=(g.travel+distance)%spacing;g.last=end;g.end=end;return;
    }
    super.update(point);
  }
  end(cancel=false){
    const g=this.gesture;
    if(g?.kind==='warp'){if(cancel){const ctx=g.layer.canvas.getContext('2d');for(const t of g.tiles.values())ctx.putImageData(t.before,t.x,t.y);}else this.recordPixels(g.layer,g.tiles);this.gesture=null;this.changed();return;}
    if(g?.kind==='fairy-dynamic'){const after=this.layers.slice(),active=this.activeId;if(cancel){this.layers=g.beforeLayers;this.activeId=g.beforeActive;}else if(after.length!==g.beforeLayers.length)this.history.push({bytes:after.filter(l=>!g.beforeLayers.includes(l)).reduce((sum,l)=>sum+l.width*l.height*4,0),undo:()=>{this.layers=g.beforeLayers;this.activeId=g.beforeActive;},redo:()=>{this.layers=after;this.activeId=active;}});this.gesture=null;this.changed();return;}
    if(!g||!['brush-line','erase-rect','stamp','clone'].includes(g.kind)){super.end(cancel);return;}
    if(cancel){const ctx=g.layer.canvas.getContext('2d');for(const t of g.tiles.values())ctx.putImageData(t.before,t.x,t.y);}
    else {
      if(g.kind==='brush-line')this.segment(g.start,g.end);
      if(g.kind==='erase-rect'){this.captureTiles(g.layer,{x:0,y:0,width:g.layer.width,height:g.layer.height},g.tiles);g.layer.canvas.getContext('2d').clearRect(Math.min(g.start.x,g.end.x),Math.min(g.start.y,g.end.y),Math.abs(g.end.x-g.start.x),Math.abs(g.end.y-g.start.y));}
      this.recordPixels(g.layer,g.tiles);
    }
    this.gesture=null;this.changed();
  }
}
