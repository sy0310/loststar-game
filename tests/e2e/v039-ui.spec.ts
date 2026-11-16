import {openACurio, openACloseup} from './a-navigation';
import sharp from 'sharp';
import {expect, test, type Page} from '@playwright/test';
import {feedbackFixture} from '../../scripts/feedback_fixtures';
import {firstPlanetFixture, type FirstPlanetFixtureStage} from '../../scripts/firstplanet_fixtures';
import {advanceFusion, curioPrices, reduceFusion} from '../../src/fusion/domain';
import type {FusionSave} from '../../src/fusion/contracts';
import {curioConditionPresentation, curioTreatmentLabels} from '../../src/fusion/curio-material';

const epoch = 1800000000000;
const databaseName = 'loststar.fusion.firstplanet.v037';
const sourceDatabase = 'loststar.fusion.v1';
test.use({hasTouch: true, isMobile: true});

async function readArchive<T = FusionSave>(page: Page, key = 'current', name = databaseName): Promise<T> {
  return page.evaluate(({name, key}) => new Promise<T>((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('archive', 'readonly').objectStore('archive').get(key);
      get.onsuccess = () => {resolve(get.result);db.close();};
      get.onerror = () => {reject(get.error);db.close();};
    };
  }), {name, key});
}

async function installArchive(page: Page, state: FusionSave, source?: FusionSave) {
  await page.goto('/tests/fixtures/fusion-store.html');
  await page.evaluate(async ({name, state, source, sourceName}) => {
    async function write(databaseName: string, entries: [string, unknown][]) {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('archive');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction('archive', 'readwrite');
        for (const [key, value] of entries) transaction.objectStore('archive').put(value, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      db.close();
    }
    const entries: [string, unknown][] = [['current', state]];
    if (source) {
      localStorage.setItem('loststar.save.v1', JSON.stringify(source.game));
      await write(sourceName, [['current', source]]);
      entries.push(['backup/v039-source', {kind: 'source-backup', sourceDatabase: sourceName, raw: JSON.stringify(source)}]);
    }
    await write(name, entries);
  }, {name: databaseName, state, source, sourceName: sourceDatabase});
}

async function openApp(page: Page) {
  await page.goto('/?sample=first-planet');
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  await page.waitForLoadState('networkidle');
  await page.clock.runFor(300);
  const dismiss = page.locator('#fusion-dismiss-intro');
  if (await dismiss.isVisible()) await dismiss.tap();
}

async function openWorld(page: Page, kind: 'unrevealed' | 'night' = 'unrevealed') {
  await page.clock.install({time: new Date(epoch)});
  await page.clock.pauseAt(new Date(epoch + 1000));
  const fixture = feedbackFixture(kind, epoch + 1000);
  await installArchive(page, fixture.state);
  await openApp(page);
  return fixture;
}

async function step(page: Page, milliseconds: number) {
  await page.clock.fastForward(Math.max(0, milliseconds - 150));
  await page.clock.runFor(Math.min(150, milliseconds));
  const cutoff = await page.evaluate(() => Date.now() - 500);
  await expect.poll(async () => (await readArchive(page)).game.lastAt).toBeGreaterThanOrEqual(cutoff);
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
    throw new Error('No visible terrain pixel is available for a real touch');
  });
  await page.touchscreen.tap(point.x, point.y);
}

async function assertFieldPartition(page: Page) {
  await openACloseup(page,'tap');
  const layout = await page.evaluate(() => {
    const box = (selector: string) => {
      const bounds = document.querySelector(selector)!.getBoundingClientRect();
      return {left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, height: bounds.height};
    };
    return {world: box('.fu-world-shell'), field: box('#fusion-field-drawer'), controls: box('.fu-explore-controls'),
      position: getComputedStyle(document.querySelector('#fusion-field-drawer')!).position, viewport: innerWidth};
  });
  expect(layout.world.height).toBeGreaterThan(100);
  expect(layout.field.height).toBeGreaterThan(44);
  expect(layout.world.bottom).toBeLessThanOrEqual(layout.controls.top + 1);
  expect(layout.controls.bottom).toBeLessThanOrEqual(layout.field.top + 1);
  expect(layout.field.left).toBeGreaterThanOrEqual(0);
  expect(layout.field.right).toBeLessThanOrEqual(layout.viewport);
  expect(['absolute', 'fixed']).not.toContain(layout.position);
  await expect(page.locator('#fusion-drawer')).not.toBeVisible();
  await expect(page.locator('#fusion-inspection-panel')).toBeVisible();
}

