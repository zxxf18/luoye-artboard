import { PaintEngine, makeCanvas } from '/src/engine.js';
const list = document.querySelector('#results');
const engine = new PaintEngine(document.querySelector('#test-canvas'), () => {});
engine.reset(64, 64);
const results = [];
function assert(condition, message) { if (!condition) throw new Error(message); }
function pixel(canvas, x, y) { return [...canvas.getContext('2d').getImageData(x, y, 1, 1).data]; }
function equal(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
async function check(name, body) {
  try { await body(); results.push({ name, ok: true }); } catch (error) { results.push({ name, ok: false, error: error.message }); }
  const result = results.at(-1), item = document.createElement('li'); item.textContent = `${result.ok ? 'PASS' : 'FAIL'} ${name}${result.error ? ': ' + result.error : ''}`; list.append(item);
}
await check('笔迹、分块撤销与恢复得到正确像素', () => {
  engine.begin({ x: 10, y: 20 }, { tool:'pen', color:'#ff0000', size:8, opacity:1, brush:'pencil' });
  engine.update({ x:50, y:20 }); engine.end();
  assert(equal(pixel(engine.active.canvas, 30, 20), [255,0,0,255]), '没有红色笔迹');
  engine.undo(); assert(pixel(engine.active.canvas, 30,20)[3] === 0, '撤销未清除笔迹');
  engine.redo(); assert(pixel(engine.active.canvas, 30,20)[0] === 255, '恢复失败');
});
await check('取消笔触不会损坏原图或产生额外历史', () => {
  const before = engine.active.canvas.toDataURL(), count = engine.history.past.length;
  engine.begin({ x:20,y:40 }, { tool:'pen',color:'#000000',size:10,opacity:1,brush:'pencil' }); engine.end(true);
  assert(engine.active.canvas.toDataURL() === before, '取消后像素变化'); assert(engine.history.past.length === count, '取消后多了历史');
});
await check('橡皮只擦除当前层，撤销可恢复', () => {
  engine.begin({ x:30,y:20 }, { tool:'eraser',color:'#000000',size:16,opacity:1,brush:'pencil' }); engine.end();
  assert(pixel(engine.active.canvas,30,20)[3] === 0, '橡皮没有透明化'); engine.undo();
  assert(pixel(engine.active.canvas,30,20)[3] === 255, '橡皮撤销失败');
});
await check('独立图层增删、调序、显隐可以撤销', () => {
  const first = engine.active; const second = engine.addLayer('第二层');
  engine.reorder(-1); assert(engine.layers[0] === second, '图层未移动'); engine.undo();
  engine.setProperty(second, 'visible', false); engine.undo(); assert(second.visible, '显隐未恢复');
  engine.removeActive(); assert(engine.layers.length === 1, '删除失败'); engine.undo();
  assert(engine.layers.length === 2 && engine.layers[0] === first, '删除撤销顺序错误');
});
await check('项目保存重开保留像素、名称与变换', async () => {
  engine.activeId = engine.layers[0].id; engine.setProperty(engine.active, 'rotation', 15);
  engine.setProperty(engine.active, 'scale', 1.2);
  const data = await engine.serialize('中文作品'); const before = engine.layers[0].canvas.toDataURL();
  const name = await engine.restore(JSON.parse(JSON.stringify(data)));
  assert(name === '中文作品', '标题错误'); assert(engine.layers[0].rotation === 15 && engine.layers[0].scale === 1.2, '变换丢失');
  assert(engine.layers[0].canvas.toDataURL() === before, '重开改变像素');
});
await check('坏工程加载失败仍保留原有作品', async () => {
  const old = await engine.serialize('保存好的作品'); const bad = structuredClone(old);
  bad.layers[0].image = 'data:image/png;base64,AAAA'; let failed = false;
  try { await engine.restore(bad); } catch { failed = true; }
  assert(failed, '未拒绝损坏工程'); assert(JSON.stringify(await engine.serialize('保存好的作品')) === JSON.stringify(old), '原工程被替换');
});
await check('透明素材合成且工程内嵌资源', async () => {
  engine.reset(1920,1080);
  await engine.addAsset({ id:'role0-0',name:'陆地伙伴',src:'/assets/library-v16/sprites/role0-0.webp',category:'sticker' });
  assert(pixel(engine.active.canvas,0,0)[3] === 0, '角色角落不透明');
  const project = await engine.serialize('角色作品'); assert(project.layers[1].image.startsWith('data:image/png;base64,'), '资源未嵌入');
  await engine.restore(project); assert(engine.layers.length === 2, '重开层数错误');
});
await check('2K导出是真实2560×1440 PNG', async () => {
  engine.reset(2560,1440); const png = engine.exportPNG();
  const binary = atob(png.split(',')[1]), bytes = Uint8Array.from(binary.slice(0,24), c=>c.charCodeAt(0)), view = new DataView(bytes.buffer);
  assert(view.getUint32(16) === 2560 && view.getUint32(20) === 1440, '导出尺寸错误');
});
await check('动画帧、时长、变换随工程保存重开', async () => {
  const frames = ['/assets/motion-v162/sprites/animation-0-f0.webp','/assets/motion-v162/sprites/animation-0-f1.webp'];
  await engine.addAsset({ id:'animation-0',name:'动画测试',src:frames[0],frames,frameDuration:160,category:'animation' });
  const data = await engine.serialize('动画作品'); await engine.restore(data);
  assert(engine.active.frames.length === 2 && engine.active.frameDuration === 160, '动画状态丢失');
});
clearInterval(engine.animationTimer);
document.querySelector('#status').textContent = `${results.filter(r=>r.ok).length}/${results.length} passed`;
document.querySelector('#status').dataset.result = results.every(r=>r.ok) ? 'pass' : 'fail';
document.title = document.querySelector('#status').textContent;
