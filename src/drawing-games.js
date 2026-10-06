/**
 * Small, deterministic drawing games used by the child-friendly helpers.
 *
 * The models deliberately contain no DOM or canvas code.  A renderer can use
 * drawState() while the pointer/keyboard layer only needs visit/trace/move.
 */

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 560;

const point = (x, y) => Object.freeze({ x, y });

// Points are deliberately spaced far enough apart for a 24px touch target.
export const DOT_CARDS = Object.freeze([
  Object.freeze({ id: 'fish', title: '小鱼游呀游', icon: '🐟', points: Object.freeze([
    point(120, 280), point(190, 190), point(300, 155), point(420, 180), point(540, 250),
    point(620, 330), point(520, 395), point(390, 420), point(255, 390), point(160, 340),
  ]) }),
  Object.freeze({ id: 'house', title: '我的小房子', icon: '🏠', points: Object.freeze([
    point(155, 410), point(155, 270), point(260, 175), point(400, 105), point(540, 175),
    point(645, 270), point(645, 410), point(500, 410), point(500, 310), point(300, 310),
    point(300, 410),
  ]) }),
  Object.freeze({ id: 'rocket', title: '小火箭出发', icon: '🚀', points: Object.freeze([
    point(155, 380), point(190, 265), point(260, 175), point(370, 115), point(480, 175),
    point(550, 265), point(585, 380), point(480, 350), point(370, 405), point(260, 350),
  ]) }),
  Object.freeze({ id: 'butterfly', title: '花蝴蝶', icon: '🦋', points: Object.freeze([
    point(400, 280), point(300, 170), point(185, 140), point(120, 220), point(170, 325),
    point(300, 360), point(400, 300), point(500, 360), point(630, 325), point(680, 220),
    point(615, 140), point(500, 170), point(400, 280),
  ]) }),
  Object.freeze({ id: 'boat', title: '小船去远航', icon: '⛵', points: Object.freeze([
    point(125, 240), point(400, 240), point(675, 240), point(610, 370), point(510, 425),
    point(290, 425), point(190, 370), point(125, 240),
  ]) }),
  Object.freeze({ id: 'star', title: '闪亮小星星', icon: '⭐', points: Object.freeze([
    point(400, 90), point(465, 230), point(620, 245), point(500, 340), point(540, 495),
    point(400, 405), point(260, 495), point(300, 340), point(180, 245), point(335, 230),
  ]) }),
]);

const finitePoint = value => value && Number.isFinite(value.x) && Number.isFinite(value.y);

function segmentCircleT(from, to, center, radius) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length2 = dx * dx + dy * dy;
  const radius2 = radius * radius;
  if (length2 === 0) return Math.hypot(from.x - center.x, from.y - center.y) <= radius ? 0 : null;
  const projection = ((center.x - from.x) * dx + (center.y - from.y) * dy) / length2;
  const t = Math.max(0, Math.min(1, projection));
  const nearestX = from.x + dx * t;
  const nearestY = from.y + dy * t;
  if ((nearestX - center.x) ** 2 + (nearestY - center.y) ** 2 > radius2) return null;
  // Return the first intersection, rather than the nearest-point projection,
  // so one long pointer sample can safely collect several dots in order.
  const offset = Math.sqrt(Math.max(0, radius2 - ((nearestX - center.x) ** 2 + (nearestY - center.y) ** 2)) / length2);
  return Math.max(0, t - offset);
}

export class DotDrawingModel {
  constructor(card) {
    if (!card || !Array.isArray(card.points) || card.points.length < 2) throw new TypeError('点点画卡片无效');
    this.card = card;
    this.nextIndex = 0;
  }

  get complete() { return this.nextIndex >= this.card.points.length; }
  get currentPoint() { return this.complete ? null : this.card.points[this.nextIndex]; }
  get visitedPoints() { return this.card.points.slice(0, this.nextIndex); }
  get segments() {
    const result = [];
    for (let i = 1; i < this.nextIndex; i++) result.push({ from: this.card.points[i - 1], to: this.card.points[i] });
    return result;
  }
  get progress() { return this.card.points.length ? this.nextIndex / this.card.points.length : 1; }

  visit(input, radius = 24) {
    if (this.complete || !finitePoint(input)) return false;
    const r = Number.isFinite(radius) ? Math.max(1, radius) : 24;
    const target = this.currentPoint;
    if (Math.hypot(input.x - target.x, input.y - target.y) > r) return false;
    this.nextIndex += 1;
    return true;
  }

