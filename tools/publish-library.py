"""Publish every decoded legacy entry. Never label original pixels as HD art."""
from pathlib import Path
import json,shutil
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'build/remaster/manifest.json').read_text())
names=json.loads((ROOT/'tools/asset-names.json').read_text())
out=ROOT/'public/assets';(out/'original').mkdir(exist_ok=True);(out/'thumbs').mkdir(exist_ok=True)
for job in manifest['jobs']:
    shutil.copy2(ROOT/job['path'],out/'original'/Path(job['path']).name)
def remap(value):
    if isinstance(value,str):return value.replace('assets/hd/','assets/original/')
    if isinstance(value,list):return [remap(x) for x in value]
    if isinstance(value,dict):return {k:remap(v) for k,v in value.items()}
    return value
assets=remap(manifest['assets'])
for item in assets:
    item['name']=names.get(item['id'],item['name'])
    item['quality']='original-decoded'
    item['collection']=item['id'].split('-')[0]
    if item['category']=='animation':
        item['collection']=Path(item['sources'][0]['path']).parent.name
        if item['id'] not in names:item['name']={'anim0':'陆地动物动画','anim1':'海洋动物动画','anim2':'飞行伙伴动画','anim3':'人物动画','anim4':'其他动画'}[item['collection']]+' '+str(int(item['id'].split('-')[-1])+1)
    src=item['src']
    if item.get('fairyGroups'):
        frames=item['fairyGroups'][0]['frames'];src=frames[len(frames)//2]
    im=Image.open(ROOT/'public'/src).convert('RGBA')
    # Thumbnails show the actual object rather than the old transparent margins.
    if item['category'] in ('sticker','animation','fairy') and im.getbbox():im=im.crop(im.getbbox())
    im.thumbnail((288,176));thumb=out/'thumbs'/(item['id']+'.png');im.save(thumb)
    item['thumbnail']='assets/thumbs/'+thumb.name
additional=out/'illustrated/catalog.json'
if additional.exists():assets=json.loads(additional.read_text())+assets
redrawn=out/'redrawn-v14/catalog.json'
if redrawn.exists():
    replacements={item['referenceId']:item for item in json.loads(redrawn.read_text()) if item.get('replaceOriginal')}
    for item in assets:
        if item['id'].startswith('color0-'):item['coloring']=True
        replacement=replacements.get(item['id'])
        if replacement:
            item['originalSrc']=item['src']
            item['originalDimensions']=[item['width'],item['height']]
            item.update({k:v for k,v in replacement.items() if k not in ('id','replaceOriginal')})
    assets=[item for item in json.loads(redrawn.read_text()) if not item.get('replaceOriginal')]+assets
fairy=out/'fairy-v15/catalog.json'
if fairy.exists():
    replacements={item['id']:item for item in json.loads(fairy.read_text())}
    for item in assets:
        if item['id'] in replacements:
            item['originalSrc']=item['src'];item['originalDimensions']=[item['width'],item['height']]
            item['originalFairyGroups']=item['fairyGroups']
            item.update(replacements[item['id']])
preschool=out/'library-v16/catalog.json'
if preschool.exists():
    replacements={item['id']:item for item in json.loads(preschool.read_text())}
    assets=[replacements.get(item['id'],item) for item in assets]
(out/'catalog.json').write_text(json.dumps(assets,ensure_ascii=False,indent=2)+'\n')
(out/'catalog.js').write_text('window.JSHW_ASSETS = '+json.dumps(assets,ensure_ascii=False)+';\n')
print(json.dumps({'entries':len(assets),'original':manifest['counts']},ensure_ascii=False))
