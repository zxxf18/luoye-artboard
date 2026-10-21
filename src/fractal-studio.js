import { makeCanvas } from './engine.js';

/**
 * 分形图案工坊：左侧选基础图案，参数栏调颜色、大小与分形次数，
 * 点击画纸把图案作为图层放到点击位置。图案不用细线条，全部由
 * 填色的图形块（圆珠、花瓣、胶囊胳膊、圆角方巾、星星）画成小图片，
 * 与画笔盒的画风一致；同参数逐像素可复现。
 */

export const FRACTAL_PRESETS = Object.freeze([
  { id: 'snowflake', name: '小雪花', hint: '六条圆胳膊层层开出小雪花' },
  { id: 'mandala', name: '窗花', hint: '一圈圈花瓣转出来的窗花' },
  { id: 'sunflower', name: '太阳花', hint: '按黄金角度排出的花盘' },
  { id: 'star', name: '星星花', hint: '大星星尖上再开小星星' },
  { id: 'tree', name: '分形树', hint: '每根枝条再长两根，梢头开花' },
  { id: 'romanesco', name: '花菜塔', hint: '一颗颗小塔按三瓣转着长' },
  { id: 'carpet', name: '花毯', hint: '方巾中间镂空，一层套一层' },
  { id: 'bubbles', name: '泡泡', hint: '大泡泡里装着两个小泡泡' },
  { id: 'web', name: '蜘蛛网', hint: '一圈一圈织出来的大网' },
  { id: 'shell', name: '海螺', hint: '一间比一间大的小房子' },
  { id: 'firework', name: '烟花', hint: '亮点一圈圈炸开像烟花' },
  { id: 'fern', name: '蕨叶', hint: '大叶子两边长着小叶子' },
]);

/**
 * 左侧列表的卡通图标：滤镜列表同款画风（暖色、圆角、带小表情的
 * 64×64 SVG），不是分形渲染本身；画到画纸上的图案仍由各预设递归绘制。
 */
