// Operation record model. History (undo/redo) stays the authority for
// reversible in-memory edits; the operation log records what the user did in
// a compact, serializable form so support, replay diagnostics and future
// cross-tool features have one vocabulary. It is capped and boundary-checked:
// restoring a document never replays it.

export const OPERATION_LIMIT = 2000;
export const OPERATION_TYPES = Object.freeze(['stroke', 'shape', 'fill', 'erase', 'stamp', 'layer-add', 'layer-remove', 'layer-move', 'layer-property', 'background', 'filter', 'fractal', 'text', 'animation', 'pixel', 'scratch', 'other']);

export function validOperation(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (typeof entry.id !== 'string' || !entry.id || entry.id.length > 64) return false;
  if (!OPERATION_TYPES.includes(entry.type)) return false;
  if (entry.toolId !== undefined && (typeof entry.toolId !== 'string' || entry.toolId.length > 64)) return false;
  if (entry.payload !== undefined && (typeof entry.payload !== 'object' || entry.payload === null)) return false;
  if (entry.timestamp !== undefined && !Number.isFinite(entry.timestamp)) return false;
  return true;
}

let operationSequence = 0;
export function nextOperationId(prefix = 'op') { operationSequence = (operationSequence + 1) % 1e9; return `${prefix}-${operationSequence.toString(36)}-${Date.now().toString(36)}`; }

export class OperationLog {
  constructor(limit = OPERATION_LIMIT) { this.limit = limit; this.clear(); }
  clear() { this.entries = []; }
  // Bounded export view of the log embedded in a project. It is diagnostic
  // history: restoring a project must never depend on it.
  snapshot() {
    if (!Array.isArray(this.entries) || !this.entries.length) return [];
    return this.entries.slice(-this.limit).map(({ id, type, toolId, payload, timestamp }) => {
      const item = { id: String(id), type: String(type) };
      if (toolId !== undefined) item.toolId = String(toolId);
      if (payload !== undefined) item.payload = payload;
      if (Number.isFinite(timestamp)) item.timestamp = timestamp;
      return item;
    });
  }
  // Record one finished user action. Invalid or oversized payloads are dropped
  // rather than thrown: logging must never break drawing itself.
  record(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const item = { ...entry, id: entry.id ?? nextOperationId(), timestamp: entry.timestamp ?? Date.now() };
    if (!validOperation(item)) return null;
    this.entries.push(item);
    if (this.entries.length > this.limit) this.entries.splice(0, this.entries.length - this.limit);
    return item;
  }
  // Take over the operation list embedded in a restored document. Every entry
  // is re-validated; anything malformed is dropped, never thrown.
  adopt(entries, limit = this.limit) {
    this.entries = Array.isArray(entries) ? entries.filter(validOperation).slice(-limit) : [];
    return this.entries.length;
  }
  get size() { return this.entries.length; }
}

// Map a tool id onto the operation vocabulary used by the log.
export function operationTypeForTool(toolId) {
  const byKind = { pen: 'stroke', eraser: 'erase', fill: 'fill', stamp: 'stamp', clone: 'stamp', fractal: 'fractal', scratch: 'scratch', text: 'text', move: 'layer-move', warp: 'other' };
  if (byKind[toolId]) return byKind[toolId];
  if (['line', 'triangle', 'rect', 'pentagon', 'hexagon', 'roundrect', 'ellipse', 'star', 'polygon', 'bezier', 'select', 'select-bezier'].includes(toolId)) return toolId === 'select' || toolId === 'select-bezier' ? 'other' : 'shape';
  if (['board-filter', 'magic'].includes(toolId)) return 'filter';
  return 'other';
}
