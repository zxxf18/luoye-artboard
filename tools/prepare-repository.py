"""Archive unused assets and generated diagnostic captures before publication."""
import json, subprocess, shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1]
catalog=json.loads((root/'public/assets/catalog.json').read_text())
keep={'public/assets/catalog.json','public/assets/catalog.js','public/assets/grain-0.png','public/assets/grain-1.png'}
for a in catalog:
    paths=[a['src'],a['thumbnail'],*a.get('frames',[])]
    for g in a.get('fairyGroups',[]):paths+=g['frames']
    keep.update('public/'+p for p in paths)
files=subprocess.check_output(['git','ls-files','-z'],cwd=root).decode().split('\0')
moved=[]
for name in filter(None,files):
    p=root/name
    unused=name.startswith('public/assets/') and name not in keep and not (p.suffix=='.svg' and '/vectors/' in name)
    generated=name.startswith('design/') and ('.archive/' in name or p.suffix.lower() in {'.png','.jpg','.jpeg','.jshwx','.jshwr'} or (p.suffix=='.json' and p.is_file() and p.stat().st_size>1024*1024))
    if not(unused or generated) or not(p.exists() or p.is_symlink()):continue
    dest=root/'local-only/repository-cleanup'/name
    dest.parent.mkdir(parents=True,exist_ok=True)
    if dest.exists():raise RuntimeError('Archive already exists: '+str(dest))
    shutil.move(str(p),str(dest));moved.append(name)
out=root/'design/versions/v1.6.3/repository-cleanup.json'
out.write_text(json.dumps({'archivedLocally':moved,'runtimeFiles':len(keep),'note':'Unpublished sources remain in local-only/repository-cleanup; original Git history remains on local branches.'},ensure_ascii=False,indent=2)+'\n')
print('Archived',len(moved),'paths; retained',len(keep),'runtime asset paths.')
