import { makeCanvas } from './engine.js';
import { playfulIcon } from './playful-icons.js';

// Keep the grid small and predictable. A child can understand an 8 × 8 or
// 16 × 16 picture immediately, while 32 × 32 still leaves room for details.
export const PIXEL_GRID_SIZES = [8, 16, 24, 32];
export const PIXEL_COLORS = ['#000000', '#285b49', '#759667', '#aeca96', '#e0b24a', '#ed9448', '#d9715f', '#cf6f83', '#b398b7', '#7694b9', '#68a9ae', '#ffffff'];

function assertGridSize(value) {
  const size = Number(value);
  // The UI exposes the four child-friendly presets, while the model accepts
  // any small grid for imported drawings and focused unit tests.
  if (!Number.isInteger(size) || size < 1 || size > 64) throw new Error('像素画网格需要在 1 到 64 格之间。');
  return size;
}

export function normalizePixelColor(value) {
  if (value == null || value === '' || value === 'transparent') return null;
  const source = String(value).trim();
  if (/^#[0-9a-f]{3}$/i.test(source)) return '#' + [...source.slice(1)].map(char => char + char).join('').toLowerCase();
  if (/^(?:[0-9a-f]{6})$/i.test(source)) return '#' + source.toLowerCase();
  if (/^#[0-9a-f]{6}$/i.test(source)) return source.toLowerCase();
  throw new Error('像素颜色需要使用十六进制颜色。');
}

function inside(x, y, width, height) {
  return Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < width && y < height;
}

/** Convert a pointer position to a grid cell without allowing edge overflow. */
export function cellAtPoint(clientX, clientY, rect, width, height) {
  if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top) || rect.width <= 0 || rect.height <= 0) return null;
  const x = Number(clientX) - rect.left, y = Number(clientY) - rect.top;
  if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null;
  return {
    x: Math.min(width - 1, Math.floor(x * width / rect.width)),
    y: Math.min(height - 1, Math.floor(y * height / rect.height)),
  };
}

function lineCells(start, end) {
  const cells = [];
  let x = start.x, y = start.y;
  const dx = Math.abs(end.x - start.x), sx = start.x < end.x ? 1 : -1;
  const dy = -Math.abs(end.y - start.y), sy = start.y < end.y ? 1 : -1;
  let error = dx + dy;
  while (true) {
    cells.push({ x, y });
    if (x === end.x && y === end.y) break;
    const twice = 2 * error;
    if (twice >= dy) { error += dy; x += sx; }
    if (twice <= dx) { error += dx; y += sy; }
  }
  return cells;
}

/**
 * Small DOM-free pixel model. Pixels are color strings or null for a
 * transparent cell, so it stays tiny even when the editor is open for a long
 * time. The UI is responsible for painting the model on a canvas.
 */
export class PixelArtModel {
  constructor({ width = 16, height = width, pixels = [] } = {}) {
    this.width = assertGridSize(width);
    this.height = assertGridSize(height);
    this.pixels = new Array(this.width * this.height).fill(null);
    if (pixels.length) {
      if (pixels.length !== this.pixels.length) throw new Error('像素画数据与网格尺寸不一致。');
      this.pixels = pixels.map(normalizePixelColor);
    }
  }

  index(x, y) { return y * this.width + x; }
  getCell(x, y) { return inside(x, y, this.width, this.height) ? this.pixels[this.index(x, y)] : null; }
  setCell(x, y, color) {
    if (!inside(x, y, this.width, this.height)) return false;
    this.pixels[this.index(x, y)] = normalizePixelColor(color);
    return true;
  }

  isEmpty() { return this.pixels.every(pixel => pixel == null); }

  clear() {
    this.pixels.fill(null);
    return this;
  }

  stroke(start, end, color) {
    const value = normalizePixelColor(color);
    let count = 0;
    for (const cell of lineCells(start, end)) if (this.setCell(cell.x, cell.y, value)) count += 1;
    return count;
  }

  /** Fill one four-connected region. Transparent cells are a valid region. */
  fill(x, y, color) {
    if (!inside(x, y, this.width, this.height)) return 0;
    const value = normalizePixelColor(color), target = this.getCell(x, y);
    if (target === value) return 0;
    const queue = [[x, y]], seen = new Uint8Array(this.width * this.height);
    let count = 0;
    while (queue.length) {
      const [cx, cy] = queue.pop();
      if (!inside(cx, cy, this.width, this.height)) continue;
      const offset = this.index(cx, cy);
      if (seen[offset] || this.pixels[offset] !== target) continue;
      seen[offset] = 1; this.pixels[offset] = value; count += 1;
      queue.push([cx - 1, cy], [cx + 1, cy], [cx, cy - 1], [cx, cy + 1]);
    }
    return count;
  }

