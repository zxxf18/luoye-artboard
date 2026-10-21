import { makeCanvas } from './engine.js';

/**
 * 分形图案工坊：左侧选基础图案，参数栏调颜色、大小与分形次数，
 * 点击画纸把图案作为图层放到点击位置。图案不用细线条，全部由
 * 填色的图形块（圆珠、花瓣、胶囊胳膊、圆角方巾、星星）画成小图片，
 * 与画笔盒的画风一致；同参数逐像素可复现。
 */

export const FRACTAL_PRESETS = Object.freeze([
  { id: 'snowflake', name: '小雪花', hint: '六条圆胳膊层层开出小雪花', previewDepth: 3 },
  { id: 'mandala', name: '窗花', hint: '一圈圈花瓣转出来的窗花', previewDepth: 3 },
  { id: 'sunflower', name: '太阳花', hint: '按黄金角度排出的花盘', previewDepth: 4 },
  { id: 'star', name: '星星花', hint: '大星星尖上再开小星星', previewDepth: 2 },
  { id: 'tree', name: '分形树', hint: '每根枝条再长两根，梢头开花', previewDepth: 3 },
  { id: 'romanesco', name: '花菜塔', hint: '一颗颗小塔按三瓣转着长', previewDepth: 3 },
  { id: 'carpet', name: '花毯', hint: '方巾中间镂空，一层套一层', previewDepth: 3 },
  { id: 'bubbles', name: '泡泡', hint: '大泡泡里装着两个小泡泡', previewDepth: 3 },
]);

/** 每加一次分形，图形数约乘 3～8；6 次在视觉上已经饱和。 */
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

/** 把选中的颜色拆成主色／浅色／深色三层，图形才有插画层次。 */
function fractalShades(color) {
  const value = /^#[0-9a-f]{6}$/i.test(String(color)) ? String(color).toLowerCase() : '#285b49';
  const n = parseInt(value.slice(1), 16);
  const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > .5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  const at = (dl, ds) => {
    const ll = Math.min(.94, Math.max(.06, l + dl));
    const ss = Math.min(1, Math.max(0, s * ds));
    const q = ll < .5 ? ll * (1 + ss) : ll + ss - ll * ss, p = 2 * ll - q;
    const channel = t => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    return '#' + [channel((h + 1 / 3) % 1), channel(h), channel((h + 2 / 3) % 1)]
      .map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
  };
  return { main: value, light: at(.24, .9), dark: at(-.16, 1.15) };
}

function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }

/** 圆头粗线在视觉上就是一根填色的胶囊胳膊。 */
function capsule(ctx, x1, y1, x2, y2, w, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

function fillStar(ctx, x, y, r, rotation) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = rotation + i * Math.PI / 5;
    const rr = i % 2 ? r * .48 : r;
    const px = x + Math.cos(angle) * rr, py = y + Math.sin(angle) * rr;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath(); ctx.fill();
}

function fillPetal(ctx, angle, startR, len, width) {
  const bx = Math.cos(angle) * startR, by = Math.sin(angle) * startR;
  const tx = Math.cos(angle) * (startR + len), ty = Math.sin(angle) * (startR + len);
  const nx = -Math.sin(angle) * width, ny = Math.cos(angle) * width;
  ctx.beginPath();
  ctx.moveTo(bx + nx, by + ny);
  ctx.quadraticCurveTo((bx + tx) / 2 + nx * 1.4, (by + ty) / 2 + ny * 1.4, tx, ty);
  ctx.quadraticCurveTo((bx + tx) / 2 - nx * 1.4, (by + ty) / 2 - ny * 1.4, bx - nx, by - ny);
  ctx.closePath(); ctx.fill();
}

function drawSnowflake(ctx, radius, depth, shades) {
  const arm = (x, y, angle, len, w, level) => {
    const ex = x + Math.cos(angle) * len, ey = y + Math.sin(angle) * len;
    capsule(ctx, x, y, ex, ey, w, shades.main);
    if (level >= depth) { ctx.fillStyle = shades.light; circle(ctx, ex, ey, w * .38); return; }
    for (const side of [-1, 1]) arm(ex, ey, angle + side * Math.PI / 3, len * .44, w * .56, level + 1);
  };
  ctx.fillStyle = shades.dark; circle(ctx, 0, 0, radius * .3);
  ctx.fillStyle = shades.light; circle(ctx, 0, 0, radius * .15);
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 - Math.PI / 2;
    arm(Math.cos(a) * radius * .15, Math.sin(a) * radius * .15, a, radius * .82, radius * .17, 1);
  }
}

function drawMandala(ctx, radius, depth, shades) {
  const rings = Math.max(2, depth + 1);
  for (let ring = 0; ring < rings; ring++) {
    const t = ring / (rings - 1);
    ctx.fillStyle = ring % 2 ? shades.light : shades.main;
    for (let i = 0; i < 8; i++) {
      fillPetal(ctx, i * Math.PI / 4 + ring * Math.PI / 8, radius * (.14 + .34 * t), radius * (.52 - .24 * t), radius * (.15 - .06 * t));
    }
  }
  ctx.fillStyle = shades.dark; circle(ctx, 0, 0, radius * .13);
}

