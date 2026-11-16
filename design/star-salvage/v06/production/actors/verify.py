"""Check native actor provenance, materials, alpha, palette and integer exports."""
from pathlib import Path
from PIL import Image
import hashlib
import io
import json
import zipfile
import xml.etree.ElementTree as ET

SOURCE = Path(__file__).resolve().parent
ROOT = SOURCE.parents[4]


def main():
    manifest = json.loads((SOURCE/'manifest.json').read_text())
    colors = json.loads((SOURCE/'palette.json').read_text())['colors']
    palette = {tuple(bytes.fromhex(color[1:])) for color in colors}
    prompts = json.loads((SOURCE/'prompts.json').read_text())
    assert len(prompts) == 7
    assert len({row['id'] for row in prompts}) == 7
    expected_sizes = {'player':24,'skimmer':24,'wisp':24,'ranger':24,
                      'tank':32,'elite':36,'boss':48}
    assert {row['id'] for row in manifest['assets']} == set(expected_sizes)
    checks = []
    runtime_bytes = 0
    for row in manifest['assets']:
        id = row['id']
        size = expected_sizes[id]
        image = Image.open(SOURCE/'native'/f'{id}@1x.png').convert('RGBA')
        assert image.size == (size,size)
        assert {pixel[3] for pixel in image.getdata()} <= {0,255}
        assert {pixel[:3] for pixel in image.getdata() if pixel[3]} <= palette
        bbox = image.getbbox()
        assert bbox[0] >= 1 and bbox[1] >= 1
        assert bbox[2] <= size-1 and bbox[3] <= size-1
        assert list(bbox) == row['contentBBox']
        with zipfile.ZipFile(SOURCE/'native'/f'{id}.ora') as archive:
            assert archive.read('mimetype') == b'image/openraster'
            assert Image.open(io.BytesIO(archive.read('mergedimage.png'))).convert('RGBA').tobytes() == image.tobytes()
            tree = ET.fromstring(archive.read('stack.xml'))
            layers = tree.find('stack').findall('layer')
            assert {layer.attrib['name'] for layer in layers} == {'armor','gold','energy'}
            merged = Image.new('RGBA',image.size)
            for layer in reversed(layers):
                source = Image.open(io.BytesIO(archive.read(layer.attrib['src']))).convert('RGBA')
                merged = Image.alpha_composite(merged,source)
            assert merged.tobytes() == image.tobytes()
        for scale in [2,4]:
            file = ROOT/'prototypes/salvage-survivor-demo/assets/actors'/f'{id}@{scale}x.png'
            runtime = Image.open(file).convert('RGBA')
            assert runtime.tobytes() == image.resize((size*scale,size*scale),Image.Resampling.NEAREST).tobytes()
            runtime_bytes += file.stat().st_size
        for record in row['files']:
            file = ROOT/record['path']
            assert file.stat().st_size == record['bytes']
            assert hashlib.sha256(file.read_bytes()).hexdigest() == record['sha256']
        original = SOURCE/'originals'/f'{id}-generated.png'
        assert original.stat().st_size > 10000
        assert next(prompt for prompt in prompts if prompt['id'] == id)['tool'] == 'image_gen.imagegen'
        checks.append({'id':id,'nativeSize':image.size,'binaryAlpha':True,
                       'paletteSubset':True,'editableLayersRecompose':True,
                       'exactNearest':True,'sourceHashesMatch':True})
    player = Image.open(SOURCE/'native/player@1x.png').convert('RGBA')
    for x,y in [[8,21],[14,21]]:
        assert player.getpixel((x,y))[3] == 255
        assert player.getpixel((x,y))[:3] in {tuple(bytes.fromhex(color[1:])) for color in ['#17172b','#242036','#393449']}
    result = {'passed':7,'runtimeExports':14,'paletteColors':len(colors),
              'runtimeBytes':runtime_bytes,'checks':checks,
              'scope':'Engineering provenance/export checks. User art and physical-phone acceptance pending.'}
    (SOURCE/'verification.json').write_text(json.dumps(result,indent=2)+'\n')
    print('PASS7 original actors,7 material-layer ORAs,14 exact integer exports,28-color palette and actual twin-nozzle pixels')


if __name__ == '__main__':
    main()
