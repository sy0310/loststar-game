/** Complete-image evidence, from an immutable extracted production ZIP. */
import {chromium, webkit} from '@playwright/test';
import {mkdir, readFile, writeFile, unlink, access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {firstPlanetFixture} from '../releases/firstplanet-fixtures/firstplanet_fixtures.js';

const mode = process.argv[2] ?? 'screens';
if (!['screens', 'process', 'interactions'].includes(mode)) throw Error('Expected screens, process or interactions');
const expectedVersion = process.env.RENEWAL_VERSION ?? '0.4.3';
const base = process.env.RENEWAL_URL;
if (!base) throw Error(`RENEWAL_URL must point to the immutable extracted V${expectedVersion} package`);
const target = new URL(base);
if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.search || target.hash)
  throw Error('Use the fixed package entry URL without credentials, query or fragment');
const output = resolve(process.env.RENEWAL_OUTPUT ?? 'artifacts/v043-whole-state-review');
const database = 'loststar.fusion.firstplanet.v037';
const ids = ['receipt', 'tape', 'nested', 'stamp', 'cosmic-parcel', 'bell'];
const stages = ['found', 'clean', 'stabilized'];
const prices = {receipt: {clean: 40, repair: 120}, tape: {clean: 30, repair: 100}, nested: {clean: 50, repair: 140},
  stamp: {clean: 45, repair: 180}, 'cosmic-parcel': {clean: 60, repair: 220}, bell: {clean: 35, repair: 120}};
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const git = args => execFileSync('git', args, {encoding: 'utf8'}).trim();
const metadata = JSON.parse(await readFile('releases/taptap/package-info-fusion.json', 'utf8'));
if (metadata.version !== expectedVersion) throw Error(`Freeze and package V${expectedVersion} first; metadata is ${metadata.version}`);
const checkout = git(['rev-parse', 'HEAD']);
const runtimePaths = ['src', 'assets/runtime', ':(top,glob)package*.json', ':(top,glob)vite*.config.ts'];
async function frozenGuard() {
  const dirty = git(['status', '--porcelain', '--', ...runtimePaths]);
  const different = git(['diff', '--name-only', metadata.sourceCommit, checkout, '--', ...runtimePaths]);
  execFileSync('git', ['merge-base', '--is-ancestor', metadata.sourceCommit, checkout]);
  if (git(['rev-parse', 'HEAD']) !== checkout || dirty || different) throw Error(`Frozen runtime differs: ${different}\n${dirty}`);
  const bytes = await readFile(resolve(metadata.archive));
  if (bytes.length !== metadata.bytes || sha256(bytes) !== metadata.sha256) throw Error('ZIP bytes/SHA256 differ from package metadata');
  return {at: Date.now(), sourceCommit: metadata.sourceCommit, evidenceCheckoutCommit: checkout, dirty: [], different: [], zipSha256: sha256(bytes)};
}
const initialGuard = await frozenGuard();
const evidenceFile = `${output}/${mode}-whole-state-evidence.json`;
try {await access(evidenceFile);throw Error(`Evidence already exists; use a fresh RENEWAL_OUTPUT: ${evidenceFile}`);}
catch (error) {if (error.code !== 'ENOENT') throw error;}
for (const dir of ['screens', 'materials', 'raw', 'videos']) await mkdir(`${output}/${dir}`, {recursive: true});
const report = {mode, version: expectedVersion, sourceCommit: metadata.sourceCommit, evidenceCheckoutCommit: checkout,
  sourceClean: true, package: metadata, zipSha256: metadata.sha256, base, database, initialGuard,
  startedAt: Date.now(), collectorSha256: sha256(await readFile(new URL(import.meta.url))),
  fixtureModuleSha256: sha256(await readFile('releases/firstplanet-fixtures/firstplanet_fixtures.js')),
  physicalPhone: false, touchEmulation: true, privateContexts: true, clockOverrides: false, speed: 1,
  method: 'Ordinary-action earned fixtures in disposable contexts; no user profile, resource edit, condition edit, clock override or old tool-contact assertion. Full PNG exports are compared to browser-decoded complete stage thumbnails, including alpha.',
  cases: [], screenshots: [], materials: [], videos: [], errors: []};
const until = async at => {while (Date.now() < at) await new Promise(r => setTimeout(r, Math.min(100, at - Date.now())));};
const assert = (condition, message) => {if (!condition) throw Error(message);};
const focusSelector = id => id === 'receipt' ? '#fusion-paper-focus' : '#fusion-exhibit-focus';

