#!/usr/bin/env node
/** V045 A: immutable-package captures, ordinary fixtures, native real-time films. */
import {chromium, webkit} from '@playwright/test';
import {readFile, writeFile, mkdir, access, unlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve, posix} from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual as equal} from 'node:util';
import {collectRuntimeBinding, readZipEntries, RUNTIME_ROOTS} from './execution_acceptance.mjs';
import {firstPlanetFixture} from '../releases/firstplanet-fixtures/firstplanet_fixtures.js';
import {feedbackFixture} from '../releases/feedback-fixtures/feedback_fixtures.js';
import {renewalFixture, renewalPagesFixture} from '../releases/renewal-fixtures/renewal_fixtures.js';
import {advanceFusion, physicalMuseumFixture} from '../releases/physical-fixtures/physical_review_fixtures.js';

const mode = process.argv[2] ?? 'screens';
if (!['screens', 'night', 'collection', 'assist', 'museum', 'cases'].includes(mode)) throw Error('Expected screens, night, collection, assist, museum or cases');
const version = process.env.RENEWAL_VERSION ?? '0.4.5', base = process.env.RENEWAL_URL;
if (!base) throw Error('RENEWAL_URL must point to the frozen V045 extracted package');
const url = new URL(base), servedRoot = new URL('./', url);
if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw Error('Use a fixed package URL without credentials/query/fragment');
const output = resolve(process.env.RENEWAL_OUTPUT ?? 'artifacts/v045-a-exploration');
const dbName = 'loststar.fusion.firstplanet.v037';
const ids = ['receipt', 'tape', 'nested', 'stamp', 'cosmic-parcel', 'bell'], stages = ['found', 'clean', 'stabilized'];
const prices = {receipt: {clean: 40, repair: 120}, tape: {clean: 30, repair: 100}, nested: {clean: 50, repair: 140}, stamp: {clean: 45, repair: 180}, 'cosmic-parcel': {clean: 60, repair: 220}, bell: {clean: 35, repair: 120}};
// Keep the actual A-version selectors here. Missing/replaced controls fail for
// adaptation after freeze; no fallback recreates the retired multi-entry UI.
const ui = {home: '#fusion-explore', world: '#fusion-world canvas[data-ready="true"]', nav: '#fusion-app > .fu-nav',
  flowEntry: '#fusion-observe', flow: '#fusion-field-drawer', flowClose: '#fusion-field-close', flowContent: '#fusion-flow-content',
  flowReplay: '#fusion-flow-content #fusion-replay-night', replayRegion: '#fusion-flow-replay', assist: '#fusion-assist', objective: '#fusion-objective', objectiveProgress: '#fusion-objective-progress',
  base: '#fusion-base', devices: '#fusion-base [data-drawer="upgrades"]', facilities: '#fusion-base [data-drawer]',
  baseMore: '#fusion-base-more', collectionIndex: '#fusion-collection-index',
  management: ['#fusion-map', '#fusion-wallet', '#fusion-settings'], returnClaim: '#fusion-flow-content #fusion-claim',
  list: '#fusion-collection-list', drawer: '#fusion-drawer', close: '#fusion-close', backToCollection: '#fusion-back-to-collection'};
