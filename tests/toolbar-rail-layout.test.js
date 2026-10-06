import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFile(path.join(root, name), 'utf8');

function toolEntries(source) {
  const match = source.match(/const\s+toolPages\s*=\s*\[([\s\S]*?)\n\s*\];/);
  assert(match, '工具目录没有集中定义');
  const pages = [...match[1].matchAll(/\[\[(.*?)\]\]/gs)].map(([, page]) => {
    const values = [...page.matchAll(/'([^']*)'/g)].map(([, value]) => value);
    return Array.from({ length: Math.floor(values.length / 2) }, (_, index) => ({ id: values[index * 2], label: values[index * 2 + 1] }));
  });
  assert(pages.length >= 2, '工具目录至少需要常用页和进阶页');
  return { pages, entries: pages.flat() };
}

function mobileEntries(source) {
  const match = source.match(/const mobileItems=\[(.*?)\];/s);
  assert(match, '小屏工具入口没有集中定义');
  return [...match[1].matchAll(/\['([^']+)'\s*,\s*'([^']+)'\s*,\s*'([^']+)'\]/g)]
    .map(([, panel, label, target]) => ({ panel, label, target }));
}

test('右侧工具架按常用工具与进阶工具稳定分组', async () => {
  const source = await read('src/classic-ui.js');
  const { pages, entries } = toolEntries(source);
  const ids = entries.map(entry => entry.id);
  assert.equal(new Set(ids).size, ids.length, '工具目录存在重复入口');
  assert.deepEqual(pages[0].map(entry => entry.id), [
    'pen', 'eraser', 'line', 'fill', 'text', 'stamp', 'scratch', 'picker',
  ], '第一页应优先放置儿童最常用工具');
  assert.ok(ids.length > 8, '第二页没有进阶工具');
  assert.ok(pages[1].some(entry => entry.id === 'select'), '进阶页缺少圈选工具');
  assert.ok(pages[1].some(entry => entry.id === 'board-filter'), '进阶页缺少滤镜工具');
  assert.deepEqual(pages[1].slice(-3).map(entry => entry.id), ['pixel-art', 'animation', 'collage'], '创作工具没有移到第二页末尾');
  assert.match(source, /const\s+toolPageCount\s*=\s*toolPages\.length/, '分页数量没有从目录派生');
  assert.match(source, /page=\(page\+1\)%toolPageCount/, '工具翻页没有循环到下一页');
  assert.match(source, /\$\{page\+1\}\s*\/\s*\$\{toolPageCount\}/, '工具分页缺少动态页码文案');
  assert.match(source, /const visible=toolPages\[page\]\|\|toolPages\[0\]/, '紧凑布局没有保留工具第二页');
});

test('小屏工具抽屉入口顺序和 aria 目标保持一致', async () => {
  const source = await read('src/classic-ui.js');
  const entries = mobileEntries(source);
  assert.deepEqual(entries.map(entry => entry.panel), ['brushes', 'tools', 'options', 'library'], '小屏入口应按画笔、工具、参数、素材排列');
  assert.deepEqual(entries.map(entry => entry.target), ['classic-left', 'tool-rail', 'tool-dock', 'tool-dock']);
  assert.match(source, /const focusButton=document\.createElement\('button'\)/, '小屏缺少返回画布入口');
  assert.match(source, /mobileButtons\.set\('focus',focusButton\)/, '返回画布入口没有 focus 面板标识');
  assert.match(source, /button\.setAttribute\('aria-controls',target\)/, '小屏入口没有关联抽屉 aria-controls');
  assert.match(source, /button\.setAttribute\('aria-expanded','false'\)/, '小屏抽屉入口缺少收起状态');
  assert.match(source, /focusButton\.setAttribute\('aria-expanded','true'\)/, '画布入口缺少默认展开状态');
});

test('顶部工具栏在窄窗口采用横向可达的折叠条', async () => {
  const [classic, styles] = await Promise.all([
    read('src/classic-ui.js'),
    read('public/playroom.css'),
  ]);
  assert.match(classic, /header\.prepend\(el\('new-quick'\),el\('undo'\),el\('redo'\)\)/, '新画纸、撤销、重做没有置于顶部快捷区前端');
  assert.match(classic, /const foldedToolbarIds\s*=\s*\[/, '顶部折叠操作没有集中定义');
  assert.match(classic, /const toolbarPrimaryIds\s*=\s*\[/, '顶部常用操作没有集中定义');
  assert.match(styles, /\.playroom \.header-actions\s*\{[^}]*overflow-x:auto/s, '顶部工具栏在窄窗口不可横向滚动');
  assert.match(styles, /\.playroom \.header-actions button\s*\{[^}]*flex:\s*0 0 auto/s, '顶部按钮会被压缩到不可点击');
  assert.match(styles, /@media\s*\(max-width:\s*860px\)\s*\{[\s\S]*?\.playroom \.header-actions/s, '缺少宽度紧凑断点');
  assert.match(styles, /@media\s*\(max-width:\s*640px\),\s*\(max-height:\s*500px\)\s*\{[\s\S]*?\.playroom \.app-header/s, '缺少矮窗口顶部栏断点');
  assert.match(styles, /\.playroom \.header-actions::-webkit-scrollbar\s*\{\s*display\s*:\s*none/s, '顶部横向滚动条没有隐藏');
});

test('工具架与抽屉保留明确的滚动边界，避免遮挡画布', async () => {
  const styles = await read('public/playroom.css');
  assert.match(styles, /\.playroom \.tool-rail #tools\s*\{[^}]*overflow-y:auto/s, '桌面工具架没有独立滚动边界');
  assert.match(styles, /\.playroom \.tool-rail\s*\{[^}]*min-height:0/s, '工具架无法在短窗口收缩');
  assert.match(styles, /\.playroom \.tool-page\s*\{[^}]*flex:none/s, '分页按钮会被工具列表挤压');
  assert.match(styles, /\.playroom\[data-mobile-panel="tools"\] \.tool-rail\s*\{[\s\S]*?position:\s*fixed/s, '小屏工具架没有独立抽屉层');
  assert.match(styles, /\.playroom\[data-mobile-panel="tools"\] \.tool-rail\s*\{[\s\S]*?width:\s*min\(320px,\s*calc\(100vw - 16px\)\)/s, '小屏工具架宽度未受视口限制');
  assert.match(styles, /\.playroom\[data-mobile-panel="tools"\] \.tool-rail #tools\s*\{[\s\S]*?overflow-y\s*:\s*auto/s, '小屏工具列表无法滚动到末项');
  assert.match(styles, /\.playroom\[data-mobile-panel="tools"\] \.mobile-scrim/s, '小屏工具抽屉缺少遮罩隔离');
});
