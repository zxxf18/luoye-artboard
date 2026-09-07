import { validateProject } from './core.js';
import { makeCanvas, loadImage } from './engine.js';

const COMMANDS=new Set(['stroke','selectShape','clearSelection','selectAll','invertSelection','magicSelect','copySelection','paste','duplicateLayer','flipLayer','mergeToBottom','freezeAnimation','clearPixels','clearLayer','applyDarkroom','applyBoardFilter','fillAt','setCloneSource','setPaintTexture','setPaperTexture','setStampImages','setFairyGroups','useLayerAsStamp','addLayer','replaceBackground','removeActive','clearAnimated','reorder','resizeActiveObject','setProperty','addVertex','finishPath']);
const PROPERTY_KEYS=new Set(['name','x','y','scale','rotation','opacity','visible']);
const MAX_BYTES=64*1024*1024,MAX_POINTS=100000;
function bounded(value,depth=0){
  if(depth>16)throw new Error('录像参数嵌套过深。');
  if(value===null||typeof value==='boolean')return;
  if(typeof value==='number'){if(!Number.isFinite(value)||Math.abs(value)>1e12)throw new Error('录像数字参数无效。');return;}
  if(typeof value==='string'){if(value.length>MAX_BYTES)throw new Error('录像内容过大。');return;}
  if(Array.isArray(value)){if(value.length>MAX_POINTS)throw new Error('录像参数过多。');value.forEach(v=>bounded(v,depth+1));return;}
  if(value&&typeof value==='object'){for(const [key,v] of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key))throw new Error('录像包含非法属性。');bounded(v,depth+1);}return;}
  throw new Error('录像参数无效。');
}
export function validateRecording(raw){
  if(raw&&typeof raw.format==='string'&&/^[a-z]+-recording$/.test(raw.format))raw={...raw,format:'luoye-recording',slots:raw.slots?.map(slot=>slot?{...slot,base:validateProject(slot.base)}:slot)};
  if(!raw||raw.format!=='luoye-recording'||raw.version!==1||!Array.isArray(raw.slots)||raw.slots.length!==5)throw new Error('不是支持的五段绘画录像。');
  if(JSON.stringify(raw).length>MAX_BYTES)throw new Error('录像超过 64 MiB 上限。');
  for(const slot of raw.slots){if(slot===null)continue;validateProject(slot.base);let resourcePixels=0;
    const resource=item=>{if(!item||!Number.isInteger(item.width)||!Number.isInteger(item.height)||item.width<1||item.height<1||item.width>4096||item.height>4096||item.width*item.height>8388608||typeof item.image!=='string'||!item.image.startsWith('data:image/png;base64,'))throw new Error('录像图片资源无效。');resourcePixels+=item.width*item.height;if(resourcePixels>90000000)throw new Error('录像图片资源超过像素预算。');};
    const groups=values=>{if(!Array.isArray(values)||values.length>1000)throw new Error('魔法袋分组无效。');for(const group of values){if(!Array.isArray(group.frames)||group.frames.length<1||group.frames.length>60)throw new Error('魔法袋帧数量无效。');group.frames.forEach(resource);}};
    if(slot.paintTexture)resource(slot.paintTexture);if(slot.paperTexture)resource(slot.paperTexture);
    if(slot.fairyGroups)groups(slot.fairyGroups);
    if(slot.selection)resource(slot.selection);if(slot.stampImages){if(!Array.isArray(slot.stampImages)||slot.stampImages.length>60)throw new Error('印章资源数量无效。');slot.stampImages.forEach(resource);}
    if(slot.paperMode!==undefined&&typeof slot.paperMode!=='boolean')throw new Error('录像绘画范围无效。');if(slot.cloneSource?.image)resource(slot.cloneSource.image);
    if(slot.cloneSource&&(!slot.cloneSource.point||!Number.isFinite(slot.cloneSource.point.x)||!Number.isFinite(slot.cloneSource.point.y)||(!slot.cloneSource.image&&typeof slot.cloneSource.layerId!=='string')))throw new Error('仿制源点无效。');if(!Array.isArray(slot.events)||slot.events.length>5000)throw new Error('录像操作数量无效。');let points=0;
    for(const event of slot.events){if(!event||!COMMANDS.has(event.method)||!Array.isArray(event.args)||typeof event.activeId!=='string'||!Number.isFinite(event.time)||event.time<0)throw new Error('录像操作无效。');bounded(event.args);if(event.resultId!==undefined&&(typeof event.resultId!=='string'||event.resultId.length>256))throw new Error('录像图层标识无效。');
      if(event.method==='stroke'){const [path,o]=event.args;if(!Array.isArray(path)||!path.length||!o||typeof o!=='object')throw new Error('笔触无效。');points+=path.length;if(path.length>20000)throw new Error('单笔采样点过多。');if(o.size!==undefined&&(!Number.isFinite(o.size)||o.size<.1||o.size>1024))throw new Error('录像笔尖尺寸无效。');if(o.opacity!==undefined&&(!Number.isFinite(o.opacity)||o.opacity<0||o.opacity>1))throw new Error('录像透明度无效。');if(o.color!==undefined&&!/^#[a-f0-9]{6}$/i.test(o.color))throw new Error('录像颜色无效。');for(const p of path)if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>100000||Math.abs(p.y)>100000)throw new Error('笔触坐标无效。');if(!['pen','eraser','fill','move','line','rect','ellipse','triangle','pentagon','hexagon','roundrect','star','stamp','clone','select','magic','warp','board-filter'].includes(o.tool))throw new Error('笔触工具无效。');}
      if(['addLayer','replaceBackground'].includes(event.method)){
        const item=event.args[1],extra=event.args[event.method==='addLayer'?3:2]||{};resource(item);
        const keys=new Set(['name','x','y','scale','rotation','opacity','visible','sourceId','role','insertAt','frames','frameDuration']);if(Object.keys(extra).some(key=>!keys.has(key)))throw new Error('录像图层参数不受支持。');
        if(extra.insertAt!==undefined&&(!Number.isInteger(extra.insertAt)||extra.insertAt<0||extra.insertAt>19))throw new Error('录像图层顺序无效。');
        if(extra.frames){if(!Array.isArray(extra.frames)||extra.frames.length>60)throw new Error('动画帧数量无效。');extra.frames.forEach(resource);}
        const layer={id:'resource',name:event.args[0],x:0,y:0,scale:1,rotation:0,opacity:1,visible:true,...extra,width:item.width,height:item.height,image:item.image};if(extra.frames)layer.frames=extra.frames.map(frame=>frame.image);
        validateProject({format:'luoye-studio',version:1,title:'录像资源',width:1,height:1,layers:[layer]});
      }
      if(event.resultIds&&(!Array.isArray(event.resultIds)||event.resultIds.length>20||event.resultIds.some(id=>typeof id!=='string'||id.length>256)))throw new Error('动画实例标识无效。');
      if(['setPaintTexture','setPaperTexture'].includes(event.method)&&event.args[0])resource(event.args[0]);
      if(event.method==='setFairyGroups')groups(event.args[0]);
      if(event.method==='setStampImages'){if(!Array.isArray(event.args[0])||event.args[0].length>60)throw new Error('印章资源数量无效。');event.args[0].forEach(resource);}
      if(event.method==='resizeActiveObject'&&(!Number.isFinite(event.args[0])||event.args[0]<=0||event.args[0]>10))throw new Error('缩放比例无效。');
      if(event.method==='setProperty'){const [,key,value]=event.args;if(!PROPERTY_KEYS.has(key))throw new Error('图层属性不受支持。');if(key==='name'?(typeof value!=='string'||value.length>120):key==='visible'?typeof value!=='boolean':!Number.isFinite(value))throw new Error('图层属性值无效。');if(key==='scale'&&(value<=0||value>100)||key==='opacity'&&(value<0||value>1)||['x','y'].includes(key)&&Math.abs(value)>100000)throw new Error('图层属性值超出范围。');}
    }if(points>MAX_POINTS)throw new Error('录像笔触采样点过多。');
  }return raw;
}
function imageRecord(image){const c=makeCanvas(image.width,image.height);c.getContext('2d').drawImage(image,0,0);return {width:c.width,height:c.height,image:c.toDataURL()};}
async function imageFromRecord(item){
  validateProject({format:'luoye-studio',version:1,title:'录像资源',width:1,height:1,layers:[{id:'resource',name:'resource',width:item.width,height:item.height,x:0,y:0,scale:1,rotation:0,opacity:1,visible:true,image:item.image}]});
  const image=await loadImage(item.image);if(image.width!==item.width||image.height!==item.height)throw new Error('录像资源尺寸不一致。');const c=makeCanvas(item.width,item.height);c.getContext('2d').drawImage(image,0,0);return c;
}

export class Recorder {
  constructor(engine,onState=()=>{}){this.engine=engine;this.onState=onState;this.slots=Array(5).fill(null);this.slot=0;this.recording=false;this.depth=0;this.pending=null;this.attach();}
  async start(index,title){
    this.stop();this.engine.finishPath(true);const base=await this.engine.serialize(title);this.slot=index;this.slots[index]={base,events:[],paperMode:!!this.engine.paperMode};this.began=performance.now();this.recording=true;this.bytes=JSON.stringify(base).length;this.points=0;
    // Selection and tool sources are document-adjacent state and must be included at the boundary.
    // A PNG mask preserves non-rectangular selections without serializing millions of array entries.
    this.slots[index].paintTexture=this.engine.paintTexture?imageRecord(this.engine.paintTexture.canvas):null;this.slots[index].paperTexture=this.engine.paperTexture?imageRecord(this.engine.paperTexture.canvas):null;
    this.slots[index].selection=this.engine.selectionCanvas?imageRecord(this.engine.selectionCanvas):null;
    this.slots[index].cloneSource=this.engine.cloneSource?{point:{...this.engine.cloneSource.point},layerId:this.engine.cloneSource.layerId,image:this.engine.cloneSource.canvas?imageRecord(this.engine.cloneSource.canvas):undefined}:null;
    this.slots[index].fairyGroups=this.engine.fairyGroups?.map(group=>({...group,frames:group.frames.map(imageRecord)}))||null;this.slots[index].fairyMode=this.engine.fairyMode||null;
    this.slots[index].stampImages=this.engine.stampImages?.map(imageRecord)||[];
    this.bytes=JSON.stringify(this.slots[index]).length;this.onState();
  }
  stop(reason=''){if(this.pending&&this.engine.gesture)this.engine.end();this.recording=false;this.pending=null;this.onState(reason);}
  add(event){
    if(!this.recording)return;const bytes=JSON.stringify(event).length,points=event.method==='stroke'?event.args[0].length:0;
    if(this.bytes+bytes>MAX_BYTES||this.points+points>MAX_POINTS||this.slots[this.slot].events.length>=5000){this.stop('本段录像已达到容量上限，后续编辑未录入。');return;}
    this.bytes+=bytes;this.points+=points;this.slots[this.slot].events.push(event);this.onState();
  }
  event(method,args){return {method,args,activeId:this.engine.activeId,time:Math.round(performance.now()-this.began)};}
  attach(){
    const engine=this.engine,rec=this;
    const begin=engine.begin.bind(engine),update=engine.update.bind(engine),end=engine.end.bind(engine);
    engine.begin=function(point,options){const o={...options,seed:options.seed??(Date.now()>>>0)};if(rec.recording){rec.pending=rec.event('stroke',[[{...point}],o]);rec.beforeIds=new Set(engine.layers.map(layer=>layer.id));}rec.depth++;try{const result=begin(point,o);if(!engine.gesture&&rec.pending){rec.pending.resultIds=engine.layers.filter(layer=>!rec.beforeIds.has(layer.id)).map(layer=>layer.id);rec.add(rec.pending);rec.pending=null;}return result;}catch(e){rec.pending=null;throw e;}finally{rec.depth--;}};
    engine.update=function(point){if(rec.pending){if(rec.pending.args[0].length>=20000){rec.pending=null;rec.recording=false;rec.onState('单笔超过采样上限，本段录制已结束。');}else rec.pending.args[0].push({...point});}rec.depth++;try{return update(point);}finally{rec.depth--;}};
    const repeat=engine.repeatStamp.bind(engine);
    engine.repeatStamp=function(force=false){rec.depth++;let result;try{result=repeat(force);}finally{rec.depth--;}if(result&&rec.pending){const point=rec.pending.args[0].at(-1);if(rec.pending.args[0].length<20000)rec.pending.args[0].push({...point,repeat:true});else rec.stop('单笔超过采样上限，本段录制已结束。');}return result;};
    engine.end=function(cancel=false){rec.depth++;try{const result=end(cancel);if(rec.pending&&!cancel){rec.pending.resultIds=engine.layers.filter(layer=>!rec.beforeIds.has(layer.id)).map(layer=>layer.id);rec.add(rec.pending);}rec.pending=null;return result;}finally{rec.depth--;}};
    for(const method of COMMANDS){if(method==='stroke')continue;const original=engine[method]?.bind(engine);if(!original)continue;
      engine[method]=function(...args){if(!rec.recording||rec.depth)return original(...args);
        let encoded=args;
        if(method==='setProperty')encoded=[args[0].id,args[1],args[2]];
        if(method==='setFairyGroups')encoded=[args[0].map(group=>({...group,frames:group.frames.map(imageRecord)})),args[1]];
        if(['setPaintTexture','setPaperTexture'].includes(method))encoded=[args[0]?imageRecord(args[0]):null];
        if(method==='setStampImages')encoded=[args[0].map(imageRecord)];
        if(method==='addLayer'){
          const canvas=args[1]||makeCanvas(engine.width,engine.height),extra={...(args[3]||{})};if(extra.frames)extra.frames=extra.frames.map(imageRecord);
          encoded=[args[0]||'新的图层',imageRecord(canvas),true,extra];
        }
        if(method==='replaceBackground')encoded=[args[0],imageRecord(args[1]),args[2]];
        const event=rec.event(method,structuredClone(encoded));rec.depth++;
        try{const result=original(...args);if(result?.then)return result.then(value=>{if(value?.id)event.resultId=value.id;rec.add(event);return value;}).finally(()=>{rec.depth--;});if(result?.id)event.resultId=result.id;rec.add(event);rec.depth--;return result;}catch(error){rec.depth--;throw error;}
      };
    }
    // Undo/redo may reach before the recording boundary; stop rather than silently replaying a different document.
    for(const method of ['undo','redo','reset','restore']){const original=engine[method].bind(engine);engine[method]=function(...args){if(rec.recording)rec.stop('撤销、恢复或更换作品会结束当前录像段。');return original(...args);};}
  }
  export(){return validateRecording({format:'luoye-recording',version:1,slots:this.slots});}
  import(raw){const value=validateRecording(raw);this.stop();this.slots=structuredClone(value.slots);this.onState();}
  truncate(index,count){const slot=this.slots[index];if(slot)slot.events=slot.events.slice(0,count);this.onState();}
  async replay(index,count,canvas,style={},onStep=()=>{},signal){
    const slot=this.slots[index];if(!slot)throw new Error('这段录像还是空的。');
    validateRecording({format:'luoye-recording',version:1,slots:this.slots});
    const renderer=new this.engine.constructor(canvas,()=>{});clearInterval(renderer.animationTimer);cancelAnimationFrame(renderer.renderFrame);clearTimeout(renderer.renderDeadline);renderer.drawQueued=false;renderer.render=()=>{};
    try{
      await renderer.restore(slot.base);renderer.paperMode=!!slot.paperMode;
      if(slot.selection){const image=await imageFromRecord(slot.selection),data=image.getContext('2d').getImageData(0,0,image.width,image.height).data;if(image.width!==renderer.width||image.height!==renderer.height)throw new Error('录像选区尺寸无效。');const mask=new Uint8ClampedArray(renderer.width*renderer.height);for(let i=0;i<mask.length;i++)mask[i]=data[i*4+3];renderer.setSelection(mask);}
      renderer.setPaintTexture(slot.paintTexture?await imageFromRecord(slot.paintTexture):null);renderer.setPaperTexture(slot.paperTexture?await imageFromRecord(slot.paperTexture):null);
      renderer.cloneSource=slot.cloneSource?{...slot.cloneSource,canvas:slot.cloneSource.image?await imageFromRecord(slot.cloneSource.image):undefined}:null;if(slot.stampImages)renderer.setStampImages(await Promise.all(slot.stampImages.map(imageFromRecord)));
      if(slot.fairyGroups)renderer.setFairyGroups(await Promise.all(slot.fairyGroups.map(async group=>({...group,frames:await Promise.all(group.frames.map(imageFromRecord))}))),slot.fairyMode);
      const limit=Math.min(count,slot.events.length);let previous=0;
      for(let i=0;i<limit;i++){
        if(signal?.aborted)break;const event=slot.events[i],args=structuredClone(event.args);
        if(style.animate){const delay=Math.min(300,Math.max(16,event.time-previous));await new Promise(resolve=>setTimeout(resolve,delay));}previous=event.time;
        if(signal?.aborted)break;if(renderer.layers.some(l=>l.id===event.activeId))renderer.activeId=event.activeId;else throw new Error('录像引用的图层不存在。');
        let result;
        if(event.method==='stroke'){
          const [path,options]=args;if(style.color&&options.tool!=='eraser')options.color=style.color;if(style.opacity!==undefined)options.opacity=style.opacity;
          const beforeIds=new Set(renderer.layers.map(layer=>layer.id));renderer.begin(path[0],options);for(const point of path.slice(1)){if(point.repeat)renderer.repeatStamp(true);else renderer.update(point);};renderer.end();const created=renderer.layers.filter(layer=>!beforeIds.has(layer.id));if(event.resultIds){if(created.length!==event.resultIds.length)throw new Error('录像生成图层数量不一致。');created.forEach((layer,index)=>{const previous=layer.id;layer.id=event.resultIds[index];if(renderer.activeId===previous)renderer.activeId=layer.id;});}
        }else{
          if(event.method==='setProperty')args[0]=renderer.layers.find(l=>l.id===args[0]);
          if(event.method==='setFairyGroups')args[0]=await Promise.all(args[0].map(async group=>({...group,frames:await Promise.all(group.frames.map(imageFromRecord))})));
          if(['setPaintTexture','setPaperTexture'].includes(event.method))args[0]=args[0]?await imageFromRecord(args[0]):null;
          if(event.method==='setStampImages')args[0]=await Promise.all(args[0].map(imageFromRecord));
          if(event.method==='addLayer'){args[1]=await imageFromRecord(args[1]);if(args[3].frames)args[3].frames=await Promise.all(args[3].frames.map(imageFromRecord));}
          if(event.method==='replaceBackground')args[1]=await imageFromRecord(args[1]);
          result=await renderer[event.method](...args);
          if(event.resultId&&result?.id){const id=result.id;result.id=event.resultId;if(renderer.activeId===id)renderer.activeId=result.id;}
        }
        renderer.paint(renderer.ctx);onStep(i+1);if(i%10===0)await new Promise(resolve=>setTimeout(resolve,0));
      }
      renderer.paint(renderer.ctx);return await renderer.serialize(slot.base.title.slice(0,115)+' · 回放');
    }finally{clearInterval(renderer.animationTimer);}
  }
}
