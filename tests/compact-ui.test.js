import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const styles = readFileSync(new URL('public/playroom.css', root), 'utf8');
const classic = readFileSync(new URL('src/classic-ui.js', root), 'utf8');
const app = readFileSync(new URL('src/app.js', root), 'utf8');

test('小屏幕统一收敛新画纸和重置文案字号', () => {
  assert.match(styles, /\.playroom\s+\.header-actions #new-quick,\s*\.playroom\s+\.header-actions #reset-settings\s*\{[^}]*font-size:\s*9px\s*!important/);
  assert.match(styles, /\.playroom\s+\.header-actions #new-quick,\s*\.playroom\s+\.header-actions #reset-settings\s*\{[^}]*line-height:\s*1\.1/);
});

test('小屏幕限制主题入口图标尺寸，避免被界面缩放放大', () => {
  assert.match(styles, /\.playroom(?:\[data-theme\])?\s+\.header-actions \.theme-entry > \.playful-icon\s*\{[^}]*width:\s*20px\s*!important[^}]*height:\s*20px\s*!important/);
});

test('刮刮画提供可调的笔尖粗细', () => {
  assert.match(classic, /!\['pen','eraser','stamp','clone',\.\.\.geometries,'scratch'\]\.includes\(tool\)/);
});

test('原生就绪信息包含新增刮刮画工具', () => {
  assert.match(app, /classicUnits:15/);
  assert.match(app, /tools:Object\.keys\(toolNames\)/);
});

test('工具栏按创作流程分为常用页和调整特效页', () => {
  assert.match(classic, /const toolPages=\[\s*\[\['pen','画笔'\],\['eraser','橡皮'\],\['line','图形'\],\['fill','油漆桶'\],\['text','文字'\],\['stamp','魔法袋'\],\['scratch','刮刮画'\],\['picker','吸颜色'\]\],\s*\[\['select','圈选'\],\['move','移动'\],\['clone','仿制印章'\],\['warp','变形'\],\['magic','魔力棒'\],\['board-filter','滤镜'\],\['fractal','分形'\],\['pixel-art','像素画'\],\['animation','小动画'\],\['collage','剪贴画'\]\],\s*\]/s);
  assert.match(classic, /const tools=toolPages\.flat\(\)/);
  assert.match(classic, /const visible=toolPages\[page\]\|\|toolPages\[0\]/);
  assert.match(classic, /const pageFor=toolPageFor\(groupTool\(\)\)/);
});

test('关于按钮先关闭设置再打开关于弹窗，并且不会被设置事件拦截', () => {
  assert.match(classic, /if\(!event\.target\.closest\('#about-open'\)\)more\.close\(\)/);
  assert.match(classic, /aboutButton\.onclick=\(\)=>\{more\.close\(\);about\.showModal\(\);\}/);
});

test('像素画、小动画、剪贴画进入第二页工具架', () => {
  assert.match(classic, /const featureTools=\{/);
  assert.match(classic, /'pixel-art':\(\)=>document\.querySelector\('#pixel-art-open'\)\?\.click\(\)/);
  assert.match(classic, /animation:\(\)=>document\.querySelector\('#animation-open'\)\?\.click\(\)/);
  assert.match(classic, /collage:\(\)=>document\.querySelector\('#collage-open'\)\?\.click\(\)/);
  assert.match(styles, /\.playroom \.header-actions #pixel-art-open,\.playroom \.header-actions #animation-open,\.playroom \.header-actions #collage-open\{display:none!important\}/);
});

test('进入刮刮画不会重复渲染覆盖层', () => {
  assert.match(app, /let scratchPrepared=false;/);
  assert.match(app, /engine\.stampPreview=null;\s*(?:const scratchLayer=)?engine\.prepareScratchCard\(\)/);
  assert.match(app, /if\(engine&&!scratchPrepared\)/);
});

test('调节刮擦粗细时不重建工具选项和图标', () => {
  assert.match(classic, /el\('size'\)\.addEventListener\('input',\(\)=>\{if\(el\('painting'\)\.dataset\.tool==='pen'\)sync\(\);\}\)/);
});

test('刮刮画提供底色和彩虹色选择，并通过独立事件交给引擎', () => {
  assert.match(classic, /baseMode:'rainbow'/);
  assert.match(classic, /baseColor:'#fffdf8'/);
  assert.match(classic, /scratch-style-change/);
  assert.match(classic, /dataset\.scratchCustom/);
});

test('刮刮画覆盖层预设使用紧凑色块，避免小屏工具卡片撑高', () => {
  assert.match(classic, /id:'ginkgo'.*secondaryColor:'#f0d49f'/);
  assert.match(classic, /id:'mint'.*secondaryColor:'#b7ded7'/);
  assert.match(classic, /id:'space'.*secondaryColor:'#a29ac4'/);
  assert.match(styles, /\.playroom \.scratch-style-panel/);
  assert.match(styles, /scratch-style-chip.*width:30px/);
  assert.match(styles, /data-mobile-panel="brushes"\].*subtool-box:has\(\.scratch-style-panel\)/s);
});
