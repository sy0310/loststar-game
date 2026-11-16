"""Bind observed v0.5 delivery evidence after the fixed package has been exercised."""
from pathlib import Path
import hashlib
import json

ROOT = Path(__file__).resolve().parents[3]
FOLDER = ROOT / 'artifacts/salvage-v05'


def read(file):
    return json.loads(file.read_text())


def record(file):
    return dict(path=str(file.relative_to(ROOT)), bytes=file.stat().st_size,
                sha256=hashlib.sha256(file.read_bytes()).hexdigest())


def write(file, value):
    file.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')


build = read(FOLDER / 'build-info.json')
browser = read(FOLDER / 'developer/browser-results.json')
assert browser['stats']['expected'] == 176 and browser['stats']['unexpected'] == 0
capture = FOLDER / 'developer/capture'
report = read(capture / 'capture-report.json')
assert report['completed'] and not report['reviewOnly']
assert report['build']['commit'] == build['sourceCommit']
assert len(report['holds']) == 44
receipt = read(FOLDER / 'taptap-receipt.json')
http = read(FOLDER / 'package-http.json')
local = read(FOLDER / 'delivery/local-browser-check.json')
assert local['matchesFrozenMigration'] and local['refreshPreserves']
write(capture / 'manifest.json', dict(
    runtimeSourceSha=build['sourceCommit'], zipSha256=build['sha256'],
    report=str((capture / 'capture-report.json').relative_to(ROOT)),
    natural='Two fresh voyages with normal actions and persisted crypto RNG; no imports or time/seed overrides.',
    qa='Explicit isolated old-save copies for 44 before/after ship layouts and market tests.',
    physicalPhone=False,
    files=[record(file) for file in sorted(capture.rglob('*'))
           if file.is_file() and file.name != 'manifest.json']))
write(FOLDER / 'verification.json', dict(
    schema=7, runtimeSourceSha=build['sourceCommit'],
    buildInfo=str((FOLDER / 'build-info.json').relative_to(ROOT)),
    zip=dict(path=str((FOLDER / build['archive']).relative_to(ROOT)), filename=build['archive'],
             bytes=build['bytes'], sha256=build['sha256'], files=build['files'], dirty=False),
    packageFiles=http['files'], httpReport=str((FOLDER / 'package-http.json').relative_to(ROOT)),
    fixedPackageBrowser=dict(runtimeSourceSha=build['sourceCommit'], zipSha256=build['sha256'],
                             expected=176, unexpected=0, skipped=0, flaky=0, retries=0,
                             report=str((FOLDER / 'developer/browser-results.json').relative_to(ROOT))),
    capture=dict(manifest=str((capture / 'manifest.json').relative_to(ROOT))),
    platform=dict(status='UPLOADED_DEVELOPMENT_SELF_TEST',
                  currentPackageId=receipt['taptap']['package_id'], previousPackageId=458870,
                  formalBound=False, releasing=False,
                  receipt=str((FOLDER / 'taptap-receipt.json').relative_to(ROOT))),
    physicalPhone='NOT_TESTED', userArt='PENDING', humanEnjoyment='PENDING',
    evidenceFiles=[record(file) for file in sorted(FOLDER.rglob('*'))
                   if file.is_file() and file.name != 'verification.json']))
print('Bound observed v0.5 fixed package', build['sourceCommit'], build['sha256'])
