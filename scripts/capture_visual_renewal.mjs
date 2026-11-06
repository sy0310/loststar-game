import {chromium, webkit} from '@playwright/test';
import {mkdir, readFile, writeFile, unlink} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {firstPlanetFixture} from '../releases/firstplanet-fixtures/firstplanet_fixtures.js';
import {renewalFixture,renewalPagesFixture} from '../releases/renewal-fixtures/renewal_fixtures.js';
import {feedbackFixture} from '../releases/feedback-fixtures/feedback_fixtures.js';

const mode = process.argv[2] ?? 'screens';
if (!['screens', 'assist', 'treatment', 'pages', 'life', 'cases', 'excavation', 'reading'].includes(mode)) throw new Error('Unknown renewal capture mode');
// A review revision gets its own evidence directory. Never relabel or overwrite
// a previous package's recordings with the current checkout's source SHA.
const output = resolve(process.env.RENEWAL_OUTPUT ?? 'artifacts/visual-renewal');
const base = process.env.RENEWAL_URL ?? 'http://127.0.0.1:4226/';
const database = 'loststar.fusion.firstplanet.v037';
const worldSelector = '#fusion-world canvas[data-ready="true"]';
const metadata = JSON.parse(await readFile('releases/taptap/package-info-fusion.json', 'utf8'));
const expectedVersion = process.env.RENEWAL_VERSION ?? '0.4.0';
if (metadata.version !== expectedVersion) throw new Error(`Build/package V${expectedVersion} before capture; metadata is ${metadata.version}`);
const evidenceCheckoutCommit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
const sourceCommit = metadata.sourceCommit;
const runtimePaths = ['src', 'assets/runtime', 'package.json', 'package-lock.json', 'vite.config.ts', 'vite.fusion.config.ts'];
const dirty = execFileSync('git', ['status', '--porcelain', '--', ...runtimePaths], {encoding: 'utf8'}).trim();
const changedRuntime = execFileSync('git', ['diff', '--name-only', sourceCommit, evidenceCheckoutCommit, '--', ...runtimePaths], {encoding: 'utf8'}).trim();
execFileSync('git', ['merge-base', '--is-ancestor', sourceCommit, evidenceCheckoutCommit]);
if (changedRuntime || dirty) throw new Error(`Frozen source/package mismatch or dirty runtime: ${sourceCommit}\n${changedRuntime}\n${dirty}`);
const zip = await readFile(resolve(metadata.archive));
const zipSha256 = createHash('sha256').update(zip).digest('hex');
if (zipSha256 !== metadata.sha256 || zip.length !== metadata.bytes) throw new Error('Packaged ZIP differs from its metadata');
const report = {mode, sourceCommit, evidenceCheckoutCommit, sourceClean: true, package: metadata, zipSha256, base, database,
  physicalPhone: false, touchEmulation: true, clockOverrides: false,
  method: 'Disposable browser contexts only. Fixtures come from ordinary model reducers with full action/expense audit. The v037 database name and player archive format are retained. No user browser profile is opened or erased.',
  cases: [], screenshots: [], materials: [], videos: [], errors: []};
await mkdir(`${output}/raw`, {recursive: true});
await mkdir(`${output}/screens`, {recursive: true});
await mkdir(`${output}/materials`, {recursive: true});
await writeFile(`${output}/package-info.json`, JSON.stringify(metadata, null, 2) + '\n');
const waitUntil = async at => {while (Date.now() < at) await new Promise(resolve => setTimeout(resolve, Math.min(1000, at - Date.now())));};

async function archive(page) {
  return page.evaluate(name => new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('archive')) {db.close();reject(new Error('Missing archive store'));return;}
      const read = db.transaction('archive', 'readonly').objectStore('archive').get('current');
      read.onsuccess = () => {db.close();resolve(read.result);};
      read.onerror = () => {db.close();reject(read.error);};
    };
  }), database);
}

async function open(browser, {name, engine = 'chromium', width = 390, height = 844, fixture, video = false}) {
  const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
    ...(video ? {recordVideo: {dir: `${output}/raw`, size: {width, height}}} : {})});
  try {
    // Initialize this new context before the game runs. There is no deleteDatabase,
    // storage clearing, clock override, or access to a personal browser profile.
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
    }), {name: database, state: fixture.state});
    const unused = seed.video();await seed.close();
    if (unused) await unlink(await unused.path()).catch(() => {});
    const createdBefore = Date.now(), page = await context.newPage(), createdAfter = Date.now();
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack ?? error.message));
    page.on('response', response => {if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);});
    await page.goto(base);
    await page.locator(worldSelector).waitFor({timeout: 30000});
    // The first canvas frame can precede the live HUD update by one timer tick.
    // Capture the usable scene, rather than a stale “connecting” hint over it.
    await page.waitForFunction(() => document.querySelector('#fusion-tap')?.getAttribute('aria-disabled') === 'false');
    await page.waitForFunction(() => !!window.__FUSION__?.materialSnapshot);
    const build = await page.locator('.fu-build').innerText();
    if (!build.includes(metadata.version) || !build.includes(sourceCommit.slice(0, 7)) || build.includes('dirty')) throw new Error(`Unexpected served build: ${build}`);
    return {name, context, page, engine, width, height, build, fixtureAudit: fixture.audit,
      initial: await archive(page), createdBefore, createdAfter, errors, closed: false};
  } catch (error) {await context.close();throw error;}
}

async function close(session) {
  if (!session || session.closed) return;
  session.closed = true;const recording = session.page.video();
  try {await session.context.close();} finally {
    if (recording) session.raw = await recording.path();
    report.errors.push(...session.errors.map(error => `${session.name}: ${error}`));
  }
}

