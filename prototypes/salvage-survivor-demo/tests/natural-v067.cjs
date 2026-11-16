/* Fixed-package recordings. Ordinary input and labelled QA fixtures are separate. */
const { chromium } = require("@playwright/test");
const { steer, inputDirections } = require("./capture-v065.cjs");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const url = process.env.SURVIVOR_URL || "http://127.0.0.1:4437/";
const output = path.resolve(
  process.env.SURVIVOR_CAPTURE_OUT || "artifacts/survivor-v067",
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const priority = [
  "星舰壁垒",
  "贯星轨炮",
  "脉冲主炮",
  "聚能透镜",
  "反应壁垒",
  "离子护盾",
  "反应装甲",
  "装载全部强化",
  "自动维修舱",
  "猎手蜂群",
  "护航无人机",
  "锁定芯片",
  "电弧线圈",
  "超导电容",
];
async function ordinary(browser) {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    recordVideo: {
      dir: path.join(output, "raw"),
      size: { width: 390, height: 844 },
    },
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(url);
  await page.waitForFunction(() => SurvivorDemo.ready());
  assert(await page.evaluate(() => !window.SurvivorQA));
  const report = {
    source: await page.evaluate(() => SurvivorBuild),
    qa: false,
    imports: false,
    timeOrSeedOverride: false,
    scope:
      "Ordinary HTTP new game, automated visible-threat keyboard steering and actual card clicks. No state writes. This is not a human or phone skill result.",
    samples: [],
    choices: [],
    errors,
  };
  await page.locator("#startBtn").click();
  await page.waitForFunction(
    () => SurvivorDemo.state()?.mode === "play" && !SurvivorDemo.saving(),
  );
  let direction = -1,
    held = [],
    nextSample = 0;
  const began = Date.now();
  while (Date.now() - began < 1100 * 1000) {
    const g = await page.evaluate(() => SurvivorDemo.state());
    if (g.mode === "results") {
      report.result = g.result;
      break;
    }
    if (g.mode === "upgrade") {
      for (const key of held) await page.keyboard.up(key);
      held = [];
      const cards = page.locator(".skill"),
        labels = await cards.allTextContents();
      let selected =
        g.p.hp / g.p.maxhp < 0.35
          ? labels.findIndex((text) => text.includes("船体修补"))
          : -1;
      if (selected < 0)
        for (const name of priority) {
          selected = labels.findIndex((text) => text.includes(name));
          if (selected >= 0) break;
        }
      if (selected < 0) selected = 0;
      report.choices.push({
        at: g.time,
        label: labels[selected],
        source: g.upgradeSource,
      });
      await cards.nth(selected).click();
      await page.waitForFunction(() => !SurvivorDemo.saving());
    } else if (g.mode === "play") {
      direction = steer(g, direction);
      const wanted = inputDirections[direction];
      for (const key of held)
        if (!wanted.includes(key)) await page.keyboard.up(key);
      for (const key of wanted)
        if (!held.includes(key)) await page.keyboard.down(key);
      held = wanted;
      if (g.time >= nextSample) {
        report.samples.push({
          at: g.time,
          hp: g.p.hp,
          kills: g.kills,
          active: g.active,
          passive: g.passive,
          rewardIds: g.bossRewards.ids,
        });
        nextSample += 30;
        if (g.time >= 140 && g.time <= 151)
          await page.screenshot({
            path: path.join(output, "natural-first-elite.png"),
          });
      }
      if (g.time >= 900) break;
    }
    await sleep(160);
  }
  for (const key of held) await page.keyboard.up(key);
  const last = await page.evaluate(() => SurvivorDemo.state());
  report.last = {
    time: last.time,
    mode: last.mode,
    hp: last.p.hp,
    kills: last.kills,
    metrics: last.metrics,
  };
  if (last.mode === "play") {
    await page.locator("#pauseBtn").click();
    await page.waitForFunction(() => !SurvivorDemo.saving());
  }
  const before = await page.evaluate(async () => {
    const s = await SurvivorPersistence.create();
    const r = (await s.read()).record;
    s.close();
    return r;
  });
  await page.screenshot({ path: path.join(output, "natural-final.png") });
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  const after = await page.evaluate(async () => {
    const s = await SurvivorPersistence.create();
    const r = (await s.read()).record;
    s.close();
    return r;
  });
  assert.deepEqual(after, before);
  report.refreshPreserved = true;
  if (before.active) {
    await page.locator("#continueBtn").click();
    await page.waitForFunction(() => !SurvivorDemo.saving());
    await sleep(800);
    await page.locator("#pauseBtn").click();
    await page.waitForFunction(() => !SurvivorDemo.saving());
    report.continued = await page.evaluate(() => ({
      at: SurvivorDemo.state().time,
      hp: SurvivorDemo.state().p.hp,
    }));
  }
  if (!before.active) {
    report.returnWallet = before.profile.credits;
    await page.locator("#resultDockBtn").tap();
    if (await page.locator('[data-engineering="thrusters"]').isEnabled()) {
      await page.locator('[data-engineering="thrusters"]').tap();
      await page.waitForFunction(() => !SurvivorDemo.saving());
      await sleep(560);
    }
    if (await page.locator("#bookLaunchBtn").isEnabled()) {
      await page.locator("#launchWeapon").selectOption("prism");
      await page.locator("#bookLaunchBtn").tap();
      await page.waitForFunction(() => !SurvivorDemo.saving());
    }
    report.preparedProfile = await page.evaluate(() => SurvivorDemo.profile());
    await page.screenshot({
      path: path.join(output, "natural-engineering.png"),
    });
    await page.locator("#closeDockBtn").tap();
    await page.locator("#retryBtn").tap();
    await page.waitForFunction(
      () => SurvivorDemo.state()?.mode === "play" && !SurvivorDemo.saving(),
    );
    await sleep(1000);
    await page.locator("#pauseBtn").tap();
    await page.waitForFunction(() => !SurvivorDemo.saving());
    report.nextRun = await page.evaluate(() => ({
      active: SurvivorDemo.state().active,
      engineering: SurvivorDemo.state().engineering,
      speed: SurvivorDemo.state().p.speed,
      profile: SurvivorDemo.profile(),
    }));
    const storedBefore = await page.evaluate(async () => {
      const s = await SurvivorPersistence.create();
      const r = (await s.read()).record;
      s.close();
      return r;
    });
    await page.reload();
    await page.waitForFunction(() => SurvivorDemo.ready());
    const storedAfter = await page.evaluate(async () => {
      const s = await SurvivorPersistence.create();
      const r = (await s.read()).record;
      s.close();
      return r;
    });
    assert.deepEqual(storedAfter, storedBefore);
    report.nextRunRefreshPreserved = true;
  }
  assert.equal(errors.length, 0);
  fs.writeFileSync(
    path.join(output, "natural-report.json"),
    JSON.stringify(report, null, 2),
  );
  const video = page.video();
  await context.close();
  await video.saveAs(path.join(output, "natural-silent.webm"));
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    await ordinary(browser);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
