"""Assemble the reviewed test materials without mutating source art or screenshots."""
import hashlib
import json
import zipfile
from pathlib import Path
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
OUT = ROOT / 'artifacts/survivor-v0610'


def main():
    selected = [
        ('logo-1024.png', 'design/star-salvage/v068/store-media/exports/taptap-icon-1024.png', 'icon', False),
        ('logo-512.png', 'design/star-salvage/v068/store-media/exports/taptap-icon-512.png', 'icon', False),
        ('promo-1920x1080.png', 'design/star-salvage/v0610/test-materials/art/exports/taptap-banner-title-only-1920x1080.png', 'illustration', False),
        ('promo-1440x1440.png', 'design/star-salvage/v068/store-media/exports/taptap-square-promo-1440.png', 'illustration', False),
        ('screenshots/01-ordinary-opening.png', 'artifacts/survivor-v0610/screenshot-natural-opening.png', 'actual-runtime', False),
        ('screenshots/02-qa-purple-gold.png', 'artifacts/survivor-v0610/screenshot-qa-purple-gold.png', 'actual-runtime', True),
        ('screenshots/03-qa-repair-choice.png', 'artifacts/survivor-v0610/repair-600.png', 'actual-runtime', True),
        ('video/ordinary-opening-silent.mp4', 'artifacts/survivor-v0610/natural-opening-silent.mp4', 'actual-runtime', False),
        ('video/qa-repair-combat-silent.mp4', 'artifacts/survivor-v0610/qa-repair-combat-silent.mp4', 'actual-runtime', True),
        ('INTRODUCTION.md', 'design/star-salvage/v0610/test-materials/INTRODUCTION.md', 'copy', False),
        ('listing-draft.json', 'design/star-salvage/v0610/test-materials/listing-draft.json', 'copy', False),
        ('taptap-480638.png', 'artifacts/survivor-v0610/taptap-480638.png', 'developer-test-qr', False),
    ]
    build = json.loads((OUT / 'build-info.json').read_text())
    manifest = {'title': '失物号：星海突进', 'sourceCommit': build['sourceCommit'], 'taptapVersion': 480638, 'status': 'INTERNAL_REVIEWED_USER_AND_PHONE_PENDING', 'files': []}
    payload = {}
    for name, relative, kind, qa in selected:
        file = ROOT / relative
        raw = file.read_bytes()
        row = {'name': name, 'path': relative, 'kind': kind, 'qa': qa, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}
        if file.suffix == '.png':
            with Image.open(file) as image:
                image.load()
                row['dimensions'] = list(image.size)
        manifest['files'].append(row)
        payload[name] = raw
    payload['manifest.json'] = (json.dumps(manifest, ensure_ascii=False, indent=2) + '\n').encode()
    payload['START_HERE.md'] = '''# 失物号：星海突进 · 首轮测试资料

TapTap开发自测480638，运行v0.6.10 / ea26e29。扫描同目录二维码，在TapTap内试玩。

拖动飞船躲避敌潮，收集经验选择强化。新开一局启用随时间增加的升级修补，旧局续玩保留原规则。

Logo、横方宣传图、三张实际截图、两段原速录屏和介绍均在本包。截图中的QA标记表示隔离预设装备或时间，画面来自真实游戏运行。视频为无声技术录屏。宣传插画与实际截图分别标记于manifest。

名称、Logo及宣传图待用户审核。真实手机触控、锁屏、发热、跨版本续档与数日体验待扫码测试。后台当前名称为“失物星球”。
'''.encode()
    archive = OUT / 'loststar-survivor-v0610-test-materials.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zipped:
        for name, raw in sorted(payload.items()):
            info = zipfile.ZipInfo(name, (2026, 11, 13, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o644 << 16
            zipped.writestr(info, raw)
    with zipfile.ZipFile(archive) as zipped:
        assert set(zipped.namelist()) == set(payload)
        for name, raw in payload.items():
            assert zipped.read(name) == raw
    manifest['archive'] = {'path': str(archive.relative_to(ROOT)), 'bytes': archive.stat().st_size, 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'files': len(payload)}
    (OUT / 'test-materials.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(manifest['archive']))


if __name__ == '__main__':
    main()
