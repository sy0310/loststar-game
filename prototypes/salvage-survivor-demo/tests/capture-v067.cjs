/* Labelled QA recordings of the actual frozen HTTP package. */
const { chromium } = require("@playwright/test"),
  fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const url = process.env.SURVIVOR_URL || "http://127.0.0.1:4437/",
  out = path.resolve(
    process.env.SURVIVOR_CAPTURE_OUT || "artifacts/survivor-v067",
  );
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let captureBrowser;
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  captureBrowser = browser;
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    recordVideo: {
      dir: path.join(out, "raw"),
      size: { width: 390, height: 844 },
    },
  });
  const page = await context.newPage(),
    errors = [],
    report = {
      qa: true,
      scope:
        "Explicit loadout, health, reward and rich-wallet QA fixtures. Real-time controller and actual purchase UI. No natural-play claim.",
      scenes: [],
      errors,
    };
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(url + "?qa=1");
  await page.waitForFunction(() => SurvivorDemo.ready());
  report.source = await page.evaluate(() => SurvivorBuild);
  await page.locator("#startBtn").click();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  async function setup() {
    await page.evaluate(() => {
      const Q = SurvivorQA,
        g = Q.startModel(91);
      g.spawnTime = 9999;
      g.p.inv = 9999;
      g.encounters.schedule = [];
    });
  }
  async function shot(name, seconds = 2) {
    await wait(seconds * 1000);
    await page.screenshot({ path: path.join(out, name + ".png") });
    report.scenes.push({
      name,
      ...(await page.evaluate(() => {
        const g = SurvivorQA.state();
        return {
          time: g.time,
          hp: g.p.hp,
          active: g.active,
          passive: g.passive,
          engineering: g.engineering,
          orbits: SurvivorQA.orbits(),
          profile: SurvivorDemo.profile(),
        };
      })),
    });
  }
  await setup();
  await page.evaluate(() => {
    const g = SurvivorQA.state();
    g.active = { drone: 3, prism: 3, blade: 3 };
  });
  await shot("three-rings", 7);
  await setup();
  await page.evaluate(() => {
    const Q = SurvivorQA,
      g = Q.state();
    g.active = { cannon: 1, drone: 1 };
    g.passive = { lens: 1 };
    Q.reward(false);
    g.bossRewards.ids = [1];
    g.upgradeSource = {
      kind: "boss",
      id: 1,
      advancedRoll: false,
      loot: [
        { id: "cannon", kind: "active", from: 1, level: 2 },
        { id: "drone", kind: "active", from: 1, level: 2 },
        { id: "lens", kind: "passive", from: 1, level: 2 },
      ],
    };
    Q.refreshUpgrades();
  });
  await shot("three-different-icons", 4);
  await page.locator(".loot-cache").tap();
  await setup();
  await page.evaluate(() => {
    const Q = SurvivorQA,
      g = Q.state();
    Q.reward(false);
    g.bossRewards.ids = [1];
    g.upgradeSource = {
      kind: "boss",
      id: 1,
      advancedRoll: false,
      loot: [{ id: "cannon", kind: "active", from: 1, level: 4 }],
    };
    Q.refreshUpgrades();
  });
  await shot("three-repeat-icons", 4);
  await page.locator(".loot-cache").tap();
  await setup();
  await page.evaluate(() => {
    SurvivorQA.state().p.hp = 34;
    SurvivorQA.level();
  });
  await shot("healing-choice", 3);
  await page.locator(".skill").filter({ hasText: "自动维修舱" }).tap();
  await shot("repair-pod-level1", 16);
  await page.evaluate(() => {
    const Q = SurvivorQA;
    for (let i = 1; i < 5; i++) Q.pick("repairpod");
    Q.state().p.hp = 40;
  });
  await shot("repair-pod-level5-before", 0.1);
  await shot("repair-pod-level5-after", 10);
  // Finance fixtures use the real persistent run, separate from prior memory-only art presets.
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  await page.locator("#startBtn").tap();
  await page.waitForFunction(
    () => SurvivorDemo.state()?.persisted && !SurvivorDemo.saving(),
  );
  await page.evaluate(async () => {
    const g = SurvivorQA.state();
    g.credits = 27049;
    await SurvivorQA.end(false);
  });
  await page.waitForFunction(() => !SurvivorDemo.saving());
  await page.locator("#resultDockBtn").tap();
  await shot("dock-before", 2);
  for (let level = 0; level < 6; level++)
    for (const id of ["thrusters", "salvage", "plating"]) {
      await page.locator('[data-engineering="' + id + '"]').tap();
      await page.waitForFunction(() => !SurvivorDemo.saving());
      await wait(560);
    }
  await shot("dock-max", 3);
  assert.equal(
    (await page.evaluate(() => SurvivorDemo.profile())).credits,
    6649,
  );
  await page.locator("#launchWeapon").selectOption("prism");
  await page.locator("#bookLaunchBtn").tap();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  await shot("launch-reserved", 2);
  await page.locator("#closeDockBtn").tap();
  await page.locator("#retryBtn").tap();
  await page.waitForFunction(
    () => SurvivorDemo.state()?.mode === "play" && !SurvivorDemo.saving(),
  );
  await page.keyboard.down("d");
  await wait(1200);
  await page.keyboard.up("d");
  await shot("prepared-departure", 4);
  assert.equal(errors.length, 0);
  fs.writeFileSync(
    path.join(out, "qa-report.json"),
    JSON.stringify(report, null, 2),
  );
  const video = page.video();
  await context.close();
  await video.saveAs(path.join(out, "qa-silent.webm"));
  await browser.close();
})().catch(async (e) => {
  console.error(e);
  await captureBrowser?.close();
  process.exitCode = 1;
});