async function archive(page) {
  return page.evaluate(name => new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, read = db.transaction('archive', 'readonly').objectStore('archive').get('current');
      read.onsuccess = () => {db.close();resolve(read.result);};
      read.onerror = () => {db.close();reject(read.error);};
    };
  }), database);
}
function treatment(state, id) {
  const item = id === 'receipt' ? state.receipt : state.curios[id];
  const action = id === 'receipt' ? item.activeAction : item.action;
  return {condition: item.condition, stage: id === 'receipt' ? item.stage : undefined,
    action: action ? {kind: action.kind, key: id === 'receipt' ? action.id : `${id}/${action.kind}/${action.startedAt}/${action.endsAt}`,
      startedAt: id === 'receipt' ? action.startedAtSeconds * 1000 : action.startedAt,
      endsAt: id === 'receipt' ? (action.startedAtSeconds + action.durationSeconds) * 1000 : action.endsAt} : null};
}
function ownership(state) {
  return {collection: state.game.collection, planets: state.game.planets, upgrades: state.game.upgrades,
    growth: state.game.growth, projects: state.projects, abilities: state.progression.abilities,
    journeySeed: state.journey?.seed, importedLegacy: state.importedLegacy};
}
function checkpoint(state, id) {
  return {savedAt: state.game.lastAt, storageRevision: state.storageRevision, balance: state.game.resources,
    grossIncome: state.game.station.grossIncome, maintenancePaid: state.game.station.repairSpent,
    treatment: treatment(state, id), ownership: ownership(state),
    receipt: {condition: state.receipt.condition, stage: state.receipt.stage, evidenceIds: state.receipt.evidenceIds,
      verifiedEvidenceIds: state.receipt.verifiedEvidenceIds, transactions: state.receipt.transactions}};
}
function ledger(before, after) {
  const grossDiff = after.game.station.grossIncome - before.game.station.grossIncome;
  const maintenanceDiff = after.game.station.repairSpent - before.game.station.repairSpent;
  return {balanceBefore: before.game.resources, balanceAfter: after.game.resources, grossDiff, maintenanceDiff,
    charged: before.game.resources + grossDiff - maintenanceDiff - after.game.resources,
    formula: 'balanceBefore + grossDiff - maintenanceDiff - balanceAfter = quoted clean + quoted repair'};
}
function fixture(stage) {
  const at = Date.now(), generated = firstPlanetFixture(at, 0, stage, {receiptAbility: 0, tapeAbility: 0});
  assert(generated.state.game.lastAt === at, 'Fixture must end at current wall time');
  assert(ids.every(id => treatment(generated.state, id).condition === stage && !treatment(generated.state, id).action), 'Fixture stage/action mismatch');
  assert(!generated.state.progression.abilities.receipt && !generated.state.progression.abilities.tape, 'Fixture has paid ability upgrades');
  return generated;
}
async function open(browser, {name, engine = 'chromium', width = 390, height = 844, generated, video = false}) {
  const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: 1, hasTouch: true, isMobile: true,
    ...(video ? {recordVideo: {dir: `${output}/raw`, size: {width, height}}} : {})});
  try {
    const seed = await context.newPage();
    await seed.route('**/*.js', route => route.abort());
    await seed.goto(base, {waitUntil: 'domcontentloaded'});
    await seed.evaluate(({name, state}) => new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('archive');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('archive', 'readwrite');
        tx.objectStore('archive').put(state, 'current');
        tx.oncomplete = () => {db.close();localStorage.setItem('loststar.ui.firstplanet.v037.intro', String(state.journey.seed));resolve();};
        tx.onerror = () => {db.close();reject(tx.error);};
      };
    }), {name: database, state: generated.state});
    const unused = seed.video();await seed.close();
    if (unused) await unlink(await unused.path());
    const createdBefore = Date.now(), page = await context.newPage(), createdAfter = Date.now(), errors = [];
    page.on('pageerror', error => errors.push(error.stack ?? error.message));
    page.on('response', response => {if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);});
    await page.goto(base);
    await page.locator('#fusion-world canvas[data-ready="true"]').waitFor({timeout: 30000});
    await page.waitForFunction(() => !!window.__FUSION__?.materialSnapshot);
    const build = await page.locator('.fu-build').innerText();
    assert(build.includes(expectedVersion) && build.includes(metadata.sourceCommit.slice(0, 7)) && !build.includes('dirty'), `Served build mismatch: ${build}`);
    assert(await page.evaluate(() => window.__FUSION__.databaseName) === database, 'Wrong live archive');
    return {name, context, page, engine, width, height, build, createdBefore, createdAfter, errors, closed: false};
  } catch (error) {await context.close();throw error;}
}
async function close(session) {
  if (!session || session.closed) return;
  session.closed = true;
  const recording = session.page.video();
  await session.context.close();
  if (recording) session.raw = await recording.path();
  report.errors.push(...session.errors.map(error => `${session.name}: ${error}`));
}
async function openTreatment(session, id) {
  await session.page.locator('#fusion-app > .fu-nav [data-tab="collection"]').tap();
  await session.page.locator(`#fusion-collection-list [data-detail="${id}"]`).tap();
  await session.page.locator('#fusion-drawer[open][data-mode="treatment"]').waitFor();
  await session.page.locator(`${focusSelector(id)}[data-ready="true"]`).waitFor();
  await session.page.locator('.fu-treatment-stages img').evaluateAll(async images => {
    if (images.length !== 3) throw Error('Expected exactly three complete-image previews');
    await Promise.all(images.map(image => image.decode()));
    if (images.some(image => image.naturalWidth !== 384 || image.naturalHeight !== 384)) throw Error('Preview is not a complete 384px image');
  });
}
async function shot(session, name, {kind = 'native-viewport', fullPage = false} = {}) {
  const file = `screens/${name}.png`, at = Date.now();
  await session.page.screenshot({path: `${output}/${file}`, scale: 'css', fullPage});
  const layout = await session.page.evaluate(() => {
    const dialog = document.querySelector('#fusion-drawer[open][data-mode="treatment"]'), box = dialog?.getBoundingClientRect();
    const rectangle = element => {const b = element.getBoundingClientRect();return {x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom};};
    const selected = document.querySelector('.fu-treatment-stages [aria-current="step"]');
    return {viewport: {width: innerWidth, height: innerHeight}, noOverflow: document.documentElement.scrollWidth <= innerWidth,
      treatment: box ? rectangle(dialog) : null,
      fullScreenTreatment: !box || Math.abs(box.y) <= 1 && Math.abs(box.height - innerHeight) <= 1,
      selected: selected?.getAttribute('data-condition') ?? null,
      previews: [...document.querySelectorAll('.fu-treatment-stages li')].map(item => ({condition: item.dataset.condition,
        current: item.getAttribute('aria-current'), bounds: rectangle(item), image: new URL(item.querySelector('img').src).pathname}))};
  });
  assert(layout.noOverflow && layout.fullScreenTreatment, `${name}: layout overflow or treatment not full screen`);
  const bytes = await readFile(`${output}/${file}`), entry = {name, file, kind, fullPage, engine: session.engine,
    width: session.width, height: session.height, at, build: session.build, sourceCommit: metadata.sourceCommit,
    zipSha256: metadata.sha256, sha256: sha256(bytes), bytes: bytes.length, layout,
    source: 'Unmodified Playwright screenshot of the fixed production package, CSS pixels; desktop mobile touch emulation'};
  report.screenshots.push(entry);return entry;
}

