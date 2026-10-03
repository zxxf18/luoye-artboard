import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COLLAGE_MAX_POINTS,
  COLLAGE_MAX_PIECES,
  COLLAGE_HISTORY_LIMIT,
  COLLAGE_PAPERS,
  COLLAGE_PATTERNS,
  COLLAGE_TEMPLATES,
  CollageEditorModel,
  collageBounds,
  collagePathIsClosed,
  collagePointInsidePolygon,
  createCollageFreeCut,
  createCollageTemplate,
  normalizeCollagePaperId,
  normalizeCollagePoints,
} from '../src/collage-editor.js';

test('彩纸只保存轻量颜色和纹理参数，未知输入回到安全默认值', () => {
  assert.ok(COLLAGE_PAPERS.length >= 6);
  assert.ok(COLLAGE_PATTERNS.some(pattern => pattern.id === 'dots'));
  assert.equal(normalizeCollagePaperId('unknown'), 'sun');
  for (const paper of COLLAGE_PAPERS) {
    assert.match(paper.fill, /^#[0-9a-f]{6}$/i);
    assert.match(paper.accent, /^#[0-9a-f]{6}$/i);
    assert.ok(COLLAGE_PATTERNS.some(pattern => pattern.id === paper.pattern));
  }
});

test('模板剪切输出闭合、归一化路径，并保留可渲染尺寸', () => {
  for (const definition of COLLAGE_TEMPLATES) {
    const cut = createCollageTemplate(definition.id, { width: 180, height: 140, padding: 8 });
    assert.equal(cut.template, definition.id);
    assert.equal(cut.width, 180);
    assert.equal(cut.height, 140);
    assert.ok(cut.points.length >= 3);
    assert.ok(Math.hypot(cut.points[0].x - cut.points.at(-1).x, cut.points[0].y - cut.points.at(-1).y) < 1e-9);
    assert.ok(cut.points.every(point => point.x >= 0 && point.x <= 180 && point.y >= 0 && point.y <= 140));
  }
});

test('自由剪要求闭合轮廓，并把密集手绘路径限制在手机也能处理的点数内', () => {
  const open = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }];
  assert.equal(collagePathIsClosed(open), false);
  assert.throws(() => createCollageFreeCut(open), /围成一个圈/);

  const points = [];
  for (let index = 0; index <= 300; index++) {
    const angle = Math.PI * 2 * index / 300;
    points.push({ x: 100 + Math.cos(angle) * 70, y: 100 + Math.sin(angle) * 45 });
  }
  const cut = createCollageFreeCut(points);
  assert.equal(cut.template, 'free');
  assert.ok(cut.points.length <= COLLAGE_MAX_POINTS);
  assert.ok(Math.hypot(cut.points[0].x - cut.points.at(-1).x, cut.points[0].y - cut.points.at(-1).y) < 1e-9);
  assert.ok(cut.points.every(point => point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1));
});

test('归一化路径和点在多边形判断可以处理边界和重复点', () => {
  const raw = [{ x: 10, y: 20 }, { x: 90, y: 20 }, { x: 90, y: 80 }, { x: 10, y: 80 }, { x: 10, y: 20 }];
  const normalized = normalizeCollagePoints(raw, { close: true });
  assert.deepEqual(collageBounds(normalized), { x: 10, y: 20, width: 80, height: 60, left: 10, right: 90, top: 20, bottom: 80 });
  assert.equal(collagePointInsidePolygon({ x: .5, y: .5 }, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]), true);
  assert.equal(collagePointInsidePolygon({ x: 1.5, y: .5 }, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]), false);
});

test('模型支持多块彩纸、选中、移动旋转缩放和撤销重做', () => {
  const model = new CollageEditorModel({ width: 640, height: 480 });
  const first = model.cutTemplate('star', { paperId: 'sky', pattern: 'waves', x: 180, y: 160, width: 120, height: 100 });
  const second = model.cutTemplate('heart', { paperId: 'berry', x: 380, y: 270, width: 100, height: 100 });
  assert.equal(model.pieces.length, 2);
  assert.equal(model.selectedId, second.id);
  assert.equal(model.hitTest(380, 270).id, second.id);
  model.select(first.id);
  const before = model.selected();
  model.move(20, -10);
  model.rotate(15);
  model.scale(1.25);
  assert.equal(model.selected().x, before.x + 20);
  assert.equal(model.selected().rotation, 15);
  assert.equal(model.selected().scale, 1.25);
  assert.equal(model.undo(), true);
  assert.equal(model.selected().scale, 1);
  assert.equal(model.redo(), true);
  assert.equal(model.selected().scale, 1.25);
  assert.equal(model.remove(), true);
  assert.equal(model.pieces.length, 1);
  assert.equal(model.undo(), true);
  assert.equal(model.pieces.length, 2);
  assert.equal(model.toJSON().pieces.length, 2);
});

test('自由剪可以直接进入模型，并且主画板中的位置独立于切纸尺寸', () => {
  const model = new CollageEditorModel({ width: 512 });
  const cut = model.cutFree([{ x: 10, y: 10 }, { x: 100, y: 10 }, { x: 90, y: 90 }, { x: 10, y: 10 }], { paperId: 'leaf', width: 220, height: 180 });
  assert.equal(cut.template, 'free');
  assert.equal(cut.paperId, 'leaf');
  assert.equal(cut.width, 220);
  assert.equal(cut.height, 180);
  assert.equal(cut.x, 256);
  assert.equal(cut.y, 256);
  model.move(40, 15);
  assert.equal(model.selected().x, 296);
  assert.equal(model.selected().y, 271);
});