async function layout(page) {
  return page.evaluate(() => {
    const rectangle = selector => {
      const element = document.querySelector(selector);
      if (!element || element.hidden || !element.getClientRects().length) return null;
      const box = element.getBoundingClientRect();
      return {x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom};
    };
    const world = rectangle('.fu-world-shell'), field = rectangle('#fusion-field-drawer'), controls = rectangle('.fu-explore-controls');
    const overlap = (a, b) => a && b ? Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x))
      * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y)) : 0;
    const intersections = {worldField: overlap(world, field), worldControls: overlap(world, controls), fieldControls: overlap(field, controls)};
    const treatment = rectangle('#fusion-drawer[open][data-mode="treatment"]');
    return {viewport: {width: innerWidth, height: innerHeight}, world, field, controls, intersections,
      disjoint: Object.values(intersections).every(area => area <= 1),
      noOverflow: document.documentElement.scrollWidth <= innerWidth,
      controlsInViewport: !!controls && controls.y >= -1 && controls.bottom <= innerHeight + 1,
      treatment, fullScreenTreatment: !treatment || Math.abs(treatment.y) <= 1 && Math.abs(treatment.height - innerHeight) <= 1,
      inspection: {...document.querySelector('#fusion-inspection')?.dataset},
      worldData: {...document.querySelector('#fusion-world canvas')?.dataset},
      focusData: {...document.querySelector('#fusion-drawer[open] canvas[data-ready="true"]')?.dataset}};
  });
}

async function shot(session, name, kind = 'page') {
  const file = `screens/${name}.png`;
  await session.page.screenshot({path: `${output}/${file}`, scale: 'css'});
  const bounds = await layout(session.page);
  if (!bounds.disjoint || !bounds.noOverflow || !bounds.fullScreenTreatment) report.errors.push(`${name}: layout bounds failed`);
  const item = {name, file, kind, engine: session.engine, width: session.width, height: session.height,
    at: Date.now(), build: session.build, layout: bounds};
  report.screenshots.push(item);return item;
}

async function material(session, id, stage) {
  const result = await session.page.evaluate(async id => {
    const dataUrl = window.__FUSION__.materialSnapshot(id);
    if (!dataUrl?.startsWith('data:image/png;base64,')) throw new Error(`No real material PNG for ${id}`);
    const image = new Image();image.src = dataUrl;await image.decode();
    const canvas = document.createElement('canvas');canvas.width = image.naturalWidth;canvas.height = image.naturalHeight;
    const painter = canvas.getContext('2d');painter.drawImage(image, 0, 0);
    const pixels = painter.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparent = 0, opaque = 0, translucent = 0;
    for (let at = 3; at < pixels.length; at += 4) {if (!pixels[at]) transparent++;else if (pixels[at] === 255) opaque++;else translucent++;}
    return {dataUrl, width: canvas.width, height: canvas.height, transparent, opaque, translucent};
  }, id);
  const bytes = Buffer.from(result.dataUrl.split(',')[1], 'base64'), expected = 384;
  if (result.width !== expected || result.height !== expected || !result.transparent || !(result.opaque + result.translucent)) throw new Error(`Invalid transparent material ${id}: ${result.width}×${result.height}`);
  const file = `materials/${session.engine}-${session.width}-${id}-${stage}.png`;
  await writeFile(`${output}/${file}`, bytes);
  const {dataUrl: _dataUrl, ...dimensions} = result;
  const item = {file, id, stage, engine: session.engine, viewportWidth: session.width,
    source: 'window.__FUSION__.materialSnapshot(id), unmodified PNG bytes', sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length, ...dimensions};
  report.materials.push(item);return item;
}

function physicalState(state, id) {
  return {receipt: state.receipt, curio: state.curios[id], abilities: state.progression.abilities,
    wallet: state.game.resources, collection: state.game.collection, journey: state.journey};
}

async function screens() {
  const includeMaterials=process.env.RENEWAL_SCREEN_SECTIONS!=='world';
  for (const [engine, width, height] of [['chromium', 360, 800], ['chromium', 390, 844], ['webkit', 390, 844]]) {
    const browser = await ({chromium, webkit}[engine]).launch();
    try {
      if(includeMaterials)for (const id of ['receipt', 'tape', 'nested', 'stamp', 'cosmic-parcel', 'bell']) for (const stage of ['found', 'clean', 'stabilized']) {
        let session;
        try {
          const fixture = firstPlanetFixture(Date.now() + 20000, 0, stage, {receiptAbility: 0, tapeAbility: 0});
          session = await open(browser, {name: `${engine}-${width}-${id}-${stage}`, engine, width, height, fixture});
          if (session.initial.progression.abilities.receipt || session.initial.progression.abilities.tape) throw new Error('Material fixture contains ability upgrades');
          await session.page.locator('#fusion-app > .fu-nav [data-tab="collection"]').tap();
          await session.page.locator(`#fusion-collection-list [data-detail="${id}"]`).tap();
          await session.page.locator('#fusion-drawer[open][data-mode="treatment"]').waitFor();
          await session.page.locator(id === 'receipt' ? '#fusion-paper-focus[data-ready="true"]' : '#fusion-exhibit-focus[data-ready="true"]').waitFor();
          const pageShot = await shot(session, session.name, 'treatment-page');
          const beforeExport = await archive(session.page), texture = await material(session, id, stage), final = await archive(session.page);
          if (Date.now() >= fixture.state.game.lastAt) throw new Error('Material capture exceeded its future-held real model archive');
          if (JSON.stringify(physicalState(beforeExport, id)) !== JSON.stringify(physicalState(final, id))) throw new Error('Read-only material export altered the held archive');
          const selected = await session.page.locator('.fu-treatment-stages [aria-current="step"]').getAttribute('data-condition');
          if (selected !== stage) throw new Error(`Treatment stage mismatch ${id}: ${selected}/${stage}`);
          report.cases.push({name: session.name, kind: 'material', id, stage, engine, width, height,
            fixtureAudit: fixture.audit, fixtureOptions: {caseLevel: 0, receiptAbility: 0, tapeAbility: 0},
            heldUntil: fixture.state.game.lastAt, holdMethod: 'Future archive timestamp holds this model fixture during screenshots; Date.now is unchanged',
            build: session.build, initial: session.initial, final, exportReadOnly: true,
            pageFile: pageShot.file, materialFile: texture.file, errors: session.errors});
          console.log(`captured ${session.name}`);
        } finally {await close(session);}
      }
      for (const [period, fixtureKind] of [['unrevealed','unrevealed'],['partial','partial'],['day', 'revealed'], ['night', 'night']]) {
        let session;
        try {
          const fixture = feedbackFixture(fixtureKind, Date.now() + 20000);
          session = await open(browser, {name: `${engine}-${width}-${period}`, engine, width, height, fixture});
          const closed = await shot(session, `${session.name}-world`, 'world');
          await session.page.locator('#fusion-observe').tap();
          await session.page.locator('#fusion-field-drawer:not([hidden])').waitFor();
          await session.page.waitForFunction(() => document.querySelector('#fusion-inspection')?.dataset.source === 'fusion-world');
          const opened = await shot(session, `${session.name}-field`, 'field-drawer');
          const title = await session.page.locator('#fusion-field-title').innerText();
          if (period === 'night' && title !== '夜间巡逻') throw new Error(`Night drawer title is ${title}`);
          await session.page.locator('#fusion-field-close').tap();
          await session.page.locator('#fusion-field-drawer').waitFor({state: 'hidden'});
          if ((await session.page.locator('#fusion-observe').getAttribute('aria-expanded')) !== 'false') throw new Error('Field close did not reset its toggle');
          const final = await archive(session.page);
          report.cases.push({name: session.name, kind: 'world-field', engine, width, height, period,
            fixtureAudit: fixture.audit, build: session.build, initial: session.initial, final,
            heldUntil: fixture.state.game.lastAt,
            mainFile: closed.file, fieldFile: opened.file, drawerTitle: title,
            fieldBoundsDisjoint: closed.layout.disjoint && opened.layout.disjoint,
            inspectionSource: opened.layout.inspection.source, drawerClosed: true, errors: session.errors});
        } finally {await close(session);}
      }
    } finally {await browser.close();}
  }
}

