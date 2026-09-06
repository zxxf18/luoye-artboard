"""Pixel-level quality gates for v1.6 masters and published runtime art."""
from pathlib import Path
import argparse, hashlib, json
from PIL import Image, ImageStat

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public';OUT=PUBLIC/'assets/library-v16';EVIDENCE=ROOT/'design/evidence/v1.6'
parser=argparse.ArgumentParser();parser.add_argument('--masters',action='store_true');parser.add_argument('--partial',action='store_true');args=parser.parse_args()
catalog=json.loads((PUBLIC/'assets/catalog.json').read_text())
failures=[];records=[];hashes={}
for item in catalog:
    path=OUT/'masters'/f"{item['id']}.png" if args.masters else PUBLIC/item['src']
    if not path.exists():
        if not args.partial:failures.append({'id':item['id'],'reason':'missing','path':str(path.relative_to(ROOT))})
        continue
    with Image.open(path) as raw:
        im=raw.convert('RGBA');alpha=im.getchannel('A');lo,hi=alpha.getextrema();visible=alpha.getbbox()
        digest=hashlib.sha256(path.read_bytes()).hexdigest();lum=ImageStat.Stat(im.convert('L')).mean[0]
        record={'id':item['id'],'category':item['category'],'path':str(path.relative_to(ROOT)),'size':list(im.size),'mode':raw.mode,'alpha':[lo,hi],'visibleBox':list(visible) if visible else None,'meanLuminance':round(lum,2),'sha256':digest}
        records.append(record);hashes.setdefault(digest,[]).append(item['id'])
        transparent=item['category'] in ('sticker','animation','fairy','frame','paper')
        if transparent and not (lo==0 and hi>=250):failures.append({'id':item['id'],'reason':f'alpha range {lo}..{hi}'})
        if not visible:failures.append({'id':item['id'],'reason':'empty image'})
        if item['category']=='background' and (im.width<1600 or abs(im.width/im.height-16/9)>.02):failures.append({'id':item['id'],'reason':f'background dimensions {im.size}'})
        if args.masters and max(im.size)<900:failures.append({'id':item['id'],'reason':f'master too small {im.size}'})
for digest,ids in hashes.items():
    if len(ids)>1:failures.append({'ids':ids,'reason':'byte-identical art reused across different entries'})
report={'scope':'masters' if args.masters else 'runtime','checked':len(records),'failures':failures,'assets':records}
EVIDENCE.mkdir(parents=True,exist_ok=True);(EVIDENCE/f"{report['scope']}-audit.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'scope':report['scope'],'checked':len(records),'failures':len(failures)},ensure_ascii=False))
if failures and not args.partial:raise SystemExit(1)
