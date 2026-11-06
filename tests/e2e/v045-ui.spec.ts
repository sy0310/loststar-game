import {expect, test, type Page} from '@playwright/test';
import {advanceFusion, createFusion} from '../../src/fusion/domain';
import type {FusionSave} from '../../src/fusion/contracts';
import {firstPlanetFixture} from '../../scripts/firstplanet_fixtures';
import {renewalPagesFixture} from '../../scripts/renewal_fixtures';
import {openABaseFacility, openACurio, openAFlow, openAProject} from './a-navigation';

const epoch = 1800000000000;
const database = 'loststar.fusion.firstplanet.v037';
const ids = ['receipt', 'tape', 'nested', 'stamp', 'cosmic-parcel', 'bell'] as const;
test.use({hasTouch: true, isMobile: true});

async function read(page: Page): Promise<FusionSave> {
  return page.evaluate(name => new Promise<FusionSave>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, get = db.transaction('archive').objectStore('archive').get('current');
      get.onsuccess = () => {db.close();resolve(get.result);};
      get.onerror = () => {db.close();reject(get.error);};
    };
  }), database);
}

async function seed(page: Page, state: FusionSave) {
  await page.goto('/tests/fixtures/fusion-store.html');
  await page.evaluate(({database, state}) => new Promise<void>((resolve, reject) => {
    localStorage.setItem('loststar.save.v1', 'A-REVIEW-ORIGINAL-SOURCE');
    const request = indexedDB.open(database, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('archive');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('archive', 'readwrite');
      tx.objectStore('archive').put(state, 'current');
      tx.objectStore('archive').put({raw: 'A-REVIEW-ORIGINAL-SOURCE'}, 'backup/a-review');
      tx.oncomplete = () => {db.close();resolve();};
      tx.onerror = () => {db.close();reject(tx.error);};
    };
  }), {database, state});
}

async function open(page: Page, state = createFusion(epoch + 1000, null, {journey: true, seed: 4517})) {
  await seed(page, state);
  await page.goto('/?sample=first-planet');
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  await page.waitForLoadState('networkidle');
  await page.clock.runFor(300);
}

async function step(page: Page, milliseconds: number) {
  await page.clock.fastForward(Math.max(0, milliseconds - 200));
  await page.clock.runFor(Math.min(200, milliseconds));
  const cutoff = await page.evaluate(() => Date.now() - 500);
  await expect.poll(async () => (await read(page)).game.lastAt).toBeGreaterThanOrEqual(cutoff);
}

function normalized(state: FusionSave) {
  return JSON.parse(JSON.stringify(state, (key, value) => key === 'storageRevision' ? undefined : value));
}

test.beforeEach(async ({page}) => {
  await page.clock.install({time: new Date(epoch)});
  await page.clock.pauseAt(new Date(epoch + 1000));
});

test('A首页安静安全留白、三个主导航、一个真实目标和明确可选助力', async ({page}) => {
  await open(page);
  await expect(page.locator('.fu-nav > button')).toHaveCount(3);
  await expect(page.locator('.fu-nav')).toHaveText(/探索\s*收藏\s*基地/);
  await expect(page.locator('.fu-objective h1')).toHaveCount(1);
  await expect(page.locator('#fusion-objective')).toContainText('旧分拣站为什么夜里会自己开工');
  await expect(page.locator('#fusion-objective-progress')).toHaveText('先听听箱堆里的回声');
  await expect(page.locator('#fusion-assist')).toHaveText('点击助力');
  await expect(page.locator('#fusion-assist-note')).toContainText('不点也会继续探索');
  await expect(page.locator('#fusion-explore button[data-drawer], #fusion-explore #fusion-map, #fusion-explore #fusion-wallet, #fusion-explore #fusion-settings')).toHaveCount(0);
  await expect(page.locator('.fu-journey-intro')).toHaveCount(0);
  const sky = await page.locator('.fu-safe-sky').boundingBox();
  const header = await page.locator('.fu-header').boundingBox();
  expect(sky!.height).toBeGreaterThanOrEqual(25);
  expect(sky!.y + sky!.height).toBeLessThanOrEqual(header!.y + 1);
  expect(await page.locator('#fusion-app').innerText()).not.toMatch(/宝石|体力|2\s*\/\s*5|5\s*\/\s*5|12:30/);
  expect(await page.locator('body').ariaSnapshot()).not.toMatch(/回声菌星|倒置海星|钟摆荒原星|无人游乐星|未签收之星|六颗|6颗/);
});

