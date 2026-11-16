/* Real HTTP evidence. QA imports and fresh natural play remain explicitly labelled. */
const { chromium, webkit } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const E = require('../src/engine.js');
const O = require('./legacy-engine.cjs')('94e606fc773d1dc37341d29923e39e7ec7c3863b');
const output = path.resolve(process.env.SALVAGE_CAPTURE_OUT || 'releases/v05-visual-review');
const url = process.env.SALVAGE_URL || 'http://127.0.0.1:4296/loststar-salvage/';
const baselineUrl = process.env.SALVAGE_BASELINE_URL || 'http://127.0.0.1:4298/loststar-salvage/';
const reviewOnly = process.env.SALVAGE_CAPTURE_REVIEW === '1';
fs.mkdirSync(output, { recursive: true });
const report = { completed: false, physicalPhoneTested: false, reviewOnly,
  scope: 'Actual HTTP desktop browser touch emulation. PNG screenshots are running UI. Natural uses crypto RNG and normal actions. Other sequences explicitly import isolated QA copies.',
  natural: { imported: false, seedOverridden: false, clockOverridden: false, checkpoints: [] },
  holds: [], market: { imported: true, checkpoints: [] }, errors: [], performance: [] };
const state = page => page.evaluate(() => __SALVAGE__.state());
const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function tap(page, selector) {
  await page.waitForFunction(() => __SALVAGE__.ready());
  await page.locator(selector).tap({ timeout: 10000 });
  await page.waitForFunction(() => __SALVAGE__.ready());
  await wait(180);
}
async function confirm(page, selector) {
  await tap(page, selector);
  await tap(page, '[data-act=confirm]');
}
async function boot(page, entry = url) {
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('response', response => {if(response.status()>=400&&/\/(assets|src)\//.test(response.url()))report.errors.push(response.status()+' '+response.url());});
  await page.goto(entry);
  await page.waitForFunction(() => window.__SALVAGE__);
  if (await page.locator('#modal-close').isVisible()) await tap(page, '#modal-close');
}
async function shot(page, name) {
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode().catch(() => {}))));
  await page.screenshot({ path: path.join(output, name+'.png'), fullPage: true, animations: 'disabled' });
}
async function load(page, value, model) {
  await tap(page, '[data-act=settings]');
  await tap(page, '[data-act=import]');
  await page.locator('#import-file').setInputFiles({ name: 'explicit-QA-v05-not-natural.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) });
  await tap(page, '[data-act=confirm]');
  assert.deepEqual(await state(page), JSON.parse(JSON.stringify(model.restore(value))));
}
async function checkpoint(page, name, collection) {
  const value = await state(page);
  E.assertState(value);
  collection.push({ name, state: value });
  return value;
}
async function saveVideo(page, name) {
  const video = page.video();
  await page.close();
  if (video) await video.saveAs(path.join(output, name+'.webm'));
}
function command(model, value, type, extra = {}) {
  const result = model.dispatch(value, { type, ...extra });
  assert(result.ok, result.message);
  return result.state;
}
function oldFixture(shipId) {
  let value = O.create(205);
  value.money = 27049;
  if (shipId !== 'starter') {
    value = command(O, value, 'buyShip', { id: shipId });
    value = command(O, value, 'equipShip', { id: shipId });
  }
  const identities = [['metal_crate','line2'], ['energy_battery','ell3'], ['nav_chip','line2'], ['broken_engine','tee4']];
  value.cargo = identities.map(([itemId,shapeId], index) => ({ uid:index+1, itemId, shapeId, shapeVersion:1,
    name:['金属散热片','弯形能源电池','导航电路','折叠发动机'][index], cells:O.Cargo.area(shapeId), value:40, acquiredRun:0 }));
  value.nextUid = 5;
  value.cargoGrid.placements = O.Cargo.solve(value.cargo, [], O.cargoSpace(value));
  O.assertState(value);
  return value;
}
function options(width, video) {
  return { viewport:{width,height:width===360?800:844}, hasTouch:true,
    ...(video?{recordVideo:{dir:path.join(output,'raw'),size:{width,height:width===360?800:844}}}:{}) };
}

async function natural(browser) {
  const context = await browser.newContext(options(390, true));
  let page = await context.newPage();
  await boot(page);
  report.build = await page.evaluate(() => LostCargoBuild);
  await shot(page, 'natural-home-390');
  for (let voyage = 1; voyage <= 2; voyage++) {
    if (voyage === 2) {
      await tap(page, '[data-tab=missions]');
      await confirm(page, '[data-accept=survey]');
      await tap(page, '#back');
    }
    await checkpoint(page, 'before-voyage-'+voyage, report.natural.checkpoints);
    await tap(page, '[data-act=depart]');
    await tap(page, '[data-cargo-save]');
    for (let visit = 0; visit < 3; visit++) {
      let value = await state(page);
      const route = value.route.find(route => E.quote(value, route).enabled);
      if (!route) break;
      await tap(page, '[data-route-select="'+route.uid+'"]');
      await tap(page, '[data-travel]');
      value = await checkpoint(page, 'voyage-'+voyage+'-arrival-'+(visit+1), report.natural.checkpoints);
      await shot(page, 'natural-v'+voyage+'-event-'+(visit+1));
      await wait(700);
      const event = E.encounter(value);
      const lootChoice = event.choices.find(choice => choice.effect.loot?.length && !E.checkChoice(value, choice) &&
        value.hull + (choice.effect.hull || 0) - (choice.risk?.[1] || 0) >= 25);
      const choice = visit === 0 && event.id === 'tank' ? event.choices.find(choice => choice.id === 'force') : lootChoice || event.choices.find(choice => choice.id === 'leave');
      assert(choice);
      await tap(page, '[data-choice="'+choice.id+'"]');
      if (await page.locator('[data-cargo-save]').isVisible()) {
        if (await page.locator('[data-cargo-save]').isDisabled()) await tap(page, '[data-cargo-arrange]');
        if (await page.locator('[data-cargo-save]').isEnabled()) await tap(page, '[data-cargo-save]');
        else { await tap(page,'[data-cargo-cancel]'); await tap(page,'[data-choice=leave]'); }
      }
      await tap(page, '[data-act=continue]');
    }
    await confirm(page, '[data-act=home]');
    await checkpoint(page, 'returned-voyage-'+voyage, report.natural.checkpoints);
    await shot(page, 'natural-return-'+voyage);
    if (voyage === 2 && E.activeMission(await state(page))?.status === 'complete') {
      await tap(page, '.return-card [data-act=missions]');
      await tap(page, '[data-claim]');
      await tap(page, '#back');
    }
    if ((await state(page)).cargo.length) await tap(page, '[data-act=sellAll]');
    await tap(page, '[data-act=depart]');
    await tap(page, '[data-tab=shop]');
    for (const supply of ['fillFuel','fillHull']) if (await page.locator('[data-act='+supply+']').isEnabled()) await confirm(page, '[data-act='+supply+']');
    await tap(page, '#back');
    const saved = await checkpoint(page, 'saved-voyage-'+voyage, report.natural.checkpoints);
    await page.reload();
    await page.waitForFunction(() => window.__SALVAGE__);
    assert.deepEqual(await state(page), saved);
    await saveVideo(page, 'natural-voyage-'+voyage);
    if (voyage === 1) {
      page = await context.newPage();
      await boot(page);
      assert.deepEqual(await state(page), saved);
      await checkpoint(page, 'reopened-before-second-voyage', report.natural.checkpoints);
    }
  }
  await context.close();
}

async function holds(browser, model, entry, label, width) {
  const video = !reviewOnly && label === 'bc' && width === 390;
  const context = await browser.newContext(options(width, video));
  const page = await context.newPage();
  await boot(page, entry);
  if(label === 'bc') report.build = await page.evaluate(() => LostCargoBuild);
  else report.baselineBuild = await page.evaluate(() => LostCargoBuild);
  for (const shipId of Object.keys(model.PORT.ships)) {
    await load(page, oldFixture(shipId), model);
    await tap(page, '[data-tab=cargo]');
    const spec = model.PORT.ships[shipId];
    for (let level = 0; level <= spec.cargoUpgradeCosts.length; level++) {
      const value = await state(page);
      const before = JSON.parse(JSON.stringify(value));
      await shot(page, label+'-'+shipId+'-level'+level+'-'+width);
      const images = await page.locator('[data-cargo-object] img').evaluateAll(elements => elements.map(image => ({ src:image.getAttribute('src'), decoded:image.complete&&image.naturalWidth>0 })));
      assert(images.every(image => image.decoded));
      const metrics = await page.locator('.cargo-board').evaluate(element => ({width:element.getBoundingClientRect().width,height:element.getBoundingClientRect().height}));
      assert.deepEqual(await state(page), before);
      report.holds.push({ label, width, shipId, level, capacity:model.capacityCells(value), state:value, images, metrics });
      if (level < spec.cargoUpgradeCosts.length) {
        const quote = model.cargoUpgradeQuote(value);
        await tap(page, '[data-cargo-growth]');
        await shot(page, label+'-'+shipId+'-upgrade-plan'+level+'-'+width);
        await confirm(page, '[data-act=upgradeCargo]');
        const after = await state(page);
        assert.equal(after.money, value.money - quote.cost);
        assert.deepEqual(after.cargo, value.cargo);
        await tap(page, '#back');
        await tap(page, '[data-tab=cargo]');
      }
    }
    await tap(page, '#back');
  }
  if (video) await saveVideo(page, 'qa-four-ship-holds-and-real-upgrades');
  else await page.close();
  await context.close();
}

async function market(browser) {
  const context = await browser.newContext(options(390, !reviewOnly));
  const page = await context.newPage();
  await boot(page);
  const value = E.create(79);
  value.money = 454;
  value.cargo = Object.entries(E.NewEncounters.curios).map(([itemId,spec], index) => ({ ...spec, itemId, uid:index+1, shapeVersion:1, acquiredRun:0 }));
  value.nextUid = 5;
  value.cargoGrid.placements = E.Cargo.solve(value.cargo, [], E.cargoSpace(value));
  await load(page, value, E);
  await tap(page, '[data-tab=cargo]');
  await shot(page, 'qa-four-original-curios-390');
  await tap(page, '#back');
  await tap(page, '[data-tab=shop]');
  await tap(page, '[data-act=market]');
  await shot(page, 'qa-market-choice-390');
  await checkpoint(page, 'before-quote', report.market.checkpoints);
  await confirm(page, '[data-market-style=bold]');
  await shot(page, 'qa-negotiated-offer-390');
  await checkpoint(page, 'negotiation-saved', report.market.checkpoints);
  if (await page.locator('[data-market-accept]').isVisible()) await tap(page, '[data-market-accept]');
  await tap(page, '[data-market-select="1"]');
  await confirm(page, '[data-market-style=auction][data-market-reserve="100"]');
  await wait(500);
  await shot(page, 'qa-npc-auction-bids-390');
  const saved = await checkpoint(page, 'auction-fee-and-offer-saved', report.market.checkpoints);
  await page.reload();
  await page.waitForFunction(() => window.__SALVAGE__);
  assert.deepEqual(await state(page), saved);
  await tap(page, '[data-tab=shop]');
  await tap(page, '[data-act=market]');
  await tap(page, '[data-market-select="1"]');
  await shot(page, 'qa-same-bids-after-refresh-390');
  await checkpoint(page, 'refresh-no-reroll', report.market.checkpoints);
  if (!reviewOnly) await saveVideo(page, 'qa-black-market-offers-and-refresh');
  else await page.close();
  await context.close();
}

(async () => {
  let browser = await chromium.launch();
  try {
    if (!reviewOnly) await natural(browser);
    for (const width of reviewOnly ? [390] : [360,390]) {
      await holds(browser, O, baselineUrl, 'before042', width);
      await holds(browser, E, url, 'bc', width);
    }
    await market(browser);
  } finally { await browser.close(); }
  for (const [driver, engine] of [[chromium,'chromium'],[webkit,'webkit']]) {
    browser = await driver.launch();
    try {
      for (const [label, entry] of [['before042',baselineUrl],['bc',url]]) {
        const context = await browser.newContext(options(390, false));
        const page = await context.newPage();
        await boot(page, entry);
        const metrics = await page.evaluate(async () => {
          const start = performance.now();
          await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
          return { build:LostCargoBuild, imageReadyMs:performance.now(), waitForImagesMs:performance.now()-start,
            navigation:performance.getEntriesByType('navigation').map(value => ({domContentLoaded:value.domContentLoadedEventEnd,load:value.loadEventEnd})),
            resources:performance.getEntriesByType('resource').map(value => ({path:new URL(value.name).pathname,duration:value.duration,transfer:value.transferSize})) };
        });
        report.performance.push({label,engine,...metrics});
        await context.close();
      }
    } finally { await browser.close(); }
  }
  assert.deepEqual(report.errors, []);
  report.completed = true;
  fs.rmSync(path.join(output,'raw'),{recursive:true,force:true});
  fs.writeFileSync(path.join(output,'capture-report.json'), JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({completed:true,output,holds:report.holds.length,naturalCheckpoints:report.natural.checkpoints.length}));
})().catch(error => {
  report.failure = error.stack;
  fs.writeFileSync(path.join(output,'capture-report.json'),JSON.stringify(report,null,2)+'\n');
  console.error(error);
  process.exitCode = 1;
});
