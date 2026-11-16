"""Verify native pixels, editable source and nearest-neighbour space exports."""
import hashlib
import io
import json
import zipfile
from pathlib import Path

from PIL import Image, ImageChops

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]


def same_pixels(first, second):
    assert first.size == second.size
    assert ImageChops.difference(first.convert('RGBA'), second.convert('RGBA')).getbbox() is None


def main():
    manifest = json.loads((HERE / 'manifest.json').read_text())
    for item in manifest['sourceInputs'] + manifest['assets'][0]['files']:
        path = ROOT / item['path']
        assert path.stat().st_size == item['bytes'], path
        assert hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256'], path
    asset = manifest['assets'][0]
    native = Image.open(HERE / 'native/deep_space@1x.png').convert('RGBA')
    assert native.size == tuple(asset['nativeSize'])
    assert native.getchannel('A').getextrema() == (255, 255)
    assert len(native.getcolors(native.width * native.height)) <= 48
    for scale in (2, 4):
        path = ROOT / f'prototypes/salvage-survivor-demo/assets/v062/space/deep_space@{scale}x.png'
        same_pixels(native.resize((native.width * scale, native.height * scale), Image.Resampling.NEAREST), Image.open(path))
    with zipfile.ZipFile(HERE / 'native/deep_space.ora') as archive:
        assert archive.read('mimetype') == b'image/openraster'
        same_pixels(native, Image.open(io.BytesIO(archive.read('mergedimage.png'))))
        same_pixels(native, Image.open(io.BytesIO(archive.read('data/galaxy.png'))))
    print('PASS v062 space: original hashes,384x640 native,48-color opaque pixels,2x/4x nearest exports and editable ORA')


if __name__ == '__main__':
    main()
