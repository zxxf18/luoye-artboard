import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  AnimationTimeline,
  DEFAULT_ANIMATION_SIZE,
  FPS_OPTIONS,
  MAX_ANIMATION_FRAMES,
  copyCanvas,
  createBlankFrame,
} from '../src/animation-editor.js';

// The timeline is intentionally testable without a browser.  A tiny canvas
// double is enough to verify dimensions and that copying a frame never aliases
// its pixel storage.  The production editor still uses a real HTML canvas.
class FakeContext {
  constructor(canvas) { this.canvas = canvas; }
  clearRect() { this.canvas.pixels.fill(0); }
  drawImage(source) {
    this.canvas.pixels = source.pixels ? source.pixels.slice() : new Uint8Array(this.canvas.width * this.canvas.height * 4);
  }
}
class FakeCanvas {
  constructor(width = 1, height = 1) {
    this.width = width;
    this.height = height;
    this.pixels = new Uint8Array(width * height * 4);
    this.context = new FakeContext(this);
  }
  getContext() { return this.context; }
}

const previousDocument = globalThis.document;
before(() => {
  globalThis.document = { createElement: () => new FakeCanvas() };
});
after(() => {
  if (previousDocument === undefined) delete globalThis.document;
  else globalThis.document = previousDocument;
});

function timeline(options = {}) {
  return new AnimationTimeline({ width: 96, height: 64, ...options });
}

test('逐帧动画的尺寸、帧数上限和帧率档位是稳定的', () => {
  assert.equal(MAX_ANIMATION_FRAMES, 12);
  assert.deepEqual(FPS_OPTIONS, [6, 8, 12]);
  assert.ok(DEFAULT_ANIMATION_SIZE.width <= 768);
  assert.ok(DEFAULT_ANIMATION_SIZE.height <= 768);

  const editor = timeline();
  assert.equal(editor.frameCount, 1);
  while (editor.frameCount < MAX_ANIMATION_FRAMES) assert.equal(editor.addBlankFrame(), true);
  assert.equal(editor.frameCount, MAX_ANIMATION_FRAMES);
  assert.equal(editor.addBlankFrame(), false);
  assert.equal(editor.frameCount, MAX_ANIMATION_FRAMES);
});

test('复制上一帧会复制像素而不是共享同一个 canvas', () => {
  const editor = timeline();
  editor.currentFrame.pixels[0] = 0x42;

  assert.equal(editor.copyPrevious(), true);
  assert.equal(editor.frameCount, 2);
  assert.notEqual(editor.frames[0], editor.frames[1]);
  assert.equal(editor.frames[1].pixels[0], 0x42);

  editor.currentFrame.pixels[0] = 0x99;
  assert.equal(editor.frames[0].pixels[0], 0x42);
});

test('删除帧不会把时间轴删空', () => {
  const editor = timeline();
  editor.addBlankFrame();
  editor.select(1);
  assert.equal(editor.removeFrame(), true);
  assert.equal(editor.frameCount, 1);
  assert.equal(editor.currentIndex, 0);
  assert.equal(editor.removeFrame(), false);
  assert.equal(editor.frameCount, 1);
});

test('帧率切换只接受预设档位并同步每帧时长', () => {
  const editor = timeline({ fps: 8 });
  assert.equal(editor.fps, 8);
  assert.equal(editor.frameDuration, 125);
  editor.setFps(6);
  assert.equal(editor.fps, 6);
  assert.equal(editor.frameDuration, 1000 / 6);
  editor.setFps(12);
  assert.equal(editor.fps, 12);
  assert.equal(editor.frameDuration, 1000 / 12);
  assert.throws(() => editor.setFps(7), /帧率|fps/i);
});

test('输出给画板的动画资源保持统一的小画布尺寸', () => {
  const editor = timeline({ width: 128, height: 96, fps: 12 });
  editor.addBlankFrame();
  editor.addBlankFrame();
  const layer = editor.toLayerOptions();

  assert.equal(layer.width, 128);
  assert.equal(layer.height, 96);
  assert.equal(layer.frameDuration, 1000 / 12);
  assert.equal(layer.frames.length, 3);
  assert.ok(layer.frames.every(frame => frame.width === 128 && frame.height === 96));
  // The editor must never promote its frame resources to the full paper size.
  assert.ok(layer.frames.every(frame => frame.width * frame.height <= DEFAULT_ANIMATION_SIZE.width * DEFAULT_ANIMATION_SIZE.height));
});

test('createBlankFrame 和 copyCanvas 保留尺寸并清空新帧', () => {
  const source = createBlankFrame(32, 20);
  source.pixels[0] = 255;
  const copy = copyCanvas(source);
  assert.equal(copy.width, 32);
  assert.equal(copy.height, 20);
  assert.notEqual(copy, source);
  assert.equal(copy.pixels[0], 255);
  copy.pixels[0] = 0;
  assert.equal(source.pixels[0], 255);
});

test('时间轴拒绝尺寸不一致的帧，避免保存时被隐式缩放', () => {
  const editor = timeline();
  const wrong = createBlankFrame(32, 32);
  assert.throws(() => editor.replaceCurrent(wrong), /96 × 64/);
  assert.throws(() => new AnimationTimeline({ width: 96, height: 64, frames: [wrong] }), /96 × 64/);
  assert.throws(() => editor.clearCurrent(wrong), /96 × 64/);
});
