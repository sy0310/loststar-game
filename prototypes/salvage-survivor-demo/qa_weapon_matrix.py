from pathlib import Path
from playwright.sync_api import sync_playwright
import shutil, json

ROOT = Path(__file__).parent
HTML = (ROOT / "index.html").read_text(encoding="utf-8").replace(
    "const QA=new URLSearchParams(location.search).has('qa');", "const QA=true;"
)
EVO = [
    ("cannon", "lens", "piercebeam"),
    ("drone", "lock", "hunterswarm"),
    ("arc", "capacitor", "chainstorm"),
    ("missile", "cooler", "meteorbarrage"),
    ("blade", "magnet", "spiralsaw"),
    ("shield", "armor", "reactiveaegis"),
]
FUSION = [("drone", "arc", "thunderhive"), ("missile", "blade", "blastwheel")]
rows = []
with sync_playwright() as pw:
    kwargs = {"headless": True}
    if shutil.which("chromium"):
        kwargs.update(executable_path=shutil.which("chromium"),
                      args=["--no-sandbox", "--disable-dev-shm-usage"])
    browser = pw.chromium.launch(**kwargs)
    page = browser.new_page(viewport={"width": 390, "height": 844})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.set_content(HTML)
    def upgrade(id, maxlevel):
        for _ in range(maxlevel):
            current = page.evaluate(
                "(id)=>{let g=SurvivorQA.state();return g.active[id]||g.passive[id]||0}", id
            )
            if current >= maxlevel:
                break
            assert page.evaluate("(id)=>SurvivorQA.pick(id)", id), id
    for active, passive, result in EVO:
        page.evaluate("SurvivorQA.start()")
        upgrade(active, 3); upgrade(passive, 2)
        assert page.evaluate("(id)=>SurvivorQA.pick(id)", result), result
        assert page.evaluate(
            "(id)=>Object.values(SurvivorQA.state().evolved).includes(id)", result
        )
        rows.append({"kind": "EVO", "result": result, "ok": True})
    for a, b, result in FUSION:
        page.evaluate("SurvivorQA.start()")
        upgrade(a, 3); upgrade(b, 3)
        before = page.evaluate("Object.keys(SurvivorQA.state().active).length")
        assert page.evaluate("(id)=>SurvivorQA.pick(id)", result), result
        state = page.evaluate(
            "({active:Object.keys(SurvivorQA.state().active),fused:SurvivorQA.state().fused})"
        )
        assert a not in state["active"] and b not in state["active"]
        assert state["fused"].get(result)
        assert len(state["active"]) + len(state["fused"]) == before - 1
        rows.append({"kind": "FUSION", "result": result, "slot_released": True, "ok": True})
    assert not errors, errors
    browser.close()
(ROOT / "qa_weapon_matrix.json").write_text(
    json.dumps({"results": rows, "errors": errors}, ensure_ascii=False, indent=2))
print("PASS:", len(rows), "evolutions and fusions")
