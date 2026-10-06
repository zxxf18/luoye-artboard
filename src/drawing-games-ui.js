import { makeCanvas } from './engine.js';
import { playfulIcon } from './playful-icons.js';
import { GAME_WIDTH, GAME_HEIGHT, DOT_CARDS, DotDrawingModel, MAZE_CARDS, MazeDrawingModel, createMaze } from './drawing-games.js';

const GAME_COLORS = ['#285b49', '#d9715f', '#e0b24a', '#7694b9', '#b398b7', '#ffffff'];

function gamePoint(canvas, event) {
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return { x: (event.clientX - rect.left) * GAME_WIDTH / rect.width, y: (event.clientY - rect.top) * GAME_HEIGHT / rect.height };
}

function roundRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath(); context.moveTo(x + r, y); context.arcTo(x + width, y, x + width, y + height, r); context.arcTo(x + width, y + height, x, y + height, r); context.arcTo(x, y + height, x, y, r); context.arcTo(x, y, x + width, y, r); context.closePath();
}

function drawDotScene(context, model, { guide = true, color = '#285b49', width = 12, hint = false } = {}) {
  context.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  context.fillStyle = '#fffaf0'; context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  context.save(); context.strokeStyle = '#ead8b8'; context.lineWidth = 3; context.setLineDash([7, 11]); roundRect(context, 18, 18, GAME_WIDTH - 36, GAME_HEIGHT - 36, 24); context.stroke(); context.restore();
  const points = model.card.points;
  if (guide) {
    context.save(); context.lineWidth = 4; context.strokeStyle = '#d5be94'; context.setLineDash([5, 12]); context.beginPath(); points.forEach((point, index) => index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y)); context.stroke(); context.restore();
  }
  context.save(); context.lineCap = 'round'; context.lineJoin = 'round'; context.strokeStyle = color; context.lineWidth = width; context.beginPath();
  for (const segment of model.segments) { context.moveTo(segment.from.x, segment.from.y); context.lineTo(segment.to.x, segment.to.y); }
  context.stroke(); context.restore();
  if (guide) {
    context.textAlign = 'center'; context.textBaseline = 'middle'; context.font = '700 20px system-ui';
    points.forEach((point, index) => {
      const visited = index < model.nextIndex;
      const current = index === model.nextIndex;
      context.beginPath(); context.arc(point.x, point.y, hint && current ? 27 : current ? 22 : 17, 0, Math.PI * 2); context.fillStyle = visited ? '#aeca96' : current ? '#ffd88a' : '#fff1cc'; context.fill(); context.lineWidth = hint && current ? 7 : current ? 5 : 3; context.strokeStyle = current ? '#bd603f' : '#c79b69'; context.stroke();
      context.fillStyle = '#604638'; context.fillText(String(index + 1), point.x, point.y + 1);
    });
  }
}

