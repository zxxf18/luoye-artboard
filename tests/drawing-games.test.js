import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GAME_WIDTH, GAME_HEIGHT, DOT_CARDS, DotDrawingModel,
  MAZE_CARDS, createMaze, mazeSolution, MazeDrawingModel,
} from '../src/drawing-games.js';

test('点点画卡片在固定画布内并且内容可识别', () => {
  assert.equal(GAME_WIDTH, 800);
  assert.equal(GAME_HEIGHT, 560);
  assert.ok(DOT_CARDS.length >= 6);
  for (const card of DOT_CARDS) {
    assert.ok(card.id && card.title && card.icon);
    assert.ok(card.points.length >= 5);
    for (const point of card.points) {
      assert.ok(point.x >= 0 && point.x <= GAME_WIDTH);
      assert.ok(point.y >= 0 && point.y <= GAME_HEIGHT);
    }
  }
});

test('点点画只接受当前点，按顺序完成并支持回退重置', () => {
  const model = new DotDrawingModel(DOT_CARDS[0]);
  assert.equal(model.nextIndex, 0);
  assert.equal(model.visit({ x: -1, y: 0 }), false);
  assert.equal(model.visit(DOT_CARDS[0].points[1]), false);
  assert.equal(model.visit(DOT_CARDS[0].points[0]), true);
  assert.equal(model.segments.length, 0);
  assert.equal(model.visit(DOT_CARDS[0].points[1]), true);
  assert.deepEqual(model.segments, [{ from: DOT_CARDS[0].points[0], to: DOT_CARDS[0].points[1] }]);
  assert.equal(model.undo(), true);
  assert.equal(model.nextIndex, 1);
  assert.equal(model.reset(), true);
  assert.equal(model.nextIndex, 0);
  assert.equal(model.complete, false);
});

test('点点画高速直线采样会按路径参数顺序补齐多个点，不会反向跳点', () => {
  const card = { id: 'line', title: '直线', icon: '—', points: [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 300, y: 100 }] };
  const model = new DotDrawingModel(card);
  assert.equal(model.trace({ x: 0, y: 100 }, { x: 320, y: 100 }, 20), 3);
  assert.equal(model.complete, true);
  const reverse = new DotDrawingModel(card);
  assert.equal(reverse.trace({ x: 320, y: 100 }, { x: 0, y: 100 }, 20), 0);
  assert.equal(reverse.nextIndex, 0);
});

test('点点画键盘确认只前进一个点且完成后不越界', () => {
  const model = new DotDrawingModel(DOT_CARDS[0]);
  assert.equal(model.acceptNext(), true);
  while (!model.complete) model.acceptNext();
  assert.equal(model.acceptNext(), false);
  assert.equal(model.nextIndex, DOT_CARDS[0].points.length);
});

test('所有迷宫关卡尺寸受限且存在从起点到终点的解', () => {
  assert.equal(MAZE_CARDS.length, 6);
  for (const card of MAZE_CARDS) {
    const maze = createMaze(card);
    assert.equal(maze.columns, card.columns);
    assert.equal(maze.rows, card.rows);
    assert.equal(maze.cells.length, card.rows);
    assert.equal(maze.cells[0].length, card.columns);
    const solution = mazeSolution(maze);
    assert.deepEqual(solution[0], maze.start);
    assert.deepEqual(solution.at(-1), maze.goal);
    assert.ok(solution.length <= card.columns * card.rows);
    assert.ok(solution.length > 1);
  }
});

test('迷宫只允许四方向无墙移动，不能穿墙或斜穿，也不能跳格', () => {
  const maze = createMaze(MAZE_CARDS[0]);
  const model = new MazeDrawingModel(MAZE_CARDS[0], maze);
  const start = maze.start;
  assert.equal(model.move({ x: start.x + 1, y: start.y + 1 }), false);
  assert.deepEqual(model.path, [start]);
  const blocked = Object.entries(maze.cells[start.y][start.x].walls).find(([, value]) => value);
  assert.ok(blocked);
  const [side] = blocked;
  const delta = { top: [0, -1], right: [1, 0], bottom: [0, 1], left: [-1, 0] }[side];
  const blockedCell = { x: start.x + delta[0], y: start.y + delta[1] };
  if (blockedCell.x >= 0 && blockedCell.x < maze.columns && blockedCell.y >= 0 && blockedCell.y < maze.rows) {
    assert.equal(model.move(blockedCell), false);
    assert.deepEqual(model.path, [start]);
  }
  assert.equal(model.trace(start, { x: start.x + 2, y: start.y }), false);
});

test('迷宫解可以完成，原路回退、undo 与 reset 保持路径有界', () => {
  const maze = createMaze(MAZE_CARDS[2]);
  const model = new MazeDrawingModel(MAZE_CARDS[2], maze);
  const solution = mazeSolution(maze);
  for (const cell of solution.slice(1)) assert.equal(model.move(cell), true);
  assert.equal(model.complete, true);
  assert.equal(model.move(solution.at(-2)), true);
  assert.equal(model.complete, false);
  assert.equal(model.undo(), true);
  assert.equal(model.path.length, solution.length - 2);
  assert.equal(model.reset(), true);
  assert.deepEqual(model.path, [maze.start]);
  assert.equal(model.move({ x: NaN, y: 0 }), false);
});

test('迷宫 trace 只在同一直线且每格畅通时补齐，拒绝对角线和穿墙路径', () => {
  const card = MAZE_CARDS[0];
  const maze = createMaze(card);
  const model = new MazeDrawingModel(card, maze);
  const solution = mazeSolution(maze);
  const a = solution[0];
  const b = solution[1];
  assert.equal(model.trace(a, b), true);
  assert.equal(model.trace(b, { x: b.x + 1, y: b.y + 1 }), false);
  assert.equal(model.path.length, 2);
});

test('每张点点画和迷宫卡都能沿合法路径完成', () => {
  for (const card of DOT_CARDS) {
    const model = new DotDrawingModel(card);
    assert.equal(model.visit(card.points[0]), true);
    for (let index = 1; index < card.points.length; index++) assert.equal(model.visit(card.points[index]), true);
    assert.equal(model.complete, true);
  }
  for (const card of MAZE_CARDS) {
    const maze = createMaze(card);
    const model = new MazeDrawingModel(card, maze);
    for (const cell of mazeSolution(maze).slice(1)) assert.equal(model.move(cell), true);
    assert.equal(model.complete, true);
  }
});
