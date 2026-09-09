export const MAX_SPRITES_PER_LAYER=10000;
export const MAX_PROJECT_SPRITES=50000;
export function fitInside(width, height, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function toLayerPoint(point, layer) {
  const angle = -layer.rotation * Math.PI / 180;
  const x = point.x - layer.x, y = point.y - layer.y;
  return {
    x: (x * Math.cos(angle) - y * Math.sin(angle)) / layer.scale + layer.width / 2,
    y: (x * Math.sin(angle) + y * Math.cos(angle)) / layer.scale + layer.height / 2,
  };
}

export function floodFill(data, width, height, x, y, color, tolerance = 12) {
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= width || y >= height) return { count: 0 };
  const seed = y * width + x;
  const target = data.slice(seed * 4, seed * 4 + 4);
  if (color.every((v, i) => v === target[i])) return { count: 0 };
  const visited = new Uint8Array(width * height);
  const stack = new Uint32Array(width * height);
  let top = 0, count = 0;
  stack[top++] = seed; visited[seed] = 1;
  const push = (p) => { if (!visited[p]) { visited[p] = 1; stack[top++] = p; } };
  while (top) {
    const p = stack[--top], i = p * 4;
    if (target.some((v, k) => Math.abs(data[i + k] - v) > tolerance)) continue;
    data.set(color, i); count++;
    if (p % width) push(p - 1);
    if (p % width < width - 1) push(p + 1);
    if (p >= width) push(p - width);
    if (p < width * (height - 1)) push(p + width);
  }
  return { count };
}

export class History {
  constructor(budget = 96 * 1024 * 1024) { this.budget = budget; this.clear(); }
  clear() { this.past = []; this.future = []; }
  push(entry) {
    this.future = []; this.past.push(entry);
    while (this.past.length > 1 && this.past.reduce((n, e) => n + (e.bytes || 0), 0) > this.budget) this.past.shift();
  }
  undo() { const entry = this.past.pop(); if (entry) { entry.undo(); this.future.push(entry); return true; } return false; }
  redo() { const entry = this.future.pop(); if (entry) { entry.redo(); this.past.push(entry); return true; } return false; }
}

export function validateProject(value) {
  // Earlier editions used the same bounded document schema with another prefix.
  if(value&&typeof value.format==='string'&&/^[a-z]+-studio$/.test(value.format))value={...value,format:'luoye-studio'};
  const fail = (message) => { throw new Error(message); };
  if (!value || value.format !== 'luoye-studio' || ![1,2].includes(value.version)) fail('不是支持的落叶画板工程，或版本过新。');
  const size = (w, h) => Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0 && w <= 4096 && h <= 4096 && w * h <= 8_388_608;
  if (!size(value.width, value.height)) fail('画布尺寸超出当前版本支持范围。');
  if (typeof value.title !== 'string' || value.title.length > 120) fail('作品名称无效。');
  if (!Array.isArray(value.layers) || value.layers.length < 1 || value.layers.length > 20) fail('工程需要 1–20 个图层。');
  const ids = new Set(),resources=new Set(); let bytes = 0, pixels = 0,sprites=0;
  const resourcePixels=(image,width,height)=>{if(resources.has(image))return;resources.add(image);pixels+=width*height;};
  const png = (image, width, height) => {
    if (typeof image !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image)) fail('工程只能包含内嵌 PNG 图片。');
    let header;
    try { header = Uint8Array.from(atob(image.slice(22, 66)), c => c.charCodeAt(0)); } catch { fail('PNG 编码无效。'); }
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (header.length < 24 || signature.some((v, i) => v !== header[i])) fail('PNG 文件头无效。');
    const view = new DataView(header.buffer);
    if (view.getUint32(16) !== width || view.getUint32(20) !== height) fail('PNG 尺寸与工程记录不一致。');
  };
  for (const layer of value.layers) {
    if (!layer || typeof layer.id !== 'string' || ids.has(layer.id)) fail('图层标识重复或缺失。');
    ids.add(layer.id);
    if (!size(layer.width, layer.height)) fail('图层尺寸无效。');
    pixels += layer.width * layer.height;
    if (typeof layer.name !== 'string' || layer.name.length > 120) fail('图层名称无效。');
    if (![layer.x, layer.y, layer.rotation, layer.scale, layer.opacity].every(Number.isFinite)) fail('图层参数无效。');
    if (layer.scale <= 0 || layer.scale > 100 || layer.opacity < 0 || layer.opacity > 1 || Math.abs(layer.x) > 100_000 || Math.abs(layer.y) > 100_000) fail('图层参数超出范围。');
    if (typeof layer.visible !== 'boolean') fail('图层可见性无效。');
    if (layer.role !== undefined && layer.role !== 'background') fail('图层类型无效。');
    png(layer.image, layer.width, layer.height);
    bytes += layer.image.length;
    if(layer.eraseMask!==undefined){png(layer.eraseMask,layer.width,layer.height);bytes+=layer.eraseMask.length;pixels+=layer.width*layer.height;}
    if (layer.frames !== undefined) {
      if (!Array.isArray(layer.frames) || layer.frames.length > 60 || !Number.isFinite(layer.frameDuration) || layer.frameDuration < 30 || layer.frameDuration > 10000) fail('动画参数无效。');
      for (const frame of layer.frames) {
        png(frame, layer.width, layer.height);
        bytes += frame.length; resourcePixels(frame,layer.width,layer.height);
      }
    }
    if(layer.sprites!==undefined){
      if(!Array.isArray(layer.sprites)||layer.sprites.length>MAX_SPRITES_PER_LAYER||!Array.isArray(layer.spriteGroups)||!layer.spriteGroups.length||layer.spriteGroups.length>200)fail('魔法袋组合无效。');
      sprites+=layer.sprites.length;if(sprites>MAX_PROJECT_SPRITES)fail('一幅画最多支持 50,000 个动态图案。');
      for(const group of layer.spriteGroups){
        if(!group||!Array.isArray(group.frames)||!group.frames.length||group.frames.length>60||!Number.isFinite(group.frameDuration)||group.frameDuration<30||group.frameDuration>10000)fail('魔法袋动画无效。');
        for(const frame of group.frames){if(!size(frame.width,frame.height))fail('魔法袋图片尺寸无效。');png(frame.image,frame.width,frame.height);bytes+=frame.image.length;resourcePixels(frame.image,frame.width,frame.height);}
      }
      for(const sprite of layer.sprites)if(!sprite||!Number.isInteger(sprite.group)||!layer.spriteGroups[sprite.group]||![sprite.x,sprite.y,sprite.size,sprite.opacity].every(Number.isFinite)||Math.abs(sprite.x)>100000||Math.abs(sprite.y)>100000||sprite.size<=0||sprite.size>4096||sprite.opacity<0||sprite.opacity>1)fail('魔法袋位置或大小无效。');
      if(layer.spriteMask){png(layer.spriteMask,layer.width,layer.height);bytes+=layer.spriteMask.length;pixels+=layer.width*layer.height;}
    }
  }
  if (bytes > 128 * 1024 * 1024 || pixels > 90_000_000) fail('工程太大，超过当前版本的安全预算。');
  return value;
}
