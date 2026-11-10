import http from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=path.resolve(import.meta.dirname,'..');
const {chromium}=createRequire(import.meta.url)(process.env.LUOYE_PLAYWRIGHT||'/Users/zhaoxin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.json':'application/json'};
const server=http.createServer(async(req,res)=>{try{const file=path.resolve(root,'dist','.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(path.join(root,'dist')+path.sep)){res.writeHead(403).end();return;}const data=await readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream'});res.end(data);}catch{res.writeHead(404).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.LUOYE_BROWSER_EXECUTABLE?{executablePath:process.env.LUOYE_BROWSER_EXECUTABLE}:{})});const results=[];
try{
 for(const [width,height] of [[1600,1000],[2000,1200],[1000,600]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/tablet.html`);
  const frame=page.frames().find(f=>f!==page.mainFrame());await frame.waitForSelector('#about-open',{state:'attached'});
  await frame.evaluate(()=>document.getElementById('about-open').click());
  const result=await frame.evaluate(()=>{const d=document.getElementById('about-dialog'),r=d.getBoundingClientRect(),b=document.getElementById('about-close').getBoundingClientRect();return {open:d.open,links:d.querySelectorAll('a').length,emptyRow:!!d.querySelector('.about-links'),fits:r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,buttonFits:b.bottom<=innerHeight,version:d.querySelector('#about-version').textContent};});
  const passed=result.open&&result.links===0&&!result.emptyRow&&result.fits&&result.buttonFits&&!errors.length;results.push({width,height,passed,...result,errors});
  await mkdir(path.join(root,'build/store-layout'),{recursive:true});await page.screenshot({path:path.join(root,`build/store-layout/about-${width}.png`)});await page.close();
 }
 await writeFile(path.join(root,'build/store-layout/results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));if(results.some(x=>!x.passed))process.exitCode=1;
}finally{await browser.close();server.close();}
