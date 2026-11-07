import {expect, test, type Page} from '@playwright/test';

const journeyDatabase = 'loststar.fusion.firstplanet.v037';

async function readArchive(page: Page, name = journeyDatabase) {
  return page.evaluate(name => new Promise<any>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const get = database.transaction('archive', 'readonly').objectStore('archive').get('current');
      get.onsuccess = () => {resolve(get.result);database.close();};
      get.onerror = () => {reject(get.error);database.close();};
    };
  }), name);
}

async function installOldArchive(page: Page) {
  await page.goto('/tests/fixtures/fusion-store.html');
  await page.evaluate(async () => {
    const {newGame, SAVE_KEY} = await import('/src/game/engine.ts' as string);
    const {createFusion} = await import('/src/fusion/domain.ts' as string);
    const {discoveries} = await import('/src/content/catalog.ts' as string);
    const {growthCatalog} = await import('/src/game/growth.ts' as string);
    const game = newGame(Date.now());
    game.resources = 27049;
    game.collection = discoveries.map((entry: {id: string}) => entry.id);
    game.seenDiscoveries = [...game.collection];
    game.upgrades = {radar: 5, scanner: 5, recycler: 5, cargo: 5};
    game.growth = Object.fromEntries(growthCatalog.map((entry: {id: string; costs: number[]}) => [entry.id, entry.costs.length]));
    const raw = JSON.stringify(game);
    localStorage.setItem(SAVE_KEY, raw);
    const old = createFusion(game.lastAt, raw);
    Object.assign(window, {__oldJourneySource: {raw, old}});
    for (const name of ['loststar.fusion.v1', 'loststar.fusion.review.v035']) {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('archive');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('archive', 'readwrite');
        transaction.objectStore('archive').put(old, 'current');
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    }
  });
}

test('已授权重开从120和空收藏开始，27049旧权益原值保留并归档备份', async ({page}) => {
  await installOldArchive(page);
  const result = await page.evaluate(async name => {
    const {openFusionStore} = await import('/src/fusion/store.ts' as string);
    const {SAVE_KEY} = await import('/src/game/engine.ts' as string);
    const controller = await openFusionStore({journey: true});
    const fresh = structuredClone(controller.state);
    const read = (name: string, all = false) => new Promise<any>((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const store = database.transaction('archive', 'readonly').objectStore('archive');
        const get = all ? store.getAll() : store.get('current');
        get.onsuccess = () => {resolve(get.result);database.close();};
        get.onerror = () => {reject(get.error);database.close();};
      };
    });
    return {fresh, persisted: controller.persisted, old: (window as any).__oldJourneySource.old,
      legacy: await read('loststar.fusion.v1'), review: await read('loststar.fusion.review.v035'),
      localOriginal: localStorage.getItem(SAVE_KEY) === (window as any).__oldJourneySource.raw,
      backups: await read(name, true)};
  }, journeyDatabase);
  expect(result.persisted).toBe(true);
  expect(result.fresh.game.resources).toBe(120);
  expect(result.fresh.game.collection).toEqual([]);
  expect(result.fresh.game.cycles).toBe(0);
  expect(result.fresh.game.upgrades).toEqual({radar: 0, scanner: 0, recycler: 0, cargo: 0});
  expect(result.fresh.receipt.stage).toBe('buried');
  expect(result.fresh.game.world.settledNights).toBe(0);
  expect(result.legacy).toEqual(result.old);
  expect(result.review).toEqual(result.old);
  expect(result.localOriginal).toBe(true);
  // Backup values may wrap source bytes or structured values. Both preserve the old rights.
  expect(JSON.stringify(result.backups)).toContain('27049');
  expect(JSON.stringify(result.backups)).toContain('loststar.fusion.review.v035');
  const stored = await readArchive(page);
  await page.goto('/?sample=first-planet');
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  expect(await page.evaluate(() => (window as any).__FUSION__.databaseName)).toBe(journeyDatabase);
  expect((await readArchive(page)).game.collection).toEqual(stored.game.collection);
});

