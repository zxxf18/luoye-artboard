import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import {root} from './bundle.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.LUOYE_PLAYWRIGHT||'playwright');
const server=spawn(process.execPath,['tools/server.mjs'],{cwd:root,env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
let browser;
try{
 const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),10000);server.on('error',reject);server.stdout.on('data',data=>{const match=String(data).match(/http:\/\/127.0.0.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});});
 browser=await chromium.launch({headless:true,...(process.env.LUOYE_BROWSER_EXECUTABLE?{executablePath:process.env.LUOYE_BROWSER_EXECUTABLE}:{})});
 const results=[];
 for(const name of (process.argv.slice(2).length?process.argv.slice(2):['browser','brushes','editor','creative','frames','interactions','layout','paper-scope','animated-filters','stamps'])){
  if(!/^[a-z-]+$/.test(name))throw Error('Invalid test name');
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{await page.goto(url+'/tests/'+name+'.html');await page.waitForFunction(()=>/\d+\/\d+ passed/.test(document.title),null,{timeout:120000});const status=await page.title(),counts=status.match(/(\d+)\/(\d+) passed/);results.push({name,passed:counts[1]===counts[2]&&!errors.length,status,errors,details:await page.locator('ol').innerText()});}catch(e){results.push({name,passed:false,error:e.message,errors});}finally{await page.close();}
  console.log(name+': '+(results.at(-1).passed?'PASS':'FAIL'));
 }
 const output=process.env.LUOYE_BROWSER_EVIDENCE||'build/browser-acceptance.json';await mkdir(new URL('.',new URL(output,'file://'+root)),{recursive:true});await writeFile(output,JSON.stringify(results,null,2)+'\n');if(results.some(r=>!r.passed))process.exitCode=1;
}finally{await browser?.close();server.kill();}