async function sample(page, startAt) {
  return page.evaluate(({name, startAt}) => new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, get = db.transaction('archive', 'readonly').objectStore('archive').get('current');
      get.onerror = () => {db.close();reject(get.error);};
      get.onsuccess = () => {
        const saved = get.result, game = saved.game, scene = {...document.querySelector('#fusion-world canvas').dataset}, wallAt = Date.now();
        db.close();resolve({wallAt, wallMs: wallAt - startAt, savedAt: game.lastAt, worldMs: game.world.elapsedMs,
          storageRevision: saved.storageRevision, accepted: game.assist?.actionSeq ?? 0,
          applied: game.assist?.appliedWorkMs ?? 0, enqueued: game.assist?.enqueuedWorkMs ?? 0, pending: game.assist?.pendingWorkMs ?? 0,
          cycles: game.cycles, cycleMs: game.cycleMs, balance: game.resources,
          grossIncome: game.station.grossIncome, repairSpent: game.station.repairSpent,
          discoveryAt: {...game.discoveryAt}, collection: [...game.collection], scene,
          intensity: Number(scene.robotAssistVisualIntensity), tier: Number(scene.robotAssistVisualTier),
          torsoLean: Number(scene.robotTorsoLean), scanAmplitude: Number(scene.robotScanAmplitude),
          action: scene.robotAnimationAction ?? scene.action, workSeconds: Number(scene.robotWorkSeconds),
          gaitFrame: Number(scene.robotGaitFrame), scanAngle: Number(scene.robotScanAngle), received: Number(scene.robotReceived)});
      };
    };
  }), {name: database, startAt});
}

async function tap(session, startAt, scheduledMs) {
  await waitUntil(startAt + scheduledMs);
  const point = await session.page.evaluate(() => {
    const canvas = document.querySelector('#fusion-world canvas'), box = canvas.getBoundingClientRect(), api = window.__FUSION__;
    for (const [px, py] of [[416,610],[460,600],[380,600],[420,570],[350,560],[390,650]]) {
      const x = box.x + box.width * px / canvas.width, y = box.y + box.height * py / canvas.height;
      if ([[0,0],[-4,0],[4,0],[0,-4],[0,4]].every(([dx,dy]) => api.pickAtClient(x + dx, y + dy).kind === 'planet')) return {x, y, hit: api.pickAtClient(x, y)};
    }
    return null;
  });
  if (!point) throw new Error('No currently visible planet pixel for native assist');
  const at = Date.now();await session.page.touchscreen.tap(point.x, point.y);
  if (await session.page.locator('#fusion-drawer[open]').count()) throw new Error('Native terrain touch opened an object drawer');
  return {scheduledMs, actualMs: at - startAt, ...point};
}

