import { makeCanvas } from './engine.js';
import { blendMasked } from './pixels.js';

// A transaction builds replacement pixels separately; animation and the current
// document remain live until every frame succeeds. Cancelling never commits half a filter.
export function* paperEffectSteps(engine, callback) {
  const before=engine.layers.slice(),next=[],paperPixels=engine.width*engine.height;
  const affected=space=>!callback.worldRegion||Math.hypot(space.x-callback.worldRegion.x,space.y-callback.worldRegion.y)<callback.worldRegion.radius+Math.hypot(space.width,space.height)*space.scale/2;
  const plans=new Map();let predicted=0;
  for(const layer of before){
    if(!layer.visible||!layer.opacity){predicted+=engine.layerPixels(layer);continue;}
    if(layer.sprites){
      const groups=[],sprites=[],keys=new Map();
      for(const [index,item] of layer.sprites.entries()){
        const group=layer.spriteGroups[item.group],base=group.frames[0],scale=item.size/Math.max(base.width,base.height),angle=layer.rotation*Math.PI/180;
        const dx=(item.x-layer.width/2)*layer.scale*(layer.flipX?-1:1),dy=(item.y-layer.height/2)*layer.scale*(layer.flipY?-1:1);
        const space={width:base.width,height:base.height,x:layer.x+dx*Math.cos(angle)-dy*Math.sin(angle),y:layer.y+dx*Math.sin(angle)+dy*Math.cos(angle),rotation:layer.rotation,flipX:layer.flipX,flipY:layer.flipY,scale:layer.scale*scale};
        const process=affected(space),key=!process?'original-'+item.group:callback.spaceIndependent&&!engine.selection?'effect-'+item.group:'instance-'+index;
        if(!keys.has(key)){keys.set(key,groups.length);groups.push({group,space,process});}
        sprites.push({...item,group:keys.get(key)});
      }
      if(groups.length>200)throw Error('这片区域的动态图案比较多，请缩小滤镜范围后再试。原画还保留着。');
      plans.set(layer,{groups,sprites});
      predicted+=layer.width*layer.height*(1+(layer.spriteClip?1:0)+(layer.eraseMask?1:0));
      for(const item of groups)predicted+=item.group.frames.reduce((n,f)=>n+f.width*f.height,0);
    }else predicted+=layer.frames?.length?engine.layerPixels(layer):paperPixels;
  }
  if(predicted>90000000||predicted+before.reduce((n,l)=>n+engine.layerPixels(l),0)>120000000)throw Error('这幅画的动画比较多，请分几次处理或减少一些重复图案。原画还保留着。');
  function process(canvas,space,mask){
    const ctx=canvas.getContext('2d'),pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
    const candidate=callback(pixels.data,canvas.width,canvas.height,space);
    ctx.putImageData(new ImageData(blendMasked(pixels.data,candidate,mask),canvas.width,canvas.height),0,0);return canvas;
  }
  for(const layer of before){
    if(!layer.visible||!layer.opacity){next.push(layer);continue;}
    if(layer.frames?.length){
      if(!affected(layer)){next.push(layer);continue;}
      const frames=[],mask=engine.layerMask(layer);
      for(const frame of layer.frames){const c=makeCanvas(layer.width,layer.height);engine.drawLayer(c.getContext('2d'),{...layer,frames:[frame]},0);frames.push(process(c,layer,mask));yield;}
      const updated={...layer,canvas:frames[0],frames};delete updated.eraseMask;next.push(updated);
    }else if(layer.sprites){
      const spriteGroups=[],{groups,sprites}=plans.get(layer);
      for(const {group,space,process:shouldProcess} of groups){
        if(!shouldProcess){spriteGroups.push(group);continue;}
        const frames=[],mask=engine.layerMask(space);
        for(const frame of group.frames){const c=makeCanvas(frame.width,frame.height);c.getContext('2d').drawImage(frame,0,0);frames.push(process(c,space,mask));yield;}
        spriteGroups.push({...group,frames});
      }
      const canvas=makeCanvas(layer.width,layer.height),updated={...layer,canvas,spriteGroups,sprites};engine.drawLayer(canvas.getContext('2d'),updated,0);next.push(updated);
    }else{
      const c=makeCanvas(engine.width,engine.height),ctx=c.getContext('2d');ctx.save();engine.transform(ctx,layer);engine.drawLayer(ctx,layer);ctx.restore();
      process(c,null,engine.selection);yield;
      const updated={...layer,canvas:c,width:engine.width,height:engine.height,x:engine.width/2,y:engine.height/2,scale:1,rotation:0,flipX:false,flipY:false};delete updated.eraseMask;next.push(updated);
    }
  }
  // Any unexpected concurrent edit invalidates the transaction rather than overwriting it.
  if(engine.layers.length!==before.length||engine.layers.some((l,i)=>l!==before[i]))throw Error('画面已变化，请重新应用效果。');
  engine.layers=next;engine.history.push({bytes:[...before,...next].reduce((n,l)=>n+engine.layerPixels(l)*4,0),undo:()=>{engine.layers=before;},redo:()=>{engine.layers=next;}});engine.changed();
}
export function runPaperEffect(engine, callback) {
  const steps=paperEffectSteps(engine,callback);
  if(!engine.asyncEffects){for(const unused of steps){}return;}
  return (async()=>{
    engine.effectCancelled=false;engine.effectRunning=true;engine.onEffectProgress?.(true);
    try{let slice=performance.now();await new Promise(r=>setTimeout(r,0));
      while(true){if(engine.effectCancelled)throw new DOMException('已取消效果，原画保持不变','AbortError');const step=steps.next();if(step.done)break;if(performance.now()-slice>8){await new Promise(r=>setTimeout(r,0));slice=performance.now();}}
    }finally{steps.return();engine.effectRunning=false;engine.onEffectProgress?.(false);}
  })();
}
