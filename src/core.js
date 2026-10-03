// Dynamic stamps are kept as compact sprite records and rendered through the
// coalesced frame scheduler.  The old limits were reached after only a few
// strokes with animated Magic Bag assets.
export const MAX_SPRITES_PER_LAYER=100000;
export const MAX_PROJECT_SPRITES=500000;
export const MAX_LAYERS=200;
export function fitInside(width, height, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function toLayerPoint(point, layer) {
  const angle = -layer.rotation * Math.PI / 180;
  const x = point.x - layer.x, y = point.y - layer.y;
  return {
    x: ((x * Math.cos(angle) - y * Math.sin(angle)) / layer.scale) * (layer.flipX ? -1 : 1) + layer.width / 2,
    y: ((x * Math.sin(angle) + y * Math.cos(angle)) / layer.scale) * (layer.flipY ? -1 : 1) + layer.height / 2,
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

// Close a small break in a line-art boundary before flooding.  The boundary
// is only used for reachability; pixels in the source image keep their own
// colour and alpha when the fill is committed.  A component that still
// reaches the canvas edge is considered open and is rejected by default so a
// large gap can never turn the whole page into one fill operation.
function morphAxis(source, width, height, radius, horizontal, dilate) {
  const output = new Uint8Array(source.length);
  const lines = horizontal ? height : width;
  const length = horizontal ? width : height;
  for (let line = 0; line < lines; line++) {
    const prefix = new Uint32Array(length + 1);
    for (let i = 0; i < length; i++) {
      const index = horizontal ? line * width + i : i * width + line;
      prefix[i + 1] = prefix[i] + source[index];
    }
    for (let i = 0; i < length; i++) {
      const start = Math.max(0, i - radius), end = Math.min(length, i + radius + 1);
      const count = prefix[end] - prefix[start], span = end - start;
      const value = dilate ? count > 0 : count === span;
      const index = horizontal ? line * width + i : i * width + line;
      output[index] = value ? 1 : 0;
    }
  }
  return output;
}

function closeBoundaryMask(mask, width, height, radius) {
  if (!radius) return mask;
  let result = morphAxis(mask, width, height, radius, true, true);
  result = morphAxis(result, width, height, radius, false, true);
  result = morphAxis(result, width, height, radius, true, false);
  return morphAxis(result, width, height, radius, false, false);
}

/**
 * Fill a line-art region while tolerating a small break in its outline.
 *
 * `options.maxGap` is the largest break (in pixels) to bridge.  The default
 * safety rule rejects a result that is connected to any canvas edge; pass
 * `{ rejectOpen: false }` only for callers that intentionally want that
 * behaviour.  The source array is unchanged when a component is rejected.
 */
export function closedFloodFill(data, width, height, x, y, color, tolerance = 12, options = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || data.length < width * height * 4) return { count: 0 };
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= width || y >= height) return { count: 0 };
  const seed = y * width + x, target = data.slice(seed * 4, seed * 4 + 4);
  if (color.every((value, index) => value === target[index])) return { count: 0 };
  const barrier = new Uint8Array(width * height);
  for (let p = 0; p < barrier.length; p++) {
    const offset = p * 4;
    barrier[p] = target.some((value, index) => Math.abs(data[offset + index] - value) > tolerance) ? 1 : 0;
  }
  if (barrier[seed]) return { count: 0 };

  const maxGap = Math.max(0, Math.min(32, Math.floor(Number(options.maxGap ?? 4) || 0)));
  const closed = closeBoundaryMask(barrier, width, height, Math.ceil(maxGap / 2));
  const visited = new Uint8Array(width * height), stack = new Uint32Array(width * height);
  let top = 0, touchesEdge = false;
  stack[top++] = seed; visited[seed] = 1;
  const push = p => {
    if (!visited[p] && !closed[p]) { visited[p] = 1; stack[top++] = p; }
  };
  while (top) {
    const p = stack[--top], px = p % width, py = Math.floor(p / width);
    if (px === 0 || py === 0 || px === width - 1 || py === height - 1) touchesEdge = true;
    if (px) push(p - 1);
    if (px < width - 1) push(p + 1);
    if (py) push(p - width);
    if (py < height - 1) push(p + width);
  }
  if (touchesEdge && options.rejectOpen !== false) return { count: 0, open: true };

  const fill = Array.isArray(color) || ArrayBuffer.isView(color) ? color : [0, 0, 0, 255];
  let count = 0, bridged = 0;
  const isVisitedNeighbour = p => {
    const px = p % width, py = Math.floor(p / width);
    return (px && visited[p - 1]) || (px < width - 1 && visited[p + 1]) || (py && visited[p - width]) || (py < height - 1 && visited[p + width]);
  };
  for (let p = 0; p < visited.length; p++) {
    // A target-colour pixel swallowed by the closed boundary is only a
    // virtual bridge. It must stay untouched so filling a colouring-page
    // opening never paints over the original line art.
    if (!visited[p] || barrier[p]) {
      if (!barrier[p] && closed[p] && isVisitedNeighbour(p)) bridged++;
      continue;
    }
    const offset = p * 4;
    for (let index = 0; index < 4; index++) data[offset + index] = fill[index] ?? (index === 3 ? 255 : 0);
    count++;
  }
  return { count, open: false, bridged };
}

export class History {
  constructor(budget = 96 * 1024 * 1024) { this.budget = budget; this.clear(); }
  clear() { this.past = []; this.future = []; this.pastBytes = 0; this.futureBytes = 0; }
  push(entry) {
    this.future = []; this.futureBytes = 0; this.past.push(entry); this.pastBytes += entry.bytes || 0;
    while (this.past.length > 1 && this.pastBytes > this.budget) this.pastBytes -= this.past.shift().bytes || 0;
  }
  undo() { const entry = this.past.pop(); if (entry) { this.pastBytes -= entry.bytes || 0; entry.undo(); this.future.push(entry); this.futureBytes += entry.bytes || 0; return true; } return false; }
  redo() { const entry = this.future.pop(); if (entry) { this.futureBytes -= entry.bytes || 0; entry.redo(); this.past.push(entry); this.pastBytes += entry.bytes || 0; return true; } return false; }
}

export function validateProject(value) {
  // Earlier editions used the same bounded document schema with another prefix.
  if(value&&typeof value.format==='string'&&/^[a-z]+-studio$/.test(value.format))value={...value,format:'luoye-studio'};
  const fail = (message) => { throw new Error(message); };
  if (!value || value.format !== 'luoye-studio' || ![1,2].includes(value.version)) fail('不是支持的落叶画板工程，或版本过新。');
  const size = (w, h) => Number.isInteger(w) && Number.isInteger(h) && w > 0 && h > 0 && w <= 4096 && h <= 4096 && w * h <= 8_388_608;
  if (!size(value.width, value.height)) fail('画布尺寸超出当前版本支持范围。');
  if (typeof value.title !== 'string' || value.title.length > 120) fail('作品名称无效。');
  if (!Array.isArray(value.layers) || value.layers.length < 1 || value.layers.length > MAX_LAYERS) fail(`工程需要 1–${MAX_LAYERS} 个图层。`);
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
    if (layer.flipX !== undefined && typeof layer.flipX !== 'boolean') fail('图层镜像参数无效。');
    if (layer.flipY !== undefined && typeof layer.flipY !== 'boolean') fail('图层镜像参数无效。');
    if (layer.role !== undefined && !['background','scratch','scratch-base'].includes(layer.role)) fail('图层类型无效。');
    if (layer.scratchStyle !== undefined) {
      if (layer.role !== 'scratch' || !layer.scratchStyle || typeof layer.scratchStyle !== 'object') fail('刮刮画覆盖样式无效。');
      const style = layer.scratchStyle;
      for (const key of ['color', 'secondaryColor', 'patternColor']) if (style[key] !== undefined && (typeof style[key] !== 'string' || style[key].length > 128)) fail('刮刮画覆盖颜色无效。');
      for (const key of ['baseColor', 'baseSecondaryColor']) if (style[key] !== undefined && (typeof style[key] !== 'string' || style[key].length > 128)) fail('刮刮画底色无效。');
      if (style.baseMode !== undefined && !['solid', 'rainbow'].includes(style.baseMode)) fail('刮刮画底色模式无效。');
      if (style.pattern !== undefined && !['none', 'dots'].includes(style.pattern)) fail('刮刮画覆盖纹理无效。');
      if (style.patternSpacing !== undefined && (!Number.isFinite(style.patternSpacing) || style.patternSpacing < 16 || style.patternSpacing > 128)) fail('刮刮画覆盖间距无效。');
    }
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
      sprites+=layer.sprites.length;if(sprites>MAX_PROJECT_SPRITES)fail('一幅画最多支持 500,000 个动态图案。');
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
