"""Build deterministic ImageGen jobs and compact legacy reference boards."""
from pathlib import Path
import hashlib, json, math
from PIL import Image

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
CATALOG=json.loads((PUBLIC/'assets/catalog.json').read_text())
EVIDENCE=ROOT/'design/evidence/v1.6'
REFS=ROOT/'build/library-v16/references'
EVIDENCE.mkdir(parents=True,exist_ok=True);REFS.mkdir(parents=True,exist_ok=True)

def source_paths(asset):
    if asset['category']=='animation': return asset.get('frames',[])[:8]
    if asset['category']=='fairy':
        groups=asset.get('originalFairyGroups') or asset.get('fairyGroups') or []
        return [g['frames'][0] for g in groups if g.get('frames')]
    return [asset.get('originalSrc') or asset['src']]

def reference(asset):
    paths=[PUBLIC/p for p in source_paths(asset) if p and (PUBLIC/p).exists()]
    if len(paths)==1:return paths[0]
    ims=[]
    for p in paths:
        im=Image.open(p).convert('RGBA');box=im.getchannel('A').getbbox()
        if box:im=im.crop(box)
        im.thumbnail((256,256),Image.Resampling.LANCZOS);ims.append(im)
    if not ims:raise ValueError(f"No reference for {asset['id']}")
    cols=min(4,len(ims));rows=math.ceil(len(ims)/cols)
    board=Image.new('RGBA',(cols*280,rows*280),(245,239,224,255))
    for i,im in enumerate(ims):board.alpha_composite(im,(i%cols*280+(280-im.width)//2,i//cols*280+(280-im.height)//2))
    out=REFS/f"{asset['id']}.png";board.convert('RGB').save(out,optimize=True);return out

def subject_rule(asset):
    c=asset.get('collection','')
    if c in ('role0','role1','role2','anim0','anim1','anim2'):
        return 'Draw the referenced animal species with recognizable natural juvenile anatomy and a natural animal pose. Eye size must be proportionate to the skull.'
    if c in ('role3',):
        return 'Draw the referenced fruit, flower or plant with recognizable botanical structure and no face or limbs.'
    if c in ('role4','anim3'):
        return 'Draw the referenced person with natural child-friendly human proportions, clear hands and a calm readable action.'
    if c in ('role5','role6','anim4'):
        return 'Draw the referenced real object with recognizable construction, material and function; it remains completely inanimate.'
    return 'Preserve the referenced subject meaning and broad composition while keeping animals, plants and objects true to their natural structure.'

def prompt(asset):
    name=asset['name'];cat=asset['category']
    shared='Style: warm hand-painted gouache and watercolor over a nature-observed realistic foundation, simplified for ages 3–6, clear silhouette, gentle natural colors. No text and no watermark. '
    avoid='Avoid: anthropomorphic animals or objects, human stance for animals, clothing on animals, faces or limbs on objects and plants, giant glossy eyes, cheek blush, anime, mascot costume, plastic 3D render, uncanny expression.'
    if cat=='background':
        if asset.get('coloring'):
            return f"Use case: line-art. Theme for understanding only: {name}. Redraw the reference as a 16:9 preschool coloring page. Preserve the subject and broad layout. Use clean dark warm-gray closed outlines, large easy-to-color regions, sparse detail, white background, natural anatomy and species-appropriate poses. Never print the theme name or any other letters, numbers, signs or labels. No shading or gray fill. {avoid}"
        return f"Use case: illustration-story. Redraw the reference as a complete 16:9 preschool picture-book background named {name}. Preserve the scene meaning and broad composition, with an open middle area where children can draw and place stickers. {shared}{avoid}"
    if cat=='frame':
        return f"Use case: stylized-concept. Redraw the reference as a complete 16:9 decorative picture frame named {name}. Preserve the border theme and leave a very large genuinely transparent rectangular center. Keep decoration inside the outer edge. {shared}Output genuine transparent RGBA. {avoid}"
    if cat=='paper':
        return f"Use case: stylized-concept. Redraw the reference as a clean preschool paper-mask template named {name}, centered in a 16:9 canvas. Preserve its recognizable outer shape, use an opaque warm off-white paper area and genuine transparency outside the shape. {shared}{avoid}"
    if cat=='texture':
        return f"Use case: stylized-concept. Redraw the reference as a seamless square painting texture named {name}. Preserve the material or pattern identity, use soft tactile gouache detail and even edge-to-edge coverage. No characters. {shared}{avoid}"
    motion=' The output is one stable complete subject on genuine transparent RGBA; animation will be derived without changing its identity.' if cat=='animation' else ''
    count=len(source_paths(asset))
    cols=min(4,count);rows=math.ceil(count/cols)
    fairy=f' The reference board shows {count} separate pieces. Redraw exactly {count} complete separate pieces as a {cols}-column by {rows}-row transparent sprite sheet in reading order, with generous even gutters and no panel backgrounds.' if cat=='fairy' and count>1 else ''
    return f"Use case: stylized-concept. Redraw the reference as a preschool painting-app cutout named {name}. {subject_rule(asset)} Preserve the complete silhouette and broad pose. {shared}Output genuine transparent RGBA with clean natural edges and generous margin.{motion}{fairy} {avoid}"

jobs=[]
for a in CATALOG:
    ref=reference(a)
    rel=str(ref.relative_to(ROOT))
    groups=len(source_paths(a)) if a['category']=='fairy' else None
    jobs.append({'id':a['id'],'name':a['name'],'category':a['category'],'collection':a.get('collection'),'fairyMode':a.get('fairyMode'),'groups':groups,'reference':rel,'referenceSha256':hashlib.sha256(ref.read_bytes()).hexdigest(),'master':f"public/assets/library-v16/masters/{a['id']}.png",'prompt':prompt(a)})

(EVIDENCE/'jobs.json').write_text(json.dumps(jobs,ensure_ascii=False,indent=2)+'\n')
summary={'entries':len(jobs),'categories':{c:sum(j['category']==c for j in jobs) for c in sorted({j['category'] for j in jobs})},'policy':'one ImageGen call per catalog entry; original images are semantic/composition references only'}
(EVIDENCE/'plan-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(summary,ensure_ascii=False))
