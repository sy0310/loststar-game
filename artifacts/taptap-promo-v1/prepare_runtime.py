"""Copy the current committed H5 runtime into an isolated recording directory."""
import hashlib
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "prototypes/salvage-survivor-demo"
PRIVATE = ROOT / "releases/taptap-promo-v1-private"
DESTINATION = PRIVATE / "runtime"


def main():
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    dirty = subprocess.check_output(
        ["git", "status", "--porcelain", "--", str(SOURCE)], cwd=ROOT, text=True
    ).strip()
    if dirty:
        raise RuntimeError("The recording runtime must come from committed source")
    DESTINATION.mkdir(parents=True, exist_ok=True)
    files = [SOURCE / "index.html", *sorted((SOURCE / "src").glob("*")),
             *sorted((SOURCE / "assets").rglob("*.png")),
             *sorted((SOURCE / "assets/audio").glob("*.mp3"))]
    manifest = []
    for source in files:
        relative = source.relative_to(SOURCE)
        destination = DESTINATION / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        data = source.read_bytes()
        manifest.append({"path": str(relative), "sha256": hashlib.sha256(data).hexdigest()})
        if relative == Path("index.html"):
            stamp = json.dumps({"version": "0.6.10", "commit": commit, "dirty": False})
            data = re.sub(r"window.SurvivorBuild = \{.*?\};",
                          "window.SurvivorBuild = " + stamp + ";", data.decode(), flags=re.S).encode()
        destination.write_bytes(data)
    result = {"sourceCommit": commit, "runtimeFiles": manifest,
              "scope": "Private copy for video recording. Original runtime, packages and player profiles are untouched."}
    (PRIVATE / "runtime-source.json").write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"sourceCommit": commit, "files": len(files), "directory": str(DESTINATION)}))


if __name__ == "__main__":
    main()
