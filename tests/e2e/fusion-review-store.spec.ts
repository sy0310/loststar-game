import {expect, test} from '@playwright/test';

test.beforeEach(async ({page}) => {
  await page.route('**/@vite/client', route => route.fulfill({body: '', contentType: 'application/javascript'}));
  await page.goto('/tests/fixtures/fusion-store.html');
  await page.evaluate(async () => {
    const {newGame, SAVE_KEY} = await import('/src/game/engine.ts' as string);
    const {discoveries} = await import('/src/content/catalog.ts' as string);
    const {growthCatalog} = await import('/src/game/growth.ts' as string);
    const {createFusion, reduceFusion, advanceFusion} = await import('/src/fusion/domain.ts' as string);
    const now = Date.now();
    const game = newGame(now);
    game.resources = 27049;
    game.collection = discoveries.map((entry: {id: string}) => entry.id);
    game.seenDiscoveries = [...game.collection];
    game.upgrades = {radar: 5, scanner: 5, recycler: 5, cargo: 5};
    game.growth = Object.fromEntries(growthCatalog.map((entry: {id: string; costs: number[]}) => [entry.id, entry.costs.length]));
    game.cycleMs = 12000 / 2.1 * .44;
    const legacy = JSON.stringify(game);
    localStorage.setItem(SAVE_KEY, legacy);
    let source = createFusion(now, legacy);
    source = reduceFusion(source, {type: 'observe', id: 'field-pipe-scan', at: now,
      source: 'parcel/returns-plain/pipe-marker-p03'}, now).state;
    source = advanceFusion(source, now);
    source.projects = ['evidence-bench', 'habitat-window', 'archive'];
    // This is the actual older fusion schema before the optional refinement branch existed.
    const {progression: _newReviewOnly, ...oldSource} = source;
    (window as any).__originalFusion = oldSource;
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('loststar.fusion.v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('archive');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('archive', 'readwrite');
      transaction.objectStore('archive').put(oldSource, 'current');
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });
});

test('审阅档只读克隆完整旧权益，双窗口能力购买原子防重且原档不变', async ({page}) => {
  const result = await page.evaluate(async () => {
    const {openFusionStore} = await import('/src/fusion/store.ts' as string);
    const {SAVE_KEY} = await import('/src/game/engine.ts' as string);
    const first = await openFusionStore({review: true});
    const second = await openFusionStore({review: true});
    const old = (window as any).__originalFusion;
    const cloned = {projects: first.state.projects, growth: first.state.game.growth,
      upgrades: first.state.game.upgrades, collection: first.state.game.collection,
      condition: first.state.receipt.condition, tape: first.state.curios.tape.condition};
    const outcomes = await Promise.all([
      first.act({type: 'ability', id: 'receipt', expected: 0}),
      second.act({type: 'ability', id: 'receipt', expected: 0}),
    ]);
    const read = async (name: string) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name, 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const value = await new Promise<any>((resolve, reject) => {
        const transaction = database.transaction('archive', 'readonly');
        const request = transaction.objectStore('archive').get('current');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      database.close();
      return value;
    };
    const saved = await read('loststar.fusion.review.v035');
    const original = await read('loststar.fusion.v1');
    return {outcomes, cloned, expected: {projects: old.projects, growth: old.game.growth,
      upgrades: old.game.upgrades, collection: old.game.collection, condition: old.receipt.condition,
      tape: old.curios.tape.condition}, saved, original, old,
      legacy: JSON.parse(localStorage.getItem(SAVE_KEY)!)};
  });
  expect(result.cloned).toEqual(result.expected);
  expect(result.outcomes.filter((outcome: {ok: boolean}) => outcome.ok)).toHaveLength(1);
  expect(result.saved.progression.abilities.receipt).toBe(1);
  expect(result.saved.progression.payments).toHaveLength(1);
  expect(result.saved.game.resources).toBe(27049 + result.saved.game.station.grossIncome - 300);
  expect(result.original).toEqual(result.old);
  expect(result.legacy.resources).toBe(27049);
  expect(result.original.progression).toBeUndefined();
});

test('审阅库首写失败不会付费或污染原档，恢复后只扣一次', async ({page}) => {
  const initial = await page.evaluate(async () => {
    let failures = 1;
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof original>) {
      if (this.transaction.db.name === 'loststar.fusion.review.v035' && failures-- > 0) {
        throw new DOMException('review archive temporarily full', 'QuotaExceededError');
      }
      return original.apply(this, args);
    };
    const {openFusionStore} = await import('/src/fusion/store.ts' as string);
    const store = await openFusionStore({review: true});
    (window as any).__reviewStore = store;
    const rejected = await store.act({type: 'ability', id: 'tape', expected: 0});
    return {persisted: store.persisted, rejected, level: store.state.progression.abilities.tape,
      payments: store.state.progression.payments.length};
  });
  expect(initial.persisted).toBe(false);
  expect(initial.rejected.ok).toBe(false);
  expect(initial.level).toBe(0);
  expect(initial.payments).toBe(0);
  await expect.poll(() => page.evaluate(() => (window as any).__reviewStore.persisted), {timeout: 12000}).toBe(true);
  const result = await page.evaluate(async () => {
    const store = (window as any).__reviewStore;
    const first = await store.act({type: 'ability', id: 'tape', expected: 0});
    const duplicate = await store.act({type: 'ability', id: 'tape', expected: 0});
    const database = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open('loststar.fusion.v1', 1);
      request.onsuccess = () => resolve(request.result);
    });
    const original = await new Promise<any>(resolve => {
      const request = database.transaction('archive', 'readonly').objectStore('archive').get('current');
      request.onsuccess = () => resolve(request.result);
    });
    database.close();
    return {first, duplicate, level: store.state.progression.abilities.tape,
      balance: store.state.game.resources, gross: store.state.game.station.grossIncome,
      maintenance: store.state.game.station.repairSpent, payments: store.state.progression.payments, original,
      expected: (window as any).__originalFusion};
  });
  expect(result.first.ok).toBe(true);
  expect(result.duplicate.ok).toBe(false);
  expect(result.level).toBe(1);
  expect(result.payments).toHaveLength(1);
  expect(result.balance).toBe(27049 + result.gross - result.maintenance - 240);
  expect(result.original).toEqual(result.expected);
});