// One 10Hz observation: read the archive on both sides of the PNG export. If a
// real commit straddles it, record that bracket and check the next stable sample.
// Only a small state/renderer projection leaves the browser; no world datasets.
async function inspectSample({name, id, includePng}) {
  const read = () => new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, get = db.transaction('archive', 'readonly').objectStore('archive').get('current');
      get.onsuccess = () => {db.close();resolve(get.result);};get.onerror = () => {db.close();reject(get.error);};
    };
  });
  const small = state => {
    const item = id === 'receipt' ? state.receipt : state.curios[id], a = id === 'receipt' ? item.activeAction : item.action;
    return {savedAt: state.game.lastAt, revision: state.storageRevision, condition: item.condition,
      action: a ? {kind: a.kind, key: id === 'receipt' ? a.id : `${id}/${a.kind}/${a.startedAt}/${a.endsAt}`,
        startedAt: id === 'receipt' ? a.startedAtSeconds * 1000 : a.startedAt,
        endsAt: id === 'receipt' ? (a.startedAtSeconds + a.durationSeconds) * 1000 : a.endsAt} : null};
  };
  const before = small(await read()), actualCtime = Date.now(), dataUrl = window.__FUSION__.materialSnapshot(id);
  if (!dataUrl?.startsWith('data:image/png;base64,')) throw Error(`Missing complete material PNG: ${id}`);
  const canvas = document.querySelector(id === 'receipt' ? '#fusion-paper-focus' : '#fusion-exhibit-focus');
  const renderer = {ready: canvas?.dataset.ready, condition: canvas?.dataset.condition, materialStage: canvas?.dataset.materialStage,
    stateRenderer: canvas?.dataset.stateRenderer, stateImage: canvas?.dataset.stateImage, progress: Number(canvas?.dataset.processingProgress)};
  const selected = document.querySelector('.fu-treatment-stages [aria-current="step"]')?.getAttribute('data-condition');
  const image = new Image();image.src = dataUrl;await image.decode();
  const preview = document.querySelector(`.fu-treatment-stages [data-condition="${before.condition}"] img`);
  if (!preview?.complete || !preview.naturalWidth) throw Error('Complete preview has not decoded');
  const pixels = source => {
    const c = document.createElement('canvas');c.width = c.height = 384;
    const context = c.getContext('2d', {willReadFrequently: true});context.imageSmoothingEnabled = false;
    context.drawImage(source, 0, 0);return context.getImageData(0, 0, 384, 384).data;
  };
  const actual = pixels(image), expected = pixels(preview);
  let differingBytes = 0, maxChannelDelta = 0, transparent = 0, visible = 0, firstDifference = null;
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) {differingBytes++;maxChannelDelta = Math.max(maxChannelDelta, Math.abs(actual[i] - expected[i]));if (firstDifference === null) firstDifference = {byte: i, actual: actual[i], expected: expected[i]};}
    if (i % 4 === 3) {if (!actual[i]) transparent++;else visible++;}
  }
  const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
  const [rgbaSha256, previewRgbaSha256] = await Promise.all([digest(actual), digest(expected)]);
  const after = small(await read());
  return {actualCtime, observationEndedAt: Date.now(), before, after, stableCondition: before.condition === after.condition,
    renderer, selected, width: image.naturalWidth, height: image.naturalHeight, transparent, visible,
    differingBytes, maxChannelDelta, firstDifference, rgbaSha256, previewRgbaSha256,
    preview: {condition: before.condition, src: new URL(preview.currentSrc || preview.src).pathname, width: preview.naturalWidth, height: preview.naturalHeight},
    ...(includePng ? {dataUrl} : {})};
}
async function sample(session, id, includePng = false) {
  return session.page.evaluate(inspectSample, {name: database, id, includePng});
}
function validSample(value, label) {
  assert(value.width === 384 && value.height === 384 && value.transparent > 0 && value.visible > 0, `${label}: invalid complete transparent PNG`);
  assert(value.differingBytes === 0 && value.rgbaSha256 === value.previewRgbaSha256, `${label}: exported material differs from browser-decoded complete preview (${value.differingBytes} RGBA bytes)`);
  assert(value.selected === value.before.condition, `${label}: stage preview does not follow real entitlement`);
  assert(value.renderer.stateRenderer === 'whole-image-v043' && value.renderer.condition === value.before.condition
    && value.renderer.materialStage === value.before.condition, `${label}: renderer state is not the saved complete-image state`);
}
async function saveMaterial(session, id, label, value) {
  assert(value.dataUrl, `${label}: no PNG bytes`);
  const bytes = Buffer.from(value.dataUrl.split(',')[1], 'base64'), file = `materials/${label}.png`;
  await writeFile(`${output}/${file}`, bytes, {flag: 'wx'});
  const {dataUrl: _dataUrl, ...observation} = value;
  const entry = {id, file, engine: session.engine, viewportWidth: session.width, stage: value.before.condition,
    sha256: sha256(bytes), bytes: bytes.length, sourceCommit: metadata.sourceCommit, zipSha256: metadata.sha256,
    source: 'Unmodified window.__FUSION__.materialSnapshot(id) complete PNG; RGBA compared with direct browser drawImage of the matching decoded thumbnail', ...observation};
  report.materials.push(entry);return entry;
}
async function quote(session, id, kind) {
  const selector = id === 'receipt' ? '#fusion-paper-primary' : '#fusion-curio-primary';
  await session.page.waitForFunction(({selector, kind}) => {
    const b = document.querySelector(selector);return b && !b.disabled && b.dataset.kind === kind;
  }, {selector, kind});
  const button = session.page.locator(selector), label = await button.innerText(), quoted = Number(label.match(/\d+/g)?.at(-1));
  assert(quoted === prices[id][kind], `${id}/${kind}: native quote changed (${label})`);
  return {selector, kind, label, quoted, source: 'Current enabled production UI button, checked against unchanged original fee'};
}

