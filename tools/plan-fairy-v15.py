from pathlib import Path
import json,math
root=Path(__file__).resolve().parents[1]
assets=json.loads((root/'public/assets/catalog.json').read_text());jobs=[]
for a in assets:
 if a['category']!='fairy' or not a['id'].startswith('girl-'):continue
 mode=a['fairyMode'];groups=a.get('originalFairyGroups',a['fairyGroups']);base={'assetId':a['id'],'name':a['name'],'mode':mode}
 if mode=='single':jobs.append(dict(base,id=a['id'],columns=1,rows=1,cells=1))
 elif mode=='static':
  cols=math.ceil(math.sqrt(len(groups)));jobs.append(dict(base,id=a['id'],columns=cols,rows=math.ceil(len(groups)/cols),cells=len(groups)))
 else:
  for i,g in enumerate(groups):jobs.append(dict(base,id=a['id']+f'-g{i}',group=i,columns=4,rows=2,cells=8,originalFrames=len(g['frames']),duration=g['frameDuration']))
(root/'design/evidence/v1.5/fairy-jobs.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2)+'\n');print(len(jobs))