  trace(from, to, radius = 24) {
    if (this.complete || !finitePoint(from) || !finitePoint(to)) return 0;
    const r = Number.isFinite(radius) ? Math.max(1, radius) : 24;
    let cursor = 0;
    let accepted = 0;
    while (!this.complete) {
      const current = this.currentPoint;
      const t = segmentCircleT(from, to, current, r);
      if (t === null || t + 1e-8 < cursor) break;
      // If a later dot is met first, this is a reverse/teleporting sweep. Do
      // not accept an apparently valid current dot from that gesture.
      let futureBeforeCurrent = false;
      for (let i = this.nextIndex + 1; i < this.card.points.length; i++) {
        const futureT = segmentCircleT(from, to, this.card.points[i], r);
        if (futureT !== null && futureT + 1e-8 < t) { futureBeforeCurrent = true; break; }
      }
      if (futureBeforeCurrent) break;
      this.nextIndex += 1;
      accepted += 1;
      cursor = Math.min(1, t + 1e-7);
    }
    return accepted;
  }

  undo() {
    if (this.nextIndex <= 0) return false;
    this.nextIndex -= 1;
    return true;
  }

  reset() {
    const changed = this.nextIndex !== 0;
    this.nextIndex = 0;
    return changed;
  }

  acceptNext() {
    if (this.complete) return false;
    this.nextIndex += 1;
    return true;
  }

  drawState() {
    return { points: this.card.points, segments: this.segments, visitedPoints: this.visitedPoints,
      nextPoint: this.currentPoint, nextIndex: this.nextIndex, progress: this.progress, complete: this.complete };
  }
}

export const MAZE_CARDS = Object.freeze([
  Object.freeze({ id: 'garden', title: '花园小路', icon: '🌷', columns: 7, rows: 5, seed: 1047 }),
  Object.freeze({ id: 'ocean', title: '海底寻宝', icon: '🐳', columns: 9, rows: 5, seed: 2053 }),
  Object.freeze({ id: 'space', title: '星际探险', icon: '🚀', columns: 9, rows: 7, seed: 3061 }),
  Object.freeze({ id: 'forest', title: '森林探险', icon: '🌲', columns: 11, rows: 5, seed: 4079 }),
  Object.freeze({ id: 'castle', title: '城堡寻宝', icon: '🏰', columns: 11, rows: 7, seed: 5099 }),
  Object.freeze({ id: 'cloud', title: '云朵乐园', icon: '☁️', columns: 7, rows: 7, seed: 6011 }),
]);

