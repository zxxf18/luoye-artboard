// Tool capability interface. Every tool — brush, eraser, shape, filter,
// scratch, pixel art — is described here once. UI shells read registry
// metadata instead of hard-coding per-tool branches, and the engine consumes
// the same descriptors when routing gestures.
const TOOL_KINDS = Object.freeze(['brush', 'eraser', 'shape', 'fill', 'stamp', 'select', 'transform', 'filter', 'text', 'fractal', 'scratch', 'animation', 'pixel', 'utility']);

export const BUILTIN_TOOLS = [
  { id: 'pen', kind: 'brush', supports: { continuous: true, pressure: true, size: true, opacity: true } },
  { id: 'eraser', kind: 'eraser', supports: { continuous: true, size: true } },
  { id: 'stamp', kind: 'stamp', supports: { continuous: true, size: true, opacity: true } },
  { id: 'fill', kind: 'fill', supports: { continuous: false } },
  { id: 'picker', kind: 'utility', supports: { continuous: false } },
  { id: 'line', kind: 'shape', supports: { continuous: true, size: true, opacity: true }, variants: ['polygon', 'bezier'] },
  { id: 'polygon', kind: 'shape', supports: { continuous: false }, variantOf: 'line' },
  { id: 'bezier', kind: 'shape', supports: { continuous: false }, variantOf: 'line' },
  { id: 'text', kind: 'text', supports: { continuous: false } },
  { id: 'select', kind: 'select', supports: { continuous: true } },
  { id: 'magic', kind: 'filter', supports: { continuous: false } },
  { id: 'move', kind: 'transform', supports: { continuous: true } },
  { id: 'warp', kind: 'transform', supports: { continuous: true, size: true } },
  { id: 'board-filter', kind: 'filter', supports: { continuous: false } },
  { id: 'clone', kind: 'stamp', supports: { continuous: true, size: true } },
  { id: 'fractal', kind: 'fractal', supports: { continuous: false, size: true } },
  { id: 'scratch', kind: 'scratch', supports: { continuous: true, size: true } },
  { id: 'animation', kind: 'animation', supports: { continuous: false } },
  { id: 'pixel', kind: 'pixel', supports: { continuous: false } },
];

export function validateTool(tool) {
  const fail = message => { throw new Error(message); };
  if (!tool || typeof tool !== 'object') fail('工具描述必须是对象。');
  if (typeof tool.id !== 'string' || !/^[a-z][a-z0-9-]*$/.test(tool.id)) fail('工具 id 需要是小写字母、数字和连字符。');
  if (!TOOL_KINDS.includes(tool.kind)) fail(`工具 ${tool.id} 的类型不在支持列表中。`);
  if (tool.supports !== undefined && (typeof tool.supports !== 'object' || tool.supports === null)) fail(`工具 ${tool.id} 的能力声明无效。`);
  if (tool.variantOf !== undefined && typeof tool.variantOf !== 'string') fail(`工具 ${tool.id} 的变生声明无效。`);
  if (tool.variants !== undefined && (!Array.isArray(tool.variants) || tool.variants.some(v => typeof v !== 'string'))) fail(`工具 ${tool.id} 的变体列表无效。`);
  for (const handler of ['begin', 'update', 'end', 'cancel']) {
    if (tool[handler] !== undefined && typeof tool[handler] !== 'function') fail(`工具 ${tool.id} 的 ${handler} 处理器必须是函数。`);
  }
  return tool;
}

export class ToolRegistry {
  constructor() { this.tools = new Map(); }
  register(tool) {
    validateTool(tool);
    if (this.tools.has(tool.id)) throw new Error(`工具 ${tool.id} 已注册。`);
    const descriptor = Object.freeze({ ...tool, supports: Object.freeze({ ...tool.supports }) });
    this.tools.set(tool.id, descriptor);
    return descriptor;
  }
  get(id) { return this.tools.get(id) || null; }
  has(id) { return this.tools.has(id); }
  list() { return [...this.tools.values()]; }
}

export function createToolRegistry(tools = BUILTIN_TOOLS) {
  const registry = new ToolRegistry();
  for (const tool of tools) registry.register(tool);
  return registry;
}