  /** Resize with nearest-neighbour mapping so a child can change detail level without losing the drawing. */
  resize(width, height = width) {
    const nextWidth = assertGridSize(width), nextHeight = assertGridSize(height);
    const previous = this.pixels, oldWidth = this.width, oldHeight = this.height;
    this.width = nextWidth; this.height = nextHeight;
    this.pixels = new Array(nextWidth * nextHeight).fill(null);
    for (let y = 0; y < nextHeight; y++) for (let x = 0; x < nextWidth; x++) {
      const sourceX = Math.min(oldWidth - 1, Math.floor(x * oldWidth / nextWidth));
      const sourceY = Math.min(oldHeight - 1, Math.floor(y * oldHeight / nextHeight));
      this.pixels[this.index(x, y)] = previous[sourceY * oldWidth + sourceX] || null;
    }
    return this;
  }

  toJSON() { return { width: this.width, height: this.height, pixels: [...this.pixels] }; }

  render(target, { showGrid = true } = {}) {
    if (!target || typeof target.getContext !== 'function') throw new Error('像素画预览画布无效。');
    const context = target.getContext('2d');
    const cellWidth = target.width / this.width, cellHeight = target.height / this.height;
    context.save();
    context.imageSmoothingEnabled = false;
    context.clearRect(0, 0, target.width, target.height);
    for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width; x++) {
      if (showGrid) {
        context.fillStyle = (x + y) % 2 ? '#f0e3c8' : '#fff8e7';
        context.fillRect(x * cellWidth, y * cellHeight, cellWidth + .5, cellHeight + .5);
      }
      const color = this.getCell(x, y);
      if (color) { context.fillStyle = color; context.fillRect(x * cellWidth, y * cellHeight, cellWidth + .5, cellHeight + .5); }
    }
    if (showGrid) {
      context.strokeStyle = '#c69b6a66'; context.lineWidth = Math.max(1, Math.min(cellWidth, cellHeight) / 24); context.beginPath();
      for (let x = 0; x <= this.width; x++) { const point = Math.round(x * cellWidth) + .5; context.moveTo(point, 0); context.lineTo(point, target.height); }
      for (let y = 0; y <= this.height; y++) { const point = Math.round(y * cellHeight) + .5; context.moveTo(0, point); context.lineTo(target.width, point); }
      context.stroke();
    }
    context.restore();
    return target;
  }

  toCanvas(size = 512) {
    const target = makeCanvas(Math.max(8, Math.round(size)), Math.max(8, Math.round(size)), false);
    this.render(target, { showGrid: false });
    return target;
  }
}

function pixelButton(label, icon = 'pixel') {
  const element = document.createElement('button');
  element.type = 'button'; element.className = 'pixel-action'; element.innerHTML = `${playfulIcon(icon)}<span>${label}</span>`;
  return element;
}