test('A手记只投影已取得线索，不虚构五条目标或把上夜标成当前周期完成', async ({page}) => {
  const fixture = renewalPagesFixture(epoch + 1000);
  await open(page, fixture.state);
  await openAFlow(page, 'tap');
  const expected = fixture.state.progression.sorting.facts.length
    + Number(fixture.state.receipt.evidenceIds.includes('field-pipe-scan'))
    + Number(fixture.state.receipt.evidenceIds.includes('field-warehouse-arrival'));
  await expect(page.locator('#fusion-objective-progress')).toHaveText(`已留存${expected}条现场线索`);
  await expect(page.locator('#fusion-flow-content > details.fu-flow-clues > p')).toHaveCount(expected);
  await expect(page.locator('#fusion-flow-timeline > li')).toHaveCount(4);
  const current = await page.locator('#fusion-flow-timeline [aria-current="step"]').getAttribute('data-flow-step');
  expect(current).toBeTruthy();
  const currentIndex = ['day', 'dusk', 'night', 'dawn'].indexOf(current!);
  const reached = await page.locator('#fusion-flow-timeline > li').evaluateAll(nodes => nodes.map(n => n.getAttribute('data-reached')));
  expect(reached).toEqual(['day', 'dusk', 'night', 'dawn'].map((_, index) => String(index <= currentIndex)));
  await expect(page.locator('#fusion-field-drawer')).not.toContainText(/\d\s*\/\s*5/);
});

test('A同球自然跨白昼黄昏夜间清晨，同一手记不自动弹开或跳新页面', async ({page}) => {
  await open(page);
  const canvas = await page.locator('#fusion-world canvas').elementHandle();
  for (const [period, elapsed] of [['day', 1000], ['dusk', 229000], ['night', 241000], ['dawn', 301000]] as const) {
    const current = (await read(page)).game.world.elapsedMs;
    if (elapsed > current) await step(page, elapsed - current);
    await expect(page.locator('#fusion-field-drawer')).toBeHidden();
    await expect(page.locator('#fusion-drawer')).toBeHidden();
    await expect(page.locator('.fu-nav [data-tab="explore"]')).toHaveAttribute('aria-current', 'page');
    expect(await canvas!.evaluate(c => c === document.querySelector('#fusion-world canvas'))).toBe(true);
    await openAFlow(page, 'tap');
    await expect(page.locator('#fusion-flow-timeline [aria-current="step"]')).toHaveAttribute('data-flow-step', period);
    await page.locator('#fusion-field-close').tap();
  }
  expect((await read(page)).game.world.settledNights).toBe(1);
});

test('A展开手记完整contain球体，留白不命中，真实地表触控仍按原工作排队', async ({page}) => {
  await open(page);
  await openAFlow(page, 'tap');
  const geometry = await page.locator('#fusion-world canvas').evaluate((canvas: HTMLCanvasElement) => {
    const box = canvas.getBoundingClientRect(), shell = canvas.closest('.fu-world-shell')!.getBoundingClientRect();
    const scale = Math.min(box.width / canvas.width, box.height / canvas.height);
    const content = {x: box.left + (box.width - canvas.width * scale) / 2, y: box.top + (box.height - canvas.height * scale) / 2,
      width: canvas.width * scale, height: canvas.height * scale};
    const pick = (window as any).__FUSION__.pickAtClient;
    const ground = [[416, 610], [460, 600], [380, 600], [430, 550]].map(([x, y]) => ({x: content.x + x * scale, y: content.y + y * scale}))
      .find(point => pick(point.x, point.y).kind === 'planet');
    const margin = content.x - box.left > 2 ? {x: box.left + 1, y: box.top + box.height / 2}
      : content.y - box.top > 2 ? {x: box.left + box.width / 2, y: box.top + 1} : null;
    return {fit: getComputedStyle(canvas).objectFit, content, shell: {top: shell.top, left: shell.left, right: shell.right, bottom: shell.bottom}, ground, margin,
      marginKind: margin ? pick(margin.x, margin.y).kind : null};
  });
  expect(geometry.fit).toBe('contain');
  expect(geometry.content.x).toBeGreaterThanOrEqual(geometry.shell.left - 1);
  expect(geometry.content.y).toBeGreaterThanOrEqual(geometry.shell.top - 1);
  expect(geometry.content.x + geometry.content.width).toBeLessThanOrEqual(geometry.shell.right + 1);
  expect(geometry.content.y + geometry.content.height).toBeLessThanOrEqual(geometry.shell.bottom + 1);
  expect(geometry.ground).toBeTruthy();
  const before = (await read(page)).game.assist?.actionSeq ?? 0;
  if (geometry.margin) {
    expect(geometry.marginKind).toBe('space');
    await page.touchscreen.tap(geometry.margin.x, geometry.margin.y);
    expect((await read(page)).game.assist?.actionSeq ?? 0).toBe(before);
  }
  await page.touchscreen.tap(geometry.ground!.x, geometry.ground!.y);
  await expect.poll(async () => (await read(page)).game.assist?.actionSeq ?? 0).toBe(before + 1);
  await expect(page.locator('#fusion-drawer')).toBeHidden();
});

