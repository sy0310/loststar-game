/** Native before/current art screens, bound to the actual served immutable ZIP. */
import {chromium, webkit} from '@playwright/test';
import {access, mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve, posix} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {firstPlanetFixture} from '../releases/firstplanet-fixtures/firstplanet_fixtures.js';

const mode = process.argv[2] ?? 'current';
if (!['baseline', 'current'].includes(mode)) throw Error('Expected baseline or current');
const baseline = mode === 'baseline', version = baseline ? '0.4.3' : process.env.RENEWAL_VERSION ?? '0.4.4';
const base = process.env.RENEWAL_URL;
if (!base) throw Error('RENEWAL_URL must be the corresponding immutable extracted package entry');
const target = new URL(base);
if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.search || target.hash)
  throw Error('Use a package entry URL without credentials, query or fragment');
const servedRoot = new URL('./', target);
const output = resolve(process.env.RENEWAL_OUTPUT ?? 'artifacts/v044-execution-art');
const metadataFile = process.env.COMPARISON_METADATA ?? (baseline ? 'releases/v044/baseline-package-info.json' : 'releases/taptap/package-info-fusion.json');
const metadataBytes = await readFile(metadataFile), metadata = JSON.parse(metadataBytes);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const git = args => execFileSync('git', args, {encoding: 'utf8'}).trim();
const check = (condition, message) => {if (!condition) throw Error(message);};
const archivedSource = 'ff917872227b0f28a452dee1642d9cc8606251db';
const archivedZip = '2c37adfcd286cf1b1ba8af05bb7b52127d5cdda126f0b3fa098e812d825893f1';
check(metadata.version === version, `Metadata version is ${metadata.version}, expected ${version}`);
if (baseline) check(metadata.sourceCommit === archivedSource && metadata.sha256 === archivedZip, 'Wrong V0.4.3 comparison baseline');
const checkout = git(['rev-parse', 'HEAD']), archive = resolve(metadata.archive);
const runtimePaths = ['src', 'assets/runtime', ':(top,glob)package*.json', ':(top,glob)vite*.config.ts'];
async function guard() {
  const zip = await readFile(archive);
  check(zip.length === metadata.bytes && digest(zip) === metadata.sha256, 'Actual archived ZIP differs from metadata');
  check(digest(await readFile(metadataFile)) === digest(metadataBytes), 'Package metadata changed while capturing');
  if (!baseline) {
    const dirty = git(['status', '--porcelain', '--', ...runtimePaths]);
    const different = git(['diff', '--name-only', metadata.sourceCommit, checkout, '--', ...runtimePaths]);
    execFileSync('git', ['merge-base', '--is-ancestor', metadata.sourceCommit, checkout]);
    check(git(['rev-parse', 'HEAD']) === checkout && !dirty && !different, `Current frozen runtime differs: ${dirty}\n${different}`);
  }
  return {at: Date.now(), zipSha256: metadata.sha256, zipBytes: zip.length, workingTreeValidated: !baseline,
    sourceClean: baseline ? null : true,
    authority: baseline ? 'Historical immutable ZIP + served entry/loaded JS bytes; working runtime deliberately not asserted' : 'Frozen clean runtime + actual ZIP + served entry/loaded JS bytes'};
}
const initialGuard = await guard();
const zipEntries = execFileSync('unzip', ['-Z1', archive], {encoding: 'utf8'}).trim().split('\n');
check(zipEntries.includes(metadata.entry), 'Package entry is absent from ZIP');
const entryRoot = posix.dirname(metadata.entry) + '/';
const readZip = entry => execFileSync('unzip', ['-p', archive, entry], {maxBuffer: 32 * 1024 * 1024});
const expectedEntrySha = digest(readZip(metadata.entry));
const scripts = new Map(zipEntries.filter(entry => entry.startsWith(entryRoot) && entry.endsWith('.js')).map(entry => [entry, digest(readZip(entry))]));
check(scripts.size > 0, 'No production client JS in ZIP');
const evidenceFile = `${output}/${mode}-art-comparison.json`;
try {await access(evidenceFile);throw Error(`Report already exists; use a fresh output: ${evidenceFile}`);}
catch (error) {if (error.code !== 'ENOENT') throw error;}
await mkdir(`${output}/comparison`, {recursive: true});
const database = 'loststar.fusion.firstplanet.v037';
const report = {mode, version, sourceCommit: metadata.sourceCommit, zipSha256: metadata.sha256, package: metadata,
  sourceClean: baseline ? null : true, workingTreeValidated: !baseline, evidenceCheckoutCommit: checkout, metadataFile,
  metadataSha256: digest(metadataBytes), base, initialGuard, startedAt: Date.now(),
  collectorSha256: digest(await readFile(new URL(import.meta.url))),
  fixtureModuleSha256: digest(await readFile('releases/firstplanet-fixtures/firstplanet_fixtures.js')),
  physicalPhone: false, touchEmulation: true, privateContexts: true, clockOverrides: false, database,
  method: 'Ordinary earned clean-state fixture; same v037 archive format and deterministic fixture actions before/current. Native viewport screenshots, no montage, no video synthesis. No personal browser profile is opened or reset.',
  cases: [], screenshots: [], errors: []};

