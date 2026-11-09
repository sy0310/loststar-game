"""Bind observed 0.4.1 delivery files; never manufactures test/platform results."""
from pathlib import Path
import hashlib, json
R = Path(__file__).resolve().parents[3]
D = R / 'artifacts/salvage-ship-v041'
def record(p):
    return dict(path=str(p.relative_to(R)), bytes=p.stat().st_size,
                sha256=hashlib.sha256(p.read_bytes()).hexdigest())
def write(p, value):
    p.write_text(json.dumps(value, ensure_ascii=False, indent=2)+'\n')
b = json.loads((D/'build-info.json').read_text())
browser = json.loads((D/'developer/browser-results.json').read_text())
assert browser['stats']['expected'] == 108 and browser['stats']['unexpected'] == 0
cap = D/'developer/capture'
r = json.loads((cap/'capture-report.json').read_text())
assert r['completed'] and r['build']['commit'] == b['sourceCommit']
assert len(r['refinement']['checkpoints']) == 5
media = [record(p) for p in sorted(cap.rglob('*')) if p.is_file() and p.name != 'manifest.json']
write(cap/'manifest.json', dict(runtimeSourceSha=b['sourceCommit'], zipSha256=b['sha256'],
    report=str((cap/'capture-report.json').relative_to(R)),
    natural='Two fresh-game voyages, no imports/seed/time override.',
    qa='Explicit27049 separate context: purchase/equip/supply, paid caps, whole cargo rotation and stock persistence.',
    physicalPhone=False, files=media))
receipt = json.loads((D/'taptap-receipt.json').read_text())
http = json.loads((D/'package-http.json').read_text())
files = [record(p) for p in sorted(D.rglob('*')) if p.is_file() and p.name != 'verification.json']
write(D/'verification.json', dict(schema=5, runtimeSourceSha=b['sourceCommit'],
    buildInfo=str((D/'build-info.json').relative_to(R)),
    zip=dict(path=str((D/b['archive']).relative_to(R)), filename=b['archive'],
             bytes=b['bytes'], sha256=b['sha256'], files=b['files'], dirty=False),
    packageFiles=http['files'], httpReport=str((D/'package-http.json').relative_to(R)),
    fixedPackageBrowser=dict(runtimeSourceSha=b['sourceCommit'], zipSha256=b['sha256'],
        expected=108, unexpected=0, skipped=0, flaky=0, retries=0,
        report=str((D/'developer/browser-results.json').relative_to(R))),
    capture=dict(manifest=str((cap/'manifest.json').relative_to(R))),
    platform=dict(status='UPLOADED_DEVELOPMENT_SELF_TEST',
        currentPackageId=receipt['taptap']['package_id'], previousPackageId=457635,
        formalBound=False, releasing=False, receipt=str((D/'taptap-receipt.json').relative_to(R))),
    physicalPhone='NOT_TESTED', userArt='PENDING', humanEnjoyment='PENDING', evidenceFiles=files))
print('Bound', len(files), 'observed files to', b['sourceCommit'], b['sha256'])
