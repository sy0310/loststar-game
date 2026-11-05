import {chromium, webkit} from '@playwright/test';
import {readFile, writeFile} from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import {feedbackFixture} from '../releases/feedback-fixtures/feedback_fixtures.js';

const metadata = JSON.parse(await readFile('releases/taptap/package-info-fusion.json', 'utf8'));
const base = process.env.V038_URL ?? 'http://127.0.0.1:4224/';
const database = 'loststar.fusion.firstplanet.v037';
const ready = '#fusion-world canvas[data-ready="true"]';
const cases = [];
const backup = {kind: 'source-backup', raw: 'preserved-v037-source-27049'};
// Browser serialization omits optional undefined fields. Compare persisted JSON
// values without depending on object insertion order across restoreFusion.
const same = (a, b) => isDeepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
const gameplay = ({storageRevision, ...state}) => state;

async function read(page, key = 'current') {
  return page.evaluate(({name, key}) => new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, get = db.transaction('archive').objectStore('archive').get(key);
      get.onerror = () => {db.close();reject(get.error);};
      get.onsuccess = () => {db.close();resolve(get.result);};
    };
  }), {name: database, key});
}

for (const [engine, width, height] of [['chromium', 360, 800], ['chromium', 390, 844], ['webkit', 390, 844]]) {
  const browser = await ({chromium, webkit}[engine]).launch();
  try {
    for (const kind of ['new-player', 'existing-paid-archive']) {
      const context = await browser.newContext({viewport: {width, height}, hasTouch: true, isMobile: true});
      try {
        const errors = [], page = await context.newPage();
        page.on('pageerror', error => errors.push(error.message));
        page.on('response', response => {if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);});
        let fixture;
        if (kind === 'existing-paid-archive') {
          fixture = feedbackFixture('cleared', Date.now() + 30000);
          // The seed page does not run the game. Only this disposable context is written.
          await page.route('**/*.js', route => route.abort());
          await page.goto(base, {waitUntil: 'domcontentloaded'});
          await page.evaluate(({name, state, backup}) => new Promise((resolve, reject) => {
            localStorage.setItem('loststar.save.v1', 'old-source-27049-kept-exactly');
            localStorage.setItem('loststar.ui.firstplanet.v037.intro', String(state.journey.seed));
            const request = indexedDB.open(name, 1);
            request.onupgradeneeded = () => request.result.createObjectStore('archive');
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
              const db = request.result, tx = db.transaction('archive', 'readwrite'), store = tx.objectStore('archive');
              store.put(state, 'current');store.put(backup, 'backup/0');
              tx.oncomplete = () => {db.close();resolve();};tx.onerror = () => {db.close();reject(tx.error);};
            };
          }), {name: database, state: fixture.state, backup});
          await page.unroute('**/*.js');
          errors.length = 0; // The intentional seed-page script aborts are not game failures.
        }
        await page.goto(base);await page.locator(ready).waitFor();
        const build = await page.locator('.fu-build').innerText();
        if (!build.includes(metadata.sourceCommit.slice(0, 7)) || build.includes('dirty')) throw new Error(`Unexpected source ${build}`);
        let before = await read(page);
        if (kind === 'new-player') {
          if (before.game.resources !== 120 || before.game.collection.length) throw new Error('New player baseline changed');
          await page.locator('#fusion-dismiss-intro').tap();await page.locator('#fusion-upgrades').tap();
          await page.locator('[data-upgrade="scanner"]').tap();
          for (let attempt = 0; attempt < 30; attempt++) {before = await read(page);if (before.game.upgrades.scanner === 1) break;await page.waitForTimeout(50);}
          if (before.game.resources !== 75 || before.game.upgrades.scanner !== 1) throw new Error('Real packaged purchase failed');
          await page.locator('#fusion-close').tap();
        } else if (!same(gameplay(before), gameplay(fixture.state))) {
          await writeFile('/tmp/v038-smoke-archive-comparison.json', JSON.stringify({expected: fixture.state, actual: before}, null, 2));
          throw new Error('Existing archive was changed on load');
        }
        await page.reload();await page.locator(ready).waitFor();const after = await read(page);
        const checks = {
          seed: before.journey.seed === after.journey.seed,
          siteConfiguration: same(before.journey.sites.map(({id, anchor, variant}) => ({id, anchor, variant})), after.journey.sites.map(({id, anchor, variant}) => ({id, anchor, variant}))),
          collection: same(before.game.collection, after.game.collection),
          upgrades: same(before.game.upgrades, after.game.upgrades),
          paidSorting: before.progression.sorting.paidCost === after.progression.sorting.paidCost,
          noOverflow: await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          noUnknownWorlds: !/回声菌星|倒置海星|钟摆荒原星|无人游乐星|未签收之星/.test(await page.locator('body').ariaSnapshot()),
          oneRobot: await page.locator(ready).getAttribute('data-robot-render-passes') === '1',
          noLegacySorter: await page.locator(ready).getAttribute('data-legacy-sorter-count') === '0',
          singleSorter: await page.locator(ready).getAttribute('data-sorting-entity-id') === 'parcel/old-sorting',
        };
        if (kind === 'existing-paid-archive') {
          checks.fullArchive = same(gameplay(before), gameplay(after));
          checks.sourceBackup = same(await read(page, 'backup/0'), backup);
          checks.originalLocalStorage = await page.evaluate(() => localStorage.getItem('loststar.save.v1') === 'old-source-27049-kept-exactly');
          if (Date.now() >= fixture.state.game.lastAt) throw new Error('Held-archive window exceeded');
        }
        if (Object.values(checks).some(value => !value) || errors.length) throw new Error(`${engine}/${kind}: ${JSON.stringify({checks, errors})}`);
        cases.push({engine, viewport: {width, height}, kind, build, checks, balance: after.game.resources,
          collectionCount: after.game.collection.length, fixtureAudit: fixture?.audit, errors});
      } finally {await context.close();}
    }
  } finally {await browser.close();}
}
await writeFile('artifacts/v038-feedback/package-smoke.json', JSON.stringify({sourceCommit: metadata.sourceCommit, base, physicalPhone: false, nativeTouchEmulation: true, clockOverrides: false, cases}, null, 2) + '\n');
console.log(`${cases.length} packaged new/existing-archive cases passed`);