export const FRACTAL_PRESET_ICONS = Object.freeze({
  snowflake: `<g stroke="#9fd0e6" stroke-width="6" stroke-linecap="round" fill="none"><path d="M32 7v50M11 19l42 26M53 19 11 45"/></g><g fill="#e8f6fc" stroke="#9fd0e6" stroke-width="2"><circle cx="32" cy="7" r="3.4"/><circle cx="32" cy="57" r="3.4"/><circle cx="11" cy="19" r="3.4"/><circle cx="53" cy="19" r="3.4"/><circle cx="11" cy="45" r="3.4"/><circle cx="53" cy="45" r="3.4"/></g><circle cx="32" cy="32" r="9.5" fill="#fff7e8" stroke="#8d654c" stroke-width="2.5"/><circle cx="28.8" cy="30.5" r="1.5" fill="#714c3c" stroke="none"/><circle cx="35.2" cy="30.5" r="1.5" fill="#714c3c" stroke="none"/><path d="M28.5 34q3.5 3 7 0" stroke="#714c3c" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  mandala: `<g fill="#f6c785" stroke="#c88449" stroke-width="2"><ellipse cx="32" cy="16" rx="6.5" ry="10"/><ellipse cx="32" cy="16" rx="6.5" ry="10" transform="rotate(45 32 32)"/><ellipse cx="32" cy="16" rx="6.5" ry="10" transform="rotate(90 32 32)"/><ellipse cx="32" cy="16" rx="6.5" ry="10" transform="rotate(135 32 32)"/><ellipse cx="32" cy="16" rx="6.5" ry="10" transform="rotate(180 32 32)"/><ellipse cx="32" cy="16" rx="6.5" ry="10" transform="rotate(225 32 32)"/><ellipse cx="32" cy="16" rx="6.5" ry="10" transform="rotate(270 32 32)"/><ellipse cx="32" cy="16" rx="6.5" ry="10" transform="rotate(315 32 32)"/></g><g fill="#eeb46b" stroke="#c88449" stroke-width="1.8"><circle cx="32" cy="22" r="4" transform="rotate(22.5 32 32)"/><circle cx="32" cy="22" r="4" transform="rotate(112.5 32 32)"/><circle cx="32" cy="22" r="4" transform="rotate(202.5 32 32)"/><circle cx="32" cy="22" r="4" transform="rotate(292.5 32 32)"/></g><circle cx="32" cy="32" r="6.5" fill="#fff4d8" stroke="#8d654c" stroke-width="2.2"/><circle cx="29.5" cy="31" r="1.4" fill="#714c3c" stroke="none"/><circle cx="34.5" cy="31" r="1.4" fill="#714c3c" stroke="none"/><path d="M29.5 33.5q2.5 2.5 5 0" stroke="#714c3c" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
  sunflower: `<g fill="#f5c05a" stroke="#c88449" stroke-width="2"><ellipse cx="32" cy="12" rx="5.5" ry="11"/><ellipse cx="32" cy="12" rx="5.5" ry="11" transform="rotate(30 32 32)"/><ellipse cx="32" cy="12" rx="5.5" ry="11" transform="rotate(60 32 32)"/><ellipse cx="32" cy="12" rx="5.5" ry="11" transform="rotate(90 32 32)"/><ellipse cx="32" cy="12" rx="5.5" ry="11" transform="rotate(120 32 32)"/><ellipse cx="32" cy="12" rx="5.5" ry="11" transform="rotate(150 32 32)"/><ellipse cx="32" cy="12" rx="5.5" ry="11" transform="rotate(180 32 32)"/><ellipse cx="32" cy="12" rx="5.5" ry="11" transform="rotate(210 32 32)"/><ellipse cx="32" cy="12" rx="5.5" ry="11" transform="rotate(240 32 32)"/><ellipse cx="32" cy="12" rx="5.5" ry="11" transform="rotate(270 32 32)"/><ellipse cx="32" cy="12" rx="5.5" ry="11" transform="rotate(300 32 32)"/><ellipse cx="32" cy="12" rx="5.5" ry="11" transform="rotate(330 32 32)"/></g><circle cx="32" cy="32" r="13.5" fill="#a5713f" stroke="#8d654c" stroke-width="2.5"/><g fill="#7a5230" stroke="none"><circle cx="27" cy="27" r="1.3"/><circle cx="37" cy="27" r="1.3"/><circle cx="27" cy="37" r="1.3"/><circle cx="37" cy="37" r="1.3"/></g><circle cx="29" cy="31" r="1.6" fill="#ffe9c4" stroke="none"/><circle cx="35" cy="31" r="1.6" fill="#ffe9c4" stroke="none"/><path d="M29 34.5q3 2.6 6 0" stroke="#ffe9c4" stroke-width="1.7" fill="none" stroke-linecap="round"/>`,
  star: `<path d="m32 6 7.2 15.2 16.3 2.1-12 11.4 3 16.2L32 43l-14.5 7.9 3-16.2-12-11.4 16.3-2.1z" fill="#f7c94f" stroke="#c88449" stroke-width="2.5" stroke-linejoin="round"/><path d="m13 12 2 4.4 4.8.7-3.5 3.3.9 4.7-4.2-2.3-4.2 2.3.9-4.7-3.5-3.3 4.8-.7z" fill="#fce3a1" stroke="#c88449" stroke-width="1.8" stroke-linejoin="round"/><path d="m51 44 1.6 3.4 3.8.5-2.7 2.6.7 3.7-3.4-1.9-3.4 1.9.7-3.7-2.7-2.6 3.8-.5z" fill="#fce3a1" stroke="#c88449" stroke-width="1.8" stroke-linejoin="round"/><circle cx="29" cy="28" r="1.5" fill="#714c3c" stroke="none"/><circle cx="35" cy="28" r="1.5" fill="#714c3c" stroke="none"/><path d="M29 31.5q3 2.8 6 0" stroke="#714c3c" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  tree: `<path d="M32 58V40m0 0c0-7-7-9-11-15m11 15c0-7 7-9 11-15" stroke="#a5713f" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="19" cy="23" r="8.5" fill="#b7d9b0" stroke="#6f9a75" stroke-width="2.2"/><circle cx="45" cy="23" r="8.5" fill="#9cc79f" stroke="#6f9a75" stroke-width="2.2"/><circle cx="32" cy="13" r="9" fill="#cde4c5" stroke="#6f9a75" stroke-width="2.2"/><circle cx="29.5" cy="12" r="1.3" fill="#5d7a5f" stroke="none"/><circle cx="34.5" cy="12" r="1.3" fill="#5d7a5f" stroke="none"/><path d="M29.5 14.5q2.5 2.2 5 0" stroke="#5d7a5f" stroke-width="1.6" fill="none" stroke-linecap="round"/><circle cx="32" cy="21" r="2" fill="#e8745f" stroke="none"/><circle cx="22" cy="27" r="2" fill="#e8745f" stroke="none"/><circle cx="43" cy="26" r="2" fill="#e8745f" stroke="none"/>`,
  romanesco: `<path d="M25 58h14l4-10H21z" fill="#a5713f" stroke="#8d654c" stroke-width="2.2" stroke-linejoin="round"/><circle cx="32" cy="27" r="16" fill="#b7d9b0" stroke="#6f9a75" stroke-width="2.5"/><circle cx="22" cy="36" r="8.5" fill="#cde4c5" stroke="#6f9a75" stroke-width="2"/><circle cx="42" cy="36" r="8.5" fill="#9cc79f" stroke="#6f9a75" stroke-width="2"/><circle cx="32" cy="15" r="7" fill="#dcedd4" stroke="#6f9a75" stroke-width="2"/><circle cx="28.5" cy="26" r="1.5" fill="#5d7a5f" stroke="none"/><circle cx="35.5" cy="26" r="1.5" fill="#5d7a5f" stroke="none"/><path d="M28.5 29.5q3.5 3 7 0" stroke="#5d7a5f" stroke-width="1.7" fill="none" stroke-linecap="round"/>`,
  carpet: `<rect x="7" y="12" width="50" height="44" rx="9" fill="#e8a8a0" stroke="#b9624a" stroke-width="2.5"/><rect x="14" y="19" width="36" height="30" rx="5" fill="#f9ddca" stroke="#c88449" stroke-width="2"/><g fill="#e8a8a0" stroke="#c88449" stroke-width="1.5"><rect x="17.5" y="23" width="9" height="6.5" rx="2"/><rect x="27.5" y="23" width="9" height="6.5" rx="2"/><rect x="37.5" y="23" width="9" height="6.5" rx="2"/><rect x="17.5" y="31.5" width="9" height="6.5" rx="2"/><rect x="37.5" y="31.5" width="9" height="6.5" rx="2"/><rect x="17.5" y="40" width="9" height="6.5" rx="2"/><rect x="27.5" y="40" width="9" height="6.5" rx="2"/><rect x="37.5" y="40" width="9" height="6.5" rx="2"/></g><circle cx="32" cy="34.8" r="2.6" fill="#fff4d8" stroke="#c88449" stroke-width="1.5"/>`,
  bubbles: `<circle cx="25" cy="25" r="14.5" fill="#d3ecf7" stroke="#7fb3cf" stroke-width="2.5"/><circle cx="43" cy="33" r="11" fill="#e5f5fc" stroke="#7fb3cf" stroke-width="2.5"/><circle cx="27" cy="44" r="9" fill="#dceff8" stroke="#7fb3cf" stroke-width="2.5"/><path d="M16 21a11 11 0 0 1 6-6" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M37 28a7 7 0 0 1 4-4" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round"/><circle cx="21.5" cy="24" r="1.5" fill="#4d7d99" stroke="none"/><circle cx="28.5" cy="24" r="1.5" fill="#4d7d99" stroke="none"/><path d="M21.5 27.5q3.5 3 7 0" stroke="#4d7d99" stroke-width="1.7" fill="none" stroke-linecap="round"/>`,
  web: `<g stroke="#9fb4c8" stroke-width="2.4" fill="none" stroke-linecap="round"><path d="M32 6v38M10 14l44 22M54 14 10 36M21 9l22 32M43 9 21 41"/><path d="M20 12q12-5 24 1M14 20q18-7 36 1M12 29q19-7 40 0M14 38q17-6 34 0"/></g><path d="M32 44v4" stroke="#9fb4c8" stroke-width="1.6" fill="none"/><circle cx="32" cy="53" r="6.5" fill="#8d9fb5" stroke="#6b7d94" stroke-width="2"/><path d="M26 50l-6-2m6 5-6 3m12-6 6-2m-6 5 6 3" stroke="#6b7d94" stroke-width="2.2" stroke-linecap="round" fill="none"/><circle cx="30" cy="52" r="1.1" fill="#fff" stroke="none"/><circle cx="34" cy="52" r="1.1" fill="#fff" stroke="none"/><path d="M30 54.5q2 1.8 4 0" stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round"/>`,
  shell: `<circle cx="38" cy="30" r="17" fill="#f6cd9c" stroke="#c88449" stroke-width="2.5"/><path d="M38 18a12 12 0 0 1 12 12 12 12 0 0 1-12 12 9 9 0 0 1-9-9 7 7 0 0 1 7-7 5 5 0 0 1 5 5" fill="none" stroke="#c88449" stroke-width="2.4" stroke-linecap="round"/><circle cx="11" cy="38" r="5.5" fill="#e8a17c" stroke="#c88449" stroke-width="2"/><path d="M9 33 7 27m6 6 3-6" stroke="#c88449" stroke-width="2" stroke-linecap="round" fill="none"/><circle cx="7" cy="26" r="1.6" fill="#714c3c" stroke="none"/><circle cx="16.5" cy="26.5" r="1.6" fill="#714c3c" stroke="none"/><path d="M9.5 38.5q1.5 1.4 3 0" stroke="#8d654c" stroke-width="1.4" fill="none" stroke-linecap="round"/>`,
  firework: `<g stroke="#e8935a" stroke-width="3.4" stroke-linecap="round" fill="none"><path d="M32 28V8m0 20 17-13M32 28l20 3M32 28l7 19M32 28l-7 19M32 28l-20 3M32 28 15 15"/></g><g fill="#f2b560" stroke="none"><circle cx="32" cy="7" r="3"/><circle cx="50" cy="14" r="3"/><circle cx="53" cy="31" r="3"/><circle cx="40" cy="48" r="3"/><circle cx="24" cy="48" r="3"/><circle cx="11" cy="31" r="3"/><circle cx="14" cy="14" r="3"/></g><g fill="#e8a8a0" stroke="none"><circle cx="42" cy="22" r="2.2"/><circle cx="43" cy="38" r="2.2"/><circle cx="21" cy="38" r="2.2"/><circle cx="22" cy="22" r="2.2"/></g><path d="m32 24 2.2 4.6 5 .7-3.6 3.4.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.4 5-.7z" fill="#f7c94f" stroke="#c88449" stroke-width="1.6" stroke-linejoin="round"/>`,
  fern: `<path d="M33 58C31 44 31 26 35 9" stroke="#7fa05f" stroke-width="3.2" fill="none" stroke-linecap="round"/><g fill="#9cc79f" stroke="#6f9a75" stroke-width="1.6"><ellipse cx="22" cy="46" rx="9" ry="3.6" transform="rotate(-16 22 46)"/><ellipse cx="40" cy="46" rx="9" ry="3.6" transform="rotate(16 40 46)"/><ellipse cx="23" cy="37" rx="8" ry="3.2" transform="rotate(-18 23 37)"/><ellipse cx="41" cy="37" rx="8" ry="3.2" transform="rotate(18 41 37)"/><ellipse cx="25" cy="28" rx="7" ry="2.9" transform="rotate(-22 25 28)"/><ellipse cx="39" cy="28" rx="7" ry="2.9" transform="rotate(22 39 28)"/><ellipse cx="27" cy="20" rx="5.5" ry="2.5" transform="rotate(-26 27 20)"/><ellipse cx="38" cy="20" rx="5.5" ry="2.5" transform="rotate(26 38 20)"/></g><circle cx="36" cy="12" r="2.2" fill="#e8745f" stroke="none"/>`,
});

