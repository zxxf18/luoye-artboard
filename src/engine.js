import { bundledImageSource } from './bundled-images.js';
import { History, fitInside, floodFill, toLayerPoint, validateProject, MAX_LAYERS } from './core.js';

export function makeCanvas(width, height, readback = true) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  // Offscreen layers are read for every history tile; choose a stable readback path.
  canvas.getContext('2d', {willReadFrequently:readback});
  return canvas;
}

export async function loadImage(src) {
  const source=await bundledImageSource(src);
  return new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片无法读取，请检查素材或文件。')); image.src = globalThis.LUOYE_IMAGE_DATA?.[src] || source;
  });
}

function canvasPNG(canvas){
  return new Promise((resolve,reject)=>canvas.toBlob(blob=>{
    if(!blob){reject(new Error('图片编码失败，请重试保存。'));return;}
    const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);
  },'image/png'));
}
// Animation frame resources are immutable; edits replace frames. A weak cache
// avoids encoding the same resource on every autosave without retaining old art.
const animationFrameExports=new WeakMap();
// Small stamps reuse a prescaled frame. Bound the cache independently of the
// document; original frames remain the source for large/zoomed/exported art.
const stampFrames=new WeakMap(),stampLRU=new Set();let stampCachePixels=0;
function sizedStampFrame(frame,size){
  if(size>=Math.max(frame.width,frame.height))return frame;
  const width=Math.max(1,Math.ceil(frame.width*size/Math.max(frame.width,frame.height))),height=Math.max(1,Math.ceil(frame.height*size/Math.max(frame.width,frame.height))),key=width+'x'+height;
  let sizes=stampFrames.get(frame);if(!sizes){sizes=new Map();stampFrames.set(frame,sizes);}
  let entry=sizes.get(key);
  if(!entry){
    const pixels=width*height;if(pixels>4_000_000)return frame;
    while(stampCachePixels+pixels>8_000_000&&stampLRU.size){const old=stampLRU.values().next().value;stampLRU.delete(old);old.sizes.delete(old.key);stampCachePixels-=old.pixels;}
    const canvas=makeCanvas(width,height,false),ctx=canvas.getContext('2d');ctx.imageSmoothingQuality='high';ctx.drawImage(frame,0,0,width,height);
    entry={canvas,pixels,sizes,key};sizes.set(key,entry);stampCachePixels+=pixels;
  }
  stampLRU.delete(entry);stampLRU.add(entry);return entry.canvas;
}
function framePNG(frame,width=frame.width,height=frame.height){
  let sizes=animationFrameExports.get(frame);if(!sizes){sizes=new Map();animationFrameExports.set(frame,sizes);}
  const key=width+'x'+height;let value=sizes.get(key);
  if(!value){const canvas=makeCanvas(width,height);canvas.getContext('2d').drawImage(frame,0,0,width,height);value=canvasPNG(canvas).catch(error=>{sizes.delete(key);throw error;});sizes.set(key,value);}
  return value;
}

