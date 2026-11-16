const { test, expect } = require("@playwright/test");
const { boot, start, state, stored } = require("./helpers.cjs");

test("v066 actual elite lottery persists its result and touch claims each level once", async ({
  page,
}, info) => {
  await boot(page);
  await start(page);
  await page.evaluate(async () => {
    const Q = SurvivorQA,
      game = Q.state();
    Q.legacyV066();
    game.spawnTime = 9999;
    game.p.inv = 9999;
    game.encounters.schedule = [];
    Q.pick("drone");
    Q.pick("lens");
    Q.pick("lock");
    Q.reward(false);
    await Q.save();
    await Q.settled();
  });
  await expect(page.locator("#upgradeTitle")).toHaveText(
    "精英战利品 · 随机强化",
  );
  const before = await stored(page);
  const labels = await page.locator(".skill").allTextContents();
  expect(labels.join("")).toContain("装载全部强化");
  const grants = before.active.snapshot.game.upgradeSource.loot;
  const total = grants.reduce((sum, item) => sum + item.level - item.from, 0);
  expect(total).toBeGreaterThanOrEqual(1);
  expect(total).toBeLessThanOrEqual(3);
  await page.screenshot({ path: info.outputPath("elite-lottery.png") });
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect(await stored(page)).toEqual(before);
  await page.locator("#continueBtn").click();
  await expect(page.locator("#upgrade")).toBeVisible();
  expect(await page.locator(".skill").allTextContents()).toEqual(labels);
  const button = page.locator(".loot-cache");
  await button.tap();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  await page.locator("#pauseBtn").tap();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  const claimed = await stored(page);
  for (const grant of grants)
    expect(claimed.active.snapshot.game[grant.kind][grant.id]).toBe(
      grant.level,
    );
  expect(claimed.active.snapshot.game.upgradeSource).toBeNull();
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect(await stored(page)).toEqual(claimed);
  await info.attach("committed-elite-reward", {
    body: Buffer.from(JSON.stringify({ before, claimed })),
    contentType: "application/json",
  });
});

test("v066 elite repair is visible on the real field and touch claim and real controller collect it once", async ({
  page,
}, info) => {
  await boot(page);
  await start(page);
  await page.evaluate(async () => {
    const Q = SurvivorQA,
      game = Q.state();
    Q.legacyV066();
    game.spawnTime = 9999;
    game.p.inv = 9999;
    game.encounters.schedule = [];
    game.p.hp = 50;
    Q.enemy("elite", 0, -250, 1);
    // Advance until the real kill opens its reward, independent of the first firing clock.
    for (let frame = 0; frame < 180 && game.mode === "play"; frame++)
      Q.step(1 / 60);
    if (game.mode !== "upgrade")
      throw Error("Actual elite reward did not open");
    // This is a labelled QA kill, not a natural-play claim.
    await Q.save();
    await Q.settled();
  });
  const source = (await state(page)).upgradeSource;
  expect(source.loot.length).toBeGreaterThan(0);
  await page.locator(".loot-cache").tap();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  // Hold beyond the original race window. The drop stays outside the legacy150 pull radius.
  await page.waitForTimeout(600);
  await page.locator("#pauseBtn").tap();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  const result = await page.evaluate(() => {
    const Q = SurvivorQA,
      game = Q.state();
    Q.legacyV066();
    const pack = game.pickups.find((item) => item.type === "heal");
    if (!pack) throw Error("Repair pack missing");
    game.active = {};
    game.pickups = [pack];
    game.camera = { ...game.p };
    Q.runRender();
    return { pack: { ...pack }, hp: game.p.hp };
  });
  expect(result.pack.value).toBe(24);
  await page.locator("#resumeBtn").tap();
  // Move the drop within the normal magnet reach, then let the real controller collect it.
  const healed = await page.evaluate(() => {
    const Q = SurvivorQA,
      game = Q.state(),
      pack = game.pickups[0];
    game.p.x = pack.x;
    game.p.y = pack.y;
    Q.step(0.01);
    Q.runRender();
    return { hp: game.p.hp, text: game.texts.map((item) => item.s) };
  });
  expect(healed.hp).toBe(result.hp + 24);
  expect(healed.text).toContain("船体 +24");
  await page.screenshot({ path: info.outputPath("repair-collected.png") });
  await page.evaluate(async () => {
    SurvivorQA.state().mode = "pause";
    await SurvivorQA.save();
    await SurvivorQA.settled();
  });
  const after = await stored(page);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect((await stored(page)).active.snapshot.game.p.hp).toBe(
    after.active.snapshot.game.p.hp,
  );
});

test("v066 small drone ellipse uses the same rendered and firing positions", async ({
  page,
}, info) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const Q = SurvivorQA,
      game = Q.startModel(91);
    Q.legacyV066();
    game.active = { drone: 1, prism: 1 };
    game.spawnTime = 9999;
    game.p.inv = 9999;
    game.encounters.schedule = [];
    Q.enemy("skimmer", 0, -240, 100000);
    Q.step(0.001);
    const shot = game.shots.find((item) => item.kind === "drone");
    const radius = Math.hypot(shot.x - game.p.x, shot.y - game.p.y);
    const calls = [],
      draw = SurvivorArt.draw;
    SurvivorArt.draw = function (ctx, id, x, y, options) {
      if (id === "drone_body") calls.push({ x, y });
      return draw.apply(this, arguments);
    };
    try {
      Q.runRender();
    } finally {
      SurvivorArt.draw = draw;
    }
    return { radius, calls, version: game.rules.combatVersion };
  });
  expect(result.version).toBe(5);
  expect(result.radius).toBeGreaterThan(100);
  expect(result.radius).toBeLessThan(121);
  expect(result.calls.length).toBeGreaterThan(0);
  await info.attach("drone-geometry", {
    body: Buffer.from(JSON.stringify(result)),
    contentType: "application/json",
  });
});
