import { beginPaperErase, updatePaperErase, endPaperErase, beginPaperWarp, updatePaperWarp, endPaperWarp } from './paper-tools.js';
import { EditorEngine } from './editor.js';
import { makeCanvas } from './engine.js';
import { toLayerPoint, MAX_SPRITES_PER_LAYER, MAX_PROJECT_SPRITES } from './core.js';
import { shapePath } from './geometry.js';
import { brushSegment } from './brushes.js';
import { warpPixels } from './warps.js';
import { textureData, materialSegment } from './materials.js';
import { seededRandom } from './pixels.js';

// Store immutable animation frames at the stamp's drawing resolution. Large
// stamps keep the originals; small stamps do not each retain 480px frames.
const fairyResolutions=new WeakMap(),fairyFrameResolutions=new WeakMap();
function stampGroup(group,size){
  const edge=Math.max(...group.frames.map(f=>Math.max(f.width,f.height)));
  const target=Math.min(edge,Math.max(128,Math.ceil(size/32)*32));
  if(target===edge)return group;
  let sizes=fairyResolutions.get(group);if(!sizes){sizes=new Map();fairyResolutions.set(group,sizes);}
  if(!sizes.has(target))sizes.set(target,{frameDuration:group.frameDuration,frames:group.frames.map(frame=>{
    const scale=target/edge,width=Math.max(1,Math.round(frame.width*scale)),height=Math.max(1,Math.round(frame.height*scale)),key=width+'x'+height;
    let frames=fairyFrameResolutions.get(frame);if(!frames){frames=new Map();fairyFrameResolutions.set(frame,frames);}
    if(!frames.has(key)){const c=makeCanvas(width,height,false),ctx=c.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(frame,0,0,width,height);frames.set(key,c);}return frames.get(key);
  })});
  return sizes.get(target);
}