const focus = id => id === 'receipt' ? '#fusion-paper-focus' : '#fusion-exhibit-focus';
const primary = id => id === 'receipt' ? '#fusion-paper-primary' : '#fusion-curio-primary';
const check = (value, message) => {if (!value) throw Error(message);};
const sha = raw => createHash('sha256').update(raw).digest('hex');
const git = args => execFileSync('git', args, {encoding: 'utf8'}).trim();
const until = async at => {while (Date.now() < at) await new Promise(r => setTimeout(r, Math.min(100, at - Date.now())));};
const meta = JSON.parse(await readFile('releases/taptap/package-info-fusion.json', 'utf8'));
check(meta.version === version, `Freeze ${version} first; current metadata is ${meta.version}`);
const checkout = git(['rev-parse', 'HEAD']);
async function guard() {
  const paths = [...RUNTIME_ROOTS, 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', ':(top,glob)vite*.ts'];
  check(!git(['status', '--porcelain', '--', ...paths]) && !git(['diff', '--name-only', meta.sourceCommit, checkout, '--', ...paths]), 'Frozen runtime/source originals differ');
  check(git(['rev-parse', 'HEAD']) === checkout, 'Evidence checkout changed during capture');
  execFileSync('git', ['merge-base', '--is-ancestor', meta.sourceCommit, checkout]);
  const raw = await readFile(meta.archive);check(raw.length === meta.bytes && sha(raw) === meta.sha256, 'Actual ZIP differs from package metadata');
  return {at: Date.now(), ...await collectRuntimeBinding(process.cwd(), meta.sourceCommit), zipSha256: sha(raw), zipBytes: raw.length};
}
const initialGuard = await guard(), zip = readZipEntries(await readFile(meta.archive));
const entryRoot = `${posix.dirname(meta.entry)}/`, entryHash = sha(zip.get(meta.entry));
const reportFile = `${output}/${mode}-evidence.json`;
try {await access(reportFile);throw Error(`Refuse to replace capture evidence: ${reportFile}`);} catch (e) {if (e.code !== 'ENOENT') throw e;}
for (const directory of ['screens', 'materials', 'videos', 'raw']) await mkdir(`${output}/${directory}`, {recursive: true});
const report = {schema: 1, mode, version, sourceCommit: meta.sourceCommit, zipSha256: meta.sha256, package: meta,
  evidenceCheckoutCommit: checkout, sourceClean: true, initialGuard, base, database: dbName, selectors: ui,
  startedAt: Date.now(), collectorSha256: sha(await readFile(new URL(import.meta.url))),
  physicalPhone: false, touchEmulation: true, privateContexts: true, clockOverrides: false, speed: 1, audioRecorded: false,
  method: 'A simplified exploration. Existing ordinary reducers produce fixtures and audited ownership; native wall clock after seeding. No personal profile, injected resources/condition, fabricated timer/reward, poster crop, or assembled video.',
  fixtureModules: {}, cases: [], screenshots: [], materials: [], videos: [], errors: []};
for (const module of ['firstplanet-fixtures/firstplanet_fixtures.js', 'feedback-fixtures/feedback_fixtures.js', 'renewal-fixtures/renewal_fixtures.js', 'physical-fixtures/physical_review_fixtures.js'])
  report.fixtureModules[module] = sha(await readFile(`releases/${module}`));

async function archive(page) {
  return page.evaluate(name => new Promise((resolve, reject) => {
    const r = indexedDB.open(name, 1);r.onerror = () => reject(r.error);r.onsuccess = () => {
      const db = r.result, get = db.transaction('archive', 'readonly').objectStore('archive').get('current');
      get.onsuccess = () => {db.close();resolve(get.result);};get.onerror = () => {db.close();reject(get.error);};};
  }), dbName);
}
function condition(state, id) {return id === 'receipt' ? state.receipt.condition : state.curios[id]?.condition;}
function action(state, id) {
  const a = id === 'receipt' ? state.receipt.activeAction : state.curios[id]?.action;
  return a ? {kind: a.kind, key: id === 'receipt' ? a.id : `${id}/${a.kind}/${a.startedAt}/${a.endsAt}`,
    startedAt: id === 'receipt' ? a.startedAtSeconds * 1000 : a.startedAt,
    endsAt: id === 'receipt' ? (a.startedAtSeconds + a.durationSeconds) * 1000 : a.endsAt} : null;
}
function rights(state) {return {collection: state.game.collection, planets: state.game.planets, upgrades: state.game.upgrades, growth: state.game.growth,
  projects: state.projects, abilities: state.progression.abilities, seed: state.journey?.seed};}
function facts(state) {return {specimenId: state.receipt.specimenId, evidenceIds: state.receipt.evidenceIds,
  verifiedEvidenceIds: state.receipt.verifiedEvidenceIds, observations: state.receipt.observations, transactions: state.receipt.transactions};}
function ledger(before, after) {
  const grossDiff = after.game.station.grossIncome - before.game.station.grossIncome, maintenanceDiff = after.game.station.repairSpent - before.game.station.repairSpent;
  return {balanceBefore: before.game.resources, balanceAfter: after.game.resources, grossDiff, maintenanceDiff,
    charged: before.game.resources + grossDiff - maintenanceDiff - after.game.resources};
}
function stateSummary(state, id) {return {savedAt: state.game.lastAt, worldMs: state.game.world.elapsedMs, balance: state.game.resources,
  grossIncome: state.game.station.grossIncome, maintenancePaid: state.game.station.repairSpent, rights: rights(state), receiptFacts: facts(state),
  conditions: Object.fromEntries(ids.map(key => [key, condition(state, key)])), ...(id ? {condition: condition(state, id), action: action(state, id)} : {})};}
function naturalReadOnly(before, after) {
  const automatic = advanceFusion(before, after.game.lastAt), actual = ledger(before, after), expected = ledger(before, automatic);
  check(actual.charged === 0 && expected.charged === 0 && equal(actual, expected)
    && equal(rights(after), rights(automatic)), 'Read-only view differs from exact ordinary model money/ownership advancement');
  return {method: 'Unmodified advanceFusion(before, actual after.game.lastAt), no input; exact ledger and rights comparison',
    startedAt: before.game.lastAt, completedAt: after.game.lastAt, expectedRights: rights(automatic), actualRights: rights(after),
    expectedLedger: expected, actualLedger: actual, addedCollection: after.game.collection.filter(id => !before.game.collection.includes(id)),
    expectedAddedCollection: automatic.game.collection.filter(id => !before.game.collection.includes(id)), equal: true};
}
const earned = stage => firstPlanetFixture(Date.now(), 0, stage, {receiptAbility: 0, tapeAbility: 0});

async function open(browser, {name, generated, engine = 'chromium', width = 390, height = 844, desktop = false, video = false}) {
  const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: 1, hasTouch: !desktop, isMobile: !desktop,
    ...(video ? {recordVideo: {dir: `${output}/raw`, size: {width, height}}} : {})});
  try {
    const seed = await context.newPage();await seed.route('**/*.js', r => r.abort());await seed.goto(base, {waitUntil: 'domcontentloaded'});
    await seed.evaluate(({name, save}) => new Promise((resolve, reject) => {
      const r = indexedDB.open(name, 1);r.onupgradeneeded = () => r.result.createObjectStore('archive');r.onerror = () => reject(r.error);
      r.onsuccess = () => {const db = r.result, tx = db.transaction('archive', 'readwrite');tx.objectStore('archive').put(save, 'current');
        tx.oncomplete = () => {db.close();localStorage.setItem('loststar.ui.firstplanet.v037.intro', String(save.journey.seed));resolve();};tx.onerror = () => reject(tx.error);};
    }), {name: dbName, save: generated.state});
    const unused = seed.video();await seed.close();if (unused) await unlink(await unused.path());
    const createdBefore = Date.now(), page = await context.newPage(), createdAfter = Date.now(), errors = [], loadedScripts = [], pending = [];
    page.on('pageerror', e => errors.push(e.stack ?? e.message));
    page.on('response', response => {
      const resource = new URL(response.url());if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${resource.pathname}`);
      if (response.request().resourceType() !== 'script' && !resource.pathname.endsWith('.js')) return;
      pending.push((async () => {
        check(resource.origin === url.origin && resource.pathname.startsWith(servedRoot.pathname), 'Client script is outside immutable package');
        const member = entryRoot + decodeURIComponent(resource.pathname.slice(servedRoot.pathname.length)), raw = await response.body();
        check(zip.has(member) && sha(raw) === sha(zip.get(member)), `Actually loaded JS differs: ${member}`);
        loadedScripts.push({member, sha256: sha(raw), bytes: raw.length});
      })().catch(e => errors.push(e.message)));
    });
    const response = await page.goto(base);check(response && sha(await response.body()) === entryHash, 'Actually served HTML differs from ZIP');
    await page.locator(ui.world).waitFor();await page.waitForFunction(() => !!window.__FUSION__?.materialSnapshot);
    const build = await page.locator('.fu-build').innerText();check(build.includes(version) && build.includes(meta.sourceCommit.slice(0, 7)) && !build.includes('dirty'), `Wrong actual build: ${build}`);
    check(await page.evaluate(() => window.__FUSION__.databaseName) === dbName, 'Wrong current-campaign database');
    const session = {name, context, page, engine, width, height, desktop, createdBefore, createdAfter, build, generated,
      errors, loadedScripts, pending, initial: await archive(page), closed: false};
    return session;
  } catch (e) {await context.close();throw e;}
}
async function click(session, selector) {const element = session.page.locator(selector);await element.waitFor({state: 'visible'});await (session.desktop ? element.click() : element.tap());}
async function tab(session, name) {await click(session, `${ui.nav} [data-tab="${name}"]`);}
async function close(session) {
  if (!session || session.closed) return;
  await Promise.all(session.pending);check(session.loadedScripts.length > 0, 'No client JS was checked against ZIP');
  session.closed = true;const video = session.page.video();await session.context.close();if (video) session.raw = await video.path();
  report.errors.push(...session.errors.map(e => `${session.name}: ${e}`));
}
async function film(session, entry) {
  const lead = Math.max(0, (entry.reviewStartedAt - session.createdAfter) / 1000), seconds = (entry.reviewEndedAt - entry.reviewStartedAt) / 1000;
  const file = `videos/${session.name}.mp4`;
  execFileSync('ffmpeg', ['-y', '-i', session.raw, '-vf', `trim=start=${lead}:duration=${seconds},setpts=PTS-STARTPTS`, '-an', '-c:v', 'libx264',
    '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${output}/${file}`], {stdio: 'ignore'});
  const raw = await readFile(`${output}/${file}`), native = await readFile(session.raw);
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'quiet', '-show_format', '-show_streams', '-of', 'json', `${output}/${file}`], {encoding: 'utf8'}));
  const durationSeconds = Number(probe.format?.duration), encoded = probe.streams?.filter(stream => stream.codec_type === 'video');
  check(Number.isFinite(durationSeconds) && durationSeconds > 0 && encoded?.length === 1
    && !probe.streams.some(stream => stream.codec_type === 'audio'), 'Encoded native film duration/video/audio streams are invalid');
  const video = {file, kind: entry.kind, id: entry.id, durationSeconds, reviewElapsedSeconds: seconds, speed: 1, sha256: sha(raw), bytes: raw.length, probe,
    sourceCommit: meta.sourceCommit, zipSha256: meta.sha256, audioRecorded: false,
    raw: {file: `raw/${session.raw.split('/').at(-1)}`, bytes: native.length, sha256: sha(native)},
    alignment: {createdBefore: session.createdBefore, createdAfter: session.createdAfter, reviewStartedAt: entry.reviewStartedAt, reviewEndedAt: entry.reviewEndedAt, leadInSeconds: lead},
    source: 'Native 1x viewport WebM, one MP4 transcode; only loading/end trim. No spliced frames or accelerated action time.'};
  report.videos.push(video);entry.video = video;return video;
}
async function shot(session, name, kind = 'actual-page') {
  const file = `screens/${name}.png`, at = Date.now();await session.page.screenshot({path: `${output}/${file}`, scale: 'css'});
  const layout = await session.page.evaluate(() => {
    const rect = selector => {const element = document.querySelector(selector);if (!element?.getClientRects().length) return null;const r = element.getBoundingClientRect();return {x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom};};
    return {viewport: {width: innerWidth, height: innerHeight}, noOverflow: document.documentElement.scrollWidth <= innerWidth,
      world: rect('#fusion-world'), flow: rect('#fusion-field-drawer:not([hidden])'), controls: rect('.fu-explore-controls'),
      treatment: rect('#fusion-drawer[open][data-mode="treatment"]'), navigation: rect('.fu-nav')};
  });
  check(layout.noOverflow, `${name}: horizontal overflow`);
  if (layout.treatment) check(Math.abs(layout.treatment.y) <= 1 && Math.abs(layout.treatment.height - session.height) <= 1, `${name}: treatment is not full screen`);
  const raw = await readFile(`${output}/${file}`), item = {name, file, kind, engine: session.engine, width: session.width, height: session.height,
    at, build: session.build, sha256: sha(raw), bytes: raw.length, sourceCommit: meta.sourceCommit, zipSha256: meta.sha256, layout,
    source: 'Unmodified native CSS-pixel production-page screenshot; desktop emulation, not physical phone'};
  report.screenshots.push(item);return item;
}
async function assertHome(session) {
  await tab(session, 'explore');await session.page.locator(ui.assist).waitFor({state: 'visible'});
  check(await session.page.locator(ui.flowEntry).count() === 1, 'Exploration needs one unified event entry');
  check(await session.page.locator(ui.objective).isVisible() && await session.page.locator(ui.objectiveProgress).count() === 1, 'Actual single objective/progress missing');
  for (const selector of ui.management) check(!await session.page.locator(selector).isVisible(), `${selector} still appears on the exploration home`);
  return {dedicatedAssist: true, singleFlowEntry: true, objectiveVisible: true, secondaryManagementHidden: true,
    objective: await session.page.locator(ui.objective).innerText(), period: await session.page.locator(ui.world).getAttribute('data-period')};
}
async function flow(session, name) {
  const before = await archive(session.page), entryLabel = await session.page.locator(ui.flowEntry).innerText();
  await click(session, ui.flowEntry);await session.page.locator(`${ui.flow}:not([hidden])`).waitFor();
  await session.page.locator(ui.flowContent).waitFor();
  const opened = await shot(session, `${name}-flow`, 'unified-flow'), content = await session.page.locator(ui.flowContent).innerText();
  const projection = await session.page.locator(ui.flow).evaluate(root => {
    const summary = root.querySelector('#fusion-field-summary'), timeline = root.querySelector('#fusion-flow-timeline');
    const steps = [...timeline.querySelectorAll('[data-flow-step]')].map(step => ({id: step.dataset.flowStep,
      label: step.textContent.trim(), current: step.getAttribute('aria-current') === 'step', reached: step.dataset.reached === 'true'}));
    const paper = root.querySelector('#fusion-paper-route'), morning = root.querySelector('.fu-morning-note');
    return {summary: summary?.textContent.trim() ?? '', summaryVisible: Boolean(summary?.getClientRects().length),
      period: timeline.dataset.period, steps, paperRoute: {visible: Boolean(paper?.getClientRects().length),
        open: Boolean(paper?.open), text: paper?.getClientRects().length ? paper.innerText.slice(0, 2000) : ''},
      previousNight: morning ? {number: Number(morning.dataset.nightNumber), text: morning.innerText.trim(),
        visible: Boolean(morning.getClientRects().length)} : null};
  });
  check(projection.summaryVisible && projection.summary && equal(projection.steps.map(step => step.id), ['day', 'dusk', 'night', 'dawn'])
    && projection.steps.every(step => step.label) && projection.steps.filter(step => step.current).length === 1
    && projection.steps.find(step => step.current).id === projection.period, 'Unified exploration summary/current timeline is missing or inconsistent');
  const replay = session.page.locator(ui.flowReplay), replayAvailable = await replay.count() > 0 && await replay.isVisible() && await replay.isEnabled();
  await click(session, ui.flowClose);await session.page.locator(ui.flow).waitFor({state: 'hidden'});
  check(await session.page.locator(ui.flowEntry).getAttribute('aria-expanded') === 'false', 'Unified event toggle did not close');
  const after = await archive(session.page), payment = ledger(before, after);
  const naturalAdvance = naturalReadOnly(before, after);
  return {entryLabel, content: content.slice(0, 2000), ...projection, file: opened.file, replayAvailable, ledger: payment, naturalAdvance, closed: true};
}
async function treatmentPage(session, id) {
  await tab(session, 'collection');
  const catalog = session.page.locator(ui.collectionIndex);
  if (await catalog.count() && await catalog.getAttribute('open') === null) await click(session, `${ui.collectionIndex} > summary`);
  await click(session, `${ui.list} [data-detail="${id}"]`);
  await session.page.locator(`${ui.drawer}[open][data-mode="treatment"]`).waitFor();await session.page.locator(`${focus(id)}[data-ready="true"]`).waitFor();
  await session.page.locator('.fu-treatment-stages img').evaluateAll(async images => {
    if (images.length !== 3) throw Error('Exactly three complete previews required');await Promise.all(images.map(image => image.decode()));
    if (images.some(image => image.naturalWidth !== 384 || image.naturalHeight !== 384)) throw Error('Preview is not the complete 384px state');
  });
}
async function material(session, id, exportName) {
  const result = await session.page.evaluate(async id => {
    const name = 'loststar.fusion.firstplanet.v037';
    const read = () => new Promise((resolve, reject) => {const r = indexedDB.open(name, 1);r.onerror = () => reject(r.error);r.onsuccess = () => {
      const db = r.result, get = db.transaction('archive').objectStore('archive').get('current');get.onsuccess = () => {db.close();resolve(get.result);};get.onerror = () => reject(get.error);};});
    const before = await read(), state = id === 'receipt' ? before.receipt.condition : before.curios[id].condition;
    const dataUrl = window.__FUSION__.materialSnapshot(id), image = new Image();image.src = dataUrl;await image.decode();
    const preview = document.querySelector(`.fu-treatment-stages [data-condition="${state}"] img`);
    const pixels = source => {const c = document.createElement('canvas');c.width = c.height = 384;const p = c.getContext('2d');p.drawImage(source, 0, 0);return p.getImageData(0, 0, 384, 384).data;};
    const actual = pixels(image), expected = pixels(preview);let different = 0;
    for (let i = 0; i < actual.length; i++) if (actual[i] !== expected[i]) different++;
    const hash = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(b => b.toString(16).padStart(2, '0')).join('');
    const d = document.querySelector(id === 'receipt' ? '#fusion-paper-focus' : '#fusion-exhibit-focus').dataset, after = await read();
    return {at: Date.now(), condition: state, afterCondition: id === 'receipt' ? after.receipt.condition : after.curios[id].condition,
      width: image.naturalWidth, height: image.naturalHeight, rgbaSha256: await hash(actual), expectedRgbaSha256: await hash(expected), differingBytes: different,
      renderer: {condition: d.condition, materialStage: d.materialStage, stateImage: d.stateImage, stateRenderer: d.stateRenderer,
        frame: d.frame, sourceMap: d.curioStates ? JSON.parse(d.curioStates) : null},
      selected: document.querySelector('.fu-treatment-stages [aria-current="step"]')?.getAttribute('data-condition'), dataUrl};
  }, id);
  check(result.width === 384 && result.height === 384, `${id}: non-complete material dimensions`);
  if (exportName) {
    check(result.condition === result.afterCondition && result.differingBytes === 0, `${id}: stable material differs from the decoded complete image`);
    const file = `materials/${exportName}.png`, raw = Buffer.from(result.dataUrl.split(',')[1], 'base64');await writeFile(`${output}/${file}`, raw, {flag: 'wx'});
    const {dataUrl: _, ...observation} = result;
    report.materials.push({id, stage: result.condition, file, sha256: sha(raw), bytes: raw.length, engine: session.engine,
      viewportWidth: session.width, sourceCommit: meta.sourceCommit, zipSha256: meta.sha256, ...observation});
  }
  delete result.dataUrl;return result;
}
async function readOnlyPreview(session, id, target, expected) {
  const before = await archive(session.page), actual = await material(session, id);
  await click(session, `[data-image-preview-condition="${target}"]`);await session.page.locator('#fusion-state-preview:not([hidden])').waitFor();
  await session.page.locator('#fusion-state-preview-image').evaluate(image => image.decode());
  const previewSource = await session.page.evaluate(target => {
    const image = document.querySelector('#fusion-state-preview-image'), thumbnail = document.querySelector(`.fu-treatment-stages [data-condition="${target}"] img`);
    return {path: new URL(image.currentSrc || image.src).pathname, thumbnailPath: new URL(thumbnail.currentSrc || thumbnail.src).pathname,
      width: image.naturalWidth, height: image.naturalHeight};
  }, target);
  check(previewSource.path === previewSource.thumbnailPath && previewSource.width === 384 && previewSource.height === 384, 'Enlarged read-only preview does not use the matching complete image');
  const screenshot = await shot(session, `${session.name}-preview-${target}`, 'read-only-complete-image-preview');
  const controlsHidden = await session.page.evaluate(() => [...document.querySelectorAll('.fu-detail-actions,#fusion-exhibit-interaction,.fu-ability-panel')].every(element => !element.getClientRects().length));
  check(controlsHidden, 'Read-only preview exposes paid/free action controls');
  await click(session, '#fusion-state-preview-close');await session.page.locator('#fusion-state-preview').waitFor({state: 'hidden'});
  const after = await archive(session.page), exported = await material(session, id), payment = ledger(before, after);
  const naturalAdvance = naturalReadOnly(before, after);
  check(condition(after, id) === expected && payment.charged === 0 && equal(facts(before), facts(after))
    && exported.rgbaSha256 === actual.rgbaSha256, 'Preview granted, removed or charged an actual state/right');
  return {target, actualCondition: expected, file: screenshot.file, previewSource, controlsHidden, isolated: true, ledger: payment, naturalAdvance};
}

