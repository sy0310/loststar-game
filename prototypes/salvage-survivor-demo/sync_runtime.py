"""Derive the runtime catalog and balance from the editable production manifests."""
import argparse
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def generated():
    catalog = {}
    manifests=[ROOT/'design/star-salvage/v06/production'/group/'manifest.json' for group in ('actors','weapons')]
    manifests.append(ROOT/'design/star-salvage/v061/production/effects/manifest.json')
    manifests.extend(ROOT/'design/star-salvage/v062/production'/group/'manifest.json' for group in ('actors', 'space'))
    manifests.append(ROOT/'design/star-salvage/v064/production/actors/manifest.json')
    manifests.append(ROOT/'design/star-salvage/v064/production/weapons/manifest.json')
    for path in manifests:
        manifest = json.loads(path.read_text())
        for asset in manifest['assets']:
            file = next(item for item in asset['files'] if item['path'].endswith('@2x.png'))
            runtime = ROOT / file['path']
            if sha(runtime) != file['sha256']:
                raise ValueError(f"Runtime pixels differ from native export {runtime}")
            entry = {key: asset[key] for key in ('nativeSize', 'center', 'forward', 'exhaustAnchors', 'exhaustDirection', 'collisionCenter', 'collisionRadius', 'nozzleAnchor', 'shipForward', 'durationMs', 'originAnchor', 'emissionDirection') if key in asset}
            entry.update(src='./' + runtime.relative_to(HERE).as_posix(), sha256=file['sha256'], kind=asset.get('kind', 'actor'))
            width, height = asset['nativeSize']
            entry['frames'] = asset.get('frames', [{'x': 0, 'y': 0, 'width': width, 'height': height, 'anchor': asset.get('center', [width / 2, height / 2])}])
            if 'frameMs' in asset:
                entry['frameMs'] = asset['frameMs']
            catalog[asset['id']] = entry
    balance = json.loads((ROOT / 'design/star-salvage/v064/BALANCE_V064.json').read_text())
    return {
        HERE / 'src/art-catalog.js': 'window.SurvivorArtCatalog = ' + json.dumps(catalog, ensure_ascii=False, indent=2) + ';\n',
        HERE / 'src/balance.js': 'window.SurvivorBalance = ' + json.dumps(balance, ensure_ascii=False, indent=2) + ';\n',
    }, catalog


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    files, catalog = generated()
    for path, content in files.items():
        if args.check:
            if path.read_text() != content:
                raise ValueError(f'Regenerate {path} with sync_runtime.py')
        else:
            path.write_text(content)
    print(f'Validated {len(catalog)} native/runtime mappings and frozen balance')


if __name__ == '__main__':
    main()
