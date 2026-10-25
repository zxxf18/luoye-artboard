import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const studio = readFileSync(new URL('src/ui/studio-ui.js', root), 'utf8');
const styles = readFileSync(new URL('public/playroom.css', root), 'utf8');

test('暗房关闭按钮使用独立的圆形可聚焦控件', () => {
  assert.match(studio, /class="darkroom-close"[^>]*aria-label="关闭暗房"><span aria-hidden="true">×<\/span>/);
  assert.match(studio, /const closeDialog=\(id,event\)=>\{event\?\.preventDefault\(\);event\?\.stopPropagation\(\);/);
  assert.match(studio, /addEventListener\('click',event=>closeDialog\(button\.dataset\.close,event\)/);
  assert.match(studio, /dialogs\.querySelector\('\.dialog-actions button\[data-close="darkroom-dialog"\]'\)\?\.setAttribute\('type','button'\)/);
  assert.match(styles, /\.playroom \.darkroom-close\{[^}]*border-radius:50%[^}]*z-index:8/);
  assert.match(styles, /\.playroom \.darkroom-close:focus-visible\{/);
});

test('暗房预览空白区域使用棋盘格，透明画布不会盖住棋盘格', () => {
  assert.match(styles, /#darkroom-dialog \.effect-preview\{background:repeating-conic-gradient\(/);
  assert.match(styles, /#darkroom-dialog \.effect-preview canvas\{[^}]*background:transparent/);
  assert.doesNotMatch(studio, /当前图层预览/);
});

test('色彩魔力通道使用暗房内的统一下拉，不打开全局选择弹窗', () => {
  assert.match(studio, /<select data-direct-choice="true" data-channel="\$\{i\}"/);
  assert.match(studio, /<option value="none">不处理<\/option><option value="sin">正弦<\/option><option value="cos">余弦<\/option>/);
  assert.match(styles, /#function-modes select\[data-direct-choice="true"\]\{[^}]*min-height:38px/);
});

test('暗房效果下拉层按触发按钮定位，并能在下方空间不足时向上展开', () => {
  assert.match(studio, /function positionEffectList\(\)/);
  assert.match(studio, /getBoundingClientRect\(\)/);
  assert.match(studio, /list\.style\.bottom=/);
  assert.match(studio, /window\.addEventListener\('resize',\(\)=>\{positionEffectList\(\);positionFunctionPickers\(\);\}/);
  assert.match(studio, /darkroom-dialog'\)\.addEventListener\('close',\(\)=>\{setEffectOpen\(false\);closeFunctionPickers\(\);\}/);
  assert.match(styles, /\.playroom \.effect-kind-list\{position:fixed;[^}]*z-index:40/);
});
