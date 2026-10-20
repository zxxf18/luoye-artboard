import { makeCanvas } from './engine.js';

/**
 * 分形图案工坊：左侧选基础图案，参数栏调颜色、大小与分形次数，
 * 点击画纸把图案作为图层放到点击位置。全部为确定性矢量递归绘制，
 * 同参数逐像素可复现；旧的 IFS/Mandelbrot 像素分形已被此实现取代。
 */

export const FRACTAL_PRESETS = Object.freeze([
  { id: 'snowflake', name: '六角雪花', hint: '六边形棱上逐次开出雪花尖' },
  { id: 'flower', name: '窗花', hint: '方棱上开出的对称窗花' },
  { id: 'triangle', name: '三角毯', hint: '三角形一层层镂空' },
  { id: 'tree', name: '分形树', hint: '每根枝条再长出两根小枝' },
  { id: 'star', name: '星星花', hint: '五角星棱上开出花边' },
]);

/** 每加一次分形，线段数约乘 4；6 次已有 2 万多段，视觉上也已饱和。 */
export const FRACTAL_MAX_DEPTH = 6;
export const FRACTAL_DEFAULTS = Object.freeze({ preset: 'snowflake', color: '#285b49', size: 420, depth: 2 });
export const FRACTAL_SIZE_RANGE = Object.freeze({ min: 120, max: 720 });

export const fractalState = { ...FRACTAL_DEFAULTS };

export function normalizeFractalDepth(value) {
  const depth = Math.round(Number(value));
  if (!Number.isFinite(depth) || depth < 1 || depth > FRACTAL_MAX_DEPTH) {
    throw new Error(`分形次数需要在 1 到 ${FRACTAL_MAX_DEPTH} 之间。`);
  }
  return depth;
}

function polygonPoints(sides, radius, rotation = -Math.PI / 2) {
  const points = [];
  for (let index = 0; index < sides; index++) {
    const angle = rotation + index * Math.PI * 2 / sides;
    points.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
  }
  return points;
}

/** Koch 型棱线细分：每段折成四段，中段凸出成尖。 */
function kochEdges(points, depth) {
  let edges = points.map((point, index) => ({ a: point, b: points[(index + 1) % points.length] }));
  for (let step = 0; step < depth; step++) {
    const next = [];
    for (const { a, b } of edges) {
      const dx = (b.x - a.x) / 3, dy = (b.y - a.y) / 3;
      const p1 = { x: a.x + dx, y: a.y + dy };
      const p3 = { x: a.x + dx * 2, y: a.y + dy * 2 };
      // 中段向行进方向左侧凸出（等边三角形顶点）。
      const p2 = { x: a.x + dx * 1.5 + dy * Math.sqrt(3) / 2, y: a.y + dy * 1.5 - dx * Math.sqrt(3) / 2 };
      next.push({ a, b: p1 }, { a: p1, b: p2 }, { a: p2, b: p3 }, { a: p3, b });
    }
    edges = next;
  }
  return edges;
}

function drawEdgeFractal(ctx, sides, radius, depth, rotation = -Math.PI / 2) {
  const edges = kochEdges(polygonPoints(sides, radius, rotation), depth);
  ctx.beginPath();
  for (const { a, b } of edges) {
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.closePath();
  ctx.stroke();
}

function drawSierpinski(ctx, radius, depth) {
  const [top, left, right] = polygonPoints(3, radius);
  const triangles = [];
  const subdivide = (a, b, c, level) => {
    if (level >= depth) { triangles.push([a, b, c]); return; }
    const ab = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const bc = { x: (b.x + c.x) / 2, y: (b.y + c.y) / 2 };
    const ca = { x: (c.x + a.x) / 2, y: (c.y + a.y) / 2 };
    subdivide(a, ab, ca, level + 1);
    subdivide(ab, b, bc, level + 1);
    subdivide(ca, bc, c, level + 1);
  };
  subdivide(top, left, right, 0);
  ctx.beginPath();
  for (const [a, b, c] of triangles) {
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.closePath();
  }
  ctx.fill();
}

function drawTree(ctx, radius, depth) {
  const spread = Math.PI / 5.2, shrink = .68;
  const branch = (x, y, angle, length, level) => {
    const endX = x + Math.cos(angle) * length, endY = y + Math.sin(angle) * length;
    ctx.moveTo(x, y);
    ctx.lineTo(endX, endY);
    if (level >= depth) return;
    const sway = .12;
    branch(endX, endY, angle - spread + sway, length * shrink, level + 1);
    branch(endX, endY, angle + spread - sway, length * shrink, level + 1);
  };
  ctx.beginPath();
  branch(0, radius, -Math.PI / 2, radius * .52, 1);
  ctx.stroke();
}

/** 在 size×size 的画布中心绘制指定分形；返回该画布。 */
export function renderFractalCanvas({ preset = fractalState.preset, size = fractalState.size, color = fractalState.color, depth = fractalState.depth } = {}) {
  const normalized = normalizeFractalDepth(depth);
  const width = Math.max(64, Math.round(Number(size) || 420));
  const canvas = makeCanvas(width, width, false);
  const ctx = canvas.getContext('2d');
  const radius = width * .44;
  ctx.save();
  ctx.translate(width / 2, width / 2);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  // 线宽随分形次数收紧，细节层不会被粗线糊成一团。
  ctx.lineWidth = Math.max(.6, width / 160 / (1 + normalized * .35));
  if (preset === 'snowflake') drawEdgeFractal(ctx, 6, radius, normalized);
  else if (preset === 'flower') drawEdgeFractal(ctx, 4, radius, normalized, -Math.PI / 4);
  else if (preset === 'star') drawEdgeFractal(ctx, 5, radius, normalized, -Math.PI / 2);
  else if (preset === 'triangle') drawSierpinski(ctx, radius * 1.05, normalized);
  else if (preset === 'tree') drawTree(ctx, radius, normalized);
  else throw new Error('未知的分形图案。');
  ctx.restore();
  return canvas;
}

/** 点击画纸时把当前分形作为图层放到点击处（可继续移动、缩放）。 */
export function placeFractal(engine, point, overrides = {}) {
  const canvas = renderFractalCanvas(overrides);
  engine.end();
  const preset = FRACTAL_PRESETS.find(item => item.id === (overrides.preset ?? fractalState.preset));
  const layer = engine.addLayer(`分形 · ${preset?.name || '图案'}`, canvas, true, { x: point.x, y: point.y });
  return layer;
}
