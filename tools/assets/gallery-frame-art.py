"""Original transparent border drawings for the numbered gallery frames."""

import math
import random

from PIL import Image, ImageColor, ImageDraw

# Existing frame IDs and visual themes. All drawings keep the center open.
# Each row gives the subject, edge treatment and colors for its existing slot.
# Colors are the darkest edge, ornament, highlight and foliage/accent.
FRAME_DESIGNS = [
    ("star", "wood", "#70452f", "#efc56e", "#f9dfa0", "#bc8252"),
    ("lemon", "tile", "#408873", "#f7ce56", "#fff0a4", "#6eb194"),
    ("moon", "cloud", "#7989bc", "#f6ce72", "#eee8ff", "#a0badb"),
    ("fern", "wood", "#445e3b", "#a7b876", "#e2dfa9", "#698750"),
    ("river", "wave", "#246c8d", "#71b8c6", "#d0edf0", "#9bc79c"),
    ("filigree", "gilt", "#a07949", "#d5ac66", "#f7e2aa", "#9b9969"),
    ("lavender", "vine", "#55644d", "#a58bc5", "#e4c8ed", "#84995f"),
    ("bubble", "wave", "#428b99", "#a2d6cf", "#ddf7ee", "#80b4c2"),
    ("filigree", "wave", "#7f498d", "#c57fc6", "#f8d6f0", "#9d70b3"),
    ("lemon", "tile", "#294c96", "#f6ce5f", "#fff0a5", "#81a573"),
    ("daisy", "wood", "#815738", "#dc976f", "#fbe5bf", "#aa925d"),
    ("daisy", "quilt", "#98814d", "#e9b951", "#f8efd8", "#9ca674"),
    ("blossom", "stripe", "#9b473b", "#e47759", "#ffd2a4", "#73966f"),
    ("river", "wave", "#487b7e", "#90c4ca", "#d5e7d9", "#8baa76"),
    ("sunflower", "vine", "#88612d", "#f1b734", "#fce187", "#819857"),
    ("blossom", "wave", "#59728a", "#c18fb8", "#eed6ed", "#8cb7a8"),
    ("fern", "tile", "#365682", "#e5d9a4", "#fbf3d6", "#85a9a5"),
    ("lamb", "quilt", "#777f92", "#ded1be", "#fbf0dc", "#9fae8d"),
    ("violet", "quilt", "#624e89", "#ac92c1", "#f2d37a", "#87a279"),
    ("fern", "vine", "#65845d", "#a8be88", "#f6edc3", "#9bb985"),
    ("meadow", "vine", "#515f7d", "#a6afd4", "#ffe4a5", "#84a46d"),
    ("daisy", "quilt", "#ad6782", "#e898b1", "#ffece2", "#8cac8b"),
    ("violet", "tile", "#405982", "#b09bd5", "#f6cc6d", "#89a47f"),
    ("fern", "tile", "#516f9e", "#a4bb5d", "#f0e6a9", "#829852"),
    ("winter", "cloud", "#6e9fbd", "#abd5e6", "#f7fcf6", "#7fa8a5"),
    ("linen", "quilt", "#9e825e", "#d9c39b", "#fff1d4", "#9ca482"),
    ("blossom", "quilt", "#8eaa91", "#e9b6b1", "#f8ecd9", "#b4c597"),
    ("candy", "stripe", "#ae5449", "#e38473", "#fff0d8", "#72966f"),
    ("meadow", "vine", "#658276", "#eac178", "#f4eed0", "#84a77c"),
    ("filigree", "gilt", "#5e46a1", "#b498df", "#e8dcff", "#8a77b7"),
    ("river", "tile", "#4e8973", "#9ac4a2", "#f5d575", "#759a6d"),
    ("fern", "gilt", "#853c36", "#ca8561", "#f5d59a", "#887a4a"),
    ("moon", "wave", "#344967", "#edbb63", "#c9dce9", "#b193b5"),
    ("sunflower", "wood", "#797340", "#e9b539", "#ffdf80", "#81975d"),
    ("lavender", "quilt", "#947fa7", "#d0b4d7", "#faf0d5", "#a5b77f"),
    ("violet", "vine", "#615873", "#aa8db8", "#e6d1e9", "#91a57a"),
    ("daisy", "tile", "#426e9d", "#e9bd46", "#fff3a7", "#8da459"),
    ("filigree", "gilt", "#b18c54", "#dbb678", "#fff3d1", "#abae83"),
    ("meadow", "tile", "#3d7192", "#97b679", "#f8dc79", "#719c67"),
    ("meadow", "vine", "#82916a", "#d59ab0", "#f4cf86", "#8aa771"),
    ("fern", "wood", "#586853", "#a3ad7c", "#eee2b4", "#87986b"),
]
THEMES = {f"frame-{index}": design for index, design in enumerate(FRAME_DESIGNS)}


