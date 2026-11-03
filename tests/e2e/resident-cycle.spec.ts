import {test, expect} from '@playwright/test';
import {newGame, advance} from '../../src/game/engine';

test('昼夜对照中三居民归巢、休息、苏醒，沿用同一星球和原存档', async ({page}) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date(Date.now() + 1000));
  await page.goto('/?sample=night-d1');
  const canvas = page.locator('#d1-scene canvas');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await page.clock.runFor(100);
  await expect(canvas).toHaveAttribute('data-resident-mouse', 'sleeping');
  await expect(canvas).toHaveAttribute('data-resident-hermit', 'sheltering');
  await expect(canvas).toHaveAttribute('data-resident-tagbird', 'roosting');

  await page.locator('#d1-environment').click();
  await page.clock.runFor(100);
  await expect(canvas).toHaveAttribute('data-period', 'day');
  await expect(canvas).toHaveAttribute('data-resident-mouse', 'foraging');
  await page.clock.runFor(10000);
  await expect(canvas).toHaveAttribute('data-period', 'dusk');
  await expect(canvas).toHaveAttribute('data-resident-mouse', 'returning');
  await page.clock.runFor(6500);
  await expect(canvas).toHaveAttribute('data-period', 'night');
  await expect(canvas).toHaveAttribute('data-resident-mouse', 'sleeping');
  const rest = JSON.parse((await canvas.getAttribute('data-residents'))!);
  expect(rest.every((resident: {nightArt: boolean}) => resident.nightArt)).toBe(true);
  await page.clock.runFor(29000);
  await expect(canvas).toHaveAttribute('data-period', 'dawn');
  await expect(canvas).toHaveAttribute('data-resident-mouse', 'waking');
  await page.clock.runFor(8000);
  await expect(canvas).toHaveAttribute('data-period', 'day');
  await expect(canvas).toHaveAttribute('data-resident-tagbird', 'flying');
  expect(await canvas.count()).toBe(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('普通远征的动物跟随持久世界时钟跨夜并在刷新后保持作息', async ({page}) => {
  const now = Date.parse('2026-11-03T20:00:00Z');
  await page.clock.install({time: new Date(now - 1000)});
  await page.clock.pauseAt(new Date(now));
  const save = advance(newGame(now), now + 1000000);
  save.lastAt = save.world.lastAt = now;
  save.world.elapsedMs = 230000;
  save.world.settledNights = 0;
  save.seenDiscoveries = [...save.collection];
  await page.addInitScript(save => {
    if (!localStorage.getItem('loststar.save.v1')) {
      localStorage.setItem('loststar.save.v1', JSON.stringify(save));
    }
  }, save);
  await page.goto('/?start=expedition&review=1');
  const canvas = page.locator('#planet-scene canvas');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await page.clock.runFor(150);
  await expect(canvas).toHaveAttribute('data-period', 'dusk');
  await page.clock.fastForward(15000);
  await page.clock.runFor(150);
  await expect(canvas).toHaveAttribute('data-resident-hermit', 'sheltering');
  await page.reload();
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await page.clock.runFor(150);
  await expect(canvas).toHaveAttribute('data-period', 'night');
  await expect(canvas).toHaveAttribute('data-resident-tagbird', 'roosting');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('loststar.save.v1')!).collection);
  await page.clock.fastForward(57000);
  await page.clock.runFor(150);
  await expect(canvas).toHaveAttribute('data-period', 'dawn');
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('loststar.save.v1')!).collection);
  expect(after).toEqual(before);
});
