"""Index extracted legacy CHM text as evidence; never execute legacy HTML."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib
import json

ROOT = Path(__file__).resolve().parents[1]


class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.hidden += 1
        if tag in ('p', 'br', 'li', 'tr', 'h1', 'h2', 'h3'):
            self.parts.append('\n')

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.hidden = max(0, self.hidden - 1)

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


pages = []
source = ROOT / 'build/legacy-help'
for p in sorted(source.rglob('*')):
    if p.suffix.lower() not in ('.htm', '.html'):
        continue
    raw = p.read_bytes()
    parser = Text()
    parser.feed(raw.decode('gb18030', errors='replace'))
    content = '\n'.join(line.strip() for line in ''.join(parser.parts).splitlines() if line.strip())
    pages.append(dict(path=p.relative_to(source).as_posix(), sha256=hashlib.sha256(raw).hexdigest(), text=content))
out = ROOT / 'design/evidence/help-pages.json'
out.write_text(json.dumps(pages, ensure_ascii=False, indent=2) + '\n')
print(f'{len(pages)} help pages indexed in {out}')
for page in pages:
    print(page['path'], page['text'][:100].replace('\n', ' / '))