test('三次真实接受形成低中高视觉助力，停止后平滑归零且入账仍等于原工作模型', async ({page}) => {
  await openWorld(page);
  const canvas = page.locator('#fusion-world canvas'), before = await readArchive(page);
  const acceptedAt: number[] = [], strengths: number[] = [];
  for (let index = 0; index < 3; index++) {
    await terrainTap(page);
    await expect.poll(async () => (await readArchive(page)).game.assist?.actionSeq).toBe(index + 1);
    acceptedAt.push((await readArchive(page)).game.assist!.acceptedAt.at(-1)!);
    await page.clock.runFor(160);
    await expect(canvas).toHaveAttribute('data-robot-assist-visual-tier', String(index + 1));
    strengths.push(Number(await canvas.getAttribute('data-robot-assist-visual-intensity')));
    expect((await readArchive(page)).game.resources).toBe(before.game.resources);
    if (index < 2) await page.clock.runFor(160);
  }
  expect(strengths[1]).toBeGreaterThan(strengths[0]);
  expect(strengths[2]).toBeGreaterThan(strengths[1]);
  let previous = strengths[2];
  for (const duration of [300, 600, 600, 600, 600, 500]) {
    await page.clock.runFor(duration);
    const intensity = Number(await canvas.getAttribute('data-robot-assist-visual-intensity'));
    expect(intensity).toBeLessThanOrEqual(previous + .001);
    previous = intensity;
  }
  await expect(canvas).toHaveAttribute('data-robot-assist-visual-tier', '0');
  expect(Number(await canvas.getAttribute('data-robot-assist-visual-intensity'))).toBe(0);
  expect(Number(await canvas.getAttribute('data-robot-torso-lean'))).toBe(0);
  // Continue through a real delivery; visual feedback must not add an extra payment.
  await step(page, 8500);
  const after = await readArchive(page);
  let expected = before;
  for (const at of acceptedAt) {
    const result = reduceFusion(expected, {type: 'tap'}, at);
    expect(result.result.ok).toBe(true);
    expected = result.state;
  }
  expected = advanceFusion(expected, after.game.lastAt);
  expect(after.game.assist?.enqueuedWorkMs).toBe(1800);
  // Frame-by-frame integration and one model advance can differ by IEEE-754
  // rounding; keep sub-nanosecond tolerance while checking integer rewards exactly.
  expect(after.game.assist!.appliedWorkMs).toBeCloseTo(expected.game.assist!.appliedWorkMs, 8);
  expect(after.game.cycles).toBeGreaterThan(before.game.cycles);
  expect(after.game.cycles).toBe(expected.game.cycles);
  expect(after.game.resources).toBe(expected.game.resources);
  expect(after.game.station.grossIncome).toBe(expected.game.station.grossIncome);
  expect(after.progression.payments).toEqual(before.progression.payments);
});

