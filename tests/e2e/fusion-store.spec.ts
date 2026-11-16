import {expect, test} from '@playwright/test';

test.beforeEach(async ({page}) => {
  // This fixture tests real IDB transactions while source files may still be edited in parallel.
  // Development hot reload is unrelated to persistence and can destroy an in-flight evaluation.
  await page.route('**/@vite/client', route => route.fulfill({body: '', contentType: 'application/javascript'}));
});

test('融合存档首次写入失败后恢复，同一升级只提交一次', async ({page}) => {
  await page.goto('/tests/fixtures/fusion-store.html');
  const initial = await page.evaluate(async () => {
    const {newGame, SAVE_KEY} = await import('/src/game/engine.ts' as string);
    localStorage.setItem(SAVE_KEY, JSON.stringify(newGame(Date.now())));
    let failures = 1;
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
      if (this.transaction.db.name === 'loststar.fusion.v1' && failures-- > 0) throw new DOMException('simulated full archive', 'QuotaExceededError');
      return original.apply(this, args);
    };
    const {openFusionStore} = await import('/src/fusion/store.ts' as string);
    const store = await openFusionStore();
    (window as any).__fusionStore = store;
    const rejected = await store.act({type: 'upgrade', id: 'scanner', expected: 0});
    return {persisted: store.persisted, rejected, balance: store.state.game.resources, level: store.state.game.upgrades.scanner};
  });
  expect(initial.persisted).toBe(false);
  expect(initial.rejected.ok).toBe(false);
  expect(initial.balance).toBe(120);
  expect(initial.level).toBe(0);
  await expect.poll(() => page.evaluate(() => (window as any).__fusionStore.persisted), {timeout: 12000}).toBe(true);
  const result = await page.evaluate(async () => {
    const store = (window as any).__fusionStore;
    const first = await store.act({type: 'upgrade', id: 'scanner', expected: 0});
    const duplicate = await store.act({type: 'upgrade', id: 'scanner', expected: 0});
    return {first, duplicate, level: store.state.game.upgrades.scanner, balance: store.state.game.resources};
  });
  expect(result.first.ok).toBe(true);
  expect(result.duplicate.ok).toBe(false);
  expect(result.level).toBe(1);
  expect(result.balance).toBe(75);
});

test('两个融合存档控制器串行核对同一旧等级，失败窗口不会丢已提交权益', async ({page}) => {
  await page.goto('/tests/fixtures/fusion-store.html');
  const result = await page.evaluate(async () => {
    const {openFusionStore} = await import('/src/fusion/store.ts' as string);
    const first = await openFusionStore();
    const second = await openFusionStore();
    const outcomes = await Promise.all([
      first.act({type: 'upgrade', id: 'scanner', expected: 0}),
      second.act({type: 'upgrade', id: 'scanner', expected: 0}),
    ]);
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('loststar.fusion.v1', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const saved = await new Promise<any>((resolve, reject) => {
      const transaction = database.transaction('archive', 'readonly');
      const request = transaction.objectStore('archive').get('current');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return {outcomes, balance: saved.game.resources, level: saved.game.upgrades.scanner, revision: saved.storageRevision};
  });
  expect(result.outcomes.filter((outcome: {ok: boolean}) => outcome.ok)).toHaveLength(1);
  expect(result.balance).toBe(75);
  expect(result.level).toBe(1);
  expect(result.revision).toBeGreaterThanOrEqual(4);
});

test('坏的融合档案保持原样，恢复重试不覆盖原记录或花费旧零件', async ({page}) => {
  await page.goto('/tests/fixtures/fusion-store.html');
  const result = await page.evaluate(async () => {
    const {newGame, SAVE_KEY} = await import('/src/game/engine.ts' as string);
    const old = newGame(Date.now());
    old.resources = 27049;
    localStorage.setItem(SAVE_KEY, JSON.stringify(old));
    const marker = {bad: 'KEEP-ORIGINAL-ARCHIVE'};
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('loststar.fusion.v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('archive');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('archive', 'readwrite');
      transaction.objectStore('archive').put(marker, 'current');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    const {openFusionStore} = await import('/src/fusion/store.ts' as string);
    const store = await openFusionStore();
    const purchase = await store.act({type: 'upgrade', id: 'scanner', expected: 0});
    const saved = await new Promise<any>((resolve, reject) => {
      const transaction = database.transaction('archive', 'readonly');
      const request = transaction.objectStore('archive').get('current');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return {purchase, persisted: store.persisted, saved, original: JSON.parse(localStorage.getItem(SAVE_KEY)!).resources};
  });
  expect(result.persisted).toBe(false);
  expect(result.purchase.ok).toBe(false);
  expect(result.saved).toEqual({bad: 'KEEP-ORIGINAL-ARCHIVE'});
  expect(result.original).toBe(27049);
});
