"""Build consistent gallery thumbnails and the targeted gallery repairs.

Requires Pillow. Use --output to inspect generated files before publishing.
Source masters for the restored frames and smoke are supplied separately.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
from pathlib import Path
import runpy

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"
CURRENT = ROOT / "public/assets/catalog.json"
LEGACY = ROOT / "resources/assets/legacy-catalog.json"
MASTERS = ROOT / "local-only/gallery-quality/masters"
DRAWINGS = runpy.run_path(str(Path(__file__).with_name("gallery-frame-art.py")))
RESAMPLE = Image.Resampling.LANCZOS
FRAME_RESTORATIONS = {"frame-garden", "frame-space"}
SMOKE_PROMPT = "Use case: illustration-story. A production sprite sheet for a preschool digital painting app. Exactly 8 poses of ONE light blue watercolor smoke wisp, laid out in a strict 4-column by 2-row equal cell grid, read left to right then second row. True transparent background (RGBA), no visible grid or checkerboard, no text, no letters or objects, no drop shadow. Each cell has one connected flowing S-shaped curl made of softly scalloped pale cyan and cornflower-blue gouache swirls, with a recognizably blue, readable semi-opaque core and subtly feathered outer edges. Keep the silhouette fully inside the central 72% width and height of every cell, generous fully transparent gutters. At small thumbnail size the blue curl must still read clearly on a warm cream background. Progress the same puff as it gently curls and rises, with consistent scale and origin, then loops naturally back to pose one. Children’s watercolor storybook, fine dry-brush texture, simple readable shapes, no black outlines. Wide 2:1 canvas."


def save_webp(image, path, quality):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, "WEBP", quality=quality, alpha_quality=100, method=4)


def aperture(image):
    w,h=image.size
    area=image.getchannel("A").crop((w//4,h//4,w*3//4,h*3//4))
    return sum(area.histogram()[32:])/area.width/area.height


def hue_variant(image, delta):
    h,s,v=image.convert("RGB").convert("HSV").split()
    h=h.point([(i+delta)%256 for i in range(256)])
    tinted=Image.merge("HSV",(h,s,v)).convert("RGBA")
    tinted.putalpha(image.getchannel("A"))
    return tinted


def smoke_poses(sheet, size):
    assert sheet.mode == "RGBA" and sheet.getchannel("A").getextrema()[0] == 0
    w,h=sheet.size
    poses=[]
    for i in range(8):
        col,row=i%4,i//4
        cell=sheet.crop((round(col*w/4),round(row*h/2),round((col+1)*w/4),round((row+1)*h/2)))
        core=cell.getchannel("A").point(lambda a: 255 if a>70 else 0).getbbox()
        if core is None or core[3]-core[1]<cell.height*.38:
            raise ValueError(f"Smoke frame {i+1} has no readable subject")
        # Exclude the sheet margins and retain the generated RGBA inside each pose.
        x0,y0,x1,y1=core
        poses.append(cell.crop((max(0,x0-10),max(0,y0-10),min(cell.width,x1+10),min(cell.height,y1+10))))
    scale=min(size*.78/max(im.height for im in poses), size*.73/max(im.width for im in poses))
    frames=[]
    for im in poses:
        sprite=im.resize((round(im.width*scale),round(im.height*scale)),RESAMPLE)
        frame=Image.new("RGBA",(size,size))
        frame.alpha_composite(sprite,((size-sprite.width)//2,round(size*.88)-sprite.height))
        frames.append(frame)
    return frames


def record_source(asset, record):
    method=record["method"]
    if method=="original-drawing":
        asset["masterSource"]="tools/assets/gallery-frame-art.py"
        asset["artNote"]="按原相框主题重新绘制，中央为真实透明区。"
    elif method=="restored-original-v1.4-frame":
        asset["masterSource"]=f"local-only/gallery-quality/masters/{asset['id']}.png"
        asset["artNote"]="恢复带真实透明区的自有绘本相框原画。"
    else:
        asset["masterSource"]=f"local-only/gallery-quality/masters/{asset['id']}.png"
        asset["artNote"]="ImageGen 水彩蓝烟帧表，保留四组配色与八帧循环。"


def repair_sprites(catalog, output, masters):
    records=[]
    for asset in catalog:
        key=asset["id"]
        if key in FRAME_RESTORATIONS:
            source=masters/(key+".png")
            image=Image.open(source).convert("RGBA")
            image=image.resize((asset["width"],asset["height"]),RESAMPLE)
            record={"id":key,"method":"restored-original-v1.4-frame","masterSha256":digest(source)}
        elif key in DRAWINGS["THEMES"]:
            image=DRAWINGS["draw_frame"](key,(asset["width"],asset["height"]))
            record={"id":key,"method":"original-drawing","theme":DRAWINGS["THEMES"][key][0]}
        elif key=="girl-2-2":
            source=masters/(key+".png")
            with Image.open(source) as sheet:
                poses=smoke_poses(sheet,asset["width"])
            groups=asset["fairyGroups"]
            if any(len(g["frames"])!=len(poses) for g in groups):
                raise ValueError("Unexpected smoke frame contract")
            for i,group in enumerate(groups):
                for filename,pose in zip(group["frames"],poses,strict=True):
                    save_webp(hue_variant(pose,round(i*18*256/360)) if i else pose,output/filename,94)
            records.append({"id":key,"method":"built-in-imagegen","masterSha256":digest(source),
                            "prompt":SMOKE_PROMPT,"groups":len(groups),"framesPerGroup":len(poses)})
            continue
        else:
            continue
        if aperture(image)>.005:
            raise ValueError(f"Frame aperture is obstructed: {key}")
        save_webp(image,output/asset["src"],94)
        records.append(record)
    return records


def digest(path):
    with path.open("rb") as f:
        return hashlib.file_digest(f,"sha256").hexdigest()


def image_for(asset, output, svg_preview):
    source=output/asset["src"]
    if not source.exists():
        source=PUBLIC/asset["src"]
    if source.suffix==".svg":
        if svg_preview is None:
            raise ValueError("Supply --stop-sign-png with a rasterized copy of the SVG stop sign")
        source=svg_preview
    with Image.open(source) as image:
        return image.convert("RGBA")


def thumbnail(asset, output, svg_preview):
    image=image_for(asset,output,svg_preview)
    category=asset["category"]
    if category=="background":
        return image.convert("RGB").resize((384,216),RESAMPLE)
    if category=="texture":
        return ImageOps.fit(image.convert("RGB"),(256,256),RESAMPLE)
    if category=="frame":
        preview=Image.new("RGBA",(384,216),"#dfe8d8")
        preview.alpha_composite(image.resize(preview.size,RESAMPLE))
        return preview.convert("RGB")
    size=(320,240)
    alpha=image.getchannel("A")
    threshold=max(18,round(alpha.getextrema()[1]*.16))
    bounds=alpha.point(lambda a:255 if a>=threshold else 0).getbbox()
    if bounds is None:
        raise ValueError(f"No visible art: {asset['id']}")
    left,top,right,bottom=bounds
    pad=max(2,round(max(right-left,bottom-top)*.025))
    image=image.crop((max(0,left-pad),max(0,top-pad),min(image.width,right+pad),min(image.height,bottom+pad)))
    paper=category=="paper"
    preview=Image.new("RGBA",size,"#d8e2d0" if paper else (0,0,0,0))
    subject=ImageOps.contain(image,(round(size[0]*.87),round(size[1]*.86)),RESAMPLE)
    preview.alpha_composite(subject,((size[0]-subject.width)//2,(size[1]-subject.height)//2))
    return preview.convert("RGB") if paper else preview


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,required=True)
    parser.add_argument("--masters",type=Path,default=MASTERS)
    parser.add_argument("--stop-sign-png",type=Path,required=True)
    args=parser.parse_args()
    current,legacy=[json.loads(p.read_text()) for p in (CURRENT,LEGACY)]
    output=args.output
    records=repair_sprites(current,output,args.masters)
    by_id={a["id"]:a for a in current}
    for record in records:
        record_source(by_id[record["id"]],record)
    paths=set()
    entries=current+legacy
    for asset in entries:
        if asset["id"]=="road-stop-sign":
            asset["thumbnail"]="assets/background/thumbs/road-stop-sign.webp"
        path=asset["thumbnail"]
        if path in paths:
            raise ValueError(f"Shared thumbnail path: {path}")
        paths.add(path)

    def render(asset):
        image=thumbnail(asset,output,args.stop_sign_png)
        save_webp(image,output/asset["thumbnail"],90)

    with ThreadPoolExecutor(max_workers=6) as pool:
        for _ in pool.map(render,entries):
            pass
    (output/"catalog.json").write_text(json.dumps(current,ensure_ascii=False,indent=2)+"\n")
    (output/"legacy-catalog.json").write_text(json.dumps(legacy,ensure_ascii=False,indent=2)+"\n")
    (output/"gallery-quality-provenance.json").write_text(json.dumps(records,ensure_ascii=False,indent=2)+"\n")
    print(f"Built {len(entries)} previews and {len(records)} repaired entries")


if __name__=="__main__":
    main()
