import {expect, test, type Page} from '@playwright/test';
import {newGame} from '../../src/game/engine';
import {discoveries} from '../../src/content/catalog';
import {growthCatalog} from '../../src/game/growth';

const epoch = 1800000000000;
async function saved(page: Page) {
  return page.evaluate(() => new Promise<any>((resolve, reject) => {
    const request = indexedDB.open('loststar.fusion.v1', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('archive', 'readonly').objectStore('archive').get('current');
      get.onsuccess = () => {resolve(get.result); db.close();};
      get.onerror = () => reject(get.error);
    };
  }));
}
async function step(page: Page, milliseconds: number) {
  await page.clock.fastForward(Math.max(0, milliseconds - 300));
  await page.clock.runFor(Math.min(300, milliseconds));
  await expect.poll(async () => (await saved(page)).game.lastAt).toBeGreaterThanOrEqual(await page.evaluate(() => Date.now() - 500));
}
async function open(page: Page, legacy = false, basicCases = false) {
  await page.clock.install({time: new Date(epoch)});
  await page.clock.pauseAt(new Date(epoch + 1000));
  if (legacy) {
    const game = newGame(epoch + 1000);
    game.resources = 27049;
    game.collection = discoveries.map(d => d.id);
    game.seenDiscoveries = [...game.collection];
    game.upgrades = {radar: 5, scanner: 5, recycler: 5, cargo: 5};
    game.growth = Object.fromEntries(growthCatalog.map(g => [g.id, basicCases && g.id.startsWith('case-') ? 0 : g.costs.length]));
    await page.addInitScript(raw => {
      if (!localStorage.getItem('loststar.save.v1')) localStorage.setItem('loststar.save.v1', raw);
    }, JSON.stringify(game));
  }
  await page.goto('/?sample=fusion');
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  await page.clock.runFor(300);
}

