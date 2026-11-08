"""Build a served/development-package entry; this does not deploy or publish."""
from __future__ import annotations
import base64
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'dist'
ENTRY = OUT / 'loststar-salvage' / 'index.html'
ASSET_NAMES = ('port', 'wreck', 'harbor')


def main() -> None:
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    art: dict[str, str] = {}
    sources = []
    for name in ASSET_NAMES:
        path = ROOT / 'assets' / (name + '.webp')
        if path.is_file():
            data = path.read_bytes()
            if data[:4] != b'RIFF' or data[8:12] != b'WEBP':
                raise ValueError(f'Not a real WebP: {path}')
            art[name] = 'data:image/webp;base64,' + base64.b64encode(data).decode('ascii')
            sources.append({'path': str(path.relative_to(ROOT)), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    css = (ROOT / 'src/style.css').read_text(encoding='utf-8')
    html = html.replace('<link rel="stylesheet" href="./src/style.css">', '<style>' + css + '</style>')
    html = html.replace('const ART={};', 'const ART=' + json.dumps(art, ensure_ascii=True) + ';')
    for name in ('engine', 'app'):
        script = (ROOT / f'src/{name}.js').read_text(encoding='utf-8')
        html = html.replace(f'<script src="./src/{name}.js"></script>', '<script>' + script.replace('</script', '<\\/script') + '</script>')
    ENTRY.parent.mkdir(parents=True, exist_ok=True)
    ENTRY.write_text(html, encoding='utf-8')
    archive = OUT / 'loststar-salvage-demo.zip'
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as z:
        info = zipfile.ZipInfo('loststar-salvage/index.html', date_time=(2026, 11, 8, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, ENTRY.read_bytes())
    try:
        sha = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
        dirty = bool(subprocess.check_output(['git', 'status', '--porcelain', '--', 'src', 'index.html', 'build.py', 'assets'], cwd=ROOT, text=True).strip())
    except (OSError, subprocess.CalledProcessError):
        sha, dirty = 'unversioned', True
    data = archive.read_bytes()
    record = {'kind': 'build_only_not_playtest_or_upload', 'sourceCommit': sha, 'dirtySource': dirty,
              'entry': 'loststar-salvage/index.html', 'archive': archive.name, 'bytes': len(data),
              'sha256': hashlib.sha256(data).hexdigest(), 'assets': sources,
              'missingOptionalArt': [name for name in ASSET_NAMES if name not in art],
              'storageKey': 'lostcargo.route-demo.v1', 'taptapUploaded': False,
              'physicalPhoneTested': False, 'readyForUserAcceptance': False}
    (OUT / 'build-info.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(record, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
