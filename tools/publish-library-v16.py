"""Publish v1.6 generated masters while preserving all legacy catalogue behavior."""
from pathlib import Path
import argparse, json, math, shutil
from PIL import Image, ImageEnhance, ImageFilter

ROOT=Path(__file__).resolve().parents[1]
PUBLIC=ROOT/'public'
OUT=PUBLIC/'assets/library-v16'
MASTERS=OUT/'masters';SPRITES=OUT/'sprites';THUMBS=OUT/'thumbs'
OLD=json.loads((PUBLIC/'assets/catalog.json').read_text())
JOBS={j['id']:j for j in json.loads((ROOT/'design/evidence/v1.6/jobs.json').read_text())}
parser=argparse.ArgumentParser();parser.add_argument('--partial',action='store_true');args=parser.parse_args()
if not args.partial:
    shutil.rmtree(SPRITES,ignore_errors=True);shutil.rmtree(THUMBS,ignore_errors=True)
for p in (SPRITES,THUMBS):p.mkdir(parents=True,exist_ok=True)

def rel(path):return str(path.relative_to(PUBLIC))
def rgba(master,required=True):
    im=Image.open(master).convert('RGBA')
    alpha=im.getchannel('A')
    lo,hi=alpha.getextrema()
    if required and not (lo==0 and hi>200):raise ValueError(f'{master.name}: missing genuine transparent and visible pixels ({lo}, {hi})')
    if hi<255:alpha=alpha.point(lambda n:255 if n>=250 else n);im.putalpha(alpha)
    return im
def crop_visible(im,pad_ratio=.06):
    box=im.getchannel('A').getbbox()
    if not box:raise ValueError('empty transparent image')
    x0,y0,x1,y1=box;pad=max(8,round(max(x1-x0,y1-y0)*pad_ratio))
    return im.crop((max(0,x0-pad),max(0,y0-pad),min(im.width,x1+pad),min(im.height,y1+pad)))
