import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = file => readFileSync(new URL(file, root), 'utf8');

test('渐变色文案与画笔入口保持一致', () => {
  assert.match(read('src/brushes.js'), /id:'duotone',name:'渐变色'/);
  assert.match(read('public/index.html'), /value="duotone">渐变色/);
});

test('对称方式直接展开四个按钮，不再使用下拉或全局选择弹窗', () => {
  const assist = read('src/assist-ui.js');
  assert.match(assist, /id="assist-mode-buttons"/);
  assert.match(assist, /data-assist-mode="vertical"/);
  assert.match(assist, /data-assist-mode="horizontal"/);
  assert.match(assist, /data-assist-mode="four"/);
  assert.match(assist, /data-assist-mode="radial"/);
  assert.match(assist, /对称轴数/);
  assert.doesNotMatch(assist, /<select[^>]+id="assist-mode"/);
  assert.doesNotMatch(assist, /assist-mode-choose/);
});

test('刮刮画面板将两种颜色上下排列并让粗细控件跨两行占右侧三分之一', () => {
  const classic = read('src/classic-ui.js') + read('src/classic-scratch.js');
  const shelf = read('public/tool-shelf.css');
  const surface = read('public/playroom.css');
  for (const label of ['我的刮刮画', '重新覆盖', '覆盖层颜色', '刮笔颜色', '粗细']) assert.match(classic, new RegExp(label));
  assert.match(`${shelf}\n${surface}`, /scratch-style-panel/);
  assert.match(`${shelf}\n${surface}`, /scratch-style-group/);
  assert.match(shelf, /\.scratch-style-panel\s*\{[\s\S]*grid-template-columns:\s*(?:minmax\(0,\s*)?2fr\)?\s+\s*(?:minmax\(0,\s*)?1fr\)?/);
  assert.match(shelf, /\.scratch-style-panel\s*\{[\s\S]*grid-template-rows:\s*repeat\(2/);
  assert.match(shelf, /\.scratch-color-grid\s*\{[\s\S]*grid-template-rows:\s*repeat\(2/);
  assert.match(shelf, /\.scratch-size-row\s*\{[\s\S]*grid-column:\s*2[\s\S]*grid-row:\s*1\s*\/\s*span\s*2/);
  assert.match(shelf, /\.scratch-size-row\s*#brush-options\s*\{[\s\S]*grid-column:\s*1[\s\S]*grid-row:\s*1/);
  assert.match(shelf, /\.scratch-size-row\s*#brush-options\s*>\s*label[\s\S]*font-weight:\s*700[\s\S]*color:\s*var\(--ink/);
});

test('刮刮画候选色直接写入色块背景，避免被主题控件色覆盖', () => {
  const classic = read('src/classic-scratch.js');
  assert.match(classic, /button\.style\.setProperty\('\-\-scratch-chip',background\)/);
  assert.match(classic, /button\.style\.background=background/);
  assert.match(classic, /linear-gradient\(135deg,#74a99e,#b7ded7\)/);
  assert.match(classic, /#cfe9f5/);
});

test('魔力棒公差左对齐并使用更大的可读控件', () => {
  const shelf = read('public/tool-shelf.css');
  assert.match(shelf, /data-classic-tool="magic"[^}]*label\[data-option="fill magic"\][\s\S]*justify-content:\s*flex-start/);
  assert.match(shelf, /data-classic-tool="magic"[^}]*label\[data-option="fill magic"\][\s\S]*font-size:\s*18px/);
  assert.match(shelf, /data-classic-tool="magic"[^}]*#tolerance[\s\S]*width:\s*112px/);
});

test('魔力棒公差卡片在桌面参数区占满两行', () => {
  const shelf = read('public/tool-shelf.css');
  assert.match(shelf, /data-classic-tool="magic"[^}]*classic-parameters\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(shelf, /data-classic-tool="magic"[^}]*classic-parameters\s*\{[\s\S]*grid-template-rows:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(shelf, /data-classic-tool="magic"[^}]*classic-parameters label\[data-option="fill magic"\]\s*\{[\s\S]*grid-column:\s*1[\s\S]*grid-row:\s*1\s*\/\s*span\s*2/);
});

test('仿制印章参数分两排且设置源点独占第二排', () => {
  const shelf = read('public/tool-shelf.css');
  assert.match(shelf, /data-classic-tool="clone"[^}]*classic-parameters[\s\S]*grid-template-columns:\s*repeat\(2/);
  assert.match(shelf, /data-classic-tool="clone"[^}]*#clone-source[\s\S]*grid-column:\s*1\s*\/\s*-1[\s\S]*grid-row:\s*2/);
  assert.match(shelf, /data-classic-tool="clone"[^}]*#clone-source[\s\S]*font-size:\s*17px/);
});

test('分形工具按钮不被遗留规则隐藏', () => {
  const styles = read('public/styles.css');
  assert.doesNotMatch(styles, /data-tool="fractal"[^}]*display:\s*none/);
  assert.doesNotMatch(styles, /\[data-option="fractal"\][^}]*display:\s*none/);
});

test('刮刮画复用公共参数栏高度，候选颜色保持圆形', () => {
  const classic = read('src/classic-ui.js');
  const shelf = read('public/tool-shelf.css');
  const surface = read('public/playroom.css');
  assert.doesNotMatch(classic, /dock\.style\.height='232px'/);
  assert.doesNotMatch(shelf, /tool-dock \{ height: 220px/);
  assert.match(surface, /scratch-style-chip,[^{]+scratch-style-custom\{[^}]*aspect-ratio:1[^}]*border-radius:50%/);
  assert.match(surface, /scratch-style-chip,[^{]+scratch-style-custom\{[^}]*width:20px[^}]*height:20px/);
});

test('刮刮画自选颜色复用我的颜色共享调色板', () => {
  const palette = read('src/palette-ui.js');
  const classic = read('src/classic-ui.js') + read('src/classic-scratch.js');
  assert.match(palette, /openCustom/);
  assert.match(classic, /mountPalette/);
  assert.match(classic, /palette\.openCustom/);
  assert.match(classic, /scratch-color-grid/);
  assert.match(classic, /scratch-size-row/);
  assert.doesNotMatch(classic, /input\.type='color'/);
});

test('刮刮画保留共享颜色栏并为专属参数提供卡片底色', () => {
  const classic = read('src/classic-ui.js');
  const shelf = read('public/tool-shelf.css');
  assert.match(classic, /scratchPanel\.hidden=tool!==\'scratch\';fractalPanel\.hidden=tool!==\'fractal\';palette\.hidden=false;moreColor\.hidden=false/);
  assert.match(shelf, /\.scratch-style-panel\s*\{[\s\S]*grid-template-columns:\s*(?:minmax\(0,\s*)?2fr\)?\s+\s*(?:minmax\(0,\s*)?1fr\)?/);
  assert.match(shelf, /\.scratch-style-panel\s*\{[\s\S]*border:\s*0/);
  assert.match(shelf, /\.scratch-style-panel\s*\{[\s\S]*background:\s*transparent/);
  assert.match(shelf, /\.scratch-style-group\s*\{[\s\S]*background:\s*var\(--theme-classic-control/);
  assert.match(shelf, /\.scratch-size-row\s*#brush-options\s*\{[\s\S]*background:\s*var\(--theme-classic-control/);
});

test('滤镜与变形的关键参数使用可读字号和触控底色', () => {
  const surface = read('public/playroom.css');
  assert.match(surface, /creative-options > label:has\(#warp-speed\)/);
  assert.match(surface, /creative-options > label:has\(#creative-radius\)/);
  assert.match(surface, /creative-options > label:has\(#warp-speed\)[\s\S]*font-size:\s*calc\(17px\s\*\s*var\(--u\)\)/);
  assert.match(surface, /#filter-preview-button,[\s\S]*#board-apply[\s\S]*font-size:\s*calc\(17px\s*\*\s*var\(--u\)\)/);
  assert.match(surface, /#filter-preview-button,[\s\S]*#board-apply[\s\S]*min-height:\s*54px/);
});

test('图形虚线文案保留原来的紧凑字号', () => {
  const shelf = read('public/tool-shelf.css');
  assert.match(shelf, /primary-brush-options label:has\(#shape-dashed\)\s*\{\s*font-size:\s*inherit[\s\S]*line-height:\s*inherit/);
});

test('文字与油漆桶不透明度及油漆桶参数统一为16px可读字号', () => {
  const shelf = read('public/tool-shelf.css');
  for (const selector of [
    'data-classic-tool="text"',
    'data-classic-tool="fill"',
  ]) assert.match(shelf, new RegExp(selector.replace(/["\\]/g, '\\$&')));
  assert.match(shelf, /data-classic-tool="text"[^}]*opacity-control[\s\S]*font-size:\s*calc\(16px\s*\*\s*var\(--u\)\)/);
  assert.match(shelf, /data-classic-tool="fill"[^}]*opacity-control[\s\S]*font-size:\s*calc\(16px\s*\*\s*var\(--u\)\)/);
  assert.match(shelf, /data-classic-tool="fill"[^}]*label:has\(#fill-gradient\)[\s\S]*font-size:\s*calc\(16px\s*\*\s*var\(--u\)\)/);
  assert.match(shelf, /data-classic-tool="fill"[^}]*label:has\(#tolerance\)[\s\S]*font-size:\s*calc\(16px\s*\*\s*var\(--u\)\)/);
});

test('魔法袋素材面板保留素材高度并压缩下方参数行', () => {
  const shelf = read('public/tool-shelf.css');
  assert.match(shelf, /data-library-surface="fairy"\]\s+\.categories\s*\{[^}]*display:\s*none\s*!important/);
  assert.match(shelf, /library-open\[data-classic-tool="stamp"\][\s\S]*tool-dock\s*\{[\s\S]*height:\s*clamp\(164px,\s*17dvh,\s*190px\)/);
  assert.match(shelf, /library-open\[data-classic-tool="stamp"\][\s\S]*tool-dock\s*\{[\s\S]*min-height:\s*164px[\s\S]*max-height:\s*190px/);
  assert.match(shelf, /library-open\[data-classic-tool="stamp"\][\s\S]*tool-dock\s*\{[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\)\s+46px/);
  assert.match(shelf, /library-open\[data-classic-tool="stamp"\][\s\S]*classic-parameters\s*\{[\s\S]*min-height:\s*0/);
  assert.match(shelf, /data-classic-tool="stamp"\]\[data-library-surface="fairy"\][\s\S]*asset-grid\s*\{[\s\S]*min-height:\s*100px[\s\S]*max-height:\s*100%/);
  assert.match(shelf, /data-classic-tool="stamp"\]\[data-library-surface="fairy"\][\s\S]*asset-grid\s*\{[\s\S]*padding-bottom:\s*6px/);
  assert.match(shelf, /data-classic-tool="stamp"\]\[data-library-surface="fairy"\][\s\S]*library-pagination button\s*\{[\s\S]*min-height:\s*28px[\s\S]*height:\s*28px/);
  assert.match(shelf, /library-open\[data-library-surface="gallery"\][\s\S]*#brush-options\s*\{[^}]*display:\s*none\s*!important/);
  assert.match(shelf, /library-open\[data-library-surface="gallery"\][\s\S]*tool-dock\s*\{[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\)\s+46px/);
  assert.match(shelf, /library-open\[data-library-surface="gallery"\][\s\S]*categories\s*\{[\s\S]*height:\s*40px[\s\S]*max-height:\s*40px/);
  assert.match(shelf, /library-open\[data-library-surface="gallery"\][\s\S]*categories button\s*\{[\s\S]*min-height:\s*32px/);
  assert.match(shelf, /library-open\[data-library-surface="gallery"\][\s\S]*asset-grid\s*\{[\s\S]*height:\s*calc\(100%\s*-\s*4px\)[\s\S]*min-height:\s*0/);
  assert.match(shelf, /library-open\[data-library-surface="gallery"\][\s\S]*library-pagination button\s*\{[\s\S]*min-height:\s*38px[\s\S]*height:\s*38px/);
});

test('常用工具每页至多七个，功能工具整体从第三页开始', () => {
  const classic = read('src/classic-ui.js');
  assert.match(classic, /\['clone','仿制印章'\],\['fractal','分形'\],\['scratch','刮刮画'\],\['animation','小动画'\],\['pixel','像素画'\]/);
  assert.match(classic, /Math\.ceil\(firstFeature\s*\/\s*7\)/);
  assert.match(classic, /pageOf\(index\)!==page/);
  // 两个编辑器入口只保留在工具栏第三页，不再占用顶部工具区。
  assert.doesNotMatch(classic, /#animation-open/);
  assert.doesNotMatch(classic, /#pixel-art-open/);
  assert.doesNotMatch(read('src/animation-editor.js'), /header-actions/);
  assert.doesNotMatch(read('src/pixel-art.js'), /header-actions/);
});

test('小动画选色复用左上画笔调色板并与粗细控件等高对齐', () => {
  const editor = read('src/animation-editor.js');
  const css = read('public/playroom.css');
  assert.match(editor, /id="animation-color"[^>]*animation-color-control/);
  assert.doesNotMatch(editor, /<input id="animation-color" type="color"/);
  assert.match(editor, /getElementById\('foreground-palette'\)/);
  assert.match(editor, /addEventListener\('palettechange'/);
  assert.match(css, /\.animation-color-control\s*\{[\s\S]*height:\s*38px/);
  assert.match(css, /\.animation-sliders input\[type="range"\]\s*\{[\s\S]*height:\s*38px/);
  assert.match(css, /\.animation-slider-caption\s*\{[\s\S]*min-height:\s*18px/);
});

test('小动画舞台弹性贴合且帧条支持左右滑动', () => {
  const editor = read('src/animation-editor.js');
  const css = read('public/playroom.css');
  assert.match(css, /\.animation-dialog\s*\{[\s\S]*width:\s*fit-content/);
  assert.match(css, /\.animation-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(264px,\s*312px\)/);
  assert.match(css, /\.animation-stage-frame\s*\{[\s\S]*aspect-ratio:\s*1/);
  assert.match(css, /\.animation-frame-strip\s*\{[\s\S]*overflow-x:\s*auto[\s\S]*scroll-snap-type:\s*x proximity/);
  assert.match(editor, /scrollIntoView\(\{\s*block:\s*'nearest',\s*inline:\s*'nearest'\s*\}\)/);
});


test('高窗口下工具组垂直居中而非底部留白', () => {
  const classic = read('src/classic-ui.js');
  const css = read('public/playroom.css');
  assert.match(classic, /tools-centered/);
  assert.match(css, /#tools\.tools-centered\{justify-content:center\}/);
});