test('模型限制彩纸片数量，避免长时间编辑后无限增长', () => {
  const model = new CollageEditorModel({ width: 256 });
  assert.ok(COLLAGE_MAX_PIECES >= 200);
  for (let index = 0; index < COLLAGE_MAX_PIECES; index++) model.cutTemplate('circle');
  assert.throws(() => model.cutTemplate('circle'), /最多先放/);
});

test('形状模板覆盖儿童常见图形，并且每个轮廓都能直接剪下', () => {
  assert.ok(COLLAGE_TEMPLATES.length >= 20);
  assert.ok(COLLAGE_TEMPLATES.length <= 24);
  const ids = new Set();
  for (const definition of COLLAGE_TEMPLATES) {
    assert.equal(ids.has(definition.id), false);
    ids.add(definition.id);
    const cut = createCollageTemplate(definition.id, { width: 96, height: 84 });
    assert.equal(cut.points[0].x, cut.points.at(-1).x);
    assert.equal(cut.points[0].y, cut.points.at(-1).y);
    assert.ok(cut.points.length >= 4);
  }
  for (const id of ['flower', 'sun', 'moon', 'fish', 'butterfly', 'rocket', 'rainbow']) assert.ok(ids.has(id), id);
});

test('彩纸和纹理切换不写入作品撤销历史', () => {
  const model = new CollageEditorModel();
  model.cutTemplate('circle');
  const historyLength = model.history.length;
  const futureLength = model.future.length;
  model.setPaper('sky');
  model.setPattern('waves');
  assert.equal(model.history.length, historyLength);
  assert.equal(model.future.length, futureLength);
  assert.equal(model.paperId, 'sky');
  assert.equal(model.pattern, 'waves');
});

test('拖动使用单次事务，连续更新只保留一个撤销点，取消不留下位置变化', () => {
  const model = new CollageEditorModel({ width: 400 });
  const piece = model.cutTemplate('heart', { x: 100, y: 120 });
  const historyLength = model.history.length;
  assert.equal(model.beginTransform(piece.id), true);
  model.updateTransform({ x: 118, y: 138 });
  model.updateTransform({ x: 146, y: 160 });
  assert.deepEqual({ x: model.selected().x, y: model.selected().y }, { x: 146, y: 160 });
  assert.equal(model.history.length, historyLength);
  assert.equal(model.endTransform(), true);
  assert.equal(model.history.length, historyLength + 1);
  assert.equal(model.undo(), true);
  assert.deepEqual({ x: model.selected().x, y: model.selected().y }, { x: 100, y: 120 });

  assert.equal(model.beginTransform(piece.id), true);
  model.updateTransform({ x: 300, y: 320 });
  assert.equal(model.cancelTransform(), true);
  assert.deepEqual({ x: model.selected().x, y: model.selected().y }, { x: 100, y: 120 });
  assert.equal(model.history.length, historyLength);
});

test('历史快照共享不可变路径，200块彩纸和多次撤销不会复制路径数组', () => {
  const model = new CollageEditorModel({ width: 256 });
  for (let index = 0; index < 200; index++) model.cutTemplate(index % 2 ? 'star' : 'heart');
  assert.equal(model.pieces.length, 200);
  assert.equal(model.history.length, COLLAGE_HISTORY_LIMIT);
  const firstPath = model.pieces[0].path;
  const snapshots = model.history.filter(state => state.pieces.length);
  assert.ok(snapshots.length > 1);
  assert.ok(snapshots.every(state => state.pieces[0].path === firstPath));
  assert.ok(snapshots.every(state => Object.isFrozen(state.pieces)));
  assert.ok(Object.isFrozen(model.pieces[0]));
  assert.ok(Object.isFrozen(firstPath));
  for (let index = 0; index < 20; index++) assert.equal(model.undo(), true);
  assert.equal(model.pieces.length, 180);
});

test('自由剪拒绝退化闭合线，并将任意超长输入限制在点数上限内', () => {
  const collinear = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 0 }];
  assert.equal(collagePathIsClosed(collinear), false);
  assert.throws(() => createCollageFreeCut(collinear), /围成一个圈/);

  const points = [];
  for (let index = 0; index <= 10000; index++) {
    const angle = Math.PI * 2 * index / 10000;
    points.push({ x: 80 + Math.cos(angle) * 60, y: 90 + Math.sin(angle) * 44 });
  }
  const cut = createCollageFreeCut(points);
  assert.ok(cut.points.length <= COLLAGE_MAX_POINTS);
});

test('命中测试先做边界过滤，仍能命中旋转后的形状且不误命中远处点', () => {
  const model = new CollageEditorModel({ width: 512 });
  const piece = model.cutTemplate('star', { x: 260, y: 260, width: 120, height: 100, rotation: 32 });
  assert.equal(model.hitTest(260, 260)?.id, piece.id);
  assert.equal(model.hitTest(20, 20), null);
});