test('融合：首屏短文案、助力实际排队、升级真实生效且无未知星球泄露', async ({page}) => {
  await open(page);
  const text = await page.locator('#fusion-app').innerText();
  expect((text.match(/[\u4e00-\u9fff]/g) ?? []).length).toBeLessThanOrEqual(80);
  expect(await page.locator('body').ariaSnapshot()).not.toMatch(/回声菌星|倒置海星|钟摆荒原星|无人游乐星|未签收之星|六颗|6颗/);
  const tap = page.locator('#fusion-tap');
  await tap.click();
  await expect.poll(async () => (await saved(page)).game.assist?.actionSeq).toBe(1);
  await step(page, 1300);
  await expect.poll(async () => (await saved(page)).game.assist.appliedWorkMs).toBeGreaterThan(0);
  await page.locator('#fusion-upgrades').click();
  await expect(page.locator('[data-upgrade="scanner"]')).toContainText('45');
  const before = await saved(page);
  await page.locator('[data-upgrade="scanner"]').click();
  await expect.poll(async () => (await saved(page)).game.upgrades.scanner).toBe(1);
  expect((await saved(page)).game.resources).toBe(before.game.resources - 45);
  await page.locator('#fusion-close').click();
  await step(page, 12000);
  await expect.poll(async () => (await saved(page)).game.collection.includes('receipt')).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('融合：旧档副本统一钱包、工程实际可用、基础整理权益完整', async ({page}) => {
  await open(page, true);
  const original = await page.evaluate(() => localStorage.getItem('loststar.save.v1'));
  expect((await saved(page)).game.resources).toBe(27049);
  expect((await saved(page)).receipt.condition).toBe('stabilized');
  await step(page, 2700);
  await page.locator('[data-tab="base"]').click();
  await expect(page.locator('#fusion-base-dock canvas')).toHaveAttribute('data-ready', 'true');
  await page.locator('[data-drawer="build"]').click();
  await page.locator('[data-project="evidence-bench"]').click();
  await expect.poll(async () => (await saved(page)).projects.includes('evidence-bench')).toBe(true);
  expect((await saved(page)).game.resources).toBe(25249);
  await expect(page.locator('#fusion-paper-focus')).toBeVisible();
  await page.clock.runFor(300);
  const normal = await page.locator('#fusion-paper-focus').screenshot();
  await page.locator('[data-light="side"]').click();
  await page.clock.runFor(300);
  expect(await page.locator('#fusion-paper-focus').screenshot()).not.toEqual(normal);
  expect(await page.evaluate(() => localStorage.getItem('loststar.save.v1'))).toBe(original);
});

test('融合：收据收起继续整理、费用与物理条件持久保存', async ({page}) => {
  await open(page);
  await step(page, 12500);
  await page.locator('[data-tab="collection"]').click();
  await page.locator('#fusion-collection-list [data-detail="receipt"]').click();
  await expect(page.locator('#fusion-paper-primary')).toBeEnabled();
  await page.locator('#fusion-paper-primary').click();
  await expect.poll(async () => (await saved(page)).receipt.activeAction?.kind).toBe('excavate');
  await page.locator('#fusion-close').click();
  await step(page, 6800);
  await page.locator('#fusion-collection-list [data-detail="receipt"]').click();
  await expect(page.locator('#fusion-paper-primary')).toHaveAttribute('data-kind', 'clean');
  await page.locator('#fusion-paper-primary').click();
  await expect.poll(async () => (await saved(page)).receipt.activeAction?.kind).toBe('clean');
  await step(page, 4300);
  const state = await saved(page);
  expect(state.receipt.condition).toBe('clean');
  expect(state.receipt.transactions).toHaveLength(1);
  expect(state.receipt.transactions[0].amount).toBe(40);
  expect(state.receipt.parts).toBe(state.game.resources);
  await page.reload();
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  expect((await saved(page)).receipt.condition).toBe('clean');
  expect((await saved(page)).receipt.transactions).toHaveLength(1);
});

test('融合：真实昼夜、损伤维修与离线成果一次领取', async ({page}) => {
  await open(page, true);
  await step(page, 234000);
  await expect(page.locator('#fusion-period')).toHaveText('黄昏');
  await step(page, 12000);
  await expect(page.locator('#fusion-period')).toHaveText('夜间');
  const night = await page.locator('#fusion-world canvas').screenshot();
  await step(page, 58000);
  await expect(page.locator('#fusion-period')).toHaveText('清晨');
  expect(await page.locator('#fusion-world canvas').screenshot()).not.toEqual(night);
  const settled = await saved(page);
  expect(settled.game.world.settledNights).toBe(1);
  expect(settled.records.some((r: any) => r.target === 'night')).toBe(true);
  await page.clock.setSystemTime(new Date(epoch + 86400000));
  await page.reload();
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#fusion-return-chip')).toBeVisible();
  await page.locator('#fusion-return-chip').click();
  await page.locator('#fusion-claim').click();
  await expect.poll(async () => (await saved(page)).game.pendingReturn).toBeNull();
  const after = (await saved(page)).game.resources;
  await page.reload();
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  expect((await saved(page)).game.resources).toBe(after);
  await expect(page.locator('#fusion-return-chip')).toBeHidden();
});

test('融合：两个标签同时建设只结算一次', async ({page, context}) => {
  await open(page, true);
  await step(page, 2700);
  const second = await context.newPage();
  const at = await page.evaluate(() => Date.now());
  await second.clock.install({time: new Date(at)});
  await second.clock.pauseAt(new Date(at));
  await second.goto('/?sample=fusion');
  await expect(second.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  for (const tab of [page, second]) {
    await tab.locator('[data-tab="base"]').click();
    await tab.locator('[data-drawer="build"]').click();
  }
  const firstBuy = await page.locator('[data-project="evidence-bench"]').elementHandle();
  const secondBuy = await second.locator('[data-project="evidence-bench"]').elementHandle();
  await Promise.all([firstBuy!.evaluate(button => (button as HTMLElement).click()), secondBuy!.evaluate(button => (button as HTMLElement).click())]);
  await expect.poll(async () => (await saved(page)).projects.includes('evidence-bench')).toBe(true);
  const state = await saved(page);
  expect(state.projects.filter((id: string) => id === 'evidence-bench')).toHaveLength(1);
  expect(state.game.resources).toBe(25249);
  await second.close();
});

test('融合：实际夜班归档可回放，重播复用场景且不重复结算', async ({page}) => {
  await open(page, true);
  await step(page, 310000);
  await page.locator('[data-tab="base"]').click();
  await page.locator('[data-drawer="build"]').click();
  await page.locator('[data-project="archive"]').click();
  await page.locator('#fusion-replay-night').click();
  const replay = page.locator('#fusion-archive-replay canvas');
  await expect(replay).toHaveAttribute('data-ready', 'true');
  const before = await saved(page);
  await step(page, 10000);
  await expect(page.locator('#fusion-replay-status')).toContainText('处置回放');
  const after = await saved(page);
  expect(after.game.resources - before.game.resources).toBe(after.game.station.grossIncome - before.game.station.grossIncome - after.game.station.repairSpent + before.game.station.repairSpent);
  expect(after.game.world.settledNights).toBe(before.game.world.settledNights);
  const node = await replay.elementHandle();
  await page.locator('#fusion-replay-night').click();
  expect(await node!.evaluate(canvas => canvas === document.querySelector('#fusion-archive-replay canvas'))).toBe(true);
});


test('融合：展柜付款后立即看真实前后近景，反复切换不重复扣费', async ({page}) => {
  await open(page, true, true);
  await page.locator('[data-tab="base"]').click();
  await page.locator('[data-drawer="build"]').click();
  await page.locator('summary', {hasText: '展柜'}).click();
  const before = await saved(page);
  await page.locator('[data-growth="case-0"]').click();
  const preview = page.locator('#fusion-case-preview');
  await page.clock.runFor(300);
  await expect(preview).toHaveAttribute('data-ready', 'true');
  expect((await saved(page)).game.resources).toBe(before.game.resources - 160);
  await page.locator('[data-case-preview="0"]').click();
  await page.clock.runFor(150);
  const old = await preview.screenshot();
  await page.locator('[data-case-preview="1"]').click();
  await page.clock.runFor(150);
  expect(await preview.screenshot()).not.toEqual(old);
  expect((await saved(page)).game.resources).toBe(before.game.resources - 160);
  await page.locator('#fusion-return-build').click();
  await expect(page.locator('#fusion-drawer-title')).toHaveText('基地建设');
});

test('融合：慢加载时显示接通状态，空场景点击不会提前排入助力', async ({page}) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  await page.route('**/*.webp', async route => {
    if (route.request().resourceType() === 'image' && route.request().url().includes('parcel-globe')) await gate;
    await route.continue();
  });
  await page.goto('/?sample=fusion', {waitUntil: 'domcontentloaded'});
  await expect(page.locator('#fusion-tap')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('#fusion-tap-hint')).toContainText('接通');
  await page.locator('#fusion-tap').dispatchEvent('keydown', {key: 'Enter', repeat: false});
  expect((await saved(page)).game.assist).toBeUndefined();
  release();
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#fusion-tap')).toHaveAttribute('aria-disabled', 'false');
});
