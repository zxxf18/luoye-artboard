import { makeCanvas } from './engine.js';
import { toLayerPoint } from './core.js';
import { brushSegment } from './brushes.js';

// Erasure belongs to the content it erases. A mask above the entire scene would
// erase future strokes and replacement backgrounds as well (a permanent hole).
export function beginPaperErase(engine, point, options) {
  options={...options,color:'#000000'}; // Only alpha matters; erasers do not depend on the paint color.
  const editable=engine.layers.filter(l=>l.visible&&l.opacity>0&&l.role!=='background');
  if(engine.scenePixels()+editable.filter(l=>!l.eraseMask).reduce((n,l)=>n+l.width*l.height,0)>90000000)throw new Error('画面太复杂，请先减少部分图层，再使用橡皮。');
  const targets=editable.map(layer=>{
    const canvas=makeCanvas(layer.width,layer.height),ctx=canvas.getContext('2d');
    if(layer.eraseMask)ctx.drawImage(layer.eraseMask,0,0);else{ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);}
    const target={layer,before:layer.eraseMask,canvas,tiles:new Map(),last:toLayerPoint(point,layer)};
    layer.eraseMask=canvas;return target;
  });
  engine.gesture={kind:'paper-erase',targets,options,start:point,end:point};
  updatePaperErase(engine,point);
}
export function updatePaperErase(engine,point) {
  const g=engine.gesture;g.end=point;
  if(g.options.eraserMode==='rect'){engine.render();return;}
  for(const t of g.targets){
    const next=toLayerPoint(point,t.layer),layer={...t.layer,canvas:t.canvas},gBrush={layer,options:g.options};
    const padding=g.options.size/layer.scale*2+4,bounds={x:Math.min(t.last.x,next.x)-padding,y:Math.min(t.last.y,next.y)-padding,width:Math.abs(t.last.x-next.x)+2*padding,height:Math.abs(t.last.y-next.y)+2*padding};
    engine.captureTiles(layer,bounds,t.tiles);brushSegment(t.canvas.getContext('2d'),gBrush,t.last,next);engine.maskTiles(layer,t.tiles,engine.layerMask(layer),bounds);t.last=next;
  }
  engine.render();
}
export function endPaperErase(engine,cancel) {
  const g=engine.gesture;
  if(g.options.eraserMode==='rect'&&!cancel){
    for(const t of g.targets){
      const layer={...t.layer,canvas:t.canvas},ctx=t.canvas.getContext('2d');
      engine.captureTiles(layer,{x:0,y:0,width:layer.width,height:layer.height},t.tiles);
      // Map a rectangle on the paper to each rotated/scaled layer.
      ctx.save();ctx.translate(layer.width/2,layer.height/2);ctx.scale(1/layer.scale,1/layer.scale);ctx.rotate(-layer.rotation*Math.PI/180);ctx.translate(-layer.x,-layer.y);
      ctx.globalCompositeOperation='destination-out';ctx.fillRect(Math.min(g.start.x,g.end.x),Math.min(g.start.y,g.end.y),Math.abs(g.end.x-g.start.x),Math.abs(g.end.y-g.start.y));ctx.restore();engine.maskTiles(layer,t.tiles);
    }
  }
  const modified=g.targets.filter(t=>t.tiles.size);
  // A fully covered animated stamp has no visible pixels left. Remove that
  // instance as well as masking partial overlaps, so erasing frees capacity.
  if(!cancel&&g.options.eraserMode==='rect'&&!engine.selectionCanvas){
    const left=Math.min(g.start.x,g.end.x),right=Math.max(g.start.x,g.end.x),top=Math.min(g.start.y,g.end.y),bottom=Math.max(g.start.y,g.end.y);
    for(const t of modified)if(t.layer.sprites){
      const l=t.layer,angle=l.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
      t.beforeSprites=l.sprites;t.afterSprites=l.sprites.filter(item=>{
        const dx=(item.x-l.width/2)*l.scale,dy=(item.y-l.height/2)*l.scale,x=l.x+dx*c-dy*s,y=l.y+dx*s+dy*c,r=item.size*l.scale*(Math.abs(c)+Math.abs(s))/2;
        return x-r<left||x+r>right||y-r<top||y+r>bottom;
      });l.sprites=t.afterSprites;
    }
  }
  const restore=()=>{for(const t of g.targets){t.layer.eraseMask=t.before;if(t.beforeSprites)t.layer.sprites=t.beforeSprites;}};
  if(cancel)restore();else{
    for(const t of g.targets)if(!t.tiles.size)t.layer.eraseMask=t.before;
    if(modified.length)engine.history.push({bytes:modified.reduce((n,t)=>n+t.canvas.width*t.canvas.height*4+(t.beforeSprites?.length||0)*48,0),undo:restore,redo:()=>{for(const t of modified){t.layer.eraseMask=t.canvas;if(t.afterSprites)t.layer.sprites=t.afterSprites;}}});
  }
  engine.gesture=null;engine.changed();
}

// Keep each object independent while a distortion gesture crosses several layers.
// Only touched layers are materialized. Undo restores animation and transforms.
export function beginPaperWarp(engine,point,options){
  engine.gesture={kind:'paper-warp',options,targets:engine.layers.filter(l=>l.visible&&l.opacity>0).map(layer=>({layer,before:{...layer},last:toLayerPoint(point,layer)}))};
  if(options.warpKind==='zoom')updatePaperWarp(engine,point);
}
export function updatePaperWarp(engine,point){
  const outer=engine.gesture;
  try{for(const target of outer.targets){
    const local=toLayerPoint(point,target.layer),r=(outer.options.radius||120)/target.layer.scale;
    if(local.x+r<0||local.y+r<0||local.x-r>target.layer.width||local.y-r>target.layer.height){target.last=local;continue;}
    if(!target.edit){
      const canvas=makeCanvas(target.layer.width,target.layer.height);engine.drawLayer(canvas.getContext('2d'),target.layer);
      target.edit={kind:'warp',layer:target.layer,options:outer.options,last:target.last,tiles:new Map()};target.layer.canvas=canvas;
      for(const key of ['frames','sprites','spriteGroups','spriteMask','spriteClip','eraseMask'])delete target.layer[key];
    }
    engine.gesture=target.edit;engine.warpDab(local);target.last=local;
  }}finally{engine.gesture=outer;}engine.render();
}
export function endPaperWarp(engine,cancel){
  const targets=engine.gesture.targets.filter(t=>t.edit);
  const assign=(layer,value)=>{for(const key of Object.keys(layer))if(!(key in value))delete layer[key];Object.assign(layer,value);};
  const before=()=>{for(const t of targets)assign(t.layer,t.before);};
  if(cancel)before();else if(targets.length){for(const t of targets)t.after={...t.layer};engine.history.push({bytes:targets.reduce((n,t)=>n+engine.layerPixels(t.before)*4+t.layer.width*t.layer.height*4,0),undo:before,redo:()=>{for(const t of targets)assign(t.layer,t.after);}});}
  engine.gesture=null;engine.changed();
}
