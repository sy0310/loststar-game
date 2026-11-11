from pathlib import Path
from playwright.sync_api import sync_playwright
import shutil, json

ROOT = Path(__file__).parent
HTML = (ROOT / "index.html").read_text(encoding="utf-8").replace(
    "const QA=new URLSearchParams(location.search).has('qa');", "const QA=true;"
)
results = []
with sync_playwright() as pw:
    for browser_type in (pw.chromium, pw.webkit):
        kwargs = {"headless": True}
        if browser_type.name == "chromium" and shutil.which("chromium"):
            kwargs.update(executable_path=shutil.which("chromium"),
                          args=["--no-sandbox", "--disable-dev-shm-usage"])
        try:
            browser = browser_type.launch(**kwargs)
        except Exception as exc:
            print(browser_type.name, "UNAVAILABLE:", str(exc)[:150])
            continue
        for width, height in ((360, 800), (390, 844)):
            page = browser.new_page(viewport={"width": width, "height": height},
                                    device_scale_factor=2, has_touch=True, is_mobile=True)
            errs = []
            page.on("pageerror", lambda e: errs.append(str(e)))
            page.set_content(HTML)
            page.locator("#startBtn").click()
            assert page.locator("#start").is_hidden()
            page.evaluate("window.SurvivorQA.forceEnemies(6)")
            page.evaluate("window.SurvivorQA.level()")
            assert page.locator(".skill").count() == 3
            page.locator(".skill").first.click()
            assert page.locator("#upgrade").is_hidden()
            for wid in ("drone", "arc"):
                for _ in range(3):
                    level = page.evaluate("(id)=>window.SurvivorQA.state().active[id]||0", wid)
                    if level < 3:
                        assert page.evaluate("(id)=>window.SurvivorQA.pick(id)", wid)
            assert page.evaluate("window.SurvivorQA.pick('thunderhive')")
            assert page.evaluate("window.SurvivorQA.state().fused.thunderhive")
            for wid, maxlevel in (("cannon", 3), ("lens", 2)):
                for _ in range(maxlevel):
                    level = page.evaluate("(id)=>{let g=window.SurvivorQA.state();return g.active[id]||g.passive[id]||0}", wid)
                    if level < maxlevel:
                        assert page.evaluate("(id)=>window.SurvivorQA.pick(id)", wid)
            assert page.evaluate("window.SurvivorQA.pick('piercebeam')")
            page.locator("#pauseBtn").click()
            assert page.locator("#pause").is_visible()
            page.locator("#resumeBtn").click()
            page.evaluate("window.SurvivorQA.end(true)")
            assert page.locator("#results").is_visible()
            page.locator("#retryBtn").click()
            assert page.locator("#results").is_hidden()
            assert not errs, errs
            results.append({"browser": browser_type.name,
                            "viewport": f"{width}x{height}",
                            "fusion": "thunderhive", "evolution": "piercebeam",
                            "errors": errs, "replay": True})
            page.close()
        browser.close()
(ROOT / "qa_results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2))
print("PASS:", results)
