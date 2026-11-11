const { test, expect } = require('@playwright/test');
const E = require('../../src/engine.js');
const O = require('../legacy-engine.cjs')('94e606fc773d1dc37341d29923e39e7ec7c3863b');
const copy = value => JSON.parse(JSON.stringify(value));
const state = page => page.evaluate(() => __SALVAGE__.state());

function act(model, value, type, extra = {}) {
  const result = model.dispatch(value, { type, ...extra });
  expect(result.ok, result.message).toBe(true);
  return result.state;
}
function ship(shipId, level = 0, model = E) {
  let value = model.create(271);
  value.money = 27049;
  if (shipId !== 'starter') {
    value = act(model, value, 'buyShip', { id: shipId });
    value = act(model, value, 'equipShip', { id: shipId });
  }
  for (let n = 0; n < level; n++) value = act(model, value, 'upgradeCargo');
  return value;
}
function goods(value, pointsOnly = false) {
  value.cargo = pointsOnly
    ? [{ uid: 1, name: 'QA单格金属', itemId: 'metal_crate', cells: 1, shapeId: 'point1', value: 60, shapeVersion: 1, acquiredRun: 0 }]
    : Object.entries(E.NewEncounters.curios).map(([itemId, spec], index) => ({ ...spec, uid: index + 1, itemId, shapeVersion: 1, acquiredRun: 0 }));
  value.nextUid = value.cargo.length + 1;
  value.cargoGrid.placements = E.Cargo.solve(value.cargo, [], E.cargoSpace(value));
  expect(value.cargoGrid.placements).toBeTruthy();
  return value;
}
async function tap(page, selector) {
  await page.waitForFunction(() => __SALVAGE__.ready());
  await page.locator(selector).tap();
  await page.waitForFunction(() => __SALVAGE__.ready());
}
async function boot(page) {
  await page.goto('');
  await page.waitForFunction(() => window.__SALVAGE__);
  if (await page.locator('#modal-close').isVisible()) await tap(page, '#modal-close');
}
async function load(page, value) {
  await tap(page, '[data-act=settings]');
  await tap(page, '[data-act=import]');
  await page.locator('#import-file').setInputFiles({ name: 'explicit-v05-isolated-QA.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  await tap(page, '[data-act=confirm]');
  await expect.poll(() => state(page)).toEqual(E.restore(value));
}
async function archive(page, key, value) {
  return page.evaluate(({ key, value }) => new Promise((resolve, reject) => {
    const request = indexedDB.open('lostcargo.route-demo.v1');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction('archive', value === undefined ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('archive');
      let result;
      if (value !== undefined) store.put(value, key);
      else { const get = store.get(key); get.onsuccess = () => result = get.result; }
      transaction.oncomplete = () => { db.close(); resolve(result); };
      transaction.onabort = () => reject(transaction.error);
    };
  }), { key, value });
}

for (const shipId of Object.keys(E.PORT.ships)) {
  test(shipId+' all paid levels decode four original curios and expose exact usable cells', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await boot(page);
    for (let level = 0; level <= E.PORT.ships[shipId].cargoUpgradeCosts.length; level++) {
      const value = goods(ship(shipId, level));
      await load(page, value);
      await tap(page, '[data-tab=cargo]');
      const space = E.cargoSpace(value);
      await expect(page.locator('.cargo-cell:not(.hold-closed)')).toHaveCount(space.capacity);
      await expect(page.locator('.fixed-tray')).toHaveCount(space.fixedTrayCells.length);
      await expect(page.locator('.cargo-physical-object img')).toHaveCount(4);
      await expect.poll(() => page.locator('.cargo-physical-object img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0))).toBe(true);
      for (const cell of await page.locator('.hold-closed').all()) await expect(cell).toBeDisabled();
      const metrics = await page.locator('.cargo-board').evaluate(board => ({ width: board.getBoundingClientRect().width, columns: Number(board.style.getPropertyValue('--cargo-cols')), right: board.getBoundingClientRect().right }));
      expect(metrics.width / metrics.columns).toBeGreaterThanOrEqual(30);
      expect(metrics.right).toBeLessThanOrEqual(page.viewportSize().width);
      expect(await state(page)).toEqual(value);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
      await tap(page, '#back');
    }
    expect(errors).toEqual([]);
  });
}
test('touch selection, blocked-cell rejection, real fixed tray, auto-arrange and refresh agree', async ({ page }) => {
  await boot(page);
  const value = goods(ship('scout', 2), true);
  await load(page, value);
  await tap(page, '[data-tab=cargo]');
  await tap(page, '[data-cargo-pick="1"]');
  await expect(page.locator('[data-cargo-cell="0,0"]')).toBeDisabled();
  await tap(page, '[data-cargo-cell="0,1"]');
  await tap(page, '[data-cargo-save]');
  let saved = await state(page);
  expect(saved.cargoGrid.placements).toEqual([{ uid: 1, x: 0, y: 1, rotation: 0 }]);
  expect(saved.money).toBe(value.money);
  expect(saved.cargo).toEqual(value.cargo);
  await tap(page, '[data-cargo-pick="1"]');
  await tap(page, '[data-cargo-rotate]');
  await tap(page, '[data-cargo-arrange]');
  if (await page.locator('[data-cargo-save]').isEnabled()) await tap(page, '[data-cargo-save]');
  saved = await state(page);
  await page.reload();
  await page.waitForFunction(() => window.__SALVAGE__);
  expect(await state(page)).toEqual(saved);
});
test('schema6 ongoing load backs up in the same transaction and preserves saved route', async ({ page }) => {
  await boot(page);
  let old = ship('cargo', 1, O);
  old = act(O, old, 'fillFuel');
  old = act(O, old, 'depart');
  const raw = { format: 1, revision: 92, game: copy(old) };
  await archive(page, 'current', raw);
  await page.reload();
  await page.waitForFunction(() => window.__SALVAGE__);
  expect(await archive(page, 'migration/schema-6')).toEqual(raw);
  const migrated = await state(page);
  expect(migrated).toEqual(E.restore(old));
  expect(migrated.hold.mode).toBe('legacy');
  expect(migrated.route).toEqual(copy(old.route));
  expect(migrated.rng).toBe(old.rng);
  await page.reload();
  await page.waitForFunction(() => window.__SALVAGE__);
  expect(await state(page)).toEqual(migrated);
  expect(await archive(page, 'migration/schema-6')).toEqual(raw);
});
test('rotated T and L cross real tray edges, invalid dragging returns to saved position', async ({ page }) => {
  await boot(page);
  function oneCurio(shipId, level, itemId) {
    const value = ship(shipId, level);
    const spec = E.NewEncounters.curios[itemId];
    value.cargo = [{ ...spec, uid: 1, itemId, shapeVersion: 1, acquiredRun: 0 }];
    value.nextUid = 2;
    value.cargoGrid.placements = E.Cargo.solve(value.cargo, [], E.cargoSpace(value));
    return value;
  }
  const initial = oneCurio('heavy', 1, 'gravity_faceter');
  await load(page, initial);
  await tap(page, '[data-tab=cargo]');
  await tap(page, '[data-cargo-pick="1"]');
  await tap(page, '[data-cargo-rotate]');
  await tap(page, '[data-cargo-cell="2,3"]');
  await tap(page, '[data-cargo-save]');
  const saved = await state(page);
  expect(saved.cargoGrid.placements).toEqual([{ uid: 1, x: 1, y: 3, rotation: 1 }]);
  expect(E.Cargo.validate(saved.cargo, saved.cargoGrid.placements, E.cargoSpace(saved)).ok).toBe(true);
  const from = await page.locator('[data-cargo-cell="2,3"]').boundingBox();
  const to = await page.locator('[data-cargo-cell="5,4"]').boundingBox();
  await page.mouse.move(from.x + from.width/2, from.y + from.height/2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width/2, to.y + to.height/2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('[data-cargo-status]')).toContainText('仍在原位');
  expect(await state(page)).toEqual(saved);
  await expect(page.locator('[data-cargo-save]')).toBeDisabled();
  await tap(page, '#back');
  const other = oneCurio('scout', 2, 'hull_clinger');
  await load(page, other);
  await tap(page, '[data-tab=cargo]');
  await tap(page, '[data-cargo-pick="1"]');
  for (let turn=0; turn<3; turn++) await tap(page, '[data-cargo-rotate]');
  await tap(page, '[data-cargo-cell="1,2"]');
  await tap(page, '[data-cargo-save]');
  const final = await state(page);
  expect(final.cargoGrid.placements).toEqual([{ uid: 1, x: 0, y: 2, rotation: 3 }]);
  expect(final.cargo).toEqual(other.cargo);
  expect(final.money).toBe(other.money);
});
test('quote confirmation can cancel, one NPC listing fee and bids survive refresh', async ({ page }) => {
  await boot(page);
  const value = goods(ship('starter'));
  await load(page, value);
  await tap(page, '[data-tab=shop]');
  await tap(page, '[data-act=market]');
  await expect(page.locator('#back')).toHaveAttribute('aria-label', '返回商店');
  await expect(page.locator('.market-item-heading img')).toBeVisible();
  await tap(page, '[data-market-style=auction][data-market-reserve="100"]');
  await expect(page.locator('#modal-body')).toContainText('挂牌费');
  await tap(page, '#modal-close');
  expect(await state(page)).toEqual(value);
  await tap(page, '[data-market-style=auction][data-market-reserve="100"]');
  await tap(page, '[data-act=confirm]');
  const quoted = await state(page);
  expect(quoted.money).toBe(value.money - 5);
  expect(quoted.rng).toBe(value.rng);
  expect(quoted.cargoGrid).toEqual(value.cargoGrid);
  expect(quoted.market.offers[0].bids).toHaveLength(3);
  await expect(page.locator('.npc-bids li')).toHaveCount(3);
  await page.reload();
  await page.waitForFunction(() => window.__SALVAGE__);
  expect(await state(page)).toEqual(quoted);
  await tap(page, '[data-tab=shop]');
  await tap(page, '[data-act=market]');
  await expect(page.locator('.npc-bids li')).toHaveCount(3);
  await expect(page.locator('[data-market-style]')).toHaveCount(0);
  await tap(page, '#back');
  await expect(page.locator('h1')).toHaveText('港口商店');
});
test('two windows accept the same offer once, ordinary sale invalidates stale quotes', async ({ page, context }) => {
  await boot(page);
  let value = goods(ship('starter'));
  value = act(E, value, 'marketQuote', { uid: 1, style: 'bold' });
  const offer = value.market.offers[0];
  await load(page, value);
  const other = await context.newPage();
  await boot(other);
  for (const current of [page, other]) {
    await tap(current, '[data-tab=shop]');
    await tap(current, '[data-act=market]');
    await tap(current, '[data-market-select="1"]');
  }
  await Promise.allSettled([page.locator('[data-market-accept]').tap({timeout:1500}), other.locator('[data-market-accept]').tap({timeout:1500})]);
  await expect.poll(async () => (await state(page)).money).toBe(value.money + offer.amount);
  await page.reload();
  await page.waitForFunction(() => window.__SALVAGE__);
  const saved = await state(page);
  expect(saved.ledger.filter(row => row.category === 'marketSale')).toHaveLength(1);
  expect(saved.cargo.some(item => item.uid === 1)).toBe(false);
  expect(saved.market.offers[0].status).toBe('sold');
  await other.close();
});
test('failed storage cannot retain a quote, consume RNG, charge fee or lose cargo', async ({ page }) => {
  await boot(page);
  const value = goods(ship('starter'));
  await load(page, value);
  await page.evaluate(() => {
    window.v05OriginalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      const request = window.v05OriginalPut.call(this, value, key);
      if (key === 'current' && value.game.market.offers.length) {
        const transaction = this.transaction;
        queueMicrotask(() => { try { transaction.abort(); } catch {} });
      }
      return request;
    };
  });
  await tap(page, '[data-tab=shop]');
  await tap(page, '[data-act=market]');
  await tap(page, '[data-market-style=auction][data-market-reserve="100"]');
  await tap(page, '[data-act=confirm]');
  await expect(page.locator('#storage-warning')).toBeVisible();
  expect(await state(page)).toEqual(value);
  expect((await archive(page, 'current')).game).toEqual(value);
  await page.reload();
  await page.waitForFunction(() => window.__SALVAGE__);
  expect(await state(page)).toEqual(value);
});
test('new save and player UI reveal no unencountered event or egg checklist', async ({ page }) => {
  await boot(page);
  const value = await state(page);
  expect(value.discoveries).toEqual({ encounters: [], eggs: [], mementoClaimed: false });
  const dom = await page.locator('body').innerText();
  const exported = JSON.stringify(value);
  for (const text of [...Object.values(E.NewEncounters.eggs), ...Object.values(E.NewEncounters.metadata).map(data => data[0])]) {
    expect(dom).not.toContain(text);
    expect(exported).not.toContain(text);
  }
  await tap(page, '[data-tab=fleet]');
  await expect(page.locator('.hold-plan')).toBeVisible();
  const before = await state(page);
  await tap(page, '#back');
  await page.reload();
  await page.waitForFunction(() => window.__SALVAGE__);
  expect(await state(page)).toEqual(before);
});
test('largest BC hold keeps board, rotation and confirmation usable with large text and safe spaces', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => {
    document.documentElement.style.fontSize = '18px';
    const style = document.createElement('style');
    style.textContent = '.safe{height:44px!important}.cargo-save-panel{padding-bottom:24px!important}';
    document.head.append(style);
  });
  await load(page, goods(ship('heavy', 1)));
  await tap(page, '[data-tab=cargo]');
  await tap(page, '[data-cargo-pick="4"]');
  const metrics = await page.locator('.cargo-board,[data-cargo-rotate],[data-cargo-arrange],[data-cargo-save]').evaluateAll(elements => elements.map(element => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, right: rect.right, y: rect.y, bottom: rect.bottom, width: rect.width, height: rect.height };
  }));
  for (const rect of metrics) {
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThanOrEqual(page.viewportSize().width);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.bottom).toBeLessThanOrEqual(page.viewportSize().height);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
