"""Decode the entire legacy content library for remastering, without resampling.

Writes canonical RGBA frames plus provenance into build/remaster/original.
Does not replace shipped assets until a remaster batch is verified and published.
"""
from pathlib import Path
import hashlib,io,json,re,sys
import numpy as np
from PIL import Image
from gir_format import parse_gir
ROOT=Path(__file__).resolve().parents[1]
LEGACY=ROOT/'local-only/reference';OUT=ROOT/'build/remaster/original';OUT.mkdir(parents=True,exist_ok=True)
INDEX={p.relative_to(LEGACY).as_posix().lower():p for p in LEGACY.rglob('*') if p.is_file()}
MASK_ALIASES={'glib/lib/anim1/009$04a.bmp':'glib/lib/anim1/009$05a.bmp','glib/lib/anim4/006$05a.bmp':'glib/lib/anim4/006$06a.bmp','glib/lib/anim3/0004$03a.bmp':'glib/lib/anim3/000$03a.bmp'}
assets=[];jobs={}
def sources_for(src):
    mask=MASK_ALIASES.get(src[:-4]+'a.bmp',src[:-4]+'a.bmp')
    return [src]+([mask] if mask in INDEX else [])
def repair_for(src):
    original=src[:-4]+'a.bmp'
    if original in MASK_ALIASES:return 'source filename mismatch; matched mask: '+MASK_ALIASES[original]
    if original not in INDEX:return 'neutral-gray matte recovered because source alpha mask is missing'
    return None
def natural(s):return [int(x) if x.isdigit() else x for x in re.split(r'(\d+)',s)]
def image(src,mask=None):
    im=Image.open(INDEX[src]).convert('RGBA')
    if mask:
        mask=MASK_ALIASES.get(mask,mask)
        if mask in INDEX:alpha=Image.open(INDEX[mask]).convert('L')
        elif src=='glib/lib/anim1/004$03.jpg':
            # This installation is missing exactly one mask. Recover its neutral
            # gray matte from the image corner; do not borrow a different frame.
            rgb=np.asarray(im)[...,:3].astype(float);matte=rgb[0,0]
            distance=np.max(np.abs(rgb-matte),axis=2);a=np.clip((distance-4)/24,0,1)
            alpha=Image.fromarray(np.round(a*255).astype('uint8'))
        else:raise ValueError('Missing alpha mask '+mask)
        if alpha.size!=im.size:raise ValueError('Mask mismatch '+src)
        im.putalpha(alpha)
    return im

def save(key,im,role,sources,**details):
    target=OUT/(key+'.png');target.parent.mkdir(parents=True,exist_ok=True);im.save(target)
    jobs[key]=dict(id=key,path=str(target.relative_to(ROOT)),width=im.width,height=im.height,role=role,
        sha256=hashlib.sha256(target.read_bytes()).hexdigest(),sources=sources,**details)
    return 'assets/hd/'+key+'.png'

def add(key,name,category,src,mask=None):
    im=image(src,mask);sources=[src]+([mask] if mask else [])
    target=save(key,im,category,sources)
    item=dict(id=key,name=name,category=category,src=target,width=im.width,height=im.height,
        quality='decoded-original-awaiting-remaster',sources=[dict(path=p,sha256=hashlib.sha256(INDEX[p].read_bytes()).hexdigest()) for p in sources])
    assets.append(item);return item

for directory,label in [('color0','涂色森林'),('color1','漫画世界'),('color2','水彩风景'),('color3','油彩风景'),('color4','缤纷风景')]:
    for src in sorted((p for p in INDEX if re.fullmatch(r'glib/lib/'+directory+r'/\d+\.(bmp|jpg)',p)),key=lambda p:(natural(p),p)):
        n=int(Path(src).stem);add(f'{directory}-{n}',f'{label} {n+1}','background',src)
for directory,label in [('role0','陆地伙伴'),('role1','海洋伙伴'),('role2','飞行伙伴'),('role3','花草朋友'),('role4','人物朋友'),('role5','生活小物'),('role6','奇妙世界')]:
    for src in sorted((p for p in INDEX if re.fullmatch(r'glib/lib/'+directory+r'/\d+\.jpg',p)),key=lambda p:(natural(p),p)):
        n=int(Path(src).stem);add(f'{directory}-{n}',f'{label} {n+1}','sticker',src,src[:-4]+'a.bmp')
