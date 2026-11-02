#!/usr/bin/env python3
"""Import and verify original V0.1 concept art from user-provided ZIP."""
import hashlib, json, sys, zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
mfile=ROOT/"design/ASSET_MANIFEST.json"
m=json.loads(mfile.read_text(encoding="utf-8"))
if len(sys.argv)!=2:
    raise SystemExit("Usage: python3 scripts/import_design_zip.py /path/to/失物星球_V01_完整美术设计稿.zip")
p=Path(sys.argv[1]).expanduser()
raw=p.read_bytes()
if len(raw)!=m["archiveSizeBytes"] or hashlib.sha256(raw).hexdigest()!=m["archiveSha256"]:
    raise SystemExit("Input archive size/SHA256 mismatch; original ZIP required.")
out=ROOT/"design/reference/v0.1"
out.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(p) as z:
    for a in m["assets"]:
        n=a["name"]
        if "/" in n or "\\" in n or n in (".","..",""):
            raise SystemExit(f"Unsafe filename: {n}")
        b=z.read("失物星球_V01_完整设计稿/"+n)
        if len(b)!=a["sizeBytes"] or not hashlib.sha256(b).hexdigest().startswith(a["sha256Prefix"]):
            raise SystemExit(f"Asset checksum mismatch: {n}")
        (out/n).write_bytes(b)
        a["uploaded"]=True
        print("OK",n)
    for n in ("README_设计说明.md","index.html"):
        (out/n).write_bytes(z.read("失物星球_V01_完整设计稿/"+n))
m["status"]="imported_verified"
mfile.write_text(json.dumps(m,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(f"Verified {len(m['assets'])}/{len(m['assets'])} original PNG/MP4 assets.")
