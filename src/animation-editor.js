import { DrawingEngine } from './drawing.js';
import { makeCanvas } from './engine.js';
import { playfulIcon } from './playful-icons.js';
import { BRUSHES, DEFAULT_BRUSH_SIZE } from './brushes.js';

export const MAX_ANIMATION_FRAMES = 12;
export const DEFAULT_ANIMATION_SIZE = { width: 512, height: 512 };
export const FPS_OPTIONS = [6, 8, 12];

function assertAnimationSize(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 768 || height > 768) {
    throw new Error('小动画画布需要在 1 到 768 像素之间。');
  }
}

function assertFrame(frame, width, height) {
  if (!frame || !Number.isInteger(frame.width) || !Number.isInteger(frame.height) || frame.width !== width || frame.height !== height) {
    throw new Error(`动画帧必须是 ${width} × ${height} 像素。`);
  }
  return frame;
}

export function frameDurationForFps(fps) {
  const value = Number(fps);
  const selected = FPS_OPTIONS.reduce((best, option) =>
    Math.abs(option - value) < Math.abs(best - value) ? option : best, FPS_OPTIONS[1]);
  return 1000 / selected;
}

export function copyCanvas(source) {
  if (!source || !Number.isInteger(source.width) || !Number.isInteger(source.height)) throw new Error('动画帧无效。');
  const target = makeCanvas(source.width, source.height);
  target.getContext('2d').drawImage(source, 0, 0);
  return target;
}

export function createBlankFrame(width = DEFAULT_ANIMATION_SIZE.width, height = DEFAULT_ANIMATION_SIZE.height) {
  assertAnimationSize(width, height);
  return makeCanvas(width, height);
}

/**
 * Small, DOM-free timeline model. It owns frame order and playback settings;
 * the editor UI supplies canvas cloning/blank-frame functions where needed.
 */
export class AnimationTimeline {
  constructor({ width = DEFAULT_ANIMATION_SIZE.width, height = DEFAULT_ANIMATION_SIZE.height, frames = [], fps = 8 } = {}) {
    assertAnimationSize(width, height);
    this.width = width;
    this.height = height;
    this.frames = [...frames];
    if (!this.frames.length) this.frames.push(createBlankFrame(width, height));
    if (this.frames.length > MAX_ANIMATION_FRAMES) throw new Error(`小动画最多 ${MAX_ANIMATION_FRAMES} 张。`);
    this.frames.forEach(frame => assertFrame(frame, width, height));
    this.currentIndex = 0;
    this.fps = this.#normalizeFps(fps);
  }

  #normalizeFps(fps) {
    const value = Number(fps);
    return FPS_OPTIONS.includes(value) ? value : 8;
  }

  get frameCount() { return this.frames.length; }
  get currentFrame() { return this.frames[this.currentIndex]; }
  get frameDuration() { return frameDurationForFps(this.fps); }

  setCurrent(index) {
    const value = Number(index);
    if (!Number.isInteger(value) || value < 0 || value >= this.frameCount) throw new Error('动画帧不存在。');
    this.currentIndex = value;
    return this.currentFrame;
  }

  select(index) { return this.setCurrent(index); }

  replaceCurrent(frame) {
    this.frames[this.currentIndex] = assertFrame(frame, this.width, this.height);
    return this.frames[this.currentIndex];
  }

  addBlankFrame(blankFrame) {
    if (this.frameCount >= MAX_ANIMATION_FRAMES) return false;
    const frame = typeof blankFrame === 'function' ? blankFrame(this.width, this.height) : blankFrame ?? createBlankFrame(this.width, this.height);
    this.frames.splice(this.currentIndex + 1, 0, assertFrame(frame, this.width, this.height));
    this.currentIndex += 1;
    return true;
  }

  copyPrevious(cloneFrame) {
    if (this.frameCount >= MAX_ANIMATION_FRAMES) return false;
    const source = this.currentFrame;
    if (!source) return false;
    const frame = typeof cloneFrame === 'function' ? cloneFrame(source) : copyCanvas(source);
    this.frames.splice(this.currentIndex + 1, 0, assertFrame(frame, this.width, this.height));
    this.currentIndex += 1;
    return true;
  }

  removeFrame() {
    if (this.frameCount <= 1) return false;
    const [removed] = this.frames.splice(this.currentIndex, 1);
    this.currentIndex = Math.min(this.currentIndex, this.frameCount - 1);
    return true;
  }

  clearFrame(blankFrame) { this.clearCurrent(blankFrame ?? (() => createBlankFrame(this.width, this.height))); return true; }

  clearCurrent(blankFrame) {
    const frame = typeof blankFrame === 'function' ? blankFrame(this.width, this.height) : blankFrame ?? createBlankFrame(this.width, this.height);
    return this.replaceCurrent(frame);
  }

  setFps(fps) {
    const value = Number(fps);
    if (!FPS_OPTIONS.includes(value)) throw new Error('帧率只能选择 6、8 或 12 帧／秒。');
    this.fps = value;
    return this.fps;
  }

  toLayerOptions() {
    this.frames.forEach(frame => assertFrame(frame, this.width, this.height));
    return { width: this.width, height: this.height, frames: [...this.frames], frameDuration: this.frameDuration };
  }

  serialize() {
    return { width: this.width, height: this.height, frameCount: this.frameCount, currentIndex: this.currentIndex, fps: this.fps, frameDuration: this.frameDuration };
  }
}

