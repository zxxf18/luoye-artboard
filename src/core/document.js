// Versioned project document contract. Exactly one level exists: the current
// version below, for reading and writing alike.
export const PROJECT_FORMAT = 'luoye-studio';
export const PROJECT_VERSION = 3;
export const SCHEMA_VERSIONS = Object.freeze({ canvas: 1, layers: 1, brushes: 1, tools: 1, animation: 1, operations: 1 });

// Redundant canvas index: width/height at the top level stay the source of
// truth for compatibility; this block exists so new readers can describe the
// paper without walking layers first.
function canvasIndex(width, height, background = '#ffffff') {
  return { width, height, background };
}

export function documentHeader(width, height) {
  return { format: PROJECT_FORMAT, version: PROJECT_VERSION, schema: { ...SCHEMA_VERSIONS }, canvas: canvasIndex(width, height), operations: [] };
}
