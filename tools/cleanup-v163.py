"""Move obsolete generated deliveries to Trash; never touch source or user artwork."""
from pathlib import Path
import json, shutil, datetime, re

root=Path(__file__).resolve().parents[1]
trash=Path.home()/'.Trash'/('落叶画板清理-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S'))
records=[]
releases=root/'build/releases'
targets=[p for p in releases.iterdir() if p.is_dir() and re.fullmatch(r'v\d+\.\d+\.\d+',p.name) and tuple(map(int,p.name[1:].split('.')))<(1,6,3)]
prefixes=('child-repair','interaction-','native-layer-','native-smoke','v1.3-','v1.4-','v1.5-','archive-smoke')
targets += [p for p in (root/'build').iterdir() if p.name.startswith(prefixes)]
for src in targets:
    dest=trash/src.relative_to(root/'build')
    dest.parent.mkdir(parents=True,exist_ok=True)
    shutil.move(str(src),str(dest))
    records.append({'from':str(src),'trash':str(dest)})
report={'moved':records,'preserved':['source and git tags','design/versions','original luoye files','Pictures/落叶画板作品','build/tooling and dependency caches','current build/releases/v1.6.3']}
(root/'design/versions/v1.6.3/cleanup.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(f'Moved {len(records)} obsolete generated paths to {trash}')