async function screens() {
  for (const [engine, width, height, desktop] of [['chromium', 360, 800, false], ['chromium', 390, 844, false], ['webkit', 390, 844, false], ['chromium', 1440, 1000, true]]) {
    const browser = await ({chromium, webkit}[engine]).launch();let s;
    try {
      const generated = earned('stabilized');s = await open(browser, {name: `${engine}-${width}-pages`, generated, engine, width, height, desktop});
      const before = await archive(s.page), entry = {name: s.name, kind: 'simplified-pages', engine, width, height, fixtureAudit: generated.audit, routes: []};report.cases.push(entry);
      entry.homeContract = await assertHome(s);entry.homeFile = (await shot(s, `${s.name}-home`, 'home')).file;entry.flow = await flow(s, s.name);
      await tab(s, 'collection');await s.page.locator('#museum-canvas[data-ready="true"]').waitFor();entry.collectionFile = (await shot(s, `${s.name}-collection`, 'collection')).file;
      entry.completedWorkbenches=[];
      for(const id of ids){
        await treatmentPage(s,id);
        const observation=await s.page.evaluate(selector=>{const d=document.querySelector(selector).dataset;return {condition:d.condition,selected:document.querySelector('.fu-treatment-stages [aria-current="step"]')?.getAttribute('data-condition'),stateRenderer:d.stateRenderer,stateImage:d.stateImage};},focus(id));
        check(observation.condition==='stabilized'&&observation.selected==='stabilized'&&observation.stateRenderer==='whole-image-v043','Actual tour workbench is not its earned complete C state');
        entry.completedWorkbenches.push({id,observation,file:(await shot(s,`${s.name}-${id}-completed-workbench`,'tour-completed-workbench')).file});
        await click(s,ui.backToCollection);check(await s.page.locator('#fusion-collection').isVisible(),'Completed workbench did not return to collection');
      }
      await tab(s, 'base');entry.baseFile = (await shot(s, `${s.name}-base`, 'base')).file;
      if (await s.page.locator(ui.baseMore).count() && await s.page.locator(ui.baseMore).getAttribute('open') === null) await click(s, `${ui.baseMore} > summary`);
      const management = [...ui.management, ui.devices];
      for (const selector of management) {
        await click(s, selector);await s.page.locator(`${ui.drawer}[open]`).waitFor();
        entry.routes.push({from: 'base', selector, title: await s.page.locator('#fusion-drawer-title').innerText(), file: (await shot(s, `${s.name}-management-${entry.routes.length}`, 'base-management')).file});
        await click(s, ui.close);
      }
      const routes = await s.page.locator(ui.facilities).evaluateAll(buttons => [...new Set(buttons.filter(button => !button.disabled && button.getClientRects().length).map(button => button.dataset.drawer))]);
      for (const route of routes.filter(route => route !== 'upgrades')) {
        const selector = `${ui.base} [data-drawer="${route}"]`;await click(s, selector);await s.page.locator(`${ui.drawer}[open]`).waitFor();
        entry.routes.push({from: 'base', selector, title: await s.page.locator('#fusion-drawer-title').innerText(), file: (await shot(s, `${s.name}-facility-${route}`, 'necessary-facility')).file});await click(s, ui.close);
      }
      const after = await archive(s.page);entry.facilityRoutesDiscovered = routes;entry.before = stateSummary(before);entry.after = stateSummary(after);
      entry.naturalAdvance = naturalReadOnly(before, after);
      entry.complete = true;entry.errors = s.errors;
    } finally {await close(s);await browser.close();}
  }
  const browser = await chromium.launch();
  try {
    for (const id of ids) for (const stage of stages) {
      let s;try {
        const generated = earned(stage), name = `chromium-390-${id}-${stage}`;s = await open(browser, {name, generated});await treatmentPage(s, id);
        const before = await archive(s.page), observation = await material(s, id, name), page = await shot(s, name, 'curio-state');
        const workbenchUi = await s.page.evaluate(selector => {
          const primary = document.querySelector(selector), d = document.querySelector('#fusion-drawer-body');
          return {paidPrimaryPresent: Boolean(primary), paidPrimaryVisible: Boolean(primary?.getClientRects().length),
            representativeButtons: d.querySelectorAll('#fusion-try').length, researchButtons: d.querySelectorAll('#fusion-ability-upgrade,[data-base-ability]').length,
            backToCollectionPresent: Boolean(d.querySelector('#fusion-back-to-collection'))};
        }, primary(id));
        check(observation.condition === stage && observation.selected === stage, 'Actual workbench does not follow saved stage');
        if (stage === 'stabilized') check(!workbenchUi.paidPrimaryVisible && workbenchUi.representativeButtons === 1
          && workbenchUi.researchButtons === 0 && workbenchUi.backToCollectionPresent, 'Completed workbench still exposes paid/research clutter or lacks one representative/return');
        const previews = [];
        for (const target of stage === 'found' ? ['stabilized'] : stage === 'stabilized' ? ['found', 'clean'] : []) previews.push(await readOnlyPreview(s, id, target, stage));
        const after = await archive(s.page), naturalAdvance = naturalReadOnly(before, after);check(equal(facts(before), facts(after)), 'Read-only state capture altered signed facts');
        report.cases.push({name, kind: 'curio-state', id, stage, fixtureAudit: generated.audit, observation, workbenchUi, file: page.file, previews, naturalAdvance, complete: true, errors: s.errors});
      } finally {await close(s);}
    }
    let s;try {
      const generated = renewalFixture(Date.now(), 'return');s = await open(browser, {name: 'chromium-390-real-return', generated});
      const before = await archive(s.page);check(before.game.pendingReturn, 'Return fixture has no actual offline cargo');
      await assertHome(s);await click(s, ui.flowEntry);await s.page.locator(ui.returnClaim).waitFor({state: 'visible'});
      check(!await s.page.locator(`${ui.drawer}[open]`).count(), 'Offline return opened an obsolete independent return drawer');
      const file = (await shot(s, s.name, 'return-in-unified-flow')).file, after = await archive(s.page);
      const naturalAdvance = naturalReadOnly(before, after);
      report.cases.push({name: s.name, kind: 'actual-return', fixtureAudit: generated.audit, pendingReturn: before.game.pendingReturn,
        claimSelector: ui.returnClaim, sameUnifiedFlow: true, naturalAdvance, file, complete: true, errors: s.errors});
    } finally {await close(s);}
    s = undefined;try {
      const generated = renewalPagesFixture(Date.now());s = await open(browser, {name: 'chromium-390-owned-facilities', generated});await assertHome(s);
      const before = await archive(s.page);
      await click(s, ui.flowEntry);await s.page.locator(ui.flowContent).waitFor();
      const replay = s.page.locator(ui.flowReplay), available = await replay.count() > 0 && await replay.isVisible() && await replay.isEnabled();
      check(available, 'Ordinarily purchased archive has no same-world replay entry');
      await click(s, ui.flowReplay);await s.page.waitForTimeout(1500);
      check(await s.page.locator('#fusion-world canvas').count() === 1 && !await s.page.locator(`${ui.drawer}[open]`).count()
        && await s.page.locator(ui.replayRegion).isVisible(), 'Replay left the main globe region for an independent night page');
      report.cases.push({name: s.name, kind: 'owned-same-world-replay', fixtureAudit: generated.audit, file: (await shot(s, `${s.name}-replay`, 'same-world-replay')).file,
        projects: (await archive(s.page)).projects, naturalAdvance: naturalReadOnly(before, await archive(s.page)), complete: true, errors: s.errors});
    } finally {await close(s);}
  } finally {await browser.close();}
  check(report.materials.length === 18 && new Set(report.materials.map(item => `${item.id}/${item.stage}`)).size === 18, 'Six complete three-state PNGs are incomplete');
  check(new Set(report.materials.map(item => item.rgbaSha256)).size === 18, 'The 18 state names do not represent 18 independent complete images');
}

