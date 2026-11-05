import {expect, test, type Page} from '@playwright/test';
import {firstPlanetFixture, type FirstPlanetFixtureStage} from '../../scripts/firstplanet_fixtures';
import {advanceFusion} from '../../src/fusion/domain';
import type {FusionSave} from '../../src/fusion/contracts';

const epoch = 1800000000000;
const database = 'loststar.fusion.firstplanet.v037';
const paper = '#fusion-paper-focus';
test.use({hasTouch: true, isMobile: true});

async function readArchive(page: Page): Promise<FusionSave> {
  return page.evaluate(name => new Promise<FusionSave>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('archive', 'readonly').objectStore('archive').get('current');
      get.onsuccess = () => {db.close();resolve(get.result);};
      get.onerror = () => {db.close();reject(get.error);};
    };
  }), database);
}

async function seedArchive(page: Page, state: FusionSave) {
  await page.goto('/tests/fixtures/fusion-store.html');
  await page.evaluate(({name, state}) => new Promise<void>((resolve, reject) => {
    localStorage.setItem('loststar.ui.firstplanet.v037.intro', String(state.journey!.seed));
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('archive');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('archive', 'readwrite');
      tx.objectStore('archive').put(state, 'current');
      tx.oncomplete = () => {db.close();resolve();};
      tx.onerror = () => {db.close();reject(tx.error);};
    };
  }), {name: database, state});
}

async function openArchive(page: Page, stage: FirstPlanetFixtureStage, held = false) {
  await page.clock.install({time: new Date(epoch)});
  await page.clock.pauseAt(new Date(epoch + 1000));
  // The held cases inspect UI gates without automatic earnings. The running C
  // cases use ordinary model time and reconcile its income separately below.
  const fixture = firstPlanetFixture(epoch + (held ? 60000 : 1000), 2, stage, {
    receiptAbility: stage === 'stabilized' ? 1 : 0,
    tapeAbility: stage === 'stabilized' ? 1 : 0,
  });
  await seedArchive(page, fixture.state);
  await page.goto('/?sample=first-planet');
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  await page.waitForLoadState('networkidle');
  await page.clock.runFor(300);
  await page.locator('[data-tab="collection"]').tap();
  return fixture;
}

async function openReceipt(page: Page) {
  await page.locator('#fusion-collection-list [data-detail="receipt"]').tap();
  await expect(page.locator(paper)).toHaveAttribute('data-ready', 'true');
  await page.clock.runFor(120);
}

async function snapshot(page: Page) {
  return page.locator(paper).evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL('image/png'));
}

function expectNoInteractionChargeOrReward(before: FusionSave, after: FusionSave) {
  const automatic = advanceFusion(before, after.game.lastAt);
  expect(after.game.resources).toBe(automatic.game.resources);
  expect(after.game.station.grossIncome).toBe(automatic.game.station.grossIncome);
  expect(after.game.station.repairSpent).toBe(automatic.game.station.repairSpent);
  expect(after.game.cycles).toBe(automatic.game.cycles);
  expect(after.game.collection).toEqual(before.game.collection);
  expect(after.game.growth).toEqual(before.game.growth);
  expect(after.progression.payments).toEqual(before.progression.payments);
  expect(after.progression.abilities).toEqual(before.progression.abilities);
  expect(after.progression.sorting.facts).toEqual(before.progression.sorting.facts);
  expect(after.records).toEqual(before.records);
  expect(after.receipt.transactions).toEqual(before.receipt.transactions);
  expect(after.receipt.observations).toEqual(before.receipt.observations);
  expect(after.receipt.evidenceIds).toEqual(before.receipt.evidenceIds);
  expect(after.receipt.verifiedEvidenceIds).toEqual(before.receipt.verifiedEvidenceIds);
}