function drawMazeScene(context, model, { guide = true, color = '#285b49', width = 12, hintCell = null } = {}) {
  const { maze } = model; const cellWidth = GAME_WIDTH / maze.columns, cellHeight = GAME_HEIGHT / maze.rows;
  context.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT); context.fillStyle = '#fffaf0'; context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  if (guide) {
    context.fillStyle = '#f4ead6'; context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    context.strokeStyle = '#b88c68'; context.lineWidth = Math.max(3, Math.min(cellWidth, cellHeight) * .07); context.lineCap = 'round';
    for (let y = 0; y < maze.rows; y++) for (let x = 0; x < maze.columns; x++) {
      const cell = maze.cells[y][x], left = x * cellWidth, top = y * cellHeight;
      context.beginPath(); if (cell.walls.top) { context.moveTo(left, top); context.lineTo(left + cellWidth, top); } if (cell.walls.right) { context.moveTo(left + cellWidth, top); context.lineTo(left + cellWidth, top + cellHeight); } if (cell.walls.bottom) { context.moveTo(left, top + cellHeight); context.lineTo(left + cellWidth, top + cellHeight); } if (cell.walls.left) { context.moveTo(left, top); context.lineTo(left, top + cellHeight); } context.stroke();
    }
    const marker = (cell, fill, label) => { const cx = (cell.x + .5) * cellWidth, cy = (cell.y + .5) * cellHeight; context.beginPath(); context.arc(cx, cy, Math.min(cellWidth, cellHeight) * .27, 0, Math.PI * 2); context.fillStyle = fill; context.fill(); context.fillStyle = '#604638'; context.font = '700 18px system-ui'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(label, cx, cy); };
    marker(maze.start, '#aeca96', '出'); marker(maze.goal, '#ffd88a', '到');
    if (hintCell) marker(hintCell, '#a7cee0', '?');
  }
  context.save(); context.strokeStyle = color; context.lineWidth = width; context.lineCap = 'round'; context.lineJoin = 'round'; context.beginPath();
  model.path.forEach((cell, index) => { const x = (cell.x + .5) * cellWidth, y = (cell.y + .5) * cellHeight; index ? context.lineTo(x, y) : context.moveTo(x, y); }); context.stroke(); context.restore();
  if (model.path.length) { const last = model.path.at(-1), x = (last.x + .5) * cellWidth, y = (last.y + .5) * cellHeight; context.beginPath(); context.arc(x, y, Math.min(cellWidth, cellHeight) * .18, 0, Math.PI * 2); context.fillStyle = color; context.fill(); }
}

function gameButton(label, icon, id, className = '') {
  const button = document.createElement('button'); button.type = 'button'; button.id = id; button.className = className; button.innerHTML = icon ? `${playfulIcon(icon)}<span>${label}</span>` : `<span>${label}</span>`; return button;
}

