"""Original transparent border drawings for the damaged gallery frames."""

import math
import random

from PIL import Image, ImageDraw

# Existing frame IDs and visual themes. All drawings keep the center open.
THEMES = {
    "frame-2": ("moon", "#7f87b4", "#f1d78b", "#cbc4ea", "#a6bfdf"),
    "frame-5": ("filigree", "#c7a774", "#f3e4b8", "#f9eacb", "#b1b28c"),
    "frame-6": ("lavender", "#a0a687", "#b39ac8", "#e1c8e1", "#7b9875"),
    "frame-7": ("bubble", "#7eb9b8", "#b9ded8", "#d9eee5", "#a6cedb"),
    "frame-11": ("daisy", "#b6ae76", "#efd077", "#f5ecd3", "#8da77b"),
    "frame-12": ("blossom", "#b47765", "#de796b", "#f4aa87", "#77917c"),
    "frame-13": ("river", "#76a9af", "#98c5cf", "#d5e4d5", "#83a37f"),
    "frame-17": ("lamb", "#a2a9a2", "#ece4d6", "#faf0dd", "#91ac8c"),
    "frame-18": ("violet", "#8c7bab", "#c4acd6", "#f1d97c", "#87a785"),
    "frame-21": ("daisy", "#bc8297", "#efa7bb", "#fff0dd", "#92aa85"),
    "frame-22": ("violet", "#416c87", "#b29bd5", "#efca69", "#8da477"),
    "frame-24": ("winter", "#85abc9", "#bfdbe5", "#f4eee0", "#7da19c"),
    "frame-25": ("linen", "#bfa882", "#e6d7b7", "#fff2d8", "#9ca482"),
    "frame-27": ("candy", "#b87258", "#df826b", "#faebcf", "#819f75"),
    "frame-28": ("meadow", "#85a195", "#eac179", "#e1e4c6", "#779978"),
    "frame-30": ("river", "#66968d", "#91c5ae", "#f0cc76", "#718b70"),
    "frame-32": ("moon", "#435a80", "#eebd64", "#b9ccde", "#bb97b1"),
    "frame-37": ("filigree", "#c5a975", "#ead7a3", "#fff4d6", "#a7ab86"),
    "frame-39": ("meadow", "#a1af87", "#d9a2b4", "#f0cc80", "#7e9e81"),
}


def draw_motif(kind, colors, seed):
    rim, main, light, leaf = colors
    rng = random.Random(seed)
    icon = Image.new("RGBA", (160, 160))
    draw = ImageDraw.Draw(icon)

    def ellipse(box, fill, outline=None, width=2):
        draw.ellipse(box, fill=fill, outline=outline, width=width)

    def line(points, color, width):
        draw.line(points, fill=color, width=width, joint="curve")

    if kind in {"moon", "winter"}:
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
            count=5 if kind in {"violet","blossom","lavender"} else 8
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


def draw_frame(asset_id, size):
    kind,*colors=THEMES[asset_id]
    rim,main,light,leaf=colors
    width,height=size
    seed=sum(ord(c) for c in asset_id)
    rng=random.Random(seed)
    image=Image.new("RGBA",size)
    draw=ImageDraw.Draw(image)
    edge=23
    thickness={"filigree":25,"linen":28,"meadow":34,"lavender":35}.get(kind,58)
    box=(edge,edge,width-edge-1,height-edge-1)
    draw.rounded_rectangle(box,radius=64,outline=rim,width=thickness)
    for offset,color,line_width in ((4,main,3),(thickness-7,light,3)):
        draw.rounded_rectangle((edge+offset,edge+offset,width-edge-offset-1,height-edge-offset-1),
                               radius=64-offset,outline=color,width=line_width)
    # A few small brush marks soften the ribbon while preserving a solid border.
    for i in range(76):
        x=rng.randint(edge+58,width-edge-58)
        for y in (edge+thickness//2,height-edge-thickness//2):
            draw.line((x,y+rng.randint(-4,4),x+rng.randint(2,7),y),fill=main,width=1)
    positions=[(91,91,112),(width-91,91,112),(91,height-91,112),(width-91,height-91,112)]
    for i in range(1,13):
        x=round(width*i/13)
        positions.extend(((x,edge+thickness/2,thickness+6),(x,height-edge-thickness/2,thickness+6)))
    for i in range(1,7):
        y=round(height*i/7)
        positions.extend(((edge+thickness/2,y,thickness+6),(width-edge-thickness/2,y,thickness+6)))
    for i,(x,y,length) in enumerate(positions):
        variant=colors if i%4<2 or kind in {"linen","lamb","candy"} else (rim,light,main,leaf)
        motif=draw_motif(kind,variant,seed+i)
        motif=motif.rotate((i*21)%65-32,resample=Image.Resampling.BICUBIC)
        motif=motif.crop(motif.getchannel("A").getbbox())
        motif.thumbnail((length,length),Image.Resampling.LANCZOS)
        image.alpha_composite(motif,(round(x-motif.width/2),round(y-motif.height/2)))
    return image
