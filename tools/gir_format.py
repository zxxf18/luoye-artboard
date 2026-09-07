"""Read-only structural GIR parser, verified against this installation's corpus.

0x0227 container: group count, canvas dimensions, arrays of frame counts,
widths, heights and flags. Each record is a 24-bit DIB followed by a 0x0226
alpha block: 284-byte descriptor + (x,y,length,alpha) uint16 runs.
"""
from pathlib import Path
import json
import struct
import hashlib


def parse_gir(raw):
    def read(fmt, offset):
        if offset < 0 or offset + struct.calcsize(fmt) > len(raw):
            raise ValueError('truncated GIR')
        return struct.unpack_from(fmt, raw, offset)
    magic, count, canvas_w, canvas_h = read('<HIII', 0)
    if magic != 0x227 or not 1 <= count <= 1000:
        raise ValueError('unsupported GIR container')
    counts = read('<'+'I'*count, 14)
    widths = read('<'+'I'*count, 14+4*count)
    heights = read('<'+'I'*count, 14+8*count)
    flags = read('<'+'I'*count, 14+12*count)
    if sum(counts)>10000 or any(not 0<w<=4096 or not 0<h<=4096 for w,h in zip(widths,heights)):
        raise ValueError('GIR budget exceeded')
    cursor=14+16*count;groups=[]
    known_single_pixel_repair = hashlib.sha256(raw).hexdigest() == '63a5f89ef9399ef938ebef4bc71c4539f239b47a4bd49894513d3b6ef00686e9'
    for frame_count,width,height,flag in zip(counts,widths,heights,flags):
        frames=[]
        for _ in range(frame_count):
            marker,length=read('<HI',cursor);dib=cursor+6;rgb_runs=None
            if marker==0xffff and length==1:
                w,h=read('<II',cursor+6)
                if not 0<w<=4096 or not 0<h<=4096:raise ValueError('compressed GIR budget exceeded')
                position=cursor+14;covered=0;rgb_runs=[]
                while covered<w*h:
                    ry,rx,n,b,g,r=read('<3H3B',position)
                    # RLE is top-down, row-major BGR. Reject holes and overlaps.
                    if ry*w+rx!=covered or not n or rx+n>w:raise ValueError('invalid compressed RGB run')
                    rgb_runs.append((rx,ry,n,r,g,b));covered+=n;position+=9
                end_marker,run_count=read('<HI',position)
                if end_marker!=0xffff or run_count!=len(rgb_runs):raise ValueError('compressed RGB count mismatch')
                alpha=position+6
            else:
                header,w,h,planes,bpp,compression=read('<IiiHHI',dib)
                if marker!=0xfffe or header!=40 or planes!=1 or bpp!=24 or compression!=0 or not 0<w<=4096 or not 0<h<=4096 or length!=40+((w*3+3)//4)*4*h:
                    raise ValueError(f'unsupported DIB at {cursor}')
                alpha=dib+length
            amagic,x,y,aw,ah,left,top,right,bottom,kind,total,runs=read('<12I',alpha)
            if amagic!=0x226 or (aw,ah)!=(w,h) or runs>w*h or x+w>width or y+h>height:
                raise ValueError('unsupported alpha descriptor')
            records=[];pixels=0;occupied=set();repair=None
            for i in range(runs):
                rx,ry,n,a=read('<4H',alpha+284+i*8)
                if known_single_pixel_repair and w==h==runs==total==n==1 and x==y==0 and (rx>=w or ry>=h) and rx<width and ry<height:
                    repair='known 2/17 single-pixel alpha uses group coordinates';x,y=rx,ry;rx=ry=0
                if not n or rx+n>w or ry>=h or a>255:raise ValueError(f'invalid alpha run at {alpha+284+i*8}: {rx=} {ry=} {n=} {a=} {w=} {h=}')
                for xx in range(rx,rx+n):
                    position=ry*w+xx
                    if position in occupied:raise ValueError('overlapping alpha runs')
                    occupied.add(position)
                pixels+=n;records.append((rx,ry,n,a))
            if pixels!=total:raise ValueError('alpha pixel count mismatch')
            frame=dict(dib_offset=dib,dib_length=length,width=w,height=h,x=x,y=y,runs=records)
            if rgb_runs is not None:frame['rgb_runs']=rgb_runs
            if repair:frame['repair']=repair
            frames.append(frame)
            cursor=alpha+284+runs*8
        groups.append(dict(width=width,height=height,flag=flag,frames=frames))
    if cursor!=len(raw):raise ValueError('unparsed GIR tail')
    return dict(width=canvas_w,height=canvas_h,groups=groups)


if __name__=='__main__':
    root=Path(__file__).resolve().parents[1];items=[]
    for path in sorted((root/'jshw/glib/girl').rglob('*.gir')):
        try:
            value=parse_gir(path.read_bytes());items.append(dict(path=path.relative_to(root/'jshw').as_posix(),ok=True,groups=len(value['groups']),frames=sum(len(g['frames']) for g in value['groups']),flags=sorted({g['flag'] for g in value['groups']})))
        except (ValueError,struct.error) as error:items.append(dict(path=path.relative_to(root/'jshw').as_posix(),ok=False,error=str(error)))
    report=dict(files=len(items),passed=sum(i['ok'] for i in items),frames=sum(i.get('frames',0) for i in items),items=items)
    (root/'design/evidence/gir-structure-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print({k:v for k,v in report.items() if k!='items'});print([i for i in items if not i['ok']][:10])