test('新周目双控制器首次建立和同级购买串行，刷新继续已付费进度', async ({page}) => {
  await page.goto('/tests/fixtures/fusion-store.html');
  const result = await page.evaluate(async () => {
    const {openFusionStore} = await import('/src/fusion/store.ts' as string);
    const {cost} = await import('/src/game/engine.ts' as string);
    const [first, second] = await Promise.all([openFusionStore({journey: true}), openFusionStore({journey: true})]);
    const initial = structuredClone(first.state);
    const price = cost(first.state.game, 'scanner');
    const outcomes = await Promise.all([first.act({type: 'upgrade', id: 'scanner', expected: 0}), second.act({type: 'upgrade', id: 'scanner', expected: 0})]);
    return {initial, price, successes: outcomes.filter(result => result.ok).length};
  });
  expect(result.successes).toBe(1);
  const paid = await readArchive(page);
  expect(paid.game.upgrades.scanner).toBe(1);
  expect(paid.game.resources).toBe(120 - result.price);
  expect(paid.game.collection).toEqual([]);
  await page.goto('/?sample=first-planet');
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  await page.reload();
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  const resumed = await readArchive(page);
  expect(resumed.game.upgrades.scanner).toBe(1);
  expect(resumed.game.resources).toBe(paid.game.resources);
  expect(resumed.game.lastAt).toBeGreaterThanOrEqual(paid.game.lastAt);
});

test('坏的旧源仍留原值，授权新周目可建立，自己的坏新档保持锁写', async ({page}) => {
  await page.goto('/tests/fixtures/fusion-store.html');
  await page.evaluate(() => localStorage.setItem('loststar.save.v1', '{old-archive-damaged-keep-original'));
  await page.goto('/?sample=first-planet');
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  expect((await readArchive(page)).game.resources).toBe(120);
  expect(await page.evaluate(() => localStorage.getItem('loststar.save.v1'))).toBe('{old-archive-damaged-keep-original');
  await page.evaluate(async name => {
    const request = indexedDB.open(name, 1);
    await new Promise<void>((resolve, reject) => {
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('archive', 'readwrite');
        transaction.objectStore('archive').put({malformed: 'keep-current-campaign'}, 'current');
        transaction.oncomplete = () => {database.close();resolve();};
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }, journeyDatabase);
  await page.reload();
  await expect(page.locator('#fusion-parts')).toHaveText('—');
  expect(await readArchive(page)).toEqual({malformed: 'keep-current-campaign'});
});

test('首星首次发现后直接进入基地和收藏，实际纸面使用认可材质且未先打开详情', async ({page}) => {
  await page.clock.install({time: new Date(1800000000000)});
  await page.goto('/?sample=first-planet');
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  await page.clock.fastForward(12200);
  await page.clock.runFor(300);
  await expect.poll(async () => (await readArchive(page)).game.collection.includes('receipt')).toBe(true);
  await page.locator('#fusion-app > .fu-nav [data-tab="base"]').click();
  const base = page.locator('#fusion-base-dock canvas');
  await expect(base).toHaveAttribute('data-receipt-material', 'renewal');
  await expect(base).toHaveAttribute('data-receipt-condition', 'found');
  await expect(base).toHaveAttribute('data-receipt-stage', 'buried');
  await expect(page.locator('#fusion-drawer')).not.toBeVisible();
  await page.locator('#fusion-app > .fu-nav [data-tab="collection"]').click();
  const collection = page.locator('#fusion-collection-dock canvas');
  await expect(collection).toHaveAttribute('data-receipt-material', 'renewal');
  const metrics = await page.evaluate(() => (window as unknown as {__FUSION__: {uiMetrics(): {museum: {receiptMaterial: string; receiptCondition: string; receiptStage: string}}}}).__FUSION__.uiMetrics().museum);
  expect(metrics).toMatchObject({receiptMaterial: 'renewal', receiptCondition: 'found', receiptStage: 'buried'});
});

test('首星收据材质加载失败时基地等待原材质，并从失败状态重新加载', async ({page}) => {
  await page.clock.install({time: new Date(1800000000000)});
  let blocked = true;
  let requests = 0;
  await page.route('**/receipt-found.webp*', async route => {
    if (route.request().resourceType() !== 'image') {await route.continue();return;}
    requests++;
    if (blocked) await route.abort('failed');
    else await route.continue();
  });
  await page.goto('/?sample=first-planet');
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  expect(requests).toBeGreaterThan(0);
  await page.clock.fastForward(12200);
  await page.clock.runFor(300);
  await expect.poll(async () => (await readArchive(page)).game.collection.includes('receipt')).toBe(true);
  await expect.poll(() => requests).toBeGreaterThan(0);
  await page.locator('#fusion-app > .fu-nav [data-tab="base"]').click();
  const canvas = page.locator('#fusion-base-dock canvas');
  await expect(canvas).toHaveAttribute('data-receipt-material', 'pending');
  await expect(page.locator('#fusion-drawer')).not.toBeVisible();
  blocked = false;
  await page.locator('#fusion-museum-retry').click();
  await page.clock.runFor(300);
  await expect.poll(() => requests).toBeGreaterThan(1);
  await expect(canvas).toHaveAttribute('data-receipt-material', 'renewal');
  await expect(canvas).toHaveAttribute('data-receipt-stage', 'buried');
});
