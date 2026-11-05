import {expect, test, type Page} from '@playwright/test';

const epoch = 1800000000000;
const databaseName = 'loststar.fusion.firstplanet.v037';
test.use({hasTouch: true, isMobile: true});

async function saved(page: Page) {
  return page.evaluate(name => new Promise<any>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const get = database.transaction('archive', 'readonly').objectStore('archive').get('current');
      get.onsuccess = () => {resolve(get.result);database.close();};
      get.onerror = () => {reject(get.error);database.close();};
    };
  }), databaseName);
}
async function step(page: Page, milliseconds: number) {
  await page.clock.fastForward(Math.max(0, milliseconds - 300));
  await page.clock.runFor(Math.min(300, milliseconds));
  await expect.poll(async () => (await saved(page)).game.lastAt).toBeGreaterThanOrEqual(await page.evaluate(() => Date.now() - 500));
}
async function open(page: Page) {
  await page.clock.install({time: new Date(epoch)});
  await page.clock.pauseAt(new Date(epoch + 1000));
  await page.goto('/?sample=first-planet');
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  await page.clock.runFor(300);
  await page.locator('#fusion-dismiss-intro').tap();
}
async function receipt(page: Page) {
  await page.locator('[data-tab="collection"]').tap();
  await page.locator('#fusion-collection-list [data-detail="receipt"]').tap();
  await expect(page.locator('#fusion-paper-primary')).toBeVisible();
}

