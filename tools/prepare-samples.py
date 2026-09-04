"""Decode a small representative set. No upscaling or changes to legacy files.

Color+mask conversion reconstructs the source asset; generated HD variants are
kept separately. Run using Python with Pillow from the repository root.
"""
from pathlib import Path
import hashlib
import io
import json
import re
import struct
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
LEGACY = ROOT / 'jshw'
OUT = ROOT / 'public/assets'
OUT.mkdir(parents=True, exist_ok=True)
index = {p.relative_to(LEGACY).as_posix().lower(): p for p in LEGACY.rglob('*') if p.is_file()}
assets = []


def load(path):
    return Image.open(index[path.lower()])


def add(asset_id, name, category, source, mask=None, frames=None):
    sources = [source] + ([mask] if mask else [])
    im = load(source).convert('RGBA')
    if mask:
        alpha = load(mask).convert('L')
        if im.size != alpha.size:
            raise ValueError('Mask mismatch: ' + source)
        im.putalpha(alpha)
    target = OUT / f'{asset_id}.png'
    im.save(target)
    entry = dict(id=asset_id, name=name, category=category, src=f'assets/{target.name}',
                 width=im.width, height=im.height, quality='original-decoded',
                 sources=[dict(path=p, sha256=hashlib.sha256(index[p.lower()].read_bytes()).hexdigest()) for p in sources])
    if frames:
        entry['frames'] = frames
        entry['frameDuration'] = 160
        entry['timingStatus'] = 'preview timing; legacy timing unverified'
    thumb = im.copy(); thumb.thumbnail((180, 132)); thumb.save(OUT / f'{asset_id}-thumb.png')
    entry['thumbnail'] = f'assets/{asset_id}-thumb.png'
    assets.append(entry)


for category, label in [('color0', '涂色森林'), ('color1', '漫画世界'), ('color2', '水彩风景'), ('color3', '油彩风景'), ('color4', '缤纷风景')]:
    for n in range(2):
        stem = f'glib/lib/{category}/{n:03}'
        source = next(p for p in index if p in [stem+'.bmp', stem+'.jpg'])
        add(f'{category}-{n}', f'{label} {n+1}', 'background', source)

for category, label in [('role0', '陆地伙伴'), ('role1', '海洋伙伴'), ('role2', '飞行伙伴'), ('role3', '花草朋友'), ('role4', '人物朋友'), ('role5', '生活小物'), ('role6', '奇妙世界')]:
    for n in range(2):
        stem = f'glib/lib/{category}/{n:03}'
        add(f'{category}-{n}', f'{label} {n+1}', 'sticker', stem+'.jpg', stem+'a.bmp')

for n in range(2):
    add(f'frame-{n}', f'相框 {n+1}', 'frame', f'glib/frame/w{n}.jpg', f'glib/frame/w{n}a.bmp')
    add(f'paper-{n}', f'纸样 {n+1}', 'paper', f'glib/paper/w{n}.bmp')
    add(f'texture-{n}', f'纸纹 {n+1}', 'texture', f'glib/tex/draw/tex{n}.bmp')

for n in range(2):
    paths = sorted(p for p in index if re.fullmatch(rf'glib/lib/anim0/{n:03}\$\d+\.jpg', p))
    frame_paths = []
    for i, path in enumerate(paths):
        mask = path[:-4]+'a.bmp'
        im = load(path).convert('RGBA'); im.putalpha(load(mask).convert('L'))
        target = OUT / f'animation-{n}-{i}.png'; im.save(target)
        frame_paths.append(f'assets/{target.name}')
    add(f'animation-{n}', f'会动的伙伴 {n+1}', 'animation', paths[0], paths[0][:-4]+'a.bmp', frame_paths)
    assets[-1]['sources'] = [dict(path=p, sha256=hashlib.sha256(index[p].read_bytes()).hexdigest())
                            for frame in paths for p in [frame, frame[:-4]+'a.bmp']]

# Only extract structurally validated RGB DIBs; GIR alpha/sequence semantics remain unverified.
probes = json.loads((ROOT / 'design/evidence/private-format-probes.json').read_text())
for kind in range(3):
    for n in range(2):
        source = f'glib/girl/{kind}/{n:02}.gir'
        candidate = probes[source]['dib_candidates'][0]
        raw = index[source].read_bytes()
        dib = raw[candidate['offset']:candidate['offset']+candidate['byte_length']]
        with Image.open(io.BytesIO(dib)) as im:
            im.load(); target = OUT / f'girl-{kind}-{n}.png'; im.save(target)
            assets.append(dict(id=f'girl-{kind}-{n}', name=f'仙女袋 {kind+1}·{n+1}', category='fairy',
                               src=f'assets/{target.name}', thumbnail=f'assets/{target.name}', width=im.width, height=im.height,
                               quality='embedded-rgb-only', note='首张 RGB 提取样本；透明度、动态语义待解析',
                               sources=[dict(path=source, sha256=hashlib.sha256(raw).hexdigest())]))

(OUT / 'catalog.json').write_text(json.dumps(assets, ensure_ascii=False, indent=2)+'\n')
# JS wrapper also works in a sandboxed file:// macOS WebView without a local server.
(OUT / 'catalog.js').write_text('window.JSHW_ASSETS = '+json.dumps(assets, ensure_ascii=False)+';\n')
print(f'Prepared {len(assets)} sample entries in {OUT}; no HD claim and no original changed.')
