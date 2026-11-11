"""Render the original Luoye interface drawings to the legacy JPEG layout.

Requires Pillow. The manifest records geometry and fingerprints only.
Rendering does not read the old images or the reference application.
"""
import argparse
import hashlib
import json
import math
import random
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "tools/assets/manifests/classic-redraw.json"
INK = "#523e35"
CREAM = "#fff6e2"
PAPER = "#fffcf5"
GOLD = "#efb45d"
PEACH = "#efab8b"
PINK = "#d78397"
MINT = "#9aba9c"
TEAL = "#689b93"
BLUE = "#80a8c6"
LILAC = "#aa91bd"
SAND = "#e8c799"
PALETTE = (PEACH, GOLD, MINT, BLUE, LILAC, PINK)
RESAMPLE = Image.Resampling.LANCZOS


def points(cx, cy, radius, n, inner=None, start=-90):
    count = n * 2 if inner else n
    return [
        (cx + (radius if i % 2 == 0 or inner is None else inner) * math.cos(math.radians(start + i * 360 / count)),
         cy + (radius if i % 2 == 0 or inner is None else inner) * math.sin(math.radians(start + i * 360 / count)))
        for i in range(count)
    ]


def icon(name, color):
    """Draw a purpose-specific icon on a square coordinate grid."""
    img = Image.new("RGBA", (96, 96))
    d = ImageDraw.Draw(img)
    def line(coords, fill=INK, width=6):
        d.line(coords, fill=fill, width=width, joint="curve")
    def box(bounds, fill=color, radius=7):
        d.rounded_rectangle(bounds, radius=radius, fill=fill, outline=INK, width=4)
    def oval(bounds, fill=color, width=4):
        d.ellipse(bounds, fill=fill, outline=INK if width else None, width=width)
    def poly(coords, fill=color):
        d.polygon(coords, fill=fill)
        line(coords + [coords[0]], width=4)
    def arc(bounds, start, end, fill=INK, width=6):
        d.arc(bounds, start, end, fill=fill, width=width)

    if name.startswith("pose"):
        kind = int(name[-1])
        oval((39, 12, 58, 31), color)
        line([(49, 31), (48, 58)], width=7)
        arms = (((24,50),(73,50)),((26,33),(72,61)),((27,58),(75,29)))[kind]
        legs = (((35,80),(63,80)),((25,75),(67,85)),((29,84),(71,72)))[kind]
        line([arms[0],(48,42),arms[1]], TEAL, 7)
        line([legs[0],(48,58),legs[1]], TEAL, 7)
        return img
    if name.startswith("select-"):
        shape = name.removeprefix("select-")
        outline = {
            "triangle": points(48,50,33,3),
            "rect": [(18,27),(78,27),(78,70),(18,70)],
            "star": points(48,48,36,5,17),
            "pentagon": points(48,48,34,5),
            "free": [(25,19),(51,15),(76,29),(82,56),(63,78),(34,77),(15,57),(15,37)],
            "circle": points(48,48,32,24),
            "burst": points(48,48,36,8,25),
            "moon": [(58,15),(40,18),(25,31),(18,51),(24,69),(41,81),(62,78),(77,65),
                     (61,67),(48,58),(43,44),(46,29)],
        }[shape]
        d.polygon(outline, fill="#efe5cf")
        closed = outline + [outline[0]]
        for a,b in zip(closed, closed[1:]):
            length=math.dist(a,b)
            if length:
                for start in range(0,math.ceil(length),9):
                    p=min(1,start/length)
                    q=min(1,(start+5)/length)
                    line([(a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f) for f in (p,q)],TEAL,3)
        return img
    if name.startswith("brush"):
        kind = int(name.removeprefix("brush"))
        if kind in (3, 4, 5, 6):
            box((20, 35, 73, 60), color if kind != 6 else CREAM)
            poly([(73, 35), (88, 48), (73, 60)], SAND)
            line([(32, 38), (32, 57)], PAPER, 4)
            if kind == 4:
                line([(42, 42), (61, 42)], PAPER, 4)
            if kind == 5:
                line([(47, 39), (47, 56)], PAPER, 4)
        else:
            box((8, 42, 63, 55), color)
            box((58, 39, 72, 58), SAND, 3)
            if kind == 1:
                poly([(71, 37), (84, 37), (89, 43), (89, 56), (71, 60)], color)
                for y in (44, 50, 55):
                    line([(76, y), (86, y)], PAPER, 2)
            elif kind == 7:
                poly([(71, 39), (90, 34), (90, 62), (71, 58)], PAPER)
            elif kind == 8:
                poly([(70, 40), (89, 32), (91, 64), (70, 57)], GOLD)
            else:
                poly([(71, 40), (81, 43), (90, 48), (79, 57), (71, 57)], PEACH if kind == 2 else INK)
        return img.rotate(28 if kind != 7 else 18, resample=Image.Resampling.BICUBIC)
    if name in ("rect", "roundrect", "square"):
        box((18, 25, 78, 70), color, {"rect": 2, "roundrect": 12, "square": 4}[name])
        if name == "square":
            box((27, 33, 68, 62), PAPER, 2)
    elif name in ("triangle", "pentagon", "hexagon", "star"):
        poly(points(48, 49, 34, {"triangle":3,"pentagon":5,"hexagon":6,"star":5}[name], 15 if name == "star" else None))
    elif name in ("circle", "ellipse", "orb", "glow", "hue", "rgb", "checker"):
        if name == "rgb":
            for x,y,c in ((42,35,PINK),(34,57,MINT),(58,57,BLUE)):
                oval((x-15,y-15,x+15,y+15),c,2)
        elif name == "hue":
            for i,c in enumerate(PALETTE):
                d.pieslice((17,17,79,79),i*60,(i+1)*60,fill=c)
            oval((35,35,61,61), PAPER, 0)
        elif name == "checker":
            box((18,18,78,78),PAPER)
            for x,y in ((23,23),(47,47)):
                d.rectangle((x,y,x+23,y+23),fill=TEAL)
        elif name == "glow":
            for r,c in ((38,"#fbe1a1"),(28,GOLD),(14,"#fff8d7")):
                oval((48-r,48-r,48+r,48+r),c,0)
        else:
            oval((15,26,81,70) if name == "ellipse" else (18,18,78,78))
            if name == "orb":
                oval((30,27,45,42), PAPER, 0)
    elif name in ("line","curve","free","moon","burst"):
        if name == "line":
            line([(17,65),(80,31)], INK, 13)
            line([(20,62),(78,32)], color, 7)
        elif name == "moon":
            poly([(57,15),(37,25),(26,45),(28,65),(43,78),(64,78),(78,65),(58,66),(45,53),(44,33)])
        elif name == "burst":
            poly(points(48,48,37,9,22))
        elif name == "curve":
            line([(15,61),(24,44),(36,35),(48,40),(59,54),(70,54),(82,29)], color, 8)
        else:
            poly([(22,21),(47,14),(77,33),(71,64),(54,79),(31,71),(17,52)])
    elif name.startswith("eraser"):
        variant = int(name[-1])
        poly([(12,51),(47,20),(83,42),(79,55),(43,79),(12,62)], (BLUE,PINK,GOLD)[variant])
        poly([(12,51),(29,36),(60,57),(43,70)], CREAM)
    elif name.startswith("fill"):
        variant = int(name[-1])
        poly([(24,31),(62,25),(69,67),(33,75)], PALETTE[variant])
        oval((22,23,65,39), CREAM)
        arc((19,14,73,57), 170, 337, INK, 4)
        if variant in (1, 2, 3):
            for x,y in ((38,49),(52,55),(45,65)):
                oval((x,y,x+8,y+7), PAPER, 0)
        if variant in (4, 5):
            line([(34,49),(62,44)], PAPER, 4)
    elif name in ("text","info","help"):
        if name == "text":
            line([(24,72),(45,23),(53,23),(74,72)], INK, 9)
            line([(32,55),(65,55)], INK, 7)
        elif name == "info":
            oval((15,15,81,81), BLUE)
            line([(48,43),(48,66)], PAPER, 9)
            oval((44,29,52,37), PAPER, 0)
        else:
            arc((27,20,68,56), 180, 455, INK, 8)
            line([(48,53),(48,62)], INK, 7)
            oval((44,70,52,78), INK, 0)
    elif name in ("confirm","cancel","move","up","down","undo","redo","reset","flip","mirror","rotate","checkall","invert","clear","power"):
        if name in ("confirm","checkall"):
            if name == "checkall":
                box((14,14,82,82), PAPER)
            line([(22,48),(41,65),(74,29)], TEAL, 10)
        elif name in ("cancel","clear"):
            if name == "clear":
                box((14,14,82,82), PAPER)
            line([(25,25),(70,70)], PINK, 10)
            line([(25,70),(70,25)], PINK, 10)
        elif name in ("up","down"):
            y = 30 if name == "up" else 66
            dy = 23 if name == "up" else -23
            poly([(48,y),(23,y+dy),(73,y+dy)], color)
        elif name in ("undo","redo","reset","rotate"):
            arc((21,25,75,78), 190, 505, TEAL, 8)
            poly([(15,42),(22,19),(42,35)], color)
            if name == "redo":
                return ImageOps.mirror(img)
        elif name == "power":
            arc((19,21,77,79), -55, 235, INK, 7)
            line([(48,16),(48,48)], INK, 8)
        elif name == "move":
            line([(18,48),(78,48)], TEAL, 7)
            line([(48,18),(48,78)], TEAL, 7)
            for x,y,dx,dy in ((18,48,13,0),(78,48,-13,0),(48,18,0,13),(48,78,0,-13)):
                poly([(x,y),(x+dx-dy*.65,y+dy+dx*.65),(x+dx+dy*.65,y+dy-dx*.65)], color)
        elif name == "invert":
            box((16,16,80,80), PAPER)
            poly([(18,18),(76,18),(18,76)], TEAL)
        else:
            line([(48,17),(48,79)], TEAL, 4)
            poly([(15,30),(39,48),(15,66)], color)
            poly([(81,30),(57,48),(81,66)], BLUE if name == "mirror" else color)
    elif name in ("new","copy","paste","folder","picture","film","mail","list","stamp","globe"):
        if name == "folder":
            poly([(14,35),(33,35),(40,25),(74,25),(81,36),(83,70),(15,70)], GOLD)
            line([(19,43),(78,43)], PAPER, 4)
        elif name == "globe":
            oval((16,16,80,80), BLUE)
            poly([(24,34),(41,22),(53,34),(44,46),(32,50),(34,65),(24,57)], MINT)
            poly([(55,46),(73,45),(69,64),(57,73),(55,60)], MINT)
        elif name == "mail":
            box((15,29,81,68), CREAM)
            line([(17,32),(48,52),(80,32)], TEAL, 5)
        elif name == "stamp":
            oval((34,18,62,49), PEACH)
            box((25,49,72,66), GOLD)
            box((16,67,80,80), PINK)
        else:
            if name == "copy":
                box((15,19,63,69), SAND)
            box((26,28,79,78), PAPER)
            if name in ("film","picture"):
                oval((56,37,66,47), GOLD, 0)
                poly([(31,69),(46,48),(58,63),(64,55),(74,69)], MINT)
                if name == "film":
                    for y in (36,47,58,69):
                        line([(22,y),(29,y)], TEAL, 4)
            elif name == "paste":
                box((34,19,68,34), GOLD, 4)
                line([(37,49),(67,49)], TEAL, 5)
            elif name == "new":
                line([(39,54),(67,54)], TEAL, 5)
                line([(53,41),(53,67)], TEAL, 5)
            else:
                for y in (42,53,64):
                    line([(36,y),(68,y)], TEAL, 4)
    elif name in ("music","speaker","cut","dropper","spray","wand","sun","flower","leaf","tree","ruler","noise","swirl","sparkle","fan","hand","robot","glasses","palette","gear","droplet","width","height","corner","speed"):
        if name == "music":
            line([(39,64),(39,30),(72,22),(72,54)], INK, 8)
            oval((22,57,43,75), PINK)
            oval((55,48,76,65), PINK)
        elif name == "speaker":
            poly([(15,40),(29,40),(51,25),(51,71),(29,56),(15,56)], GOLD)
            arc((39,27,77,69), -64, 64, TEAL, 5)
            arc((33,16,89,80), -62, 62, TEAL, 4)
        elif name == "cut":
            oval((16,52,37,75), PEACH)
            oval((56,52,77,75), PEACH)
            line([(32,56),(68,21)], INK, 6)
            line([(62,55),(29,21)], INK, 6)
        elif name in ("dropper","wand","ruler"):
            if name == "wand":
                line([(20,76),(58,38)], INK, 11)
                line([(20,76),(58,38)], LILAC, 7)
                poly(points(64,32,20,5,9), GOLD)
            elif name == "dropper":
                line([(22,75),(63,36)], INK, 14)
                line([(25,72),(63,36)], BLUE, 8)
                oval((56,17,78,40), PINK)
            else:
                box((13,35,84,62), GOLD)
                for x in range(23,80,10):
                    line([(x,39),(x,48 if x%20==3 else 44)], INK, 3)
        elif name in ("flower","sun","sparkle","gear"):
            if name == "sparkle":
                poly(points(48,48,38,4,13), GOLD)
            elif name == "gear":
                poly(points(48,48,34,8,28), TEAL)
                oval((35,35,61,61), PAPER, 3)
            else:
                for x,y in points(48,48,25,8):
                    oval((x-10,y-10,x+10,y+10), color, 0)
                oval((29,29,67,67), GOLD)
        elif name in ("leaf","tree"):
            if name == "leaf":
                poly([(20,70),(23,43),(39,24),(75,16),(71,49),(53,71),(33,76)], MINT)
                line([(20,73),(58,39)], TEAL, 5)
            else:
                box((42,49,54,80), SAND, 2)
                for x,y in ((34,46),(61,48),(47,31)):
                    oval((x-17,y-17,x+17,y+17), MINT, 3)
        elif name in ("spray","noise"):
            if name == "spray":
                box((20,42,48,78), color)
                box((25,28,47,44), SAND)
            for x,y,r in ((56,33,5),(71,25,4),(81,42,5),(63,55,4),(42,20,4),(74,64,3),(51,70,4)):
                oval((x-r,y-r,x+r,y+r), color, 0)
        elif name == "swirl":
            coords=[]
            for i in range(58):
                t=i*.18
                radius=2+i*.57
                coords.append((48+radius*math.cos(t),48+radius*math.sin(t)))
            line(coords, TEAL, 7)
        elif name == "fan":
            poly([(46,75),(16,40),(25,23),(46,17),(68,23),(81,40)], GOLD)
            for x in (25,40,55,70):
                line([(46,71),(x,33)], INK, 3)
        elif name == "hand":
            poly([(23,57),(19,46),(26,39),(34,49),(34,25),(42,22),(47,42),(50,18),(57,21),(61,43),(65,24),(72,29),(74,55),(66,75),(48,81)], GOLD)
        elif name == "robot":
            box((19,29,77,70), TEAL, 14)
            line([(48,17),(48,30)], INK, 5)
            oval((43,10,53,20), GOLD, 0)
            for x in (33,57):
                oval((x,41,x+8,49), PAPER, 0)
            arc((38,46,60,60),0,180,PAPER,3)
        elif name == "glasses":
            for x in (13,51):
                oval((x,32,x+31,66), BLUE)
            line([(43,43),(52,43)], INK, 5)
        elif name == "palette":
            oval((14,22,83,75), SAND)
            for x,y,c in ((29,38,PINK),(46,32,GOLD),(64,41,MINT),(48,59,BLUE)):
                oval((x-6,y-6,x+6,y+6),c,0)
        elif name == "droplet":
            poly([(48,13),(29,44),(25,58),(31,72),(48,81),(65,72),(71,58),(67,44)], BLUE)
            arc((31,37,64,68),108,167,PAPER,4)
        else:
            if name == "corner":
                line([(26,69),(26,26),(69,26)], INK, 8)
            elif name == "speed":
                for x in (17,39,61):
                    poly([(x,28),(x+19,48),(x,68)], GOLD)
            else:
                line([(20,48),(76,48)], INK, 5)
                poly([(14,48),(29,35),(29,61)], GOLD)
                poly([(82,48),(67,35),(67,61)], GOLD)
                if name == "height":
                    return img.rotate(90)
    else:
        raise ValueError(f"Missing icon drawing: {name}")
    return img


