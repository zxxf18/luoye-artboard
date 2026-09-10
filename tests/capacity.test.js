import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProject} from '../src/core.js';
import {PaintEngine} from '../src/engine.js';

test('shared immutable frames count once, independent layer masks count separately',()=>{
  const frame={width:1000,height:1000},groups=[{frames:[frame,frame]}];
  const a={width:100,height:100,spriteGroups:groups},b={...a,eraseMask:{}};
  assert.equal(PaintEngine.prototype.scenePixels.call({},[a,b]),1_030_000);
  assert.equal(PaintEngine.prototype.scenePixels.call({},[a,{...b,spriteGroups:[{frames:[{...frame}]}]}]),2_030_000);
});

test('100000 instances per layer and 500000 per project have explicit validated boundaries',()=>{
  const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS5kAAAAASUVORK5CYII=';
  const layer={id:'a',name:'草地',width:1,height:1,x:0,y:0,scale:1,rotation:0,opacity:1,visible:true,image,sprites:Array.from({length:100000},()=>({group:0,x:0,y:0,size:16,opacity:1})),spriteGroups:[{frameDuration:160,frames:[{width:1,height:1,image}]}]};
  const project={format:'luoye-studio',version:1,width:1,height:1,title:'草地',layers:Array.from({length:5},(_,i)=>({...layer,id:String(i)}))};
  assert.doesNotThrow(()=>validateProject(project));
  assert.throws(()=>validateProject({...project,layers:[{...layer,sprites:[...layer.sprites,layer.sprites[0]]}]}),/组合/);
  assert.throws(()=>validateProject({...project,layers:[...project.layers,{...layer,id:'extra',sprites:[layer.sprites[0]]}]}),/500,000/);
});