def draw_motif(kind, colors, seed):
    rim, main, light, leaf = colors
    rng = random.Random(seed)
    icon = Image.new("RGBA", (160, 160))
    draw = ImageDraw.Draw(icon)

    def ellipse(box, fill, outline=None, width=2):
        draw.ellipse(box, fill=fill, outline=outline, width=width)

    def line(points, color, width):
        draw.line(points, fill=color, width=width, joint="curve")

    if kind=="star":
        for x,y,r in ((68,88,46),(117,43,23),(122,111,15)):
            points=[(x+math.cos(i*math.pi/5-math.pi/2)*r*(.48 if i%2 else 1),
                     y+math.sin(i*math.pi/5-math.pi/2)*r*(.48 if i%2 else 1)) for i in range(10)]
            draw.polygon(points,fill=main,outline=rim,width=2)
            draw.line((points[8],points[9],points[0]),fill=light,width=4)
    elif kind=="lemon":
        draw.polygon([(30,79),(45,59),(67,53),(89,33),(120,42),(96,62),(71,72)],fill=leaf)
        ellipse((20,62,108,131),main,rim)
        draw.arc((26,68,102,127),193,298,fill=light,width=5)
        ellipse((69,56,145,132),main,rim)
        ellipse((76,63,138,125),light)
        for i in range(8):
            angle=45*i
            draw.pieslice((81,68,133,120),angle+4,angle+41,fill=main)
        ellipse((104,91,110,97),light)
    elif kind=="fern":
        for offset,angle,scale in ((0,-.08,1),(21,.52,.78),(-9,-.52,.69)):
            x,y=74+offset,137
            dx,dy=math.sin(angle),-math.cos(angle)
            end=(x+dx*114*scale,y+dy*114*scale)
            line([(x,y),end],rim,3)
            for i in range(1,8):
                step=i*13*scale
                px,py=x+dx*step,y+dy*step
                for side in (-1,1):
                    spread=(37-i*3)*scale*side
                    leaf_length=(22-i)*scale
                    tip=(px-dy*spread+dx*leaf_length,py+dx*spread+dy*leaf_length)
                    mid=((px+tip[0])/2+dx*6,(py+tip[1])/2+dy*6)
                    draw.polygon([(px,py),mid,tip,(mid[0]-dx*8,mid[1]-dy*8)],fill=main if i%2 else leaf)
                    line([(px,py),tip],light,1)
    elif kind in {"moon", "winter"}:
        if kind == "moon":
            ellipse((28, 28, 130, 130), main, rim)
            draw.ellipse((58, 8, 145, 100), fill=(0, 0, 0, 0))
            ellipse((44, 88, 59, 101), light)
            ellipse((61, 110, 71, 119), light)
            stars = ((115, 39, 18), (126, 88, 10), (31, 42, 9))
            for x, y, r in stars:
                draw.polygon([(x, y-r), (x+4, y-4), (x+r, y), (x+4, y+4),
                              (x, y+r), (x-4, y+4), (x-r, y), (x-4, y-4)], fill=light)
        else:
            for i in range(6):
                angle = math.pi * i / 3
                endpoint = (80+math.cos(angle)*55, 80+math.sin(angle)*55)
                line([(80,80),endpoint], light, 7)
                for turn in (-.55,.55):
                    px, py = 80+math.cos(angle)*36, 80+math.sin(angle)*36
                    line([(px,py),(px+math.cos(angle+turn)*20,py+math.sin(angle+turn)*20)], main, 5)
            ellipse((73,73,87,87), main)
    elif kind in {"bubble","river"}:
        if kind=="bubble":
            for x,y,r in ((77,84,37),(117,41,17),(38,113,15)):
                ellipse((x-r,y-r,x+r,y+r),main,rim)
                draw.arc((x-r+6,y-r+7,x+r-6,y+r-6),195,265,fill=light,width=4)
                ellipse((x-r*.41,y-r*.47,x-r*.12,y-r*.19),light)
        else:
            for i in range(3):
                yy=55+i*20
                pts=[(18+j*2,yy+math.sin(j*.16+i)*8) for j in range(62)]
                line(pts, main if i!=1 else light, 9)
            for x,y in ((45,53),(62,43),(92,62),(117,43)):
                ellipse((x-8,y-20,x+8,y+9),leaf,rim)
    elif kind=="lamb":
        for x,y,r in ((52,55,25),(79,47,29),(107,58,24),(48,79,22),(109,80,24),(77,90,33)):
            ellipse((x-r,y-r,x+r,y+r),light,rim)
        ellipse((30,72,61,101),main,rim)
        ellipse((96,72,127,101),main,rim)
        ellipse((51,61,109,125),main,rim)
        for x in (69,91):
            ellipse((x-3,84,x+3,91),rim)
        draw.arc((73,92,87,106),0,180,fill=rim,width=3)
    elif kind=="candy":
        ellipse((26,26,134,134),light,rim)
        for i in range(7):
            start=i*360/7
            draw.pieslice((30,30,130,130),start,start+15,fill=main)
        ellipse((68,68,92,92),light)
        draw.arc((38,38,122,122),196,256,fill="#fff8e6",width=4)
    elif kind=="linen":
        for y in (52,74,96,118):
            line([(29,y),(130,y-20)],main,10)
            line([(30,y+3),(130,y-17)],light,3)
        for x in (52,74,96,118):
            line([(x,29),(x-20,130)],main,7)
    elif kind=="filigree":
        for i in range(3):
            inset=i*12
            draw.arc((26+inset,26+inset,134-inset,134-inset),195,533,fill=main if i!=1 else light,width=5)
        ellipse((74,74,86,86),main,rim)
    else:
        line([(27,126),(63,96),(80,62)],leaf,5)
        line([(50,106),(103,105),(126,78)],leaf,4)
        for x,y in ((46,107),(62,94),(95,107),(112,100)):
            ellipse((x-12,y-5,x+14,y+5),leaf)
        centers = ((64,67,24),(100,85,21),(111,54,15)) if kind in {"lavender","meadow"} else ((79,70,33),)
        for x,y,r in centers:
            count=5 if kind in {"violet","blossom","lavender"} else 13 if kind=="sunflower" else 8
            for i in range(count):
                angle=math.tau*i/count
                distance=r*.64
                cx=x+math.cos(angle)*distance
                cy=y+math.sin(angle)*distance
                radius=r*rng.uniform(.31,.42)
                ellipse((cx-radius,cy-radius,cx+radius,cy+radius),main)
                ellipse((cx-radius*.7,cy-radius*.8,cx+radius*.25,cy+radius*.22),light)
            ellipse((x-r*.24,y-r*.24,x+r*.24,y+r*.24),rim)
            for i in range(4):
                xx=x+rng.uniform(-r*.12,r*.12); yy=y+rng.uniform(-r*.12,r*.12)
                ellipse((xx-1,yy-1,xx+2,yy+2),light)
    return icon



