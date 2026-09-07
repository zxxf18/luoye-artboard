"""Index inspected generated artwork without changing or enlarging its pixels."""
from pathlib import Path
import json,hashlib
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
assets=[];audit=[]
for group in ['coloring-prompts','new-art-prompts']:
    records=json.loads((ROOT/f'design/evidence/v1.4/{group}.json').read_text())
    for record in records:
        path=ROOT/record['path'];im=Image.open(path)
        is_replacement=group=='coloring-prompts';category='coloring' if is_replacement else record['category']
        item={'id':record['id'],'name':record['name'],'category':'background' if category=='coloring' else category,'src':str(path.relative_to(ROOT/'public')),'width':im.width,'height':im.height,'quality':'ai-redrawn-native','collection':'coloring' if is_replacement else 'newcoloring' if category=='coloring' else 'redrawn' if category=='frame' else 'illustrated'}
        if category=='coloring':item['coloring']=True
        if is_replacement:item.update(referenceId=record['referenceId'],replaceOriginal=True)
        thumb=im.copy();thumb.thumbnail((320,200));thumbpath=path.with_name(path.stem+'-thumb.png');thumb.save(thumbpath);item['thumbnail']=str(thumbpath.relative_to(ROOT/'public'))
        alpha=im.convert('RGBA').getchannel('A')
        if category=='frame':assert alpha.getpixel((im.width//2,im.height//2))==0,f'Frame center is not transparent: {path}'
        audit.append({'id':record['id'],'width':im.width,'height':im.height,'mode':im.mode,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'nativePixels':True,'alphaRange':alpha.getextrema()})
        assets.append(item)
(ROOT/'public/assets/redrawn-v14/catalog.json').write_text(json.dumps(assets,ensure_ascii=False,indent=2)+'\n')
(ROOT/'design/evidence/v1.4/art-audit.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2)+'\n')
print('Indexed',len(assets),'inspected new illustrations')
