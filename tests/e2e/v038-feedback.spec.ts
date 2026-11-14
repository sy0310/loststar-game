import {firstPlanetFacilities} from '../../src/fusion/facilities';
import {expect, test, type Page} from '@playwright/test';
import {feedbackFixture} from '../../scripts/feedback_fixtures';
import {v034NightCamera} from '../../src/review/v034-night-stage';

const epoch = 1800000000000;
const databaseName = 'loststar.fusion.firstplanet.v037';
test.use({hasTouch: true, isMobile: true});

async function saved(page: Page) {
  return page.evaluate(name => new Promise<any>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('archive', 'readonly').objectStore('archive').get('current');
      get.onsuccess = () => {resolve(get.result);db.close();};
      get.onerror = () => {reject(get.error);db.close();};
    };
  }), databaseName);
}
async function step(page: Page, milliseconds: number) {
  await page.clock.fastForward(Math.max(0, milliseconds - 150));
  await page.clock.runFor(Math.min(150, milliseconds));
  await expect.poll(async () => (await saved(page)).game.lastAt).toBeGreaterThanOrEqual(await page.evaluate(() => Date.now() - 500));
}
async function open(page: Page, kind: Parameters<typeof feedbackFixture>[0] = 'unrevealed') {
  await page.clock.install({time: new Date(epoch)});
  await page.clock.pauseAt(new Date(epoch + 1000));
  const fixture = feedbackFixture(kind, epoch + 1000);
  await page.goto('/tests/fixtures/fusion-store.html');
  await page.evaluate(({name, state}) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('archive');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, tx = db.transaction('archive', 'readwrite');
      tx.objectStore('archive').put(state, 'current');
      tx.objectStore('archive').put({kind: 'source-backup', raw: 'preserved-v037-source'}, 'backup/0');
      tx.oncomplete = () => {db.close();resolve();};
      tx.onerror = () => {reject(tx.error);db.close();};
    };
  }), {name: databaseName, state: fixture.state});
  await page.goto('/?sample=first-planet');
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  await page.clock.runFor(300);
  await expect(page.locator('.fu-journey-intro')).toHaveCount(0);
  return fixture;
}
async function terrainTap(page: Page) {
  const point = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('#fusion-world canvas')!;
    const box = canvas.getBoundingClientRect();
    for (const [px, py] of [[416, 610], [460, 600], [380, 600]]) {
      const scale=Math.min(box.width/canvas.width,box.height/canvas.height);
      const x=box.x+(box.width-canvas.width*scale)/2+px*scale,y=box.y+(box.height-canvas.height*scale)/2+py*scale;
      if ((window as any).__FUSION__.pickAtClient(x, y).kind === 'planet') return {x, y};
    }
    throw new Error('No actual terrain hit');
  });
  await page.touchscreen.tap(point.x, point.y);
}

test('助力收到动作与实际工作分别推进，固定扫描帧已替换，触控高亮与键盘焦点正确', async ({page}) => {
  await open(page);
  const canvas = page.locator('#fusion-world canvas');
  for (const selector of ['#fusion-tap', '#fusion-world', '#fusion-world canvas']) {
    expect(await page.locator(selector).evaluate(element => getComputedStyle(element).getPropertyValue('-webkit-tap-highlight-color'))).toBe('rgba(0, 0, 0, 0)');
  }
  const before = await saved(page);
  await terrainTap(page);
  await expect.poll(async () => (await saved(page)).game.assist.actionSeq).toBe(1);
  expect((await saved(page)).game.resources).toBe(before.game.resources);
  await page.clock.runFor(100);
  expect(Number(await canvas.getAttribute('data-robot-received'))).toBeGreaterThan(.05);
  await step(page, 1500);
  expect((await saved(page)).game.assist.appliedWorkMs).toBeGreaterThan(0);
  expect(Number(await canvas.getAttribute('data-robot-received'))).toBe(0);
  await step(page, 2400);
  await expect(canvas).toHaveAttribute('data-action', 'scan');
  const angle = await canvas.getAttribute('data-robot-scan-angle');
  const frame = await canvas.screenshot();
  await page.clock.runFor(250);
  expect(await canvas.getAttribute('data-robot-scan-angle')).not.toBe(angle);
  expect(await canvas.screenshot()).not.toEqual(frame);
  await expect(canvas).toHaveAttribute('data-robot-render-passes', '1');
  await expect(canvas).toHaveAttribute('data-patrol-carrier-visible', 'false');
  await page.keyboard.press('Tab');
  for (let index = 0; index < 16 && !await page.locator('#fusion-tap').evaluate(element => element === document.activeElement); index++) await page.keyboard.press('Tab');
  expect(await page.locator('#fusion-tap').evaluate(element => ({focused: element === document.activeElement, width: getComputedStyle(element).outlineWidth}))).toEqual({focused: true, width: '2px'});
  expect(await page.locator('body').ariaSnapshot()).not.toMatch(/回声菌星|倒置海星|钟摆荒原星|无人游乐星|未签收之星/);
});