/** A compact, offline drawing game that commits only the child's finished trail as one raster layer. */
export function mountDrawingGames({ engine, run, toast } = {}) {
  const dialog = document.createElement('dialog'); dialog.id = 'drawing-games-dialog'; dialog.className = 'drawing-games-dialog';
  dialog.innerHTML = `<form method="dialog" class="games-form"><header class="games-heading"><div><span class="eyebrow">DRAWING PLAY</span><h2>点点·迷宫</h2><p>沿着点点连起来，或带小伙伴走出迷宫。</p></div><button value="cancel" class="games-close" aria-label="关闭点点迷宫">×</button></header><div class="games-toolbar"><div class="games-modes" role="group" aria-label="游戏类型"><button type="button" data-game-mode="dots" aria-pressed="true">点点画</button><button type="button" data-game-mode="maze" aria-pressed="false">迷宫涂画</button></div><label class="games-card-label">选择图卡<select id="game-card"></select></label><button type="button" id="game-hint">提示一下</button></div><div class="games-workspace"><div class="games-stage"><canvas id="game-canvas" width="800" height="560" tabindex="0" aria-label="点点迷宫画板"></canvas></div><div class="games-status" id="game-status" role="status" aria-live="polite"></div><aside class="games-tools" aria-label="点点迷宫工具"><div class="games-colors" id="game-colors" role="group" aria-label="画笔颜色"></div><label class="games-color-custom">自选颜色<input id="game-color" type="color" value="#285b49" aria-label="自选游戏画笔颜色"></label><label class="games-width">笔尖 <input id="game-width" type="range" min="6" max="28" value="12"><output id="game-width-value">12</output></label><div class="games-pen-tools" role="group" aria-label="绘画工具"><button type="button" data-game-tool="pen" aria-pressed="true">画线</button><button type="button" data-game-tool="eraser" aria-pressed="false">擦掉</button></div></aside></div><footer class="games-actions"><button type="button" id="game-undo">撤销一步</button><button type="button" id="game-reset">重新开始</button><button type="button" id="game-next">换一张</button><button type="button" id="game-place" class="primary">放回画板</button></footer></form>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  const canvas = $('#game-canvas'), stage = dialog.querySelector('.games-stage'), context = canvas.getContext('2d'); let mode = 'dots', cardIndex = 0, model, drawing = false, pointerId, lastPoint, eraseApplied = false, color = '#285b49', width = 12, tool = 'pen', hintCell = null, hintDot = false, hintTimer;
  function fitCanvas() {
    if (!stage) return;
    const style = getComputedStyle(stage);
    const horizontalPadding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    const verticalPadding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
    const availableWidth = Math.max(1, stage.clientWidth - horizontalPadding);
    const availableHeight = Math.max(1, stage.clientHeight - verticalPadding);
    const scale = Math.min(1, availableWidth / GAME_WIDTH, availableHeight / GAME_HEIGHT);
    canvas.style.width = `${Math.max(1, Math.round(GAME_WIDTH * scale))}px`;
    canvas.style.height = `${Math.max(1, Math.round(GAME_HEIGHT * scale))}px`;
  }
  const stageObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(fitCanvas) : null;
  stageObserver?.observe(stage);
  const cards = () => mode === 'dots' ? DOT_CARDS : MAZE_CARDS;
  function currentCard() { return cards()[cardIndex % cards().length]; }
  function createModel() { drawing = false; pointerId = undefined; lastPoint = null; eraseApplied = false; model = mode === 'dots' ? new DotDrawingModel(currentCard()) : new MazeDrawingModel(currentCard(), createMaze(currentCard())); hintCell = null; hintDot = false; }
  function render({ guide = true } = {}) { mode === 'dots' ? drawDotScene(context, model, { guide, color, width, hint: hintDot }) : drawMazeScene(context, model, { guide, color, width, hintCell }); updateStatus(); }
  function updateStatus() { const status = $('#game-status'); if (mode === 'dots') { status.textContent = model.complete ? '连好了！可以放回画板，或者换一张继续。' : `连接第 ${Math.min(model.nextIndex + 1, model.card.points.length)} 个点 · 已完成 ${model.nextIndex} / ${model.card.points.length}`; } else { status.textContent = model.complete ? '走出来了！可以放回画板，或者换一条路线。' : `从“出发”走到“到达” · 已走 ${Math.max(0, model.path.length - 1)} 格`; } $('#game-undo').disabled = mode === 'dots' ? model.nextIndex === 0 : model.path.length <= 1; $('#game-place').disabled = !model.complete; }
  function fillCards() { const select = $('#game-card'); select.replaceChildren(); cards().forEach((card, index) => { const option = document.createElement('option'); option.value = index; option.textContent = `${card.icon} ${card.title}`; select.append(option); }); select.value = String(cardIndex); }
  function setMode(next) { mode = next; cardIndex = 0; for (const button of dialog.querySelectorAll('[data-game-mode]')) button.setAttribute('aria-pressed', String(button.dataset.gameMode === mode)); createModel(); fillCards(); render(); }
  function reset() { clearTimeout(hintTimer); hintCell = null; hintDot = false; createModel(); render(); }
  function applyPoint(event) { const point = gamePoint(canvas, event); if (!point) return; if (mode === 'dots') { if (tool === 'eraser') { if (!eraseApplied && model.nextIndex > 0 && Math.hypot(point.x - model.card.points[model.nextIndex - 1].x, point.y - model.card.points[model.nextIndex - 1].y) < 30) { model.undo(); eraseApplied = true; } } else if (lastPoint) model.trace(lastPoint, point, 28); else model.visit(point, 28); lastPoint = point; } else { const cellWidth = GAME_WIDTH / model.maze.columns, cellHeight = GAME_HEIGHT / model.maze.rows; const cell = { x: Math.floor(point.x / cellWidth), y: Math.floor(point.y / cellHeight) }; if (tool === 'eraser') { if (!eraseApplied) { model.undo(); eraseApplied = true; } } else if (model.complete) return; else if (lastPoint) { const moved = model.trace(lastPoint, cell); if (moved) lastPoint = cell; } else if (model.move(cell)) lastPoint = cell; } render(); }
  canvas.addEventListener('pointerdown', event => { if (event.button !== 0) return; event.preventDefault(); drawing = true; pointerId = event.pointerId; lastPoint = null; eraseApplied = false; canvas.setPointerCapture?.(pointerId); applyPoint(event); });
  canvas.addEventListener('pointermove', event => { if (!drawing || event.pointerId !== pointerId) return; applyPoint(event); });
  const stop = event => { if (event.pointerId !== pointerId) return; drawing = false; pointerId = undefined; lastPoint = null; eraseApplied = false; };
  canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop); canvas.addEventListener('lostpointercapture', stop);
  for (const button of dialog.querySelectorAll('[data-game-mode]')) button.onclick = () => setMode(button.dataset.gameMode);
  $('#game-card').onchange = event => { cardIndex = Number(event.target.value) || 0; createModel(); render(); };
  $('#game-reset').onclick = reset; $('#game-next').onclick = () => { cardIndex = (cardIndex + 1) % cards().length; createModel(); fillCards(); render(); };
  $('#game-undo').onclick = () => { model.undo(); render(); };
  $('#game-hint').onclick = () => { clearTimeout(hintTimer); if (mode === 'dots') { hintDot = true; toast?.('黄色圈是下一个点，沿着它画过去'); hintTimer = setTimeout(() => { hintDot = false; render(); }, 2200); } else { const solution = model.solution; hintCell = model.path.length < solution.length ? solution[model.path.length] : model.maze.goal; toast?.('蓝色问号是下一步可以走的格子'); hintTimer = setTimeout(() => { hintCell = null; render(); }, 2200); } render(); };
  for (const value of GAME_COLORS) { const button = document.createElement('button'); button.type = 'button'; button.className = 'game-color-swatch'; button.dataset.gameColor = value; button.style.background = value; button.setAttribute('aria-label', `画笔颜色 ${value}`); button.onclick = () => { color = value; $('#game-color').value = value; sync(); }; $('#game-colors').append(button); }
  $('#game-color').oninput = event => { color = event.target.value; sync(); }; $('#game-width').oninput = event => { width = Number(event.target.value); $('#game-width-value').textContent = String(width); render(); };
  for (const button of dialog.querySelectorAll('[data-game-tool]')) button.onclick = () => { tool = button.dataset.gameTool; sync(); };
  function sync() { for (const button of dialog.querySelectorAll('[data-game-tool]')) button.setAttribute('aria-pressed', String(button.dataset.gameTool === tool)); for (const button of dialog.querySelectorAll('[data-game-color]')) button.setAttribute('aria-pressed', String(button.dataset.gameColor === color)); render(); }
  function place() { if (!model.complete) { toast?.('先完成这一张，再放回画板。'); return; } const output = makeCanvas(GAME_WIDTH, GAME_HEIGHT, true); const outputContext = output.getContext('2d'); mode === 'dots' ? drawDotScene(outputContext, model, { guide: false, color, width }) : drawMazeScene(outputContext, model, { guide: true, color, width, hintCell: null }); engine.end(); engine.addLayer(mode === 'dots' ? `点点画 · ${model.card.title}` : `迷宫涂画 · ${model.card.title}`, output, true, { x: engine.width / 2, y: engine.height / 2, scale: Math.min(engine.width / GAME_WIDTH, engine.height / GAME_HEIGHT) }); dialog.close(); toast?.('作品已经放回画板，可以继续涂色和装饰。'); }
  $('#game-place').onclick = () => run ? run(place) : place();
  function open() { createModel(); fillCards(); sync(); dialog.showModal(); fitCanvas(); }
  dialog.addEventListener('close', () => { drawing = false; pointerId = undefined; lastPoint = null; eraseApplied = false; clearTimeout(hintTimer); });
  const entry = gameButton('点点·迷宫', 'games', 'drawing-games-open', 'header-command'); entry.onclick = open; document.querySelector('.header-actions')?.insertBefore(entry, document.querySelector('#animation-open') || document.querySelector('#more-open'));
  createModel(); fillCards(); sync(); fitCanvas(); return { open, dialog, get model() { return model; }, destroy: () => { stageObserver?.disconnect(); dialog.remove(); } };
}
