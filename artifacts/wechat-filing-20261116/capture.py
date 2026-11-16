"""Capture actual WeChat IDE frames from the isolated existing QA runtime."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
CLI = "/Applications/wechatwebdevtools.app/Contents/MacOS/wechatide"
PROJECT = ROOT / "releases/wechat-filing-capture"
PLANS = [
    {"id": "characters/01-失物号与护航编队", "seed": 26111601, "time": 94, "seconds": 6, "kind": "ship", "equipment": {"cannon": 3, "drone": 2, "prism": 1, "shield": 1, "armor": 2, "magnet": 1}},
    {"id": "characters/02-逆向投递员", "seed": 26111602, "time": 180, "seconds": 5, "kind": "visitor", "visitor": "courier", "equipment": {"cannon": 3, "missile": 2, "shield": 2, "armor": 2, "cooler": 1}},
    {"id": "characters/03-折光巡游者", "seed": 26111603, "time": 400, "seconds": 5, "kind": "visitor", "visitor": "watcher", "equipment": {"cannon": 4, "blade": 3, "prism": 3, "shield": 2, "armor": 3, "refraction": 2}},
    {"id": "background/01-深空守卫来袭", "seed": 26111604, "time": 299.99, "seconds": 3.6, "kind": "boss", "equipment": {"cannon": 3, "arc": 2, "shield": 2, "armor": 3, "capacitor": 2}},
    {"id": "background/02-裂隙织网者", "seed": 26111605, "time": 439.99, "seconds": 3.6, "kind": "boss", "equipment": {"cannon": 4, "missile": 3, "shield": 2, "repairpod": 2, "armor": 3, "cooler": 2}},
    {"id": "background/03-机雷方舟", "seed": 26111606, "time": 649.99, "seconds": 3.6, "kind": "boss", "equipment": {"cannon": 4, "drone": 3, "gravity": 3, "shield": 3, "armor": 4, "singularity": 2}},
]


def call(tool, *options):
    p = subprocess.run([CLI, "-c", "Codex", tool, "--project", str(PROJECT), *options], text=True, capture_output=True, timeout=60)
    result = json.loads(p.stdout)
    if p.returncode or not result.get("ok") or not result["result"].get("success"):
        raise RuntimeError(p.stdout + p.stderr)
    return result["result"]


if __name__ == "__main__":
    (HERE / "plans.json").write_text(json.dumps(PLANS, ensure_ascii=False, indent=2) + "\n")
    for plan in PLANS:
        name = plan["id"].replace("/", "-")
        args = HERE / "raw" / (name + ".args.json")
        args.write_text(json.dumps([plan], ensure_ascii=False))
        state = call("automation_evaluate", "--fn-source", (HERE / "prepare-frame.js").read_text(), "--args-file", str(args))
        shot = call("simulator_screenshot", "--path", str(HERE / "raw" / (name + ".png")), "--optimize", "false")
        (HERE / "raw" / (name + ".json")).write_text(json.dumps({"state": state["result"], "screenshot": shot}, ensure_ascii=False, indent=2) + "\n")
        print(name + " captured", flush=True)