async function live(session, startedAt) {
  const state = await archive(session.page), visual = await session.page.locator(ui.world).evaluate(canvas => {
    const d = canvas.dataset;return {period: d.period, phase: d.fusionPhase, anomaly: d.fusionAnomaly, ship: d.ship,
      tier: Number(d.robotAssistVisualTier), intensity: Number(d.robotAssistVisualIntensity), action: d.robotAnimationAction ?? d.action,
      workSeconds: Number(d.robotWorkSeconds), frame: d.frame, robotReceived: d.robotReceived,
      fog: window.__FUSION__.surfaceMetrics().sites.map(site=>({id:site.id,progress:site.progress,revealedAt:site.revealedAt,visualReveal:site.visualReveal}))};
  });
  return {at: Date.now(), elapsedMs: Date.now() - startedAt, savedAt: state.game.lastAt, worldMs: state.game.world.elapsedMs,
    balance: state.game.resources, grossIncome: state.game.station.grossIncome, maintenancePaid: state.game.station.repairSpent,
    integrity: state.game.station.integrity, lastNight: state.game.station.lastNight, cycles: state.game.cycles,
    assist: state.game.assist, discoveryAt: state.game.discoveryAt, visual};
}
async function night() {
  const browser = await chromium.launch();let s, entry;
  try {
    const generated = feedbackFixture('unrevealed', Date.now());s = await open(browser, {name: 'same-planet-natural-night-312s', generated, video: true});
    await assertHome(s);const before = await archive(s.page), start = Date.now();
    entry = {name: s.name, kind: 'same-planet-natural-night', reviewStartedAt: start, fixtureAudit: generated.audit,
      before: stateSummary(before), trace: [], phases: [], flows: [], paperShadowFile: null, complete: false};report.cases.push(entry);
    const phases = new Set();
    for (let tick = 0; tick <= 312; tick++) {
      await until(start + tick * 1000);const observed = await live(s, start);entry.trace.push(observed);
      const period = observed.visual.period;
      if (!phases.has(period)) {
        phases.add(period);entry.phases.push(period);await shot(s, `night-${period}-main`, 'natural-world-phase');
        entry.flows.push({period, ...await flow(s, `night-${period}`)});
      }
      if (!entry.paperShadowFile && observed.visual.anomaly === 'paper-shadow') entry.paperShadowFile = (await shot(s, 'night-paper-shadow-visible', 'actual-paper-shadow')).file;
      if (tick % 30 === 0) console.log(`V045 natural same-planet cycle ${tick}/312s ${period}`);
    }
    entry.morningFlow = await flow(s, 'morning-actual-results');
    const after = await archive(s.page);entry.after = stateSummary(after);entry.ledger = ledger(before, after);
    check(['day', 'dusk', 'night', 'dawn'].every(period => phases.has(period)) && entry.paperShadowFile && after.game.station.lastNight,
      'Natural same-globe phases, visible paper shadow or actual morning result missing');
    check(entry.morningFlow.content.trim() && entry.morningFlow.previousNight?.visible && entry.morningFlow.previousNight.text
      && entry.morningFlow.previousNight.number === after.game.world.lastReport?.number
      && entry.morningFlow.previousNight.number === after.game.station.lastNight.number,
      'Morning flow must show the actual completed night record, not an initial empty-state hint');
    entry.naturalAdvance = naturalReadOnly(before, after);
    entry.complete = true;entry.errors = s.errors;
  } finally {if (entry) entry.reviewEndedAt = Date.now();await close(s);if (s?.raw && entry) {await film(s, entry);if(entry.complete)await worldFrames(s,entry);}await browser.close();}
}