test('A六件三态名称简明，C只突出代表免费动作，预览和返回不改原权益', async ({page}) => {
  test.setTimeout(60000);
  await open(page, firstPlanetFixture(epoch + 1000, 2, 'stabilized').state);
  const before = await read(page);
  for (const id of ids) {
    await openACurio(page, id, 'tap');await page.clock.runFor(100);
    await expect(page.locator('.fu-treatment-stages span')).toHaveText(['刚获得', '清理后', '升级完成']);
    await expect(page.locator('#fusion-exhibit-interaction button:visible')).toHaveCount(1);
    await expect(page.locator('#fusion-try')).toBeEnabled();
    await expect(page.locator('#fusion-treatment-actions button:visible')).toHaveCount(0);
    await expect(page.locator('#fusion-drawer [data-base-ability], #fusion-drawer [data-growth]')).toHaveCount(0);
    await page.locator('[data-image-preview-condition="found"]').tap();
    await expect(page.locator('#fusion-try')).toBeHidden();
    await expect(page.locator('#fusion-state-preview')).toBeVisible();
    await page.locator('#fusion-state-preview-close').tap();
    await page.locator('#fusion-back-to-collection').tap();
    await expect(page.locator('#fusion-drawer')).toBeHidden();
    await expect(page.locator('.fu-nav [data-tab="collection"]')).toHaveAttribute('aria-current', 'page');
  }
  const after = await read(page);
  expect(after.game.resources).toBe(advanceFusion(before, after.game.lastAt).game.resources);
  expect(after.game.growth).toEqual(before.game.growth);
  expect(after.progression.abilities).toEqual(before.progression.abilities);
  expect(ids.map(id => id === 'receipt' ? after.receipt.condition : after.curios[id].condition)).toEqual(ids.map(() => 'stabilized'));
});

test('A旧27049档设施收拢仍可达，刷新保留原来源和全部已购权益', async ({page}) => {
  const fixture = renewalPagesFixture(epoch + 60000);
  // Disclosed synthetic legacy balance; all ownership came from ordinary reducers.
  fixture.state.game.resources = 27049;fixture.state.receipt.parts = 27049;
  await open(page, fixture.state);
  const before = await read(page);
  for (const facility of ['upgrades', 'build', 'research', 'station', 'map', 'wallet', 'settings'] as const) {
    await openABaseFacility(page, facility, 'tap');
    await expect(page.locator('#fusion-drawer')).toBeVisible();
    await page.locator('#fusion-close').tap();
  }
  await page.reload();await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  const after = await read(page);
  expect(normalized(after)).toEqual(normalized(before));
  expect(await page.evaluate(() => localStorage.getItem('loststar.save.v1'))).toBe('A-REVIEW-ORIGINAL-SOURCE');
  const backup = await page.evaluate(name => new Promise<any>(resolve => {
    const request = indexedDB.open(name, 1);request.onsuccess = () => {const db = request.result, get = db.transaction('archive').objectStore('archive').get('backup/a-review');get.onsuccess = () => {db.close();resolve(get.result);};};
  }), database);
  expect(backup).toEqual({raw: 'A-REVIEW-ORIGINAL-SOURCE'});
});

test('A归航同流领取一次，刷新和再次打开不复制奖励或物理升级', async ({page}) => {
  const offline = advanceFusion(createFusion(epoch - 1200000, null, {journey: true, seed: 4533}), epoch + 1000, true);
  expect(offline.game.pendingReturn).toBeTruthy();
  await open(page, offline);
  await expect(page.locator('#fusion-drawer')).toBeHidden();
  await expect(page.locator('#fusion-field-drawer')).toBeHidden();
  await openAFlow(page, 'tap');
  await expect(page.locator('#fusion-claim')).toBeVisible();
  const before = await read(page), cargo = before.game.pendingReturn!.resources;
  await page.locator('#fusion-claim').tap();
  await expect.poll(async () => (await read(page)).game.pendingReturn).toBeNull();
  const claimed = await read(page);
  expect(claimed.game.resources).toBe(before.game.resources + cargo);
  expect(claimed.receipt.condition).toBe('found');
  expect(Object.values(claimed.curios).every(curio => curio.condition === 'found')).toBe(true);
  await page.reload();await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  await openAFlow(page, 'tap');
  await expect(page.locator('#fusion-claim')).toHaveCount(0);
  expect((await read(page)).game.resources).toBe(claimed.game.resources);
});

test('A已购归档在同一主世界只读回看，当前探索继续且没有任何额外结算', async ({page}) => {
  await open(page, renewalPagesFixture(epoch + 1000).state);
  const before = await read(page);
  expect(before.projects).toContain('archive');
  await openAProject(page, 'archive', true, 'tap');
  await expect(page.locator('#fusion-drawer')).toBeHidden();
  await expect(page.locator('#fusion-field-drawer')).toBeVisible();
  await page.locator('#fusion-replay-night').tap();
  const replay = page.locator('#fusion-flow-replay canvas');
  await expect(replay).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#fusion-world canvas')).toBeHidden();
  await expect(page.locator('#fusion-period')).toHaveText('昨夜回看');
  await page.clock.runFor(1500);
  const after = await read(page);
  expect(normalized(after)).toEqual(normalized(advanceFusion(before, after.game.lastAt)));
  await page.locator('#fusion-assist').tap();
  await expect(page.locator('#fusion-flow-replay')).toBeHidden();
  await expect(page.locator('#fusion-world canvas')).toBeVisible();
  expect((await read(page)).game.world.settledNights).toBe(after.game.world.settledNights);
});