test('坏旧源阻止空审阅库初始化和收费，原字节保留并在源修复后重试迁移', async ({page}) => {
  const initial = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open('loststar.fusion.v1', 1);
      request.onsuccess = () => resolve(request.result);
    });
    const marker = {bad: 'KEEP-OLD-27049', resources: 27049};
    await new Promise<void>(resolve => {
      const transaction = database.transaction('archive', 'readwrite');
      transaction.objectStore('archive').put(marker, 'current');
      transaction.oncomplete = () => resolve();
    });
    database.close();
    const {openFusionStore} = await import('/src/fusion/store.ts' as string);
    const store = await openFusionStore({review: true});
    (window as any).__reviewStore = store;
    const rejected = await store.act({type: 'ability', id: 'tape', expected: 0});
    const tap = await store.act({type: 'tap'});
    const reviewDatabase = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open('loststar.fusion.review.v035', 1);
      request.onsuccess = () => resolve(request.result);
    });
    const saved = await new Promise<any>(resolve => {
      const request = reviewDatabase.transaction('archive', 'readonly').objectStore('archive').get('current');
      request.onsuccess = () => resolve(request.result);
    });
    reviewDatabase.close();
    return {persisted: store.persisted, migrationBlocked: store.migrationBlocked, rejected, tap,
      saved: saved ?? null};
  });
  expect(initial.persisted).toBe(false);
  expect(initial.migrationBlocked).toBe(true);
  expect(initial.rejected.ok).toBe(false);
  expect(initial.tap.ok).toBe(false);
  expect(initial.saved).toBeNull();
  const preserved = await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>(resolve => {
      const request = indexedDB.open('loststar.fusion.v1', 1);
      request.onsuccess = () => resolve(request.result);
    });
    const value = await new Promise<any>(resolve => {
      const request = database.transaction('archive', 'readonly').objectStore('archive').get('current');
      request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>(resolve => {
      const transaction = database.transaction('archive', 'readwrite');
      transaction.objectStore('archive').put((window as any).__originalFusion, 'current');
      transaction.oncomplete = () => resolve();
    });
    database.close();
    return value;
  });
  expect(preserved).toEqual({bad: 'KEEP-OLD-27049', resources: 27049});
  await expect.poll(() => page.evaluate(() => (window as any).__reviewStore.persisted), {timeout: 12000}).toBe(true);
  const recovered = await page.evaluate(async () => {
    const store = (window as any).__reviewStore;
    const purchase = await store.act({type: 'ability', id: 'tape', expected: 0});
    return {purchase, migrationBlocked: store.migrationBlocked, balance: store.state.game.resources,
      gross: store.state.game.station.grossIncome, payments: store.state.progression.payments.length};
  });
  expect(recovered.migrationBlocked).toBe(false);
  expect(recovered.purchase.ok).toBe(true);
  expect(recovered.payments).toBe(1);
  expect(recovered.balance).toBe(27049 + recovered.gross - 240);
});