for category,label,pattern in [('frame','相框',r'glib/frame/w\d+\.jpg'),('paper','纸样',r'glib/paper/w\d+\.bmp'),('texture','纸纹',r'glib/tex/draw/tex\d+\.bmp'),('file-texture','填充纹理',r'glib/tex/file/texi?\d+\.(bmp|jpg)')]:
    for src in sorted((p for p in INDEX if re.fullmatch(pattern,p)),key=lambda p:(natural(p),p)):
        n=int(re.search(r'\d+',Path(src).stem)[0]);key=f'{category}-picture-{n}' if category=='file-texture' and Path(src).stem.startswith('texi') else f'{category}-{n}';add(key,f'{label} {n+1}'+(' · 彩色' if '-picture-' in key else ''),'texture' if category=='file-texture' else category,src,src[:-4]+'a.bmp' if category=='frame' else None)
animations={}
for src in sorted((p for p in INDEX if re.fullmatch(r'glib/lib/anim[0-4]/\d+\$\d+\.jpg',p)),key=lambda p:(natural(p),p)):
    if src=='glib/lib/anim3/0004$03.jpg':continue
    n=(int(src.split('/')[-2][4:]),int(Path(src).stem.split('$')[0]));animations.setdefault(n,[]).append(src)
for n,paths in animations.items():
    group,number=n;key=f'animation-{number}' if group==0 else f'animation-{group}-{number}';item=add(key,f'{["陆地动物动画","海洋动物动画","飞行伙伴动画","人物动画","其他动画"][group]} {number+1}','animation',paths[0],paths[0][:-4]+'a.bmp')
    item['frames']=[save(f'{key}-{i}',image(p,p[:-4]+'a.bmp'),'animation',sources_for(p),repair=repair_for(p)) for i,p in enumerate(paths)]
    item.update(frameDuration=160,timingStatus='legacy frame order preserved; timing unverified')
variant=add('legacy-sailboat-variant','帆船 · 原版备用图','sticker','glib/lib/anim3/0004$03.jpg','glib/lib/anim3/000$03a.bmp');variant['note']='Misnamed extra 0004$03 image matches 000 sailboat dimensions; kept separately from animation 004.'
for src in sorted((p for p in INDEX if p.startswith('glib/girl/') and p.endswith('.gir')),key=lambda p:(natural(p),p)):
    kind=int(src.split('/')[-2]);n=int(Path(src).stem);key=f'girl-{kind}-{n}';raw=INDEX[src].read_bytes();decoded=parse_gir(raw);groups=[];poster=None;repairs=[]
    for gi,group in enumerate(decoded['groups']):
        frames=[]
        for fi,frame in enumerate(group['frames']):
            if 'rgb_runs' in frame:
                sprite=Image.new('RGBA',(frame['width'],frame['height']))
                for x,y,count,r,g,b in frame['rgb_runs']:sprite.paste((r,g,b,255),(x,y,x+count,y+1))
            else:sprite=Image.open(io.BytesIO(raw[frame['dib_offset']:frame['dib_offset']+frame['dib_length']])).convert('RGBA')
            alpha=Image.new('L',sprite.size,0)
            for x,y,count,a in frame['runs']:alpha.paste(a,(x,y,x+count,y+1))
            sprite.putalpha(alpha);canvas=Image.new('RGBA',(group['width'],group['height']));canvas.alpha_composite(sprite,(frame['x'],frame['y']))
            frames.append(save(f'{key}-g{gi}-f{fi}',canvas,'fairy',[src],group=gi,frame=fi))
            if frame.get('repair'):repairs.append(dict(group=gi,frame=fi,note=frame['repair']))
            # Some animations start with a nearly blank frame. Pick a useful preview only.
            if poster is None or (poster.getbbox() is None or (poster.getbbox()[2]-poster.getbbox()[0])<8):poster=canvas.copy()
        groups.append(dict(width=group['width'],height=group['height'],frames=frames,frameDuration=160,flag=group['flag']))
    assets.append(dict(id=key,name=f'{["单张","静态","动态"][kind]}仙女袋 {n+1}',category='fairy',src=save(key,poster,'fairy-poster',[src]),
        width=poster.width,height=poster.height,fairyMode=['single','static','dynamic'][kind],fairyGroups=groups,
        quality='decoded-original-awaiting-remaster',repairs=repairs,sources=[dict(path=src,sha256=hashlib.sha256(raw).hexdigest())]))
manifest=dict(assets=assets,jobs=list(jobs.values()),counts={category:sum(a['category']==category for a in assets) for category in sorted({a['category'] for a in assets})})
(ROOT/'build/remaster/manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(entries=len(assets),images=len(jobs),counts=manifest['counts']),ensure_ascii=False))
