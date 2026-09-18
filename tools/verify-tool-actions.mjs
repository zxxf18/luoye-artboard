import {createRequire} from 'node:module';import{mkdir,writeFile}from'node:fs/promises';import assert from'node:assert/strict';
const{chromium}=createRequire(import.meta.url)(process.env.LUOYE_PLAYWRIGHT||'playwright');const output='build/interface-acceptance';await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:1000}}),checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
const idle=async()=>{await page.waitForTimeout(25);await page.waitForFunction(()=>!document.body.hasAttribute('aria-busy'));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));},click=async s=>{await page.locator(s).click();await idle();};
const tool=async id=>{if(!await page.locator(`[data-tool="${id}"]`).count())await click('#tool-page');await click(`#tools [data-tool="${id}"]`);};
const canvas=page.locator('#painting'),picture=()=>canvas.evaluate(c=>c.toDataURL());
async function draw(from=[.3,.4],to=[.6,.65]){const r=await canvas.boundingBox();await page.mouse.move(r.x+r.width*from[0],r.y+r.height*from[1]);await page.mouse.down();await page.mouse.move(r.x+r.width*to[0],r.y+r.height*to[1],{steps:8});await page.mouse.up();await idle();}
try{
 await page.goto(process.env.LUOYE_TEST_URL||'http://127.0.0.1:4187');await page.waitForSelector('body[data-app-ready=true]');
 await click('.brush-box [data-brush=tube]');await draw();await click('#stroke-buttons [data-stroke-mode=line]');await draw([.3,.6],[.6,.3]);await click('#stroke-buttons [data-stroke-mode=free]');
 await tool('picker');await draw([.45,.525],[.45,.525]);assert.equal(await canvas.getAttribute('data-tool'),'pen');checks.push({name:'自由画、直线按钮及真实取色',passed:true});
 await tool('clone');await click('#clone-source');await draw([.45,.525],[.45,.525]);const before=await picture();await draw([.25,.7],[.4,.8]);assert.notEqual(await picture(),before);await click('#undo');assert.equal(await picture(),before);checks.push({name:'仿制源按钮、实际仿制和撤销',passed:true});
 await tool('select');await draw();assert(await page.locator('#selection-reset').isVisible());await click('#selection-reset');assert(!await page.locator('#selection-reset').isVisible());await tool('magic');await draw([.45,.525],[.45,.525]);assert(await page.locator('#selection-reset').isVisible());await click('#selection-reset');checks.push({name:'圈选、魔力棒与取消圈选按钮',passed:true});
 await tool('move');for(const id of ['object-smaller','object-bigger'])await click('#'+id);checks.push({name:'移动工具的快捷变小、变大',passed:true});
 await tool('board-filter');
 const variants=await page.locator('#board-filter-kind option').evaluateAll(es=>es.map(e=>({value:e.value,label:e.textContent})));
 for(const variant of variants){await page.locator('.subtool-box button').filter({hasText:variant.label}).click();await idle();if(variant.value==='waterfall'){for(const value of ['left','right']){await click('#filter-direction-choose');await click(`#choice-grid [data-value=${value}]`);}}
  const before=await picture();await click('#filter-preview-button');await click('#board-cancel');assert.equal(await picture(),before);await click('#filter-preview-button');await click('#board-apply');await click('#undo');assert.equal(await picture(),before,variant.value+' undo');
 }checks.push({name:'五种画板滤镜预览、取消、应用、撤销和方向按钮',passed:true});
 await tool('stamp');await click('#library-groups [data-fairy-mode=dynamic]');await click('#asset-grid button:first-child');await draw();await tool('eraser');await click('#clear-animations');await click('#undo');checks.push({name:'动图魔法袋与清除所有动图按钮',passed:true});
 await tool('board-filter');await page.locator('.subtool-box button').filter({hasText:'瀑布滤镜'}).click();await click('#filter-preview-button');
 await page.evaluate(()=>{document.getElementById('board-apply').click();document.getElementById('cancel-effect').click();});await idle();assert.equal(await page.locator('#effect-progress').isVisible(),false);assert.equal(await page.locator('#board-cancel').isVisible(),false);checks.push({name:'长效果处理的取消按钮可恢复操作',passed:true});
 await tool('pen');await click('#paper-grain-choose');await click('#choice-cancel');checks.push({name:'通用选项对话框返回按钮',passed:true});
 assert.deepEqual(errors,[]);await writeFile(output+'/tool-actions.json',JSON.stringify({passed:true,checks},null,2));console.log(checks);
}catch(error){await writeFile(output+'/tool-actions.json',JSON.stringify({passed:false,checks,error:error.message,errors},null,2));console.error(error);process.exitCode=1;}finally{await browser.close();}
