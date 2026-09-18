import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {root} from './bundle.mjs';
const {chromium}=createRequire(import.meta.url)(process.env.LUOYE_PLAYWRIGHT||'playwright');
const server=spawn(process.execPath,['tools/server.mjs'],{cwd:root,env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
let browser;
try{
 const url=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),10000);server.on('error',reject);server.stdout.on('data',data=>{const match=String(data).match(/http:\/\/127.0.0.1:\d+/);if(match){clearTimeout(timer);resolve(match[0]);}});});
 browser=await chromium.launch({headless:true,...(process.env.LUOYE_BROWSER_EXECUTABLE?{executablePath:process.env.LUOYE_BROWSER_EXECUTABLE}:{})});
 const results=[];
 for(const name of (process.argv.slice(2).length?process.argv.slice(2):['browser','brushes','editor','creative','frames','interactions','layout','paper-scope','animated-filters','stamps','ui-regressions'])){
  if(!/^[a-z-]+$/.test(name))throw Error('Invalid test name');
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(url+'/tests/'+name+'.html');
   await page.waitForFunction(()=>{
    if(document.body.dataset.results||/\d+\/\d+ passed/.test(document.title))return true;
    try{return Array.isArray(JSON.parse(document.querySelector('#result')?.textContent).checks);}catch{return false;}
   },null,{timeout:120000});
   const result=await page.evaluate(()=>{
    const serialized=document.body.dataset.results;
    const report=serialized?JSON.parse(serialized):document.querySelector('#result')?JSON.parse(document.querySelector('#result').textContent):null;
    const checks=Array.isArray(report)?report:report?.checks;
    const counts=document.title.match(/(\d+)\/(\d+) passed/);
    const passed=checks?checks.length>0&&checks.every(check=>(check.passed??check.ok)===true)&&report?.passed!==false:!!counts&&Number(counts[1])===Number(counts[2])&&Number(counts[2])>0;
    return {passed,status:checks?`${checks.filter(check=>check.passed??check.ok).length}/${checks.length} passed`:document.title,details:checks||document.querySelector('#results, ol')?.innerText};
   });
   results.push({name,...result,passed:result.passed&&!errors.length,errors});
  }catch(e){results.push({name,passed:false,error:e.message,errors});}finally{await page.close();}
  console.log(name+': '+(results.at(-1).passed?'PASS':'FAIL'));
 }
 const output=path.resolve(root,process.env.LUOYE_BROWSER_EVIDENCE||'build/browser-acceptance.json');await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(results,null,2)+'\n');if(results.some(r=>!r.passed))process.exitCode=1;
}finally{await browser?.close();server.kill();}
