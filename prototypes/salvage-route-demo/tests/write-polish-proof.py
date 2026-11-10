"""Bind observed 0.4.2 fixed-package evidence, never fabricate test or platform results."""
from pathlib import Path
import hashlib,json
R=Path(__file__).resolve().parents[3];D=R/'artifacts/salvage-polish-v042'
def rec(p):return dict(path=str(p.relative_to(R)),bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest())
def write(p,v):p.write_text(json.dumps(v,ensure_ascii=False,indent=2)+'\n')
b=json.loads((D/'build-info.json').read_text());browser=json.loads((D/'developer/browser-results.json').read_text())
assert browser['stats']['expected']==128 and browser['stats']['unexpected']==0
cap=D/'developer/capture';r=json.loads((cap/'capture-report.json').read_text())
assert r['completed'] and r['build']['commit']==b['sourceCommit']
assert len(r['polish']['checkpoints'])==4
write(cap/'manifest.json',dict(runtimeSourceSha=b['sourceCommit'],zipSha256=b['sha256'],report=str((cap/'capture-report.json').relative_to(R)),natural='Two fresh-game voyages, no imports/seed/time override.',qa='Explicit isolated27049 and454 copies, separately labelled.',physicalPhone=False,files=[rec(p)for p in sorted(cap.rglob('*'))if p.is_file()and p.name!='manifest.json']))
receipt=json.loads((D/'taptap-receipt.json').read_text());http=json.loads((D/'package-http.json').read_text())
write(D/'verification.json',dict(schema=6,runtimeSourceSha=b['sourceCommit'],buildInfo=str((D/'build-info.json').relative_to(R)),zip=dict(path=str((D/b['archive']).relative_to(R)),filename=b['archive'],bytes=b['bytes'],sha256=b['sha256'],files=b['files'],dirty=False),packageFiles=http['files'],httpReport=str((D/'package-http.json').relative_to(R)),fixedPackageBrowser=dict(runtimeSourceSha=b['sourceCommit'],zipSha256=b['sha256'],expected=128,unexpected=0,skipped=0,flaky=0,retries=0,report=str((D/'developer/browser-results.json').relative_to(R))),capture=dict(manifest=str((cap/'manifest.json').relative_to(R))),platform=dict(status='UPLOADED_DEVELOPMENT_SELF_TEST',currentPackageId=receipt['taptap']['package_id'],previousPackageId=458136,formalBound=False,releasing=False,receipt=str((D/'taptap-receipt.json').relative_to(R))),physicalPhone='NOT_TESTED',userArt='PENDING',humanEnjoyment='PENDING',evidenceFiles=[rec(p)for p in sorted(D.rglob('*'))if p.is_file()and p.name!='verification.json']))
print('Bound fixed0.4.2 observed evidence',b['sourceCommit'],b['sha256'])