export class DrawingEngine extends EditorEngine {
  setPaintTexture(image){this.paintTexture=textureData(image);}
  setPaperTexture(image){this.paperTexture=textureData(image);}
  applyBoardFilter(kind,options={}){
    if(this.paperMode){
      const effect=(data,w,h,space)=>{const point=space?toLayerPoint({x:options.x??this.width/2,y:options.y??this.height/2},space):null;return warpPixels(data,w,h,{...options,kind,...(point?{x:point.x,y:point.y,radius:(options.radius||120)/space.scale}:{})});};
      effect.worldRegion={x:options.x??this.width/2,y:options.y??this.height/2,radius:options.radius||120};
      return this.mutatePaper(effect);
    }
    this.mutatePixels((data,w,h)=>warpPixels(data,w,h,{...options,kind}));
  }
  warpDab(point){
    const g=this.gesture,l=g.layer,radius=Math.max(1,Math.min(600,g.options.radius||120))/l.scale,dx=point.x-g.last.x,dy=point.y-g.last.y,ctx=l.canvas.getContext('2d');
    const pad=Math.ceil(radius+Math.max(Math.abs(dx),Math.abs(dy))+3),x=Math.max(0,Math.floor(point.x-pad)),y=Math.max(0,Math.floor(point.y-pad)),w=Math.min(l.width,x+pad*2)-x,h=Math.min(l.height,y+pad*2)-y;if(w<=0||h<=0){g.last=point;return;}
    const bounds={x,y,width:w,height:h};this.captureTiles(l,bounds,g.tiles);const before=ctx.getImageData(x,y,w,h);before.data.set(warpPixels(before.data,w,h,{...g.options,kind:g.options.warpKind||'push',x:point.x-x,y:point.y-y,dx,dy,radius}));ctx.putImageData(before,x,y);if(g.selectionMask===undefined)g.selectionMask=this.layerMask(l);this.maskTiles(l,g.tiles,g.selectionMask,bounds);g.last=point;this.render();
  }
  reset(w,h){this.path=null;this.cloneSource=null;super.reset(w,h);}
  async restore(raw){const title=await super.restore(raw);this.path=null;this.cloneSource=null;
    // Old projects may already be near the budget. Keep every sprite and its
    // timing/position, but release oversized immutable frame resources.
    for(const layer of this.layers){if(!layer.sprites)continue;
      const sizes=new Map();for(const sprite of layer.sprites)sizes.set(sprite.group,Math.max(sizes.get(sprite.group)||0,sprite.size*layer.scale));
      layer.spriteGroups=layer.spriteGroups.map((group,index)=>stampGroup(group,sizes.get(index)||128));
    }
    this.changed();return title;
  }
  clearLayer(){const selection=this.selection,canvas=this.selectionCanvas,bounds=this.selectionBounds;this.clearSelection();try{this.clearPixels();}finally{this.selection=selection;this.selectionCanvas=canvas;this.selectionBounds=bounds;this.onSelectionChange?.();this.render();}}
  setCloneSource(point){if(this.paperMode){const canvas=makeCanvas(this.width,this.height);this.paint(canvas.getContext('2d'));this.cloneSource={point,canvas};}else this.cloneSource={point:toLayerPoint(point,this.active),layerId:this.activeId};}
  setStampImages(images){this.fairyGroups=null;this.fairyBehavior=null;this.stampImages=images.map(image=>{const c=makeCanvas(image.width,image.height);c.getContext('2d').drawImage(image,0,0);return c;});}
  setFairyGroups(groups,mode,behavior=null){this.setStampImages(groups.map(group=>group.frames[0]));this.fairyGroups=groups;this.fairyMode=mode;this.fairyBehavior=behavior;}
  dynamicDab(point){
    const g=this.gesture,index=g.stampIndex%this.fairyGroups.length;
    if(g.limitNotice)return;
    if(this.layers.reduce((n,l)=>n+(l.sprites?.length||0),0)>=MAX_PROJECT_SPRITES){this.notice?.('这幅画已有 500,000 个动态图案，擦除一些后可以继续画。');g.limitNotice=true;return;}
    g.lastStampTime=performance.now();
    try {
      const group=stampGroup(this.fairyGroups[index],g.options.size);
      if(!g.layer||g.layer.sprites.length>=MAX_SPRITES_PER_LAYER||(g.layer.spriteGroups.length>=200&&!g.layer.spriteGroups.includes(group))){
        const top=this.layers.at(-1);
        const reusable=!g.layer&&!this.selectionCanvas&&top?.sprites&&top.sprites.length<MAX_SPRITES_PER_LAYER&&(top.spriteGroups.length<200||top.spriteGroups.includes(group))&&top.visible&&top.opacity===1&&!top.eraseMask&&!top.spriteClip&&top.scale===1&&top.rotation===0&&top.width===this.width&&top.height===this.height&&top.x===this.width/2&&top.y===this.height/2;
        if(reusable){g.layer=top;this.activeId=top.id;}
        else {
        const extra={spriteGroups:[],sprites:[]};
        if(this.selectionCanvas){extra.spriteMask=this.selectionCanvas.toDataURL('image/png');extra.spriteClip=makeCanvas(this.width,this.height);extra.spriteClip.getContext('2d').drawImage(this.selectionCanvas,0,0);}
        g.layer=this.addLayer(this.stampName||'动态魔法袋',makeCanvas(this.width,this.height),false,extra);
        }
        (g.touched??=[]).push({layer:g.layer,start:g.layer.sprites.length,beforeGroups:g.layer.spriteGroups});
      }
      let groupIndex=g.layer.spriteGroups.indexOf(group);
      if(groupIndex<0){
        const groups=[...g.layer.spriteGroups,group];
        this.assertSceneCapacity(this.layers.map(l=>l===g.layer?{...l,spriteGroups:groups}:l));
        g.layer.spriteGroups=groups;groupIndex=groups.length-1;
      }
      const sprite={group:groupIndex,x:point.x,y:point.y,size:g.options.size,opacity:g.options.opacity};
      Object.defineProperty(sprite,'_birth',{value:this.playing?performance.now()-this.animationStart:this.animationTime||0,writable:true});
      g.layer.sprites.push(sprite);g.stampIndex++;
      // This canvas is the static fallback/thumbnail, not the live animation.
      // Append one first-frame stamp instead of redrawing the whole stroke.
      const context=g.layer.canvas.getContext('2d'),frame=group.frames[0],scale=sprite.size/Math.max(frame.width,frame.height);
      context.save();context.globalAlpha=sprite.opacity;context.drawImage(frame,point.x-frame.width*scale/2,point.y-frame.height*scale/2,frame.width*scale,frame.height*scale);context.restore();
      this.render();
    }catch(error){if(!g.limitNotice){this.notice?.(error.message);g.limitNotice=true;}}
  }
  useLayerAsStamp(){this.setStampImages(this.active.frames?.length?this.active.frames:[this.active.canvas]);}
  repeatStamp(force=false){
    const g=this.gesture;
    if(!g || (!force&&performance.now()-(g.lastStampTime||0)<150))return false;
    if(g.kind==='stamp')this.specialDab(g.last);
    if(g.kind==='fairy-dynamic')this.dynamicDab(g.last);
    return ['stamp','fairy-dynamic'].includes(g.kind);
  }
  drawLayer(ctx,layer,time,applyMask=true){super.drawLayer(ctx,this.strokePreview?.id===layer.id?this.strokePreview:layer,time,applyMask);}
  paint(ctx,guides=false){
    const line=this.gesture;
    if(guides&&line?.kind==='brush-line'){
      const c=line.previewCanvas??=makeCanvas(line.layer.width,line.layer.height),target=c.getContext('2d'),stroke=line.previewStroke??=makeCanvas(c.width,c.height),preview={layer:line.layer,options:{...line.options}};
      target.clearRect(0,0,c.width,c.height);const strokeContext=stroke.getContext('2d');strokeContext.globalCompositeOperation='source-over';strokeContext.clearRect(0,0,c.width,c.height);
      target.drawImage(line.layer.canvas,0,0);
      const texture=line.options.fillSource==='texture'?this.paintTexture:null,paper=line.options.paperGrain?this.paperTexture:null;
      if(texture||paper)materialSegment(stroke.getContext('2d'),preview,line.start,line.end,texture,paper,{x:0,y:0,width:c.width,height:c.height});else brushSegment(stroke.getContext('2d'),preview,line.start,line.end);
      if(this.selectionCanvas){const mask=line.previewMask??=this.selectionInLayer(line.layer);const sc=stroke.getContext('2d');sc.globalCompositeOperation='destination-in';sc.drawImage(mask,0,0);}
      target.drawImage(stroke,0,0);this.strokePreview={...line.layer,canvas:c};
    }
    try{super.paint(ctx,guides);}finally{this.strokePreview=null;}if(!guides)return;
    if(this.stampPreview&&this.stampImages?.length){
      const {point,size}=this.stampPreview,index=this.gesture?.stampIndex||0;
      const group=this.fairyGroups?.[index%this.fairyGroups.length];
      const image=group?group.frames[Math.floor(group.frames.length/2)]:this.stampImages[index%this.stampImages.length],scale=size/Math.max(image.width,image.height);
      ctx.save();ctx.globalAlpha=.6;ctx.drawImage(image,point.x-image.width*scale/2,point.y-image.height*scale/2,image.width*scale,image.height*scale);
      ctx.restore();
    }
    if(this.path){const p=this.path;ctx.save();if(!p.select)this.transform(ctx,p.layer);ctx.strokeStyle=p.options.color||'#285b49';ctx.lineWidth=2;ctx.stroke(shapePath(p.options.tool,p.points[0],p.points.at(-1),p.points));ctx.setLineDash([5,4]);ctx.beginPath();p.points.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.stroke();for(const v of p.points){ctx.fillStyle='#ffffff';ctx.fillRect(v.x-4,v.y-4,8,8);ctx.strokeRect(v.x-4,v.y-4,8,8);}ctx.restore();}
    const g=this.gesture;if(g?.kind==='paper-erase'&&g.options.eraserMode==='rect'){ctx.save();ctx.strokeStyle='#9c684b';ctx.lineWidth=2*this.width/Math.max(1,this.canvas.clientWidth);ctx.setLineDash([6,4]);ctx.strokeRect(g.start.x,g.start.y,g.end.x-g.start.x,g.end.y-g.start.y);ctx.restore();}
    if(g?.kind==='erase-rect'){ctx.save();this.transform(ctx,g.layer);ctx.strokeStyle=g.kind==='erase-rect'?'#9c684b':g.options.color;ctx.lineWidth=(g.kind==='erase-rect'?2*this.width/Math.max(1,this.canvas.clientWidth):g.options.size)/g.layer.scale;ctx.globalAlpha=.5;ctx.beginPath();if(g.kind==='erase-rect'){ctx.setLineDash([6,4]);ctx.rect(g.start.x,g.start.y,g.end.x-g.start.x,g.end.y-g.start.y);}else{ctx.moveTo(g.start.x,g.start.y);ctx.lineTo(g.end.x,g.end.y);}ctx.stroke();ctx.restore();}
  }
  addVertex(point,options){
    const select=options.tool==='select-bezier';if(!select){if(this.paperMode&&!this.path)this.ensureDrawingLayer();this.assertRaster();}
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
    if(this.paperMode&&options.tool==='eraser'){beginPaperErase(this,point,options);return;}
    if(this.paperMode&&(['pen','line','rect','ellipse','triangle','pentagon','hexagon','roundrect','star','clone','fill'].includes(options.tool)||(options.tool==='stamp'&&this.fairyMode!=='dynamic')))this.ensureDrawingLayer();
    if(this.paperMode&&options.tool==='warp'){beginPaperWarp(this,point,options);return;}
    if(options.tool==='warp'){this.assertRaster();const local=toLayerPoint(point,this.active);this.gesture={kind:'warp',layer:this.active,options,last:local,tiles:new Map()};if(options.warpKind==='zoom')this.warpDab(local);return;}
    if(options.tool==='board-filter'){if(!this.paperMode)this.assertRaster();const local=this.paperMode?point:toLayerPoint(point,this.active);this.applyBoardFilter(options.filterKind||'ripple',{...options,x:local.x,y:local.y,radius:(options.radius||120)/(this.paperMode?1:this.active.scale)});return;}
    if((options.tool==='pen'&&options.strokeMode==='line')||(options.tool==='eraser'&&options.eraserMode==='rect')){
      this.assertRaster();const local=toLayerPoint(point,this.active);this.gesture={kind:options.tool==='pen'?'brush-line':'erase-rect',layer:this.active,options,start:local,end:local,tiles:new Map()};return;
    }
    if(options.tool==='stamp'&&this.fairyGroups&&this.fairyMode==='dynamic'){this.gesture={kind:'fairy-dynamic',options,start:point,end:point,last:point,stampIndex:0,travel:0,beforeLayers:this.layers.slice(),beforeActive:this.activeId};this.dynamicDab(point);return;}
    if(['stamp','clone'].includes(options.tool)){
      this.assertRaster();const layer=this.active,local=toLayerPoint(point,layer);
      if(options.tool==='stamp'&&!this.stampImages?.length)throw new Error('先从图层操作中选择「用作印章」。');
      if(options.tool==='clone'&&!this.cloneSource?.canvas&&this.cloneSource?.layerId!==layer.id)throw new Error('请先按住 Ctrl 点击当前层上的仿制源点。');
      const g={kind:options.tool,layer,options,start:local,end:local,last:local,tiles:new Map(),stampIndex:0,travel:0};
      if(options.tool==='clone'){g.source=makeCanvas(layer.width,layer.height);g.source.getContext('2d').drawImage(this.cloneSource.canvas||layer.canvas,0,0);g.offset={x:this.cloneSource.point.x-local.x,y:this.cloneSource.point.y-local.y};}
      this.gesture=g;this.specialDab(local);return;
    }
    super.begin(point,options);
  }
  segment(a,b){
    const g=this.gesture,width=g.options.size/g.layer.scale,pad=width*2+4;
    const bounds={x:Math.min(a.x,b.x)-pad,y:Math.min(a.y,b.y)-pad,width:Math.abs(b.x-a.x)+pad*2,height:Math.abs(b.y-a.y)+pad*2};this.captureTiles(g.layer,bounds,g.tiles);
    const texture=g.options.fillSource==='texture'?this.paintTexture:null,paper=g.options.paperGrain?this.paperTexture:null;
    if(g.options.tool==='pen'&&(texture||paper))materialSegment(g.layer.canvas.getContext('2d'),g,a,b,texture,paper,bounds);
    else brushSegment(g.layer.canvas.getContext('2d'),g,a,b);
    if(g.selectionMask===undefined)g.selectionMask=this.layerMask(g.layer);this.maskTiles(g.layer,g.tiles,g.selectionMask,bounds);this.render();
  }
  specialDab(p){
    const g=this.gesture,o=g.options,ctx=g.layer.canvas.getContext('2d'),size=o.size/g.layer.scale;
    g.lastStampTime=performance.now();
    const bounds={x:p.x-size*2,y:p.y-size*2,width:size*4,height:size*4};
    this.captureTiles(g.layer,bounds,g.tiles);ctx.save();ctx.globalAlpha=o.opacity;
    if(g.kind==='clone'){ctx.beginPath();ctx.arc(p.x,p.y,size/2,0,Math.PI*2);ctx.clip();ctx.drawImage(g.source,-g.offset.x,-g.offset.y);}
    else{const behavior=this.fairyBehavior,random=g.random??=seededRandom(o.seed??1),index=behavior?.randomOrder?Math.floor(random()*this.stampImages.length):g.stampIndex%this.stampImages.length;g.stampIndex++;
      const image=this.stampImages[index],scale=size/Math.max(image.width,image.height),rotation=(random()-.5)*2*Math.min(45,Math.max(0,Number(behavior?.rotation)||0))*Math.PI/180;
      ctx.translate(p.x,p.y);ctx.rotate(rotation);ctx.drawImage(image,-image.width*scale/2,-image.height*scale/2,image.width*scale,image.height*scale);}
    ctx.restore();if(g.selectionMask===undefined)g.selectionMask=this.layerMask(g.layer);this.maskTiles(g.layer,g.tiles,g.selectionMask,bounds);this.render();
  }
  update(point){
    const g=this.gesture;if(!g){super.update(point);return;}
    if(g.kind==='paper-erase'){updatePaperErase(this,point);return;}
    if(g.kind==='paper-warp'){updatePaperWarp(this,point);return;}
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
    if(g?.kind==='paper-erase'){endPaperErase(this,cancel);return;}
    if(g?.kind==='paper-warp'){endPaperWarp(this,cancel);return;}
    if(g?.kind==='warp'){if(cancel){const ctx=g.layer.canvas.getContext('2d');for(const t of g.tiles.values())ctx.putImageData(t.before,t.x,t.y);}else this.recordPixels(g.layer,g.tiles);this.gesture=null;this.changed();return;}
    if(g?.kind==='fairy-dynamic'){
      // A failed first dab must not leave an empty layer behind.
      this.layers=this.layers.filter(l=>g.beforeLayers.includes(l)||l.sprites?.length);
      if(!this.layers.some(l=>l.id===this.activeId))this.activeId=g.beforeActive;
      const after=this.layers.slice(),active=this.activeId,touched=(g.touched||[]).map(t=>({...t,afterGroups:t.layer.spriteGroups,added:t.layer.sprites.slice(t.start)}));
      const refresh=layer=>{const c=layer.canvas.getContext('2d');c.clearRect(0,0,layer.width,layer.height);this.drawLayer(c,layer,0);};
      const undo=()=>{for(const t of touched){t.layer.sprites.length=t.start;t.layer.spriteGroups=t.beforeGroups;refresh(t.layer);}this.layers=g.beforeLayers;this.activeId=g.beforeActive;};
      if(cancel)undo();
      else if(touched.some(t=>t.added.length))this.history.push({bytes:touched.reduce((sum,t)=>sum+t.added.length*48+(g.beforeLayers.includes(t.layer)?t.afterGroups.filter(group=>!t.beforeGroups.includes(group)).reduce((n,group)=>n+group.frames.reduce((s,f)=>s+f.width*f.height*4,0),0):this.layerPixels(t.layer)*4),0),undo,redo:()=>{for(const t of touched){t.layer.sprites.length=t.start;t.layer.spriteGroups=t.afterGroups;for(const sprite of t.added)t.layer.sprites.push(sprite);refresh(t.layer);}this.layers=after;this.activeId=active;}});
      if(!cancel)for(const t of touched)if(t.layer.spriteClip)refresh(t.layer);
      this.gesture=null;this.changed();return;
    }
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
