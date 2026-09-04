import { History, fitInside, floodFill, toLayerPoint, validateProject } from './core.js';

export function makeCanvas(width, height) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  return canvas;
}

export function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片无法读取，请检查素材或文件。')); image.src = src;
  });
}

export class PaintEngine {
  constructor(canvas, onChange) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.onChange = onChange;
    this.history = new History(); this.layers = []; this.activeId = ''; this.playing = true;
    this.gesture = null; this.drawQueued = false; this.animationStart = performance.now();
    this.animationTimer = setInterval(() => { if (this.playing && this.layers.some(l => l.frames?.length)) this.render(); }, 100);
    this.reset(1920, 1080);
  }
  reset(width, height) {
    this.width = width; this.height = height; this.canvas.width = width; this.canvas.height = height;
    this.layers = []; this.history.clear(); this.gesture = null;
    this.addLayer('我的画笔', makeCanvas(width, height), false); this.changed();
  }
  get active() { return this.layers.find(l => l.id === this.activeId); }
  changed() { this.render(); this.onChange?.(); }
  addLayer(name = '新的图层', canvas = makeCanvas(this.width, this.height), record = true, extra = {}) {
    const existingPixels=this.layers.reduce((sum,layer)=>sum+layer.width*layer.height*(1+(layer.frames?.length||0)),0);
    if(existingPixels+canvas.width*canvas.height*(1+(extra.frames?.length||0))>90000000)throw new Error('图层和动画超过像素预算，请先合并或删除部分图层。');
    if (this.layers.length >= 20) throw new Error('当前版本最多支持 20 个图层。');
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
  reorder(delta) {
    const layer = this.active, from = this.layers.indexOf(layer), to = from + delta;
    if (to < 0 || to >= this.layers.length) return;
    const move = (a, b) => this.layers.splice(b, 0, this.layers.splice(a, 1)[0]);
    move(from, to); this.history.push({ bytes: 0, undo: () => move(to, from), redo: () => move(from, to) }); this.changed();
  }
  setProperty(layer, key, value) {
    const before = layer[key]; if (before === value) return;
    layer[key] = value;
    this.history.push({ bytes: 0, undo: () => { layer[key] = before; }, redo: () => { layer[key] = value; } });
    this.changed();
  }
  undo() { if (this.gesture) this.end(true); if (this.history.undo()) this.changed(); }
  redo() { if (this.history.redo()) this.changed(); }
  render() {
    if (this.drawQueued) return;
    this.drawQueued = true; this.renderFrame = requestAnimationFrame(() => { this.drawQueued = false; this.paint(this.ctx, true); });
  }
  transform(ctx, layer) {
    ctx.translate(layer.x, layer.y); ctx.rotate(layer.rotation * Math.PI / 180); ctx.scale(layer.scale, layer.scale);
    ctx.translate(-layer.width / 2, -layer.height / 2);
  }
  paint(ctx, guides = false) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, this.width, this.height);
    for (const layer of this.layers) {
      if (!layer.visible) continue;
      ctx.save(); ctx.globalAlpha = layer.opacity; this.transform(ctx, layer);
      const frame = layer.frames?.length ? layer.frames[this.frameIndex ? this.frameIndex(layer) : Math.floor((this.playing ? performance.now() - this.animationStart : 0) / layer.frameDuration) % layer.frames.length] : layer.canvas;
      ctx.drawImage(frame, 0, 0, layer.width, layer.height); ctx.restore();
    }
    const g = this.gesture;
    if (guides && g && ['line', 'rect', 'ellipse'].includes(g.options.tool)) {
      ctx.save(); this.transform(ctx, g.layer); this.drawShape(ctx, g); ctx.restore();
    }
    ctx.restore();
  }
  point(event) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (event.clientX - r.left) * this.width / r.width, y: (event.clientY - r.top) * this.height / r.height };
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
    if (layer.frames?.length && options.tool !== 'move') throw new Error('动画图层请用移动工具编辑；绘画时新建一个图层。');
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
    const image = await loadImage(asset.src), canvas = makeCanvas(image.width, image.height);
    canvas.getContext('2d').drawImage(image, 0, 0);
    const full = ['background', 'frame', 'paper', 'texture'].includes(asset.category);
    const fit = fitInside(image.width, image.height, this.width * (full ? 1 : .32), this.height * (full ? 1 : .5));
    const extra = { scale: fit.width / image.width, sourceId: asset.id };
    if (asset.category === 'background' || asset.category === 'paper' || asset.category === 'texture') extra.insertAt = 0;
    if (asset.frames?.length) { extra.frames = await Promise.all(asset.frames.map(loadImage)); extra.frameDuration = asset.frameDuration; }
    return this.addLayer(asset.name, canvas, true, extra);
  }
  async serialize(title) {
    const layers = this.layers.map(layer => {
      const { id, name, width, height, x, y, scale, rotation, opacity, visible, sourceId } = layer;
      const item = { id, name, width, height, x, y, scale, rotation, opacity, visible, sourceId, image: layer.canvas.toDataURL('image/png') };
      if (layer.frames?.length) {
        item.frames = layer.frames.map(frame => { const c = makeCanvas(width, height); c.getContext('2d').drawImage(frame, 0, 0, width, height); return c.toDataURL('image/png'); });
        item.frameDuration = layer.frameDuration;
      }
      return item;
    });
    // Never write a document that our own importer would refuse to reopen.
    return validateProject({ format: 'jshw-studio', version: 1, title, width: this.width, height: this.height, layers });
  }
  async restore(raw) {
    const value = validateProject(raw), layers = [];
    // Decode and validate the entire incoming document before replacing the current one.
    for (const info of value.layers) {
      const image = await loadImage(info.image);
      if (image.width !== info.width || image.height !== info.height) throw new Error('图层图片与记录尺寸不一致。');
      const canvas = makeCanvas(info.width, info.height); canvas.getContext('2d').drawImage(image, 0, 0);
      const layer = { ...info, canvas }; delete layer.image;
      if (info.frames) {
        layer.frames = [];
        for (const data of info.frames) { const frame = await loadImage(data); if (frame.width !== info.width || frame.height !== info.height) throw new Error('动画帧尺寸不一致。'); layer.frames.push(frame); }
      }
      layers.push(layer);
    }
    this.width = value.width; this.height = value.height; this.canvas.width = value.width; this.canvas.height = value.height;
    this.layers = layers; this.activeId = layers.at(-1).id; this.history.clear(); this.gesture = null; this.changed();
    return value.title;
  }
  exportPNG() { const canvas = makeCanvas(this.width, this.height); this.paint(canvas.getContext('2d')); return canvas.toDataURL('image/png'); }
}
