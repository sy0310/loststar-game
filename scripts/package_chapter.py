#!/usr/bin/env python3
"""Build an persistent chapter self-test ZIP; never touch the formal Fusion package or saves."""
from pathlib import Path
import argparse
import hashlib
import io
import json
import re
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()


def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    if git('status', '--porcelain', '--', 'src', 'assets/runtime', 'assets/source', 'prototypes/ref-ui', 'vite.chapter.config.ts'):
        raise SystemExit('Commit runtime/sample changes before creating a review package.')
    source = git('rev-parse', 'HEAD')
    config = (ROOT / 'vite.chapter.config.ts').read_text()
    version = re.search(r"version:'([^']+)'", config).group(1)
    run('npx', 'vite', 'build', '--config', 'vite.chapter.config.ts', '--base', './')
    run('npx', 'vite', 'build', '--ssr', 'src/chapter/model.ts', '--outDir', 'releases/chapter-model')
    run('npx', 'vite', 'build', '--ssr', 'scripts/chapter_fixtures.ts', '--outDir', 'releases/chapter-fixtures')
    dist = ROOT / 'releases/chapter-dist'
    target = ROOT / f'releases/taptap/loststar-parcel-story-{source[:7]}.zip'
    target.parent.mkdir(parents=True, exist_ok=True)
    payload = io.BytesIO()
    with zipfile.ZipFile(payload, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for file in sorted(dist.rglob('*')):
            if file.is_file():
                info = zipfile.ZipInfo('loststar-parcel-story/' + file.relative_to(dist).as_posix(), (2026, 11, 7, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = 0o100644 << 16
                archive.writestr(info, file.read_bytes(), compresslevel=9)
    raw = payload.getvalue()
    if target.exists() and target.read_bytes() != raw:
        raise SystemExit('This source already has a different frozen ZIP. Refusing to overwrite it.')
    target.write_bytes(raw)
    static = ROOT / 'releases/chapter-static'
    folder = static / 'loststar-parcel-story'
    if folder.exists():
        shutil.rmtree(folder)
    with zipfile.ZipFile(target) as archive:
        archive.extractall(static)
        names = archive.namelist()
        assert all((static / name).read_bytes() == archive.read(name) for name in names)
    metadata = {'version': version, 'sourceCommit': source,
                'archive': str(target.relative_to(ROOT)), 'sha256': hashlib.sha256(raw).hexdigest(),
                'bytes': len(raw), 'files': len(names),
                'buildCommand': 'python3 scripts/package_chapter.py',
                'isolated': True, 'persistent': True, 'database': 'loststar.review.parcel-story.v1', 'formalSave': False}
    (ROOT / 'releases/chapter-package.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(json.dumps(metadata))


if __name__ == '__main__':
    main()