async function paid(session, id, kind) {
  await session.page.waitForFunction(({selector, kind}) => {const button = document.querySelector(selector);return button && !button.disabled && button.dataset.kind === kind;}, {selector: primary(id), kind});
  const label = await session.page.locator(primary(id)).innerText(), quoted = Number(label.match(/\d+/g)?.at(-1));
  check(quoted === prices[id][kind], 'Existing actual UI quote changed');
  const before = await archive(session.page), initial = await material(session, id), target = kind === 'clean' ? 'clean' : 'stabilized';
  const entry = {kind, label, quoted, before: stateSummary(before, id), clickedAt: Date.now(), observations: []};
  await click(session, primary(id));let actual, midpoint, finished, changedAt;
  const deadline = Date.now() + 20000;let next = Date.now();
  while (Date.now() < deadline) {
    await until(next);next = Date.now() + 100;
    const state = await archive(session.page), a = action(state, id), image = await material(session, id), at = Date.now();
    entry.observations.push({at, savedAt: state.game.lastAt, condition: condition(state, id), action: a, material: image});
    if ([condition(state, id), image.condition, image.afterCondition].includes(target)) changedAt ??= at;
    if (image.condition !== image.afterCondition || condition(state, id) !== image.condition) continue;
    if (a) {
      actual ??= a;check(a.key === actual.key && a.kind === kind && condition(state, id) === initial.condition, 'Unexpected paid action replaced the actual action');
      check(image.rgbaSha256 === initial.rgbaSha256 && image.differingBytes === 0, 'Image changed before actual durable condition');
      if (!midpoint && at >= a.startedAt + (a.endsAt - a.startedAt) * .5) midpoint = (await shot(session, `${session.name}-${kind}-working`, 'actual-processing')).file;
    } else if (condition(state, id) === target) {
      changedAt ??= at;
      const correct = image.rgbaSha256 === image.expectedRgbaSha256 && image.condition === target && image.selected === target && image.renderer.condition === target;
      check(at - changedAt <= 500, 'New durable state did not reach renderer within 500ms');
      if (!correct) {check(image.rgbaSha256 === initial.rgbaSha256 || image.rgbaSha256 === image.expectedRgbaSha256, 'Condition handoff contains a mixed/partial image');continue;}
      finished = state;break;
    }
  }
  check(actual && midpoint && finished, 'Missing actual start, processing frame or real completion');
  entry.actualAction = actual;entry.processingFile = midpoint;entry.completedObservedAt = Date.now();entry.after = stateSummary(finished, id);
  entry.ledger = ledger(before, finished);check(entry.ledger.charged === quoted, 'Actual paid step did not reconcile to exactly one quote');
  entry.completeFile = (await shot(session, `${session.name}-${kind}-complete`, 'actual-condition-commit')).file;
  await until(Date.now() + 250);return entry;
}
async function free(session, id, replay, trialMs) {
  await session.page.locator('#fusion-try:not([disabled]):not([hidden])').waitFor();
  const before = await archive(session.page), clickedAt = Date.now(), entry = {replay, clickedAt, phases: []};await click(session, '#fusion-try');
  let actual, begin;
  for (let i = 0; i < 40; i++) {
    const state = await archive(session.page), data = await session.page.locator(focus(id)).evaluate(canvas => ({playing: canvas.dataset.experimentPlaying, started: Number(canvas.dataset.experimentStartedAt), now: performance.now(), origin: performance.timeOrigin}));
    const a = action(state, id);
    if (id === 'receipt' ? a?.kind === 'try' : data.playing === 'true') {actual = id === 'receipt' ? a : {startedAt: data.origin + data.started, endsAt: data.origin + data.started + trialMs};begin = state;break;}
    await until(Date.now() + 50);
  }
  check(actual && begin, 'Native representative free action did not actually start');entry.actualAction = actual;
  for (const progress of [.2, .5, .8]) {
    await until(actual.startedAt + (actual.endsAt - actual.startedAt) * progress);
    const image = await material(session, id);check(image.condition === 'stabilized' && image.differingBytes === 0, 'Free action changed persistent complete-image state');
    const data = await session.page.locator(focus(id)).evaluate(canvas => {const d = canvas.dataset;return {frame: d.frame, sourceMap: d.curioStates,
      mechanismPhase: d.mechanismPhase, bellTriggered: d.bellTriggered, performanceDate: d.performanceDate, experimentPlaying: d.experimentPlaying, restorationPhase: d.restorationPhase};});
    entry.phases.push({targetProgress: progress, at: Date.now(), data, file: (await shot(session, `${session.name}-free-${replay}-${Math.round(progress * 100)}`, 'representative-free-action')).file});
  }
  await until(actual.endsAt + 350);await session.page.locator('#fusion-try:not([disabled]):not([hidden])').waitFor();
  const after = await archive(session.page), automatic = advanceFusion(before, after.game.lastAt);entry.ledger = ledger(before, after);
  entry.noRewardOrSpend = equal(after.game, automatic.game) && entry.ledger.charged === 0;
  check(entry.noRewardOrSpend && equal(rights(before), rights(after)) && equal(facts(before), facts(after)), 'Free replay altered ordinary income, money, facts or rights');
  entry.complete = true;return entry;
}
async function excavateReceipt(session){
  await session.page.waitForFunction(()=>{const button=document.querySelector('#fusion-paper-primary');return button&&!button.disabled&&button.dataset.kind==='excavate';});
  const before=await archive(session.page),initial=await material(session,'receipt');
  check(before.receipt.stage==='buried'&&before.receipt.condition==='found'&&!before.receipt.activeAction,'Receipt excavation requires an ordinary buried A specimen');
  const entry={quoted:0,before:{...stateSummary(before,'receipt'),stage:before.receipt.stage},beforeFile:(await shot(session,`${session.name}-buried`,'actual-buried-workbench')).file,clickedAt:Date.now(),observations:[]};
  await click(session,'#fusion-paper-primary');const deadline=Date.now()+15000;let actual,midpoint,changedAt,finished;
  while(Date.now()<deadline){
    const state=await archive(session.page),current=action(state,'receipt'),image=await material(session,'receipt');
    const renderer=await session.page.locator(focus('receipt')).evaluate(canvas=>({frame:Number(canvas.dataset.frame),phase:canvas.dataset.restorationPhase,excavation:Number(canvas.dataset.restorationExcavation),stateImage:canvas.dataset.stateImage}));
    const at=Date.now();entry.observations.push({at,savedAt:state.game.lastAt,stage:state.receipt.stage,action:current,material:image,renderer});
    check(state.receipt.condition==='found'&&image.condition==='found'&&image.afterCondition==='found'&&image.rgbaSha256===initial.rgbaSha256&&image.differingBytes===0,'Free excavation changed its complete persistent A image');
    if(current){actual??=current;check(current.kind==='excavate'&&current.key===actual.key&&state.receipt.stage==='buried','Receipt excavation action was replaced');
      if(!midpoint&&at>=actual.startedAt+(actual.endsAt-actual.startedAt)*.5)midpoint=(await shot(session,`${session.name}-excavating`,'actual-free-excavation')).file;
    }else if(state.receipt.stage==='displayed'){
      changedAt??=at;check(at-changedAt<=500,'Excavation commit did not reach renderer within 500ms');
      if(renderer.phase==='found'&&renderer.excavation===1){finished=state;break;}
    }
    await until(Date.now()+100);
  }
  check(actual&&midpoint&&finished&&Date.now()>=actual.endsAt,'Actual free excavation start/middle/completion missing');
  entry.actualAction=actual;entry.processingFile=midpoint;entry.completedObservedAt=Date.now();entry.after={...stateSummary(finished,'receipt'),stage:finished.receipt.stage};entry.ledger=ledger(before,finished);
  entry.naturalAdvance=naturalReadOnly(before,finished);check(equal(facts(before),facts(finished)),'Free excavation changed signed receipt facts or transactions');
  entry.factsPreserved=true;entry.completeFile=(await shot(session,`${session.name}-excavated`,'actual-free-excavation-complete')).file;entry.complete=true;return entry;
}
async function collection() {
  const model = await readFile('src/fusion/curio-mechanism-model.ts', 'utf8'), match = model.match(/export\s+const\s+mechanismTrialMs\s*=\s*([\d_]+)\s*;/);
  const trialMs = match ? Number(match[1].replaceAll('_', '')) : NaN;check(Number.isFinite(trialMs), 'Actual frozen free-interaction duration is unavailable');
  report.freeDuration = {trialMs, source: 'Frozen src/fusion/curio-mechanism-model.ts; receipt uses actual persisted try action'};
  const browser = await chromium.launch();
  try {for (const id of ids) {
    let s, entry;try {
      const generated = earned(id==='receipt'?'buried':'found');s = await open(browser, {name: `collection-${id}-natural-route`, generated, video: true});
      const before = await archive(s.page);entry = {name: s.name, kind: 'collection-real-route', id, fixtureAudit: generated.audit, before: stateSummary(before, id), steps: [], freeReplays: [], reviewStartedAt: Date.now(), complete: false};report.cases.push(entry);
      await tab(s, 'collection');entry.collectionBeforeFile = (await shot(s, `${s.name}-collection-before`, 'collection-before')).file;
      await treatmentPage(s, id);if(id==='receipt')entry.excavation=await excavateReceipt(s);entry.foundFile = (await shot(s, `${s.name}-found`, 'actual-found-workbench')).file;
      entry.steps.push(await paid(s, id, 'clean'));entry.steps.push(await paid(s, id, 'repair'));
      check(await s.page.locator('#fusion-exhibit-interaction #fusion-try').count() === 1, 'One clear representative exhibit action is required');
      for (let replay = 0; replay < 2; replay++) entry.freeReplays.push(await free(s, id, replay, trialMs));
      await click(s, ui.backToCollection);await s.page.locator('#museum-canvas[data-ready="true"]').waitFor();
      check(await s.page.locator('#fusion-collection').isVisible() && !await s.page.locator(`${ui.drawer}[open]`).count(), 'Representative action did not return to collection');
      entry.returnSelector = ui.backToCollection;entry.collectionAfterFile = (await shot(s, `${s.name}-collection-after`, 'collection-after')).file;
      const after = await archive(s.page);entry.after = stateSummary(after, id);entry.ledger = ledger(before, after);entry.quotedTotal = prices[id].clean + prices[id].repair;
      check(entry.ledger.charged === entry.quotedTotal && equal(rights(before), rights(after)) && condition(after, id) === 'stabilized', 'Complete collection route broke original price/rights/state');
      const {transactions: beforePaid, ...beforeFacts} = facts(before), {transactions: afterPaid, ...afterFacts} = facts(after);
      check(equal(beforeFacts, afterFacts), 'Collection action altered signed receipt facts');
      check(id === 'receipt' ? afterPaid.length - beforePaid.length === 2 : equal(beforePaid, afterPaid), 'Receipt payment transaction count differs');
      check(ids.every(key => key === id || condition(after, key) === condition(before, key)), 'Treating one item changed another physical state');
      entry.complete = true;entry.errors = s.errors;
    } finally {if (entry) entry.reviewEndedAt = Date.now();await close(s);if (entry && s?.raw) await film(s, entry);}
  }} finally {await browser.close();}
}
async function assist() {
  const browser = await chromium.launch();let s, entry;
  try {
    const generated = feedbackFixture('unrevealed', Date.now());s = await open(browser, {name: 'dedicated-assist-three-tiers-36s', generated, video: true});await assertHome(s);
    const before = await archive(s.page), start = Date.now(), schedule = [400, 750, 1100, 13100, 13450, 13800, 25800, 26150, 26500];
    entry = {name: s.name, kind: 'dedicated-real-assist', reviewStartedAt: start, fixtureAudit: generated.audit, before: stateSummary(before), trace: [], attempts: [], schedule, complete: false};report.cases.push(entry);
    await Promise.all([(async () => {
      for (let tick = 0; tick <= 360; tick++) {await until(start + tick * 100);entry.trace.push(await live(s, start));}
    })(), (async () => {for (const ms of schedule) {await until(start + ms);const at = Date.now();await click(s, ui.assist);entry.attempts.push({scheduledMs: ms, at, actualMs: at - start, target: ui.assist});}})()]);
    const after = await archive(s.page), work = after.game.assist, initial = before.game.assist;
    check(work && typeof work.actionSeq === 'number', 'No real assist ledger was produced by the dedicated button');
    entry.after = stateSummary(after);entry.ledger = ledger(before, after);entry.tiersObserved = [...new Set(entry.trace.map(item => item.visual.tier))].sort();
    const peak = entry.trace.find(item => item.visual.tier === 3);entry.decay = peak && entry.trace.find(item => item.elapsedMs > peak.elapsedMs + 3200 && item.visual.tier === 0);
    entry.arrivals = entry.trace.filter((item, index) => index > 0 && item.cycles > entry.trace[index - 1].cycles);
    entry.assistLedger = {initialAssistPresent: Boolean(initial), initialStateRule: 'Before the first accepted tap the real engine may have no optional assist object; those prior counters are zero',
      accepted: work.actionSeq - (initial?.actionSeq ?? 0), enqueuedMs: work.enqueuedWorkMs - (initial?.enqueuedWorkMs ?? 0),
      appliedMs: work.appliedWorkMs - (initial?.appliedWorkMs ?? 0), pendingMs: work.pendingWorkMs - (initial?.pendingWorkMs ?? 0)};
    check(equal(entry.tiersObserved, [0, 1, 2, 3]) && entry.decay && entry.arrivals.length >= 3, 'Actual button assist tiers/decay/arrivals missing');
    check(entry.assistLedger.accepted === schedule.length && entry.assistLedger.enqueuedMs === entry.assistLedger.accepted * 600
      && Math.abs(entry.assistLedger.enqueuedMs - entry.assistLedger.appliedMs - entry.assistLedger.pendingMs) < .01 && entry.ledger.charged === 0,
    'Real accepted work/reward ledger differs; no direct tap income is allowed');
    entry.finalFile = (await shot(s, `${s.name}-complete`, 'assist-complete')).file;entry.complete = true;entry.errors = s.errors;
  } finally {if (entry) entry.reviewEndedAt = Date.now();await close(s);if (entry && s?.raw) {await film(s, entry);if(entry.complete)await worldFrames(s,entry);}await browser.close();}
}

