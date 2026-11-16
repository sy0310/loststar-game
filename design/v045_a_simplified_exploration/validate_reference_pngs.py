#!/usr/bin/env python3
"""Validate the four approved original PNG bytes without image-library dependencies."""
import hashlib
import json
import struct
from pathlib import Path

root = Path(__file__).resolve().parents[2]
manifest = json.loads((Path(__file__).parent / 'manifest.json').read_text())
assert len(manifest['images']) == 4
for item in manifest['images']:
    path = root / item['path']
    data = path.read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', path
    assert struct.unpack('>II', data[16:24]) == (item['width'], item['height']), path
    assert len(data) == item['bytes'] and hashlib.sha256(data).hexdigest() == item['sha256'], path
print('V045 approved reference PNGs verified: 4/4')
