"""Export the existing v0.6.10 controller, art and native WeChat bindings."""
import argparse
import hashlib
import json
import shutil
import subprocess
from html.parser import HTMLParser
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent
ROOT = SOURCE.parents[1]
OUTPUT = ROOT / "releases/wechat-minigame"


class UIState(HTMLParser):
    def __init__(self):
        super().__init__()
        self.elements = {}
        self.stack = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        identity = attrs.get("id")
        if identity:
            self.elements[identity] = {
                "hidden": "hidden" in attrs,
                "disabled": "disabled" in attrs,
                "value": attrs.get("value", ""),
                "textContent": "",
            }
        if tag not in {"meta", "link", "input", "img", "br"}:
            self.stack.append((tag, identity))

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break

    def handle_data(self, data):
        for _, identity in self.stack:
            if identity:
                self.elements[identity]["textContent"] += data


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--freeze", action="store_true")
    args = parser.parse_args()
    commit = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    dirty = bool(subprocess.check_output(["git", "status", "--porcelain", "--", str(SOURCE.relative_to(ROOT))], cwd=ROOT, text=True).strip())
    if args.freeze and dirty:
        raise RuntimeError("Commit the WeChat runtime before freezing the upload package")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    subprocess.run(["node", str(HERE / "export-audio.cjs"), str(OUTPUT / "assets/sfx")], check=True)
    subprocess.run(["python3", str(SOURCE / "sync_runtime.py"), "--check"], check=True)
    catalog_source = (SOURCE / "src/art-catalog.js").read_text()
    catalog = json.loads(catalog_source.split("=", 1)[1].strip().removesuffix(";"))
    for prior_image in (OUTPUT / "assets").rglob("*.png"):
        prior_image.unlink()
    for entry in catalog.values():
        original = entry["src"].removeprefix("./")
        relative = original.replace("@2x", "-2x")
        target = OUTPUT / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(SOURCE / original, target)
        entry["src"] = relative
    for name in ["nebula-groove", "nebula-loop"]:
        target = OUTPUT / name
        target.mkdir(exist_ok=True)
        shutil.copyfile(SOURCE / "assets/audio" / (name + ".mp3"), target / "music.mp3")
        (target / "game.js").write_text("// Local music subpackage.\n")
    initial = UIState()
    initial.feed((SOURCE / "index.html").read_text())
    for node in initial.elements.values():
        node["textContent"] = " ".join(node["textContent"].split())
    stamp = {"version": "0.6.10-wx.3", "commit": commit, "dirty": dirty}
    sections = ["const SurvivorPlatform = {};", (HERE / "platform.js").read_text()]
    sections += ["(function () {", "const window = SurvivorPlatform;", "const document = window.document;", "const localStorage = window.localStorage;", "const Image = window.Image;", "const crypto = window.crypto;", "const structuredClone = window.structuredClone;", "const location = window.location;", "const URLSearchParams = window.URLSearchParams;", "const performance = window.performance;", "const requestAnimationFrame = window.requestAnimationFrame;"]
    sections += ["window.SurvivorBuild = " + json.dumps(stamp) + ";"]
    sections += ["for (const [id, state] of Object.entries(" + json.dumps(initial.elements, ensure_ascii=False) + ")) Object.assign(document.getElementById(id), state);"]
    sections += [(SOURCE / "src/balance.js").read_text(), "window.SurvivorArtCatalog = " + json.dumps(catalog, ensure_ascii=False) + ";"]
    sections += [(SOURCE / "src" / filename).read_text() for filename in ["art.js", "persistence.js"]]
    sections += [(HERE / "audio.js").read_text(), (HERE / "ui.js").read_text(), (SOURCE / "src/game.js").read_text(), "})();", "GameGlobal.Loststar = SurvivorPlatform;\n"]
    (OUTPUT / "game.js").write_text("\n".join(sections))
    config = {
        "deviceOrientation": "portrait",
        "showStatusBar": False,
        "subpackages": [{"name": name, "root": name + "/"} for name in ["nebula-groove", "nebula-loop"]],
    }
    (OUTPUT / "game.json").write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n")
    project = {
        "appid": "wx69a4de5574460d86", "projectname": "失物号-星海突进", "compileType": "game",
        "description": "v0.6.10 微信小游戏适配", "libVersion": "3.18.0",
        "setting": {"es6": True, "minified": True, "urlCheck": True, "ignoreUploadUnusedFiles": False, "ignoreDevUnusedFiles": False},
        "packOptions": {
            "ignore": [{"type": "file", "value": "build-info.json"}],
            "include": [{"type": "folder", "value": "assets"}],
        },
    }
    (OUTPUT / "project.config.json").write_text(json.dumps(project, ensure_ascii=False, indent=2) + "\n")
    private_config = OUTPUT / "project.private.config.json"
    if private_config.exists():
        private = json.loads(private_config.read_text())
        private["projectname"] = project["projectname"]
        private.setdefault("setting", {}).update(ignoreDevUnusedFiles=False, ignoreUploadUnusedFiles=False)
        private_config.write_text(json.dumps(private, ensure_ascii=False, indent=2) + "\n")
    files = [{"path": str(path.relative_to(OUTPUT)), "bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()} for path in sorted(OUTPUT.rglob("*")) if path.is_file() and path.name not in {"build-info.json", "project.private.config.json"}]
    main_bytes = sum(file["bytes"] for file in files if not file["path"].startswith(("nebula-groove/", "nebula-loop/")))
    if main_bytes >= 4 * 1024 * 1024:
        raise RuntimeError("Main package exceeds 4 MiB")
    report = {**stamp, "appid": project["appid"], "mainBytes": main_bytes, "totalBytes": sum(file["bytes"] for file in files), "files": files}
    (OUTPUT / "build-info.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({key: value for key, value in report.items() if key != "files"}, ensure_ascii=False))
    print(OUTPUT)


if __name__ == "__main__":
    main()
