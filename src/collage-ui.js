import { getCollagePaper, COLLAGE_PAPERS, COLLAGE_PATTERNS, COLLAGE_PRESETS, COLLAGE_TEMPLATES, CollageEditorModel, collagePathIsClosed } from './collage-editor.js';
import { makeCanvas } from './engine.js';
import { playfulIcon } from './playful-icons.js';
import { CollageRenderer, COLLAGE_RENDERER_MAX_OUTPUT_SIZE } from './collage-renderer.js';

function collageUiPointer(canvas, event, model) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return { x: (event.clientX - rect.left) * model.width / rect.width, y: (event.clientY - rect.top) * model.height / rect.height };
}

function collageUiButton(label, icon, className = '') {
  const element = document.createElement('button');
  element.type = 'button'; element.className = `collage-transform-tool ${className}`.trim();
  element.innerHTML = `${playfulIcon(icon)}<span>${label}</span>`;
  return element;
}

function collageUiPatternId(paperId, pattern) {
  const paper = getCollagePaper(paperId);
  return COLLAGE_PATTERNS.some(item => item.id === pattern) ? pattern : paper.pattern;
}

/** A small, resource-free child friendly paper cutting desk. */
export function mountCollageEditor({ engine, run, toast, setTool } = {}) {
  const dialog = document.createElement('dialog');
  dialog.id = 'collage-dialog'; dialog.className = 'collage-dialog';
  dialog.innerHTML = `
    <form method="dialog" class="collage-form">
      <header class="collage-heading"><div><span class="eyebrow">PAPER PLAY</span><h2>彩色剪贴</h2><p>先选一个小场景，或者自己剪几块彩纸，最后一起放回画板。</p><ol class="collage-steps"><li><b>1</b> 选一个场景</li><li><b>2</b> 点形状放彩纸</li><li><b>3</b> 放回画板</li></ol></div><button value="cancel" class="collage-close" aria-label="关闭彩色剪贴">×</button></header>
      <div class="collage-workspace">
        <div class="collage-stage"><canvas id="collage-canvas" class="collage-canvas" width="512" height="512" tabindex="0" aria-label="彩色剪贴工作台"></canvas><span class="collage-stage-label" id="collage-stage-label">先选一个场景</span><span class="collage-stage-count" id="collage-piece-count">正在准备小花园…</span></div>
        <aside class="collage-controls" aria-label="彩色剪贴工具"><div class="collage-control-heading"><strong>先选一个玩法</strong><span id="collage-tool-hint">已经准备好一套小花园，点左边的彩纸可以移动它。</span></div>
          <section class="collage-section collage-preset-section"><strong>一键开始</strong><span class="collage-section-note">点一下，彩纸会自动摆成一个小场景</span><div class="collage-preset-list" id="collage-preset-list"></div><button type="button" id="collage-blank" class="collage-blank">从空白开始</button></section>
          <section class="collage-section collage-cut-section"><strong>自己加一块</strong><span class="collage-section-note">选一个形状，再点左边空白处</span><div class="collage-cut-tools" id="collage-cut-tools"></div><div class="collage-cut-tools-more" id="collage-cut-tools-more" hidden></div><button type="button" id="collage-more-shapes" class="collage-more-shapes" aria-expanded="false">更多形状</button></section>
          <section class="collage-section collage-paper-section"><strong>彩纸颜色</strong><div class="collage-paper-list" id="collage-paper-list"></div></section>
          <details class="collage-advanced"><summary>更多调整</summary><div class="collage-advanced-body"><section class="collage-section"><strong>彩纸纹理</strong><div class="collage-pattern-list" id="collage-pattern-list"></div></section><section class="collage-section"><strong>选中的彩纸</strong><div class="collage-transform-tools" id="collage-transform-tools"></div></section><p class="collage-advanced-tip">也可以按住左边的彩纸拖动，转一转或变大变小。</p></div></details>
          <div class="collage-piece-list" id="collage-piece-list" aria-label="已经剪下的彩纸"></div>
          <p class="collage-tip">想自己剪形状时，选“自由剪”，在左边按住画一圈，松手就会变成彩纸。</p>
          <div class="collage-actions"><button type="button" id="collage-clear">重新开始</button><button type="button" id="collage-place" class="primary">放回画板</button></div>
        </aside>
      </div>
    </form>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector.startsWith('#') ? selector : `#${selector}`);
  const canvas = $('collage-canvas'), presetList = $('collage-preset-list'), paperList = $('collage-paper-list'), patternList = $('collage-pattern-list'), cutTools = $('collage-cut-tools'), moreCutTools = $('collage-cut-tools-more'), pieceList = $('collage-piece-list');
  const model = new CollageEditorModel({ width: 512, height: 512 });
  const renderer = new CollageRenderer({ width: model.width, height: model.height, createCanvas: (width, height) => makeCanvas(width, height, false) });
  let selectedTool = 'circle', drawing = false, dragging = false, pointerId, previousPoint, freePoints = [], pieceUiSignature = '', hasOpened = false, moreShapesOpen = false, activePresetId = 'garden';

  function render() {
    const context = canvas.getContext('2d'); context.clearRect(0, 0, canvas.width, canvas.height); context.fillStyle = 'rgba(255,255,255,.36)'; context.fillRect(0, 0, canvas.width, canvas.height);
    renderer.render(canvas, model.pieces, { selectedId: model.selectedId, dragging, freePoints: drawing ? freePoints : null, showSelection: true, clear: false });
    const pieceCount = model.pieces.length;
    $('collage-stage-label').textContent = selectedTool === 'free' ? '按住画一圈' : pieceCount ? '拖动彩纸，摆成你喜欢的样子' : '先选一个形状';
    $('collage-piece-count').textContent = pieceCount ? `已经有 ${pieceCount} 块彩纸 · 还可以继续添加` : '先选场景，或选形状后点左边空白处';
    const nextPieceUiSignature = `${model.selectedId || ''}|${model.pieces.map(piece => piece.id).join(',')}`;
    if (nextPieceUiSignature !== pieceUiSignature) {
      pieceUiSignature = nextPieceUiSignature;
      pieceList.replaceChildren();
      model.pieces.forEach((piece, index) => {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'collage-piece'; button.setAttribute('aria-pressed', String(piece.id === model.selectedId)); button.setAttribute('aria-label', `第 ${index + 1} 块${piece.label}`); button.innerHTML = `<span style="background:${getCollagePaper(piece.paperId).fill}">${piece.icon}</span><small>${index + 1} · ${piece.label}</small>`; button.onclick = () => { model.select(piece.id); render(); }; pieceList.append(button);
      });
    }
    for (const button of dialog.querySelectorAll('.collage-cut-tool')) button.setAttribute('aria-pressed', String(button.dataset.template === selectedTool));
    const selected = model.selected(); $('collage-tool-hint').textContent = selected ? '拖动画布里的彩纸换位置，下面可以旋转或缩放' : selectedTool === 'free' ? '按住画出一个闭合轮廓，松手剪下来' : '点击空白处剪一块彩纸';
    for (const button of paperList.querySelectorAll('.collage-paper')) button.setAttribute('aria-pressed', String(button.dataset.paper === model.paperId));
    for (const button of patternList.querySelectorAll('.collage-pattern')) button.setAttribute('aria-pressed', String(button.dataset.pattern === model.pattern));
    for (const button of presetList.querySelectorAll('.collage-preset')) button.setAttribute('aria-pressed', String(button.dataset.preset === activePresetId));
    $('collage-place').disabled = !pieceCount;
    $('collage-place').setAttribute('aria-disabled', String(!pieceCount));
    $('collage-more-shapes').textContent = moreShapesOpen ? '收起形状' : '更多形状';
    $('collage-more-shapes').setAttribute('aria-expanded', String(moreShapesOpen));
    moreCutTools.hidden = !moreShapesOpen;
  }

  for (const preset of COLLAGE_PRESETS) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'collage-preset'; button.dataset.preset = preset.id; button.innerHTML = `<span aria-hidden="true">${preset.icon}</span><strong>${preset.label}</strong><small>${preset.description}</small>`;
    button.onclick = () => { model.applyPreset(preset.id); activePresetId = preset.id; selectedTool = 'circle'; render(); toast?.(`已经搭好${preset.label}，可以拖动每一块彩纸。`); };
    presetList.append(button);
  }
  $('collage-blank').onclick = () => { model.clear(); activePresetId = ''; selectedTool = 'circle'; render(); toast?.('空白剪贴桌准备好了，选一个形状再点左边。'); };

  for (const paper of COLLAGE_PAPERS) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'collage-paper'; button.dataset.paper = paper.id; button.title = paper.label; button.setAttribute('aria-label', paper.label); button.style.background = paper.fill; button.onclick = () => { const pattern = collageUiPatternId(paper.id, model.pattern); model.setSelectedPaper(paper.id, pattern); activePresetId = ''; render(); }; paperList.append(button);
  }
  for (const pattern of COLLAGE_PATTERNS) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'collage-pattern'; button.dataset.pattern = pattern.id; button.textContent = pattern.label; button.title = pattern.description; button.onclick = () => { model.setSelectedPattern(pattern.id); activePresetId = ''; render(); }; patternList.append(button);
  }
  const visibleTemplateIds = new Set(['circle', 'heart', 'star', 'cloud', 'house', 'fish']);
  const visibleTemplates = COLLAGE_TEMPLATES.filter(template => visibleTemplateIds.has(template.id));
  const hiddenTemplates = COLLAGE_TEMPLATES.filter(template => !visibleTemplateIds.has(template.id));
  const appendTemplate = (template, target) => {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'collage-cut-tool'; button.dataset.template = template.id; button.innerHTML = `<span aria-hidden="true">${template.icon}</span><small>${template.label}</small>`; button.onclick = () => { selectedTool = template.id; render(); };
    target.append(button);
  };
  for (const template of visibleTemplates) appendTemplate(template, cutTools);
  for (const template of hiddenTemplates) appendTemplate(template, moreCutTools);
  const freeButton = document.createElement('button'); freeButton.type = 'button'; freeButton.className = 'collage-cut-tool'; freeButton.dataset.template = 'free'; freeButton.innerHTML = '<span aria-hidden="true">✂</span><small>自由剪</small>'; freeButton.onclick = () => { selectedTool = 'free'; render(); }; cutTools.append(freeButton);
  $('collage-more-shapes').onclick = () => { moreShapesOpen = !moreShapesOpen; render(); };
  const transforms = $('collage-transform-tools');
  for (const [label, icon, action] of [['左转', 'rotate', () => model.rotate(-15)], ['右转', 'rotate', () => model.rotate(15)], ['变小', 'shrink', () => model.scale(.84)], ['变大', 'grow', () => model.scale(1.2)], ['删除', 'eraser', () => model.remove()], ['撤销', 'undo', () => model.undo()], ['重做', 'redo', () => model.redo()]]) {
    const button = collageUiButton(label, icon); button.onclick = () => { action(); render(); }; transforms.append(button);
  }

  function createTemplateAt(point) {
    const size = 150;
    model.cutTemplate(selectedTool, { x: point.x, y: point.y, width: size, height: size });
    activePresetId = '';
    model.beginTransform();
    dragging = true; previousPoint = point;
  }
  function finishDrag() {
    if (!dragging) return;
    dragging = false;
    model.endTransform();
    previousPoint = undefined;
  }
  function finishFree() {
    drawing = false;
    if (freePoints.length >= 5 && collagePathIsClosed(freePoints)) {
      const xs = freePoints.map(point => point.x), ys = freePoints.map(point => point.y); const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
      try { model.cutFree(freePoints, { x: (left + right) / 2, y: (top + bottom) / 2, width: Math.max(56, right - left), height: Math.max(56, bottom - top) }); activePresetId = ''; } catch (error) { toast?.(error.message); }
    } else if (freePoints.length > 1) toast?.('自由剪要把线条围成一个圈。');
    freePoints = []; render();
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return; event.preventDefault(); const point = collageUiPointer(canvas, event, model); if (!point) return; canvas.setPointerCapture?.(event.pointerId); pointerId = event.pointerId;
    if (selectedTool === 'free') { drawing = true; freePoints = [point]; render(); return; }
    const hit = model.hitTest(point.x, point.y);
    if (hit) { model.beginTransform(hit.id); dragging = true; previousPoint = point; render(); return; }
    createTemplateAt(point); render();
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== pointerId) return; const point = collageUiPointer(canvas, event, model); if (!point) return;
    if (drawing) { if (!freePoints.length || Math.hypot(point.x - freePoints.at(-1).x, point.y - freePoints.at(-1).y) > 2) freePoints.push(point); render(); return; }
    if (dragging && previousPoint) { const piece = model.selected(); if (piece) { const dx = point.x - previousPoint.x, dy = point.y - previousPoint.y; model.updateTransform({ x: piece.x + dx, y: piece.y + dy }); previousPoint = point; render(); } }
  });
  const finishPointer = event => { if (event.pointerId !== pointerId) return; if (event.type === 'pointercancel') { drawing = false; if (dragging) model.cancelTransform(); dragging = false; freePoints = []; previousPoint = undefined; render(); } else if (drawing) finishFree(); else finishDrag(); pointerId = undefined; };
  canvas.addEventListener('pointerup', finishPointer); canvas.addEventListener('pointercancel', finishPointer); canvas.addEventListener('lostpointercapture', finishPointer);

  $('collage-clear').onclick = () => { model.clear(); activePresetId = ''; selectedTool = 'circle'; render(); toast?.('已经重新开始，选一个场景或形状吧。'); };
  function place() {
    if (!model.pieces.length) { toast?.('先选一个场景，或选形状后点左边，再放回画板。'); return; }
    engine.end(); const added = [];
    try {
      const outputScale = Math.min(1, COLLAGE_RENDERER_MAX_OUTPUT_SIZE / Math.max(engine.width, engine.height));
      const outputWidth = Math.max(1, Math.round(engine.width * outputScale)), outputHeight = Math.max(1, Math.round(engine.height * outputScale));
      const flattened = renderer.toCanvas(model.pieces, { width: outputWidth, height: outputHeight });
      const layer = engine.addLayer('彩色剪贴', flattened, true, { x: engine.width / 2, y: engine.height / 2, scale: 1 / outputScale });
      added.push(layer);
      // The exported canvas owns its pixels. Release the large full-board
      // preview composite while keeping small piece rasters for a quick reopen.
      renderer.clearCompositeCache();
      dialog.close(); setTool?.('move'); toast?.(`已经放回画板，${model.pieces.length} 块彩纸合成了一张剪贴画，可以拖动它。`);
    } catch (error) { for (let index = added.length - 1; index >= 0; index--) engine.undo(); throw error; }
  }
  $('collage-place').onclick = () => run ? run(place) : place();
  dialog.addEventListener('close', () => { drawing = false; if (dragging) model.cancelTransform(); dragging = false; freePoints = []; previousPoint = undefined; pointerId = undefined; });
  function open() { if (!hasOpened) { model.applyPreset('garden'); activePresetId = 'garden'; hasOpened = true; } render(); dialog.showModal(); }
  const entry = document.createElement('button'); entry.type = 'button'; entry.id = 'collage-open'; entry.className = 'header-command'; entry.innerHTML = `${playfulIcon('cut')}<span>彩色剪贴</span>`; entry.onclick = open;
  document.querySelector('.header-actions')?.insertBefore(entry, document.querySelector('#pixel-art-open') || document.querySelector('#animation-open') || document.querySelector('#more-open'));
  render();
  return { open, dialog, model, destroy: () => { renderer.destroy(); dialog.remove(); } };
}