async function readOnlyPreviews(session, id, entry) {
  const baseline = await archive(session.page), current = await sample(session, id);
  assert(treatment(baseline, id).condition === 'stabilized', `${id}: preview fixture must retain the purchased final state`);
  entry.readOnlyPreviews = [];
  for (const condition of stages) {
    const before = await archive(session.page);
    await session.page.locator(`[data-image-preview-condition="${condition}"]`).tap();
    await session.page.locator('#fusion-state-preview:not([hidden])').waitFor();
    await session.page.locator('#fusion-state-preview-image').evaluate(image => image.decode());
    const preview = await session.page.evaluate(async ({id, condition}) => {
      const image = document.querySelector('#fusion-state-preview-image');
      const thumbnail = document.querySelector(`.fu-treatment-stages [data-condition="${condition}"] img`);
      const digest = async source => {
        const canvas = document.createElement('canvas');canvas.width = canvas.height = 384;
        const context = canvas.getContext('2d', {willReadFrequently: true});context.drawImage(source, 0, 0);
        const pixels = context.getImageData(0, 0, 384, 384).data;
        return [...new Uint8Array(await crypto.subtle.digest('SHA-256', pixels))].map(b => b.toString(16).padStart(2, '0')).join('');
      };
      const [rgbaSha256, thumbnailRgbaSha256] = await Promise.all([digest(image), digest(thumbnail)]);
      const hidden = selector => [...document.querySelectorAll(selector)].every(element => !element.getClientRects().length);
      return {condition, width: image.naturalWidth, height: image.naturalHeight, src: new URL(image.currentSrc || image.src).pathname,
        rgbaSha256, thumbnailRgbaSha256, readOnlyMode: document.querySelector('#fusion-drawer-body').dataset.imagePreview === 'true',
        processingCanvasHidden: hidden(id === 'receipt' ? '#fusion-paper-focus' : '#fusion-exhibit-focus'),
        paidAndFreeControlsHidden: hidden('.fu-detail-actions,#fusion-exhibit-interaction,.fu-ability-panel'),
        caption: document.querySelector('#fusion-state-preview-caption').textContent};
    }, {id, condition});
    assert(preview.width === 384 && preview.height === 384 && preview.rgbaSha256 === preview.thumbnailRgbaSha256,
      `${id}/${condition}: enlarged preview differs from its complete thumbnail`);
    assert(preview.readOnlyMode && preview.processingCanvasHidden && preview.paidAndFreeControlsHidden, `${id}/${condition}: preview exposes treatment controls`);
    const screenshot = await shot(session, `${session.name}-preview-${condition}`, {kind: 'native-read-only-complete-image-preview'});
    const viewed = await sample(session, id);validSample(viewed, `${id}/${condition}/preview-entitlement`);
    assert(viewed.before.condition === 'stabilized' && viewed.rgbaSha256 === current.rgbaSha256, `${id}/${condition}: preview changed the actual complete material`);
    await session.page.locator('#fusion-state-preview-close').tap();
    await session.page.locator('#fusion-state-preview').waitFor({state: 'hidden'});
    const after = await archive(session.page), payment = ledger(before, after);
    const unchanged = isDeepStrictEqual(ownership(before), ownership(after)) && isDeepStrictEqual(treatment(before, id), treatment(after, id))
      && isDeepStrictEqual(before.receipt.transactions, after.receipt.transactions) && payment.charged === 0;
    assert(unchanged && treatment(after, id).condition === 'stabilized', `${id}/${condition}: preview changed a payment or entitlement`);
    assert(await session.page.locator('#fusion-drawer-body').getAttribute('data-image-preview') !== 'true', `${id}/${condition}: preview did not return to the actual current object`);
    entry.readOnlyPreviews.push({...preview, file: screenshot.file, archiveCondition: treatment(after, id).condition,
      payment, ownershipUnchanged: unchanged, before: checkpoint(before, id), after: checkpoint(after, id), returnedToCurrent: true});
  }
}

async function screens() {
  for (const [engine, width, height] of [['chromium', 360, 800], ['chromium', 390, 844], ['webkit', 390, 844]]) {
    const browser = await ({chromium, webkit}[engine]).launch();
    try {
      for (const id of ids) for (const stage of stages) {
        let session;
        const name = `${engine}-${width}-${id}-${stage}`, entry = {name, kind: 'complete-state', id, stage, engine, width, height, errors: []};
        report.cases.push(entry);
        try {
          const generated = fixture(stage);entry.fixtureAudit = generated.audit;
          entry.fixtureOptions = {at: generated.state.game.lastAt, condition: stage, caseLevel: 0, receiptAbility: 0, tapeAbility: 0};
          session = await open(browser, {name, engine, width, height, generated});
          await openTreatment(session, id);
          const before = await archive(session.page), exported = await sample(session, id, true);
          validSample(exported, name);assert(exported.before.condition === stage, `${name}: unexpected actual stage`);
          entry.page = (await shot(session, name)).file;
          entry.material = (await saveMaterial(session, id, name, exported)).file;
          entry.quote = stage === 'stabilized' ? null : await quote(session, id, stage === 'found' ? 'clean' : 'repair');
          const after = await archive(session.page);
          entry.before = checkpoint(before, id);entry.after = checkpoint(after, id);entry.ledger = ledger(before, after);
          entry.readOnly = isDeepStrictEqual(ownership(before), ownership(after)) && isDeepStrictEqual(treatment(before, id), treatment(after, id))
            && isDeepStrictEqual(before.receipt.transactions, after.receipt.transactions) && entry.ledger.charged === 0;
          assert(entry.readOnly, `${name}: read-only review changed ownership, material or payment`);
          if (engine === 'chromium' && width === 390 && stage === 'stabilized') await readOnlyPreviews(session, id, entry);
          entry.complete = true;
        } catch (error) {entry.errors.push(error.stack ?? String(error));report.errors.push(`${name}: ${error.message}`);}
        finally {if (session) entry.browserErrors = session.errors;await close(session);}
        console.log(`whole state ${name}: ${entry.complete ? 'ok' : 'FAILED'}`);
      }
      let session;
      try {
        const generated = fixture('stabilized'), name = `${engine}-${width}-shared-room`;
        session = await open(browser, {name, engine, width, height, generated});
        await session.page.locator('[data-tab="base"]').tap();
        await session.page.locator('#museum-canvas[data-ready="true"]').waitFor();
        const baseShot = await shot(session, `${name}-base`, {kind: 'full-page-base', fullPage: true});
        await session.page.locator('[data-tab="collection"]').tap();
        await session.page.locator('#fusion-collection-list [data-detail="receipt"]').waitFor();
        await session.page.locator('#fusion-collection-list img').evaluateAll(async images => {await Promise.all(images.map(i => i.decode()));});
        const collectionShot = await shot(session, `${name}-collection`, {kind: 'full-page-collection', fullPage: true});
        report.cases.push({name, kind: 'shared-room', engine, width, height, fixtureAudit: generated.audit,
          baseFile: baseShot.file, collectionFile: collectionShot.file, ownership: ownership(await archive(session.page)), errors: session.errors, complete: true});
      } catch (error) {report.errors.push(`${engine}-${width} shared room: ${error.stack ?? error}`);}
      finally {await close(session);}
    } finally {await browser.close();}
  }
}