test('已有有效审阅档独立恢复，坏旧源不覆盖其余额与权益', async ({page}) => {
  const result = await page.evaluate(async () => {
    const {restoreFusion} = await import('/src/fusion/domain.ts' as string);
    const source = (window as any).__originalFusion;
    const review = restoreFusion(JSON.stringify(source), source.game.lastAt);
    review.game.resources = 26509;
    review.progression.abilities.tape = 1;
    review.progression.abilities.receipt = 1;
    const write = async (name: string, value: unknown) => {
      const database = await new Promise<IDBDatabase>(resolve => {
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('archive');
        request.onsuccess = () => resolve(request.result);
      });
      await new Promise<void>(resolve => {
        const transaction = database.transaction('archive', 'readwrite');
        transaction.objectStore('archive').put(value, 'current');
        transaction.oncomplete = () => resolve();
      });
      database.close();
    };
    await write('loststar.fusion.review.v035', review);
    const marker = {bad: 'OLD-SOURCE-STILL-PRESERVED', resources: 27049};
    await write('loststar.fusion.v1', marker);
    const {openFusionStore} = await import('/src/fusion/store.ts' as string);
    const store = await openFusionStore({review: true});
    return {persisted: store.persisted, migrationBlocked: store.migrationBlocked,
      balance: store.state.game.resources, gross: store.state.game.station.grossIncome,
      abilities: store.state.progression.abilities, projects: store.state.projects};
  });
  expect(result.persisted).toBe(true);
  expect(result.migrationBlocked).toBe(false);
  expect(result.balance).toBe(26509 + result.gross);
  expect(result.abilities).toEqual({receipt: 1, tape: 1});
  expect(result.projects).toHaveLength(3);
});