function button(label, icon = 'play', className = '') {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = `animation-action ${className}`.trim();
  element.innerHTML = `${playfulIcon(icon)}<span>${label}</span>`;
  return element;
}

function fitCanvas(source, target, alpha = 1) {
  const ctx = target.getContext('2d');
  ctx.save(); ctx.globalAlpha = alpha; ctx.clearRect(0, 0, target.width, target.height);
  const scale = Math.min(target.width / source.width, target.height / source.height);
  const width = source.width * scale, height = source.height * scale;
  ctx.drawImage(source, (target.width - width) / 2, (target.height - height) / 2, width, height); ctx.restore();
}

/** Mount the child-friendly editor and keep all painting inside its small canvas. */
export function mountAnimationEditor({ engine, run, toast, getColor, getSecondaryColor }) {
  const dialog = document.createElement('dialog');
  dialog.id = 'animation-editor-dialog';
  dialog.className = 'animation-dialog';
  dialog.innerHTML = `
    <form method="dialog" class="animation-editor-form">
      <div class="animation-heading"><div><span class="eyebrow">MAKE IT MOVE</span><h2>小动画</h2><p>画一张，复制一张，改一点，就会动起来。</p></div><button value="cancel" class="animation-close" aria-label="关闭小动画">×</button></div>
      <div class="animation-workspace">
        <div class="animation-stage"><canvas id="animation-onion-canvas" aria-hidden="true"></canvas><canvas id="animation-frame-canvas" width="${DEFAULT_ANIMATION_SIZE.width}" height="${DEFAULT_ANIMATION_SIZE.height}" tabindex="0" aria-label="小动画当前帧"></canvas><span class="animation-frame-badge" id="animation-frame-badge">第 1 张</span></div>
        <aside class="animation-controls" aria-label="小动画绘画工具"><div class="animation-control-heading"><strong>这一张怎么画</strong><span id="animation-tool-hint">用熟悉的画笔画当前帧</span></div><div class="animation-tool-row" role="group" aria-label="动画画笔工具"><button type="button" data-animation-tool="pen" class="is-active">画笔</button><button type="button" data-animation-tool="eraser">橡皮</button><button type="button" data-animation-tool="fill">填色</button><button type="button" data-animation-tool="line">直线</button><button type="button" data-animation-tool="rect">方框</button><button type="button" data-animation-tool="ellipse">圆圈</button></div><label class="animation-select-label">画笔<select id="animation-brush"></select></label><div class="animation-sliders"><label>颜色<input id="animation-color" type="color" value="#285b49"></label><label>粗细<input id="animation-size" type="range" min="2" max="120" value="16"><output id="animation-size-value">16</output></label></div><label class="animation-speed">播放速度<select id="animation-fps"><option value="6">慢 · 6 帧/秒</option><option value="8" selected>刚好 · 8 帧/秒</option><option value="12">快 · 12 帧/秒</option></select></label><label class="animation-onion-toggle"><input id="animation-onion" type="checkbox"><span>显示上一张的淡淡轮廓</span></label></aside>
      </div>
      <div class="animation-framebar"><div class="animation-framebar-heading"><strong>动画帧 <span id="animation-frame-count">1 / 12</span></strong><span>每张都是一小步</span></div><div id="animation-frame-strip" class="animation-frame-strip" aria-label="动画帧列表"></div></div>
      <div class="animation-actions"><div class="animation-actions-group"><button type="button" id="animation-prev">上一张</button><button type="button" id="animation-next">下一张</button><button type="button" id="animation-copy">复制这一张</button><button type="button" id="animation-blank">新空白帧</button><button type="button" id="animation-clear">清空这一张</button><button type="button" id="animation-delete">删除这一张</button></div><div class="animation-actions-group"><button type="button" id="animation-play" class="primary">${playfulIcon('play')}<span>播放</span></button><button type="button" id="animation-place" class="primary">${playfulIcon('new-paper')}<span>放回画板</span></button></div></div>
    </form>`;
  document.body.append(dialog);

  const $ = id => dialog.querySelector(/^[.#[]/.test(id) ? id : `#${id}`);
  const frameCanvas = $('animation-frame-canvas'), onionCanvas = $('animation-onion-canvas');
  const timeline = new AnimationTimeline({ width: DEFAULT_ANIMATION_SIZE.width, height: DEFAULT_ANIMATION_SIZE.height, frames: [createBlankFrame()] });
  let drawing = false, pointerId, tool = 'pen', playing = false, playTimer, syncing = false;
  let editor;
  editor = new DrawingEngine(frameCanvas, () => { if (!editor?.active?.canvas?.width || !editor.active.canvas.height) return; if (!syncing && !playing) snapshotCurrent(); renderFrameStrip(); drawOnion(); });
  editor.reset(timeline.width, timeline.height); editor.playing = false; clearInterval(editor.animationTimer); editor.paperMode = false;
  const brushSelect = $('animation-brush');
  for (const brush of BRUSHES) { const option = document.createElement('option'); option.value = brush.id; option.textContent = brush.name; brushSelect.append(option); }

  function snapshotCurrent() { if (timeline.currentFrame) timeline.replaceCurrent(copyCanvas(editor.active.canvas)); }
  function loadCurrent() {
    syncing = true; editor.reset(timeline.width, timeline.height); editor.playing = false;
    const frame = timeline.currentFrame;
    if (frame) editor.active.canvas.getContext('2d').drawImage(frame, 0, 0);
    syncing = false; editor.render(); updateUi();
  }
  function drawOnion() {
    onionCanvas.width = timeline.width; onionCanvas.height = timeline.height;
    onionCanvas.getContext('2d').clearRect(0, 0, onionCanvas.width, onionCanvas.height);
    if (!$('animation-onion').checked || timeline.currentIndex === 0) return;
    fitCanvas(timeline.frames[timeline.currentIndex - 1], onionCanvas, .22);
  }
  function renderFrameStrip() {
    const strip = $('animation-frame-strip'); strip.replaceChildren();
    timeline.frames.forEach((frame, index) => {
      const item = document.createElement('button'); item.type = 'button'; item.className = 'animation-frame-thumb'; item.setAttribute('aria-label', `第 ${index + 1} 张`); item.setAttribute('aria-pressed', String(index === timeline.currentIndex));
      const thumb = makeCanvas(96, 72, false); thumb.className = 'animation-thumb-canvas';
      if (frame) fitCanvas(frame, thumb);
      item.append(thumb, Object.assign(document.createElement('span'), { textContent: `第 ${index + 1} 张` })); item.onclick = () => selectFrame(index); strip.append(item);
    });
  }
  function updateUi() {
    $('animation-frame-count').textContent = `${timeline.frameCount} / ${MAX_ANIMATION_FRAMES}`;
    $('animation-frame-badge').textContent = `第 ${timeline.currentIndex + 1} 张`;
    $('animation-prev').disabled = timeline.currentIndex === 0; $('animation-next').disabled = timeline.currentIndex === timeline.frameCount - 1;
    $('animation-delete').disabled = timeline.frameCount <= 1; $('animation-copy').disabled = timeline.frameCount >= MAX_ANIMATION_FRAMES || !timeline.currentFrame;
    $('animation-blank').disabled = timeline.frameCount >= MAX_ANIMATION_FRAMES;
    $('animation-play').querySelector('span').textContent = playing ? '暂停' : '播放'; $('animation-play').setAttribute('aria-pressed', String(playing));
    for (const button of dialog.querySelectorAll('[data-animation-tool]')) button.setAttribute('aria-pressed', String(button.dataset.animationTool === tool));
    renderFrameStrip(); drawOnion();
  }
  function selectFrame(index) { stopPlayback(); snapshotCurrent(); timeline.setCurrent(index); loadCurrent(); }
  function blankFrame() { return createBlankFrame(timeline.width, timeline.height); }
  function stopPlayback() { if (playTimer) clearInterval(playTimer); playTimer = undefined; playing = false; updateUi(); }
  function startPlayback() {
    snapshotCurrent(); playing = true; let index = 0; timeline.setCurrent(index); loadCurrent();
    playTimer = setInterval(() => { index = (index + 1) % timeline.frameCount; timeline.setCurrent(index); loadCurrent(); }, timeline.frameDuration); updateUi();
  }
  function open() { stopPlayback(); timeline.currentIndex = 0; loadCurrent(); dialog.showModal(); }
  function place() {
    stopPlayback(); snapshotCurrent(); const options = timeline.toLayerOptions();
    const first = options.frames[0]; engine.addLayer('我的小动画', first, true, options); dialog.close(); toast('小动画已经放回画板，可以移动和放大它了。');
  }
  function drawPoint(event) {
    const rect = frameCanvas.getBoundingClientRect(); return editor.point(event, rect);
  }
  frameCanvas.addEventListener('pointerdown', event => { if (playing || event.button !== 0) return; event.preventDefault(); try { editor.begin(drawPoint(event), { tool, color: $('animation-color').value, secondaryColor: getSecondaryColor?.() || '#ffffff', size: Number($('animation-size').value), opacity: 1, brushVersion: 2, brush: brushSelect.value, ratio: 1, fillMode: 'region', tolerance: 20 }); if (editor.gesture) { drawing = true; pointerId = event.pointerId; frameCanvas.setPointerCapture(pointerId); } } catch (error) { toast(error.message); } });
  frameCanvas.addEventListener('pointermove', event => { if (!drawing || event.pointerId !== pointerId) return; editor.update(drawPoint(event)); });
  const finish = event => { if (!drawing || event.pointerId !== pointerId) return; drawing = false; editor.end(event.type === 'pointercancel'); pointerId = undefined; snapshotCurrent(); updateUi(); };
  frameCanvas.addEventListener('pointerup', finish); frameCanvas.addEventListener('pointercancel', finish); frameCanvas.addEventListener('lostpointercapture', finish);
  $('animation-onion').addEventListener('change', drawOnion); $('animation-size').addEventListener('input', () => $('animation-size-value').textContent = $('animation-size').value);
  $('animation-fps').addEventListener('change', () => { timeline.setFps($('animation-fps').value); if (playing) { stopPlayback(); startPlayback(); } });
  for (const button of dialog.querySelectorAll('[data-animation-tool]')) button.onclick = () => { tool = button.dataset.animationTool; $('animation-tool-hint').textContent = tool === 'pen' ? '用熟悉的画笔画当前帧' : tool === 'eraser' ? '擦掉这一张里的笔迹' : tool === 'fill' ? '点一下给这一张填色' : '拖动做出简单形状'; updateUi(); };
  $('animation-prev').onclick = () => selectFrame(Math.max(0, timeline.currentIndex - 1)); $('animation-next').onclick = () => selectFrame(Math.min(timeline.frameCount - 1, timeline.currentIndex + 1));
  $('animation-copy').onclick = () => { stopPlayback(); snapshotCurrent(); timeline.copyPrevious(copyCanvas); loadCurrent(); };
  $('animation-blank').onclick = () => { stopPlayback(); snapshotCurrent(); timeline.addBlankFrame(blankFrame); loadCurrent(); };
  $('animation-clear').onclick = () => { stopPlayback(); timeline.clearCurrent(blankFrame); loadCurrent(); };
  $('animation-delete').onclick = () => { stopPlayback(); snapshotCurrent(); timeline.removeFrame(); loadCurrent(); };
  $('animation-play').onclick = () => playing ? stopPlayback() : startPlayback(); $('animation-place').onclick = () => run(place);
  dialog.addEventListener('close', stopPlayback); dialog.addEventListener('cancel', stopPlayback);
  $('animation-color').value = getColor?.() || '#285b49'; $('animation-size').value = DEFAULT_BRUSH_SIZE; $('animation-size-value').textContent = DEFAULT_BRUSH_SIZE; updateUi();
  const entry = button('小动画', 'butterfly', 'animation-open'); entry.id = 'animation-open'; entry.onclick = open; document.querySelector('.header-actions')?.insertBefore(entry, document.querySelector('#more-open'));
  return { open, dialog, timeline, editor, destroy: () => { stopPlayback(); clearInterval(editor.animationTimer); dialog.remove(); } };
}