async function paidStep(session, id, kind, entry) {
  const quoted = await quote(session, id, kind), before = await archive(session.page), from = treatment(before, id).condition;
  const expected = kind === 'clean' ? 'clean' : 'stabilized';
  const original = await sample(session, id, true);validSample(original, `${id}/${kind}/before`);
  const beforeMaterial = await saveMaterial(session, id, `${session.name}-${kind}-before`, original);
  const step = {id, kind, quote: quoted, before: checkpoint(before, id), beforeMaterial: beforeMaterial.file,
    clickedAt: Date.now(), observations: [], complete: false};entry.steps.push(step);
  await session.page.locator(quoted.selector).tap();
  let action, startedState, completedState, mid;
  const started = Date.now();let nextPoll = started;
  while (Date.now() - started < 30000) {
    await until(nextPoll);nextPoll = Date.now() + 100;
    const value = await sample(session, id);
    step.observations.push(value);
    if (value.before.condition === expected || value.after.condition === expected)
      step.conditionChangedObservedAt ??= value.before.condition === expected ? value.actualCtime : value.observationEndedAt;
    // The commit bracket is retained verbatim, without choosing a convenient
    // condition or disguising a transition as a steady processing frame.
    if (!value.stableCondition) continue;
    if (value.before.action) {
      validSample(value, `${id}/${kind}@${value.actualCtime}`);
      if (!action) {action = value.before.action;startedState = await archive(session.page);}
      assert(value.before.action.key === action.key && action.kind === kind, `${id}/${kind}: unexpected action replaced the paid action`);
      assert(value.before.condition === from && value.rgbaSha256 === original.rgbaSha256, `${id}/${kind}: complete image changed before the real condition entitlement`);
      const progress = (value.actualCtime - action.startedAt) / (action.endsAt - action.startedAt);
      if (!mid && progress >= .35) {
        mid = await shot(session, `${session.name}-${kind}-processing`, {kind: 'native-processing-viewport'});
        const active = await sample(session, id, true);validSample(active, `${id}/${kind}/processing`);
        assert(active.before.condition === from && active.before.action?.key === action.key, `${id}/${kind}: missed real processing frame`);
        step.processingMaterial = (await saveMaterial(session, id, `${session.name}-${kind}-processing`, active)).file;
        step.processingFile = mid.file;
      }
    } else if (value.before.condition === expected) {
      step.conditionChangedObservedAt ??= value.actualCtime;
      const elapsedSinceConditionMs = value.actualCtime - step.conditionChangedObservedAt;
      assert(elapsedSinceConditionMs <= 500, `${id}/${kind}: image/UI failed to follow the actual condition within 500ms`);
      const priorImage = value.rgbaSha256 === original.rgbaSha256;
      const targetImage = value.rgbaSha256 === value.previewRgbaSha256;
      const aligned = value.renderer.stateRenderer === 'whole-image-v043' && value.renderer.condition === expected
        && value.renderer.materialStage === expected && value.selected === expected && targetImage;
      // IDB, controller notification and rAF need not settle in the same task.
      // Preserve every observed handoff verbatim. Only either complete image
      // is allowed during this bounded handoff; a blended/partial image fails.
      if (!aligned) {
        assert(value.width === 384 && value.height === 384 && value.transparent > 0 && value.visible > 0,
          `${id}/${kind}: invalid complete PNG during condition handoff`);
        assert(priorImage || targetImage, `${id}/${kind}: handoff contains neither the original nor the target complete image`);
        value.handoff = {elapsedSinceConditionMs, completeImage: priorImage ? 'prior' : 'target'};
        continue;
      }
      validSample(value, `${id}/${kind}/settled`);completedState = await archive(session.page);break;
    } else {validSample(value, `${id}/${kind}@${value.actualCtime}`);assert(value.before.condition === from, `${id}/${kind}: unexpected condition`);}
  }
  assert(action && startedState && completedState && mid, `${id}/${kind}: missing active action, processing frame or actual completion`);
  assert(action.endsAt > action.startedAt, `${id}/${kind}: invalid native action time`);
  step.action = action;step.started = checkpoint(startedState, id);step.after = checkpoint(completedState, id);
  step.completedObservedAt = step.observations.at(-1).actualCtime;
  step.startLedger = ledger(before, startedState);step.ledger = ledger(before, completedState);step.afterStartLedger = ledger(startedState, completedState);
  const prior = new Set(before.receipt.transactions.map(t => t.actionId));
  step.receiptTransactions = completedState.receipt.transactions.filter(t => !prior.has(t.actionId));
  step.noRepeatCharge = step.startLedger.charged === quoted.quoted && step.ledger.charged === quoted.quoted && step.afterStartLedger.charged === 0;
  if (id === 'receipt') step.noRepeatCharge &&= step.receiptTransactions.length === 1 && step.receiptTransactions[0].actionId === action.key
    && step.receiptTransactions[0].kind === kind && step.receiptTransactions[0].amount === quoted.quoted;
  else step.noRepeatCharge &&= step.receiptTransactions.length === 0;
  assert(step.noRepeatCharge, `${id}/${kind}: payment differs from its single original quote`);
  const final = await sample(session, id, true);validSample(final, `${id}/${kind}/complete`);
  assert(final.before.condition === expected && final.rgbaSha256 !== original.rgbaSha256, `${id}/${kind}: missing actual complete-image switch`);
  step.completeMaterial = (await saveMaterial(session, id, `${session.name}-${kind}-complete`, final)).file;
  step.completeFile = (await shot(session, `${session.name}-${kind}-complete`)).file;
  await until(Date.now() + 500);
  step.complete = true;
}
async function saveVideo(session, entry) {
  const file = `videos/${session.name}.mp4`, durationSeconds = (entry.reviewEndedAt - entry.reviewStartedAt) / 1000;
  const leadInSeconds = Math.max(0, (entry.reviewStartedAt - session.createdAfter) / 1000);
  execFileSync('ffmpeg', ['-y', '-i', session.raw, '-vf', `trim=start=${leadInSeconds}:duration=${durationSeconds},setpts=PTS-STARTPTS`,
    '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${output}/${file}`], {stdio: 'ignore'});
  const bytes = await readFile(`${output}/${file}`), raw = await readFile(session.raw);
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'quiet', '-show_format', '-show_streams', '-of', 'json', `${output}/${file}`], {encoding: 'utf8'}));
  const video = {file, id: entry.id, kind: entry.videoKind ?? 'natural-clean-then-repair', durationSeconds, speed: 1, width: 390, height: 844,
    bytes: bytes.length, sha256: sha256(bytes), sourceCommit: metadata.sourceCommit, zipSha256: metadata.sha256, probe,
    raw: {file: `raw/${session.raw.split('/').at(-1)}`, bytes: raw.length, sha256: sha256(raw)},
    source: 'Native Playwright WebM at the original viewport, transcoded once to MP4; only loading lead-in/end trimmed. No assembled frames, speed changes, or simulated time.',
    audioRecorded: false, leadInSeconds, alignment: {pageCreatedBefore: session.createdBefore, pageCreatedAfter: session.createdAfter,
      reviewStartedAt: entry.reviewStartedAt, reviewEndedAt: entry.reviewEndedAt}};
  assert(probe.streams.some(s => s.codec_type === 'video' && s.width === 390 && s.height === 844), 'Video viewport mismatch');
  report.videos.push(video);entry.video = video;
}
async function processCases() {
  const browser = await chromium.launch();
  try {
    for (const id of ids) {
      let session;
      const name = `chromium-390-${id}-natural-process`, entry = {name, kind: 'natural-process', id, engine: 'chromium', width: 390, height: 844,
        naturalTime: true, pollIntervalMs: 100, steps: [], errors: [], complete: false};report.cases.push(entry);
      try {
        const generated = fixture('found');entry.fixtureAudit = generated.audit;
        entry.fixtureOptions = {at: generated.state.game.lastAt, condition: 'found', caseLevel: 0, receiptAbility: 0, tapeAbility: 0};
        session = await open(browser, {name, generated, video: true});
        await openTreatment(session, id);
        const before = await archive(session.page);entry.before = checkpoint(before, id);
        assert(treatment(before, id).condition === 'found' && (id !== 'receipt' || before.receipt.stage === 'displayed'), `${id}: must start naturally earned found state`);
        entry.reviewStartedAt = Date.now();
        entry.initialFile = (await shot(session, `${name}-found`)).file;
        await until(Date.now() + 500);
        await paidStep(session, id, 'clean', entry);
        await paidStep(session, id, 'repair', entry);
        const after = await archive(session.page);entry.after = checkpoint(after, id);entry.ledger = ledger(before, after);
        entry.quotedTotal = entry.steps.reduce((sum, step) => sum + step.quote.quoted, 0);
        entry.ownershipUnchanged = isDeepStrictEqual(ownership(before), ownership(after));
        entry.noRepeatPayment = entry.ledger.charged === entry.quotedTotal && entry.steps.every(step => step.noRepeatCharge);
        assert(entry.ownershipUnchanged && entry.noRepeatPayment, `${id}: ownership changed or total ledger differs from the two original quotes`);
        entry.complete = true;
      } catch (error) {entry.errors.push(error.stack ?? String(error));report.errors.push(`${name}: ${error.message}`);}
      finally {
        entry.reviewEndedAt = Date.now();
        if (session) entry.browserErrors = session.errors;
        await close(session);
        if (session?.raw && entry.reviewStartedAt) {
          try {await saveVideo(session, entry);} catch (error) {entry.errors.push(error.stack ?? String(error));report.errors.push(`${name} video: ${error.message}`);}
        }
      }
      console.log(`whole process ${id}: ${entry.complete ? 'ok' : 'FAILED'}`);
    }
  } finally {await browser.close();}
}

