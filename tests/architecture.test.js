import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { documentHeader, normalizeDocument, PROJECT_VERSION, SCHEMA_VERSIONS } from '../src/core/document.js';
import { validateProject, openDocument } from '../src/core/core.js';
import { toUnifiedPointer, pointerPressure, normalizePointerType } from '../src/core/pointer.js';
import { OperationLog, nextOperationId, operationTypeForTool, validOperation, OPERATION_TYPES } from '../src/core/operations.js';
import { createToolRegistry, ToolRegistry, validateTool, BUILTIN_TOOLS } from '../src/core/tool-registry.js';
import { CLASSIC_TOOLS } from '../src/ui/classic-ui.js';

const root = path.join(fileURLToPath(new URL('../', import.meta.url)));
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS5kAAAAASUVORK5CYII=';
const layer = { id: 'a', name: 'Layer', width: 1, height: 1, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, image: png };
const v1 = { format: 'luoye-studio', version: 1, width: 1, height: 1, title: '花朵', layers: [layer] };

test('layer boundaries: core depends on neither ui nor platform, ui never imports platform', async () => {
  const js = async dir => (await readdir(path.join(root, 'src', dir))).filter(name => name.endsWith('.js'));
  for (const name of await js('core')) {
    const text = await readFile(path.join(root, 'src', 'core', name), 'utf8');
    assert.doesNotMatch(text, /from '\.\.\/(ui|platform)\//, `src/core/${name} must stay UI- and platform-free`);
  }
  for (const name of await js('ui')) {
    const text = await readFile(path.join(root, 'src', 'ui', name), 'utf8');
    assert.doesNotMatch(text, /from '\.\.\/platform\//, `src/ui/${name} must not reach into the platform layer`);
  }
});

test('v3 documents carry the schema map and a consistent canvas index', () => {
  const header = documentHeader(1920, 1080);
  assert.equal(header.format, 'luoye-studio');
  assert.equal(header.version, PROJECT_VERSION);
  assert.deepEqual(header.schema, SCHEMA_VERSIONS);
  assert.deepEqual(header.canvas, { width: 1920, height: 1080, background: '#ffffff' });
  const doc = { ...header, title: '画画', width: 1920, height: 1080, layers: [layer], operations: [] };
  assert.equal(validateProject(doc).version, 3);
  assert.throws(() => validateProject({ ...doc, canvas: { width: 2, height: 1080 } }), /画布索引/);
  assert.throws(() => validateProject({ ...doc, schema: { ...SCHEMA_VERSIONS, layers: 2 } }), /结构版本/);
  assert.throws(() => validateProject({ ...doc, operations: [{ id: 'x', type: 'nope' }] }), /操作记录/);
  assert.throws(() => validateProject({ ...doc, version: 4 }), /版本过新/);
});

test('only the current model level lives inside the app; v1/v2 upgrade at the open boundary', () => {
  // validateProject is write-side self-check: it accepts exactly one level.
  assert.throws(() => validateProject(v1), /版本过新/);
  const normalized = openDocument(v1);
  assert.equal(normalized.version, PROJECT_VERSION);
  assert.deepEqual(normalized.canvas, { width: 1, height: 1, background: '#ffffff' });
  assert.deepEqual(normalized.operations, []);
  assert.equal(normalized.layers.length, 1);
  const v2 = { ...v1, version: 2, layers: [{ ...layer, eraseMask: png }] };
  const normalized2 = openDocument(v2);
  assert.equal(normalized2.version, PROJECT_VERSION);
  // A drifted canvas index yields to the top-level size on read.
  const drifted = normalizeDocument({ ...v1, canvas: { width: 9, height: 9 } });
  assert.equal(drifted.canvas.width, 1);
  assert.throws(() => normalizeDocument({ format: 'other-app', version: 3 }), /不是落叶画板工程/);
});

test('mouse, touch and stylus events normalize into one pointer model', () => {
  const mapper = event => ({ x: event.clientX * 2, y: event.clientY * 2 });
  const mouse = toUnifiedPointer({ pointerType: 'mouse', pointerId: 1, clientX: 10, clientY: 5, buttons: 1, isPrimary: true }, mapper, 'down', 123);
  assert.deepEqual([mouse.phase, mouse.pointerType, mouse.x, mouse.y, mouse.pressure, mouse.primary, mouse.timestamp], ['down', 'mouse', 20, 10, 0.5, true, 123]);
  const pencil = toUnifiedPointer({ pointerType: 'pen', pointerId: 3, clientX: 1, clientY: 2, pressure: 0.75, tiltX: -12, tiltY: 6, twist: 30, buttons: 1 }, mapper, 'move', 124);
  assert.equal(pencil.pressure, 0.75);
  assert.deepEqual([pencil.tiltX, pencil.tiltY, pencil.twist], [-12, 6, 30]);
  const touch = toUnifiedPointer({ pointerType: 'touch', pointerId: 2, clientX: 0, clientY: 0, buttons: 0, touches: [{}] }, mapper, 'up', 125);
  assert.equal(touch.pressure, 0.5);
  assert.equal(pointerPressure({ pointerType: 'pen', pressure: 0, buttons: 1 }), 0.5);
  assert.equal(pointerPressure({ pointerType: 'pen', pressure: 0.8 }), 0.8);
  assert.equal(normalizePointerType({ pointerType: undefined, touches: [] }), 'touch');
  assert.equal(normalizePointerType({ pointerType: undefined }), 'mouse');
  // Mouse hovering reports pressure 0 and no buttons.
  assert.equal(pointerPressure({ pointerType: 'mouse', pressure: 0, buttons: 0 }), 0);
});

test('operation log records finished actions with bounded, validated entries', () => {
  const log = new OperationLog(3);
  for (let i = 0; i < 5; i++) log.record({ id: nextOperationId(), type: 'stroke', toolId: 'pen', payload: { size: 12 }, timestamp: i });
  assert.equal(log.size, 3);
  assert.deepEqual(log.snapshot().map(entry => entry.timestamp), [2, 3, 4]);
  // A missing id is generated; a bad type is dropped, never thrown.
  assert.ok(log.record({ type: 'stroke' }).id.length > 0);
  assert.equal(log.record({ id: 'x', type: 'not-a-type' }), null);
  assert.equal(log.adopt([{ id: 'a', type: 'fill', timestamp: 1 }, { id: 'b', type: 'bogus' }, null]), 1);
  assert.equal(log.snapshot()[0].id, 'a');
  assert.ok(OPERATION_TYPES.includes(operationTypeForTool('pen')));
  assert.equal(operationTypeForTool('eraser'), 'erase');
  assert.equal(operationTypeForTool('rect'), 'shape');
  assert.equal(operationTypeForTool('board-filter'), 'filter');
  assert.equal(operationTypeForTool('warp'), 'other');
  const probe=new OperationLog();probe.record({id:'a',type:'stroke'});assert.equal(validOperation(probe.snapshot()[0]),true);
});

test('the classic shelf tools are fully described by the core registry', () => {
  const registry = createToolRegistry();
  for (const [id] of CLASSIC_TOOLS) {
    const tool = registry.get(id);
    assert.ok(tool, `工具 ${id} 需要在核心注册表中登记`);
    assert.equal(typeof tool.supports.continuous, 'boolean');
  }
  // Variant tools resolve through their parent entry.
  assert.equal(registry.get('polygon').variantOf, 'line');
  assert.equal(registry.get('bezier').variantOf, 'line');
  assert.throws(() => registry.register({ id: 'pen', kind: 'brush' }), /已注册/);
  assert.throws(() => validateTool({ id: 'Bad Id', kind: 'brush' }), /id/);
  assert.throws(() => validateTool({ id: 'ok', kind: 'nope' }), /类型/);
  assert.throws(() => validateTool({ id: 'ok', kind: 'brush', begin: 3 }), /begin/);
  assert.equal(new ToolRegistry().list().length, 0);
  assert.equal(BUILTIN_TOOLS.length >= CLASSIC_TOOLS.length, true);
});
