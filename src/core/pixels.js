// Pixel algorithms shared by editor, effect previews and deterministic replay.
export const clampByte = value => Math.max(0, Math.min(255, Math.round(value)));
export const rgb = hex => hex.match(/[a-f\d]{2}/gi).map(n => parseInt(n, 16));
export function seededRandom(seed = 1) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}
export function regionMask(data, width, height, x, y, tolerance = 20) {
  const mask = new Uint8ClampedArray(width * height), seen = new Uint8Array(mask.length);
  x = Math.floor(x); y = Math.floor(y);
  if (x < 0 || y < 0 || x >= width || y >= height) return mask;
  const seed = y * width + x, target = data.slice(seed * 4, seed * 4 + 4), stack = new Uint32Array(mask.length);
  let top = 0; stack[top++] = seed; seen[seed] = 1;
  const push = p => { if (!seen[p]) { seen[p] = 1; stack[top++] = p; } };
  while (top) {
    const p = stack[--top], offset = p * 4;
    if (target.some((v, k) => Math.abs(data[offset + k] - v) > tolerance)) continue;
    mask[p] = 255;
    if (p % width) push(p - 1);
    if (p % width < width - 1) push(p + 1);
    if (p >= width) push(p - width);
    if (p < mask.length - width) push(p + width);
  }
  return mask;
}
export function combineMasks(a, b, operation = 'replace') {
  if (!a || operation === 'replace') return b.slice();
  if (a.length !== b.length) throw new Error('选区尺寸不一致');
  return b.map((v, i) => operation === 'union' ? Math.max(a[i], v) : operation === 'subtract' ? Math.max(0, a[i] - v) : Math.min(a[i], v));
}
export function blendMasked(before, after, mask) {
  if (!mask) return after;
  const out = after.slice();
  for (let i = 0; i < mask.length; i++) for (let k = 0; k < 4; k++) out[i * 4 + k] = before[i * 4 + k] + (after[i * 4 + k] - before[i * 4 + k]) * mask[i] / 255;
  return out;
}
function boxBlur(data, width, height, radius) {
  const work = new Float32Array(data.length), temp = new Float32Array(data.length), out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) { work[i + 3] = data[i + 3]; for (let k = 0; k < 3; k++) work[i + k] = data[i + k] * data[i + 3] / 255; }
  // Separable box blur in premultiplied alpha prevents hidden RGB halos.
  for (let axis = 0; axis < 2; axis++) {
    const input = axis ? temp : work, output = axis ? work : temp;
    const lines = axis ? width : height, length = axis ? height : width;
    for (let line = 0; line < lines; line++) for (let k = 0; k < 4; k++) {
      const index = n => (axis ? n * width + line : line * width + n) * 4 + k;
      let sum = 0;
      for (let n = -radius; n <= radius; n++) sum += input[index(Math.max(0, Math.min(length - 1, n)))];
      for (let n = 0; n < length; n++) {
        output[index(n)] = sum / (radius * 2 + 1);
        sum += input[index(Math.min(length - 1, n + radius + 1))] - input[index(Math.max(0, n - radius))];
      }
    }
  }
  for (let i = 0; i < data.length; i += 4) { out[i + 3] = work[i + 3]; for (let k = 0; k < 3; k++) out[i + k] = work[i + 3] ? work[i + k] * 255 / work[i + 3] : 0; }
  return out;
}
function convolution(data, width, height, kernel, bias = 0) {
  const out = data.slice();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let k = 0; k < 3; k++) {
    let value = bias;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const p = (Math.max(0, Math.min(height - 1, y + dy)) * width + Math.max(0, Math.min(width - 1, x + dx))) * 4;
      value += data[p + k] * kernel[(dy + 1) * 3 + dx + 1];
    }
    out[(y * width + x) * 4 + k] = clampByte(value);
  }
  return out;
}
function morphology(data, width, height, axis, expand) {
  const out = data.slice();
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let k = 0; k < 3; k++) {
    let value = expand ? 0 : 255;
    for (let n = -1; n <= 1; n++) {
      const px = Math.max(0, Math.min(width - 1, x + (axis === 'x' ? n : 0))), py = Math.max(0, Math.min(height - 1, y + (axis === 'y' ? n : 0)));
      value = expand ? Math.max(value, data[(py * width + px) * 4 + k]) : Math.min(value, data[(py * width + px) * 4 + k]);
    }
    out[(y * width + x) * 4 + k] = value;
  }
  return out;
}
export function applyEffect(data, width, height, kind, options = {}) {
  const p = options, out = data.slice(), random = seededRandom(p.seed || 1);
  const foreground = rgb(p.color || '#285b49'), background = rgb(p.background || '#ffffff');
  if (kind === 'blur' || kind === 'feather') {
    const blurred = boxBlur(data, width, height, Math.max(1, Math.min(12, Math.round(p.radius || 2))));
    if (kind === 'blur') return blurred;
    for (let i = 3; i < out.length; i += 4) out[i] = blurred[i];
    return out;
  }
  const kernels = { sharpen:[0,-1,0,-1,5,-1,0,-1,0], emboss:[-2,-1,0,-1,1,1,0,1,2], edge:[-1,-1,-1,-1,8,-1,-1,-1,-1], edgeX:[-1,0,1,-2,0,2,-1,0,1], edgeY:[-1,-2,-1,0,0,0,1,2,1] };
  if (kernels[kind]) return convolution(data, width, height, kernels[kind], kind === 'emboss' ? 128 : 0);
  if (/^(dilate|erode|open|close)[XY]$/.test(kind)) {
    const operation = kind.slice(0, -1), axis = kind.at(-1).toLowerCase();
    const first = morphology(data, width, height, axis, operation === 'dilate' || operation === 'close');
    return operation === 'open' || operation === 'close' ? morphology(first, width, height, axis, operation === 'open') : first;
  }
  if (kind === 'mosaic') {
    const size = Math.max(2, Math.min(80, Math.round(p.radius || 10)));
    for (let y = 0; y < height; y += size) for (let x = 0; x < width; x += size) {
      const total = [0,0,0,0]; let count = 0;
      for (let dy = y; dy < Math.min(height,y+size); dy++) for (let dx = x; dx < Math.min(width,x+size); dx++) { const i=(dy*width+dx)*4; for(let k=0;k<3;k++)total[k]+=data[i+k]*data[i+3]/255; total[3]+=data[i+3]; count++; }
      for (let dy = y; dy < Math.min(height,y+size); dy++) for (let dx = x; dx < Math.min(width,x+size); dx++) { const i=(dy*width+dx)*4; for(let k=0;k<3;k++)out[i+k]=total[3]?total[k]*255/total[3]:0; out[i+3]=total[3]/count; }
    }
    return out;
  }
  for (let i = 0; i < data.length; i += 4) {
    const r=data[i], g=data[i+1], b=data[i+2], light=.299*r+.587*g+.114*b;
    let result = [r,g,b];
    if (kind === 'invert') result = [255-r,255-g,255-b];
    else if (kind === 'grayscale') result = [light,light,light];
    else if (kind === 'threshold') result = Array(3).fill(light >= (p.threshold ?? 128) ? 255 : 0);
    else if (kind === 'brightness') { const c = Math.max(-100,Math.min(100,p.contrast || 0))*2.55, factor=(259*(c+255))/(255*(259-c)); result=result.map(v=>factor*(v-128)+128+(p.brightness || 0)*2.55); }
    else if (kind === 'balance') result = [r+(p.red||0),g+(p.green||0),b+(p.blue||0)];
    else if (kind === 'opacity') out[i+3] = data[i+3] * (p.amount ?? 100) / 100;
    else if (kind === 'enhance') result = result.map((v,k)=>255*Math.pow(v/255,1/Math.max(.1,(p[['red','green','blue'][k]] ?? 100)/100)));
    else if (kind === 'hsl') {
      const max=Math.max(r,g,b)/255,min=Math.min(r,g,b)/255,delta=max-min,l=(max+min)/2;
      let hue=delta===0?0:max===r/255?((g-b)/255/delta)%6:max===g/255?(b-r)/255/delta+2:(r-g)/255/delta+4;
      hue=((hue*60+(p.hue||0))%360+360)%360;
      const sat=Math.max(0,Math.min(1,(delta===0?0:delta/(1-Math.abs(2*l-1)))+(p.saturation||0)/100));
      const lum=Math.max(0,Math.min(1,l+(p.lightness||0)/100)),c=(1-Math.abs(2*lum-1))*sat,x=c*(1-Math.abs(hue/60%2-1)),m=lum-c/2;
      result=(hue<60?[c,x,0]:hue<120?[x,c,0]:hue<180?[0,c,x]:hue<240?[0,x,c]:hue<300?[x,0,c]:[c,0,x]).map(v=>(v+m)*255);
    } else if (kind === 'gradient') { const start=p.start??0,end=p.end??255,t=Math.max(0,Math.min(1,(light-start)/Math.max(1,end-start)));result=foreground.map((v,k)=>v+(background[k]-v)*t); }
    else if (kind === 'replace') { if(result.every((v,k)=>Math.abs(v-foreground[k]) <= (p.tolerance??20))) result=background; }
    else if (kind === 'noise') { if(random() < (p.frequency??50)/100) result=result.map((v,k)=>v+(foreground[k]-v)*(p.amount??40)/100*random()); }
    else if (kind === 'posterize') { const steps=Math.max(2,p.levels||4);result=result.map(v=>Math.round(v/255*(steps-1))*255/(steps-1)); }
    else if (kind === 'solarize') result=result.map(v=>v>128?255-v:v);
    else if (kind === 'sepia') result=[.393*r+.769*g+.189*b,.349*r+.686*g+.168*b,.272*r+.534*g+.131*b];
    else if (kind === 'function') result=result.map((v,k)=> { const mode=p.modes?.[k]||'sin',channel=p.channels?.[k]||p;if(mode==='none')return v; return (channel.offset??128)+(channel.amplitude??127)*(mode==='cos'?Math.cos:Math.sin)(v/255*Math.PI*2*(channel.frequency??1)); });
    else if (kind === 'shift') { const x=i/4%width,y=Math.floor(i/4/width);result=result.map((v,k)=> { const px=Math.max(0,Math.min(width-1,x-Math.round(p.dx?.[k]||0))),py=Math.max(0,Math.min(height-1,y-Math.round(p.dy?.[k]||0)));return data[(py*width+px)*4+k]; }); }
    else throw new Error('未知的暗房操作：'+kind);
    for (let k=0;k<3;k++) out[i+k]=clampByte(result[k]);
  }
  return out;
}