/** 每加一次分形，图形数约乘 3～8；6 次在视觉上已经饱和。 */
export const FRACTAL_MAX_DEPTH = 6;
export const FRACTAL_DEFAULTS = Object.freeze({ preset: 'snowflake', color: '#285b49', size: 420, depth: 2 });
export const FRACTAL_SIZE_RANGE = Object.freeze({ min: 120, max: 920 });

/** 滑杆对孩子展示 0–100% 的百分比，内部仍按像素渲染；两端对齐范围。 */
export function fractalPercentToSize(percent) {
  const value = Math.round(Number(percent));
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error('分形大小百分比需要在 0 到 100 之间。');
  }
  return FRACTAL_SIZE_RANGE.min + Math.round((FRACTAL_SIZE_RANGE.max - FRACTAL_SIZE_RANGE.min) * value / 100);
}

export function fractalSizeToPercent(size) {
  const value = Math.round(Number(size));
  if (!Number.isFinite(value) || value < FRACTAL_SIZE_RANGE.min || value > FRACTAL_SIZE_RANGE.max) {
    throw new Error(`分形大小需要在 ${FRACTAL_SIZE_RANGE.min} 到 ${FRACTAL_SIZE_RANGE.max} 之间。`);
  }
  return Math.round((value - FRACTAL_SIZE_RANGE.min) * 100 / (FRACTAL_SIZE_RANGE.max - FRACTAL_SIZE_RANGE.min));
}

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