def mix(first, second, weight):
    a,b=ImageColor.getrgb(first),ImageColor.getrgb(second)
    return tuple(round(x+(y-x)*weight) for x,y in zip(a,b))


def rim_path(w,h,inset,radius,amplitude=0,frequency=12):
    """A rounded contour with an optional gentle, continuous scallop."""
    path=[]
    for cx,cy,start in ((w-inset-radius,inset+radius,-90),
                        (w-inset-radius,h-inset-radius,0),
                        (inset+radius,h-inset-radius,90),
                        (inset+radius,inset+radius,180)):
        for degree in range(start,start+91,3):
            angle=math.radians(degree)
            path.append((cx+radius*math.cos(angle),cy+radius*math.sin(angle)))
    if not amplitude:
        return path
    undulating=[]
    for (x,y),(ex,ey) in zip(path,path[1:]+path[:1]):
        length=math.hypot(ex-x,ey-y)
        count=max(1,round(length/5))
        for i in range(count):
            t=i/count
            px,py=x+(ex-x)*t,y+(ey-y)*t
            phase=math.atan2((py-h/2)/h,(px-w/2)/w)
            wave=math.sin(phase*frequency)*amplitude
            undulating.append((px+math.cos(phase)*wave,py+math.sin(phase)*wave))
    return undulating


