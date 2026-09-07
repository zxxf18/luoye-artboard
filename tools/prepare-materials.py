from pathlib import Path
from PIL import Image
import hashlib
import json

root = Path(__file__).resolve().parent.parent
manifest = []
for index in range(2):
    source = next(p for p in (root / 'local-only/reference/glib/tex/draw').iterdir() if p.stem.lower() == f'tex{index}')
    target = root / f'public/assets/grain-{index}.png'
    image = Image.open(source).convert('RGB')
    image.save(target)
    manifest.append({'source': str(source.relative_to(root)), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'size': list(image.size), 'output': str(target.relative_to(root)), 'operation': 'decode-only'})
(root / 'design/evidence/material-samples.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print('2 original paper grain samples decoded without resampling')
