/* Actual HTTP evidence. Natural input and explicitly labelled QA fixtures are separate. */
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const url = process.env.SURVIVOR_URL || "http://127.0.0.1:4397/";
const output = path.resolve(
  process.env.SURVIVOR_CAPTURE_OUT || "artifacts/survivor-v06/current",
);
const keys = ["d", "s", "a", "w"];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function natural(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    recordVideo: {
      dir: path.join(output, "raw"),
      size: { width: 390, height: 844 },
    },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  const response = await page.goto(url);
  assert(response.ok());
  await page.waitForFunction(() => SurvivorDemo.ready());
  assert(await page.evaluate(() => !window.SurvivorQA));
  const report = {
    kind: "natural-input",
    source: await page.evaluate(() => SurvivorBuild),
    actualHttpSha256: crypto
      .createHash("sha256")
      .update(await response.body())
      .digest("hex"),
    qa: false,
    seedOrTimeOverride: false,
    imports: false,
    policy:
      "Keyboard square movement, only visible cards, one affordable hull upgrade between runs. Randomness and game time are untouched.",
    runs: [],
    errors,
  };
  for (let run = 1; run <= 2; run++) {
    if (run === 1) await page.locator("#startBtn").click();
    else {
      if (await page.locator("#upgradeHullBtn").isEnabled()) {
        await page.locator("#upgradeHullBtn").click();
        await page.waitForFunction(() => !SurvivorDemo.saving());
      }
      await page.locator("#retryBtn").click();
    }
    await page.waitForFunction(
      () => SurvivorDemo.state()?.mode === "play" && !SurvivorDemo.saving(),
    );
    const began = Date.now(),
      row = { run, upgrades: [], samples: [] };
    let direction = -1,
      lastSample = -1,
      done = false;
    while (Date.now() - began < 240000) {
      const view = await page.evaluate(() => ({
        mode: SurvivorDemo.state()?.mode,
        time: SurvivorDemo.state()?.time,
        hp: SurvivorDemo.state()?.p.hp,
        level: SurvivorDemo.state()?.level,
        kills: SurvivorDemo.state()?.kills,
      }));
      if (view.mode === "results") {
        row.end = {
          ...view,
          wallSeconds: (Date.now() - began) / 1000,
          profile: await page.evaluate(() => SurvivorDemo.profile()),
          state: await page.evaluate(() => SurvivorDemo.state()),
        };
        done = true;
        break;
      }
      if (view.mode === "upgrade") {
        for (const key of keys) await page.keyboard.up(key);
        direction = -1;
        const cards = await page.locator("[data-pick]").allTextContents();
        let index = 0;
        for (const name of [
          "贯星轨炮",
          "脉冲主炮",
          "聚能透镜",
          "反应壁垒",
          "离子护盾",
          "反应装甲",
          "追踪无人机",
          "锁定芯片",
        ]) {
          const found = cards.findIndex((text) => text.includes(name));
          if (found >= 0) {
            index = found;
            break;
          }
        }
        row.upgrades.push({
          time: view.time,
          wallSeconds: (Date.now() - began) / 1000,
          offered: cards,
          chosen: cards[index],
        });
        if (row.upgrades.length === 1)
          await page.screenshot({
            path: path.join(output, `natural-${run}-first-upgrade.png`),
          });
        await page.locator("[data-pick]").nth(index).click();
      } else if (view.mode === "play") {
        const next = Math.floor(view.time / 1.5) % 4;
        if (next !== direction) {
          for (const key of keys) await page.keyboard.up(key);
          await page.keyboard.down(keys[next]);
          direction = next;
        }
      }
      const thresholds = [10, 30, 60, 120, 135, 170];
      const threshold = thresholds.find(
        (value) => view.time >= value && value > lastSample,
      );
      if (threshold) {
        lastSample = threshold;
        row.samples.push({
          threshold,
          ...view,
          world: await page.evaluate(() => {
            const g = SurvivorDemo.state();
            return {
              enemies: g.enemy.length,
              spawned: g.metrics.spawned,
              damage: g.metrics.damage,
              events: g.metrics.events,
              evolved: g.evolved,
              fused: g.fused,
              xp: g.xp,
              credits: g.credits,
            };
          }),
        });
        await page.screenshot({
          path: path.join(output, `natural-${run}-${threshold}s.png`),
        });
      }
      await wait(80);
    }
    assert(done, "Natural run must finish by real play or death");
    for (const key of keys) await page.keyboard.up(key);
    await page.waitForFunction(() => !SurvivorDemo.saving());
    await page.screenshot({
      path: path.join(output, `natural-${run}-results.png`),
    });
    report.runs.push(row);
    fs.writeFileSync(
      path.join(output, "natural-report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(
      `Natural run ${run}: ${row.end.time.toFixed(1)}s, ${row.end.kills}kills, first upgrade ${row.upgrades[0]?.time?.toFixed(1)}s`,
    );
  }
  const video = page.video();
  await context.close();
  await video.saveAs(path.join(output, "natural-two-runs.webm"));
  assert.equal(errors.length, 0);
}
async function qa(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    recordVideo: {
      dir: path.join(output, "raw"),
      size: { width: 390, height: 844 },
    },
  });
  const page = await context.newPage();
  await page.goto(url + "?qa=1");
  await page.waitForFunction(() => SurvivorDemo.ready());
  const recipes = [
    ["cannon", "lens", "piercebeam"],
    ["drone", "lock", "hunterswarm"],
    ["arc", "capacitor", "chainstorm"],
    ["missile", "cooler", "meteorbarrage"],
    ["blade", "magnet", "spiralsaw"],
    ["shield", "armor", "reactiveaegis"],
    ["drone", "arc", "thunderhive"],
    ["missile", "blade", "blastwheel"],
  ];
  const report = {
    kind: "explicit-QA-fixtures",
    source: await page.evaluate(() => SurvivorBuild),
    notNaturalProgress: true,
    rows: [],
  };
  for (const [a, b, result] of recipes) {
    await page.evaluate(
      ([a, b, result]) => {
        const Q = SurvivorQA,
          g = Q.startModel(73);
        g.enemy = [];
        while ((g.active[a] || 0) < 3) Q.pick(a);
        if (["thunderhive", "blastwheel"].includes(result)) {
          while ((g.active[b] || 0) < 3) Q.pick(b);
        } else {
          while ((g.passive[b] || 0) < 2) Q.pick(b);
        }
        if (!Q.pick(result)) throw Error("Illegal fixture recipe " + result);
        for (let i = 0; i < 9; i++) {
          const angle = (i * Math.PI * 2) / 9;
          Q.enemy(
            "tank",
            g.p.x + Math.cos(angle) * 65,
            g.p.y + Math.sin(angle) * 65,
            4000,
          );
        }
        const label = document.getElementById("footHint");
        label.hidden = false;
        label.textContent = "QA 武器靶场 · " + result;
      },
      [a, b, result],
    );
    if (result === "reactiveaegis") {
      await page.waitForTimeout(100);
      await page.evaluate(() => SurvivorQA.forceDamage(1));
    }
    await page.waitForTimeout(2200);
    await page.screenshot({ path: path.join(output, `qa-${result}.png`) });
    await page.waitForTimeout(2600);
    const row = await page.evaluate(() => {
      const g = SurvivorDemo.state();
      return {
        active: g.active,
        evolved: g.evolved,
        fused: g.fused,
        damage: g.metrics.damage,
        shieldBlocks: g.metrics.shieldsBlocked,
      };
    });
    report.rows.push({ id: result, ...row });
  }
  const video = page.video();
  await context.close();
  await video.saveAs(path.join(output, "qa-eight-weapons.webm"));
  fs.writeFileSync(
    path.join(output, "qa-weapons.json"),
    JSON.stringify(report, null, 2),
  );
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    if (process.argv.includes("--qa-only")) await qa(browser);
    else {
      await natural(browser);
      await qa(browser);
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
