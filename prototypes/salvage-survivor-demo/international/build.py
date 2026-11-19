"""Export the bilingual international client without rewriting the verified core."""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
GAME = HERE.parent
ROOT = GAME.parents[1]
sys.path.insert(0, str(GAME))
from sync_runtime import generated


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, default=ROOT / 'releases/survivor-global/web')
    parser.add_argument('--freeze', action='store_true')
    args = parser.parse_args()
    output = args.output.resolve()
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip()
    dirty = bool(subprocess.check_output(['git', 'status', '--porcelain', '--', str(GAME.relative_to(ROOT))], cwd=ROOT, text=True).strip())
    if args.freeze and dirty:
        raise RuntimeError('Commit international runtime before freezing the package')
    dictionary = {}
    for line in (HERE / 'en.tsv').read_text().splitlines():
        if not line.strip():
            continue
        source, translated = line.split('\t', 1)
        if source in dictionary or not translated.strip():
            raise ValueError('Duplicate or empty translation: ' + source)
        dictionary[source] = translated
    # Every Chinese token from the four runtime text sources needs an explicit entry.
    expected = set()
    for name in ['index.html', 'src/game.js', 'src/balance.js', 'src/persistence.js']:
        expected.update(re.findall(r'[\u3400-\u9fff]+', (GAME / name).read_text()))
    missing = expected - dictionary.keys()
    if missing:
        raise ValueError('Missing English tokens: ' + ', '.join(sorted(missing)))
    derived, catalog = generated()
    for path, text in derived.items():
        if path.read_text() != text:
            raise RuntimeError('Generated core asset files are stale')
    paths = [GAME / 'index.html', *sorted((GAME / 'src').glob('*')),
             *[GAME / entry['src'][2:] for entry in catalog.values()],
             *sorted((GAME / 'assets/audio').glob('*.mp3'))]
    payload = {p.relative_to(GAME).as_posix(): p.read_bytes() for p in paths}
    source_files = [{'path': str(p.relative_to(ROOT)), 'sha256': sha(p.read_bytes())} for p in paths]
    if len(payload) != 84:
        raise RuntimeError('Unexpected base runtime file inventory')
    html = payload['index.html'].decode()
    html = html.replace('<title>失物号：星海突进</title>', '<title>Lostship: Star Surge</title>')
    html = html.replace('</head>', '<link rel="stylesheet" href="./src/locale.css" /></head>')
    html = re.sub(r'window.SurvivorBuild = \{.*?\};', 'window.SurvivorBuild = ' + json.dumps({
        'version': '0.6.11-global.1', 'commit': commit, 'dirty': dirty,
    }) + ';', html, flags=re.S)
    html = html.replace('<script src="./src/balance.js">',
                        '<script src="./src/english.js"></script>\n'
                        '<script src="./src/international-i18n.js"></script>\n'
                        '<script src="./src/balance.js">')
    payload['index.html'] = html.encode()
    game = payload['src/game.js'].decode()
    if game.count('ctx.fillText(text.s,') != 2:
        raise RuntimeError('Canvas label sites changed; review localization bindings')
    payload['src/game.js'] = game.replace('ctx.fillText(text.s,', 'ctx.fillText(window.SurvivorI18n.text(text.s),').encode()
    payload['src/english.js'] = ('window.SurvivorEnglish = ' + json.dumps(dictionary, ensure_ascii=False) + ';\n').encode()
    payload['src/international-i18n.js'] = (HERE / 'i18n.js').read_bytes()
    payload['src/locale.css'] = (HERE / 'locale.css').read_bytes()
    output.mkdir(parents=True, exist_ok=True)
    for name, raw in payload.items():
        path = output / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(raw)
    report = {'version': '0.6.11-global.1', 'sourceCommit': commit, 'dirty': dirty,
              'defaultLanguage': 'en', 'languages': ['en', 'zh-CN'],
              'files': [{'path': name, 'bytes': len(raw), 'sha256': sha(raw)} for name, raw in sorted(payload.items())],
              'sourceFiles': source_files, 'translatedTokens': len(dictionary),
              'canonicalCoreData': 'unchanged; presentation localization only'}
    (output.parent / 'web-build-info.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'output': str(output), 'files': len(payload), 'tokens': len(dictionary), 'dirty': dirty}))


if __name__ == '__main__':
    main()
