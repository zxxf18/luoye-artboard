"""Extract generated sprite sheets. Never interpolate old artwork to claim HD.

Masters remain intact. Runtime pictures are only cropped/downsampled; dynamic
packs use eight newly drawn keyframes per group at the legacy frame cadence.
"""
from pathlib import Path
import json, argparse
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'public/assets/fairy-v15'
jobs=json.loads((ROOT/'design/evidence/v1.5/fairy-jobs.json').read_text())
original=json.loads((ROOT/'build/remaster/manifest.json').read_text())['assets']
parser=argparse.ArgumentParser();parser.add_argument('--partial',action='store_true');args=parser.parse_args()
def master_ready(job):
    if job['mode']=='dynamic':return all((OUT/'motion-masters'/(job['id']+f'-f{i}.png')).exists() for i in range(8))
    return (OUT/'masters'/(job['id']+'.png')).exists()
missing=[j['id'] for j in jobs if not master_ready(j)]
if missing and not args.partial:raise SystemExit('Missing masters: '+', '.join(missing))
(OUT/'sprites').mkdir(exist_ok=True);(OUT/'thumbs').mkdir(exist_ok=True)
reports=[];replacements=[]

def relative(path):return str(path.relative_to(ROOT/'public'))
def export(image,name,limit):
    image=image.copy();image.thumbnail((limit,limit),Image.Resampling.LANCZOS)
    path=OUT/'sprites'/(name+'.png');image.save(path)
    return relative(path),image.size

def cells(job):
    path=OUT/'masters'/(job['id']+'.png');im=Image.open(path).convert('RGBA')
    if im.getchannel('A').getextrema()!=(0,255):raise ValueError(job['id']+' must have actual transparent alpha')
    result=[]
    for i in range(job['cells']):
        col=i%job['columns'];row=i//job['columns']
        box=(round(col*im.width/job['columns']),round(row*im.height/job['rows']),round((col+1)*im.width/job['columns']),round((row+1)*im.height/job['rows']))
        result.append(im.crop(box))
    # Dynamic frames share one crop rectangle so the character doesn't wobble
    # or change scale when an individual pose extends an arm or opens its wings.
    bounds=[c.getchannel('A').getbbox() for c in result]
    if any(b is None for b in bounds):raise ValueError(job['id']+' contains an empty sprite cell')
    if job['mode']=='dynamic':
        common=(min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),max(b[3] for b in bounds))
        result=[c.crop(common) for c in result]
    else:result=[c.crop(b) for c,b in zip(result,bounds)]
    reports.append({'id':job['id'],'master':relative(path),'masterSize':list(im.size),'cells':len(result),'nativeCellSizes':[list(c.size) for c in result]})
    return result

for asset in original:
    if asset['category']!='fairy' or not asset['id'].startswith('girl-'):continue
    own=[j for j in jobs if j['assetId']==asset['id']]
    if any(j['id'] in missing for j in own):continue
    groups=[];previews=[];old=asset['fairyGroups']
    if asset['fairyMode']=='dynamic':
        for job,g in zip(own,old):
            images=[Image.open(OUT/'motion-masters'/(job['id']+f'-f{i}.png')).convert('RGBA') for i in range(8)]
            bounds=[im.getchannel('A').getbbox() for im in images]
            if any(b is None for b in bounds):raise ValueError(job['id']+' empty motion frame')
            common=(min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),max(b[3] for b in bounds))
            reports.append({'id':job['id'],'method':'original-vector-animation','masterSize':[2048,2048],'cells':8,'nativeCellSizes':[[common[2]-common[0],common[3]-common[1]]]*8})
            images=[im.crop(common) for im in images];paths=[];size=None
            for i,im in enumerate(images):
                path,size=export(im,job['id']+f'-f{i}',480);paths.append(path)
            groups.append({**g,'width':size[0],'height':size[1],'frames':paths,'originalFrameCount':len(g['frames']),'frameDuration':g['frameDuration']})
            previews.append(images[-1])
    else:
        for i,(im,g) in enumerate(zip(cells(own[0]),old)):
            path,size=export(im,asset['id']+f'-g{i}',1024)
            groups.append({**g,'width':size[0],'height':size[1],'frames':[path]});previews.append(im)
    thumb=previews[0].copy();thumb.thumbnail((432,288),Image.Resampling.LANCZOS)
    thumbPath=OUT/'thumbs'/(asset['id']+'.png');thumb.save(thumbPath)
    replacements.append({'id':asset['id'],'name':own[0]['name'],'src':groups[0]['frames'][-1],
        'width':groups[0]['width'],'height':groups[0]['height'],'thumbnail':relative(thumbPath),
        'fairyGroups':groups,'quality':'new-illustration-v15','masterSources':[relative(OUT/('vectors' if j['mode']=='dynamic' else 'masters')/(j['id']+('-f0.svg' if j['mode']=='dynamic' else '.png'))) for j in own],
        'artNote':'按原主题重新绘制；动态组为 8 个新关键帧，保留原帧间隔，循环长度随关键帧数量变化。' if asset['fairyMode']=='dynamic' else '按原主题重新绘制，保持原组合数量。'})

if not args.partial:
    assert len(replacements)==154
    (OUT/'catalog.json').write_text(json.dumps(replacements,ensure_ascii=False,indent=2)+'\n')
(ROOT/'design/evidence/v1.5/fairy-resolution-audit.json').write_text(json.dumps({'complete':not missing,'missing':missing,'packs':len(replacements),'masters':reports},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'packs':len(replacements),'masters':len(reports),'missing':len(missing)},ensure_ascii=False))
