"""Copy original UI atlases unchanged; record provenance, never overwrite originals."""
from pathlib import Path
import hashlib
import json
import shutil

root = Path(__file__).resolve().parent.parent
source = root / 'local-only/reference/res'
target = root / 'public/classic'
manifest = []
files = [source / 'desk/back.JPG']
for directory in ['paint', 'tool', 'recent', 'dlg', 'board', 'canvas']:
    files.extend(sorted((source / directory).glob('*.jpg')))
for path in files:
    destination = target / path.relative_to(source)
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, destination)
    manifest.append({'source': str(path.relative_to(root)), 'output': str(destination.relative_to(root)), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
(root / 'design/evidence/interface-assets.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(f'{len(files)} original UI atlases copied without resampling')
