const { test, expect } = require("@playwright/test");

test("first voyage and compact equipment choices", async ({page}) => {
  await page.goto("./?qa=1");
  await expect(page.locator("#start h1")).toHaveText("星海突进");
  await expect(page.locator("#recordText")).toHaveText("第一次出航");
  await expect(page.locator("#buildStamp")).toHaveText("v0.6.11");
  await page.locator("#startBtn").click();
  await page.evaluate(() => window.SurvivorQA.level());
  await expect(page.locator("#fusionGuide")).toBeHidden();
  for (const card of await page.locator("[data-pick]").all()) {
    expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    const lines = await card.locator(":scope > div").evaluate(el =>
      [...el.children].reduce((sum, child) => {
        const range = document.createRange();
        range.selectNodeContents(child);
        return sum + range.getClientRects().length;
      }, 0));
    expect(lines).toBeLessThanOrEqual(4);
  }
});

test("unavailable database still allows a voyage", async ({page}) => {
  await page.addInitScript(() => Object.defineProperty(window, "indexedDB", {value: undefined}));
  await page.goto("./");
  await expect(page.locator("#saveStatus")).toContainText("本次进度不会保存");
  await page.locator("#startBtn").click();
  await expect(page.locator("#hud")).toBeVisible();
});

test("asset retry recovers the start button", async ({page}) => {
  await page.route(/actors\/skimmer(@|-)2x\.png/, route => route.abort(), {times: 1});
  await page.goto("./");
  await expect(page.locator("#saveStatus")).toContainText("素材没加载完整");
  await page.getByRole("button", {name: "重新加载"}).click();
  await expect(page.locator("#startBtn")).toBeEnabled();
});
