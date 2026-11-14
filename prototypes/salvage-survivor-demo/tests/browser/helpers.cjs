const { expect } = require("@playwright/test");
async function boot(page, qa = true) {
  await page.goto(qa ? "?qa=1" : "");
  await page.waitForFunction(() => window.SurvivorDemo?.ready());
}
async function start(page) {
  await page.locator("#startBtn").click();
  await page.waitForFunction(
    () => SurvivorDemo.state()?.mode === "play" && !SurvivorDemo.saving(),
  );
}
const state = (page) => page.evaluate(() => SurvivorDemo.state());
const stored = (page) =>
  page.evaluate(async () => {
    const store = await SurvivorPersistence.create({ qa: !!window.SurvivorQA });
    const result = (await store.read()).record;
    store.close();
    return result;
  });
async function pause(page) {
  await page.locator("#pauseBtn").click();
  await page.waitForFunction(
    () => SurvivorDemo.state()?.mode === "pause" && !SurvivorDemo.saving(),
  );
}
async function settle(page, credits = 150) {
  await page.evaluate(async (amount) => {
    SurvivorQA.state().credits = amount;
    await SurvivorQA.end(false);
  }, credits);
  await page.waitForFunction(() => !SurvivorDemo.saving());
  await expect(page.locator("#results")).toBeVisible();
}
module.exports = { boot, start, state, stored, pause, settle };