test('现有周目和备份刷新继续，分拣机保持同实例，区域雾只随真实工作揭露', async ({page}) => {
  const fixture = await open(page, 'partial');
  const initial = await saved(page);
  const canvas = page.locator('#fusion-world canvas');
  const fog = await page.evaluate(() => (window as any).__FUSION__.surfaceMetrics());
  expect(fog.scale).toBe('regional');
  expect(fog.sites.map((site: any) => site.width)).toEqual([156, 196, 274]);
  expect(initial.game.resources).toBe(fixture.state.game.resources);
  expect(initial.journey.seed).toBe(fixture.state.journey!.seed);
  await expect(canvas).toHaveAttribute('data-legacy-sorter-count', '0');
  await expect(canvas).toHaveAttribute('data-sorting-entity-id', 'parcel/old-sorting');
  await expect(canvas).toHaveAttribute('data-security-entity-id', 'parcel/security-mast');
  await step(page, 32000);
  const earned = await saved(page);
  expect(earned.journey.sites.every((site: any) => site.revealedAt !== null)).toBe(true);
  await page.reload();
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await page.clock.runFor(300);
  const resumed = await saved(page);
  expect(resumed.journey).toEqual(earned.journey);
  expect(resumed.game.collection).toEqual(earned.game.collection);
  expect(resumed.game.upgrades).toEqual(earned.game.upgrades);
  expect(resumed.game.resources).toBe(earned.game.resources);
  const backup = await page.evaluate(name => new Promise<any>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onsuccess = () => {const db = request.result;const get = db.transaction('archive').objectStore('archive').get('backup/0');get.onsuccess = () => {resolve(get.result);db.close();};};
    request.onerror = () => reject(request.error);
  }), databaseName);
  expect(backup.raw).toBe('preserved-v037-source');
});

test('夜间仍有收容匣和注册安保灯，点按只关注实际事件，晨间仍结算', async ({page}) => {
  await open(page, 'night');
  const canvas = page.locator('#fusion-world canvas');
  await expect(canvas).toHaveAttribute('data-period', 'night');
  await expect(canvas).toHaveAttribute('data-patrol-carrier-visible', 'true');
  await expect(canvas).toHaveAttribute('data-security-emitter', JSON.stringify(firstPlanetFacilities.securityMast.emitter));
  const gait = await canvas.getAttribute('data-robot-gait-frame');
  await page.clock.runFor(350);
  expect(await canvas.getAttribute('data-robot-gait-frame')).not.toBe(gait);
  const before = await saved(page);
  await terrainTap(page);
  await page.clock.runFor(100);
  const after = await saved(page);
  expect(after.game.assist?.actionSeq ?? 0).toBe(before.game.assist?.actionSeq ?? 0);
  expect(after.game.assist?.enqueuedWorkMs ?? 0).toBe(before.game.assist?.enqueuedWorkMs ?? 0);
  expect(Number(await canvas.getAttribute('data-robot-received'))).toBe(0);
  await step(page, 58000);
  expect((await saved(page)).game.world.settledNights).toBeGreaterThan(before.game.world.settledNights);
  await expect(canvas).toHaveAttribute('data-legacy-sorter-count', '0');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('返程手臂裁剪后的门口空地按真实alpha命中，单次触控可助力', async ({page}) => {
  await open(page);
  await step(page, 9300);
  const canvas = page.locator('#fusion-world canvas');
  await expect(canvas).toHaveAttribute('data-action', 'return');
  const world = {x: 302.06, y: 443.2};
  const camera = v034NightCamera;
  const logical = {x: 32 + camera.x + (world.x - camera.x) * camera.scale + (camera.offsetX ?? 0),
    y: camera.y + (world.y - camera.y) * camera.scale + (camera.offsetY ?? 0)};
  const point = await canvas.evaluate((element: HTMLCanvasElement, logical) => {
    const box = element.getBoundingClientRect();
    const scale=Math.min(box.width/element.width,box.height/element.height);
    const x=box.x+(box.width-element.width*scale)/2+logical.x*scale,y=box.y+(box.height-element.height*scale)/2+logical.y*scale;
    return {x, y, hit: (window as any).__FUSION__.pickAtClient(x, y)};
  }, logical);
  expect(point.hit.kind).toBe('planet');
  await page.touchscreen.tap(point.x, point.y);
  await expect.poll(async () => (await saved(page)).game.assist?.actionSeq).toBe(1);
  await expect(page.locator('#fusion-drawer')).not.toBeVisible();
  await expect(canvas).toHaveAttribute('data-robot-render-passes', '1');
});