export class PaintEngine {
  constructor(canvas, onChange) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.onChange = onChange;
    this.history = new History(); this.layers = []; this.activeId = ''; this.playing = true;
    this.gesture = null; this.drawQueued = false; this.animationStart = performance.now();
    this.compositeSurfaces=new WeakMap();
    // The common case is a document with many unchanged raster layers. Keep a
    // single paper composite for those frames and invalidate it on mutations.
    this.staticComposite=null;
    this.metrics={frames:0,submissionMs:0,maxSubmissionMs:0,staticCacheHits:0};
    this.animationTimer = setInterval(() => { if (this.playing && this.layers.some(l => l.frames?.length || l.sprites?.length)) this.render(); }, 100);
    this.reset(1920, 1080);
  }
  reset(width, height) {
    this.width = width; this.height = height; this.canvas.width = width; this.canvas.height = height;
    this.layers = []; this.history.clear(); this.gesture = null;
    this.addLayer('我的画笔', makeCanvas(width, height), false); this.changed();
  }
  get active() { return this.layers.find(l => l.id === this.activeId); }
  changed() { this.staticComposite=null; this.render(); this.onChange?.(); }
  layerPixels(layer) {
    return layer.width*layer.height*(1+(layer.frames?.length||0)+(layer.spriteClip?1:0)+(layer.eraseMask?1:0))+(layer.spriteGroups||[]).reduce((n,g)=>n+g.frames.reduce((s,f)=>s+f.width*f.height,0),0);
  }
  scenePixels(layers=this.layers){
    const frames=new Set();let pixels=0;
    for(const l of layers){pixels+=l.width*l.height*(1+(l.spriteClip?1:0)+(l.eraseMask?1:0));for(const f of [...(l.frames||[]),...(l.spriteGroups||[]).flatMap(g=>g.frames)])if(!frames.has(f)){frames.add(f);pixels+=f.width*f.height;}}
    return pixels;
  }
  addLayer(name = '新的图层', canvas = makeCanvas(this.width, this.height), record = true, extra = {}) {
    const planned=[...this.layers,{width:canvas.width,height:canvas.height,...extra}],eraseReserve=planned.reduce((n,l)=>n+(l.role!=='background'&&!l.eraseMask?l.width*l.height:0),0);
    if(this.scenePixels(planned)+eraseReserve>90000000)throw new Error('图层和动画已接近内存预算，请先擦除或移走一些内容。已为橡皮保留空间。');
    if (this.layers.length >= MAX_LAYERS) throw new Error(`当前版本最多支持 ${MAX_LAYERS} 个图层。`);
    const previous = this.activeId;
    const { insertAt = this.layers.length, ...properties } = extra;
    const layer = { id: crypto.randomUUID(), name, canvas, width: canvas.width, height: canvas.height,
      x: this.width / 2, y: this.height / 2, scale: 1, rotation: 0, opacity: 1, visible: true, ...properties };
    const position = insertAt;
    this.layers.splice(position, 0, layer); this.activeId = layer.id;
    if (record) this.history.push({ bytes: canvas.width * canvas.height * 4,
      undo: () => { this.layers = this.layers.filter(l => l.id !== layer.id); this.activeId = previous; },
      redo: () => { this.layers.splice(position, 0, layer); this.activeId = layer.id; } });
    this.changed(); return layer;
  }
  removeActive() {
    if (this.layers.length === 1) throw new Error('请至少保留一个图层。');
    const layer = this.active, position = this.layers.indexOf(layer);
    this.layers.splice(position, 1); this.activeId = this.layers.at(-1).id;
    this.history.push({ bytes: layer.width * layer.height * 4,
      undo: () => { this.layers.splice(position, 0, layer); this.activeId = layer.id; },
      redo: () => { this.layers = this.layers.filter(l => l.id !== layer.id); this.activeId = this.layers.at(-1).id; } });
    this.changed();
  }
  clearAnimated(){
    this.end();const before=this.layers.slice(),previous=this.activeId;
    const removed=before.filter(l=>l.role!=='background'&&(l.sprites||l.frames?.length));if(!removed.length)return;
    this.layers=before.filter(l=>!removed.includes(l));
    if(!this.layers.length)this.addLayer('我的画笔',makeCanvas(this.width,this.height),false);
    this.activeId=this.layers.some(l=>l.id===previous)?previous:this.layers.at(-1).id;
    const after=this.layers.slice(),active=this.activeId;
    this.history.push({bytes:this.scenePixels(removed)*4,undo:()=>{this.layers=before;this.activeId=previous;},redo:()=>{this.layers=after;this.activeId=active;}});this.changed();
  }
  reorder(delta) {
    const layer = this.active, from = this.layers.indexOf(layer), to = from + delta;
    if (to < 0 || to >= this.layers.length || layer.role === 'background' || this.layers[to].role === 'background') return;
    const move = (a, b) => this.layers.splice(b, 0, this.layers.splice(a, 1)[0]);
    move(from, to); this.history.push({ bytes: 0, undo: () => move(to, from), redo: () => move(from, to) }); this.changed();
  }
  setProperty(layer, key, value) {
    const before = layer[key]; if (before === value) return;
    layer[key] = value;
    this.history.push({ bytes: 0, undo: () => { layer[key] = before; }, redo: () => { layer[key] = value; } });
    this.changed();
  }
  resizeActiveObject(factor) {
    const layer=this.active;if(!layer||layer.role==='background'||!Number.isFinite(factor)||factor<=0||factor>10)return;
    const before={scale:layer.scale,x:layer.x,y:layer.y},scale=Math.max(.05,Math.min(40,layer.scale*factor));
    let cx=layer.width/2,cy=layer.height/2;
    if(layer.sprites?.length){const xs=layer.sprites.map(s=>s.x),ys=layer.sprites.map(s=>s.y);cx=(Math.min(...xs)+Math.max(...xs))/2;cy=(Math.min(...ys)+Math.max(...ys))/2;}
    const dx=(cx-layer.width/2)*(layer.scale-scale),dy=(cy-layer.height/2)*(layer.scale-scale),angle=layer.rotation*Math.PI/180;
    const after={scale,x:layer.x+dx*Math.cos(angle)-dy*Math.sin(angle),y:layer.y+dx*Math.sin(angle)+dy*Math.cos(angle)};
    Object.assign(layer,after);this.history.push({bytes:0,undo:()=>Object.assign(layer,before),redo:()=>Object.assign(layer,after)});this.changed();
  }
  undo() { if (this.gesture) this.end(true); if (this.history.undo()) this.changed(); }
  redo() { if (this.history.redo()) this.changed(); }
  render() {
    if (this.drawQueued) return;
    this.drawQueued = true;
    // WKWebView can suspend animation frames while a native window is occluded.
    // Keep the actual canvas current for snapshots and the next visible frame.
    const draw = () => { if(!this.drawQueued)return;this.drawQueued=false;clearTimeout(this.renderDeadline);cancelAnimationFrame(this.renderFrame);const start=performance.now();this.paint(this.ctx,true);const elapsed=performance.now()-start;this.metrics.frames++;this.metrics.submissionMs+=elapsed;this.metrics.maxSubmissionMs=Math.max(this.metrics.maxSubmissionMs,elapsed); };
    this.renderFrame=requestAnimationFrame(draw);this.renderDeadline=setTimeout(draw,16);
  }
  transform(ctx, layer) {
    ctx.translate(layer.x, layer.y); ctx.rotate(layer.rotation * Math.PI / 180); ctx.scale(layer.scale, layer.scale);
    ctx.translate(-layer.width / 2, -layer.height / 2);
  }
  compositeSurface(layer,kind){
    let surfaces=this.compositeSurfaces.get(layer);if(!surfaces){surfaces={};this.compositeSurfaces.set(layer,surfaces);}
    let canvas=surfaces[kind];if(!canvas||canvas.width!==layer.width||canvas.height!==layer.height)canvas=surfaces[kind]=makeCanvas(layer.width,layer.height,false);
    const ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.clearRect(0,0,canvas.width,canvas.height);return canvas;
  }
  drawLayer(ctx, layer, time = this.playing ? performance.now()-this.animationStart : this.animationTime||0, applyMask=true) {
    if(applyMask&&layer.eraseMask){const c=this.compositeSurface(layer,'erase'),target=c.getContext('2d');this.drawLayer(target,layer,time,false);target.globalCompositeOperation='destination-in';target.drawImage(layer.eraseMask,0,0);ctx.drawImage(c,0,0);return;}
    if(layer.sprites){
      let target=ctx,clipCanvas;
      if(layer.spriteClip){clipCanvas=this.compositeSurface(layer,'clip');target=clipCanvas.getContext('2d');}
      for(const item of layer.sprites){
        const group=layer.spriteGroups[item.group],elapsed=Math.max(0,time-(item._birth||0)),frame=group.frames[Math.floor(elapsed/group.frameDuration)%group.frames.length],scale=item.size/Math.max(frame.width,frame.height);
        const source=sizedStampFrame(frame,item.size*Math.max(1,layer.scale));
        const alpha=target.globalAlpha;target.globalAlpha=alpha*item.opacity;target.drawImage(source,item.x-frame.width*scale/2,item.y-frame.height*scale/2,frame.width*scale,frame.height*scale);target.globalAlpha=alpha;
      }
      if(clipCanvas){target.globalCompositeOperation='destination-in';target.drawImage(layer.spriteClip,0,0);ctx.drawImage(clipCanvas,0,0);}
    }else{
      const elapsed=Math.max(0,time-(layer._birth||0));
      const frame=layer.frames?.length?layer.frames[Math.floor(elapsed/layer.frameDuration)%layer.frames.length]:layer.canvas;
      ctx.drawImage(frame,0,0,layer.width,layer.height);
    }
  }
  paint(ctx, guides = false) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, this.width, this.height);
    const hasPlayingDynamic=this.playing&&this.layers.some(layer=>layer.visible&&(layer.frames?.length||layer.sprites?.length));
    if (!this.gesture&&!hasPlayingDynamic) {
      if (!this.staticComposite || this.staticComposite.width!==this.width || this.staticComposite.height!==this.height) {
        const cached=makeCanvas(this.width,this.height),cachedCtx=cached.getContext('2d');
        cachedCtx.fillStyle='#ffffff';cachedCtx.fillRect(0,0,this.width,this.height);
        this.drawLayers(cachedCtx);
        this.staticComposite=cached;
      } else this.metrics.staticCacheHits++;
      ctx.drawImage(this.staticComposite,0,0);
    } else this.drawLayers(ctx);
    const g = this.gesture;
    if (guides && g && ['line', 'rect', 'ellipse'].includes(g.options.tool)) {
      ctx.save(); this.transform(ctx, g.layer); this.drawShape(ctx, g); ctx.restore();
    }
    ctx.restore();
  }
  drawLayers(ctx) {
    for (const layer of this.layers) {
      if (!layer.visible) continue;
      ctx.save(); ctx.globalAlpha = layer.opacity; this.transform(ctx, layer);
      this.drawLayer(ctx,layer); ctx.restore();
    }
  }
  point(event) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (event.clientX - r.left) * this.width / r.width, y: (event.clientY - r.top) * this.height / r.height };
  }
  pickLayer(point) {
    for(const layer of [...this.layers].reverse()){
      if(!layer.visible||layer.opacity===0||layer.role==='background')continue;
      const local=toLayerPoint(point,layer),x=Math.floor(local.x),y=Math.floor(local.y);
      if(x<0||y<0||x>=layer.width||y>=layer.height)continue;
      const sample=makeCanvas(1,1),ctx=sample.getContext('2d');ctx.translate(-x,-y);this.drawLayer(ctx,layer);
      if(ctx.getImageData(0,0,1,1).data[3]>8)return layer;
    }
    return null;
  }
  captureTiles(layer, bounds, tiles) {
    const context = layer.canvas.getContext('2d'), size = 128;
    const minX = Math.max(0, Math.floor(bounds.x / size)), minY = Math.max(0, Math.floor(bounds.y / size));
    const maxX = Math.min(Math.ceil(layer.width / size) - 1, Math.floor((bounds.x + bounds.width) / size));
    const maxY = Math.min(Math.ceil(layer.height / size) - 1, Math.floor((bounds.y + bounds.height) / size));
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const key = `${x}:${y}`; if (tiles.has(key)) continue;
      const left = x * size, top = y * size;
      tiles.set(key, { x: left, y: top, before: context.getImageData(left, top, Math.min(size, layer.width - left), Math.min(size, layer.height - top)) });
    }
  }
  recordPixels(layer, tiles) {
    if (!tiles.size) return;
    const context = layer.canvas.getContext('2d'); let bytes = 0;
    for (const tile of tiles.values()) { tile.after = context.getImageData(tile.x, tile.y, tile.before.width, tile.before.height); bytes += tile.before.data.byteLength * 2; }
    this.history.push({ bytes,
      undo: () => { for (const t of tiles.values()) context.putImageData(t.before, t.x, t.y); },
      redo: () => { for (const t of tiles.values()) context.putImageData(t.after, t.x, t.y); } });
  }
  begin(point, options) {
    const layer = this.active;
    if (!layer?.visible) throw new Error('先显示当前图层，或选择另一个图层。');
    if ((layer.frames?.length || layer.sprites) && options.tool !== 'move') throw new Error('动画图层请用移动工具编辑；绘画时新建一个图层。');
    const local = toLayerPoint(point, layer);
    this.gesture = { layer, options: { ...options }, start: local, last: local, end: local,
      origin: point, x: layer.x, y: layer.y, tiles: new Map() };
    if (['pen', 'eraser'].includes(options.tool)) this.segment(local, local);
    if (options.tool === 'fill') {
      const ctx = layer.canvas.getContext('2d'), before = ctx.getImageData(0, 0, layer.width, layer.height);
      const next = new ImageData(new Uint8ClampedArray(before.data), layer.width, layer.height);
      const color = options.color.match(/\w\w/g).map(h => parseInt(h, 16));
      const result = floodFill(next.data, layer.width, layer.height, local.x, local.y, [...color, Math.round(options.opacity * 255)], options.tolerance);
      if (result.count) {
        ctx.putImageData(next, 0, 0);
        this.history.push({ bytes: before.data.byteLength * 2, undo: () => ctx.putImageData(before, 0, 0), redo: () => ctx.putImageData(next, 0, 0) });
      }
      this.gesture = null; this.changed();
    }
  }
  segment(a, b) {
    const { layer, options: o, tiles } = this.gesture;
    const width = o.size / layer.scale, padding = width * 2 + 4;
    this.captureTiles(layer, { x: Math.min(a.x, b.x) - padding, y: Math.min(a.y, b.y) - padding,
      width: Math.abs(a.x - b.x) + padding * 2, height: Math.abs(a.y - b.y) + padding * 2 }, tiles);
    const ctx = layer.canvas.getContext('2d'); ctx.save(); ctx.strokeStyle = o.color; ctx.fillStyle = o.color;
    ctx.globalAlpha = o.opacity; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (o.tool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
    if (o.brush === 'soft' && o.tool !== 'eraser') { ctx.shadowColor = o.color; ctx.shadowBlur = width / 3; ctx.globalAlpha *= .5; }
    if (o.brush === 'crayon' && o.tool !== 'eraser') {
      const distance = Math.hypot(b.x - a.x, b.y - a.y), steps = Math.max(1, Math.ceil(distance / 2));
      ctx.globalAlpha *= .45;
      for (let i = 0; i <= steps; i++) {
        const x = a.x + (b.x - a.x) * i / steps, y = a.y + (b.y - a.y) * i / steps;
        for (let j = 0; j < 8; j++) {
          const angle = (x * 17 + y * 7 + j * 49) % 360 * Math.PI / 180;
          const radius = ((x * 3 + y * 13 + j * 31) % 100) / 100 * width / 2;
          ctx.fillRect(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius, Math.max(1, width / 15), Math.max(1, width / 15));
        }
      }
    } else if (a.x === b.x && a.y === b.y) { ctx.beginPath(); ctx.arc(a.x, a.y, width / 2, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    ctx.restore(); this.render();
  }
  update(point) {
    const g = this.gesture; if (!g) return;
    if (g.options.tool === 'move') { g.layer.x = g.x + point.x - g.origin.x; g.layer.y = g.y + point.y - g.origin.y; }
    else { const local = toLayerPoint(point, g.layer); g.end = local; if (['pen', 'eraser'].includes(g.options.tool)) this.segment(g.last, local); g.last = local; }
    this.render();
  }
  drawShape(ctx, g) {
    const { start: a, end: b, options: o } = g;
    ctx.strokeStyle = o.color; ctx.lineWidth = o.size / g.layer.scale; ctx.globalAlpha *= o.opacity; ctx.lineCap = 'round';
    ctx.beginPath();
    if (o.tool === 'line') { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    else if (o.tool === 'rect') ctx.rect(a.x, a.y, b.x - a.x, b.y - a.y);
    else ctx.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  end(cancel = false) {
    const g = this.gesture; if (!g) return;
    if (cancel) {
      g.layer.x = g.x; g.layer.y = g.y;
      const ctx = g.layer.canvas.getContext('2d'); for (const t of g.tiles.values()) ctx.putImageData(t.before, t.x, t.y);
    } else if (g.options.tool === 'move') {
      const after = { x: g.layer.x, y: g.layer.y };
      if (after.x !== g.x || after.y !== g.y) this.history.push({ bytes: 0,
        undo: () => Object.assign(g.layer, { x: g.x, y: g.y }), redo: () => Object.assign(g.layer, after) });
    } else {
      if (['line', 'rect', 'ellipse'].includes(g.options.tool)) {
        const padding = g.options.size / g.layer.scale + 2;
        this.captureTiles(g.layer, { x: Math.min(g.start.x, g.end.x) - padding, y: Math.min(g.start.y, g.end.y) - padding,
          width: Math.abs(g.end.x - g.start.x) + padding * 2, height: Math.abs(g.end.y - g.start.y) + padding * 2 }, g.tiles);
        const ctx = g.layer.canvas.getContext('2d'); ctx.save(); this.drawShape(ctx, g); ctx.restore();
      }
      this.recordPixels(g.layer, g.tiles);
    }
    this.gesture = null; this.changed();
  }
  async addAsset(asset) {
    if(asset.coloring) {
      const image=await loadImage(asset.src),canvas=makeCanvas(this.width,this.height),ctx=canvas.getContext('2d');
      const fit=fitInside(image.width,image.height,this.width,this.height);
      ctx.fillStyle='#ffffff';ctx.fillRect(0,0,this.width,this.height);
      ctx.drawImage(image,(this.width-fit.width)/2,(this.height-fit.height)/2,fit.width,fit.height);
      return this.replaceBackground(asset.name,canvas,{sourceId:asset.id,insertAt:0,role:'background'});
    }
    if(asset.category==='frame') {
      const image=await loadImage(asset.src),canvas=makeCanvas(this.width,this.height),ctx=canvas.getContext('2d');
      // Nine-slice fitting keeps corner decorations round while all four edges reach the paper.
      const inset=Math.min(image.width,image.height)*.28,corner=Math.min(this.width,this.height)*.28;
      const sx=[0,inset,image.width-inset,image.width],sy=[0,inset,image.height-inset,image.height];
      const dx=[0,corner,this.width-corner,this.width],dy=[0,corner,this.height-corner,this.height];
      for(let y=0;y<3;y++)for(let x=0;x<3;x++){if(x===1&&y===1)continue;ctx.drawImage(image,sx[x],sy[y],sx[x+1]-sx[x],sy[y+1]-sy[y],dx[x],dy[y],dx[x+1]-dx[x],dy[y+1]-dy[y]);}
      return this.addLayer(asset.name,canvas,true,{sourceId:asset.id});
    }
    const image = await loadImage(asset.src), canvas = makeCanvas(image.width, image.height);
    canvas.getContext('2d').drawImage(image, 0, 0);
    const full = ['background', 'frame', 'paper', 'texture'].includes(asset.category);
    const fit = fitInside(image.width, image.height, this.width * (full ? 1 : .32), this.height * (full ? 1 : .5));
    const extra = { scale: fit.width / image.width, sourceId: asset.id };
    if(asset.category==='background')extra.scale=Math.max(this.width/image.width,this.height/image.height);
    if (['background', 'paper', 'texture'].includes(asset.category)) { extra.insertAt = 0; extra.role = 'background'; }
    if (asset.frames?.length) { extra.frames = await Promise.all(asset.frames.map(loadImage)); extra.frameDuration = asset.frameDuration; }
    if (extra.role === 'background') return this.replaceBackground(asset.name, canvas, extra);
    const layer=this.addLayer(asset.name, canvas, true, extra);
    if(extra.frames)Object.defineProperty(layer,'_birth',{value:this.playing?performance.now()-this.animationStart:this.animationTime||0,writable:true});
    return layer;
  }
  replaceBackground(name, canvas, extra) {
      // Replace the paper beneath the artwork in one undoable operation.
      const before = this.layers.slice(), previous = this.activeId;
      this.layers = before.filter(layer => layer.role !== 'background' && !/^(color[0-4]|paper|texture)-/.test(layer.sourceId || ''));
      let background;
      try { background = this.addLayer(name, canvas, false, extra); }
      catch (error) { this.layers = before; this.activeId = previous; throw error; }
      this.activeId = this.layers.find(layer => layer.id === previous)?.id || this.layers.at(-1).id;
      const after = this.layers.slice(), active = this.activeId;
      this.history.push({ bytes: [...before.filter(layer => !after.includes(layer)), background].reduce((n, layer) => n + layer.width * layer.height * 4, 0),
        undo: () => { this.layers = before.slice(); this.activeId = previous; },
        redo: () => { this.layers = after.slice(); this.activeId = active; } });
      this.changed(); return background;
  }
  ensureDrawingLayer(name = '我的画笔') {
    const layer = this.active;
    const fullPaper = layer?.visible && layer.opacity>0 && !layer.frames?.length && !layer.sprites && !layer.eraseMask && !layer.sourceId && layer.role !== 'background' && layer.width === this.width && layer.height === this.height && layer.scale === 1 && layer.rotation === 0 && layer.x === this.width / 2 && layer.y === this.height / 2;
    if (!fullPaper || layer !== this.layers.at(-1)) this.addLayer(name);
    return this.active;
  }
  async serialize(title) {
    const widthAtStart=this.width,heightAtStart=this.height;
    const jobs = this.layers.map(layer => {
      const { id, name, width, height, x, y, scale, rotation, opacity, visible, sourceId, role } = layer;
      const item = { id, name, width, height, x, y, scale, rotation, opacity, visible, sourceId, role };
      // Start every mutable-canvas snapshot before yielding, so drawing can
      // continue while PNG encoding completes without mixing document revisions.
      const jobs=[canvasPNG(layer.canvas).then(value=>{item.image=value;})];
      if(layer.eraseMask)jobs.push(canvasPNG(layer.eraseMask).then(value=>{item.eraseMask=value;}));
      if (layer.frames?.length) {
        jobs.push(Promise.all(layer.frames.map(frame=>framePNG(frame,width,height))).then(value=>{item.frames=value;}));
        item.frameDuration = layer.frameDuration;
      }
      if(layer.sprites){
        item.sprites=layer.sprites.map(s=>({...s}));item.spriteMask=layer.spriteMask;
        jobs.push(Promise.all(layer.spriteGroups.map(async g=>({frameDuration:g.frameDuration,frames:await Promise.all(g.frames.map(async frame=>({width:frame.width,height:frame.height,image:await framePNG(frame)})))}))).then(value=>{item.spriteGroups=value;}));
      }
      return Promise.all(jobs).then(()=>item);
    });
    const layers=await Promise.all(jobs);
    // Never write a document that our own importer would refuse to reopen.
    return validateProject({ format: 'luoye-studio', version: layers.some(l=>l.eraseMask)?2:1, title, width: widthAtStart, height: heightAtStart, layers });
  }
  async restore(raw) {
    const value = validateProject(raw), layers = [];
    const resources=new Map(),resource=src=>{if(!resources.has(src))resources.set(src,loadImage(src));return resources.get(src);};
    // Decode and validate the entire incoming document before replacing the current one.
    for (const info of value.layers) {
      const image = await loadImage(info.image);
      if (image.width !== info.width || image.height !== info.height) throw new Error('图层图片与记录尺寸不一致。');
      const canvas = makeCanvas(info.width, info.height); canvas.getContext('2d').drawImage(image, 0, 0);
      const layer = { ...info, canvas }; delete layer.image;
      if (!layer.role && /^(color[0-4]|paper|texture)-/.test(layer.sourceId || '')) layer.role = 'background';
      if(info.eraseMask){const mask=await loadImage(info.eraseMask);layer.eraseMask=makeCanvas(info.width,info.height);layer.eraseMask.getContext('2d').drawImage(mask,0,0);}
      if (info.frames) {
        Object.defineProperty(layer,'_birth',{value:this.playing?performance.now()-this.animationStart:this.animationTime||0,writable:true});
        layer.frames = [];
        for (const data of info.frames) { const frame = await resource(data); if (frame.width !== info.width || frame.height !== info.height) throw new Error('动画帧尺寸不一致。'); layer.frames.push(frame); }
      }
      if(info.sprites){
        for(const sprite of layer.sprites)Object.defineProperty(sprite,'_birth',{value:this.playing?performance.now()-this.animationStart:this.animationTime||0,writable:true});
        layer.spriteGroups=[];
        for(const group of info.spriteGroups){const frames=[];for(const data of group.frames){const frame=await resource(data.image);if(frame.width!==data.width||frame.height!==data.height)throw new Error('魔法袋帧尺寸不一致。');frames.push(frame);}layer.spriteGroups.push({frameDuration:group.frameDuration,frames});}
        if(info.spriteMask)layer.spriteClip=await loadImage(info.spriteMask);
      }
      layers.push(layer);
    }
    this.width = value.width; this.height = value.height; this.canvas.width = value.width; this.canvas.height = value.height;
    this.layers = layers; this.activeId = layers.at(-1).id; this.history.clear(); this.gesture = null; this.changed();
    return value.title;
  }
  exportPNG() { const canvas = makeCanvas(this.width, this.height); this.paint(canvas.getContext('2d')); return canvas.toDataURL('image/png'); }
}
