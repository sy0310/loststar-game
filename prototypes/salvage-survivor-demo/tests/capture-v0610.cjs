/* Actual fixed-package pixels. Each prepared combat scene is labelled as QA. */
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const out = path.resolve(
  process.env.SURVIVOR_CAPTURE_OUT || "artifacts/survivor-v0610",
);
const url = process.env.SURVIVOR_URL || "http://127.0.0.1:4454/";
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      hasTouch: true,
      recordVideo: {
        dir: path.join(out, "raw"),
        size: { width: 780, height: 1688 },
      },
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(url + "?qa=1");
    await page.waitForFunction(() => SurvivorDemo.ready());
    const report = {
      source: await page.evaluate(() => SurvivorBuild),
      scope:
        "Actual Chromium HTTP rendering at390x844/DPR2. Prepared legal equipment and time fixtures, visible QA label. Real-time motion, health, damage and UI. Desktop capture, physical phone pending.",
      qa: true,
      repairs: [],
      screenshots: [],
      errors,
    };
    await page.locator("#startBtn").tap();
    await page.waitForFunction(
      () => SurvivorDemo.state()?.mode === "play" && !SurvivorDemo.saving(),
    );
    for (const seconds of [0, 300, 600]) {
      await page.evaluate((seconds) => {
        const Q = SurvivorQA,
          g = Q.startModel(91);
        g.time = seconds;
        g.spawnTime = 9999;
        g.enemy = [];
        g.encounters.schedule = [];
        g.milestoneSeen = SurvivorBalance.showcase.milestones.map(
          (m) => m.type + ":" + m.at,
        );
        g.anomalySeen = true;
        g.p.hp = 10;
        g.qaLabel = "QA · " + Math.floor(seconds / 60) + "分钟修复选择";
        Q.level();
      }, seconds);
      await page.waitForTimeout(1000);
      const card = page.locator(".skill").filter({ hasText: "船体修补" });
      const text = await card.textContent();
      await page.screenshot({ path: path.join(out, `repair-${seconds}.png`) });
      await card.tap();
      await page.waitForTimeout(500);
      const after = await page.evaluate(() => ({
        hp: SurvivorDemo.state().p.hp,
        toast: document.querySelector("#toast").textContent,
      }));
      assert.equal(after.hp, { 0: 38, 300: 52, 600: 66 }[seconds]);
      report.repairs.push({ seconds, text, ...after });
    }
    await page.evaluate(() => {
      const Q = SurvivorQA,
        g = Q.startModel(91);
      g.spawnTime = 9999;
      g.p.inv = 9999;
      g.encounters.schedule = [];
      g.qaLabel = "QA · 真实战斗样本";
      g.active = {};
      function evolve(w, p, e) {
        for (let i = 0; i < 5; i++) {
          assertPick(w);
          assertPick(p);
        }
        Q.reward(true);
        assertPick(e);
      }
      function assertPick(id) {
        if (!Q.pick(id)) throw Error("Illegal fixture " + id);
      }
      evolve("arc", "capacitor", "chainstorm");
      evolve("drone", "lock", "hunterswarm");
      Q.reward(true);
      assertPick("thunderhive");
      assertPick("prism");
      assertPick("blade");
      g.time = 280;
      g.anomalySeen = true;
      g.milestoneSeen = SurvivorBalance.showcase.milestones.map(
        (m) => m.type + ":" + m.at,
      );
      for (let i = 0; i < 12; i++) {
        const a = (i * Math.PI) / 6;
        Q.enemy(
          ["tank", "lancer", "ranger"][i % 3],
          Math.cos(a) * 220,
          Math.sin(a) * 260,
          100000,
        );
      }
    });
    await page.waitForTimeout(3500);
    await page.waitForFunction(() =>
      SurvivorDemo.state().arcs.some((a) => a.t > 0.15),
    );
    await page.screenshot({
      path: path.join(out, "screenshot-qa-purple-gold.png"),
    });
    report.screenshots.push({
      file: "screenshot-qa-purple-gold.png",
      qa: true,
      state: await page.evaluate(() => ({
        active: SurvivorDemo.state().active,
        fused: SurvivorDemo.state().fused,
        damage: SurvivorDemo.state().metrics.damage,
      })),
    });
    await page.waitForTimeout(16000);
    await page.locator("#pauseBtn").tap();
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(out, "screenshot-qa-loadout.png"),
    });
    report.screenshots.push({ file: "screenshot-qa-loadout.png", qa: true });
    const video = page.video();
    await context.close();
    await video.saveAs(path.join(out, "qa-repair-combat-silent.webm"));
    const natural = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      hasTouch: true,
      recordVideo: {
        dir: path.join(out, "raw-natural"),
        size: { width: 780, height: 1688 },
      },
    });
    const p = await natural.newPage();
    await p.goto(url);
    await p.waitForFunction(() => SurvivorDemo.ready());
    assert(await p.evaluate(() => !window.SurvivorQA));
    await p.locator("#startBtn").tap();
    await p.waitForTimeout(18000);
    await p.screenshot({
      path: path.join(out, "screenshot-natural-opening.png"),
    });
    report.screenshots.push({
      file: "screenshot-natural-opening.png",
      qa: false,
      state: await p.evaluate(() => ({
        seconds: SurvivorDemo.state().time,
        active: SurvivorDemo.state().active,
      })),
    });
    const naturalVideo = p.video();
    await natural.close();
    await naturalVideo.saveAs(path.join(out, "natural-opening-silent.webm"));
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, "capture.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      "PASS three real repair selections, QA combat and ordinary opening capture",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
