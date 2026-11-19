const { test, expect } = require('@playwright/test');
const { boot, start, pause, stored, state } = require('../../tests/browser/helpers.cjs');

async function audit(page) {
  const issues = await page.evaluate(() => {
    const untranslated = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (!node.parentElement.closest('script,style,[data-i18n-skip]') && /[\u3400-\u9fff]/.test(node.textContent))
        untranslated.push(node.textContent);
    }
    return {
      untranslated,
      missing: SurvivorI18n.missing(),
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  expect(issues).toEqual({ untranslated: [], missing: [], overflow: false });
}

test('English defaults, Chinese switch restores original UI and refresh keeps preference', async ({ page }) => {
  await boot(page, false);
  await expect(page.locator('#startBtn')).toHaveText('Start Run');
  await audit(page);
  const before = await stored(page);
  await page.locator('#start [data-language-toggle]').tap();
  await expect(page.locator('#startBtn')).toHaveText('开始一局');
  expect((await stored(page)).profile).toEqual(before.profile);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect(await page.evaluate(() => SurvivorI18n.getLocale())).toBe('zh-CN');
  await page.locator('#start [data-language-toggle]').tap();
  await expect(page.locator('#startBtn')).toHaveText('Start Run');
  await audit(page);
});

test('Refits, starting weapons and prices remain bilingual without changing credits', async ({ page }) => {
  await boot(page, false);
  const before = await stored(page);
  await page.locator('#dockBtn').tap();
  await expect(page.locator('#dock')).toContainText('60 Parts');
  await expect(page.locator('#dock')).toContainText('550 Parts');
  await audit(page);
  await page.locator('#chooseLaunchBtn').tap();
  await expect(page.locator('#launchPicker')).toContainText('Starting Weapon');
  await expect(page.locator('#launchPicker')).toContainText('Warp Prism');
  await audit(page);
  await page.locator('[data-launch-weapon="prism"]').tap();
  await expect(page.locator('#bookLaunchBtn')).toContainText('200 Parts');
  await expect(page.locator('#bookLaunchBtn')).toBeDisabled();
  expect((await stored(page)).profile).toEqual(before.profile);
});

test('Real movement, native pause, language switch and reload preserve the suspended run', async ({ page }) => {
  await boot(page, false);
  await start(page);
  const before = await state(page);
  await page.mouse.move(180, 690);
  await page.mouse.down();
  await page.mouse.move(240, 720, { steps: 15 });
  await page.waitForTimeout(1500);
  await page.mouse.up();
  const after = await state(page);
  expect(Math.hypot(after.p.x - before.p.x, after.p.y - before.p.y)).toBeGreaterThan(30);
  await page.evaluate(() => window.dispatchEvent(new Event('lostship:native-pause')));
  await page.waitForFunction(() => SurvivorDemo.state().mode === 'pause' && !SurvivorDemo.saving());
  const checkpoint = await stored(page);
  await page.locator('#pause [data-language-toggle]').tap();
  await expect(page.locator('#resumeBtn')).toHaveText('继续战斗');
  await page.locator('#pause [data-language-toggle]').tap();
  await expect(page.locator('#resumeBtn')).toHaveText('Resume Battle');
  expect((await stored(page)).active.snapshot).toEqual(checkpoint.active.snapshot);
  await audit(page);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  await page.locator('#continueBtn').tap();
  await pause(page);
  expect((await state(page)).time).toBeGreaterThanOrEqual(checkpoint.active.snapshot.game.time);
  expect((await stored(page)).profile).toEqual(checkpoint.profile);
  await audit(page);
});

test('Saved upgrade cards and rerolls keep canonical IDs across languages', async ({ page }) => {
  await boot(page);
  await start(page);
  await page.evaluate(() => SurvivorQA.level());
  await page.waitForFunction(() => !SurvivorDemo.saving());
  await expect(page.locator('#upgradeTitle')).toHaveText('Level Up');
  await audit(page);
  const saved = await stored(page);
  await page.evaluate(() => SurvivorI18n.setLocale('zh-CN'));
  await expect(page.locator('#upgradeTitle')).toHaveText('等级提升');
  expect((await stored(page)).active.snapshot).toEqual(saved.active.snapshot);
  await page.evaluate(() => SurvivorI18n.setLocale('en'));
  await page.locator('#rerollBtn').tap();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  const choices = (await state(page)).presented;
  expect((await state(page)).rerollsRemaining).toBe(2);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  await page.locator('#continueBtn').tap();
  await page.waitForFunction(() => SurvivorDemo.state()?.mode === 'upgrade' && !SurvivorDemo.saving());
  expect((await state(page)).presented).toEqual(choices);
  await expect(page.locator('#rerollBtn')).toBeEnabled();
  await expect(page.locator('#rerollBtn')).toContainText('2');
  await page.locator('#rerollBtn').tap();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  expect((await state(page)).rerollsRemaining).toBe(1);
  await audit(page);
  await page.locator('[data-pick="0"]').tap();
  await page.waitForFunction(() => SurvivorDemo.state()?.mode === 'play' && !SurvivorDemo.saving());
});

test('Evolution, fusion, elite grants and results render in English with original rules', async ({ page }) => {
  await boot(page);
  await start(page);
  await page.evaluate(async () => {
    const Q = SurvivorQA, g = Q.state();
    g.spawnTime = 9999;
    function pick(id) { if (!Q.pick(id)) throw Error('Illegal fixture ' + id); }
    function rank(id) { while ((g.active[id] || g.passive[id] || 0) < 5) pick(id); }
    rank('prism'); rank('refraction'); Q.reward(true); pick('kaleidoscope');
    rank('gravity'); rank('singularity'); Q.reward(true); pick('collapse');
    Q.reward(true); await Q.save(); await Q.settled();
  });
  await expect(page.locator('#upgradeList')).toContainText('Event Horizon');
  await expect(page.locator('#upgradeList')).toContainText('Ultimate Fusion');
  await audit(page);
  await page.evaluate(() => SurvivorQA.pick('eventhorizon'));
  expect((await state(page)).fused.eventhorizon).toBe(true);
  await page.evaluate(async () => { await SurvivorQA.end(false); });
  await page.waitForFunction(() => !SurvivorDemo.saving());
  await expect(page.locator('#results')).toContainText('Run Saved');
  await audit(page);
  const result = await stored(page);
  await page.evaluate(() => SurvivorI18n.setLocale('zh-CN'));
  await expect(page.locator('#resultState')).toHaveText('本局已归档');
  expect((await stored(page)).profile).toEqual(result.profile);
});
