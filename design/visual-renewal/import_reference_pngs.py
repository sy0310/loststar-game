#!/usr/bin/env python3
"""Import the three approved PNGs without changing bytes; Python standard library only.

Run this copy inside the repository. --source accepts the handoff ZIP or a folder.
No network, git, overwrite of different files, or player-save access is performed.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import struct
import sys
import zipfile

HERE = Path(__file__).resolve().parent
SIGNATURE = b'\x89PNG\r\n\x1a\n'
MAX_BYTES = 12 * 1024 * 1024


def verify(data: bytes, item: dict) -> None:
    if len(data) != item['bytes'] or len(data) > MAX_BYTES:
        raise ValueError(f"Wrong file size: {item['file']}")
    if data[:8] != SIGNATURE or data[12:16] != b'IHDR':
        raise ValueError(f"Not an original PNG: {item['file']}")
    if struct.unpack('>II', data[16:24]) != (item['width'], item['height']):
        raise ValueError(f"Wrong dimensions: {item['file']}")
    if hashlib.sha256(data).hexdigest() != item['sha256']:
        raise ValueError(f"SHA256 mismatch: {item['file']}")


def read_source(source: Path, item: dict) -> bytes:
    names = {item['file'], item['original_name']}
    if source.is_file() and zipfile.is_zipfile(source):
        with zipfile.ZipFile(source) as archive:
            candidates = [i for i in archive.infolist()
                          if not i.is_dir() and PurePosixPath(i.filename).name in names]
            if not candidates:
                raise FileNotFoundError(f"PNG missing from ZIP: {item['file']}")
            # Read selected bytes directly; do not extract arbitrary ZIP paths.
            results = []
            for info in candidates:
                if info.file_size > MAX_BYTES:
                    raise ValueError('Oversized ZIP entry')
                data = archive.read(info)
                verify(data, item)
                results.append(data)
            if any(data != results[0] for data in results):
                raise ValueError('Ambiguous PNG candidates')
            return results[0]
    if not source.is_dir():
        raise FileNotFoundError(f"Source is not a ZIP or folder: {source}")
    candidates = sorted(p for p in source.rglob('*.png') if p.name in names and p.is_file())
    if not candidates:
        raise FileNotFoundError(f"PNG missing from folder: {item['file']}")
    results = []
    for path in candidates:
        if path.stat().st_size > MAX_BYTES:
            raise ValueError('Oversized input file')
        data = path.read_bytes()
        verify(data, item)
        results.append(data)
    if any(data != results[0] for data in results):
        raise ValueError('Ambiguous PNG candidates')
    return results[0]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, help='Handoff ZIP or folder; omit for verification only')
    args = parser.parse_args()
    manifest = json.loads((HERE / 'ASSET_MANIFEST.json').read_text(encoding='utf-8'))
    destination = HERE / 'approved'
    pending = []
    # Validate every input and every existing target before writing anything.
    for item in manifest['files']:
        target = destination / item['file']
        data = read_source(args.source.expanduser().resolve(), item) if args.source else target.read_bytes()
        verify(data, item)
        if target.exists() and target.read_bytes() != data:
            raise FileExistsError(f"Refusing to replace different contents: {target}")
        pending.append((target, data, item))
    destination.mkdir(parents=True, exist_ok=True)
    for target, data, item in pending:
        if not target.exists():
            with target.open('xb') as handle:
                handle.write(data)
        verify(target.read_bytes(), item)
        print(f"OK {target.name} | {len(data)} bytes | {item['width']}x{item['height']} | {item['sha256']}")
    print('3/3 original PNGs verified. Git commit/push must be performed and verified separately.')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError, json.JSONDecodeError, zipfile.BadZipFile) as exc:
        print(f'Import failed: {exc}', file=sys.stderr)
        raise SystemExit(1)