function drawWeb(ctx, radius, depth, shades) {
  // 八根粗辐条加向外鼓的同心网圈，圈数随分形次数增加。
  const spokes = 8, rings = depth + 1;
  for (let i = 0; i < spokes; i++) {
    const a = i * Math.PI * 2 / spokes - Math.PI / 2;
    capsule(ctx, 0, 0, Math.cos(a) * radius * .98, Math.sin(a) * radius * .98, radius * .04, shades.dark);
  }
  ctx.lineJoin = 'round';
  for (let ring = 1; ring <= rings; ring++) {
    const r = radius * .98 * ring / (rings + .35);
    ctx.strokeStyle = ring % 2 ? shades.main : shades.light;
    ctx.lineWidth = radius * .05;
    ctx.beginPath();
    for (let i = 0; i <= spokes; i++) {
      const a = i * Math.PI * 2 / spokes - Math.PI / 2;
      const px = Math.cos(a) * r, py = Math.sin(a) * r;
      if (!i) { ctx.moveTo(px, py); continue; }
      const mid = a - Math.PI / spokes;
      ctx.quadraticCurveTo(Math.cos(mid) * r * 1.24, Math.sin(mid) * r * 1.24, px, py);
    }
    ctx.stroke();
  }
  ctx.fillStyle = shades.dark;
  circle(ctx, 0, 0, radius * .09);
}