for (const problem of ['bad-json', 'bad-schema', 'read-error', 'same-clock-120'] as const) {
  test(`旧Fusion缺失时LS${problem}保持原始数据，阻止新档并在修复后迁移`, async ({page}) => {
    const initial = await page.evaluate(async kind => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase('loststar.fusion.v1');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      const {SAVE_KEY} = await import('/src/game/engine.ts' as string);
      const original = Storage.prototype.getItem;
      (window as any).__originalGetItem = original;
      const fixed = (window as any).__originalFusion.game.lastAt;
      if (kind === 'same-clock-120') Date.now = () => fixed;
      const marker = kind === 'bad-json' ? '{KEEP-OLD-LS-27049'
        : kind === 'bad-schema' ? JSON.stringify({version: 2, lastAt: Date.now(), resources: 27049, upgrades: 'damaged'})
          : kind === 'same-clock-120' ? JSON.stringify({version: 2, lastAt: fixed, resources: 120})
            : original.call(localStorage, SAVE_KEY)!;
      localStorage.setItem(SAVE_KEY, marker);
      if (kind === 'read-error') Storage.prototype.getItem = function (key: string) {
        if (key === SAVE_KEY) throw new DOMException('source temporarily inaccessible', 'SecurityError');
        return original.call(this, key);
      };
      const {openFusionStore} = await import('/src/fusion/store.ts' as string);
      const store = await openFusionStore({review: true});
      (window as any).__reviewStore = store;
      const rejected = await store.act({type: 'upgrade', id: 'scanner', expected: 0});
      const database = await new Promise<IDBDatabase>(resolve => {
        const request = indexedDB.open('loststar.fusion.review.v035', 1);
        request.onsuccess = () => resolve(request.result);
      });
      const saved = await new Promise<any>(resolve => {
        const request = database.transaction('archive', 'readonly').objectStore('archive').get('current');
        request.onsuccess = () => resolve(request.result);
      });
      database.close();
      return {persisted: store.persisted, migrationBlocked: store.migrationBlocked, rejected,
        saved: saved ?? null, preserved: original.call(localStorage, SAVE_KEY) === marker};
    }, problem);
    expect(initial.persisted).toBe(false);
    expect(initial.migrationBlocked).toBe(true);
    expect(initial.rejected.ok).toBe(false);
    expect(initial.saved).toBeNull();
    expect(initial.preserved).toBe(true);
    await page.evaluate(async kind => {
      const {SAVE_KEY} = await import('/src/game/engine.ts' as string);
      Storage.prototype.getItem = (window as any).__originalGetItem;
      localStorage.setItem(SAVE_KEY, JSON.stringify((window as any).__originalFusion.game));
      if (kind === 'same-clock-120') Date.now = () => (window as any).__originalFusion.game.lastAt + 6000;
    }, problem);
    await expect.poll(() => page.evaluate(() => (window as any).__reviewStore.persisted), {timeout: 12000}).toBe(true);
    const recovered = await page.evaluate(() => {
      const store = (window as any).__reviewStore;
      const original = (window as any).__originalFusion;
      return {migrationBlocked: store.migrationBlocked, balance: store.state.game.resources,
        gross: store.state.game.station.grossIncome, maintenance: store.state.game.station.repairSpent,
        collection: store.state.game.collection, growth: store.state.game.growth,
        expectedCollection: original.game.collection, expectedGrowth: original.game.growth,
        condition: store.state.receipt.condition};
    });
    expect(recovered.migrationBlocked).toBe(false);
    expect(recovered.balance).toBe(27049 + recovered.gross - recovered.maintenance);
    expect(recovered.collection).toEqual(recovered.expectedCollection);
    expect(recovered.growth).toEqual(recovered.expectedGrowth);
    expect(recovered.condition).toBe('stabilized');
  });
}

for (const source of ['old-fusion', 'review'] as const) {
  test(`有效${source}独立恢复，不受坏LS或读取异常影响`, async ({page}) => {
    const result = await page.evaluate(async preferred => {
      const {SAVE_KEY} = await import('/src/game/engine.ts' as string);
      if (preferred === 'review') {
        const {restoreFusion} = await import('/src/fusion/domain.ts' as string);
        const old = (window as any).__originalFusion;
        const review = restoreFusion(JSON.stringify(old), old.game.lastAt);
        review.game.resources = 26509;
        review.progression.abilities = {receipt: 1, tape: 1};
        const database = await new Promise<IDBDatabase>(resolve => {
          const request = indexedDB.open('loststar.fusion.review.v035', 1);
          request.onupgradeneeded = () => request.result.createObjectStore('archive');
          request.onsuccess = () => resolve(request.result);
        });
        await new Promise<void>(resolve => {
          const transaction = database.transaction('archive', 'readwrite');
          transaction.objectStore('archive').put(review, 'current');
          transaction.oncomplete = () => resolve();
        });
        database.close();
        const original = Storage.prototype.getItem;
        Storage.prototype.getItem = function (key: string) {
          if (key === SAVE_KEY) throw new DOMException('LS unreadable', 'SecurityError');
          return original.call(this, key);
        };
      } else localStorage.setItem(SAVE_KEY, '{KEEP-DAMAGED-LOWER-PRIORITY-SOURCE');
      const {openFusionStore} = await import('/src/fusion/store.ts' as string);
      const store = await openFusionStore({review: true});
      return {persisted: store.persisted, migrationBlocked: store.migrationBlocked,
        balance: store.state.game.resources, gross: store.state.game.station.grossIncome,
        projects: store.state.projects, abilities: store.state.progression.abilities};
    }, source);
    expect(result.persisted).toBe(true);
    expect(result.migrationBlocked).toBe(false);
    expect(result.balance).toBe((source === 'review' ? 26509 : 27049) + result.gross);
    expect(result.projects).toHaveLength(3);
    expect(result.abilities).toEqual(source === 'review' ? {receipt: 1, tape: 1} : {receipt: 0, tape: 0});
  });
}