/** Extract only real encoded frames, keeping frame index/PTS/hash and the nearby live trace. */
async function worldFrames(session, entry) {
  const file=`${output}/${entry.video.file}`, frames=JSON.parse(execFileSync('ffprobe',['-v','quiet','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time','-of','json',file],{encoding:'utf8',maxBuffer:8*1024*1024})).frames;
  const predicates={
    'fog-unrevealed':row=>row.visual.fog.length===3&&row.visual.fog.every(site=>site.revealedAt===null),
    'fog-partial':row=>row.visual.fog.some(site=>site.revealedAt!==null)&&row.visual.fog.some(site=>site.revealedAt===null),
    'fog-revealed':row=>row.visual.fog.length===3&&row.visual.fog.every(site=>site.revealedAt!==null&&site.visualReveal>=.999),
    'ship-front':row=>row.visual.ship==='front','ship-back':row=>row.visual.ship==='back',
    'robot-scan':row=>row.visual.action==='scan','robot-return':row=>row.visual.action==='return'};
  entry.worldFrames=[];
  for(const [label,predicate] of Object.entries(predicates)){
    const observed=entry.trace.find(predicate);if(!observed)continue;
    const index=frames.findIndex(frame=>Number(frame.best_effort_timestamp_time)>=observed.elapsedMs/1000);check(index>=0,'Actual encoded frame is missing at trace time');
    const name=`${session.name}-${label}`,target=`screens/${name}.png`;
    execFileSync('ffmpeg',['-y','-i',file,'-vf',`select=eq(n\\,${index})`,'-fps_mode','passthrough','-frames:v','1',`${output}/${target}`],{stdio:'ignore'});
    const raw=await readFile(`${output}/${target}`),record={name,file:target,kind:'native-film-frame',label,engine:session.engine,width:session.width,height:session.height,
      sha256:sha(raw),bytes:raw.length,sourceCommit:meta.sourceCommit,zipSha256:meta.sha256,sourceVideo:entry.video.file,sourceVideoSha256:entry.video.sha256,
      frameIndex:index,ptsSeconds:Number(frames[index].best_effort_timestamp_time),traceAt:observed.at,traceElapsedMs:observed.elapsedMs,observation:observed.visual,
      source:'Actual native continuous film frame, no painting/scaling/interpolation. Trace alignment inherits the documented page-creation bracket; robot/building overlap requires visual review.'};
    report.screenshots.push(record);entry.worldFrames.push(record);
  }
}

