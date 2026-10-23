// Tool capability interface. Every tool — brush, eraser, shape, filter,
// scratch, pixel art — is described here once. UI shells read registry
// metadata instead of hard-coding per-tool branches, and the engine consumes
// the same descriptors when routing gestures.
const TOOL_KINDS = Object.freeze(['brush', 'eraser', 'shape', 'fill', 'stamp', 'select', 'transform', 'filter', 'text', 'fractal', 'scratch', 'animation', 'pixel', 'utility']);

export const BUILTIN_TOOLS = [
  { id: 'pen', label: '画笔', kind: 'brush', supports: { continuous: true, pressure: true, size: true, opacity: true } },
  { id: 'eraser', label: '橡皮', kind: 'eraser', supports: { continuous: true, size: true } },
  { id: 'stamp', label: '魔法袋', kind: 'stamp', supports: { continuous: true, size: true, opacity: true } },
  { id: 'fill', label: '油漆桶', kind: 'fill', supports: { continuous: false } },
  { id: 'picker', label: '吸颜色', kind: 'utility', supports: { continuous: false } },
  { id: 'line', label: '图形', kind: 'shape', supports: { continuous: true, size: true, opacity: true }, variants: ['polygon', 'bezier'] },
  { id: 'polygon', kind: 'shape', supports: { continuous: false }, variantOf: 'line' },
  { id: 'bezier', kind: 'shape', supports: { continuous: false }, variantOf: 'line' },
  { id: 'text', label: '文字', kind: 'text', supports: { continuous: false } },
  { id: 'select', label: '圈选', kind: 'select', supports: { continuous: true } },
  { id: 'magic', label: '魔力棒', kind: 'filter', supports: { continuous: false } },
  { id: 'move', label: '移动', kind: 'transform', supports: { continuous: true } },
  { id: 'warp', label: '变形', kind: 'transform', supports: { continuous: true, size: true } },
  { id: 'board-filter', label: '滤镜', kind: 'filter', supports: { continuous: false } },
  { id: 'clone', label: '仿制印章', kind: 'stamp', supports: { continuous: true, size: true } },
  { id: 'fractal', label: '分形', kind: 'fractal', supports: { continuous: false, size: true } },
  { id: 'scratch', label: '刮刮画', kind: 'scratch', supports: { continuous: true, size: true } },
  { id: 'animation', label: '小动画', kind: 'animation', supports: { continuous: false } },
  { id: 'pixel', label: '像素画', kind: 'pixel', supports: { continuous: false } },
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
