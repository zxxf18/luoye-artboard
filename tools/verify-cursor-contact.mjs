import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {root} from './bundle.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.LUOYE_PLAYWRIGHT||'playwright');
const output=path.resolve(root,process.env.LUOYE_FEEDBACK_EVIDENCE||'build/feedback-acceptance');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),context=await browser.newContext({viewport:{width:1440,height:900}});
const checks=[],errors=[],page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto(process.env.LUOYE_TEST_URL||'http://127.0.0.1:4187');await page.waitForSelector('body[data-app-ready=true]');
  const canvas=page.locator('#painting'),painted=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  for(const mode of ['fit','zoom','compact']) {
    if(mode==='zoom')await page.locator('#zoom-in').click();
    if(mode==='compact'){await page.setViewportSize({width:900,height:650});await page.reload();await page.waitForSelector('body[data-app-ready=true]');}
    await painted();
    const target=await canvas.evaluate(c=>{
      const r=c.getBoundingClientRect(),x=Math.floor(c.width*.43),y=Math.floor(c.height*.46);
      return {x,y,screenX:r.left+(x+.5)*r.width/c.width,screenY:r.top+(y+.5)*r.height/c.height,scale:r.width/c.width};
    });
    const pixels=()=>canvas.evaluate((c,p)=>Array.from(c.getContext('2d').getImageData(p.x-12,p.y-12,25,25).data),target);
    const hit=await page.evaluate(p=>({element:document.elementFromPoint(p.screenX,p.screenY)?.outerHTML.slice(0,300),tool:document.getElementById('painting').dataset.tool,dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id)}),target);
    assert.equal(hit.element?.startsWith('<canvas'),true,JSON.stringify({mode,target,hit}));
    const before=await pixels();await page.mouse.click(target.screenX,target.screenY);await painted();const after=await pixels();
    assert(after.some((n,i)=>n!==before[i]),mode+' nib click draws at the indicated pixel');
    const nearCenter=after.slice((12*25+12)*4,(12*25+12)*4+3),oldCenter=before.slice((12*25+12)*4,(12*25+12)*4+3);
    assert.notDeepEqual(nearCenter,oldCenter,mode+' center pixel is under the pencil tip');
    assert((await canvas.evaluate(c=>getComputedStyle(c).cursor)).endsWith('8 36, crosshair'));
    checks.push({name:mode+' real mouse click lands at pencil tip',passed:true,...target});
    await page.locator('#undo').click();await painted();
  }
  const contacts=await page.evaluate(async()=>{
    const {TOOL_FEEDBACK}=await import('/src/tool-feedback.js'),{toolCursor}=await import('/src/tool-cursors.js');
    const keys=['pen:pencil','pen:spray','pen:watercolor','pen:brush','pen:marker','pen:crayon','pen:chalk','pen:tube','eraser:hard','eraser:soft','fill:region','fill:ellipse-gradient','magic:default','picker:default','geometry:line','clone:default'];
    return keys.map(key=>{const e=TOOL_FEEDBACK.find(e=>e.key===key);return {...toolCursor(e),label:e.label};});
  });
  const gallery=await context.newPage();await gallery.setViewportSize({width:1100,height:1000});
  await gallery.setContent(`<html><head><meta charset="utf-8"><style>body{font:15px system-ui;color:#705142;background:#fff6e2;padding:24px}main{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}article{background:#fffdf6;border:1px solid #dec6a1;border-radius:12px;padding:14px;text-align:center}.image{position:relative;width:160px;height:160px;margin:auto}img{width:160px;height:160px}.vertical,.horizontal{position:absolute;background:#d23d6655}.vertical{top:0;bottom:0;width:1px}.horizontal{left:0;right:0;height:1px}h2{font-size:16px;margin:8px 0}</style></head><body><h1>光标落点验收 · 放大 4 倍</h1><p>辅助线交点表示实际操作位置；辅助线仅用于验收，不显示在画板光标中。</p><main>${contacts.map(c=>`<article><div class="image"><img src="data:image/svg+xml,${encodeURIComponent(c.svg)}"><i class="vertical" style="left:${c.hotspot[0]*4}px"></i><i class="horizontal" style="top:${c.hotspot[1]*4}px"></i></div><h2>${c.label}</h2></article>`).join('')}</main></body></html>`);
  await gallery.screenshot({path:path.join(output,'cursor-contacts.png'),fullPage:true});
  assert.deepEqual(errors,[]);await writeFile(path.join(output,'cursor-contact-report.json'),JSON.stringify({checks,errors},null,2)+'\n');
  console.log('PASS actual mouse drawing lands at pencil nib in fit, zoom and compact layouts');
} catch(error) {await page.screenshot({path:path.join(output,'contact-failure.png')});throw error;} finally {await browser.close();}