/** Mount a focused pixel editor. It only commits a normal raster layer when the child taps “放回画板”. */
export function mountPixelEditor({ engine, run, toast, getColor } = {}) {
  const dialog = document.createElement('dialog');
  dialog.id = 'pixel-art-dialog'; dialog.className = 'pixel-art-dialog';
  dialog.innerHTML = `
    <form method="dialog" class="pixel-art-form">
      <header class="pixel-art-heading"><div><span class="eyebrow">TINY BLOCKS</span><h2>像素画</h2><p>一格一格涂颜色，拼出自己的小图案。</p></div><button value="cancel" class="pixel-art-close" aria-label="关闭像素画">×</button></header>
      <div class="pixel-art-workspace">
        <div class="pixel-art-stage"><canvas id="pixel-art-canvas" width="640" height="640" tabindex="0" aria-label="像素画网格"></canvas><span id="pixel-art-cell" class="pixel-art-cell">16 × 16</span></div>
        <aside class="pixel-art-controls" aria-label="像素画工具">
          <label class="pixel-art-field">格子大小<select id="pixel-art-size">${PIXEL_GRID_SIZES.map(size => `<option value="${size}"${size === 16 ? ' selected' : ''}>${size} × ${size}</option>`).join('')}</select></label>
          <div class="pixel-art-tool-row" role="group" aria-label="像素工具"><button type="button" data-pixel-tool="pen" aria-pressed="true">涂颜色</button><button type="button" data-pixel-tool="eraser" aria-pressed="false">橡皮</button><button type="button" data-pixel-tool="fill" aria-pressed="false">整片填色</button></div>
          <div class="pixel-art-palette" id="pixel-art-palette" aria-label="像素颜色"></div>
          <label class="pixel-art-custom-color">自选颜色 <input id="pixel-art-color" type="color" value="#285b49" aria-label="像素画颜色"></label>
          <p class="pixel-art-tip">按住拖动可以连续涂格子。透明格会保留画板内容。</p>
          <div class="pixel-art-actions"><button type="button" id="pixel-art-clear">清空</button><button type="button" id="pixel-art-place" class="primary">放回画板</button></div>
        </aside>
      </div>
    </form>`;
  document.body.append(dialog);

  const $ = id => dialog.querySelector(id.startsWith('#') ? id : `#${id}`);
  const canvas = $('pixel-art-canvas'), sizeSelect = $('pixel-art-size'), colorInput = $('pixel-art-color');
  let model = new PixelArtModel({ width: 16 }), tool = 'pen', color = getColor?.() || '#285b49', drawing = false, lastCell = null;

  function render() { model.render(canvas, { showGrid: true }); $('pixel-art-cell').textContent = `${model.width} × ${model.height}`; }
  function selectedColor() { return tool === 'eraser' ? null : color; }
  function cell(event) { return cellAtPoint(event.clientX, event.clientY, canvas.getBoundingClientRect(), model.width, model.height); }
  function paint(event) {
    const current = cell(event); if (!current) return;
    if (tool === 'fill') { if (event.type === 'pointerdown') model.fill(current.x, current.y, selectedColor()); }
    else if (lastCell) model.stroke(lastCell, current, selectedColor());
    else model.setCell(current.x, current.y, selectedColor());
    lastCell = current; render();
  }
  function stopDrawing() { drawing = false; lastCell = null; }
  function open() { render(); dialog.showModal(); }
  function place() {
    if (model.isEmpty()) { toast?.('先涂一格颜色，再放回画板。'); return; }
    const outputSize = Math.max(16, Math.min(512, Number(engine?.width) || 512, Number(engine?.height) || 512));
    engine.end(); engine.addLayer('像素画', model.toCanvas(outputSize), true); dialog.close(); toast?.('像素画已经放回画板，可以移动和放大它了。');
  }

  for (const value of PIXEL_COLORS) {
    const swatch = document.createElement('button'); swatch.type = 'button'; swatch.className = 'pixel-swatch'; swatch.dataset.color = value; swatch.style.background = value; swatch.setAttribute('aria-label', `像素颜色 ${value}`); swatch.onclick = () => { color = value; colorInput.value = value; for (const item of dialog.querySelectorAll('.pixel-swatch')) item.setAttribute('aria-pressed', item === swatch); }; $('pixel-art-palette').append(swatch);
  }
  colorInput.value = color; for (const item of dialog.querySelectorAll('.pixel-swatch')) item.setAttribute('aria-pressed', item.dataset.color === color); colorInput.oninput = () => { color = colorInput.value; tool = 'pen'; updateTools(); };
  for (const button of dialog.querySelectorAll('[data-pixel-tool]')) button.onclick = () => { tool = button.dataset.pixelTool; updateTools(); };
  function updateTools() { for (const button of dialog.querySelectorAll('[data-pixel-tool]')) button.setAttribute('aria-pressed', String(button.dataset.pixelTool === tool)); }
  sizeSelect.onchange = () => { model.resize(Number(sizeSelect.value)); render(); toast?.('网格已经调整，原来的图案也保留下来了。'); };
  $('pixel-art-clear').onclick = () => { model.clear(); render(); };
  $('pixel-art-place').onclick = () => run ? run(place) : place();
  canvas.addEventListener('pointerdown', event => { if (event.button !== 0) return; event.preventDefault(); drawing = true; lastCell = null; canvas.setPointerCapture?.(event.pointerId); paint(event); });
  canvas.addEventListener('pointermove', event => { if (drawing) paint(event); });
  canvas.addEventListener('pointerup', stopDrawing); canvas.addEventListener('pointercancel', stopDrawing); canvas.addEventListener('lostpointercapture', stopDrawing);
  dialog.addEventListener('close', stopDrawing); dialog.addEventListener('cancel', stopDrawing);
  updateTools(); render();

  const entry = pixelButton('像素画', 'pixel'); entry.id = 'pixel-art-open'; entry.classList.add('header-command'); entry.onclick = open;
  document.querySelector('.header-actions')?.insertBefore(entry, document.querySelector('#animation-open') || document.querySelector('#more-open'));
  return { open, dialog, get model() { return model; }, destroy: () => dialog.remove() };
}
