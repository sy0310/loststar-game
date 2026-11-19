const { test, expect } = require("@playwright/test");
const { boot, start, stored } = require("./helpers.cjs");

test("first voyage and compact equipment choices", async ({ page }) => {
  await page.goto("./?qa=1");
  await expect(page.locator("#start h1")).toHaveText("星海突进");
  await expect(page.locator("#recordText")).toHaveText("第一次出航");
  await expect(page.locator("#buildStamp")).toHaveText("v0.6.11");
  await start(page);
  await page.evaluate(() => window.SurvivorQA.level());
  await expect(page.locator("[data-pick]")).toHaveCount(3);
  await expect(page.locator("#fusionGuide")).toBeHidden();
  for (const card of await page.locator("[data-pick]").all()) {
    expect(
      await card.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    ).toBe(true);
    const lines = await card.locator(":scope > div").evaluate((el) =>
      [...el.children].reduce((sum, child) => {
        const range = document.createRange();
        range.selectNodeContents(child);
        return sum + range.getClientRects().length;
      }, 0),
    );
    expect(lines).toBeLessThanOrEqual(4);
  }
});

test("unavailable database still allows a voyage", async ({ page }) => {
  await page.addInitScript(() =>
    Object.defineProperty(window, "indexedDB", { value: undefined }),
  );
  await boot(page);
  await expect(page.locator("#saveStatus")).toContainText("本次进度不会保存");
  await start(page);
  await page.evaluate(() => SurvivorQA.level());
  await page.locator("[data-pick]").first().click();
  await page.waitForFunction(
    () => SurvivorDemo.state().mode === "play" && !SurvivorDemo.saving(),
  );
  await page.evaluate(async () => {
    SurvivorQA.state().credits = 60;
    await SurvivorQA.end(false);
  });
  await expect(page.locator("#resultPerkHint")).toContainText(
    "可以强化 船体加固",
  );
  await expect(page.locator("#upgradeHullBtn")).toHaveClass(/affordable/);
  await page.locator("#upgradeHullBtn").click();
  await expect
    .poll(() => page.evaluate(() => SurvivorDemo.profile().hull))
    .toBe(1);
  expect(await page.evaluate(() => SurvivorDemo.profile().credits)).toBe(0);
  await page.reload();
  await expect(page.locator("#recordText")).toHaveText("第一次出航");
});

test("asset retry recovers the start button", async ({ page }) => {
  await page.route(/actors\/skimmer(@|-)2x\.png/, (route) => route.abort(), {
    times: 1,
  });
  await page.goto("./");
  await expect(page.locator("#saveStatus")).toContainText("素材没加载完整");
  await page.getByRole("button", { name: "重新加载" }).click();
  await expect(page.locator("#startBtn")).toBeEnabled();
});

test("magnetized XP and onboarding rules persist through a real reload", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await page.evaluate(async () => {
    const g = SurvivorQA.state();
    g.pickups = [
      { x: 600, y: 0, type: "xp", t: 2, value: 8, magnetized: true },
    ];
    g.mode = "pause";
    await SurvivorQA.save();
  });
  const before = (await stored(page)).active.snapshot.game;
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  const saved = (await stored(page)).active.snapshot.game;
  expect(saved.rules.onboardingVersion).toBe(1);
  expect(saved.pickups).toEqual(before.pickups);
  await page.locator("#continueBtn").click();
  await page.waitForFunction(() => SurvivorDemo.state()?.mode === "play");
  expect(
    await page.evaluate(() =>
      SurvivorDemo.state().pickups.some((p) => p.magnetized),
    ),
  ).toBe(true);
});
