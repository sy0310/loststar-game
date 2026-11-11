/* Explicit QA copies. Counts real UI taps separately from economic commands. */
const {chromium, webkit} = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../src/engine.js');
const {safePort} = require('./v051-fixtures.cjs');
const entry = process.env.SALVAGE_URL || 'http://127.0.0.1:4305/loststar-salvage/';
const output = path.resolve(process.env.SALVAGE_MARKET_UI_OUT || 'releases/v051-market-ui.json');
const report = {
  build: null,
  scope: 'Explicit QA archives on real HTTP. Actual DOM taps from port to sale or deliberate keep. Import setup excluded. Outcome seeds are isolated QA. No human elapsed-time claim.',
  cases: [],
  errors: []
};
const state = page => page.evaluate(() => __SALVAGE__.state());

function fixture(style, needsNoSale) {
  for (let seed = 1; seed <= 512; seed++) {
    const value = safePort(seed, 454);
    value.cargo = [
      {uid:value.nextUid++, itemId:'time_measure', name:'显式QA计量盒', shapeId:'line2', shapeVersion:1, cells:2, value:100, acquiredRun:0},
      {uid:value.nextUid++, itemId:'metal_crate', name:'显式QA普通件', shapeId:'point1', shapeVersion:1, cells:1, value:50, acquiredRun:0}
    ];
    value.cargoGrid.placements = E.Cargo.solve(value.cargo, [], E.cargoSpace(value));
    if (style === 'auction') {
      const result = E.dispatch(value, {type:'marketQuote', uid:1, style, reservePercent:100});
      if ((result.state.market.offers[0].status === 'noSale') !== needsNoSale) continue;
    }
    return value;
  }
  throw Error('No compatible real auction outcome within QA seeds');
}

async function measure(browser, engine, width, policy) {
  const height = width === 360 ? 800 : 844;
  const context = await browser.newContext({viewport:{width,height}, hasTouch:true});
  try {
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(entry);
    await page.waitForFunction(() => window.__SALVAGE__);
    const build = await page.evaluate(() => LostCargoBuild);
    assert.equal(build.version, E.VERSION);
    if (report.build) assert.deepEqual(build, report.build);
    else report.build = build;
    const trace = [];
    async function tap(selector, count = true) {
      await page.waitForFunction(() => __SALVAGE__.ready());
      await page.locator(selector).tap();
      await page.waitForFunction(() => __SALVAGE__.ready());
      if (count) trace.push({selector, phase:(await state(page)).phase});
    }
    if (await page.locator('#modal-close').isVisible()) await tap('#modal-close', false);
    const style = policy === 'noSale' ? 'auction' : policy === 'keep' ? 'bold' : policy;
    const opening = fixture(style, policy === 'noSale');
    await tap('[data-act=settings]', false);
    await tap('[data-act=import]', false);
    await page.locator('#import-file').setInputFiles({
      name:'explicit-market-command-QA.json', mimeType:'application/json',
      buffer:Buffer.from(JSON.stringify(opening))
    });
    await tap('[data-act=confirm]', false);
    assert.deepEqual(await state(page), opening);

    await tap('[data-tab=shop]');
    if (policy === 'ordinary') {
      await tap('[data-act=sellAll]');
    } else {
      await tap('[data-act=market]');
      const selector = '[data-market-style="'+style+'"]'+(style === 'auction' ? '[data-market-reserve="100"]' : '');
      await tap(selector);
      await tap('[data-act=confirm]');
      const offer = (await state(page)).market.offers[0];
      if (policy === 'keep') {
        await tap('[data-market-keep]');
      } else {
        await tap(offer.status === 'open' && offer.amount > offer.baseValue ? '[data-market-accept]' : '[data-market-keep]');
        await tap('[data-act=shop]');
        await tap('[data-act=sellAll]');
      }
    }
    const final = await state(page);
    E.assertState(final);
    assert.equal(final.phase, 'port');
    if (policy === 'keep') {
      assert.equal(final.cargo.length, 2);
      assert.equal(final.money, opening.money);
    } else {
      assert.equal(final.cargo.length, 0);
    }
    if (policy !== 'ordinary') assert.equal(final.market.quota.used, true);
    report.cases.push({
      engine, width, height, policy, seedIsQA:true,
      openingCash:opening.money, actualCash:final.money,
      netCash:final.money-opening.money, retainedValue:E.cargoValue(final),
      taps:trace.length, extraTapsComparedWithOrdinary:trace.length-2, trace, final
    });
  } finally {
    await context.close();
  }
}

(async () => {
  for (const [engine, driver] of [['chromium',chromium],['webkit',webkit]]) {
    const browser = await driver.launch();
    try {
      for (const width of [360,390]) {
        for (const policy of ['ordinary','cautious','bold','auction','noSale','keep']) {
          await measure(browser, engine, width, policy);
        }
      }
    } finally {
      await browser.close();
    }
  }
  assert.deepEqual(report.errors, []);
  assert.equal(report.cases.length, 24);
  fs.mkdirSync(path.dirname(output), {recursive:true});
  fs.writeFileSync(output, JSON.stringify(report,null,2)+'\n');
  console.log('PASS24 actual market UI tap traces, isolated copies, two engines and widths');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
