/**
 * Return whether an active gesture should consume the browser's raw pointer
 * stream. Hard and soft erasers need the extra samples because a fast drag can
 * otherwise leave visible gaps between pointermove events. Other tools keep
 * their existing event rate and rendering cost.
 */
export function isHighFrequencyEraser(options = {}) {
  return options.tool === 'eraser' && (options.eraserMode === 'hard' || options.eraserMode === 'soft');
}

/**
 * Preserve the existing coalesced-event behaviour for ordinary tools. When a
 * high-frequency gesture is active, append the current raw event as well: a
 * browser may expose coalesced samples without including the latest pointer
 * position. PaintEngine de-duplicates identical coordinates.
 */
export function collectPointerSamples(event, highFrequency = false) {
  if (!event) return [];
  const samples = event.getCoalescedEvents?.();
  if (!samples?.length) return [event];
  if (!highFrequency || samples.at(-1) === event) return samples;
  return [...samples, event];
}