async function museum() {
  const browser=await chromium.launch();
  try{for(const variant of ['all-0','all-3','mixed']){
    let s,entry;try{
      const generated=variant==='mixed'?physicalMuseumFixture(Date.now()):firstPlanetFixture(Date.now(),variant==='all-3'?3:0,'stabilized',{receiptAbility:0,tapeAbility:0});
      s=await open(browser,{name:`museum-${variant}-100s`,generated,video:true});await tab(s,'base');await s.page.locator('#museum-canvas[data-ready="true"]').waitFor();
      const before=await archive(s.page),start=Date.now();entry={name:s.name,kind:'museum-continuous',variant,reviewStartedAt:start,fixtureAudit:generated.audit,before:stateSummary(before),trace:[],complete:false};report.cases.push(entry);
      for(let tick=0;tick<=1000;tick++){
        await until(start+tick*100);const at=Date.now(),data=await s.page.locator('#museum-canvas').evaluate(canvas=>{const d=canvas.dataset;return {frame:Number(d.frame),spaceVersion:d.spaceVersion,
          target:d.robotTarget,phase:d.servicePhase,caseLevel:Number(d.caseLevel),bodyClearance:Number(d.bodyClearance),handReach:Number(d.handReach),
          doorLift:Number(d.doorLift),trayExtension:Number(d.trayExtension),contact:Number(d.contact),actorBounds:JSON.parse(d.actorBounds??'null'),
          itemBounds:JSON.parse(d.itemBounds??'null'),handContacts:JSON.parse(d.handContacts??'[]')};});entry.trace.push({at,elapsedMs:at-start,...data});
      }
      const sequence=['open','grip','lift-clear','inspect','place','release','close','return'];entry.completeVisits=[];
      for(const id of ids){let next=0;const observed=[];for(const row of entry.trace){if(row.target===id&&row.phase===sequence[next]){observed.push({phase:row.phase,elapsedMs:row.elapsedMs,frame:row.frame});next++;if(next===sequence.length)break;}}
        if(next===sequence.length)entry.completeVisits.push({id,sequence:observed});}
      entry.targets=[...new Set(entry.trace.filter(row=>row.phase==='inspect').map(row=>row.target))];
      entry.minBodyClearance=Math.min(...entry.trace.map(row=>row.bodyClearance));entry.maxHandReach=Math.max(...entry.trace.map(row=>row.handReach));
      check(entry.targets.length===6&&entry.completeVisits.length>=2&&entry.minBodyClearance>=6&&entry.maxHandReach<=85,'Actual museum film lacks complete physical visits/clearance/contact bounds');
      const after=await archive(s.page);entry.after=stateSummary(after);entry.naturalAdvance=naturalReadOnly(before,after);entry.complete=true;entry.errors=s.errors;
    }finally{if(entry)entry.reviewEndedAt=Date.now();await close(s);if(entry&&s?.raw){await film(s,entry);if(entry.complete)await museumFrames(s,entry);}}
  }}finally{await browser.close();}
}

