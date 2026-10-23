// Every shelf tool, one journey: select it, draw on the canvas, and prove the
// app still responds afterwards. Guards the "clicked once and everything
// froze" class of bugs at the tool level.
const frame = document.querySelector('iframe'), results = [];
const pause = ms => new Promise(r => setTimeout(r, ms));
function check(ok, name) { results.push({ name, passed: !!ok }); if (!ok) throw new Error(name); }
const TOOLS = [['pen','画笔'],['eraser','橡皮'],['stamp','魔法袋'],['fill','油漆桶'],['picker','吸颜色'],['line','图形'],['text','文字'],['select','圈选'],['magic','魔力棒'],['move','移动'],['warp','变形'],['board-filter','滤镜'],['clone','仿制印章'],['fractal','分形'],['scratch','刮刮画'],['animation','小动画'],['pixel','像素画']];
try {
  await new Promise(resolve => { frame.onload = resolve; frame.src = '/'; });
  const view = frame.contentWindow, doc = frame.contentDocument;
  view.addEventListener('error', e => { throw new Error('页面错误: ' + e.message); });
  const canvas = doc.getElementById('painting');
  const rect = () => canvas.getBoundingClientRect();
  const pointer = (type, x, y) => canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'mouse', isPrimary: true, buttons: 1, clientX: x, clientY: y }));
  const selectTool = async id => {
    for (let flips = 0; !doc.querySelector(`.tool-button[data-tool="${id}"]`) && flips < 4; flips++) { doc.getElementById('tool-page').click(); await pause(30); }
    const button = doc.querySelector(`.tool-button[data-tool="${id}"]`);
    if (!button) throw new Error('找不到工具按钮: ' + id);
    button.click(); await pause(40);
  };
  check(doc.getElementById('tool-pager'), '翻页器已渲染');
  // 小动画和像素画按钮直接打开各自的编辑器，不切换当前绘画工具。
  const EDITOR_TOOLS = { animation: 'animation-editor-dialog', pixel: 'pixel-art-dialog' };
  for (const [id] of TOOLS) {
    await selectTool(id);
    if (EDITOR_TOOLS[id]) check(doc.querySelector(`dialog#${EDITOR_TOOLS[id]}[open]`), `选中 ${id} 后编辑器已打开`);
    else check(doc.getElementById('painting').dataset.tool === id, `选中 ${id} 后工具状态正确 (实际 ${doc.getElementById('painting').dataset.tool})`);
    // A short press-drag-release like a child scribbling.
    const box = rect();
    const x = box.left + box.width * .5, y = box.top + box.height * .5;
    pointer('pointerdown', x, y); pointer('pointermove', x + 30, y + 20); pointer('pointermove', x + 60, y - 10); pointer('pointerup', x + 60, y - 10);
    await pause(40);
    // Editors open dialogs by design; close them so the next tool can act.
    const open = doc.querySelector('dialog[open]');
    if (open) { open.close(); await pause(30); }
    check(!doc.querySelector('dialog[open]'), `${id} 之后没有未关闭的对话框`);
  }
  // After touring every tool the UI must still switch tools and open a dialog.
  await selectTool('pen');
  check(doc.getElementById('painting').dataset.tool === 'pen', '全部工具走完后仍能切换工具');
  doc.getElementById('foreground-palette').click(); await pause(40);
  check(!!doc.querySelector('#palette-dialog[open]'), '调色板仍能打开');
  doc.getElementById('palette-cancel').click(); await pause(30);
  check(!doc.querySelector('dialog[open]'), '调色板可以关闭');
} catch (error) { results.push({ name: error.message, passed: false }); }
document.body.dataset.results = JSON.stringify(results);
document.getElementById('summary').textContent = results.every(r => r.passed) ? `${results.length} 项全部通过` : '检查失败';
document.getElementById('results').textContent = JSON.stringify(results, null, 2);
