import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {root} from './bundle.mjs';
const exists=async p=>fs.access(p).then(()=>true,()=>false);
const records=[];
const manifest=path.join(root,'design/versions/v1.6.2/archive-manifest.json');
if(await exists(manifest))records.push(...JSON.parse(await fs.readFile(manifest,'utf8')));
async function move(from,to){
 from=path.join(root,from);to=path.join(root,to);
 if(!await exists(from)||await exists(to))return;
 await fs.mkdir(path.dirname(to),{recursive:true});await fs.rename(from,to);records.push({from:path.relative(root,from),to:path.relative(root,to)});
}
const docs={'07-current-delivery.md':'0.1.0','09-restoration-status.md':'0.2.0','10-classic-restoration.md':'0.3.0','11-child-friendly-interaction.md':'1.0.0','12-v1-upgrade.md':'1.1.0','13-layer-and-fairy-interaction.md':'1.2.0','14-paper-scope-and-full-library.md':'1.3.0','15-frames-coloring-responsive.md':'1.4.0','16-fairy-animation-filters.md':'1.5.0','17-preschool-natural-library.md':'1.6.0'};
for(const [name,v] of Object.entries(docs)){
 const dest='design/versions/v'+v+'/'+name;
 if(!await exists(path.join(root,dest))){await move('design/'+name,dest);await fs.writeFile(path.join(root,'design',name),'# 历史版本文档\n\n已归档至 ['+v+'](versions/v'+v+'/'+name+')。\n');}
}
for(const v of ['1.5','1.6']){
 const src=path.join(root,'design/evidence/v'+v);
 if(await exists(src)&&!(await fs.lstat(src)).isSymbolicLink()){
 await move('design/evidence/v'+v,'design/versions/v'+v+'.0/evidence');
 await fs.symlink('../versions/v'+v+'.0/evidence',src);
 }
}
const hasChangelog=await exists(path.join(root,'CHANGELOG.md'));
const changelog=hasChangelog?await fs.readFile(path.join(root,'CHANGELOG.md'),'utf8'):'';
for(const section of changelog.split(/(?=^## )/m).slice(1)){
 const v=section.match(/^## (\d+\.\d+\.\d+)/)?.[1];if(!v)continue;
 const dir=path.join(root,'design/versions/v'+v);await fs.mkdir(dir,{recursive:true});
 if(!await exists(path.join(dir,'CHANGELOG.md')))await fs.writeFile(path.join(dir,'CHANGELOG.md'),section);
}
for(const name of await fs.readdir(path.join(root,'build'))){
 const v=name.match(/-(\d+\.\d+\.\d+)-windows-amd64\.zip$/)?.[1];
 if(v)await move('build/'+name,'build/releases/v'+v+'/'+name);
 if(name.endsWith('.app')){
 const plist=await fs.readFile(path.join(root,'build',name,'Contents/Info.plist'),'utf8');
 const ver=plist.match(/<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)/)?.[1];
 if(ver)await move('build/'+name,'build/releases/v'+ver+'/'+name);
 }
}
if(await exists(path.join(root,'build/windows-amd64/build-manifest.json'))){
 const {version}=JSON.parse(await fs.readFile(path.join(root,'build/windows-amd64/build-manifest.json'),'utf8'));
 await move('build/windows-amd64','build/releases/v'+version+'/windows-amd64');
}
const rejected=path.join(root,'design/versions/v1.6.1');await fs.mkdir(rejected,{recursive:true});
for(const base of ['build','design/evidence'])for(const name of await fs.readdir(path.join(root,base))){
 const minor=name.match(/^v(1\.\d+)[-.]/)?.[1];if(!minor)continue;
 const source=path.join(root,base,name);if((await fs.lstat(source)).isSymbolicLink())continue;
 const dest=(base==='build'?'build/releases/':'design/versions/')+'v'+minor+'.0/evidence/'+name;
 if(await exists(path.join(root,dest)))continue;
 await move(base+'/'+name,dest);
 await fs.symlink(path.relative(path.dirname(source),path.join(root,dest)),source);
}
await fs.writeFile(path.join(rejected,'README.md'),'# 1.6.1（已被替代）\n\n保留历史标签和构建产物；此版入口脚本存在语法错误，不能作为可用版本。1.6.2 从 1.6.0 重新修复。\n');
try{const log=execFileSync('git',['show','v1.6.1:CHANGELOG.md'],{cwd:root,encoding:'utf8'});await fs.writeFile(path.join(rejected,'CHANGELOG.md'),log.split(/(?=^## )/m).find(s=>s.startsWith('## 1.6.1'))||'');}catch{}
const versions=(await fs.readdir(path.join(root,'design/versions'))).filter(v=>v.startsWith('v')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
for(const v of versions){const file=path.join(root,'design/versions',v,'CHANGELOG.md');if(await exists(file))await fs.writeFile(file,(await fs.readFile(file,'utf8')).trimEnd()+'\n');}
if(hasChangelog)await fs.writeFile(path.join(root,'CHANGELOG.md'),'# 变更记录索引\n\n每版完整记录保存在对应版本文件夹。\n\n'+versions.map(v=>'- ['+v+'](design/versions/'+v+'/)').join('\n')+'\n');
await fs.writeFile(path.join(root,'design/versions/README.md'),'# 版本索引\n\n每个版本的设计、修改记录、验证结果放在对应目录；客户端产物位于 `build/releases/<版本>/`。共享环境和原版研究资料保留在 design 根目录。历史 evidence 路径仅保留符号链接兼容旧生成脚本。\n\n'+versions.map(v=>'- ['+v+']('+v+'/) · [构建产物](../../build/releases/'+v+'/)').join('\n')+'\n');
await fs.writeFile(path.join(root,'design/versions/v1.6.2/archive-manifest.json'),JSON.stringify(records,null,2)+'\n');
console.log('Archived '+records.length+' historical paths.');
