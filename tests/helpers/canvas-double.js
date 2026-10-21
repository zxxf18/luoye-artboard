/**
 * Shared canvas/engine doubles for node-side tests.
 *
 * The engine instantiates canvases and schedules animation frames; neither
 * exists under node:test. The three suites that construct engines
 * (animation-editor, performance-regression, scratch) used to keep private
 * copies of this harness. One superset double keeps them in sync and the
 * browser build on real surfaces.
 */
export class ContextDouble {
  constructor(canvas) { this.canvas = canvas; }
  clearRect() {} fillRect() {} drawImage() {} setTransform() {} save() {} restore() {}
  translate() {} scale() {} rotate() {} beginPath() {} moveTo() {} lineTo() {} quadraticCurveTo() {} roundRect() {}
  stroke() {} fill() {} arc() {} rect() {} ellipse() {} clip() {} closePath() {} putImageData() {}
  strokeRect() {} fillText() {} measureText() { return { width: 0 }; }
  createLinearGradient() { return { addColorStop() {} }; }
  createRadialGradient() { return { addColorStop() {} }; }
  createPattern() { return {}; }
  getImageData(x, y, w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; }
}
export class CanvasDouble {
  constructor(width = 4, height = 4) { this.width = width; this.height = height; this.context = new ContextDouble(this); }
  getContext() { return this.context; }
  toDataURL() { return 'data:image/png;base64,'; }
}

/** Install the document/requestAnimationFrame doubles for one test body. */
export async function withCanvasDouble(run) {
  const previousDocument = globalThis.document;
  const previousRaf = globalThis.requestAnimationFrame;
  const previousCancel = globalThis.cancelAnimationFrame;
  globalThis.document = { createElement: () => new CanvasDouble() };
  globalThis.requestAnimationFrame = () => 0;
  globalThis.cancelAnimationFrame = () => {};
  try { return await run(); } finally {
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
    if (previousRaf === undefined) delete globalThis.requestAnimationFrame; else globalThis.requestAnimationFrame = previousRaf;
    if (previousCancel === undefined) delete globalThis.cancelAnimationFrame; else globalThis.cancelAnimationFrame = previousCancel;
  }
}

/**
 * Detach an engine from timers created before the doubles could stub them:
 * the constructor already scheduled one render deadline, and the animation
 * interval keeps node alive.
 */
export function silenceEngine(engine) {
  clearInterval(engine.animationTimer);
  engine.render = () => {};
  clearTimeout(engine.renderDeadline);
}
