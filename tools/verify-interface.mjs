import {createRequire} from 'node:module';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import {root} from './bundle.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.LUOYE_PLAYWRIGHT||'playwright');
const output=path.join(root,'build/interface-acceptance');await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const checks=[],errors=[],page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
page.on('console',msg=>{if(msg.text().startsWith('AUDIT '))console.log(msg.text());});
await context.addInitScript(()=>{
 window.auditClicks=new Set();document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;window.auditClicks.add(b.id||JSON.stringify(b.dataset)+' '+(b.getAttribute('aria-label')||b.textContent.trim()));},true);
});
const idle=async()=>{await page.waitForTimeout(25);await page.waitForFunction(()=>!document.body.hasAttribute('aria-busy'));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));};
const click=async selector=>{await page.locator(selector).click();await idle();};
const tool=async id=>{if(!await page.locator(`#tools [data-tool="${id}"]`).count())await click('#tool-page');await click(`#tools [data-tool="${id}"]`);};
const choose=async(id,value)=>{await click('#'+id+'-choose');await click(`#choice-grid [data-value="${value}"]`);};
const settings=async id=>{await click('#more-open');await click('#'+id);};
const project=()=>page.evaluate(async()=>(await window.LUOYEFlushBeforeClose()).project);
const picture=()=>page.locator('#painting').evaluate(c=>c.toDataURL());
async function draw(){const r=await page.locator('#painting').boundingBox();await page.mouse.move(r.x+r.width*.2,r.y+r.height*.3);await page.mouse.down();await page.mouse.move(r.x+r.width*.6,r.y+r.height*.6,{steps:8});await page.mouse.up();await idle();}
async function check(name,fn){try{await fn();checks.push({name,passed:true});console.log('PASS '+name);}catch(error){checks.push({name,passed:false,error:error.message});console.log('FAIL '+name+': '+error.message);await page.screenshot({path:path.join(output,'failure-'+checks.length+'.png')});await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));await idle();}}
try{
 await page.goto(process.env.LUOYE_TEST_URL||'http://127.0.0.1:4187');await page.waitForSelector('body[data-app-ready=true]');
 await check('所有画纸尺寸、取消、新建、重置与撤销重做',async()=>{
  const sizes=await page.locator('#preset option').evaluateAll(es=>es.map(e=>e.value));
  for(const size of sizes){await settings('paper-size-open');await choose('preset',size);await click('#new-dialog [value=create]');await page.waitForFunction(size=>[document.getElementById('painting').width,document.getElementById('painting').height].join(',')===size,size);assert.equal(await page.locator('#painting').evaluate(c=>[c.width,c.height].join(',')),size);}
  await settings('paper-size-open');await click('#new-dialog [value=cancel]');await click('#new');await click('#new-quick');
  const before=await picture();await draw();assert.notEqual(await picture(),before);await click('#undo');assert.equal(await picture(),before);await click('#redo');assert.notEqual(await picture(),before);await click('#reset-settings');assert.equal(await page.locator('#size').inputValue(),'14');
 });
 await check('顶部设置、命名、关于、显示、缩放按钮',async()=>{
  await click('#more-open');await page.getByRole('button',{name:'给画起名字',exact:true}).click();await page.locator('#title').fill('界面验收作品');await click('#title-done');assert.equal((await project()).title,'界面验收作品');
  await settings('about-open');assert.match(await page.locator('#about-version').innerText(),/^1\./);assert.equal(await page.locator('#about-dialog a').count(),2);await click('#about-close');await click('#more-open');await click('#more-done');
  await click('#display-open');for(const size of ['large','largest','auto']){await click(`[data-ui-size=${size}]`);assert.equal(await page.locator('body').getAttribute('data-ui-size'),size);}assert.equal(await page.locator('#window-sizes button:disabled').count(),4);await click('#display-close');
  for(const id of ['zoom-in','zoom-out','fit'])await click('#'+id);
 });
 await check('全部调色按钮、RGB 步进、纹理与纸纹选择',async()=>{
  await tool('pen');for(const b of await page.locator('.quick-palette .swatch').all())await b.click();
  for(const opener of ['foreground-palette','background-palette','palette-open','paint-color-open']){
   await click('#'+opener);for(const b of await page.locator('.palette-presets button').all())await b.click();await click('#palette-reset');await click('#palette-cancel');
  }
  await click('#foreground-palette');await page.locator('.color-numbers summary').click();for(const b of await page.locator('.color-numbers .number-stepper button').all())await b.click();await page.locator('#color-rgb-array').fill('[18, 52, 86]');await page.locator('#color-rgb-array').press('Tab');await click('#palette-apply');assert.equal(await page.locator('#color').inputValue(),'#123456');await click('#swap-colors');await click('#swap-colors');
  for(const b of await page.locator('#foreground-history button').all())await b.click();
  for(const value of ['texture-0','texture-1','color']){await click('#foreground-palette');await choose('paint-source',value);if(await page.locator('#palette-dialog').isVisible())await click('#palette-cancel');}
  for(const value of ['grain-0','grain-1','none'])await choose('paper-grain',value);
 });
 await check('文字全部样式、字体选择、数字步进、添加和取消',async()=>{
  await tool('text');await click('#text-options-open');await page.locator('#text-content').fill('你好，画板\n测试ABC');
  for(const b of await page.locator('#text-dialog .number-stepper button').all())await b.click();for(const b of await page.locator('.text-style input').all()){await b.click();await b.click();}
  const fonts=await page.locator('#text-font option').evaluateAll(es=>es.map(e=>e.value));for(const font of fonts)await choose('text-font',font);
  await choose('text-fill','texture');await click('#text-clear-texture');await choose('text-fill','color');const count=(await project()).layers.length;await click('#text-add');assert.equal((await project()).layers.length,count+1);await tool('text');await click('#text-options-open');await click('#text-cancel');
 });
 await check('图层新增、显隐、顺序、镜像、旋转、缩放、复制删除及高级操作',async()=>{
  await click('#layer-menu');await click('#add-layer');await click('#duplicate-layer');
  for(const id of ['layer-down','layer-up','mirror-x','mirror-y','smaller','bigger'])await click('#'+id);
  await page.locator('.layer-advanced summary').click();for(const id of ['rotate','rotate-90','flip-x','flip-y','animation-toggle','animation-toggle','freeze-animation'])await click('#'+id);
  await page.locator('#layer-opacity').fill('75');await page.locator('#layer-opacity').dispatchEvent('input');
  const download=page.waitForEvent('download');await click('#export-layer');assert.match((await download).suggestedFilename(),/\.png$/);
  await click('#clear-layer');await click('#merge-bottom');await click('#delete-layer');await click('#add-layer');await click('#move-selected-layer');await click('#undo');
  await click('#layer-menu');await click('#use-stamp');assert.equal(await page.locator('#painting').getAttribute('data-tool'),'stamp');await draw();await tool('pen');
 });
 await check('选区四种组合、全选反选取消与复制剪切粘贴',async()=>{
  await draw();await tool('select');await draw();for(const b of await page.locator('#selection-combination button').all())await b.click();
  for(const id of ['inline-select-all','inline-select-inverse','inline-select-none','inline-select-all','inline-copy','inline-cut']){if(await page.locator('#'+id).count())await click('#'+id);}
  await settings('paste');for(const id of ['select-all','select-inverse','select-none','select-all','clear-selection-pixels']){await settings('selection-menu');await click('#'+id);}
  await settings('copy');await settings('cut');await settings('paste');await tool('pen');
 });
 let saved;
 await check('工程保存重开及 PNG、JPEG 导出与取消',async()=>{
  await draw();const before=await project();const download=page.waitForEvent('download');await click('#save');const d=await download;saved=await readFile(await d.path());assert.equal(JSON.parse(saved).title,before.title);
  const chooser=page.waitForEvent('filechooser');await click('#open');await (await chooser).setFiles({name:'test.luoyex',mimeType:'application/json',buffer:saved});await idle();assert.deepEqual(await project(),before);
  for(const value of ['png','jpeg']){await click('#export');await choose('export-format',value);const dl=page.waitForEvent('download');await click('#export-dialog [value=export]');const f=await dl;assert.match(f.suggestedFilename(),value==='png'?/\.png$/:/\.jpg$/);assert((await readFile(await f.path())).length>100);}
  await click('#export');await click('#export-dialog [value=cancel]');
 });
 await check('画夹保存、打开、回收站与恢复',async()=>{
  await click('#gallery');await page.locator('#gallery-folder').fill('界面验收');await click('#gallery-save');const card=page.locator('.gallery-card').filter({hasText:'界面验收'}).first();await card.getByRole('button',{name:'移到回收站',exact:true}).click();await idle();await page.locator('#gallery-trash').check();await idle();await page.locator('.gallery-card').filter({hasText:'界面验收'}).first().getByRole('button',{name:'恢复',exact:true}).click();await idle();await page.locator('#gallery-trash').uncheck();await idle();await page.locator('.gallery-card').filter({hasText:'界面验收'}).first().getByRole('button',{name:'打开',exact:true}).click();await idle();await click('#gallery');await click('#gallery-close');
 });
 await check('录像五段选择、镜像录制、逐步播放、截断、导入导出',async()=>{
  await settings('recordings');for(const value of ['1','2','3','4','0'])await choose('record-slot',value);await click('#record-start');await draw();await click('#layer-menu');await click('#mirror-x');await click('#mirror-y');await click('#layer-dialog [data-close]');await settings('recordings');await click('#record-stop');
  for(const id of ['record-first','record-next','record-prev','record-last'])await click('#'+id);await page.locator('#record-current-color').check();await click('#record-play');await click('#record-pause');await page.locator('#record-current-color').uncheck();
  const dl=page.waitForEvent('download');await click('#record-export');const recording=await readFile(await (await dl).path());assert(JSON.parse(recording).slots[0].events.some(e=>e.method==='setProperty'&&e.args[1]==='flipX'));
  const chooser=page.waitForEvent('filechooser');await click('#record-import');await (await chooser).setFiles({name:'test.luoyer',mimeType:'application/json',buffer:recording});await idle();await click('#record-first');await click('#record-truncate');assert.equal(await page.locator('#record-position').getAttribute('max'),'0');await click('#record-close');
 });
 await check('图片、文字底纹和画笔纹理的文件入口',async()=>{
  const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=32;const g=c.getContext('2d');g.fillStyle='#3567ab';g.fillRect(0,0,32,32);return c.toDataURL().split(',')[1];});const fixture={name:'test.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')};
  let chooser=page.waitForEvent('filechooser');await settings('import-image');await (await chooser).setFiles(fixture);await idle();await tool('text');await click('#text-options-open');chooser=page.waitForEvent('filechooser');await click('#text-import-texture');await (await chooser).setFiles(fixture);await idle();await click('#text-clear-texture');await click('#text-cancel');
  await tool('pen');await click('#foreground-palette');chooser=page.waitForEvent('filechooser');await choose('paint-source','custom');await (await chooser).setFiles(fixture);await idle();
 });
 await check('32 项暗房效果及三个色彩函数通道',async()=>{
  await tool('pen');await draw();const before=await picture(),groups=await page.locator('#darkroom-categories button').allTextContents();let count=0;
  for(const group of groups){await click('#darkroom');await page.locator('#darkroom-categories button').filter({hasText:group}).click();const values=await page.locator('#effect-kind option').evaluateAll(es=>es.map(e=>e.value));await click('#darkroom-dialog [data-close]');
   for(const value of values){await click('#darkroom');await page.locator('#darkroom-categories button').filter({hasText:group}).click();await choose('effect-kind',value);
    if(value==='function'){const ids=await page.locator('#function-modes select').evaluateAll(es=>es.map(e=>e.id));for(const id of ids)for(const v of ['cos','none','sin'])await choose(id,v);}
    await click('#apply-effect');await click('#undo');assert.equal(await picture(),before,value+' undo');count++;
   }
  }assert.equal(count,32);
 });
 await check('图库全部分类、子分类、翻页和 1582 张素材按钮',async()=>{
  const result=await page.evaluate(async()=>{
   const pause=ms=>new Promise(r=>setTimeout(r,ms)),idle=async()=>{while(document.body.hasAttribute('aria-busy'))await pause(5);},click=async b=>{if(!b)throw Error('缺少按钮');b.click();await idle();},seen=new Set(),categories=[];
   document.getElementById('mode-library').click();await idle();
   for(const cat of [...document.querySelectorAll('#categories button')].map(b=>b.dataset.category)){
    await click(document.querySelector(`[data-category="${cat}"]`));categories.push(cat);
    if(cat!=='fairy'){const names=[...document.querySelectorAll('#library-groups button')].map(b=>b.textContent);for(const name of names)await click([...document.querySelectorAll('#library-groups button')].find(b=>b.textContent===name));if(names.length)await click(document.querySelector('#library-groups button'));}
    const modes=cat==='fairy'?['single','static','dynamic']:[null];
    for(const mode of modes){if(mode)await click(document.querySelector(`[data-fairy-mode="${mode}"]`));
     for(;;){const cards=[...document.querySelectorAll('#asset-grid button')];for(const card of cards){const id=card.dataset.assetId;await click(card);if(card.getAttribute('aria-pressed')!=='true')throw Error('素材没有加载：'+id+' '+document.getElementById('tool-hint').textContent);seen.add(id);if(cat!=='fairy')await click(document.getElementById('undo'));if(seen.size%100===0)console.log('AUDIT 已检查素材 '+seen.size);}
      const next=document.querySelector('#library-pagination button:last-child');if(next.disabled)break;await click(next);
     }
     const prev=document.querySelector('#library-pagination button:first-child');if(!prev.disabled)await click(prev);
    }
   }
   const missing=window.LUOYE_ASSETS.filter(a=>!seen.has(a.id)).map(a=>a.id);return {assets:seen.size,categories,missing};
  });assert.deepEqual(result.missing,[]);assert.equal(result.assets,1582);checks.push({name:'图库素材明细',passed:true,...result});await click('#mode-board');
 });
 await page.screenshot({path:path.join(output,'interface.png')});
 const clicked=await page.evaluate(()=>[...window.auditClicks]);await writeFile(path.join(output,'buttons.json'),JSON.stringify(clicked,null,2));
 checks.push({name:'无未处理的 JavaScript 异常',passed:errors.length===0,errors});
 await writeFile(path.join(output,'report.json'),JSON.stringify({passed:checks.every(c=>c.passed),buttonIdentities:clicked.length,checks},null,2));
 if(checks.some(c=>!c.passed))process.exitCode=1;
}finally{await context.close();await browser.close();}