async function assist() {
  const browser = await chromium.launch();let session, evidence;
  const schedule = [400,750,1100,13100,13450,13800,25800,26150,26500];
  const startAt = Date.now() + 15000;
  try {
    const fixture = feedbackFixture('unrevealed', startAt);
    session = await open(browser, {name: 'chromium-390-assist-36s', fixture, video: true});
    if (Date.now() >= startAt || session.initial.game.world.elapsedMs || session.initial.game.collection.length) throw new Error('Assist recording missed its empty-archive common start');
    const [measurement, attempts] = await Promise.all([
      (async () => {
        const trace = [], arrivals = [];
        for (let scheduledMs = 0; scheduledMs <= 36000; scheduledMs += 100) {
          await waitUntil(startAt + scheduledMs);
          const current = await sample(session.page, startAt), previous = trace.at(-1);
          current.scheduledMs = scheduledMs;trace.push(current);
          if (previous && current.cycles > previous.cycles) arrivals.push({wallMs: current.wallMs, worldMs: current.worldMs,
            cycles: current.cycles, increase: current.cycles - previous.cycles, grossIncrease: current.grossIncome - previous.grossIncome,
            discoveryAt: current.discoveryAt, note: 'Arrival from saved cycle increment; visual intensity never grants rewards'});
        }
        return {sampleIntervalMs: 100, trace, arrivals};
      })(),
      (async () => {const attempts = [];for (const at of schedule) attempts.push(await tap(session, startAt, at));return attempts;})(),
    ]);
    const final = await archive(session.page), work = final.game.assist;
    const tiersObserved = [...new Set(measurement.trace.map(item => item.tier))].sort((a,b) => a-b);
    const peak = measurement.trace.find(item => item.tier === 3);
    const returned = peak && measurement.trace.find(item => item.wallMs > peak.wallMs + 3200 && item.tier === 0);
    evidence = {name: session.name, kind: 'assist', startAt, durationSeconds: 36, speed: 1,
      fixtureAudit: fixture.audit, build: session.build, initial: session.initial, final,
      inputScheduleMs: schedule, attempts, ...measurement, tiersObserved,
      naturalDecayObserved: !!returned, returnedToZeroAtMs: returned?.wallMs ?? null,
      firstDiscoveryMs: final.game.discoveryAt.receipt - startAt,
      ledgerConserved: Math.abs(work.enqueuedWorkMs - work.appliedWorkMs - work.pendingWorkMs) < .01,
      errors: session.errors,
      method: '36 seconds of native wall time and real touchscreen taps. All three assist visual tiers and decay are observed from actual rendered datasets; no state edits or clock overrides after the fixture is installed.'};
    report.cases.push(evidence);
    if (!tiersObserved.every(Number.isFinite) || ![0,1,2,3].every(tier => tiersObserved.includes(tier)) || !returned) report.errors.push('Assist did not visibly cover 0/1/2/3 and natural decay to0');
    if (!evidence.ledgerConserved || work.enqueuedWorkMs !== work.actionSeq * 600 || work.actionSeq !== schedule.length) report.errors.push('Assist accepted/enqueued/applied ledger differs from the nine intended native inputs');
    await shot(session, `${session.name}-end`, 'assist-page');
  } finally {await close(session);await browser.close();}
  if (!evidence) return;
  const file = 'assist-three-tiers-36s.mp4', leadInSeconds = Math.max(0, (startAt - session.createdAfter) / 1000);
  execFileSync('ffmpeg', ['-y', '-i', session.raw, '-vf', `trim=start=${leadInSeconds}:duration=36,setpts=PTS-STARTPTS`,
    '-an', '-c:v', 'libx264', '-preset', 'fast', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${output}/${file}`], {stdio: 'ignore'});
  const probe = JSON.parse(execFileSync('ffprobe', ['-v','quiet','-show_format','-show_streams','-of','json',`${output}/${file}`], {encoding: 'utf8'}));
  const recording = {file, durationSeconds: 36, speed: 1, probe, leadInSeconds,
    alignment: {pageCreatedBefore: session.createdBefore, pageCreatedAfter: session.createdAfter,
      note: 'Video start is estimated from this page-creation timestamp bracket; trace timestamps are actual browser wall/engine times.'}};
  report.videos.push(recording);evidence.video = recording;
  const frames = [
    ['tier-0-before', evidence.trace.find(item => item.tier === 0)],
    ['tier-1-low', evidence.trace.find(item => item.tier === 1)],
    ['tier-2-middle', evidence.trace.find(item => item.tier === 2)],
    ['tier-3-high', evidence.trace.find(item => item.tier === 3)],
    ['tier-0-decayed', evidence.trace.find(item => item.wallMs > 5000 && item.tier === 0)],
    ['tier-0-final', evidence.trace.find(item => item.wallMs >= 34000 && item.tier === 0)],
  ];
  for (const [name, observed] of frames) {
    if (!observed) continue;
    const frameFile = `screens/assist-${name}.png`;
    execFileSync('ffmpeg', ['-y','-ss',String(Math.min(35.9, Math.max(0, observed.wallMs / 1000))),'-i',`${output}/${file}`,
      '-frames:v','1',`${output}/${frameFile}`], {stdio: 'ignore'});
    report.screenshots.push({name: `assist-${name}`, file: frameFile, kind: 'video-frame', sourceVideo: file,
      engine: 'chromium', width: 390, height: 844, observed,
      note: 'Unmodified frame of the native 1x recording; extracted after capture so screenshots cannot delay burst inputs.'});
  }
}

function treatmentState(state, id) {
  const action = id === 'receipt' ? state.receipt.activeAction : state.curios[id]?.action;
  return {condition: id === 'receipt' ? state.receipt.condition : state.curios[id]?.condition,
    action: action ? {kind: action.kind,
      key: id === 'receipt' ? action.id : `${id}/${action.kind}/${action.startedAt}/${action.endsAt}`,
      startedAt: id === 'receipt' ? action.startedAtSeconds * 1000 : action.startedAt,
      endsAt: id === 'receipt' ? (action.startedAtSeconds + action.durationSeconds) * 1000 : action.endsAt} : null};
}

function treatmentLedger(before, after) {
  const grossIncome = after.game.station.grossIncome - before.game.station.grossIncome;
  const repairIncomeAdjustment = after.game.station.repairSpent - before.game.station.repairSpent;
  return {balanceBefore: before.game.resources, balanceAfter: after.game.resources, grossIncome,
    repairSpent: repairIncomeAdjustment,
    charged: before.game.resources + grossIncome - repairIncomeAdjustment - after.game.resources,
    formula: 'balanceBefore + grossIncome - repairSpent - balanceAfter = action charge'};
}

async function waitTreatment(session, id, predicate, timeoutMs = 10000) {
  const began = Date.now();
  while (Date.now() - began < timeoutMs) {
    const state = await archive(session.page);
    if (predicate(treatmentState(state, id), state)) return state;
    await waitUntil(Date.now() + 100);
  }
  throw new Error(`${id}: timed out waiting for actual persisted treatment action`);
}

async function paidTreatment(session, id, kind) {
  const selector = id === 'receipt' ? '#fusion-paper-primary' : '#fusion-curio-primary';
  const button = session.page.locator(`#fusion-drawer[open][data-mode="treatment"] ${selector}`);
  await session.page.waitForFunction(({selector, kind}) => {
    const button = document.querySelector(selector);return button && !button.disabled && button.dataset.kind === kind;
  }, {selector, kind});
  const label = await button.innerText(), amounts = label.match(/\d+/g), quoted = amounts ? Number(amounts.at(-1)) : NaN;
  if (!Number.isFinite(quoted) || quoted <= 0) throw new Error(`${id}/${kind}: no current UI fee quote in ${label}`);
  const before = await archive(session.page), clickedAt = Date.now();
  await button.tap();
  const started = await waitTreatment(session, id, current => current.action?.kind === kind);
  const action = treatmentState(started, id).action;
  if (!(action.endsAt > action.startedAt)) throw new Error(`${id}/${kind}: invalid persisted start/end`);
  const startLedger = treatmentLedger(before, started), observations = [];
  let ongoing, completed;
  const timeoutAt = Math.max(Date.now(), action.endsAt) + 8000;
  while (Date.now() < timeoutAt) {
    const state = await archive(session.page), current = treatmentState(state, id), at = Date.now();
    const focus = await session.page.locator(id === 'receipt' ? '#fusion-paper-focus' : '#fusion-exhibit-focus').evaluate(canvas => ({...canvas.dataset}));
    const progress = Math.max(0, Math.min(1, (at - action.startedAt) / (action.endsAt - action.startedAt)));
    observations.push({at, savedAt: state.game.lastAt, condition: current.condition, action: current.action, progress, focus});
    if (!ongoing && current.action?.key === action.key && progress >= .25
      && (focus.toolContact || focus.contact || progress >= .55)) {
      ongoing = await shot(session, `treatment-${id}-${kind}-ongoing`, 'treatment-contact');
      ongoing.treatment = {id, action: kind, progress, sourceAction: action,
        actualToolContact: focus.toolContact || focus.contact || null};
    }
    const expected = kind === 'clean' ? 'clean' : 'stabilized';
    if (!current.action && current.condition === expected) {completed = state;break;}
    if (current.action && current.action.key !== action.key) throw new Error(`${id}/${kind}: a second action replaced the recorded one`);
    await waitUntil(Date.now() + 100);
  }
  if (!completed || !ongoing) throw new Error(`${id}/${kind}: missing real active-action frame or completion`);
  const condition = kind === 'clean' ? 'clean' : 'stabilized';
  await session.page.waitForFunction(({id, condition}) => {
    const canvas = document.querySelector(id === 'receipt' ? '#fusion-paper-focus' : '#fusion-exhibit-focus');
    return canvas?.dataset[id === 'receipt' ? 'restorationCondition' : 'condition'] === condition;
  }, {id, condition});
  const done = await shot(session, `treatment-${id}-${kind}-complete`, 'treatment-complete');
  done.treatment = {id, action: kind, condition};
  const after = await archive(session.page), ledger = treatmentLedger(before, after), afterStart = treatmentLedger(started, after);
  const previousIds = new Set(before.receipt.transactions.map(transaction => transaction.actionId));
  const transactions = after.receipt.transactions.filter(transaction => !previousIds.has(transaction.actionId));
  const receiptTransactionCorrect = id !== 'receipt' || transactions.length === 1
    && transactions[0].actionId === action.key && transactions[0].amount === quoted && transactions[0].kind === kind;
  const noRepeatCharge = startLedger.charged === quoted && ledger.charged === quoted && afterStart.charged === 0
    && receiptTransactionCorrect;
  if (!noRepeatCharge) throw new Error(`${id}/${kind}: quoted/start/complete payment failed reconciliation`);
  return {kind, id, clickedAt, label, quoted, quoteSource: 'Current production UI button, existing action rule',
    action, started, completed, after, startLedger, ledger, afterStart, noRepeatCharge,
    receiptTransactions: transactions, observations, ongoingFile: ongoing.file, completeFile: done.file};
}

async function freeTreatmentTrial(session, id, prefix=`treatment-${id}`) {
  const before = await archive(session.page), clickedAt = Date.now();
  await session.page.locator('#fusion-drawer[open][data-mode="treatment"] #fusion-try').tap();
  let sourceAction = null, source, ongoing;
  if (id === 'receipt') {
    const started = await waitTreatment(session, id, current => current.action?.kind === 'try');
    sourceAction = treatmentState(started, id).action;
    source = 'Existing durable receipt try action; actual startedAtSeconds/durationSeconds';
    await waitUntil(sourceAction.startedAt + (sourceAction.endsAt - sourceAction.startedAt) * .5);
    ongoing = await shot(session, `${prefix}-free-try-ongoing`, 'treatment-trial');
    await waitTreatment(session, id, (current, state) => !current.action && state.receipt.completedActionIds.includes(sourceAction.key),
      Math.max(10000, sourceAction.endsAt - Date.now() + 4000));
  } else {
    // Tape/bell's existing free trial is intentionally ephemeral UI animation:
    // it does not create a durable curio action. Do not manufacture one for evidence.
    source = 'Existing visual-only curio trial (UI 2600ms), native wall time; no saved action is created';
    await session.page.locator('#fusion-curio-response:not([hidden])').waitFor();
    await waitUntil(clickedAt + 1300);
    ongoing = await shot(session, `${prefix}-free-try-ongoing`, 'treatment-trial');
    await waitUntil(clickedAt + 3000);
  }
  const complete = await shot(session, `${prefix}-free-try-complete`, 'treatment-trial');
  const after = await archive(session.page), ledger = treatmentLedger(before, after);
  const free = ledger.charged === 0 && after.receipt.transactions.length === before.receipt.transactions.length;
  if (!free || treatmentState(after, id).condition !== 'stabilized') throw new Error(`${id}: free trial charged or changed physical condition`);
  return {kind: 'try', id, clickedAt, source, sourceAction, before, after, ledger, free,
    ongoingFile: ongoing.file, completeFile: complete.file,
    response: id === 'receipt' ? null : await session.page.locator('#fusion-curio-response').innerText()};
}

async function treatments() {
  const browser = await chromium.launch();
  try {
    for (const id of ['receipt', 'tape', 'nested', 'stamp', 'cosmic-parcel', 'bell']) {
      let session, entry;
      try {
        // Real current time is required here: native action settlement must not
        // be rejected by a future-held screenshot fixture's lastAt timestamp.
        const fixture = firstPlanetFixture(Date.now(), 0, 'found', {receiptAbility: 0, tapeAbility: 0});
        session = await open(browser, {name: `chromium-390-treatment-${id}`, fixture, video: true});
        if (treatmentState(session.initial, id).condition !== 'found'
          || session.initial.progression.abilities.receipt || session.initial.progression.abilities.tape
          || id === 'receipt' && session.initial.receipt.stage !== 'displayed') throw new Error(`${id}: treatment must start found, already excavated and ability0`);
        await session.page.locator('#fusion-app > .fu-nav [data-tab="collection"]').tap();
        await session.page.locator(`#fusion-collection-list [data-detail="${id}"]`).tap();
        await session.page.locator('#fusion-drawer[open][data-mode="treatment"]').waitFor();
        await session.page.locator(id === 'receipt' ? '#fusion-paper-focus[data-ready="true"]' : '#fusion-exhibit-focus[data-ready="true"]').waitFor();
        const reviewStartedAt = Date.now(), before = await archive(session.page);
        entry = {name: session.name, kind: 'treatment', id, engine: 'chromium', width: 390, height: 844,
          fixtureAudit: fixture.audit, fixtureOptions: {stage: 'found', caseLevel: 0, receiptAbility: 0, tapeAbility: 0, at: fixture.state.game.lastAt},
          build: session.build, initial: session.initial, before, reviewStartedAt, steps: [], complete: false,
          naturalTime: true, speed: 1, errors: session.errors};
        report.cases.push(entry);
        entry.initialFile = (await shot(session, `treatment-${id}-found`, 'treatment-initial')).file;
        entry.steps.push(await paidTreatment(session, id, 'clean'));
        entry.steps.push(await paidTreatment(session, id, 'repair'));
        entry.trial = await freeTreatmentTrial(session, id);
        entry.final = await archive(session.page);entry.reviewEndedAt = Date.now();
        entry.durationSeconds = (entry.reviewEndedAt - reviewStartedAt) / 1000;
        entry.ledger = treatmentLedger(before, entry.final);
        entry.quotedTotal = entry.steps.reduce((sum, step) => sum + step.quoted, 0);
        entry.noRepeatPayment = entry.ledger.charged === entry.quotedTotal && entry.steps.every(step => step.noRepeatCharge) && entry.trial.free;
        if (!entry.noRepeatPayment) throw new Error(`${id}: complete treatment balance did not reconcile to its two native quotes`);
        entry.complete = true;
      } finally {await close(session);}
      if (!entry?.complete) continue;
      const file = `treatment-${id}-natural.mp4`, leadInSeconds = Math.max(0, (entry.reviewStartedAt - session.createdAfter) / 1000);
      execFileSync('ffmpeg', ['-y','-i',session.raw,'-vf',`trim=start=${leadInSeconds}:duration=${entry.durationSeconds},setpts=PTS-STARTPTS`,
        '-an','-c:v','libx264','-preset','fast','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',`${output}/${file}`], {stdio: 'ignore'});
      const probe = JSON.parse(execFileSync('ffprobe', ['-v','quiet','-show_format','-show_streams','-of','json',`${output}/${file}`], {encoding: 'utf8'}));
      const recording = {file, kind: 'treatment', id, durationSeconds: entry.durationSeconds, speed: 1, probe,
        caption: `${id} · 自然清理→修复→免费试验，${entry.durationSeconds.toFixed(2)}秒实测，1倍速度`,
        leadInSeconds, alignment: {pageCreatedBefore: session.createdBefore, pageCreatedAfter: session.createdAfter,
          note: 'Only loading lead-in is trimmed using the page-creation timestamp bracket; no action time is accelerated.'}};
      entry.video = recording;report.videos.push(recording);
      console.log(`captured treatment ${id}: ${entry.durationSeconds.toFixed(2)}s, paid ${entry.ledger.charged}`);
    }
  } finally {await browser.close();}
}


async function excavation(){
 const browser=await chromium.launch();let session;
 try{
  const fixture=firstPlanetFixture(Date.now(),0,'buried',{receiptAbility:0,tapeAbility:0});session=await open(browser,{name:'chromium-390-receipt-excavation',fixture,video:true});
  await session.page.locator('[data-tab="collection"]').tap();await session.page.locator('#fusion-collection-list [data-detail="receipt"]').tap();await session.page.locator('#fusion-paper-focus[data-ready="true"]').waitFor();
  const startAt=Date.now(),before=await archive(session.page);await shot(session,'receipt-excavation-before','excavation');await session.page.locator('#fusion-paper-primary').tap();
  const observations=[];for(let i=0;i<48;i++){await waitUntil(startAt+i*150);observations.push({at:Date.now(),focus:await session.page.locator('#fusion-paper-focus').evaluate(c=>({...c.dataset}))});}
  await shot(session,'receipt-excavation-after','excavation');const after=await archive(session.page);if(after.receipt.stage==='buried')throw Error('Excavation never completed');
  report.cases.push({name:session.name,kind:'excavation',before,after,ledger:treatmentLedger(before,after),observations,fixtureAudit:fixture.audit});const durationSeconds=(Date.now()-startAt)/1000;await close(session);await saveVideo(session,'receipt-excavation-natural.mp4',durationSeconds,startAt);
 }finally{await close(session);await browser.close();}
}

async function saveVideo(session,file,durationSeconds,startAt){
 const leadInSeconds=Math.max(0,(startAt-session.createdAfter)/1000);
 execFileSync('ffmpeg',['-y','-i',session.raw,'-vf',`trim=start=${leadInSeconds}:duration=${durationSeconds},setpts=PTS-STARTPTS`,'-an','-c:v','libx264','-preset','fast','-crf','24','-pix_fmt','yuv420p','-movflags','+faststart',`${output}/${file}`],{stdio:'ignore'});
 const probe=JSON.parse(execFileSync('ffprobe',['-v','quiet','-show_format','-show_streams','-of','json',`${output}/${file}`],{encoding:'utf8'}));
 const entry={file,durationSeconds,speed:1,probe,physicalPhone:false,nativeWallClock:true};report.videos.push(entry);return entry;
}
/** Research remains a real owned right. These are ordinary earned fixtures,
 * followed by native free display actions, never invented receipt evidence. */
async function reading(){
 const browser=await chromium.launch();
 try{for(const level of [0,1,2]){
  let session;
  try{
   // Hold the cabinet at Lv0: cabinet ornament must not masquerade as research growth.
   const fixture=firstPlanetFixture(Date.now(),0,'stabilized',{receiptAbility:level,tapeAbility:0});
   session=await open(browser,{name:`chromium-390-receipt-reading-${level}`,fixture,video:true});
   await session.page.locator('[data-tab="collection"]').tap();
   await session.page.locator('#fusion-collection-list [data-detail="receipt"]').tap();
   await session.page.locator('#fusion-paper-focus[data-ready="true"][data-focus="glass-case"]').waitFor();
   const startAt=Date.now(),before=await archive(session.page);
   const initial=await shot(session,`receipt-reading-${level}-before`,'receipt-reading');
   await session.page.waitForTimeout(1200);
   const trial=await freeTreatmentTrial(session,'receipt',`receipt-reading-${level}`);
   await session.page.waitForTimeout(1500);
   const data=await session.page.locator('#fusion-paper-focus').evaluate(c=>({...c.dataset}));
   const after=await archive(session.page),ledger=treatmentLedger(before,after);
   const final=await shot(session,`receipt-reading-${level}-after`,'receipt-reading');
   if(ledger.charged!==0||JSON.stringify(before.records)!==JSON.stringify(after.records)||JSON.stringify(before.receipt.verifiedEvidenceIds)!==JSON.stringify(after.receipt.verifiedEvidenceIds))throw Error('Display reading charged or manufactured a fact');
   if(level){const bounds=JSON.parse(data.abilityBounds);if(!(bounds.width>80&&bounds.width<=152))throw Error('Research enlarged or lost the original paper');}
   const durationSeconds=(Date.now()-startAt)/1000;
   report.cases.push({name:session.name,kind:'receipt-reading',abilityLevel:level,cabinetLevel:0,fixtureAudit:fixture.audit,before,after,ledger,trial,focus:data,initialFile:initial.file,finalFile:final.file,durationSeconds,originalFactsUnchanged:true});
   await close(session);await saveVideo(session,`receipt-reading-level-${level}.mp4`,durationSeconds,startAt);
  }finally{await close(session);}
 }}finally{await browser.close();}
}
async function pages(){
 for(const [engine,width,height]of[['chromium',390,844],['chromium',360,800],['webkit',390,844],['chromium',1440,1000]]){
  const browser=await({chromium,webkit}[engine]).launch();let session;
  try{
   const fixture=renewalPagesFixture(Date.now()+60000);
   session=await open(browser,{name:`${engine}-${width}-pages`,engine,width,height,fixture});
   for(const tab of ['collection','base','explore']){await session.page.locator(`[data-tab="${tab}"]`).tap();await session.page.waitForTimeout(300);await shot(session,`${engine}-${width}-${tab}`,'page');}
   for(const [id,label]of[['fusion-upgrades','equipment'],['fusion-map','map'],['fusion-wallet','wallet'],['fusion-settings','settings']]){await session.page.locator(`#${id}`).tap();await session.page.waitForTimeout(400);await shot(session,`${engine}-${width}-${label}`,'drawer');await session.page.locator('#fusion-close').tap();}
   await session.page.locator('[data-tab="base"]').tap();
   for(const label of ['build','research','station']){await session.page.locator(`.fu-base-actions [data-drawer="${label}"]`).tap();await shot(session,`${engine}-${width}-${label}`,'drawer');await session.page.locator('#fusion-close').tap();}
   await session.page.locator('.fu-base-actions [data-drawer="station"]').tap();
   await session.page.locator('#fusion-drawer details').evaluate(d=>d.open=true);
   await shot(session,`${engine}-${width}-security`,'drawer');await session.page.locator('#fusion-close').tap();
   for(const id of ['evidence-bench','habitat-window','archive']){
    await session.page.locator('.fu-base-actions [data-drawer="build"]').tap();
    await session.page.locator(`#fusion-drawer [data-open-project="${id}"]`).tap();await session.page.waitForTimeout(500);
    await shot(session,`${engine}-${width}-project-${id}`,'project');
    if(id==='archive'&&await session.page.locator('#fusion-replay-night').isEnabled()){
     await session.page.locator('#fusion-replay-night').tap();await session.page.waitForTimeout(1700);
     await shot(session,`${engine}-${width}-night-replay`,'replay');
    }
    await session.page.locator('#fusion-close').tap();
   }
   await session.page.locator('[data-tab="explore"]').tap();await session.page.locator('#fusion-upgrades').tap();
   await session.page.locator('#fusion-open-sorting').tap();await shot(session,`${engine}-${width}-sorting`,'drawer');await session.page.locator('#fusion-close').tap();
   await session.page.locator('[data-tab="collection"]').tap();
   for(const id of ['mouse','hermit','tagbird','night-shift']){
    await session.page.locator(`.fu-filters [data-filter="${id==='night-shift'?'event':'creature'}"]`).tap();
    await session.page.locator(`#fusion-collection-list [data-detail="${id}"]`).tap();await session.page.waitForTimeout(600);
    await shot(session,`${engine}-${width}-detail-${id}`,'detail');await session.page.locator('#fusion-close').tap();
   }
   report.cases.push({name:session.name,fixtureAudit:fixture.audit,initial:session.initial,final:await archive(session.page),kind:'reachable-pages',errors:session.errors});
  }finally{await close(session);await browser.close();}
 }
 const browser=await chromium.launch();let session;
 try{const fixture=renewalFixture(Date.now()+60000,'return');session=await open(browser,{name:'chromium-390-return',fixture});await session.page.locator('#fusion-return-chip').tap();await shot(session,session.name,'return');report.cases.push({name:session.name,fixtureAudit:fixture.audit,kind:'return',initial:session.initial,final:await archive(session.page)});}finally{await close(session);await browser.close();}
}
async function life(){
 const browser=await chromium.launch();let session;
 try{
  const startAt=Date.now()+15000,fixture=feedbackFixture('unrevealed',startAt);
  session=await open(browser,{name:'chromium-390-daynight',fixture,video:true});
  if(Date.now()>=startAt)throw Error('Day/night loading missed fixture start');
  const trace=[],periods=new Set();
  for(let i=0;i<=312;i++){
   await waitUntil(startAt+i*1000);const state=await archive(session.page),period=await session.page.locator('#fusion-period').getAttribute('data-period');
   trace.push({at:Date.now(),worldMs:state.game.world.elapsedMs,period,integrity:state.game.station.integrity,repairSpent:state.game.station.repairSpent,balance:state.game.resources,nightReport:state.game.station.lastNight,worldDataset:await session.page.locator(worldSelector).evaluate(c=>({...c.dataset}))});
   if(!periods.has(period)){periods.add(period);await shot(session,`daynight-${period}`,'daynight');}
   if(i%30===0)console.log(`natural daynight ${i}/312s ${period}`);
  }
  report.cases.push({name:session.name,kind:'complete-daynight',startAt,durationSeconds:312,periods:[...periods],trace,initial:session.initial,final:await archive(session.page),fixtureAudit:fixture.audit});
  if(!['day','dusk','night','dawn'].every(p=>periods.has(p)))throw Error('Missing a natural day/night phase');
  await close(session);await saveVideo(session,'complete-daynight-312s.mp4',312,startAt);
 }finally{await close(session);await browser.close();}
}
async function cases(){
 const browser=await chromium.launch();let session;
 try{
  const fixture=renewalFixture(Date.now(),'funded');session=await open(browser,{name:'chromium-390-museum',fixture,video:true});
  await session.page.locator('[data-tab="base"]').tap();await session.page.waitForTimeout(600);const startAt=Date.now(),trace=[];
  for(let i=0;i<70;i++){await waitUntil(startAt+i*1000);trace.push({at:Date.now(),dataset:await session.page.locator('.museum-room canvas').evaluate(c=>({...c.dataset})),status:await session.page.locator('#fusion-robot-status').innerText()});}
  // Read-only crops of the actual rendered room, not a fabricated phone page.
  // Wait for the real robot to leave each cabinet's horizontal sightline.
  for(const [index,id]of ['receipt','tape','nested','stamp','cosmic-parcel','bell'].entries()){
   const x=[104,384,664][index%3],y=index<3?500:825;
   await session.page.waitForFunction(x=>Math.abs(Number(document.querySelector('#museum-canvas').dataset.robotX)-x)>172,x,{timeout:30000});
   const data=await session.page.locator('#museum-canvas').evaluate((room,{x,y})=>{const c=document.createElement('canvas');c.width=204;c.height=330;c.getContext('2d').drawImage(room,x-102,y-282,204,330,0,0,204,330);return c.toDataURL('image/png');},{x,y});
   const file=`screens/glass-cabinet-${id}-native.png`;await writeFile(`${output}/${file}`,Buffer.from(data.split(',')[1],'base64'));
   report.screenshots.push({name:`glass-cabinet-${id}-native`,file,kind:'native-canvas-crop',engine:'chromium',width:390,height:844,imagePixels:{width:204,height:330},caption:`${id} · 实际收藏室原生画布裁片（非手机页面截图）`,at:Date.now(),build:session.build});
  }
  await close(session);await saveVideo(session,'museum-two-cabinets-70s.mp4',70,startAt);report.cases.push({name:'museum-robot',kind:'museum-continuous',trace,fixtureAudit:fixture.audit});
 }finally{await close(session);}
 try{
  const fixture=renewalFixture(Date.now(),'funded');session=await open(browser,{name:'chromium-390-case-install',fixture,video:true});await session.page.locator('[data-tab="base"]').tap();const startAt=Date.now(),upgrades=[];
  await session.page.locator('.fu-base-actions [data-drawer="build"]').tap();
  for(let expected=0;expected<3;expected++){
   const button=session.page.locator('[data-growth="case-0"]');await button.locator('xpath=ancestor::details').evaluate(d=>d.open=true);const before=await archive(session.page),label=await button.innerText();await button.tap();await session.page.locator('#fusion-case-preview[data-level]').waitFor();await session.page.waitForTimeout(4500);await shot(session,`case-level-${expected+1}`,'installation');const after=await archive(session.page);upgrades.push({expected,label,before,after,ledger:treatmentLedger(before,after)});await session.page.locator('#fusion-return-build').tap();
  }
  const durationSeconds=(Date.now()-startAt)/1000;await close(session);await saveVideo(session,'case-0-to-3-installation.mp4',durationSeconds,startAt);report.cases.push({name:'case-installation',kind:'paid-case-installation',upgrades,fixtureAudit:fixture.audit});
 }finally{await close(session);await browser.close();}
}

try {
  if (mode === 'screens') await screens();
  else if (mode === 'assist') await assist();
  else if(mode==='treatment') await treatments();
  else if(mode==='pages') await pages();
  else if(mode==='life') await life();
  else if(mode==='excavation') await excavation();
  else if(mode==='reading') await reading();
  else await cases();
} catch (error) {report.errors.push(error.stack ?? String(error));process.exitCode = 1;console.error(error);}
finally {
  await writeFile(`${output}/${mode}-evidence.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({mode, sourceCommit, cases: report.cases.length, screenshots: report.screenshots.length,
    materials: report.materials.length, videos: report.videos.length, errors: report.errors.length}));
}
if (report.errors.length) process.exitCode = 1;