function receiptFacts(state) {
  const receipt = state.receipt;
  return {specimenId: receipt.specimenId, stage: receipt.stage, condition: receipt.condition, caseTier: receipt.caseTier,
    evidenceIds: receipt.evidenceIds, verifiedEvidenceIds: receipt.verifiedEvidenceIds,
    observations: receipt.observations, transactions: receipt.transactions};
}
async function installInteractionObserver(page) {
  await page.evaluate(() => {
    const events = [];
    window.__WHOLE_INTERACTION_EVIDENCE__ = {events};
    window.addEventListener('loststar:sound-cue', event => {
      const canvas = document.querySelector(event.detail?.id === 'receipt' ? '#fusion-paper-focus' : '#fusion-exhibit-focus');
      const d = canvas?.dataset ?? {};
      events.push({sequence: events.length, at: Date.now(), performanceAt: performance.now(),
        cue: String(event.detail?.cue ?? ''), id: String(event.detail?.id ?? ''),
        canvas: {frame: d.frame ?? null, condition: d.condition ?? null, experimentPlaying: d.experimentPlaying ?? null,
          replay: d.replay ?? null, experimentStartedAt: d.experimentStartedAt ?? null,
          mechanismPhase: d.mechanismPhase ?? null, mechanismTime: d.mechanismTime ?? null,
          bellStroke: d.bellStroke ?? null, bellTriggered: d.bellTriggered ?? null, toolContact: d.toolContact ?? null}});
    });
  });
}
async function interactionObservation(session, id, trialMs) {
  return session.page.evaluate(async ({name, id, trialMs}) => {
    const save = await new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);request.onerror = () => reject(request.error);
      request.onsuccess = () => {const db = request.result, get = db.transaction('archive', 'readonly').objectStore('archive').get('current');
        get.onsuccess = () => {db.close();resolve(get.result);};get.onerror = () => {db.close();reject(get.error);};};
    });
    const canvas = document.querySelector(id === 'receipt' ? '#fusion-paper-focus' : '#fusion-exhibit-focus'), d = canvas?.dataset ?? {};
    const at = Date.now(), performanceAt = performance.now(), active = id === 'receipt' ? save.receipt.activeAction : null;
    const action = active ? {key: active.id, kind: active.kind, startedAt: active.startedAtSeconds * 1000,
      endsAt: (active.startedAtSeconds + active.durationSeconds) * 1000, durationMs: active.durationSeconds * 1000} : null;
    const startedAt = id === 'receipt' ? action?.startedAt ?? null : Number(d.experimentStartedAt);
    const progress = id === 'receipt' ? action ? (at - action.startedAt) / action.durationMs : null
      : Number.isFinite(startedAt) ? (performanceAt - startedAt) / trialMs : null;
    const calendar = delta => {const date = new Date(at);date.setDate(date.getDate() + delta);
      return `${String(date.getMonth()+1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;};
    const button = document.querySelector('#fusion-try'), response = document.querySelector('#fusion-curio-response');
    return {at, performanceAt, timeOrigin: performance.timeOrigin, savedAt: save.game.lastAt,
      condition: id === 'receipt' ? save.receipt.condition : save.curios[id]?.condition,
      action, completedReceiptActionIds: id === 'receipt' ? save.receipt.completedActionIds.slice(-4) : undefined,
      progress, buttonEnabled: Boolean(button && !button.disabled),
      response: response && !response.hidden ? response.textContent : null,
      canvas: {ready: d.ready ?? null, frame: d.frame ?? null, stateRenderer: d.stateRenderer ?? null,
        stateImage: d.stateImage ?? null, materialStage: d.materialStage ?? null, condition: d.condition ?? null,
        sourceMap: d.curioStates ? JSON.parse(d.curioStates) : null,
        restorationPhase: d.restorationPhase ?? null, restorationOriginalCode: d.restorationOriginalCode ?? null,
        restorationMissing: d.restorationMissing ?? null, experimentPlaying: d.experimentPlaying ?? null,
        replay: d.replay ?? null, experimentStartedAt: d.experimentStartedAt ?? null,
        mechanism: d.mechanism ?? null, mechanismPhase: d.mechanismPhase ?? null, mechanismTime: d.mechanismTime ?? null,
        tapeLength: d.tapeLength ?? null, rollAngle: d.rollAngle ?? null, bellStroke: d.bellStroke ?? null,
        bellTriggered: d.bellTriggered ?? null, toolContact: d.toolContact ?? null,
        performanceDate: d.performanceDate ?? d.experimentDate ?? null},
      expectedPerformanceDate: id === 'stamp' && progress !== null ? calendar(progress >= .48 ? -1 : 0) : null};
  }, {name: database, id, trialMs});
}
async function freeReplay(session, id, index, trialMs) {
  await session.page.locator('#fusion-try:not([disabled]):not([hidden])').waitFor();
  const before = await archive(session.page), idle = await interactionObservation(session, id, trialMs);
  const firstCue = await session.page.evaluate(() => window.__WHOLE_INTERACTION_EVIDENCE__.events.length);
  const label = await session.page.locator('#fusion-try').innerText();
  const entry = {index, id, label, before: checkpoint(before, id), clickedAt: Date.now(), observations: [],
    phaseScreenshots: [], soundCues: [], complete: false, audibleProof: false};
  await session.page.locator('#fusion-try').tap();
  let started, actualDurationMs, sourceAction;
  const waitStart = Date.now();
  while (Date.now() - waitStart < 4000) {
    const value = await interactionObservation(session, id, trialMs);entry.observations.push(value);
    if (id === 'receipt' ? value.action?.kind === 'try' : value.canvas.experimentPlaying === 'true' && value.canvas.replay !== idle.canvas.replay) {
      started = value;
      actualDurationMs = id === 'receipt' ? value.action.durationMs : trialMs;
      sourceAction = id === 'receipt' ? value.action : {key: `visual/${id}/${value.canvas.replay}`,
        startedAt: value.timeOrigin + Number(value.canvas.experimentStartedAt), endsAt: value.timeOrigin + Number(value.canvas.experimentStartedAt) + trialMs,
        performanceStartedAt: Number(value.canvas.experimentStartedAt), replay: value.canvas.replay};
      break;
    }
    await until(Date.now() + 50);
  }
  assert(started && actualDurationMs > 0, `${id}/${index}: actual native interaction did not start`);
  entry.sourceAction = sourceAction;entry.actualDurationMs = actualDurationMs;
  entry.durationSource = id === 'receipt' ? 'Actual persisted receipt try action.durationSeconds' : 'mechanismTrialMs read from the frozen runtime source';
  const requested = [.2, .5, .8], taken = new Set();let settled;
  const deadline = sourceAction.endsAt + 4000;let nextPoll = Date.now();
  while (Date.now() < deadline) {
    await until(nextPoll);nextPoll = Date.now() + 100;
    const value = await interactionObservation(session, id, trialMs);entry.observations.push(value);
    assert(value.condition === 'stabilized', `${id}/${index}: free interaction changed the saved physical condition`);
    const active = id === 'receipt' ? value.action?.key === sourceAction.key : value.canvas.experimentPlaying === 'true' && value.canvas.replay === sourceAction.replay;
    if (active) {
      for (const target of requested) if (!taken.has(target) && value.progress >= target) {
        assert(value.progress < Math.min(1, target + .18), `${id}/${index}: missed the actual ${target} interaction window`);
        const beforeShot = value, screenshot = await shot(session, `${session.name}-replay-${index}-phase-${Math.round(target * 100)}`, {kind: 'native-free-interaction-phase'});
        const afterShot = await interactionObservation(session, id, trialMs);
        assert(afterShot.condition === 'stabilized', `${id}/${index}: phase screenshot changed the physical state`);
        if (id === 'stamp') assert(beforeShot.canvas.performanceDate === beforeShot.expectedPerformanceDate,
          `${id}/${index}: painted date does not follow the real local calendar and .48 trial change`);
        entry.phaseScreenshots.push({targetProgress: target, actualProgressBefore: beforeShot.progress, actualProgressAfter: afterShot.progress,
          file: screenshot.file, beforeShot, afterShot});taken.add(target);
      }
    } else if (id === 'receipt' ? !value.action && value.completedReceiptActionIds.includes(sourceAction.key)
      : value.canvas.experimentPlaying === 'false' && Date.now() >= sourceAction.endsAt) {settled = value;break;}
  }
  assert(settled && taken.size === 3, `${id}/${index}: missing actual end or 20/50/80% native phase screenshots`);
  entry.completedObservedAt = settled.at;
  await session.page.locator('#fusion-try:not([disabled]):not([hidden])').waitFor();
  const after = await archive(session.page);entry.after = checkpoint(after, id);entry.ledger = ledger(before, after);
  entry.soundCues = await session.page.evaluate(start => window.__WHOLE_INTERACTION_EVIDENCE__.events.slice(start), firstCue);
  const ownCues = entry.soundCues.filter(event => event.id === id && event.cue === (id === 'bell' ? 'curio-bell' : 'interaction'));
  assert(ownCues.length === 1, `${id}/${index}: expected one actual interaction sound-cue event`);
  if (id === 'bell') assert(ownCues[0].canvas.bellTriggered === 'true' && ownCues[0].canvas.toolContact === 'true'
    && Number(ownCues[0].canvas.bellStroke) > 0, `${id}/${index}: bell cue is not coupled to its actual bottom-of-stroke painted frame`);
  entry.free = entry.ledger.charged === 0 && isDeepStrictEqual(ownership(before), ownership(after))
    && isDeepStrictEqual(receiptFacts(before), receiptFacts(after)) && isDeepStrictEqual(before.curios, after.curios);
  assert(entry.free, `${id}/${index}: free replay altered money, signed facts or rights`);
  entry.response = settled.response;entry.complete = true;
  await until(Date.now() + 250);return entry;
}
async function interactions() {
  const modelFile = 'src/fusion/curio-mechanism-model.ts', modelBytes = await readFile(modelFile);
  const duration = modelBytes.toString().match(/export\s+const\s+mechanismTrialMs\s*=\s*([\d_]+)\s*;/);
  const trialMs = duration ? Number(duration[1].replaceAll('_', '')) : NaN;
  assert(Number.isFinite(trialMs) && trialMs > 0, 'Cannot read the actual frozen mechanismTrialMs');
  const automaticModule = '../releases/physical-fixtures/physical_review_fixtures.js';
  const {advanceFusion} = await import(automaticModule);
  report.interactionMethod = {mechanismTrialMs: trialMs, durationSource: modelFile, modelSha256: sha256(modelBytes),
    automaticModelModule: automaticModule, automaticModelSha256: sha256(await readFile('releases/physical-fixtures/physical_review_fixtures.js')),
    screenshotsAt: [.2, .5, .8], replayCount: 2, sourceMaps: 'Actual canvas curioStates map and whitelisted frame/mechanism/date fields where present',
    soundProof: 'Observed loststar:sound-cue DOM event times and the bell canvas fields at that event; no audible/recorded audio claim',
    audioRecorded: false, clockOverrides: false};
  const browser = await chromium.launch();
  try {
    for (const id of ids) {
      let session;
      const name = `chromium-390-${id}-free-interactions`, entry = {name, kind: 'free-interactions', videoKind: 'two-free-active-interactions',
        id, engine: 'chromium', width: 390, height: 844, naturalTime: true, audioRecorded: false, audibleProof: false,
        replays: [], errors: [], complete: false};report.cases.push(entry);
      try {
        const generated = fixture('stabilized');entry.fixtureAudit = generated.audit;
        entry.fixtureOptions = {at: generated.state.game.lastAt, condition: 'stabilized', caseLevel: 0, receiptAbility: 0, tapeAbility: 0};
        session = await open(browser, {name, generated, video: true});await openTreatment(session, id);
        await installInteractionObserver(session.page);
        const before = await archive(session.page);entry.before = checkpoint(before, id);entry.beforeReceiptFacts = receiptFacts(before);
        const initialMaterial = await sample(session, id);validSample(initialMaterial, `${id}/interaction-before`);
        entry.initialMaterialRgbaSha256 = initialMaterial.rgbaSha256;entry.reviewStartedAt = Date.now();
        entry.initialFile = (await shot(session, `${name}-before`)).file;await until(Date.now() + 250);
        for (let index = 0; index < 2; index++) entry.replays.push(await freeReplay(session, id, index, trialMs));
        entry.completeFile = (await shot(session, `${name}-complete`)).file;
        const after = await archive(session.page), automatic = advanceFusion(before, after.game.lastAt);
        const finalMaterial = await sample(session, id);validSample(finalMaterial, `${id}/interaction-after`);
        entry.after = checkpoint(after, id);entry.afterReceiptFacts = receiptFacts(after);entry.ledger = ledger(before, after);
        entry.finalMaterialRgbaSha256 = finalMaterial.rgbaSha256;
        entry.gameMatchesOrdinaryAutomaticAdvance = isDeepStrictEqual(after.game, automatic.game);
        entry.ownershipUnchanged = isDeepStrictEqual(ownership(before), ownership(after));
        entry.receiptFactsUnchanged = isDeepStrictEqual(receiptFacts(before), receiptFacts(after));
        entry.curioStatesUnchanged = isDeepStrictEqual(before.curios, after.curios);
        const priorIds = new Set(before.receipt.completedActionIds);
        entry.newReceiptCompletionIds = after.receipt.completedActionIds.filter(key => !priorIds.has(key));
        entry.receiptTryAudit = id === 'receipt' ? entry.newReceiptCompletionIds.length === 2
          && entry.replays.every(replay => entry.newReceiptCompletionIds.includes(replay.sourceAction.key)) : entry.newReceiptCompletionIds.length === 0;
        entry.noFreeRewardOrSpend = entry.ledger.charged === 0 && entry.gameMatchesOrdinaryAutomaticAdvance;
        assert(entry.noFreeRewardOrSpend && entry.ownershipUnchanged && entry.receiptFactsUnchanged && entry.curioStatesUnchanged
          && entry.receiptTryAudit && finalMaterial.rgbaSha256 === initialMaterial.rgbaSha256,
        `${id}: free interactions differ from ordinary automatic income/maintenance, changed facts/rights or material`);
        assert(entry.replays.length === 2 && entry.replays.every(replay => replay.complete && replay.free), `${id}: incomplete sequential free replays`);
        entry.complete = true;await until(Date.now() + 250);
      } catch (error) {entry.errors.push(error.stack ?? String(error));report.errors.push(`${name}: ${error.message}`);}
      finally {
        entry.reviewEndedAt = Date.now();if (session) entry.browserErrors = session.errors;await close(session);
        if (session?.raw && entry.reviewStartedAt) {
          try {await saveVideo(session, entry);} catch (error) {entry.errors.push(error.stack ?? String(error));report.errors.push(`${name} video: ${error.message}`);}
        }
      }
      console.log(`free interactions ${id}: ${entry.complete ? 'ok' : 'FAILED'}`);
    }
  } finally {await browser.close();}
}

try {
  if (mode === 'screens') await screens();else if (mode === 'process') await processCases();else await interactions();
  const stateCases = report.cases.filter(c => c.kind === (mode === 'screens' ? 'complete-state' : mode === 'process' ? 'natural-process' : 'free-interactions'));
  assert(stateCases.length === (mode === 'screens' ? 54 : 6) && stateCases.every(c => c.complete), 'Incomplete required case matrix');
  if (mode === 'screens') {
    assert(report.cases.filter(c => c.kind === 'shared-room' && c.complete).length === 3, 'Missing engine/viewport room pages');
    assert(stateCases.reduce((sum, c) => sum + (c.readOnlyPreviews?.length ?? 0), 0) === 18, 'Missing read-only enlarged A/B/C previews for the six already-upgraded objects');
  }
  else assert(report.videos.length === 6, 'Missing a native continuous recording');
} catch (error) {report.errors.push(error.stack ?? String(error));}
finally {
  try {report.finalGuard = await frozenGuard();} catch (error) {report.sourceClean = false;report.errors.push(error.stack ?? String(error));}
  report.endedAt = Date.now();report.elapsedSeconds = (report.endedAt - report.startedAt) / 1000;
  report.complete = report.errors.length === 0;
  await writeFile(evidenceFile, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({mode, sourceCommit: metadata.sourceCommit, zipSha256: metadata.sha256, cases: report.cases.length,
    screenshots: report.screenshots.length, materials: report.materials.length, videos: report.videos.length, errors: report.errors.length, evidenceFile}));
  if (report.errors.length) process.exitCode = 1;
}