def draw_frame(asset_id, size):
    kind,style,*colors=THEMES[asset_id]
    rim,main,light,leaf=colors
    w,h=1672,941
    seed=int(asset_id.split("-")[-1])+1729
    rng=random.Random(seed)
    image=Image.new("RGBA",(w,h))
    band=Image.new("RGBA",image.size)
    draw=ImageDraw.Draw(band)
    edge,width,radius,wave={
        "wood":(25,63,34,0),"tile":(22,62,65,0),"gilt":(26,35,66,0),
        "quilt":(25,62,67,3),"vine":(29,25,73,7),"wave":(27,59,87,15),
        "cloud":(29,52,112,17),"stripe":(23,47,58,2),
    }[style]
    outside=rim_path(w,h,edge,radius,wave)
    inside=rim_path(w,h,edge+width,max(18,radius-width//2),wave*.68)
    draw.polygon(outside,fill=rim)
    draw.polygon(inside,fill=(0,0,0,0))
    alpha=band.getchannel("A")
    for offset,color,line_width in (
        (5,mix(rim,main,.48),5),(12,mix(rim,main,.79),6),
        (width//2,mix(rim,main,.58),max(6,width-24)),
        (width-6,mix(rim,light,.76),4),(width-2,mix(rim,light,.37),2)
    ):
        path=rim_path(w,h,edge+offset,max(18,radius-offset//2),wave*(1-offset/(width*3)))
        draw.line(path+path[:1],fill=color,width=line_width,joint="curve")

    if style in {"tile","quilt","stripe"}:
        half=edge+width/2
        unit={"tile":54,"quilt":83,"stripe":36}[style]
        for horizontal,length,other in ((True,w,h),(False,h,w)):
            for index,pos in enumerate(range(edge,length-edge,unit)):
                for depth in (half,other-half):
                    x,y=(pos,depth) if horizontal else (depth,pos)
                    if style=="stripe":
                        points=[(x-17,y-40),(x-2,y-40),(x+25,y+40),(x+10,y+40)]
                        if not horizontal:
                            points=[(x+(py-y),y+(px-x)) for px,py in points]
                        draw.polygon(points,fill=mix(rim,light,.82))
                    elif style=="quilt":
                        fill=mix(rim,(light,main,leaf)[index%3],.72)
                        box=(x-39,y-20,x+39,y+20) if horizontal else (x-20,y-39,x+20,y+39)
                        draw.rounded_rectangle(box,6,fill=fill,outline=mix(rim,light,.48),width=2)
                        for step in (-27,-9,9,27):
                            px,py=(x+step,y-13) if horizontal else (x-13,y+step)
                            draw.line((px,py,px+5,py+3),fill=light,width=2)
                    else:
                        fill=mix(rim,main,.76) if index%2 else mix(rim,leaf,.62)
                        draw.polygon([(x,y-19),(x+21,y),(x,y+19),(x-21,y)],fill=fill,outline=light,width=2)
                        draw.ellipse((x-4,y-4,x+4,y+4),fill=light)
    elif style=="wood":
        for _ in range(225):
            x,y=rng.randrange(w),rng.randrange(h)
            span=rng.randint(14,105)
            if edge+width<y<h-edge-width:
                coords=[(x+math.sin(i*.25)*3,y+i) for i in range(span)]
            else:
                coords=[(x+i,y+math.sin(i*.15)*2) for i in range(span)]
            draw.line(coords,fill=mix(rim,main,rng.uniform(.35,.75)),width=rng.choice((1,2,3)))
    elif style in {"cloud","wave","vine"}:
        # Individual curls or leaves break up the uninterrupted edge without
        # repeating the large illustrations around the whole opening.
        for horizontal,length,other in ((True,w,h),(False,h,w)):
            for pos in range(132,length-100,82):
                for depth in (edge+width*.62,other-edge-width*.62):
                    x,y=(pos,depth) if horizontal else (depth,pos)
                    if style=="vine":
                        draw.ellipse((x-14,y-5,x+14,y+5),fill=leaf)
                        draw.line((x-10,y+1,x+10,y-1),fill=light,width=2)
                    else:
                        draw.arc((x-23,y-12,x+23,y+12),205,350,fill=mix(rim,light,.88),width=3)
    else:
        for horizontal,length,other in ((True,w,h),(False,h,w)):
            for pos in range(102,length-85,46):
                for depth in (edge+width/2,other-edge-width/2):
                    x,y=(pos,depth) if horizontal else (depth,pos)
                    draw.ellipse((x-4,y-4,x+4,y+4),fill=light)
    # Fine flecks belong to the colored edge, even on the lightest palettes.
    for _ in range(3400):
        x,y=rng.randrange(w),rng.randrange(h)
        if alpha.getpixel((x,y)):
            draw.line((x,y,x+rng.randint(0,4),y),fill=mix(rim,light,rng.uniform(.3,.73)),width=1)
    band.putalpha(alpha)
    image.alpha_composite(band)

    corners=[(90,91),(w-90,91),(w-90,h-91),(90,h-91)]
    sizes=(188,128,196,139) if seed%2 else (138,196,126,190)
    if style=="gilt":
        sizes=(130,116,138,114)
    for i,((x,y),length) in enumerate(zip(corners,sizes)):
        if kind in {"daisy","violet","blossom","lavender","meadow","sunflower","lemon","fern"}:
            cluster=draw_motif("fern", (rim,leaf,light,mix(rim,leaf,.3)),seed+i)
            cluster=cluster.rotate(i*-87+22,resample=Image.Resampling.BICUBIC,expand=True)
            place(image,cluster,x+(18 if x<w/2 else -18),y,length+24)
        sprite=draw_motif(kind,colors,seed+i)
        sprite=sprite.rotate((i*33+seed)%35-17,resample=Image.Resampling.BICUBIC,expand=True)
        place(image,sprite,x,y,length)
        accent_kind={"moon":"star","lamb":"daisy","river":"bubble","lemon":"lemon"}.get(kind,kind)
        side=1 if x<w/2 else -1
        for j in range(1,3):
            accent=draw_motif(accent_kind,colors,seed+i+j+4)
            place(image,accent,x+side*(76+j*52),edge+width*.48 if y<h/2 else h-edge-width*.48,48-j*8)
    if style in {"vine","cloud","wave"}:
        for i,x in enumerate((w*.32,w*.62)):
            accent=draw_motif(kind,colors,seed+i+16)
            place(image,accent,x,edge+width/2 if i==0 else h-edge-width/2,52)
    return image if image.size==size else image.resize(size,Image.Resampling.LANCZOS)


def place(image, sprite, x, y, length):
    bounds=sprite.getchannel("A").getbbox()
    if bounds is None:
        return
    sprite=sprite.crop(bounds)
    sprite.thumbnail((length,length),Image.Resampling.LANCZOS)
    image.alpha_composite(sprite,(round(x-sprite.width/2),round(y-sprite.height/2)))
