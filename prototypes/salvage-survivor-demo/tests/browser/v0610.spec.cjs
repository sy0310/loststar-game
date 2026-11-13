const { test, expect } = require("@playwright/test");
const { boot, start, state, stored } = require("./helpers.cjs");
async function prepare(page, seconds, hp = 10, maxhp = 100, legacy = false) {
  await boot(page);
  await start(page);
  await page.evaluate(
    async ({ seconds, hp, maxhp, legacy }) => {
      const Q = SurvivorQA,
        g = Q.state();
      g.spawnTime = 9999;
      g.enemy = [];
      g.encounters.schedule = [];
      g.time = seconds;
      g.anomalySeen = true;
      g.milestoneSeen = SurvivorBalance.showcase.milestones.map(
        (m) => m.type + ":" + m.at,
      );
      g.p.hp = hp;
      g.p.maxhp = maxhp;
      if (legacy) delete g.rules.repairScalingVersion;
      Q.level();
      await Q.save();
      await Q.settled();
    },
    { seconds, hp, maxhp, legacy },
  );
  await page.waitForFunction(() => !SurvivorDemo.saving());
}
test("v0610 late repair card displays56 and one touch restores56 through refresh", async ({
  page,
}) => {
  await prepare(page, 600);
  const card = page.locator(".skill").filter({ hasText: "船体修补" });
  await expect(card).toContainText("恢复56船体");
  const before = await stored(page);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  await page.locator("#continueBtn").tap();
  await expect(card).toContainText("恢复56船体");
  await card.tap();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  const g = await state(page);
  expect(g.p.hp).toBe(66);
  expect(g.credits).toBe(0);
  expect(g.active).toEqual(before.active.snapshot.game.active);
  await expect(page.locator("#toast")).toContainText("船体修复＋56");
});
test("v0610 hull upgrade scales repair and caps the shown actual amount", async ({
  page,
}) => {
  await prepare(page, 600, 10, 148);
  const card = page.locator(".skill").filter({ hasText: "船体修补" });
  await expect(card).toContainText("恢复83船体");
  await card.tap();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  expect((await state(page)).p.hp).toBe(93);
});
test("v0610 selection pauses the growth clock and duplicate touch cannot grant twice", async ({
  page,
}) => {
  await prepare(page, 300);
  const before = await state(page);
  await page.waitForTimeout(650);
  expect((await state(page)).time).toBe(before.time);
  await page.locator(".skill").filter({ hasText: "船体修补" }).dblclick();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  expect((await state(page)).p.hp).toBe(52);
  await page.locator("#pauseBtn").tap();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  const saved = await stored(page);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect(await stored(page)).toEqual(saved);
});
test("v0610 legacy rule8 save keeps the original fixed28 and no migration charges", async ({
  page,
}) => {
  await prepare(page, 600, 10, 100, true);
  const before = await stored(page);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect(await stored(page)).toEqual(before);
  await page.locator("#continueBtn").tap();
  const card = page.locator(".skill").filter({ hasText: "船体修补" });
  await expect(card).toContainText("恢复28船体");
  await card.tap();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  expect((await state(page)).p.hp).toBe(38);
  expect((await stored(page)).profile.credits).toBe(before.profile.credits);
});