test('首星真触控事件：雾区仅实际工作揭露，点击只排队助力且种子位置刷新不变', async ({page}) => {
  await open(page);
  const before = await saved(page);
  const initial = await page.evaluate(() => (window as any).__FUSION__.surfaceMetrics());
  expect(initial.sites).toHaveLength(3);
  expect(initial.sites.every((site: any) => !site.name && !site.revealed)).toBe(true);
  await page.locator('#fusion-tap').tap();
  await expect.poll(async () => (await saved(page)).game.assist.actionSeq).toBe(1);
  expect((await saved(page)).game.resources).toBe(before.game.resources);
  await step(page, 20000);
  expect((await saved(page)).receipt.evidenceIds).toContain('field-pipe-scan');
  await step(page, 25000);
  const earned = await saved(page);
  expect(earned.journey.sites.every((site: any) => site.revealedAt !== null)).toBe(true);
  await page.reload();
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  const resumed = await saved(page);
  expect(resumed.journey).toEqual(earned.journey);
  expect(await page.locator('body').ariaSnapshot()).not.toMatch(/回声菌星|倒置海星|钟摆荒原星|无人游乐星|未签收之星|六颗|6颗/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('认可工作台走真实取出清理修补，触控试验可见、刷新不重复收费或补造签名', async ({page}) => {
  test.setTimeout(60000);
  await open(page);
  await step(page, 13000);
  await receipt(page);
  await expect(page.locator('#fusion-paper-focus')).toHaveAttribute('width', '640');
  await page.locator('#fusion-paper-primary').tap();
  await expect.poll(async () => (await saved(page)).receipt.activeAction?.kind).toBe('excavate');
  await step(page, 6500);
  const dirty = await page.locator('#fusion-paper-focus').screenshot();
  const beforeClean = await saved(page);
  await page.locator('#fusion-paper-primary').tap();
  await expect.poll(async () => (await saved(page)).receipt.activeAction?.kind).toBe('clean');
  expect((await saved(page)).game.resources).toBe(beforeClean.game.resources - 40);
  await page.reload();
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  await step(page, 4500);
  await receipt(page);
  expect((await saved(page)).receipt.condition).toBe('clean');
  expect(await page.locator('#fusion-paper-focus').screenshot()).not.toEqual(dirty);
  await page.locator('#fusion-close').tap();
  // Earn the repair fee through normal work. No fixture resources are inserted.
  for (let round = 0; round < 8; round++) await step(page, 12000);
  await receipt(page);
  const beforeRepair = await saved(page);
  await page.locator('#fusion-paper-primary').tap();
  await expect.poll(async () => (await saved(page)).receipt.activeAction?.kind).toBe('repair');
  await step(page, 4200);
  const repaired = await saved(page);
  expect(repaired.receipt.condition).toBe('stabilized');
  expect(repaired.receipt.transactions.map((entry: any) => entry.amount)).toEqual([40, 120]);
  expect(repaired.game.resources - beforeRepair.game.resources).toBe(repaired.game.station.grossIncome - beforeRepair.game.station.grossIncome - 120);
  expect(await page.locator('#fusion-paper-focus').screenshot()).not.toEqual(dirty);
  for (let attempt = 0; attempt < 2; attempt++) {
    const before = await saved(page);
    await page.locator('#fusion-try').tap();
    await expect.poll(async () => (await saved(page)).receipt.activeAction?.kind).toBe('try');
    await page.clock.runFor(120);
    await expect(page.locator('#fusion-paper-focus')).toHaveAttribute('data-restoration-phase', 'trying');
    const beforeFrame = await page.locator('#fusion-paper-focus').screenshot();
    await page.clock.runFor(350);
    expect(await page.locator('#fusion-paper-focus').screenshot()).not.toEqual(beforeFrame);
    await step(page, 2600);
    const after = await saved(page);
    expect(after.game.resources - before.game.resources).toBe(after.game.station.grossIncome - before.game.station.grossIncome);
    expect(after.receipt.transactions).toEqual(before.receipt.transactions);
  }
  await expect(page.locator('#fusion-paper-evidence')).toContainText('签收记录仍待证');
  await page.reload();
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  expect((await saved(page)).receipt.transactions).toHaveLength(2);
});

test('首星十二项实得收藏、六件玻璃近景与试验，夜间同场结算且离线只领一次', async ({page}) => {
  test.setTimeout(60000);
  await open(page);
  await step(page, 245000);
  await expect(page.locator('#fusion-period')).toHaveText('夜间');
  const world = await page.locator('#fusion-world canvas').elementHandle();
  await step(page, 60000);
  await expect(page.locator('#fusion-period')).toHaveText('清晨');
  expect(await world!.evaluate(canvas => canvas === document.querySelector('#fusion-world canvas'))).toBe(true);
  expect((await saved(page)).game.world.settledNights).toBe(1);
  const nightRepair = (await saved(page)).game.station.repairSpent;
  await page.reload();
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  expect((await saved(page)).game.station.repairSpent).toBe(nightRepair);
  await step(page, 3600000);
  await page.locator('#fusion-return-chip').tap();
  await page.locator('#fusion-claim').tap();
  await expect.poll(async () => (await saved(page)).game.pendingReturn).toBeNull();
  expect((await saved(page)).game.collection).toHaveLength(12);
  await page.locator('[data-tab="base"]').tap();
  await expect(page.locator('#fusion-base-dock canvas')).toHaveAttribute('data-ready', 'true');
  await page.clock.runFor(1000);
  expect(await page.locator('#fusion-habitats [data-detail]').count()).toBe(3);
  await page.locator('[data-tab="collection"]').tap();
  for (const id of ['tape', 'nested', 'stamp', 'cosmic-parcel', 'bell']) {
    await page.locator(`#fusion-collection-list [data-detail="${id}"]`).tap();
    await expect(page.locator('#fusion-exhibit-focus')).toBeVisible();
    await page.clock.runFor(100);
    await page.locator('#fusion-curio-primary').tap();
    await expect.poll(async () => (await saved(page)).curios[id].action?.kind).toBe('clean');
    await step(page, 7000);
    expect((await saved(page)).curios[id].condition).toBe('clean');
    await page.locator('#fusion-curio-primary').tap();
    await expect.poll(async () => (await saved(page)).curios[id].action?.kind).toBe('repair');
    await step(page, 7000);
    expect((await saved(page)).curios[id].condition).toBe('stabilized');
    await page.locator('#fusion-try').tap();
    await page.clock.runFor(120);
    await expect(page.locator('#fusion-exhibit-focus')).toHaveAttribute('data-experiment-playing', 'true');
    await expect(page.locator('#fusion-curio-response')).toBeVisible();
    await expect(page.locator('#fusion-curio-response')).not.toBeEmpty();
    const beforeFrame = await page.locator('#fusion-exhibit-focus').screenshot();
    await page.clock.runFor(350);
    expect(await page.locator('#fusion-exhibit-focus').screenshot()).not.toEqual(beforeFrame);
    await page.locator('#fusion-close').tap();
  }
  const claimed = (await saved(page)).game.resources;
  await page.reload();
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#fusion-return-chip')).toBeHidden();
  expect((await saved(page)).game.resources).toBe(claimed);
});
