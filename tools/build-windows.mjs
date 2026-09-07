import { spawnSync } from 'node:child_process';
import { mkdir, access, rm, cp, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { root } from './bundle.mjs';
import './build.mjs';
import { version, releaseRoot, versionDocs } from './release-paths.mjs';
import { createHash } from 'node:crypto';
const local=path.join(root,'build/tooling/dotnet',process.platform==='win32'?'dotnet.exe':'dotnet');
let dotnet=process.env.LUOYE_DOTNET||local;try{await access(dotnet);}catch{dotnet='dotnet';}
await mkdir(path.join(root,'build/dotnet-home'),{recursive:true});
const output=path.join(releaseRoot,'windows-amd64');
await rm(output,{recursive:true,force:true});
const result=spawnSync(dotnet,['publish',path.join(root,'native/windows/Luoye.csproj'),'-c','Release','-r','win-x64','--self-contained','true','-p:EnableWindowsTargeting=true','-o',output],{stdio:'inherit',env:{...process.env,DOTNET_CLI_HOME:path.join(root,'build/dotnet-home'),NUGET_PACKAGES:path.join(root,'build/nuget'),DOTNET_CLI_TELEMETRY_OPTOUT:'1',DOTNET_GENERATE_ASPNET_CERTIFICATE:'false'}});
if(result.status!==0)process.exit(result.status||1);
await cp(path.join(root,'native/windows/使用说明.txt'),path.join(output,'使用说明.txt'));
await cp(path.join(root,'build/tooling/MicrosoftEdgeWebView2RuntimeInstallerX64.exe'),path.join(output,'MicrosoftEdgeWebView2RuntimeInstallerX64.exe'));
await mkdir(path.join(output,'licenses'),{recursive:true});
for(const [pkg,version] of [['meltysynth','2.4.1'],['naudio','2.2.1'],['microsoft.web.webview2','1.0.4191.47']]){
 const dir=path.join(root,'build/nuget',pkg,version);const names=await import('node:fs/promises').then(m=>m.readdir(dir));
 for(const name of names.filter(n=>/licen[sc]e|notice/i.test(n)))await cp(path.join(dir,name),path.join(output,'licenses',pkg+'-'+name));
}
const checks={version,target:'win-x64',selfContained:true,windowsRuntimeTested:false,files:{}};
for(const name of ['落叶画板.exe','WebView2Loader.dll','MicrosoftEdgeWebView2RuntimeInstallerX64.exe','audio/GeneralUser-GS.sf2']){const bytes=await readFile(path.join(output,name));checks.files[name]={bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};}
await writeFile(path.join(output,'build-manifest.json'),JSON.stringify(checks,null,2));
await mkdir(versionDocs,{recursive:true});
await writeFile(path.join(versionDocs,'windows-build.json'),JSON.stringify(checks,null,2));
console.log('Windows amd64 client: '+path.join(output,'落叶画板.exe'));