function drawSunflower(ctx, radius, depth, shades) {
  const count = 60 + depth * 60;
  const golden = Math.PI * (3 - Math.sqrt(5));
  ctx.fillStyle = shades.dark; circle(ctx, 0, 0, radius * .18);
  for (let i = 1; i <= count; i++) {
    const t = i / count;
    const r = radius * .94 * Math.sqrt(t);
    ctx.fillStyle = i % 2 ? shades.main : shades.light;
    circle(ctx, Math.cos(i * golden) * r, Math.sin(i * golden) * r, radius * (.075 * (1 - t * .6) + .012));
  }
}

function drawStarFlower(ctx, radius, depth, shades) {
  const grow = (x, y, r, rotation, level) => {
    ctx.fillStyle = level % 2 ? shades.light : shades.main;
    fillStar(ctx, x, y, r, rotation);
    if (level >= depth || r < 2.2) return;
    for (let i = 0; i < 5; i++) {
      const a = rotation + i * Math.PI * 2 / 5;
      grow(x + Math.cos(a) * r * 1.42, y + Math.sin(a) * r * 1.42, r * .33, rotation, level + 1);
    }
  };
  grow(0, 0, radius * .4, -Math.PI / 2, 1);
}

function drawTree(ctx, radius, depth, shades) {
  const tips = [];
  const branch = (x, y, angle, len, w, level) => {
    const ex = x + Math.cos(angle) * len, ey = y + Math.sin(angle) * len;
    capsule(ctx, x, y, ex, ey, w, shades.dark);
    if (level >= depth || len < 2.2) { tips.push([ex, ey, len]); return; }
    const spread = Math.PI / 4.6;
    branch(ex, ey, angle - spread + .08, len * .68, w * .64, level + 1);
    branch(ex, ey, angle + spread - .08, len * .68, w * .64, level + 1);
  };
  branch(0, radius, -Math.PI / 2, radius * .55, radius * .2, 1);
  for (const [x, y, s] of tips) { ctx.fillStyle = shades.main; circle(ctx, x, y, s * .5 + 1.4); }
  for (const [x, y, s] of tips) { ctx.fillStyle = shades.light; circle(ctx, x - s * .16, y - s * .16, s * .26); }
}

function drawRomanesco(ctx, radius, depth, shades) {
  const bud = (x, y, r, level, rot) => {
    ctx.fillStyle = level % 2 ? shades.light : shades.main;
    circle(ctx, x, y, r);
    if (level >= depth || r < 1.6) return;
    for (let i = 0; i < 3; i++) {
      const a = rot + i * Math.PI * 2 / 3;
      bud(x + Math.cos(a) * r * 1.05, y + Math.sin(a) * r * 1.05, r * .6, level + 1, rot + .45);
    }
  };
  bud(0, 0, radius * .3, 1, -.5);
}

function drawCarpet(ctx, radius, depth, shades) {
  const cell = (x, y, s, level) => {
    ctx.fillStyle = level % 2 ? shades.main : shades.light;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x - s / 2, y - s / 2, s, s, Math.max(1, s * .12)); ctx.fill(); }
    else ctx.fillRect(x - s / 2, y - s / 2, s, s);
    if (level >= depth || s < 4.5) return;
    const third = s / 3;
    for (let i = 0; i < 9; i++) {
      if (i === 4) continue;
      cell(x + (i % 3 - 1) * third, y + ((i / 3 | 0) - 1) * third, third, level + 1);
    }
  };
  cell(0, 0, radius * 1.84, 1);
}

function drawBubbles(ctx, radius, depth, shades) {
  const bubble = (x, y, r, level) => {
    ctx.fillStyle = level % 2 ? shades.light : shades.main;
    circle(ctx, x, y, r);
    if (level >= depth || r < 2) return;
    const vertical = level % 2 === 1, off = r * .5;
    bubble(x + (vertical ? 0 : -off), y + (vertical ? -off : 0), r * .5, level + 1);
    bubble(x + (vertical ? 0 : off), y + (vertical ? off : 0), r * .5, level + 1);
  };
  bubble(0, 0, radius * .96, 1);
}

const PRESET_DRAWERS = {
  snowflake: drawSnowflake, mandala: drawMandala, sunflower: drawSunflower, star: drawStarFlower,
  tree: drawTree, romanesco: drawRomanesco, carpet: drawCarpet, bubbles: drawBubbles,
};

/** 在 size×size 的画布中心绘制指定分形；返回该画布。 */
export function renderFractalCanvas({ preset = fractalState.preset, size = fractalState.size, color = fractalState.color, depth = fractalState.depth } = {}) {
  const normalized = normalizeFractalDepth(depth);
  const width = Math.max(64, Math.round(Number(size) || 420));
  const canvas = makeCanvas(width, width, false);
  const ctx = canvas.getContext('2d');
  const draw = PRESET_DRAWERS[preset];
  if (!draw) throw new Error('未知的分形图案。');
  ctx.save();
  ctx.translate(width / 2, width / 2);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  draw(ctx, width * .44, normalized, fractalShades(color));
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