SHAPES = ("line","triangle","rect","star","roundrect","pentagon","hexagon","circle","ellipse")
REGIONS = tuple(f"select-{shape}" for shape in ("triangle","rect","star","pentagon","free","circle","burst","moon"))
ADJUST = ("hue","sun","rgb","checker","glow","rgb")
EFFECTS = ("orb","swirl","droplet","glow","fan")
PRIMARY = ("brush0","eraser0","fill1","dropper","film","spray","glasses","wand","leaf","palette","stamp","orb","ruler","hand")
OPERATIONS = ("rotate","copy","move","flip","mirror","undo","confirm","confirm","cancel")
TOOLS = {
    "babout":("info",14),"bcopy":("copy",8),"bpaste":("paste",8),
    "bcut":("cut",8),"bmanager":("folder",8),"brdel":("clear",8),
    "bredo":("redo",8),"brinvert":("invert",8),"bundo":("undo",8),
    "bexit":("power",8),"bhelp":("help",8),"bmusic":("music",10),
    "bnew":("new",8),"bprompt":("glow",2),"brall":("checkall",8),
    "pa_but0":("move",2),"pa_but1":("confirm",2),"pa_but2":("cancel",2),
}


def shade(index):
    return PALETTE[index % len(PALETTE)]


def canvas(size, background=CREAM):
    return Image.new("RGB", size, background)


