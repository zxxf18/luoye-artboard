// Unified pointer model. Mouse, touch, Apple Pencil and Android stylus all
// arrive as platform pointer events with different field coverage; tools only
// ever consume the normalized record produced here, so a brush behaves the
// same whether the finger, the mouse or a pressure pen drew it.
const POINTER_TYPES = Object.freeze(['mouse', 'touch', 'pen']);

// Pressure semantics per pointer type. Hardware pressure (0..1) is kept when
// the platform reports one; otherwise a stable neutral value is defined per
// type so size-by-pressure brushes never see undefined or 0 for a down event.
export function pointerPressure(event) {
  if (Number.isFinite(event.pressure) && event.pressure > 0) return Math.min(1, event.pressure);
  if (event.pointerType === 'pen') return 0.5;
  return event.buttons || event.touches?.length ? 0.5 : 0;
}

export function normalizePointerType(event) {
  const type = event.pointerType;
  if (POINTER_TYPES.includes(type)) return type;
  // Older WebViews report undefined for mouse; touch events have no type.
  if (event.touches?.length !== undefined) return 'touch';
  return 'mouse';
}

// Map a platform pointer event into the unified model. `toPoint` converts
// client coordinates into canvas coordinates (the engine owns that transform);
// `phase` comes from the listener that fired ('down' | 'move' | 'up' |
// 'cancel').
export function toUnifiedPointer(event, toPoint, phase = 'move', timestamp = Date.now()) {
  const point = toPoint(event);
  return {
    phase,
    pointerId: Number.isFinite(event.pointerId) ? event.pointerId : 0,
    pointerType: normalizePointerType(event),
    x: point.x,
    y: point.y,
    pressure: pointerPressure(event),
    tiltX: Number.isFinite(event.tiltX) ? event.tiltX : 0,
    tiltY: Number.isFinite(event.tiltY) ? event.tiltY : 0,
    twist: Number.isFinite(event.twist) ? event.twist : 0,
    buttons: event.buttons ?? 0,
    primary: event.isPrimary !== false,
    timestamp,
  };
}
