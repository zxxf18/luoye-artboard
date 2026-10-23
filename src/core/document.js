// Versioned project document contract. There is exactly ONE internal level:
// the current version below. Older on-disk documents (v1/v2) are upgraded at
// the single openDocument() boundary and never exist inside the app.
export const PROJECT_FORMAT = 'luoye-studio';
export const PROJECT_VERSION = 3;
export const SUPPORTED_PROJECT_VERSIONS = Object.freeze([1, 2, 3]);
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

// Upgrade a supported on-disk document to the current model: canvas index
// filled in, schema map and operation list defaulted. v1/v2 only differ from
// v3 by these missing envelope fields, so the upgrade never touches layers.
// Returns a new object; the caller's copy is untouched.
export function normalizeDocument(value) {
  if (!value || value.format !== PROJECT_FORMAT) throw new Error('不是落叶画板工程。');
  if (!SUPPORTED_PROJECT_VERSIONS.includes(value.version)) throw new Error('不支持的工程版本。');
  const canvas = value.canvas && Number.isFinite(value.canvas.width) && Number.isFinite(value.canvas.height)
    ? { ...value.canvas }
    : canvasIndex(value.width, value.height);
  // A stale canvas index must never win over the top-level size.
  canvas.width = value.width; canvas.height = value.height;
  const operations = Array.isArray(value.operations) ? value.operations.map(entry => ({ ...entry })) : [];
  // Pre-role editions marked paper layers by source id; infer it here, once,
  // instead of re-guessing on every restore.
  const layers = Array.isArray(value.layers)
    ? value.layers.map(layer => layer && !layer.role && /^(color[0-4]|paper|texture)-/.test(layer.sourceId || '') ? { ...layer, role: 'background' } : layer)
    : value.layers;
  return { ...value, version: PROJECT_VERSION, schema: { ...SCHEMA_VERSIONS }, canvas, operations, layers };
}