def tile(img, name, x, y, size, color=GOLD, angle=0, muted=False):
    art = icon(name,color)
    if angle:
        art = art.rotate(angle, resample=Image.Resampling.BICUBIC)
    if muted:
        alpha = art.getchannel("A")
        art = ImageOps.grayscale(art).convert("RGBA")
        art.putalpha(alpha)
    art = art.resize((max(1,round(size)),max(1,round(size))), RESAMPLE)
    img.paste(art,(round(x-art.width/2),round(y-art.height/2)),art)


def card(d, box, color=PAPER, border=SAND, radius=10):
    d.rounded_rectangle(box, radius=radius, fill=color, outline=border, width=1)


def strip(size, count, name, color, *, round_button=False, disabled=None, tilt=False, background=CREAM):
    w,h=size
    img=canvas(size,background)
    d=ImageDraw.Draw(img)
    for i in range(count):
        left,right=round(i*w/count),round((i+1)*w/count)
        width=right-left
        disabled_frame=i==disabled
        active=i in (1,count-1) and not disabled_frame
        pressed=count>2 and i in (2,3)
        face = "#e4e0d8" if disabled_frame else ("#f8d9a8" if active else "#f7ecd6" if pressed else PAPER)
        cx,cy=(left+right)/2,h/2+(1 if pressed else -1)
        button=min(width,h)*.89
        if round_button:
            x0,y0,x1,y1=cx-button/2,cy-button/2,cx+button/2,cy+button/2
            d.ellipse((x0,y0+1,x1,y1+1),fill="#dfbe94")
            d.ellipse((x0,y0,x1,y1),fill=face,outline=TEAL if active else SAND,width=1)
        else:
            pad=max(1,round(min(width,h)*.075))
            card(d,(left+pad,pad,right-pad-1,h-pad-1),face,TEAL if active else SAND,max(2,h//7))
        angle=(math.sin(i*math.tau/count)*19 if tilt else 0)
        scale=1+(.04*math.sin(i*.9) if tilt else 0)
        tile(img,name,cx,cy,button*(.76 if round_button else .97)*scale,color,angle,disabled_frame)
    return img


def recent(stem, size):
    match=re.fullmatch(r"(.*?)([0-9]+)",stem)
    family,number=(match[1],int(match[2])) if match else (stem,0)
    families={
        "adjust":ADJUST,"draw":SHAPES,"effect":EFFECTS,"fill":tuple(f"fill{i}" for i in range(6)),
        "fra":("swirl","orb","triangle","globe"),"girl":("picture","film","stamp"),
        "krew":("sparkle","glow"),"lanim":("film","folder","picture","leaf","wand","flower"),
        "lclr":("brush3","brush4","brush5","brush6","leaf","sun"),
        "lrole":("picture","glasses","tree","droplet","leaf","brush2","flower","stamp"),
        "pen":tuple(f"brush{i}" for i in range(9)),"rgn":REGIONS,
        "rubber":("eraser0","eraser1","eraser2"),"special":("pose0","pose1","pose2"),
    }
    singles={"clone":"stamp","color":"dropper","font":"text","gradient":"orb","magic":"wand",
             "mode":"brush4","noise":"noise","op":"move","range":"hue","sincos":"rgb"}
    name=families[family][number] if family in families else singles[stem]
    return strip(size,2,name,shade(number+sum(map(ord,family))),round_button=False)


def desk(size):
    img=canvas(size,"#e4c491");d=ImageDraw.Draw(img)
    rng=random.Random(287)
    for _ in range(220):
        y=rng.randrange(600);x=rng.randrange(-100,780)
        d.arc((x,y,x+rng.randrange(95,360),y+15),200,345,fill="#dfbc88",width=1)
    card(d,(88,29,710,499),"#bd9a6f","#aa855f",15)
    card(d,(96,35,704,493),PAPER,"#c79c67",12)
    card(d,(103,42,697,486),"white","#ead8b9",6)
    card(d,(53,3,708,36),CREAM,"#bd925e",12)
    for i in range(12):
        x=108+i*50
        d.ellipse((x-11,9,x+11,30),fill="#eddbbd",outline="#c7a779")
        d.ellipse((x-6,12,x+6,24),fill=PAPER)
    card(d,(8,99,89,189),CREAM,"#bb9868",12)
    for bounds,color in (((18,117,52,153),TEAL),((43,135,76,173),PEACH)):
        card(d,bounds,color,INK,6)
    for i,color in enumerate(PALETTE):
        x=17+i*11
        d.ellipse((x,105,x+7,112),fill=color)
    card(d,(9,196,85,565),"#edd5ae","#bd9a6f",12)
    card(d,(712,76,791,480),"#e9ead6","#a8a780",14)
    tile(img,"flower",753,62,51,GOLD)
    card(d,(93,499,702,590),CREAM,"#bd925e",15)
    card(d,(102,509,172,554),"#efdbb4",SAND,8)
    card(d,(183,509,672,554),PAPER,SAND,10)
    for i in range(6):
        tile(img,"leaf",111+i*112,572,22,shade(i),angle=(-1)**i*20)
    return img


def simple_render(path, size):
    group=path.parent.name
    if group=="desk":
        return desk(size)
    if group=="recent":
        return recent(path.stem,size)
    name,count=TOOLS[path.stem]
    return strip(size,count,name,shade(list(TOOLS).index(path.stem)),round_button=True,
                 disabled=count-2 if count>2 else None,tilt=count>2)


def run_render(render, groups, destination):
    specs=json.loads(MANIFEST.read_text())
    selected=[(Path(p),value) for p,value in specs.items() if Path(p).parent.name in groups]
    for path,spec in selected:
        size=tuple(spec["size"])
        image=render(path,size)
        assert image.size==size and image.mode=="RGB", path
        out=destination/path
        out.parent.mkdir(parents=True,exist_ok=True)
        image.save(out,"JPEG",quality=95,subsampling=0)
        assert hashlib.sha256(out.read_bytes()).hexdigest()!=spec["previousSha256"], path
    print(f"Rendered {len(selected)} JPEGs to {destination}")


# Slots are fractions of panel width and height. Keep the tracks and color wells
# in their original regions, using newly drawn shapes and a warm paper palette.
PANELS = {
    "adjust0":[("track",.09,.72,.18,"hue"),("track",.32,.72,.18,"sun"),("track",.55,.72,.18,"glow")],
    "adjust1":[("track",.07,.72,.23,"sun"),("track",.38,.72,.24,"orb")],
    "adjust2":[("track",.09,.72,.18,"red"),("track",.32,.72,.18,"green"),("track",.55,.72,.18,"blue")],
    "adjust3":[("track",.08,.72,.31,"checker")],
    "adjust4":[("track",.09,.72,.18,"red"),("track",.32,.72,.18,"green"),("track",.55,.72,.18,"blue")],
    "adjust5":[("double",.10,.35,.17,"width"),("double",.33,.35,.17,"height"),("double",.56,.35,.17,"speed")],
    "draw0":[("swatch",.02,.13,.24,"line"),("track",.32,.54,.32,"")],
    "draw1":[("swatch",.02,.13,.24,"triangle"),("track",.32,.54,.32,"")],
    "draw2":[("swatch",.02,.13,.24,"rect"),("track",.32,.54,.32,"")],
    "effect0":[("track",.09,.70,.28,"noise"),("rack",.48,.07,.50,"")],
    "effect1":[("track",.09,.70,.28,"swirl"),("rack",.48,.07,.50,"")],
    "effect2":[("track",.03,.70,.26,"width"),("track",.34,.70,.25,"height"),("track",.63,.70,.31,"noise")],
    "effect3":[("track",.07,.64,.33,"noise"),("track",.58,.64,.33,"sun")],
    "effect4":[("track",.08,.67,.25,"noise"),("track",.40,.67,.24,"sun"),("track",.70,.67,.23,"fan")],
    "fill0":[("swatch",.02,.13,.24,"fill0"),("rack",.28,.07,.70,"")],
    "fill1":[("swatch",.02,.13,.24,"fill1"),("track",.42,.50,.44,"droplet")],
    "fill2":[("swatch",.02,.13,.34,"pair"),("rack",.39,.07,.59,"")],
    "fill3":[("swatch",.02,.13,.24,"fill3"),("rack",.35,.07,.63,"")],
    "font":[("swatch",.02,.13,.24,"text"),("entry",.29,.16,.22,""),("track",.29,.72,.22,"")],
    "fractal0":[("swatch",.02,.12,.15,"picture"),("double",.23,.32,.17,"corner"),("double",.49,.32,.17,"corner"),("double",.75,.32,.21,"width")],
    "fractal1":[("swatch",.02,.12,.15,"picture"),("double",.23,.32,.17,"corner"),("double",.49,.32,.17,"corner"),("double",.75,.32,.21,"width")],
    "fractal2":[("swatch",.02,.12,.15,"picture"),("double",.28,.32,.18,"width"),("track",.62,.31,.18,"noise")],
    "fractal3":[("swatch",.02,.12,.15,"picture"),("double",.28,.32,.18,"width"),("rack",.51,.07,.47,"")],
    "gradient":[("gradient",.04,.16,.53,""),("track",.04,.74,.53,"")],
    "krew0":[("track",.06,.64,.34,"noise"),("track",.58,.64,.33,"speed")],
    "krew1":[("track",.06,.64,.34,"noise"),("track",.58,.64,.33,"speed")],
    "magic":[("track",.09,.55,.28,"wand"),("rack",.44,.07,.54,"")],
    "noise":[("swatch",.02,.13,.24,"noise"),("track",.32,.66,.24,"fan"),("track",.63,.66,.24,"noise")],
    "pen0":[("swatch",.02,.13,.24,"brush0"),("double",.36,.32,.48,""),("swatch",.90,.12,.08,"blue")],
    "pen1":[("swatch",.02,.13,.24,"brush1"),("double",.36,.32,.48,""),("swatch",.90,.12,.08,"blue")],
    "range":[("swatch",.02,.13,.32,"pair"),("track",.42,.65,.34,"hue")],
    "rubber":[("track",.10,.53,.34,"eraser0"),("rack",.52,.07,.46,"")],
    "sincos":[("rgb",.02,.13,.22,"red"),("rgb",.25,.13,.22,"green"),("rgb",.48,.13,.22,"blue")],
}
BLANK_PANELS = ("girl","lanim","lclr","lrole","rgn0","rgn1","special")
DOT = {"red":PINK,"green":MINT,"blue":BLUE}


def panel(stem,size):
    w,h=size
    img=canvas(size,"#eed8ad")
    d=ImageDraw.Draw(img)
    card(d,(1,1,w-2,h-2),CREAM,"#c49c6b",8)
    d.line((9,3,w-10,3),fill=PAPER,width=1)
    slots=PANELS.get(stem)
    if slots is None:
        if stem not in BLANK_PANELS:
            raise ValueError(stem)
        return img
    def track(left,y,length,marker):
        d.rounded_rectangle((left,y-2,left+length,y+3),radius=2,fill="#d7b789")
        d.rounded_rectangle((left+1,y-1,left+length-1,y+1),radius=1,fill="#b18a60")
        if marker in DOT:
            m=left+length/2
            d.ellipse((m-5,y-16,m+5,y-6),fill=DOT[marker],outline=INK)
        elif marker:
            tile(img,marker,left+length/2,y-h*.27,h*.29)
        else:
            for x in (left-6,left+length+6):
                d.ellipse((x-2,y-2,x+2,y+2),fill=GOLD)
    for kind,x,y,span,mark in slots:
        left,top,length=round(x*w),round(y*h),round(span*w)
        if kind=="track":
            track(left,top,length,mark)
        elif kind=="double":
            track(left,top,length,"")
            track(left,top+round(.38*h),length,"")
            if mark:
                tile(img,mark,left-11,top+h*.19,h*.3)
        elif kind in ("swatch","entry","gradient","rgb"):
            bottom=round(h*.85) if kind in ("swatch","rgb") else round(h*.55)
            card(d,(left,top,left+length,bottom),PAPER,SAND,5)
            if kind=="swatch":
                area=min(round(length*.64),round(h*.56))
                if mark=="pair":
                    for j,c in enumerate((TEAL,PEACH)):
                        card(d,(left+6+j*(area+6),top+4,left+4+j*(area+6)+area,bottom-4),c,"#aa805e",4)
                else:
                    card(d,(left+5,top+4,left+area,bottom-4),DOT.get(mark,TEAL),"#a08061",4)
                    if mark and mark not in DOT and length>area+20:
                        tile(img,mark,left+(length+area)/2, (top+bottom)/2,h*.36)
            elif kind=="gradient":
                for j in range(3,length-2):
                    rgb=tuple(round(a+(b-a)*j/length) for a,b in zip((107,153,148),(245,186,139)))
                    d.line((left+j,top+3,left+j,bottom-3),fill=rgb)
            elif kind=="rgb":
                for j in range(3):
                    yy=top+round((bottom-top)*(j+1)/4)
                    d.line((left+6,yy,left+length-8,yy),fill=DOT[mark],width=3)
        else:
            bottom=round(h*.92)
            card(d,(left,top,left+length,bottom),"#e6ead6","#adbd98",6)
            for row in range(2):
                for col in range(7):
                    cx=left+round(length*(col+.5)/7)
                    cy=top+round((bottom-top)*(row+.5)/2)
                    radius=max(3,min(6,length//24))
                    d.ellipse((cx-radius,cy-radius,cx+radius,cy+radius),fill="#f1f2df",outline="#a7b994")
    return img


def dialog_surface(stem,size):
    w,h=size
    img=canvas(size,"black")
    d=ImageDraw.Draw(img)
    def zone(bounds,color=PAPER,border=SAND,radius=10):
        box=tuple(round(t*(w if i%2==0 else h)) for i,t in enumerate(bounds))
        card(d,box,color,border,radius)
    accent={"ab_back":GOLD,"cl_back":BLUE,"ex_back":LILAC,"im_back":MINT,
            "ma_back":PEACH,"ms_back":BLUE,"mu_back":TEAL,"pr_back":BLUE}[stem]
    zone((.02,.025,.98,.97),accent,INK,18)
    zone((.035,.045,.965,.945),CREAM,accent,15)
    if stem=="ab_back":
        zone((.07,.09,.74,.89))
        zone((.77,.09,.93,.89),"#f6d39a",GOLD,8)
        tile(img,"info",w*.85,h*.23,h*.20)
        for i,name in enumerate(("brush0","leaf","star")):
            tile(img,name,w*.85,h*(.42+i*.15),h*.13,shade(i))
    elif stem=="cl_back":
        x0,y0,x1,y1=round(w*.19),round(h*.15),round(w*.72),round(h*.77)
        rainbow=((240,112,113),(247,193,106),(148,193,130),(105,180,189),(126,140,205),(200,133,191))
        for x in range(x0,x1):
            f=(x-x0)*len(rainbow)/max(1,x1-x0)
            i=int(f);a,b=rainbow[i],rainbow[(i+1)%len(rainbow)]
            for y in range(y0,y1):
                light=(y-y0)/(y1-y0)
                c=tuple(round((aa+(bb-aa)*(f-i))*(1-light)+247*light) for aa,bb in zip(a,b))
                d.point((x,y),fill=c)
        d.rectangle((x0-1,y0-1,x1,y1),outline=INK,width=2)
        zone((.19,.79,.72,.86),TEAL,INK,3)
        zone((.06,.28,.15,.40),PINK,INK,3)
        for i in range(3):
            zone((.06,.44+i*.10,.15,.50+i*.10),PAPER,TEAL,3)
            tile(img,("confirm","reset","cancel")[i],w*.83,h*(.36+i*.17),h*.13)
    elif stem=="ex_back":
        zone((.34,.14,.75,.68),"#eae6d9",LILAC,7)
        for i,name in enumerate(("width","height","corner","noise")):
            zone((.11,.19+i*.14,.29,.27+i*.14),PAPER,LILAC,4)
            tile(img,name,w*.075,h*(.23+i*.14),h*.11)
        for i in range(2):
            zone((.79,.31+i*.16,.93,.41+i*.16),PAPER,LILAC,4)
    elif stem=="im_back":
        zone((.17,.27,.84,.64),"#e2e8d9",TEAL,7)
        zone((.37,.69,.62,.86),PAPER,TEAL,7)
        tile(img,"picture",w*.5,h*.16,h*.15)
    elif stem=="ma_back":
        for i,name in enumerate(("info","mail","list")):
            top=(.17,.32,.47)[i]
            zone((.15,top,.93,.29+i*.15 if i<2 else .89),PAPER,PEACH,6)
            tile(img,name,w*.095,h*(top+.05),h*.12)
    elif stem=="ms_back":
        zone((.08,.28,.92,.77),PAPER,BLUE,10)
        tile(img,"info",w*.16,h*.51,h*.23)
    elif stem=="mu_back":
        zone((.12,.13,.88,.32),"#d4e4cc",TEAL,12)
        for i,name in enumerate(("music","speaker")):
            tile(img,name,w*.43,h*(.52+i*.27),w*.38)
        zone((.79,.40,.86,.86),"#b9cfb2",TEAL,4)
    return img


DIALOG_BUTTONS = {
    "ab_ok":("confirm",2),"ab_www":("globe",14),"cl_no":("cancel",2),"cl_res":("reset",2),
    "cl_yes":("confirm",2),"ex_no":("cancel",2),"ex_res":("reset",2),"ex_yes":("confirm",2),
    "im_flag":("picture",4),"im_no":("cancel",2),"im_yes":("confirm",2),"ma_no":("cancel",2),
    "ma_yes":("confirm",2),"ms_no":("cancel",2),"ms_ok":("confirm",2),"ms_yes":("confirm",2),
    "mu_add":("folder",3),"mu_down":("down",2),"mu_ok":("confirm",2),"mu_st":("speaker",2),
    "mu_up":("up",2),
}


def robot(img, cx, floor, size, phase, lift=0):
    """A leaf-capped painter with hand-drawn poses and a soft ground shadow."""
    d=ImageDraw.Draw(img)
    unit=size/100
    def xy(x,y):
        return round(cx+x*unit),round(floor+y*unit-lift)
    def box(x0,y0,x1,y1):
        return (*xy(x0,y0),*xy(x1,y1))
    swing=math.sin(phase)*15
    width=max(1,round(5*unit))
    d.ellipse(box(-26,-7,26,0),fill="#a3ab87")
    for side in (-1,1):
        toe=side*16+swing*side
        d.line([xy(side*13,-32),xy(side*15,-18),xy(toe,-8)],fill=INK,width=width)
        d.ellipse(box(toe-7,-12,toe+9,-5),fill=PEACH,outline=INK,width=1)
        d.line([xy(side*21,-54),xy(side*34,-48+swing*side)],fill=INK,width=width)
        d.ellipse(box(side*34-5,-53+swing*side,side*34+5,-43+swing*side),fill=GOLD,outline=INK)
    d.rounded_rectangle(box(-22,-65,22,-31),radius=max(2,round(11*unit)),fill=TEAL,outline=INK,width=1)
    d.ellipse(box(-9,-57,9,-41),fill=CREAM)
    d.rounded_rectangle(box(-24,-90,24,-63),radius=max(2,round(10*unit)),fill=CREAM,outline=INK,width=1)
    for x in (-10,10):
        d.ellipse(box(x-3,-79,x+3,-73),fill=INK)
    d.arc(box(-6,-76,6,-67),0,180,fill=INK,width=1)
    d.ellipse(box(-7,-99,12,-87),fill=MINT,outline=INK)
    d.line([xy(32,-49-swing),xy(43,-71-swing)],fill=INK,width=max(1,round(3*unit)))
    d.ellipse(box(40,-77-swing,48,-67-swing),fill=PINK)


def robot_strip(size, count, group):
    w,h=size
    img=canvas(size,"black" if group=="dialog" else "#e2ead3")
    d=ImageDraw.Draw(img)
    for i in range(count):
        width=w/count
        left=round(i*width)
        cx=left+width/2
        phase=math.tau*i/max(1,count-1)
        if group=="dialog":
            robot(img,cx,h-3,h*.83,phase)
            continue
        d.rounded_rectangle((left+3,3,round(left+width)-4,h-4),radius=16,fill="#e2ead3",outline="#abc49f")
        progress=1 if count==1 else i/(count-1)
        if group=="out":
            progress=1-progress
        robot(img,cx+(progress-.5)*width*.22,h-16,h*.56,phase,lift=8*abs(math.sin(phase)))
        if progress>.35:
            length=42+progress*77
            d.rounded_rectangle((cx-length/2,27,cx+length/2,58),radius=10,fill=GOLD,outline="#bc864c")
            d.polygon([(cx-length/2-9,42),(cx-length/2+10,28),(cx-length/2+10,57)],fill=GOLD)
            d.line((cx-length/2+4,43,cx+length/2-11,43),fill=CREAM,width=4)
    return img


def other_render(path,size):
    group=path.parent.name
    stem=path.stem
    if group=="canvas":
        return panel(stem,size)
    if group=="dlg":
        if stem=="me_back":
            return robot_strip(size,18,"dialog")
        if stem.endswith("_back"):
            return dialog_surface(stem,size)
        name,count=DIALOG_BUTTONS[stem]
        return strip(size,count,name,shade(len(stem)+ord(stem[0])),round_button=stem!="im_flag",
                     tilt=count>=10,disabled=count-2 if count>2 else None,background="#f1e3c8")
    if stem.startswith("but"):
        i=int(stem[-1])
        return strip(size,6,("flower","star","tree")[i],shade(i),round_button=True,disabled=4,tilt=True)
    if stem=="enumpage":
        return strip(size,1,"hexagon",MINT)
    return robot_strip(size,{"tip":1,"tipin":16,"tipout":5}[stem],"out" if stem=="tipout" else "in")


PAINT_BUTTONS = {
    "dr":SHAPES,"ef":EFFECTS,"fl":tuple(f"fill{i}" for i in range(6)),
    "fr":("swirl","orb","triangle","globe"),"gi":("picture","stamp","film"),
    "kr":("sparkle","glow"),"op":OPERATIONS,"pe":tuple(f"brush{i}" for i in range(9)),
    "rg":REGIONS,"ru":("eraser0","eraser1","eraser2"),
}


def framed_icons(size, names, *, vertical=False):
    w,h=size
    img=canvas(size,"#e6ecd9")
    d=ImageDraw.Draw(img)
    for i,name in enumerate(names):
        left,top=(0,round(i*h/len(names))) if vertical else (round(i*w/len(names)),0)
        right,bottom=(w,round((i+1)*h/len(names))) if vertical else (round((i+1)*w/len(names)),h)
        card(d,(left+2,top+2,right-3,bottom-3),PAPER,SAND,6)
        tile(img,name,(left+right)/2,(top+bottom)/2,min(right-left,bottom-top)*.82,shade(i))
    return img


def tool_page_strip(size):
    w,h=size
    img=canvas(size,"#d3dfc5")
    d=ImageDraw.Draw(img)
    groups=(PRIMARY[:7],PRIMARY[7:])
    for i in range(6):
        x=round(i*w/6);right=round((i+1)*w/6);width=right-x
        card(d,(x+2,2,right-3,h-3),CREAM,SAND,10)
        mix=min(1,max(0,(i-1)/3))
        for row in range(7):
            y=(row+.5)*h/7
            if mix<1:
                tile(img,groups[0][row],x+width*(.5-mix*.28),y,h/7*.86*(1-mix*.65),shade(row),angle=i*6)
            if mix>0:
                tile(img,groups[1][row],x+width*(.79-mix*.29),y,h/7*.86*(.35+mix*.65),shade(row+2),angle=(5-i)*-6)
    return img


def fractal_swatch(stem,size):
    w,h=size
    count={"fr_kind0":4,"fr_kind1":4,"fr_kind2":3,"fr_kind3":20}[stem]
    family=int(stem[-1])
    img=canvas(size)
    d=ImageDraw.Draw(img)
    for i in range(count):
        left,right=round(i*w/count),round((i+1)*w/count)
        width=right-left
        colors=tuple(shade(i+family+j) for j in (0,2,4))
        d.rectangle((left,0,right-1,h-1),fill=PAPER)
        if family==2:
            def twig(x,y,length,angle,depth):
                x2=x+math.sin(angle)*length;y2=y-math.cos(angle)*length
                d.line((x,y,x2,y2),fill=colors[depth%3],width=max(1,depth//2))
                if depth:
                    turn=.26+i*.15
                    twig(x2,y2,length*.69,angle-turn,depth-1)
                    twig(x2,y2,length*.69,angle+turn,depth-1)
            twig(left+width*.5,h-2,h*.37,0,5)
        else:
            # Julia-set seeds and color bands define a different miniature in each tile.
            phase=family*.91+i*.61
            seed=complex(.72*math.cos(phase),.72*math.sin(phase))
            palette=(CREAM,*colors,TEAL,INK)
            for y in range(1,h-1):
                for x in range(left+1,right-1):
                    z=complex((x-left-width/2)*.069,(y-h/2)*.069)
                    for step in range(24):
                        if abs(z)>2:
                            break
                        z=z*z+seed
                    d.point((x,y),fill=palette[(step//2)%len(palette)] if step<23 else INK)
        d.rectangle((left,0,right-1,h-1),outline=SAND)
    return img


def font_attribute(number,size):
    img=strip(size,2,"text",shade(number),round_button=False)
    d=ImageDraw.Draw(img);w,h=size
    for i in range(2):
        x=round((i+.5)*w/2); left=x-h*.26; right=x+h*.26
        if number in (1,2,3):
            y=round(h*(.73 if number==1 else .52 if number==2 else .3))
            d.line((left,y,right,y),fill=TEAL,width=2)
        elif number in (4,5,6):
            y=round(h*.50); delta=(number-5)*4
            d.line((left,y+delta,right,y-delta),fill=TEAL,width=2)
        elif number in (7,8):
            d.line((left,h*.77,right,h*.77),fill=GOLD,width=2)
            if number==8:
                d.line((x,h*.23,x,h*.77),fill=TEAL,width=1)
        elif number==9:
            d.ellipse((right+1,h*.24,right+5,h*.24+4),fill=PINK)
    return img


def paint(stem,size):
    if stem=="action0":
        return tool_page_strip(size)
    if re.fullmatch(r"but\d+",stem):
        n=int(stem[3:])
        return strip(size,11,PRIMARY[n],shade(n),tilt=True,disabled=5,background="#e7ead6")
    if stem=="dr_kind":
        return framed_icons(size,tuple(f"brush{i}" for i in (0,1,2,3,4,5,6,8)))
    if stem.startswith("fr_kind"):
        return fractal_swatch(stem,size)
    if stem.startswith("fo_att"):
        return font_attribute(int(stem[-1]),size)
    if stem in ("fo_up","fo_down"):
        return strip(size,3,stem[3:],MINT,disabled=2)
    if stem=="fo_list":
        img=canvas(size,CREAM);w,h=size;d=ImageDraw.Draw(img)
        card(d,(2,2,w-3,h-3),PAPER,TEAL,8)
        d.rounded_rectangle((w-13,9,w-7,h-10),radius=3,fill="#e4e7d5")
        return img
    match=re.fullmatch(r"([a-z]+)_but(\d+)",stem)
    if match:
        group,i=match[1],int(match[2]);count=2 if group=="op" else 10
        return strip(size,count,PAINT_BUTTONS[group][i],shade(i+ord(group[0])),
                     round_button=group in ("ef","fr","op","kr"),disabled=5 if count==10 else None,tilt=count>2)
    name={"ef_ward":"wind","fl_ward":"glow","pe_kind0":"curve","pe_kind1":"line",
          "rg_kind0":"circle","rg_kind1":"copy","rg_kind2":"invert","rg_kind3":"intersect"}[stem]
    name={"wind":"speed","intersect":"glasses"}.get(name,name)
    return strip(size,2,name,GOLD,round_button=True)


def render(path,size):
    group=path.parent.name
    if group in ("desk","recent","tool"):
        return simple_render(path,size)
    if group=="paint":
        return paint(path.stem,size)
    return other_render(path,size)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output",type=Path,default=ROOT/"public/classic")
    args=parser.parse_args()
    run_render(render,{"board","canvas","desk","dlg","paint","recent","tool"},args.output)


if __name__=="__main__":
    main()
