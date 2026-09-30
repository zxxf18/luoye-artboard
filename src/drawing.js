import { beginPaperErase, updatePaperErase, endPaperErase, beginPaperWarp, updatePaperWarp, endPaperWarp } from './paper-tools.js';
import { EditorEngine } from './editor.js';
import { makeCanvas } from './engine.js';
import { toLayerPoint, MAX_SPRITES_PER_LAYER, MAX_PROJECT_SPRITES } from './core.js';
import { brushSegment } from './brushes.js';
import { shapeEraserSegment } from './shape-eraser.js';
import { warpPixels } from './warps.js';
import { textureData, materialSegment } from './materials.js';
import { seededRandom } from './pixels.js';
import { assistCopies, assistGuideLines, assistPointSetCopies, assistPointSets, assistSegmentCopies, normalizeAssistConfig } from './assist.js';

// Store immutable animation frames at the stamp's drawing resolution. Large
// stamps keep the originals; small stamps do not each retain 480px frames.
const fairyResolutions=new WeakMap(),fairyFrameResolutions=new WeakMap();
/**
 * Return the smallest layer-space rectangle that can contain a line preview.
 * Material previews are composited into a full layer afterwards, but the
 * expensive texture sampling only needs this stroke-sized source rectangle.
 */
export function previewBoundsForLine(start,end,size,scale,width,height,copies=[]){
  const layerScale=Math.max(.01,Number(scale)||1),brushSize=Math.max(1,Number(size)||1)/layerScale,pad=brushSize*2+4;
  const points=[start,end,...copies.flatMap(copy=>[copy.start,copy.end])].filter(point=>point&&Number.isFinite(point.x)&&Number.isFinite(point.y));
  const left=Math.max(0,Math.floor(Math.min(...points.map(point=>point.x))-pad)),top=Math.max(0,Math.floor(Math.min(...points.map(point=>point.y))-pad));
  const right=Math.min(width,Math.ceil(Math.max(...points.map(point=>point.x))+pad)),bottom=Math.min(height,Math.ceil(Math.max(...points.map(point=>point.y))+pad));
  return {x:left,y:top,width:Math.max(1,right-left),height:Math.max(1,bottom-top)};
}
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
  assistGeometry(options, layer) {
    const assist=options?.assist;
    if(!assist||typeof options!=='object')return null;
    // A single pointer sample can ask for the same geometry once per mirrored
    // copy. Cache it by the immutable gesture options object so normalization
    // and coordinate conversion happen once per stroke, without sharing stale
    // state across changed controls or transformed layers.
    const cache=this.assistGeometryCache??=new WeakMap(),cached=cache.get(options);
    if(cached?.assist===assist&&cached.layer===layer&&cached.width===this.width&&cached.height===this.height&&cached.paperMode===!!this.paperMode)return cached.geometry;
    const config = normalizeAssistConfig(assist);
    if (!config.enabled) { cache.set(options,{assist,layer,width:this.width,height:this.height,paperMode:!!this.paperMode,geometry:null}); return null; }
    const world = {
      x: Number.isFinite(config.centerX) ? config.centerX : this.width / 2,
      y: Number.isFinite(config.centerY) ? config.centerY : this.height / 2,
    };
    const geometry={ config, center: this.paperMode ? world : toLayerPoint(world, layer) };
    cache.set(options,{assist,layer,width:this.width,height:this.height,paperMode:!!this.paperMode,geometry});
    return geometry;
  }
  assistPoints(point, options, layer, includeStamp = false) {
    const geometry = this.assistGeometry(options, layer);
    if (!geometry || (includeStamp && !geometry.config.stamp)) return [point];
    return assistCopies(point, geometry.config, geometry.center);
  }
  assistPairs(start, end, options, layer) {
    const geometry = this.assistGeometry(options, layer);
    return geometry ? assistSegmentCopies(start, end, geometry.config, geometry.center) : [{ start, end, transformIndex: 0 }];
  }
  applyAssistTransform(ctx, geometry, copyIndex) {
    if (!geometry) return;
    const { config, center } = geometry;
    ctx.translate(center.x, center.y);
    if (config.mode === 'radial') ctx.rotate(Math.PI * 2 * copyIndex / config.axes);
    else if (config.mode === 'vertical') ctx.scale(copyIndex ? -1 : 1, 1);
    else if (config.mode === 'horizontal') ctx.scale(1, copyIndex ? -1 : 1);
    else if (config.mode === 'four') {
      if (copyIndex === 1) ctx.scale(-1, 1);
      if (copyIndex === 2) ctx.scale(1, -1);
      if (copyIndex === 3) ctx.scale(-1, -1);
    }
    ctx.translate(-center.x, -center.y);
  }
  drawAssistSegment(ctx, gesture, start, end, texture, paper, bounds, transformIndex = 0) {
    const geometry = this.assistGeometry(gesture.options, gesture.layer);
    if (!gesture.gradientOrigin && gesture.start) gesture.gradientOrigin = { x: gesture.start.x, y: gesture.start.y };
    if (!geometry) {
      if (gesture.options.tool === 'eraser' && gesture.options.eraserMode === 'shape') shapeEraserSegment(ctx, gesture, start, end);
      else if (texture || paper) materialSegment(ctx, gesture, start, end, texture, paper, bounds);
      else brushSegment(ctx, gesture, start, end);
      return;
    }
    const states = gesture.assistStates ??= [];
    const state = states[transformIndex] ?? (states[transformIndex] = {});
    // Keep one copy object per assisted transform. Pointer events can arrive
    // dozens of times per frame; rebuilding the whole gesture object for each
    // copy creates avoidable garbage and makes GC pauses visible on tablets.
    const copies = gesture.assistCopies ??= [];
    const copy = copies[transformIndex] ?? (copies[transformIndex] = { ...gesture, ...state });
    // All assisted copies are rendered serially into the same material scratch
    // surface. Sharing it avoids allocating one large temporary canvas per
    // symmetry axis when a thick textured brush is used.
    copy.materialScratchOwner = gesture;
    copy.start = start; copy.end = end;
    ctx.save();this.applyAssistTransform(ctx, geometry, transformIndex);
    if (copy.options.tool === 'eraser' && copy.options.eraserMode === 'shape') shapeEraserSegment(ctx, copy, start, end);
    else if (texture || paper) materialSegment(ctx, copy, start, end, texture, paper, bounds);
    else brushSegment(ctx, copy, start, end);
    ctx.restore();
    for (const key of ['bristles', 'random', 'dabStarted', 'dabTravel', 'gradientOrigin', 'shapeStarted', 'shapeTravel']) if (copy[key] !== undefined) state[key] = copy[key];
  }
  drawAssistGuides(ctx) {
    const config = normalizeAssistConfig(this.assistConfig);
    if (!config.enabled || !config.showGuides) return;
    const lines = assistGuideLines(config, this.width, this.height);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = '#c86f45';
    ctx.globalAlpha = .46;
    ctx.lineWidth = Math.max(1.5, this.width / 1400);
    ctx.setLineDash([10, 8]);
    for (const line of lines) { ctx.beginPath(); ctx.moveTo(line.start.x, line.start.y); ctx.lineTo(line.end.x, line.end.y); ctx.stroke(); }
    if (config.showGrid) {
      const spacing = Math.max(40, Math.round(Math.min(this.width, this.height) / 12));
      ctx.globalAlpha = .12; ctx.setLineDash([]); ctx.strokeStyle = '#8d765f'; ctx.lineWidth = 1;
      for (let x = 0; x <= this.width; x += spacing) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.height); ctx.stroke(); }
      for (let y = 0; y <= this.height; y += spacing) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(this.width, y); ctx.stroke(); }
    }
    ctx.restore();
  }
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
  resetStampProgress(){this.fairyStampIndex=0;}
  setStampImages(images,reset=true){this.fairyGroups=null;this.fairyBehavior=null;if(reset)this.resetStampProgress();this.stampImages=images.map(image=>{const c=makeCanvas(image.width,image.height);c.getContext('2d').drawImage(image,0,0);return c;});}
  setFairyGroups(groups,mode,behavior=null){const same=this.fairyGroups===groups&&this.fairyMode===mode;this.setStampImages(groups.map(group=>group.frames[0]),!same);this.fairyGroups=groups;this.fairyMode=mode;this.fairyBehavior=behavior;}
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
      const c=line.previewCanvas??=makeCanvas(line.layer.width,line.layer.height),target=c.getContext('2d'),copies=this.assistPairs(line.start,line.end,line.options,line.layer),bounds=previewBoundsForLine(line.start,line.end,line.options.size,line.layer.scale,c.width,c.height,copies),sourceBounds=previewBoundsForLine(line.start,line.end,line.options.size,line.layer.scale,c.width,c.height),preview={layer:line.layer,options:{...line.options}};
      if(!line.previewStroke||line.previewStroke.width!==bounds.width||line.previewStroke.height!==bounds.height)line.previewStroke=makeCanvas(bounds.width,bounds.height);
      const stroke=line.previewStroke;target.clearRect(0,0,c.width,c.height);const strokeContext=stroke.getContext('2d');strokeContext.setTransform(1,0,0,1,0,0);strokeContext.globalCompositeOperation='source-over';strokeContext.clearRect(0,0,stroke.width,stroke.height);
      target.drawImage(line.layer.canvas,0,0);
      const texture=line.options.fillSource==='texture'?this.paintTexture:null,paper=line.options.paperGrain?this.paperTexture:null;
      strokeContext.save();strokeContext.translate(-bounds.x,-bounds.y);
      for (const { transformIndex } of copies) {
        this.drawAssistSegment(strokeContext, preview, line.start, line.end, texture, paper, sourceBounds, transformIndex);
      }
      strokeContext.restore();
      if(this.selectionCanvas){const mask=line.previewMask??=this.selectionInLayer(line.layer);strokeContext.globalCompositeOperation='destination-in';strokeContext.drawImage(mask,-bounds.x,-bounds.y);strokeContext.globalCompositeOperation='source-over';}
      target.drawImage(stroke,bounds.x,bounds.y);line.previewBounds=bounds;this.strokePreview={...line.layer,canvas:c};
    }
    try{super.paint(ctx,guides);}finally{this.strokePreview=null;}if(!guides)return;
    this.drawAssistGuides(ctx);
    if(this.stampPreview&&this.stampImages?.length){
      const {point,size}=this.stampPreview,index=this.gesture?.stampIndex||0;
      const group=this.fairyGroups?.[index%this.fairyGroups.length];
      const image=group?group.frames[Math.floor(group.frames.length/2)]:this.stampImages[index%this.stampImages.length],scale=size/Math.max(image.width,image.height);
      const geometry=this.assistGeometry({assist:this.assistConfig},this.active),points=geometry?.config.stamp?this.assistPoints(point,{assist:this.assistConfig},this.active,true):[point],sourceAngle=geometry?.config.mode==='radial'?Math.atan2(point.y-geometry.center.y,point.x-geometry.center.x):0;
      for(const copy of points){
        const radial=geometry?.config.mode==='radial'&&Math.hypot(point.x-geometry.center.x,point.y-geometry.center.y)>.001,copyAngle=radial?Math.atan2(copy.y-geometry.center.y,copy.x-geometry.center.x)-sourceAngle:0;
        const mirrorX=!radial&&(['vertical','four'].includes(geometry?.config.mode))&&Math.abs(copy.x-(geometry.center.x*2-point.x))<.001;
        const mirrorY=!radial&&(['horizontal','four'].includes(geometry?.config.mode))&&Math.abs(copy.y-(geometry.center.y*2-point.y))<.001;
        ctx.save();ctx.globalAlpha=.6;ctx.translate(copy.x,copy.y);ctx.scale(mirrorX?-1:1,mirrorY?-1:1);ctx.rotate(copyAngle);ctx.drawImage(image,-image.width*scale/2,-image.height*scale/2,image.width*scale,image.height*scale);ctx.restore();
      }
    }
    if(this.path){
      const p=this.path;ctx.save();if(!p.select)this.transform(ctx,p.layer);
      this.drawShape(ctx,{...p,start:p.points[0],end:p.points.at(-1),points:p.points});
      ctx.strokeStyle=p.options.color||'#285b49';ctx.lineWidth=2;ctx.setLineDash([5,4]);
      const geometry=!p.select?this.assistGeometry(p.options,p.layer):null;
      const pointSets=geometry?assistPointSets(p.points,geometry.config,geometry.center):[p.points];
      for(const points of pointSets){ctx.beginPath();points.forEach((v,i)=>i?ctx.lineTo(v.x,v.y):ctx.moveTo(v.x,v.y));ctx.stroke();}
      ctx.setLineDash([]);for(const v of p.points){ctx.fillStyle='#ffffff';ctx.fillRect(v.x-4,v.y-4,8,8);ctx.strokeRect(v.x-4,v.y-4,8,8);}ctx.restore();
    }
    const g=this.gesture;if(g?.kind==='paper-erase'&&g.options.eraserMode==='rect'){ctx.save();ctx.strokeStyle='#9c684b';ctx.lineWidth=2*this.width/Math.max(1,this.canvas.clientWidth);ctx.setLineDash([6,4]);ctx.strokeRect(g.start.x,g.start.y,g.end.x-g.start.x,g.end.y-g.start.y);ctx.restore();}
    if(g?.kind==='erase-rect'){ctx.save();this.transform(ctx,g.layer);ctx.strokeStyle=g.kind==='erase-rect'?'#9c684b':g.options.color;ctx.lineWidth=(g.kind==='erase-rect'?2*this.width/Math.max(1,this.canvas.clientWidth):g.options.size)/g.layer.scale;ctx.globalAlpha=.5;ctx.beginPath();if(g.kind==='erase-rect'){ctx.setLineDash([6,4]);ctx.rect(g.start.x,g.start.y,g.end.x-g.start.x,g.end.y-g.start.y);}else{ctx.moveTo(g.start.x,g.start.y);ctx.lineTo(g.end.x,g.end.y);}ctx.stroke();ctx.restore();}
  }
  drawShape(ctx,g){
    const geometry=this.assistGeometry(g.options,g.layer);
    if(!geometry||g.select||g.options.tool==='select-bezier'){super.drawShape(ctx,g);return;}
    if (geometry.config.mode === 'radial') {
      const centered=(Math.abs((g.start.x+g.end.x)/2-geometry.center.x)<.001&&Math.abs((g.start.y+g.end.y)/2-geometry.center.y)<.001);
      const square=Math.abs(Math.abs(g.end.x-g.start.x)-Math.abs(g.end.y-g.start.y))<.001;
      const rotationallyStable=centered&&square&&['rect','roundrect','ellipse'].includes(g.options.tool);
      const count=rotationallyStable?1:geometry.config.axes;
      for (let index = 0; index < count; index++) {
        const angle = Math.PI * 2 * index / geometry.config.axes;
        ctx.save();ctx.translate(geometry.center.x,geometry.center.y);ctx.rotate(angle);ctx.translate(-geometry.center.x,-geometry.center.y);super.drawShape(ctx,g);ctx.restore();
      }
      return;
    }
    const sets=assistPointSetCopies([g.start,g.end,...(g.points||[])],geometry.config,geometry.center);
    for(const { points } of sets){
      const [start,end,...shapePoints]=points;ctx.save();super.drawShape(ctx,{...g,start,end,points:shapePoints});ctx.restore();
    }
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
      const g={kind:options.tool,layer,options,start:local,end:local,last:local,tiles:new Map(),stampIndex:options.tool==='stamp'&&this.fairyMode==='static'?(this.fairyStampIndex||0):0,travel:0};
      if(options.tool==='clone'){
        const source=this.cloneSource.canvas||layer.canvas;g.source=makeCanvas(layer.width,layer.height);
        // Freeze pixels rather than replaying the source canvas's drawing list
        // under each circular clip; recorded PNG sources are already rasterized.
        g.source.getContext('2d').putImageData(source.getContext('2d').getImageData(0,0,source.width,source.height),0,0);
        g.offset={x:this.cloneSource.point.x-local.x,y:this.cloneSource.point.y-local.y};
      }
      this.gesture=g;this.specialDab(local);return;
    }
    super.begin(point,options);
  }
  segment(a,b){
    const g=this.gesture,width=g.options.size/g.layer.scale,pad=width*2+4,ctx=g.layer.canvas.getContext('2d');
    const texture=g.options.fillSource==='texture'?this.paintTexture:null,paper=g.options.paperGrain?this.paperTexture:null;
    let maskBounds=null;
    const material = g.options.tool==='pen' && (texture || paper);
    const distance=Math.hypot(b.x-a.x,b.y-a.y),maxSpan=material?Math.max(96,Math.min(320,width*1.5)):distance;
    const steps=Math.max(1,Math.ceil(distance/Math.max(1,maxSpan)));
    for(let part=0;part<steps;part++){
      const from=part/steps,to=(part+1)/steps,startPoint={x:a.x+(b.x-a.x)*from,y:a.y+(b.y-a.y)*from},endPoint={x:a.x+(b.x-a.x)*to,y:a.y+(b.y-a.y)*to};
      // assistPairs receives the untransformed source segment and the draw
      // helper applies the selected transform exactly once.
      for(const { start, end, transformIndex } of this.assistPairs(startPoint,endPoint,g.options,g.layer)){
        const bounds={x:Math.min(start.x,end.x)-pad,y:Math.min(start.y,end.y)-pad,width:Math.abs(end.x-start.x)+pad*2,height:Math.abs(end.y-start.y)+pad*2};
        const sourceBounds={x:Math.min(startPoint.x,endPoint.x)-pad,y:Math.min(startPoint.y,endPoint.y)-pad,width:Math.abs(endPoint.x-startPoint.x)+pad*2,height:Math.abs(endPoint.y-startPoint.y)+pad*2};
        this.captureTiles(g.layer,bounds,g.tiles);
        this.drawAssistSegment(ctx,g,startPoint,endPoint,material&&texture?texture:null,material&&paper?paper:null,sourceBounds,transformIndex);
        maskBounds=maskBounds?{x:Math.min(maskBounds.x,bounds.x),y:Math.min(maskBounds.y,bounds.y),width:Math.max(maskBounds.x+maskBounds.width,bounds.x+bounds.width)-Math.min(maskBounds.x,bounds.x),height:Math.max(maskBounds.y+maskBounds.height,bounds.y+bounds.height)-Math.min(maskBounds.y,bounds.y)}:bounds;
      }
    }
    if(g.selectionMask===undefined)g.selectionMask=this.layerMask(g.layer);this.maskTiles(g.layer,g.tiles,g.selectionMask,maskBounds);this.render();
  }
  specialDab(p){
    const g=this.gesture,o=g.options,ctx=g.layer.canvas.getContext('2d'),size=o.size/g.layer.scale;
    g.lastStampTime=performance.now();
    const geometry=this.assistGeometry(o,g.layer),points=g.kind==='stamp'?this.assistPoints(p,o,g.layer,true):[p],behavior=this.fairyBehavior,random=g.random??=seededRandom(o.seed??1),index=g.kind==='clone'?0:(behavior?.randomOrder?Math.floor(random()*this.stampImages.length):g.stampIndex%this.stampImages.length),image=g.kind==='clone'?null:this.stampImages[index],scale=image?size/Math.max(image.width,image.height):1,rotation=image?(random()-.5)*2*Math.min(45,Math.max(0,Number(behavior?.rotation)||0))*Math.PI/180:0,sourceAngle=geometry?.config.mode==='radial'?Math.atan2(p.y-geometry.center.y,p.x-geometry.center.x):0;
    let maskBounds=null;
    for(const point of points){
      const bounds={x:point.x-size*2,y:point.y-size*2,width:size*4,height:size*4};
      this.captureTiles(g.layer,bounds,g.tiles);ctx.save();ctx.globalAlpha=o.opacity;
      if(g.kind==='clone'){ctx.beginPath();ctx.arc(point.x,point.y,size/2,0,Math.PI*2);ctx.clip();ctx.drawImage(g.source,-g.offset.x,-g.offset.y);}
      else{
        const radial=Math.hypot(p.x-geometry?.center.x,p.y-geometry?.center.y)>0.001&&geometry?.config.mode==='radial';
        const copyAngle=radial?Math.atan2(point.y-geometry.center.y,point.x-geometry.center.x)-sourceAngle:0;
        const mirrorX=!radial&&(['vertical','four'].includes(geometry?.config.mode))&&Math.abs(point.x-(geometry.center.x*2-p.x))<.001;
        const mirrorY=!radial&&(['horizontal','four'].includes(geometry?.config.mode))&&Math.abs(point.y-(geometry.center.y*2-p.y))<.001;
        ctx.translate(point.x,point.y);ctx.scale(mirrorX?-1:1,mirrorY?-1:1);ctx.rotate(rotation+copyAngle);ctx.drawImage(image,-image.width*scale/2,-image.height*scale/2,image.width*scale,image.height*scale);
      }
      ctx.restore();
      maskBounds=maskBounds?{x:Math.min(maskBounds.x,bounds.x),y:Math.min(maskBounds.y,bounds.y),width:Math.max(maskBounds.x+maskBounds.width,bounds.x+bounds.width)-Math.min(maskBounds.x,bounds.x),height:Math.max(maskBounds.y+maskBounds.height,bounds.y+bounds.height)-Math.min(maskBounds.y,bounds.y)}:bounds;
    }
    if(g.kind!=='clone')g.stampIndex++;if(g.kind==='stamp'&&this.fairyMode==='static')this.fairyStampIndex=g.stampIndex;if(g.selectionMask===undefined)g.selectionMask=this.layerMask(g.layer);this.maskTiles(g.layer,g.tiles,g.selectionMask,maskBounds);this.render();
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
    if(!g||!['brush-line','erase-rect','stamp','clone'].includes(g.kind)){
      // PaintEngine's line/rect/ellipse path normally snapshots only the
      // original drag bounds. Assisted copies can land outside that box, so
      // take a full-layer snapshot for these infrequent shape commits; this
      // keeps undo/cancel exact without changing the normal freehand path.
      if(!cancel&&g?.options?.assist?.enabled&&g.layer&&['line','rect','ellipse'].includes(g.options.tool))this.captureTiles(g.layer,{x:0,y:0,width:g.layer.width,height:g.layer.height},g.tiles);
      super.end(cancel);return;
    }
    if(cancel){const ctx=g.layer.canvas.getContext('2d');for(const t of g.tiles.values())ctx.putImageData(t.before,t.x,t.y);}
    else {
      if(g.kind==='brush-line')this.segment(g.start,g.end);
      if(g.kind==='erase-rect'){this.captureTiles(g.layer,{x:0,y:0,width:g.layer.width,height:g.layer.height},g.tiles);g.layer.canvas.getContext('2d').clearRect(Math.min(g.start.x,g.end.x),Math.min(g.start.y,g.end.y),Math.abs(g.end.x-g.start.x),Math.abs(g.end.y-g.start.y));}
      this.recordPixels(g.layer,g.tiles);
    }
    this.gesture=null;this.changed();
  }
}