async function state(page) {
  return page.evaluate(name => new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);request.onerror = () => reject(request.error);
    request.onsuccess = () => {const db = request.result, get = db.transaction('archive', 'readonly').objectStore('archive').get('current');
      get.onsuccess = () => {db.close();resolve(get.result);};get.onerror = () => {db.close();reject(get.error);};};
  }), database);
}
const ownership = save => ({collection: save.game.collection, planets: save.game.planets, upgrades: save.game.upgrades,
  growth: save.game.growth, projects: save.projects, abilities: save.progression.abilities,
  receipt: {condition: save.receipt.condition, transactions: save.receipt.transactions, evidenceIds: save.receipt.evidenceIds,
    verifiedEvidenceIds: save.receipt.verifiedEvidenceIds}, curios: save.curios, journeySeed: save.journey?.seed});
function ledger(before, after) {
  const grossDiff = after.game.station.grossIncome - before.game.station.grossIncome;
  const maintenanceDiff = after.game.station.repairSpent - before.game.station.repairSpent;
  return {balanceBefore: before.game.resources, balanceAfter: after.game.resources, grossDiff, maintenanceDiff,
    charged: before.game.resources + grossDiff - maintenanceDiff - after.game.resources};
}
async function screenshot(page, entry, scene) {
  const layout = await page.evaluate(() => {
    const rectangle = selector => {const e = document.querySelector(selector);if (!e || !e.getClientRects().length) return null;
      const r = e.getBoundingClientRect();return {x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom};};
    return {viewport: {width: innerWidth, height: innerHeight}, noOverflow: document.documentElement.scrollWidth <= innerWidth,
      world: rectangle('#fusion-world'), museum: rectangle('#museum-canvas'), treatment: rectangle('#fusion-drawer[open]'),
      focus: rectangle('#fusion-exhibit-focus'), stage: document.querySelector('.fu-treatment-stages [aria-current="step"]')?.getAttribute('data-condition') ?? null};
  });
  check(layout.noOverflow, `${entry.name}/${scene}: horizontal overflow`);
  if (scene === 'workbench-stamp') check(layout.stage === 'clean', 'Workbench comparison must show actual clean stamp');
  if (scene === 'collection') {
    const navTop=await page.locator('#fusion-app > .fu-nav').evaluate(e=>e.getBoundingClientRect().top);
    check(layout.museum&&layout.museum.y>=0&&layout.museum.bottom<=navTop+1,'Collection comparison must frame the entire real museum above navigation');
  }
  const file = `comparison/${mode}-${entry.engine}-${entry.width}-${scene}.png`, at = Date.now();
  await page.screenshot({path: `${output}/${file}`, scale: 'css'});
  const bytes = await readFile(`${output}/${file}`), saved = await state(page);
  const item = {file, name: `${entry.name}-${scene}`, scene, engine: entry.engine, width: entry.width, height: entry.height,
    at, build: entry.build, sha256: digest(bytes), bytes: bytes.length, sourceCommit: metadata.sourceCommit,
    zipSha256: metadata.sha256, physicalPhone: false, touchEmulation: true, layout,
    actualSave: {savedAt: saved.game.lastAt, worldElapsedMs: saved.game.world.elapsedMs,
      receiptCondition: saved.receipt.condition, stampCondition: saved.curios.stamp.condition},
    source: 'Unmodified native CSS-pixel screenshot of the verified served immutable ZIP; no crop or composited phone frame'};
  report.screenshots.push(item);entry.screenshots.push(item);return item;
}
async function capture(browser, engine, width, height) {
  const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: 1, isMobile: true, hasTouch: true});
  const entry = {name: `${mode}-${engine}-${width}`, engine, width, height, screenshots: [], loadedScripts: [], errors: [], complete: false};
  report.cases.push(entry);
  try {
    const generated = firstPlanetFixture(Date.now(), 0, 'clean', {receiptAbility: 0, tapeAbility: 0});
    entry.fixtureAudit = generated.audit;entry.fixtureOptions = {condition: 'clean', caseLevel: 0, receiptAbility: 0, tapeAbility: 0};
    const seed = await context.newPage();await seed.route('**/*.js', route => route.abort());
    await seed.goto(base, {waitUntil: 'domcontentloaded'});
    await seed.evaluate(({name, save}) => new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);request.onupgradeneeded = () => request.result.createObjectStore('archive');
      request.onerror = () => reject(request.error);request.onsuccess = () => {
        const db = request.result, tx = db.transaction('archive', 'readwrite');tx.objectStore('archive').put(save, 'current');
        tx.oncomplete = () => {db.close();localStorage.setItem('loststar.ui.firstplanet.v037.intro', String(save.journey.seed));resolve();};
        tx.onerror = () => {db.close();reject(tx.error);};};
    }), {name: database, save: generated.state});
    await seed.close();
    const page = await context.newPage(), pending = [];
    page.on('pageerror', error => entry.errors.push(error.stack ?? error.message));
    page.on('response', response => {
      const url = new URL(response.url());
      if (response.status() >= 400) entry.errors.push(`HTTP ${response.status()} ${url.pathname}`);
      if (response.request().resourceType() !== 'script' && !url.pathname.endsWith('.js')) return;
      pending.push((async () => {
        check(url.origin === target.origin && url.pathname.startsWith(servedRoot.pathname), `Unbound client script: ${url.pathname}`);
        const zipEntry = entryRoot + decodeURIComponent(url.pathname.slice(servedRoot.pathname.length));
        check(scripts.has(zipEntry), `Loaded script is absent from ZIP: ${zipEntry}`);
        const bytes = await response.body(), actual = digest(bytes);
        check(actual === scripts.get(zipEntry), `Served JS differs from the actual ZIP: ${zipEntry}`);
        entry.loadedScripts.push({path: url.pathname, zipEntry, sha256: actual, bytes: bytes.length});
      })().catch(error => entry.errors.push(error.message)));
    });
    const response = await page.goto(base);
    check(response && digest(await response.body()) === expectedEntrySha, 'Served HTML differs from the actual ZIP entry');
    entry.servedEntry = {zipEntry: metadata.entry, sha256: expectedEntrySha};
    await page.locator('#fusion-world canvas[data-ready="true"]').waitFor({timeout: 30000});
    await page.waitForFunction(() => !!window.__FUSION__?.materialSnapshot);
    entry.build = await page.locator('.fu-build').innerText();
    check(entry.build.includes(version) && entry.build.includes(metadata.sourceCommit.slice(0, 7)) && !entry.build.includes('dirty'), `Actual page build mismatch: ${entry.build}`);
    check(await page.evaluate(() => window.__FUSION__.databaseName) === database, 'Wrong production archive');
    const before = await state(page);entry.initialOwnership = ownership(before);
    await page.locator('#fusion-app > .fu-nav [data-tab="explore"]').tap();
    await page.waitForFunction(() => document.querySelector('#fusion-tap')?.getAttribute('aria-disabled') === 'false');
    await page.waitForTimeout(500);await screenshot(page, entry, 'explore');
    await page.locator('#fusion-app > .fu-nav [data-tab="collection"]').tap();
    await page.locator('#fusion-collection-list [data-detail="stamp"]').tap();
    await page.locator('#fusion-exhibit-focus[data-ready="true"]').waitFor();
    await page.locator('.fu-treatment-stages img').evaluateAll(async images => {await Promise.all(images.map(image => image.decode()));});
    await page.waitForTimeout(300);await screenshot(page, entry, 'workbench-stamp');
    await page.locator('#fusion-close').tap();
    await page.locator('#museum-canvas[data-ready="true"]').waitFor();
    await page.locator('#fusion-scroll').evaluate(e=>{e.scrollTop=0;});
    await page.locator('#fusion-collection-list img').evaluateAll(async images => {await Promise.all(images.map(image => image.decode()));});
    await page.waitForTimeout(300);await screenshot(page, entry, 'collection');
    await page.waitForLoadState('networkidle');await Promise.all(pending);
    check(entry.loadedScripts.length > 0, 'No loaded client JS was verified against the ZIP');
    const after = await state(page);entry.finalOwnership = ownership(after);entry.ledger = ledger(before, after);
    entry.readOnly = isDeepStrictEqual(entry.initialOwnership, entry.finalOwnership) && entry.ledger.charged === 0;
    check(entry.readOnly, 'Comparison navigation changed a payment, condition or purchased entitlement');
    check(entry.errors.length === 0, `${entry.name}: browser/package errors`);entry.complete = true;
  } catch (error) {entry.errors.push(error.stack ?? String(error));report.errors.push(`${entry.name}: ${error.message}`);}
  finally {await context.close();}
}

try {
  for (const [engine, driver] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await driver.launch();
    try {for (const [width, height] of [[360, 800], [390, 844]]) await capture(browser, engine, width, height);}
    finally {await browser.close();}
  }
  check(report.screenshots.length === 12 && report.cases.every(entry => entry.complete), 'Incomplete three-scene/two-engine/two-size comparison');
} catch (error) {report.errors.push(error.stack ?? String(error));}
finally {
  try {report.finalGuard = await guard();} catch (error) {report.errors.push(error.stack ?? String(error));if (!baseline) report.sourceClean = false;}
  report.endedAt = Date.now();report.complete = report.errors.length === 0;
  await writeFile(evidenceFile, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({mode, sourceCommit: metadata.sourceCommit, zipSha256: metadata.sha256,
    screenshots: report.screenshots.length, errors: report.errors.length, evidenceFile}));
  if (!report.complete) process.exitCode = 1;
}