function randomFor(seed) {
  let value = (Number(seed) >>> 0) || 1;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

const DIRECTIONS = [
  { dx: 0, dy: -1, wall: 'top', opposite: 'bottom' },
  { dx: 1, dy: 0, wall: 'right', opposite: 'left' },
  { dx: 0, dy: 1, wall: 'bottom', opposite: 'top' },
  { dx: -1, dy: 0, wall: 'left', opposite: 'right' },
];
const validDimension = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const cellKey = (x, y) => `${x},${y}`;

export function createMaze(card) {
  if (!card || !validDimension(card.columns, 3, 11) || !validDimension(card.rows, 3, 7)) throw new TypeError('迷宫尺寸无效');
  const columns = card.columns;
  const rows = card.rows;
  const cells = Array.from({ length: rows }, (_, y) => Array.from({ length: columns }, (_, x) => ({
    x, y, walls: { top: true, right: true, bottom: true, left: true },
  })));
  const seen = new Set();
  const random = randomFor(card.seed);
  const at = (x, y) => cells[y][x];
  const stack = [{ x: 0, y: 0 }];
  seen.add(cellKey(0, 0));
  while (stack.length) {
    const current = stack.at(-1);
    const choices = DIRECTIONS.map((direction, index) => ({ direction, index, x: current.x + direction.dx, y: current.y + direction.dy }))
      .filter(candidate => candidate.x >= 0 && candidate.x < columns && candidate.y >= 0 && candidate.y < rows && !seen.has(cellKey(candidate.x, candidate.y)));
    if (!choices.length) { stack.pop(); continue; }
    const choice = choices[Math.floor(random() * choices.length)];
    const next = { x: choice.x, y: choice.y };
    at(current.x, current.y).walls[choice.direction.wall] = false;
    at(next.x, next.y).walls[choice.direction.opposite] = false;
    seen.add(cellKey(next.x, next.y));
    stack.push(next);
  }
  return { id: card.id, columns, rows, cells, start: { x: 0, y: 0 }, goal: { x: columns - 1, y: rows - 1 }, seed: card.seed };
}

export function mazeSolution(maze) {
  if (!maze || !Array.isArray(maze.cells) || !finitePoint(maze.start) || !finitePoint(maze.goal)) return [];
  const queue = [maze.start];
  const previous = new Map([[cellKey(maze.start.x, maze.start.y), null]]);
  while (queue.length) {
    const current = queue.shift();
    if (current.x === maze.goal.x && current.y === maze.goal.y) break;
    for (const direction of DIRECTIONS) {
      if (maze.cells[current.y]?.[current.x]?.walls?.[direction.wall]) continue;
      const x = current.x + direction.dx;
      const y = current.y + direction.dy;
      if (x < 0 || x >= maze.columns || y < 0 || y >= maze.rows) continue;
      const key = cellKey(x, y);
      if (previous.has(key)) continue;
      previous.set(key, current);
      queue.push({ x, y });
    }
  }
  const goalKey = cellKey(maze.goal.x, maze.goal.y);
  if (!previous.has(goalKey)) return [];
  const result = [];
  for (let current = maze.goal; current; current = previous.get(cellKey(current.x, current.y))) result.push({ x: current.x, y: current.y });
  return result.reverse();
}

function validCell(cell, maze) {
  return cell && Number.isInteger(cell.x) && Number.isInteger(cell.y) && cell.x >= 0 && cell.x < maze.columns && cell.y >= 0 && cell.y < maze.rows;
}

export class MazeDrawingModel {
  constructor(card, maze = createMaze(card)) {
    this.card = card;
    this.maze = maze;
    this.solution = mazeSolution(maze);
    this.path = [{ ...maze.start }];
  }
  get complete() {
    const current = this.path.at(-1);
    return current.x === this.maze.goal.x && current.y === this.maze.goal.y;
  }
  get progress() {
    const solutionLength = this.solution.length;
    return solutionLength ? Math.min(1, (this.path.length - 1) / (solutionLength - 1)) : 0;
  }
  move(input) {
    if (!validCell(input, this.maze)) return false;
    const current = this.path.at(-1);
    const dx = input.x - current.x;
    const dy = input.y - current.y;
    if (Math.abs(dx) + Math.abs(dy) !== 1) return false;
    const direction = DIRECTIONS.find(item => item.dx === dx && item.dy === dy);
    if (this.maze.cells[current.y][current.x].walls[direction.wall] || this.maze.cells[input.y][input.x].walls[direction.opposite]) return false;
    const previous = this.path.at(-2);
    if (previous && previous.x === input.x && previous.y === input.y) { this.path.pop(); return true; }
    if (this.path.some(cell => cell.x === input.x && cell.y === input.y)) return false;
    this.path.push({ x: input.x, y: input.y });
    return true;
  }
  trace(from, to) {
    if (!validCell(from, this.maze) || !validCell(to, this.maze)) return false;
    const current = this.path.at(-1);
    if (current.x !== from.x || current.y !== from.y) return false;
    if (from.x !== to.x && from.y !== to.y) return false;
    const steps = Math.max(Math.abs(to.x - from.x), Math.abs(to.y - from.y));
    if (!steps) return false;
    const dx = Math.sign(to.x - from.x);
    const dy = Math.sign(to.y - from.y);
    const snapshot = this.path.map(cell => ({ ...cell }));
    for (let i = 1; i <= steps; i++) {
      if (!this.move({ x: from.x + dx * i, y: from.y + dy * i })) { this.path = snapshot; return false; }
    }
    return true;
  }
  undo() { return this.path.length > 1 ? (this.path.pop(), true) : false; }
  reset() { const changed = this.path.length > 1; this.path = [{ ...this.maze.start }]; return changed; }
  drawState() {
    return { columns: this.maze.columns, rows: this.maze.rows, cells: this.maze.cells,
      start: this.maze.start, goal: this.maze.goal, path: this.path, progress: this.progress, complete: this.complete };
  }
}
