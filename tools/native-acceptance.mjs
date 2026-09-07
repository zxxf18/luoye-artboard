import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {root} from './bundle.mjs';
const {version}=JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
const output=path.join(root,'design/versions','v'+version,'evidence'),scratch=path.join(root,'build/acceptance','v'+version);
await mkdir(output,{recursive:true});await mkdir(scratch,{recursive:true});
const tests=process.argv.slice(2);
if(!tests.length)throw Error('Specify native test names, without .js');
const results=[];
for(const name of tests){
  if(!/^native-[a-z0-9-]+$/.test(name))throw Error('Invalid test name');
  const source=await readFile(path.join(root,'tests',name+'.js'),'utf8');
  const script=path.join(scratch,name+'.js'),base=path.join(output,name);
  const cleanup=name.startsWith('native-close-')?'':"setInterval(()=>{const d=document.getElementById('close-dialog');if(d?.open)d.querySelector('[value=discard]').click();},100);\n";
  await writeFile(script,cleanup+source);
  const status=await new Promise(resolve=>{
    const child=spawn(path.join(root,'build/releases','v'+version,'落叶画板.app/Contents/MacOS/LUOYEStudio'),[],{env:{...process.env,LUOYE_SMOKE_OUTPUT:base,LUOYE_SMOKE_EXIT:'1',LUOYE_SMOKE_WIDTH:'1440',LUOYE_SMOKE_HEIGHT:'900',LUOYE_SMOKE_SCRIPT:script},stdio:['ignore','ignore','pipe']});
    let stderr='';child.stderr.on('data',b=>{stderr+=b;});
    const timeout=setTimeout(()=>child.kill('SIGTERM'),120000);
    child.on('error',e=>{clearTimeout(timeout);resolve({error:e.message});});
    child.on('exit',(code,signal)=>{clearTimeout(timeout);resolve({code,signal,stderr});});
  });
  let evidence;try{evidence=JSON.parse(await readFile(base+'.checks.json','utf8'));}catch{}
  const r=evidence?.result,passed=status.code===0&&evidence?.ok===true&&r?.passed!==false&&!r?.failure&&!(r?.checks||[]).some(c=>c.passed===false);
  results.push({name,passed,status});console.log(name+': '+(passed?'PASS':'FAIL'));
}
const summaryFile=path.join(output,'acceptance-summary.json');let previous=[];
try{previous=JSON.parse(await readFile(summaryFile,'utf8'));}catch{}
await writeFile(summaryFile,JSON.stringify([...new Map([...previous,...results].map(r=>[r.name,r])).values()],null,2));
if(results.some(r=>!r.passed))process.exitCode=1;
