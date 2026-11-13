const { test, expect } = require("@playwright/test");
const { boot, start, state, stored, settle } = require("./helpers.cjs");
async function funded(page, credits = 27049) {
  await boot(page);
  await start(page);
  await settle(page, credits);
}
async function dock(page) {
  expect(await page.locator("#resultDockBtn").count()).toBe(1);
  await page.locator("#resultDockBtn").click();
  await expect(page.locator("#dock")).toBeVisible();
}

test("v067 three lottery gains expose three real images and labels including repeated equipment", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await page.evaluate(async () => {
    const Q = SurvivorQA,
      g = Q.state();
    g.spawnTime = 9999;
    g.p.inv = 9999;
    g.active = { cannon: 1 };
    g.bossRewards.ids = [1];
    g.upgradeSource = {
      kind: "boss",
      id: 1,
      advancedRoll: false,
      loot: [{ id: "cannon", kind: "active", from: 1, level: 4 }],
    };
    Q.refreshUpgrades();
    await Q.save();
    await Q.settled();
  });
  await expect(page.locator(".loot-award")).toHaveCount(3);
  await expect(page.locator(".loot-award img")).toHaveCount(3);
  expect(await page.locator(".loot-award").allTextContents()).toEqual([
    "＋1",
    "＋1",
    "＋1",
  ]);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  await page.locator("#continueBtn").click();
  await expect(page.locator(".loot-award img")).toHaveCount(3);
  await page.locator(".loot-cache").tap();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  expect((await state(page)).active.cannon).toBe(4);
});
test("v067 repair occupies weapon slot and fractional recovery survives actual refresh without offline healing", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  const before = await page.evaluate(async () => {
    const Q = SurvivorQA,
      g = Q.state();
    g.spawnTime = 9999;
    g.p.inv = 9999;
    g.p.hp = 40;
    if (!Q.pick("repairpod")) throw Error("Repair missing");
    Q.step(2);
    g.mode = "pause";
    await Q.save();
    await Q.settled();
    return { hp: g.p.hp, active: g.active };
  });
  expect(before.hp).toBeGreaterThanOrEqual(40.5);
  expect(Object.keys(before.active)).toHaveLength(2);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  const record = await stored(page);
  expect(record.active.snapshot.game.p.hp).toBe(before.hp);
  expect(record.active.snapshot.game.active.repairpod).toBe(1);
});
test("v067 engineering from27049 buys real speed and survives refresh with exact account balance", async ({
  page,
}) => {
  await funded(page);
  await dock(page);
  await page.locator('[data-engineering="thrusters"]').tap();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  expect((await stored(page)).profile.credits).toBe(26749);
  expect((await stored(page)).profile.engineering.thrusters).toBe(1);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect((await stored(page)).profile.credits).toBe(26749);
  await page.locator("#retryBtn").tap();
  await page.waitForFunction(
    () => SurvivorDemo.state()?.mode === "play" && !SurvivorDemo.saving(),
  );
  expect((await state(page)).p.speed).toBeCloseTo(178.5, 4);
});
test("v067 failed and concurrent engineering writes retain funds and accept only one exact tier", async ({
  page,
}) => {
  await funded(page);
  await dock(page);
  const r = await page.evaluate(async () => {
    const s = await SurvivorPersistence.create({ qa: true });
    const results = await Promise.allSettled([
      s.buyEngineering("plating", 0),
      s.buyEngineering("plating", 0),
    ]);
    const record = (await s.read()).record;
    s.close();
    return { statuses: results.map((r) => r.status), profile: record.profile };
  });
  expect(r.statuses.sort()).toEqual(["fulfilled", "rejected"]);
  expect(r.profile.credits).toBe(26749);
  expect(r.profile.engineering.plating).toBe(1);
});
test("v067 launch reservation cancellation refunds once and successful launch consumes the chosen weapon once", async ({
  page,
}) => {
  await funded(page);
  await dock(page);
  await page.locator("#launchWeapon").selectOption("prism");
  await page.locator("#bookLaunchBtn").tap();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  expect((await stored(page)).profile.credits).toBe(26849);
  await page.locator("#cancelLaunchBtn").tap();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  expect((await stored(page)).profile.credits).toBe(27049);
  await page.waitForTimeout(560);
  await page.locator("#bookLaunchBtn").tap();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect((await stored(page)).profile.launchPlan.weapon).toBe("prism");
  await page.locator("#retryBtn").tap();
  await page.waitForFunction(
    () => SurvivorDemo.state()?.mode === "play" && !SurvivorDemo.saving(),
  );
  expect((await state(page)).active).toEqual({ prism: 1 });
  expect((await stored(page)).profile.launchPlan).toBeUndefined();
  expect((await stored(page)).profile.credits).toBe(26849);
  await page.locator("#pauseBtn").tap();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  const before = await stored(page);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect(await stored(page)).toEqual(before);
});

test("v067 aborted engineering purchase and repeated cancellation retain an exact transaction ledger", async ({
  page,
}) => {
  await funded(page);
  await dock(page);
  const result = await page.evaluate(async () => {
    const s = await SurvivorPersistence.create({ qa: true }),
      before = (await s.read()).record,
      put = IDBObjectStore.prototype.put;
    let rejected = false;
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === "current")
        throw new DOMException(
          "QA engineering write failure",
          "QuotaExceededError",
        );
      return put.apply(this, arguments);
    };
    try {
      await s.buyEngineering("salvage", 0);
    } catch {
      rejected = true;
    } finally {
      IDBObjectStore.prototype.put = put;
    }
    const aborted = (await s.read()).record;
    await s.bookLaunch("arc");
    const cancellations = await Promise.allSettled([
      s.cancelLaunch("arc"),
      s.cancelLaunch("arc"),
    ]);
    const after = (await s.read()).record;
    s.close();
    return {
      before,
      aborted,
      rejected,
      statuses: cancellations.map((x) => x.status),
      after,
    };
  });
  expect(result.rejected).toBe(true);
  expect(result.aborted).toEqual(result.before);
  expect(result.statuses.sort()).toEqual(["fulfilled", "rejected"]);
  expect(result.after.profile.credits).toBe(27049);
  expect(result.after.profile.launchPlan).toBeUndefined();
});