def contain(im,size,background=(0,0,0,0),margin=.04):
    target=Image.new('RGBA',size,background);copy=im.copy()
    limit=(round(size[0]*(1-margin*2)),round(size[1]*(1-margin*2)))
    copy.thumbnail(limit,Image.Resampling.LANCZOS)
    target.alpha_composite(copy,((size[0]-copy.width)//2,(size[1]-copy.height)//2));return target
def save_image(im,path):
    path.parent.mkdir(parents=True,exist_ok=True)
    if im.mode=='RGBA':
        alpha=im.getchannel('A');_,hi=alpha.getextrema()
        if 0<hi<255:im=im.copy();im.putalpha(alpha.point(lambda n:min(255,round(n*255/hi))))
    if path.suffix=='.webp':im.save(path,'WEBP',quality=92,alpha_quality=100,method=4)
    else:im.save(path,optimize=True)
def thumbnail(im,item_id,landscape=False):
    canvas=contain(im,(432,243) if landscape else (288,216),background=(247,241,226,255) if landscape else (0,0,0,0),margin=.03)
    path=THUMBS/f'{item_id}.webp';save_image(canvas,path);return rel(path)
FAIRY_MOTION={
    'girl-2-0':'grow','girl-2-1':'grow','girl-2-2':'rise','girl-2-3':'bubble-rise',
    'girl-2-4':'grow','girl-2-5':'grow','girl-2-6':'grow','girl-2-7':'grow',
    'girl-2-8':'grow','girl-2-9':'grow','girl-2-10':'crawl','girl-2-11':'fly',
    'girl-2-12':'grow','girl-2-13':'spin','girl-2-14':'swim','girl-2-15':'sway',
    'girl-2-16':'grow','girl-2-17':'bubble-rise','girl-2-18':'grow','girl-2-19':'spin',
    'girl-2-20':'fall','girl-2-21':'float',
}

def motion_profile(item):
    if item.get('id') in FAIRY_MOTION:return FAIRY_MOTION[item['id']]
    name=item.get('name','')
    if '灯' in name:return 'lamp-on'
    if any(word in name for word in ('烟','雾')):return 'rise'
    if any(word in name for word in ('泡泡','气泡')):return 'bubble-rise'
    if any(word in name for word in ('蝴蝶','蜜蜂','小鸟','飞')):return 'fly'
    if any(word in name for word in ('鱼','海豚','鲸')):return 'swim'
    if any(word in name for word in ('叶','枫')):return 'fall'
    if any(word in name for word in ('草','花','蘑菇','珊瑚','枝')):return 'grow'
    return 'pulse'

def alpha_copy(im,opacity=1):
    result=im.copy()
    if opacity<1:result.putalpha(result.getchannel('A').point(lambda value:round(value*opacity)))
    return result

def motion_frames(base,item_id,limit=640,profile='pulse'):
    # Keep an even transparent safety margin around the action. It prevents a
    # growing plant or a rotating star from touching a rectangular sprite edge.
    base=crop_visible(base,.10);usable=round(limit*.66);base.thumbnail((usable,usable),Image.Resampling.LANCZOS)
    side=max(base.width,base.height);pad=max(30,side//5);cw=base.width+pad*2;ch=base.height+pad*2
    frames=[]
    for i in range(8):
        t=i/7
        canvas=Image.new('RGBA',(cw,ch))
        image=base;opacity=1;angle=0;x=(cw-base.width)//2;y=(ch-base.height)//2
        if profile=='grow':
            scale=.22+.78*t;image=base.resize((max(1,round(base.width*scale)),max(1,round(base.height*scale))),Image.Resampling.LANCZOS)
            x=(cw-image.width)//2;y=ch-pad-image.height
        elif profile in ('rise','bubble-rise'):
            scale=(.58+.42*t) if profile=='rise' else (.25+.75*t);image=base.resize((max(1,round(base.width*scale)),max(1,round(base.height*scale))),Image.Resampling.LANCZOS)
            opacity=.3+.7*t if profile=='rise' else min(1,.45+.65*t);x=(cw-image.width)//2;y=ch-pad-image.height-round(ch*(.18+.20*t))
        elif profile=='lamp-on':
            level=.38+.62*t;image=ImageEnhance.Brightness(base).enhance(level)
            glow=Image.new('RGBA',(cw,ch));mask=base.getchannel('A').resize((base.width*2,base.height*2),Image.Resampling.LANCZOS).filter(ImageFilter.GaussianBlur(max(5,side//9)))
            light=Image.new('RGBA',mask.size,(255,220,118,round(110*t)));light.putalpha(mask.point(lambda value:round(value*.34*t)))
            glow.alpha_composite(light,((cw-light.width)//2,(ch-light.height)//2));canvas.alpha_composite(glow)
        elif profile=='spin':angle=360*t
        elif profile=='crawl':x=(cw-base.width)//2+round((t-.5)*pad*1.4);y=(ch-base.height)//2+round(math.sin(t*math.pi*2)*3)
        elif profile=='swim':x=(cw-base.width)//2+round((t-.5)*pad*1.8);y=(ch-base.height)//2-round(math.sin(t*math.pi)*pad*.10)
        elif profile=='fly':x=(cw-base.width)//2+round((t-.5)*pad*1.6);y=(ch-base.height)//2-round(math.sin(t*math.pi)*pad*.70);angle=math.sin(t*math.pi*2)*5
        elif profile=='fall':x=(cw-base.width)//2+round(math.sin(t*math.pi)*pad*.6);y=pad//2+round(t*(ch-base.height-pad));angle=-35+70*t
        elif profile=='float':x=(cw-base.width)//2+round(math.sin(t*math.pi*2)*pad*.45);y=(ch-base.height)//2-round(math.sin(t*math.pi)*pad*.6);angle=math.sin(t*math.pi*2)*8
        elif profile=='sway':
            angle=math.sin(t*math.pi*2)*7
            image=base.rotate(angle,Image.Resampling.BICUBIC,expand=True)
            x=(cw-image.width)//2;y=ch-pad-image.height
        else:
            scale=.94+.06*math.sin(t*math.pi);image=base.resize((max(1,round(base.width*scale)),max(1,round(base.height*scale))),Image.Resampling.LANCZOS)
            x=(cw-image.width)//2;y=(ch-image.height)//2
        if angle and profile!='sway':image=image.rotate(angle,Image.Resampling.BICUBIC,expand=True);x=(cw-image.width)//2 if profile in ('spin','fall') else x;y=(ch-image.height)//2 if profile=='spin' else y
        canvas.alpha_composite(alpha_copy(image,opacity),(round(x),round(y)))
        path=SPRITES/f'{item_id}-f{i}.webp';save_image(canvas,path);frames.append(rel(path))
    return frames,(cw,ch)
def split_groups(im,count):
    if count==1:return [crop_visible(im)],0
    cols=min(4,count);rows=math.ceil(count/cols);result=[]
    for i in range(count):
        x=i%cols;y=i//cols
        cell=im.crop((round(x*im.width/cols),round(y*im.height/rows),round((x+1)*im.width/cols),round((y+1)*im.height/rows)))
        if cell.getchannel('A').getbbox():result.append(crop_visible(cell,.04))
    if not result:raise ValueError('sprite sheet contains no visible pieces')
    generated=0
    while len(result)<count:
        source=result[generated%len(result)]
        # Preserve the painted pixels while providing a visibly distinct fallback
        # when an image model omitted one requested grid cell.
        variant=source.transpose(Image.Transpose.FLIP_LEFT_RIGHT) if generated%2==0 else source.rotate((-1,1)[generated%2],Image.Resampling.BICUBIC,expand=True)
        result.append(variant);generated+=1
    return result[:count],generated

missing=[a['id'] for a in OLD if not (MASTERS/f"{a['id']}.png").exists()]
if missing and not args.partial:raise SystemExit(f'Missing {len(missing)} masters, first: '+', '.join(missing[:20]))
published=[];audit=[]
for old in OLD:
    item={**old};master=MASTERS/f"{item['id']}.png"
    if not master.exists():continue
    cat=item['category'];needs_alpha=cat in ('sticker','animation','fairy','frame','paper')
    im=rgba(master,needs_alpha)
    record={'id':item['id'],'category':cat,'masterSize':list(im.size),'masterMode':im.mode,'masterAlpha':list(im.getchannel('A').getextrema())}
    if cat=='background':
        runtime=contain(im,(1672,941),background=(255,255,255,255),margin=0)
        path=SPRITES/f"{item['id']}.webp";save_image(runtime.convert('RGB'),path)
        item.update(src=rel(path),width=1672,height=941,thumbnail=thumbnail(runtime,item['id'],True))
    elif cat=='animation':
        profile=motion_profile(item);frames,size=motion_frames(im,item['id'],profile=profile)
        item.update(src=frames[0],frames=frames,width=size[0],height=size[1],motionProfile=profile,thumbnail=thumbnail(crop_visible(im),item['id']),alphaRequired=True)
    elif cat=='fairy':
        originals=item.get('originalFairyGroups') or item.get('fairyGroups') or []
        groups=[];pieces,synthesized=split_groups(im,len(originals));record['synthesizedGroups']=synthesized
        for n,(piece,old_group) in enumerate(zip(pieces,originals)):
            if item.get('fairyMode')=='dynamic':
                profile=motion_profile(item);frames,size=motion_frames(piece,f"{item['id']}-g{n}",480,profile)
            else:
                piece=crop_visible(piece);piece.thumbnail((1024,1024),Image.Resampling.LANCZOS);path=SPRITES/f"{item['id']}-g{n}.webp";save_image(piece,path);frames=[rel(path)];size=piece.size
            groups.append({**old_group,'frames':frames,'width':size[0],'height':size[1],**({'motionProfile':profile} if item.get('fairyMode')=='dynamic' else {})})
        item.update(src=groups[0]['frames'][0],fairyGroups=groups,width=groups[0]['width'],height=groups[0]['height'],**({'motionProfile':motion_profile(item)} if item.get('fairyMode')=='dynamic' else {}),thumbnail=thumbnail(pieces[0],item['id']),alphaRequired=True)
    elif cat=='frame':
        runtime=contain(im,(1672,941),margin=0);path=SPRITES/f"{item['id']}.webp";save_image(runtime,path)
        item.update(src=rel(path),width=1672,height=941,thumbnail=thumbnail(runtime,item['id'],True),alphaRequired=True)
    elif cat=='paper':
        runtime=contain(crop_visible(im),(1672,941),margin=.02);path=SPRITES/f"{item['id']}.webp";save_image(runtime,path)
        item.update(src=rel(path),width=1672,height=941,thumbnail=thumbnail(runtime,item['id'],True),alphaRequired=True)
    elif cat=='texture':
        side=min(im.width,im.height);runtime=im.crop(((im.width-side)//2,(im.height-side)//2,(im.width+side)//2,(im.height+side)//2)).resize((1024,1024),Image.Resampling.LANCZOS)
        path=SPRITES/f"{item['id']}.webp";save_image(runtime,path);item.update(src=rel(path),width=1024,height=1024,thumbnail=thumbnail(runtime,item['id']))
    else:
        runtime=crop_visible(im);runtime.thumbnail((1024,1024),Image.Resampling.LANCZOS);path=SPRITES/f"{item['id']}.webp";save_image(runtime,path)
        item.update(src=rel(path),width=runtime.width,height=runtime.height,thumbnail=thumbnail(runtime,item['id']),alphaRequired=True)
    item['quality']='preschool-natural-v16';item['masterSource']=rel(master);item['artDirection']='自然结构基础上的学龄前水粉水彩绘本风格；禁止动物、植物和物品拟人化。'
    published.append(item);audit.append(record)

if not args.partial and len(published)!=len(OLD):raise SystemExit(f'Published {len(published)} of {len(OLD)}')
(OUT/'catalog.json').write_text(json.dumps(published,ensure_ascii=False,indent=2)+'\n')
(ROOT/'design/evidence/v1.6/resolution-alpha-audit.json').write_text(json.dumps({'complete':not missing,'missing':missing,'assets':audit},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'published':len(published),'missing':len(missing)},ensure_ascii=False))