for (const stage of ['found', 'clean'] as const) {
  test(`收据${stage === 'found' ? 'A发现' : 'B整理'}态隐藏展品互动，失效的旧按钮事件也不启动纸张操作`, async ({page}) => {
    await openArchive(page, stage, true);
    await openReceipt(page);
    await expect(page.locator(paper)).toHaveAttribute('data-condition', stage);
    await expect(page.locator(paper)).toHaveAttribute('data-focus', 'workbench');
    await expect(page.locator('#fusion-exhibit-interaction')).toBeHidden();
    await expect(page.locator('#fusion-try')).toBeHidden();
    await expect(page.locator('#fusion-try')).toBeDisabled();
    const before = await readArchive(page);

    // Simulate an enabled legacy button's delayed click. Keeping it hidden but
    // removing disabled makes this exercise the state gate, not native blocking.
    await page.locator('#fusion-try').evaluate((button: HTMLButtonElement) => {
      button.disabled = false;
      button.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    });
    await page.clock.runFor(350);
    const after = await readArchive(page);
    expect(after.receipt).toEqual(before.receipt);
    expect(after.taskSeq).toBe(before.taskSeq);
    expectNoInteractionChargeOrReward(before, after);
    await expect(page.locator('#fusion-curio-response')).toBeHidden();
    await expect(page.locator('#fusion-exhibit-interaction')).toBeHidden();
    await expect(page.locator('#fusion-try')).toBeDisabled();
  });
}

test('收据C在实际已购玻璃柜中读出票面，两次真实试验不收费、不发奖、不制造记录', async ({page}) => {
  await openArchive(page, 'stabilized');
  await openReceipt(page);
  const canvas = page.locator(paper), action = page.locator('#fusion-try');
  await expect(canvas).toHaveAttribute('data-focus', 'glass-case');
  await expect(canvas).toHaveAttribute('data-receipt-glass-fallback', 'false');
  await expect(canvas).toHaveAttribute('data-receipt-case-level', '2');
  await expect(page.locator('#fusion-exhibit-interaction')).toBeVisible();
  await expect(page.locator('#fusion-exhibit-interaction')).toHaveAttribute('data-focus', 'glass-case');
  await expect(action).toHaveText('读出票面');
  await expect(page.locator('#fusion-exhibit-note')).toHaveText('不耗零件');
  const before = await readArchive(page), actionIds: string[] = [];

  for (let replay = 0; replay < 2; replay++) {
    await expect(action).toBeEnabled();
    const idle = await snapshot(page);
    await action.tap();
    await expect.poll(async () => (await readArchive(page)).receipt.activeAction?.kind).toBe('try');
    const started = await readArchive(page);
    actionIds.push(started.receipt.activeAction!.id);
    await expect(action).toBeDisabled();
    await page.clock.runFor(450);
    await expect(canvas).toHaveAttribute('data-restoration-phase', 'trying');
    await expect(canvas).toHaveAttribute('data-focus', 'glass-case');
    expect(await snapshot(page)).not.toBe(idle);

    if (replay === 0) {
      // An already-running model action must survive a stale enabled click.
      await action.evaluate((button: HTMLButtonElement) => {
        button.disabled = false;
        button.dispatchEvent(new MouseEvent('click', {bubbles: true}));
      });
      await page.clock.runFor(100);
      const stillRunning = await readArchive(page);
      expect(stillRunning.receipt.activeAction?.id).toBe(started.receipt.activeAction!.id);
      expect(stillRunning.taskSeq).toBe(started.taskSeq);
    }

    await page.clock.runFor(2500);
    await expect.poll(async () => (await readArchive(page)).receipt.activeAction).toBeUndefined();
    await expect(action).toBeEnabled();
  }

  const after = await readArchive(page);
  expect(new Set(actionIds).size).toBe(2);
  expect(after.receipt.completedActionIds.slice(before.receipt.completedActionIds.length)).toEqual(actionIds);
  expect(after.taskSeq - before.taskSeq).toBe(2);
  expect(after.receipt.condition).toBe('stabilized');
  expectNoInteractionChargeOrReward(before, after);
});

