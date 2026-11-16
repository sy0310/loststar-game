"""Export the generated galaxy backplane at the game's native pixel scale."""
import hashlib
import io
import json
import zipfile
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, tostring

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[4]
RUNTIME = ROOT / 'prototypes/salvage-survivor-demo/assets/v062/space'
SIZE = (384, 640)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def record(path):
    return {
        'path': path.relative_to(ROOT).as_posix(),
        'bytes': path.stat().st_size,
        'sha256': digest(path),
    }


def png_bytes(image):
    output = io.BytesIO()
    image.save(output, format='PNG', optimize=True)
    return output.getvalue()


def editable_ora(image, path):
    document = Element('image', w=str(image.width), h=str(image.height), name='Deep-space backplane')
    stack = SubElement(document, 'stack')
    SubElement(stack, 'layer', name='Galaxy paint', src='data/galaxy.png', x='0', y='0', opacity='1.0', visibility='visible', **{'composite-op': 'svg:src-over'})
    pixels = png_bytes(image)
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('mimetype', 'image/openraster', compress_type=zipfile.ZIP_STORED)
        archive.writestr('stack.xml', tostring(document, encoding='utf-8', xml_declaration=True))
        archive.writestr('data/galaxy.png', pixels)
        archive.writestr('mergedimage.png', pixels)
        thumbnail = image.copy()
        thumbnail.thumbnail((256, 256), Image.Resampling.NEAREST)
        archive.writestr('Thumbnails/thumbnail.png', png_bytes(thumbnail))


def main():
    RUNTIME.mkdir(parents=True, exist_ok=True)
    (HERE / 'native').mkdir(exist_ok=True)
    source_path = HERE / 'generated/deep-space-source.png'
    source = Image.open(source_path).convert('RGB')
    # Nearest-neighbour export preserves the generated cluster edges. A bounded
    # background palette also keeps the resulting raster small and stable.
    image = source.resize(SIZE, Image.Resampling.NEAREST)
    image = image.quantize(colors=48, dither=Image.Dither.NONE).convert('RGBA')
    native_path = HERE / 'native/deep_space@1x.png'
    image.save(native_path, optimize=True)
    ora_path = HERE / 'native/deep_space.ora'
    editable_ora(image, ora_path)
    files = [native_path, ora_path]
    for scale in (2, 4):
        path = RUNTIME / f'deep_space@{scale}x.png'
        image.resize((SIZE[0] * scale, SIZE[1] * scale), Image.Resampling.NEAREST).save(path, optimize=True)
        files.append(path)

    contact = Image.new('RGB', (384, 676), '#101225')
    contact.paste(image, (0, 36))
    draw = ImageDraw.Draw(contact)
    draw.text((10, 12), 'v062 deep space | native 384 x 640 | 48 colors', fill='#c4bed2')
    contact.save(HERE / 'contact-sheet.png', optimize=True)
    manifest = {
        'schema': 1,
        'style': 'Original purple-grey and navy raster galaxy backplane. Existing actors and effects remain unchanged.',
        'sourceInputs': [record(path) for path in [Path(__file__), source_path, HERE / 'generated/deep-space-prompt.json']],
        'assets': [{
            'id': 'deep_space',
            'kind': 'background',
            'nativeSize': list(SIZE),
            'runtimeScale': 2,
            'center': [192, 320],
            'alpha': 'opaque',
            'paletteColors': len(image.getcolors(SIZE[0] * SIZE[1])),
            'exactNearest': True,
            'editableMergedMatches': True,
            'frames': [{'x': 0, 'y': 0, 'width': SIZE[0], 'height': SIZE[1], 'anchor': [192, 320]}],
            'files': [record(path) for path in files],
        }],
    }
    (HERE / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(json.dumps({'native': str(native_path), 'runtimeBytes': files[2].stat().st_size, 'paletteColors': manifest['assets'][0]['paletteColors']}))


if __name__ == '__main__':
    main()