async function museumFrames(session,entry){
  // Reuse the real frame-index extractor; these labels describe actual trace phases.
  const frames=JSON.parse(execFileSync('ffprobe',['-v','quiet','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time','-of','json',`${output}/${entry.video.file}`],{encoding:'utf8',maxBuffer:8*1024*1024})).frames;
  for(const visit of entry.completeVisits.slice(0,2))for(const phase of ['grip','inspect','place','return']){
    const observed=entry.trace.find(row=>row.target===visit.id&&row.phase===phase);if(!observed)continue;
    const time=observed.elapsedMs/1000,name=`${session.name}-${visit.id}-${phase}`,file=`screens/${name}.png`;
    const index=frames.findIndex(frame=>Number(frame.best_effort_timestamp_time)>=time);check(index>=0,'Museum actual frame missing');
    execFileSync('ffmpeg',['-y','-i',`${output}/${entry.video.file}`,'-vf',`select=eq(n\\,${index})`,'-fps_mode','passthrough','-frames:v','1',`${output}/${file}`],{stdio:'ignore'});
    const raw=await readFile(`${output}/${file}`);report.screenshots.push({name,file,kind:'native-film-frame',engine:session.engine,width:session.width,height:session.height,sha256:sha(raw),bytes:raw.length,
      sourceVideo:entry.video.file,sourceVideoSha256:entry.video.sha256,frameIndex:index,ptsSeconds:Number(frames[index].best_effort_timestamp_time),observation:observed,
      sourceCommit:meta.sourceCommit,zipSha256:meta.sha256,source:'Actual native museum film frame, no synthetic frames; trace alignment uses page-creation bracket.'});
  }
}

async function cases(){
  const browser=await chromium.launch();let s,entry;
  try{
    const generated=renewalFixture(Date.now(),'funded');s=await open(browser,{name:'case-0-to-3-natural-installation',generated,video:true});
    const initial=await archive(s.page);check((initial.game.growth['case-0']??0)===0,'Case installation requires actual earned level zero');
    entry={name:s.name,kind:'paid-case-installation',id:'case-0',fixtureAudit:generated.audit,reviewStartedAt:Date.now(),before:stateSummary(initial),upgrades:[],complete:false};report.cases.push(entry);
    await tab(s,'base');await click(s,`${ui.baseMore} > summary`);await click(s,'#fusion-base [data-drawer="build"]');
    for(let expected=0;expected<3;expected++){
      const summary=s.page.locator('#fusion-drawer-body summary').filter({hasText:/^展柜$/});if(!await summary.evaluate(node=>node.parentElement.open))await summary.tap();
      const button=s.page.locator('[data-growth="case-0"]');await button.waitFor({state:'visible'});const before=await archive(s.page),label=await button.innerText(),quoted=Number(label.match(/\d+/g)?.at(-1));
      check(quoted===[160,480,1100][expected]&&Number(await button.getAttribute('data-expected'))===expected,'Original case quote/level changed');
      await button.tap();await s.page.locator('#fusion-case-preview[data-ready="true"]').waitFor();const start=Date.now(),trace=[];
      for(let tick=0;tick<=25;tick++){await until(start+tick*100);trace.push(await s.page.locator('#fusion-case-preview').evaluate(canvas=>({at:Date.now(),frame:Number(canvas.dataset.frame),before:Number(canvas.dataset.before),after:Number(canvas.dataset.after),level:Number(canvas.dataset.level),installProgress:Number(canvas.dataset.installProgress)})));}
      const after=await archive(s.page),payment=ledger(before,after),automatic=advanceFusion(before,after.game.lastAt),natural=rights(automatic);natural.growth={...natural.growth,'case-0':expected+1};
      check(payment.charged===quoted&&after.game.growth['case-0']===expected+1&&equal(rights(after),natural)&&equal(facts(automatic),facts(after)),'Case purchase altered original price/other rights or naturally sourced facts');
      check(trace.some(row=>row.installProgress>0&&row.installProgress<1)&&trace.some(row=>row.installProgress>=.999)&&trace.every(row=>row.before===expected&&row.after===expected+1&&row.level===expected+1),'Actual installation phases/before-after mapping missing');
      const screenshot=await shot(s,`${s.name}-level-${expected+1}`,'actual-case-installation');entry.upgrades.push({expected,level:expected+1,label,quoted,before:stateSummary(before),after:stateSummary(after),ledger:payment,otherRightsStable:true,naturalExpectedFacts:facts(automatic),factsMatchNaturalAdvance:true,trace,file:screenshot.file});await click(s,'#fusion-return-build');
    }
    entry.after=stateSummary(await archive(s.page));entry.totalQuoted=entry.upgrades.reduce((sum,row)=>sum+row.quoted,0);entry.ledger=ledger(initial,await archive(s.page));
    check(entry.ledger.charged===entry.totalQuoted,'Full 0→3 ledger differs from three actual payments');entry.complete=true;entry.errors=s.errors;
  }finally{if(entry)entry.reviewEndedAt=Date.now();await close(s);if(entry&&s?.raw)await film(s,entry);await browser.close();}
}

try {
  if (mode === 'screens') await screens();else if (mode === 'night') await night();else if (mode === 'collection') await collection();else if(mode==='assist')await assist();else if(mode==='museum')await museum();else await cases();
  check(report.cases.length > 0 && report.cases.every(entry => entry.complete), 'Required capture mode is incomplete');
} catch (error) {report.errors.push(error.stack ?? String(error));console.error(error.message);}
finally {
  try {report.finalGuard = await guard();check(equal(initialGuard.originalTrees, report.finalGuard.originalTrees)
    && initialGuard.runtimeTreeHash === report.finalGuard.runtimeTreeHash, 'Runtime tree changed during capture');}
  catch (error) {report.sourceClean = false;report.errors.push(error.stack ?? String(error));}
  report.endedAt = Date.now();report.complete = report.errors.length === 0;
  await writeFile(reportFile, JSON.stringify(report, null, 2) + '\n', {flag: 'wx'});
  console.log(JSON.stringify({mode, sourceCommit: meta.sourceCommit, zipSha256: meta.sha256, cases: report.cases.length,
    screenshots: report.screenshots.length, completePngs: report.materials.length, naturalVideos: report.videos.length, errors: report.errors.length, reportFile}));
  if (!report.complete) process.exitCode = 1;
}