function drawShell(ctx, radius, depth, shades) {
  // 斐波那契方砖：一间比一间大的小房子，房间中心的连线就是螺线。
  let left = 0, right = 1, bottom = 0, top = 1;
  const cells = [{ x: 0, y: 0, s: 1 }];
  for (let i = 1; i <= depth + 3; i++) {
    const w = right - left, h = top - bottom, m = i % 4;
    if (m === 1) { cells.push({ x: right, y: bottom, s: h }); right += h; }
    else if (m === 2) { cells.push({ x: left, y: top, s: w }); top += w; }
    else if (m === 3) { cells.push({ x: left - h, y: top - h, s: h }); left -= h; }
    else { cells.push({ x: left, y: bottom - w, s: w }); bottom -= w; }
  }
  const scale = radius * 2 / Math.max(right - left, top - bottom);
  ctx.save();
  ctx.translate(-(left + right) / 2 * scale, -(bottom + top) / 2 * scale);
  ctx.scale(scale, scale);
  cells.forEach((cell, i) => {
    ctx.fillStyle = i % 2 ? shades.light : shades.main;
    ctx.fillRect(cell.x, cell.y, cell.s, cell.s);
  });
  ctx.beginPath();
  cells.forEach((cell, i) => {
    const px = cell.x + cell.s / 2, py = cell.y + cell.s / 2;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  });
  ctx.strokeStyle = shades.dark;
  ctx.lineWidth = .16;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

function drawFirework(ctx, radius, depth, shades) {
  const burst = (x, y, r, angle) => {
    for (let i = 0; i < 10; i++) {
      const a = angle + i * Math.PI / 5;
      for (let s = 1; s <= 3; s++) {
        const t = s / 3;
        ctx.fillStyle = (i + s) % 2 ? shades.main : shades.light;
        circle(ctx, x + Math.cos(a) * r * t, y + Math.sin(a) * r * t, r * .1 * (1 - t * .45) + .4);
      }
    }
  };
  burst(0, 0, radius, 0);
  if (depth > 1) {
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5 - Math.PI / 2;
      burst(Math.cos(a) * radius * 1.02, Math.sin(a) * radius * 1.02, radius * .32, a);
    }
  }
  ctx.fillStyle = shades.dark;
  circle(ctx, 0, 0, radius * .09);
}

function drawFern(ctx, radius, depth, shades) {
  // 一根主脉，两边对生柳叶，越靠尖越小；次数越多叶片越密。
  const pairs = 3 + depth * 2;
  capsule(ctx, 0, radius, 0, -radius * .92, radius * .05, shades.dark);
  for (let i = 0; i < pairs; i++) {
    const t = i / (pairs - 1);
    const y = radius - t * radius * 1.78;
    const len = radius * .52 * (1 - t * .82);
    if (len < 1) break;
    for (const side of [-1, 1]) {
      ctx.fillStyle = (i + (side > 0 ? 1 : 0)) % 2 ? shades.main : shades.light;
      ctx.save();
      ctx.translate(0, y);
      ctx.rotate(side * (Math.PI / 2.6) * (1 + t * .15));
      ctx.beginPath();
      ctx.ellipse(len / 2, 0, len / 2, len * .16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

const PRESET_DRAWERS = {
  snowflake: drawSnowflake, mandala: drawMandala, sunflower: drawSunflower, star: drawStarFlower,
  tree: drawTree, romanesco: drawRomanesco, carpet: drawCarpet, bubbles: drawBubbles,
  web: drawWeb, shell: drawShell, firework: drawFirework, fern: drawFern,
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
