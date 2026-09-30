import test from 'node:test';
import assert from 'node:assert/strict';
import { floodFill, closedFloodFill, fitInside, toLayerPoint, validateProject, History } from '../src/core.js';

test('fit preserves aspect ratio inside a 2K canvas', () => {
  assert.deepEqual(fitInside(600, 450, 2560, 1440), { width: 1920, height: 1440 });
});

test('pointer coordinates invert scaled and rotated layer transforms', () => {
  const p = toLayerPoint({ x: 100, y: 120 }, { x: 100, y: 100, scale: 2, rotation: 90, width: 30, height: 40 });
  assert.ok(Math.abs(p.x - 25) < 0.001);
  assert.ok(Math.abs(p.y - 20) < 0.001);
});

test('pointer coordinates invert mirrored layer transforms', () => {
  const p = toLayerPoint({ x: 110, y: 90 }, { x: 100, y: 100, scale: 2, rotation: 0, flipX: true, flipY: true, width: 30, height: 40 });
  assert.ok(Math.abs(p.x - 10) < 0.001);
  assert.ok(Math.abs(p.y - 25) < 0.001);
});

test('fill stops at opaque borders and counts changed pixels', () => {
  const data = new Uint8ClampedArray(5 * 5 * 4).fill(255);
  for (let y = 0; y < 5; y++) data.set([0, 0, 0, 255], (y * 5 + 2) * 4);
  const result = floodFill(data, 5, 5, 0, 2, [255, 0, 0, 255], 0);
  assert.equal(result.count, 10);
  assert.deepEqual([...data.slice((2 * 5 + 4) * 4, (2 * 5 + 4) * 4 + 4)], [255, 255, 255, 255]);
});

test('fill outside canvas is a no-op; same color never loops', () => {
  const data = new Uint8ClampedArray(16).fill(255);
  assert.equal(floodFill(data, 2, 2, -1, 0, [0, 0, 0, 255], 0).count, 0);
  assert.equal(floodFill(data, 2, 2, 0, 0, [255, 255, 255, 255], 0).count, 0);
});

test('closed fill bridges a small line gap without touching the outside', () => {
  const width = 9, height = 9, data = new Uint8ClampedArray(width * height * 4).fill(255);
  const pixel = (x, y, rgba) => data.set(rgba, (y * width + x) * 4);
  for (let x = 1; x < 8; x++) { pixel(x, 1, [0, 0, 0, 255]); pixel(x, 7, [0, 0, 0, 255]); }
  for (let y = 1; y < 8; y++) { pixel(1, y, [0, 0, 0, 255]); pixel(7, y, [0, 0, 0, 255]); }
  pixel(4, 1, [255, 255, 255, 255]); // one-pixel opening in the top edge
  const result = closedFloodFill(data, width, height, 4, 4, [255, 0, 0, 255], 0, { maxGap: 2 });
  assert.ok(result.count > 0);
  assert.deepEqual([...data.slice((4 * width + 4) * 4, (4 * width + 4) * 4 + 4)], [255, 0, 0, 255]);
  assert.deepEqual([...data.slice((1 * width + 4) * 4, (1 * width + 4) * 4 + 4)], [255, 255, 255, 255]);
  assert.deepEqual([...data.slice(4 * 4, 4 * 4 + 4)], [255, 255, 255, 255]);
});

test('closed fill aborts when the opening is too large and reaches the edge', () => {
  const width = 9, height = 9, data = new Uint8ClampedArray(width * height * 4).fill(255);
  const pixel = (x, y, rgba) => data.set(rgba, (y * width + x) * 4);
  for (let x = 1; x < 8; x++) { pixel(x, 1, [0, 0, 0, 255]); pixel(x, 7, [0, 0, 0, 255]); }
  for (let y = 1; y < 8; y++) { pixel(1, y, [0, 0, 0, 255]); pixel(7, y, [0, 0, 0, 255]); }
  for (let x = 2; x < 7; x++) pixel(x, 1, [255, 255, 255, 255]); // opening wider than maxGap
  const before = data.slice();
  const result = closedFloodFill(data, width, height, 4, 4, [255, 0, 0, 255], 0, { maxGap: 2 });
  assert.equal(result.count, 0);
  assert.equal(result.open, true);
  assert.deepEqual(data, before);
});

test('history clears redo after a new edit and retains a bounded history', () => {
  let n = 0;
  const history = new History(20);
  const add = () => { n++; history.push({ bytes: 10, undo: () => n--, redo: () => n++ }); };
  add(); add(); add();
  assert.equal(history.past.length, 2);
  history.undo(); assert.equal(n, 2);
  add(); assert.equal(history.future.length, 0);
  history.undo(); history.redo(); assert.equal(n, 3);
});

test('project validation rejects oversized, remote, duplicate and nonfinite layers', () => {
  const layer = { id: 'a', name: 'Layer', width: 1, height: 1, x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS5kAAAAASUVORK5CYII=' };
  const project = { format: 'luoye-studio', version: 1, width: 1920, height: 1080, title: '画画', layers: [layer] };
  assert.doesNotThrow(() => validateProject(project));
  const older={...project,format:'previous-studio'};
  assert.equal(validateProject(older).format,'luoye-studio');
  assert.equal(older.format,'previous-studio');
  assert.throws(()=>validateProject({...older,width:99999}));
  assert.throws(() => validateProject({ ...project, width: 99999 }));
  assert.throws(() => validateProject({ ...project, layers: [layer, layer] }));
  assert.throws(() => validateProject({ ...project, layers: [{ ...layer, image: 'https://example.com/a.png' }] }));
  assert.throws(() => validateProject({ ...project, layers: [{ ...layer, scale: Infinity }] }));
  assert.throws(() => validateProject({ ...project, version: 99 }));
  assert.throws(() => validateProject({ ...project, layers: [{ ...layer, width: 2 }] }));
});

test('animated fairy projects reject missing groups, bad positions and remote frames', () => {
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS5kAAAAASUVORK5CYII=';
 const layer={id:'a',name:'花朵',width:1,height:1,x:0,y:0,scale:1,rotation:0,opacity:1,visible:true,image,sprites:[{group:0,x:0,y:0,size:16,opacity:1}],spriteGroups:[{frameDuration:160,frames:[{width:1,height:1,image}]}]};
 const project={format:'luoye-studio',version:1,width:1,height:1,title:'花朵',layers:[layer]};
 assert.doesNotThrow(()=>validateProject(project));
 for(const change of [{spriteGroups:[]},{sprites:[{...layer.sprites[0],group:-1}]},{sprites:[{...layer.sprites[0],x:Infinity}]},{spriteGroups:[{frameDuration:160,frames:[{width:1,height:1,image:'https://example.com/a.png'}]}]}])assert.throws(()=>validateProject({...project,layers:[{...layer,...change}]}));
});
