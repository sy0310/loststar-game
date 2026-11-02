#!/usr/bin/env python3
"""Compare imported design images against the manifest."""
import hashlib, json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
m=json.loads((root/"design/ASSET_MANIFEST.json").read_text(encoding="utf-8"))
bad=[]
for a in m["assets"]:
    p=root/a["repoPath"]
    if not p.is_file(): bad.append("MISSING "+str(p)); continue
    b=p.read_bytes()
    if len(b)!=a["sizeBytes"] or not hashlib.sha256(b).hexdigest().startswith(a["sha256Prefix"]):
        bad.append("HASH_MISMATCH "+str(p))
print(f"Design assets verified: {len(m['assets'])-len(bad)}/{len(m['assets'])}")
for x in bad: print(x)
raise SystemExit(bool(bad))