for (const damaged of ['old-fusion', 'review', 'null-review'] as const) {
  test(`审阅路径拒绝${damaged}的120结构碰撞并保留坏字节，原处修复后恢复`, async ({page}) => {
    const result = await page.evaluate(async location => {
      const name = location !== 'old-fusion' ? 'loststar.fusion.review.v035' : 'loststar.fusion.v1';
      const marker = location === 'null-review' ? null : {...(window as any).__originalFusion,
        game: {version: 2, lastAt: Date.now(), resources: 120}};
      const database = await new Promise<IDBDatabase>(resolve => {
        const request = indexedDB.open(name, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('archive');
        request.onsuccess = () => resolve(request.result);
      });
      await new Promise<void>(resolve => {
        const transaction = database.transaction('archive', 'readwrite');
        transaction.objectStore('archive').put(marker, 'current');
        transaction.oncomplete = () => resolve();
      });
      database.close();
      const {openFusionStore} = await import('/src/fusion/store.ts' as string);
      const store = await openFusionStore({review: true});
      (window as any).__reviewStore = store;
      const rejected = await store.act({type: 'upgrade', id: 'scanner', expected: 0});
      const read = async (source: string) => {
        const database = await new Promise<IDBDatabase>(resolve => {
          const request = indexedDB.open(source, 1);
          request.onsuccess = () => resolve(request.result);
        });
        const value = await new Promise<any>(resolve => {
          const request = database.transaction('archive', 'readonly').objectStore('archive').get('current');
          request.onsuccess = () => resolve(request.result);
        });
        database.close();
        return value;
      };
      return {persisted: store.persisted, migrationBlocked: store.migrationBlocked, rejected,
        preserved: JSON.stringify(await read(name)) === JSON.stringify(marker),
        review: await read('loststar.fusion.review.v035') ?? null};
    }, damaged);
    expect(result.persisted).toBe(false);
    expect(result.migrationBlocked).toBe(true);
    expect(result.rejected.ok).toBe(false);
    expect(result.preserved).toBe(true);
    if (damaged === 'old-fusion') expect(result.review).toBeNull();
    else if (damaged === 'null-review') expect(result.review).toBeNull();
    else expect(result.review.game).toEqual({version: 2, lastAt: result.review.game.lastAt, resources: 120});
    await page.evaluate(async location => {
      const name = location !== 'old-fusion' ? 'loststar.fusion.review.v035' : 'loststar.fusion.v1';
      const database = await new Promise<IDBDatabase>(resolve => {
        const request = indexedDB.open(name, 1);
        request.onsuccess = () => resolve(request.result);
      });
      await new Promise<void>(resolve => {
        const transaction = database.transaction('archive', 'readwrite');
        transaction.objectStore('archive').put((window as any).__originalFusion, 'current');
        transaction.oncomplete = () => resolve();
      });
      database.close();
    }, damaged);
    await expect.poll(() => page.evaluate(() => (window as any).__reviewStore.persisted), {timeout: 12000}).toBe(true);
    const recovered = await page.evaluate(() => {
      const store = (window as any).__reviewStore;
      return {migrationBlocked: store.migrationBlocked, balance: store.state.game.resources,
        gross: store.state.game.station.grossIncome, projects: store.state.projects};
    });
    expect(recovered.migrationBlocked).toBe(false);
    expect(recovered.balance).toBe(27049 + recovered.gross);
    expect(recovered.projects).toHaveLength(3);
  });
}
