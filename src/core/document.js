// Versioned project document contract. Every platform (macOS, Windows, iOS,
// Android, web) opens and writes the same shape; only the version number and
// the schema map move forward. Older documents are normalized on read, never
// rewritten behind the user's back.
export const PROJECT_FORMAT = 'luoye-studio';
export const PROJECT_VERSION = 3;
export const SCHEMA_VERSIONS = Object.freeze({ canvas: 1, layers: 1, brushes: 1, tools: 1, animation: 1, operations: 1 });

// Redundant canvas index: width/height at the top level stay the source of
// truth for compatibility; this block exists so new readers can describe the
// paper without walking layers first.
export function canvasIndex(width, height, background = '#ffffff') {
  return { width, height, background };
}

export function documentHeader(width, height) {
  return { format: PROJECT_FORMAT, version: PROJECT_VERSION, schema: { ...SCHEMA_VERSIONS }, canvas: canvasIndex(width, height) };
}

// Normalize a validated v1/v2/v3 document into the shared in-memory model:
// canvas index filled in, operations defaulted to an empty log. Returns a new
// object; the caller's copy is untouched.
export function normalizeDocument(value) {
  if (!value || value.format !== PROJECT_FORMAT) throw new Error('不是落叶画板工程。');
  const version = value.version;
  if (![1, 2, 3].includes(version)) throw new Error('不支持的工程版本。');
  const canvas = value.canvas && Number.isFinite(value.canvas.width) && Number.isFinite(value.canvas.height)
    ? { ...value.canvas }
    : canvasIndex(value.width, value.height);
  // A stale canvas index must never win over the top-level size.
  canvas.width = value.width; canvas.height = value.height;
  const operations = Array.isArray(value.operations) ? value.operations.map(entry => ({ ...entry })) : [];
  const normalized = { ...value, version: PROJECT_VERSION, schema: { ...SCHEMA_VERSIONS }, canvas, operations };
  delete normalized.eraseMaskVersion;
  return normalized;
}

// Bounded export view of the operation log embedded in a v3 document. The log
// is diagnostic history: restoring a project must never depend on it.
export function operationsForSerialize(entries, limit = 2000) {
  if (!Array.isArray(entries) || !entries.length) return [];
  return entries.slice(-limit).map(({ id, type, toolId, payload, timestamp }) => {
    const item = { id: String(id), type: String(type) };
    if (toolId !== undefined) item.toolId = String(toolId);
    if (payload !== undefined) item.payload = payload;
    if (Number.isFinite(timestamp)) item.timestamp = timestamp;
    return item;
  });
}