test('白天主场景不自动叠近景，观察只在显式展开后占独立布局区', async ({page}) => {
  await openWorld(page);
  await step(page, 12500);
  await expect(page.locator('#fusion-field-drawer')).toBeHidden();
  await expect(page.locator('#fusion-inspection-panel')).toBeHidden();
  await expect(page.locator('#fusion-drawer')).not.toBeVisible();
  await expect(page.locator('#fusion-observe')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#fusion-observe').tap();
  await expect(page.locator('#fusion-field-drawer')).toBeVisible();
  await expect(page.locator('#fusion-observe')).toHaveAttribute('aria-expanded', 'true');
  await assertFieldPartition(page);
  await page.locator('#fusion-field-close').tap();
  await step(page, 1200);
  await expect(page.locator('#fusion-field-drawer')).toBeHidden();
  await expect(page.locator('#fusion-observe')).toHaveAttribute('aria-expanded', 'false');
});

test('夜巡不自动弹近景，巡逻与地表点击可展开但绝不增加助力', async ({page}) => {
  await openWorld(page, 'night');
  const canvas = page.locator('#fusion-world canvas'), before = await readArchive(page);
  await expect(canvas).toHaveAttribute('data-period', 'night');
  await expect(page.locator('#fusion-field-drawer')).toBeHidden();
  await page.locator('#fusion-observe').tap();
  await assertFieldPartition(page);
  await page.locator('#fusion-field-close').tap();
  await terrainTap(page);
  await page.clock.runFor(350);
  await expect(page.locator('#fusion-field-drawer')).toBeVisible();
  await assertFieldPartition(page);
  const after = await readArchive(page);
  for (const key of ['actionSeq', 'enqueuedWorkMs', 'appliedWorkMs', 'pendingWorkMs'] as const) {
    expect(after.game.assist?.[key] ?? 0).toBe(before.game.assist?.[key] ?? 0);
  }
  await expect(canvas).toHaveAttribute('data-robot-assist-visual-tier', '0');
  expect(Number(await canvas.getAttribute('data-robot-received'))).toBe(0);
  expect(after.game.resources).toBe(before.game.resources);
});

test('整理台缺图时禁止空白扣费，资源恢复后可重试原件', async ({page}) => {
  await page.clock.install({time: new Date(epoch)});
  await page.clock.pauseAt(new Date(epoch + 1000));
  const fixture=firstPlanetFixture(epoch+1000,0,'found',{receiptAbility:0,tapeAbility:0});
  await page.route('**/restoration-workbench.webp*',route=>route.request().resourceType()==='image'?route.abort():route.continue());
  await installArchive(page,fixture.state);await openApp(page);
  await page.locator('#fusion-app > .fu-nav [data-tab="collection"]').tap();
  await openACurio(page, 'tape', 'tap');
  await page.waitForLoadState('networkidle');await page.clock.runFor(400);
  await expect(page.locator('#fusion-treatment-retry')).toBeVisible();
  await expect(page.locator('#fusion-curio-primary')).toBeDisabled();
  const before=await readArchive(page);
  expect(before.curios.tape.condition).toBe('found');
  await page.unroute('**/restoration-workbench.webp*');
  await page.locator('#fusion-treatment-retry').tap();
  await page.waitForLoadState('networkidle');await page.clock.runFor(500);
  await expect(page.locator('#fusion-exhibit-focus')).toHaveAttribute('data-ready','true');
  await expect(page.locator('#fusion-treatment-loading')).toBeHidden();
  await expect(page.locator('#fusion-curio-primary')).toBeEnabled();
  const after=await readArchive(page);
  expect(after.curios.tape.condition).toBe('found');
  expect(after.game.resources-before.game.resources).toBe(
    after.game.station.grossIncome-before.game.station.grossIncome-(after.game.station.repairSpent-before.game.station.repairSpent));
  expect(after.progression.payments).toEqual(before.progression.payments);
});

async function openTreatment(page: Page, id: string) {
  await page.locator('#fusion-app > .fu-nav [data-tab="collection"]').tap();
  await openACurio(page, id, 'tap');
  await page.waitForLoadState('networkidle');
  await page.clock.runFor(180);
  const canvas = page.locator(id === 'receipt' ? '#fusion-paper-focus' : '#fusion-exhibit-focus');
  await expect(canvas).toHaveAttribute('data-ready', 'true');
  await expect(canvas).toHaveAttribute('width', '640');
  await expect(canvas).toHaveAttribute('height', '700');
  await expect(page.locator('#fusion-drawer')).toHaveAttribute('data-mode', 'treatment');
  const layout = await page.locator('#fusion-drawer').evaluate(element => ({top: element.getBoundingClientRect().top,
    height: element.getBoundingClientRect().height, viewport: innerHeight}));
  expect(layout.top).toBeLessThanOrEqual(1);
  expect(Math.abs(layout.height - layout.viewport)).toBeLessThanOrEqual(2);
  return canvas;
}

async function specimenPixels(page: Page, selector: string, id: string) {
  return page.locator(selector).evaluate((element, id) => {
    // Read actual focus pixels, excluding DOM labels, tabs and action controls.
    // Receipt retains its historical focus-view check (C includes owned glass);
    // its single-paper continuity is tested separately by receipt renderer tests.
    // The renewal workbench places a complete non-paper specimen in a 428px
    // plane at (106,191). The old y<490 crop cut off the tape's physical tip
    // and its alignment defect. Keep the same 4px stride and >50 threshold.
    const region = id === 'receipt' ? {x:150,y:150,size:340} : {x:106,y:191,size:428};
    const pixels = (element as HTMLCanvasElement).getContext('2d')!.getImageData(region.x, region.y, region.size, region.size).data;
    const sample: number[] = [];
    for (let y = 0; y < region.size; y += 4) for (let x = 0; x < region.size; x += 4) {
      const index = (y * region.size + x) * 4;
      sample.push(pixels[index], pixels[index + 1], pixels[index + 2]);
    }
    return sample;
  }, id);
}

for (const id of ['receipt', 'tape', 'nested', 'stamp', 'cosmic-parcel', 'bell'] as const) {
  test(`${id}刚获得、清理后、零件升级三张完整图片与原存档一致`, async ({page}) => {
    test.setTimeout(60000);
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.clock.install({time: new Date(epoch)});
    await page.clock.pauseAt(new Date(epoch + 1000));
    // Disable optional abilities through fixture options, so state comparisons isolate the material.
    const samples: number[][] = [];
    for (const condition of ['found', 'clean', 'stabilized'] as const satisfies readonly FirstPlanetFixtureStage[]) {
      const now = await page.evaluate(() => Date.now());
      const fixture = firstPlanetFixture(now, 0, condition, {receiptAbility: 0, tapeAbility: 0});
      expect(fixture.audit.source).toBe('accelerated-model-fixture');
      expect(fixture.audit.collection).toContain(id);
      expect(fixture.audit.endingParts).toBe(120 + fixture.audit.grossEarned - fixture.audit.maintenancePaid - fixture.audit.actionPaid);
      if (condition !== 'found') {
        expect(fixture.audit.actions.some(entry => entry.paid === (id === 'receipt' ? 40 : curioPrices[id].clean)
          && (id === 'receipt' ? entry.action.type === 'paper' && entry.action.kind === 'clean'
            : entry.action.type === 'curio' && entry.action.id === id && entry.action.kind === 'clean'))).toBe(true);
      }
      if (condition === 'stabilized') {
        expect(fixture.audit.actions.some(entry => entry.paid === (id === 'receipt' ? 120 : curioPrices[id].repair)
          && (id === 'receipt' ? entry.action.type === 'paper' && entry.action.kind === 'repair'
            : entry.action.type === 'curio' && entry.action.id === id && entry.action.kind === 'repair'))).toBe(true);
      }
      await installArchive(page, fixture.state);
      await openApp(page);
      const before = await readArchive(page), canvas = await openTreatment(page, id);
      await expect(page.locator('.fu-treatment-stages [aria-current="step"]')).toHaveCount(1);
      await expect(page.locator(`.fu-treatment-stages [data-condition="${condition}"]`)).toHaveAttribute('aria-current', 'step');
      const presentation = curioConditionPresentation(id, condition);
      if (id === 'receipt') {
        await expect(canvas).toHaveAttribute('data-restoration-condition', condition);
        await expect(page.locator('#fusion-paper-condition')).toHaveText(presentation.label);
        expect(Number(await canvas.getAttribute('data-restoration-cleaning'))).toBe(condition === 'found' ? 0 : 1);
        expect(Number(await canvas.getAttribute('data-restoration-repairing'))).toBe(condition === 'stabilized' ? 1 : 0);
      } else {
        await expect(canvas).toHaveAttribute('data-material-stage', condition);
        await expect(page.locator('#fusion-curio-condition')).toHaveText(presentation.label);
        expect(Number(await canvas.getAttribute('data-clean-progress'))).toBe(condition === 'found' ? 0 : 1);
        expect(Number(await canvas.getAttribute('data-repair-progress'))).toBe(condition === 'stabilized' ? 1 : 0);
        const primary = page.locator('#fusion-curio-primary');
        if (condition === 'stabilized') await expect(primary).toBeDisabled();
        else {
          const kind = condition === 'found' ? 'clean' : 'repair', labels = curioTreatmentLabels(id);
          await expect(primary).toHaveAttribute('data-kind', kind);
          await expect(primary).toHaveText(`${labels[kind]} ${curioPrices[id][kind]}`);
        }
        if (id === 'bell') {
          await expect(canvas).toHaveAttribute('data-lamp-available', 'false');
          expect(Number(await canvas.getAttribute('data-structure-pressed'))).toBe(condition === 'stabilized' ? 1 : 0);
        }
      }
      const png=await page.evaluate(id=>(window as any).__FUSION__.materialSnapshot(id),id);
      expect(png).toBeTruthy();
      const actual=await sharp(Buffer.from(png.split(',')[1],'base64')).ensureAlpha().raw().toBuffer();
      const reference=await page.evaluate(async condition=>{
        const image=document.querySelector<HTMLImageElement>(`.fu-treatment-stages [data-condition="${condition}"] img`)!;await image.decode();
        const canvas=document.createElement('canvas');canvas.width=canvas.height=384;canvas.getContext('2d')!.drawImage(image,0,0,384,384);
        return{png:canvas.toDataURL('image/png'),url:image.src};
      },condition);
      expect(reference.url).toContain(`${id}-${condition}`);
      const expected=await sharp(Buffer.from(reference.png.split(',')[1],'base64')).ensureAlpha().raw().toBuffer();
      expect(Buffer.compare(actual,expected),`${id}/${condition}: exactly the browser-decoded complete file, not reconstructed parts`).toBe(0);
      await expect(page.locator('.fu-treatment-stages img')).toHaveCount(3);
      await expect.poll(()=>page.locator('.fu-treatment-stages img').evaluateAll(images=>images.every(image=>(image as HTMLImageElement).complete&&(image as HTMLImageElement).naturalWidth===384))).toBe(true);
      samples.push(await specimenPixels(page, id === 'receipt' ? '#fusion-paper-focus' : '#fusion-exhibit-focus', id));
      if(condition==='stabilized'){
        await page.locator('[data-image-preview-condition="found"]').tap();
        await expect(page.locator('#fusion-state-preview')).toBeVisible();
        await expect(page.locator('#fusion-state-preview-image')).toHaveAttribute('src',new RegExp(`${id}-found`));
        expect(await page.evaluate(id=>(window as any).__FUSION__.materialSnapshot(id),id)).toBe(png);
        expect(id==='receipt'?(await readArchive(page)).receipt.condition:(await readArchive(page)).curios[id].condition).toBe('stabilized');
        await page.locator('#fusion-state-preview-close').tap();await expect(canvas).toBeVisible();
      }
      const after = await readArchive(page);
      expect(after.progression.payments).toEqual(before.progression.payments);
      expect(after.receipt.condition).toBe(before.receipt.condition);
      expect(after.curios[id]?.condition).toBe(before.curios[id]?.condition);
    }
    const differences:number[]=[];
    for (let index = 1; index < samples.length; index++) {
      let changed = 0;
      for (let pixel = 0; pixel < samples[index].length; pixel += 3) {
        const difference = Math.abs(samples[index][pixel] - samples[index - 1][pixel])
          + Math.abs(samples[index][pixel + 1] - samples[index - 1][pixel + 1])
          + Math.abs(samples[index][pixel + 2] - samples[index - 1][pixel + 2]);
        if (difference > 15) changed++;
      }
      differences.push(changed);
    }
    await test.info().attach(`${id}-actual-state-pixel-differences.json`,{body:JSON.stringify({id,stages:['found','clean','stabilized'],pixelStride:4,rgbThreshold:15,requiredChangedPixels:50,differences,scope:id==='receipt'?'actual focus view; C includes owned glass':'complete actual 428px workbench specimen plane'}),contentType:'application/json'});
    differences.forEach((changed,index)=>expect(changed,`${id}: ${index===0?'found→clean':'clean→stabilized'}`).toBeGreaterThan(50));
  });
}

test('已付费旧周目刷新保持收藏、设备、能力和整理权益，源存档与备份原值保留', async ({page}) => {
  test.setTimeout(60000);
  await page.clock.install({time: new Date(epoch)});
  await page.clock.pauseAt(new Date(epoch + 1000));
  const source = firstPlanetFixture(epoch + 1000, 0, 'found');
  const fixture = firstPlanetFixture(epoch + 1000, 1, 'stabilized', {receiptAbility: 1, tapeAbility: 1});
  expect(fixture.audit.actionPaid).toBeGreaterThan(source.audit.actionPaid);
  await installArchive(page, fixture.state, source.state);
  await openApp(page);
  await openTreatment(page, 'tape');
  const before = await readArchive(page);
  const backup = await readArchive<unknown>(page, 'backup/v039-source');
  const sourceRaw = await page.evaluate(() => localStorage.getItem('loststar.save.v1'));
  await page.reload();
  await expect(page.locator('#fusion-world canvas')).toHaveAttribute('data-ready', 'true');
  await page.clock.runFor(300);
  const after = await readArchive(page), projected = advanceFusion(before, after.game.lastAt);
  expect(after.game.collection).toEqual(before.game.collection);
  expect(after.game.upgrades).toEqual(before.game.upgrades);
  expect(after.game.growth).toEqual(before.game.growth);
  expect(after.game.resources).toBe(projected.game.resources);
  expect(after.progression.abilities).toEqual({receipt: 1, tape: 1});
  expect(after.progression.payments).toEqual(before.progression.payments);
  expect(after.receipt).toEqual(before.receipt);
  expect(after.curios).toEqual(before.curios);
  expect(after.journey).toEqual(before.journey);
  expect(await readArchive(page, 'current', sourceDatabase)).toEqual(source.state);
  expect(await readArchive<unknown>(page, 'backup/v039-source')).toEqual(backup);
  expect(await page.evaluate(() => localStorage.getItem('loststar.save.v1'))).toBe(sourceRaw);
  await expect(page.locator('#fusion-field-drawer')).toBeHidden();
  await expect(page.locator('#fusion-drawer')).not.toBeVisible();
});


test('零件处理中的画面保持完整前态，完成才换整图且旧账本只收费一次',async({page})=>{
 await page.clock.install({time:new Date(epoch)});await page.clock.pauseAt(new Date(epoch+1000));
 const fixture=firstPlanetFixture(epoch+1000,0,'found',{receiptAbility:0,tapeAbility:0});await installArchive(page,fixture.state);await openApp(page);
 await openTreatment(page,'tape');const before=await readArchive(page);
 await page.locator('[data-image-preview-condition="stabilized"]').tap();
 await expect(page.locator('#fusion-state-preview')).toBeVisible();
 await expect(page.locator('#fusion-curio-primary')).toBeHidden();
 await page.locator('#fusion-curio-primary').evaluate((button:HTMLButtonElement)=>button.click());
 expect((await readArchive(page)).curios.tape).toEqual(before.curios.tape);
 await page.locator('#fusion-state-preview-close').tap();
 for(const [kind,current,next]of [['clean','found','clean'],['repair','clean','stabilized']]as const){
  const snapshot=await page.evaluate(()=>(window as any).__FUSION__.materialSnapshot('tape'));
  await page.locator('#fusion-curio-primary').tap();
  await expect.poll(async()=>(await readArchive(page)).curios.tape.action?.kind).toBe(kind);
  const action=(await readArchive(page)).curios.tape.action!;await page.clock.runFor(Math.floor((action.endsAt-action.startedAt)/2));
  expect((await readArchive(page)).curios.tape.condition).toBe(current);
  expect(await page.evaluate(()=>(window as any).__FUSION__.materialSnapshot('tape'))).toBe(snapshot);
  await page.clock.runFor(action.endsAt-action.startedAt+300);
  await expect.poll(async()=>(await readArchive(page)).curios.tape.condition).toBe(next);
  const image=await page.evaluate(()=>(window as any).__FUSION__.materialSnapshot('tape'));
  expect(image).not.toBe(snapshot);
  await expect(page.locator('#fusion-treatment-result')).toHaveAttribute('data-active','true');
  await expect(page.locator('#fusion-treatment-result')).toHaveText(next==='clean'?'清理好了':'升级完成 · 安顿好了');
 }
 const after=await readArchive(page);
 expect(before.game.resources+after.game.station.grossIncome-before.game.station.grossIncome-(after.game.station.repairSpent-before.game.station.repairSpent)-after.game.resources).toBe(curioPrices.tape.clean+curioPrices.tape.repair);
 expect(after.progression.payments).toEqual(before.progression.payments);
});