test('收据C柜图失败时新纸工作台继续运行，显式重试恢复原已购柜且不中断试验', async ({page}) => {
  await page.route('**/case-2-front.webp*', route => route.request().resourceType() === 'image' ? route.abort() : route.continue());
  await openArchive(page, 'stabilized');
  await expect(page.locator('#museum-canvas')).toHaveAttribute('data-ready', 'error');
  await openReceipt(page);
  const canvas = page.locator(paper);
  await expect(canvas).toHaveAttribute('data-condition', 'stabilized');
  await expect(canvas).toHaveAttribute('data-focus', 'workbench');
  await expect(canvas).toHaveAttribute('data-receipt-glass-fallback', 'true');
  expect(await canvas.getAttribute('data-receipt-case-level')).toBeNull();
  const retry = page.locator('#fusion-treatment-retry');
  await expect(retry).toBeVisible();
  await expect(retry).toHaveText('重试展柜');
  const frame = Number(await canvas.getAttribute('data-frame'));
  const before = await readArchive(page);
  await page.locator('#fusion-try').tap();
  await expect.poll(async () => (await readArchive(page)).receipt.activeAction?.kind).toBe('try');
  await page.clock.runFor(400);
  expect(Number(await canvas.getAttribute('data-frame'))).toBeGreaterThan(frame);
  await expect(canvas).toHaveAttribute('data-restoration-phase', 'trying');
  const running = await readArchive(page), workbench = await snapshot(page);

  await page.unroute('**/case-2-front.webp*');
  await retry.tap();
  await page.waitForLoadState('networkidle');
  await page.clock.runFor(200);
  await expect(canvas).toHaveAttribute('data-focus', 'glass-case');
  await expect(canvas).toHaveAttribute('data-receipt-glass-fallback', 'false');
  await expect(canvas).toHaveAttribute('data-receipt-case-level', '2');
  await expect(retry).toBeHidden();
  await expect(canvas).toHaveAttribute('data-restoration-phase', 'trying');
  expect(await snapshot(page)).not.toBe(workbench);
  const after = await readArchive(page);
  expect(after.receipt.activeAction?.id).toBe(running.receipt.activeAction!.id);
  expect(after.receipt.condition).toBe('stabilized');
  expectNoInteractionChargeOrReward(before, after);
});

test('六件完成态使用具体展品动作，处理区没有通用试一试免费按钮', async ({page}) => {
  await openArchive(page, 'stabilized', true);
  const labels = [
    ['receipt', '读出票面'], ['tape', '拉出一截'], ['nested', '打开一层'],
    ['stamp', '盖个邮戳'], ['cosmic-parcel', '敲敲箱盖'], ['bell', '轻按铃铛'],
  ] as const;
  const before = await readArchive(page);
  for (const [id, label] of labels) {
    await page.locator(`#fusion-collection-list [data-detail="${id}"]`).tap();
    const canvas = page.locator(id === 'receipt' ? paper : '#fusion-exhibit-focus');
    await expect(canvas).toHaveAttribute('data-ready', 'true');
    await expect(canvas).toHaveAttribute('data-condition', 'stabilized');
    await expect(page.locator('#fusion-exhibit-interaction')).toBeVisible();
    await expect(page.locator('#fusion-try')).toHaveText(label);
    await expect(page.locator('#fusion-try')).toBeEnabled();
    await expect(page.locator('#fusion-exhibit-note')).toHaveText('不耗零件');
    await expect(page.locator('#fusion-treatment-actions #fusion-try')).toHaveCount(0);
    await expect(page.locator('#fusion-drawer').getByRole('button', {name: /^试一试(?:\s*·\s*免费)?$/})).toHaveCount(0);
    await page.locator('#fusion-close').tap();
  }
  expectNoInteractionChargeOrReward(before, await readArchive(page));
});
