import {chromium, webkit} from '@playwright/test';
import {mkdir, readFile, writeFile, unlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {feedbackFixture} from '../releases/feedback-fixtures/feedback_fixtures.js';

// Each mode is independently runnable. Use the immutable packaged directories,
// never a live development server, while collecting final evidence.
const mode = process.argv[2] ?? 'screens';
if (!['screens', 'compare', 'world'].includes(mode)) throw new Error('Expected screens, compare, or world');
const output = resolve('artifacts/v038-feedback');
const base = process.env.V038_URL ?? 'http://127.0.0.1:4224/';
const baseline = process.env.BASELINE_URL ?? 'http://127.0.0.1:4223/';
const metadata = JSON.parse(await readFile('releases/taptap/package-info-fusion.json', 'utf8'));
const baselineCommit = 'b7f7326dbbadccbe60627a7e954a834be7275fa0';
const database = 'loststar.fusion.firstplanet.v037';
const worldSelector = '#fusion-world canvas[data-ready="true"]';
const layouts = [['chromium', 360, 800], ['chromium', 390, 844], ['webkit', 390, 844]];
const report = {mode, sourceCommit: metadata.sourceCommit, package: metadata, baselineCommit, base, baseline,
  physicalPhone: false, touchEmulation: true, clockOverrides: false, database,
  method: 'Isolated browser contexts with model-generated review archives. Native wall time and native touchscreen input. No player browser profile is opened or cleared.',
  cases: [], screenshots: [], videos: [], errors: []};
await mkdir(`${output}/raw`, {recursive: true});
await mkdir(`${output}/screens`, {recursive: true});
const waitUntil = async at => {while (Date.now() < at) await new Promise(resolve => setTimeout(resolve, Math.min(1000, at - Date.now())));};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const gameArchive = ({storageRevision: _storageRevision, ...archive}) => archive;
const urlFor = (source, scale = 'regional') => {const url = new URL(source);url.searchParams.set('fog-scale', scale);return url.href;};

async function readArchive(page) {
  return page.evaluate(name => new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('archive')) {db.close();reject(new Error('Missing archive store'));return;}
      const get = db.transaction('archive', 'readonly').objectStore('archive').get('current');
      get.onsuccess = () => {db.close();resolve(get.result);};
      get.onerror = () => {db.close();reject(get.error);};
    };
  }), database);
}

async function diagnostics(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector('#fusion-world canvas');
    const api = window.__FUSION__;
    return {visual: canvas ? {...canvas.dataset} : null,
      surface: api?.surfaceMetrics?.() ?? null, facilities: api?.facilityMetrics?.() ?? null,
      feedback: api?.feedbackMetrics?.() ?? null,
      textures: window.__V038_TEXTURES__ ?? null,
      noOverflow: document.documentElement.scrollWidth <= innerWidth,
      bodyText: document.body.innerText};
  });
}

async function screenshot(session, label) {
  const file = `screens/${label}.png`;
  await session.page.screenshot({path: `${output}/${file}`, scale: 'css'});
  const entry = {file, case: session.name, engine: session.engine, width: session.width, height: session.height,
    at: Date.now(), archive: await readArchive(session.page), diagnostics: await diagnostics(session.page)};
  if (!entry.diagnostics.noOverflow) report.errors.push(`${label}: horizontal overflow`);
  report.screenshots.push(entry);
  return entry;
}

async function open(browser, {name, engine = 'chromium', width = 390, height = 844,
  fixture, source = 'new', scale = 'regional', video = false, isolate = 'none'}) {
  const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, ...(video ? {recordVideo: {dir: `${output}/raw`, size: {width, height}}} : {})});
  let page;
  try {
    const url = urlFor(source === 'old' ? baseline : base, scale);
    // The seed page never runs game JavaScript. It initializes only this new
    // disposable context's archive before the actual game's first load.
    const seed = await context.newPage();
    await seed.route('**/*.js', route => route.abort());
    await seed.goto(url, {waitUntil: 'domcontentloaded'});
    await seed.evaluate(({name, save}) => new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('archive');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction('archive', 'readwrite');
        tx.objectStore('archive').put(save, 'current');
        tx.oncomplete = () => {db.close();localStorage.setItem('loststar.ui.firstplanet.v037.intro', String(save.journey.seed));resolve();};
        tx.onerror = () => {db.close();reject(tx.error);};
      };
    }), {name: database, save: fixture.state});
    const seedVideo = seed.video();await seed.close();
    if (seedVideo) await unlink(await seedVideo.path()).catch(() => {});

    // Count original image sources, including blocked draws. Texture isolation
    // leaves vector shadows, primitive effects and the globe untouched; it is
    // evidence of render sources, not a proposed player-facing rendering mode.
    await context.addInitScript(isolation => {
      const patterns = {
        'legacy-sorter': /\/(?:sorter)(?:-[^/]*)?\.webp(?:[?#].*)?$/,
        'layered-sorter': /\/(?:sorting-machine-(?:back|front)|sorting-rollers|sorting-curtain-[012]|sorting-paper-jam)(?:-[^/]*)?\.webp(?:[?#].*)?$/,
        robot: /\/robot-empty-v3(?:-[^/]*)?\.webp(?:[?#].*)?$/,
      };
      const statistics = {isolation, note: 'Only matching image drawImage calls are suppressed; vector effects and source-independent canvases remain.', images: {}, canvasDraws: 0};
      window.__V038_TEXTURES__ = statistics;
      const original = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function(image, ...coordinates) {
        const source = image instanceof HTMLImageElement ? image.currentSrc || image.src : '';
        if (source) {
          const blocked = !!patterns[isolation]?.test(source);
          const item = statistics.images[source] ??= {attempted: 0, blocked: 0};
          item.attempted++;if (blocked) {item.blocked++;return;}
        } else statistics.canvasDraws++;
        return Reflect.apply(original, this, [image, ...coordinates]);
      };
    }, isolate);
    const createdBefore = Date.now();page = await context.newPage();const createdAfter = Date.now();
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack ?? error.message));
    page.on('response', response => {if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);});
    await page.goto(url);
    await page.locator(worldSelector).waitFor({timeout: 30000});
    await page.waitForFunction(() => !!window.__FUSION__);
    const build = await page.locator('.fu-build').innerText();
    const expected = source === 'old' ? baselineCommit : metadata.sourceCommit;
    if (!build.includes(expected.slice(0, 7)) || build.includes('dirty')) throw new Error(`Unexpected ${source} package build: ${build}, expected ${expected}`);
    const initial = await readArchive(page);
    return {name, context, page, engine, width, height, source, scale, isolate, fixtureAudit: fixture.audit,
      build, initial, errors, createdBefore, createdAfter, closed: false};
  } catch (error) {await context.close();throw error;}
}

async function close(session) {
  if (!session || session.closed) return;
  session.closed = true;
  const video = session.page.video();
  try {await session.context.close();} finally {
    if (video) session.raw = await video.path();
    report.errors.push(...session.errors.map(error => `${session.name}: ${error}`));
  }
}

function encode(file, args) {
  execFileSync('ffmpeg', ['-y', ...args, '-c:v', 'libx264', '-preset', 'fast', '-crf', '24',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart', `${output}/${file}`], {stdio: 'ignore'});
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'quiet', '-show_format', '-show_streams', '-of', 'json', `${output}/${file}`], {encoding: 'utf8'}));
  const entry = {file, probe};report.videos.push(entry);return entry;
}

function encodeOne(session, startAt, seconds, name) {
  const offset = Math.max(0, (startAt - session.createdAfter) / 1000);
  return {...encode(`${name}.mp4`, ['-i', session.raw, '-vf', `trim=start=${offset}:duration=${seconds},setpts=PTS-STARTPTS`, '-an']),
    source: session.name, startAt, durationSeconds: seconds, speed: 1,
    alignment: {method: 'Page creation timestamp estimate; native Playwright video, no browser clock overrides',
      pageCreatedBefore: session.createdBefore, pageCreatedAfter: session.createdAfter, leadInSeconds: offset}};
}

async function frameScreens() {
  for (const [engine, width, height] of layouts) {
    const browser = await ({chromium, webkit}[engine]).launch();
    try {
      for (const kind of ['unrevealed', 'partial', 'revealed', 'night']) {
        const at = Date.now() + 15000, fixture = feedbackFixture(kind, at);
        if (kind === 'night' && !fixture.state.journey.sites.every(site => site.revealedAt !== null)) throw new Error('Natural first-night fixture still has fog; inspect rather than fabricate a night fog archive');
        const entries = [];
        for (const scale of ['legacy', 'regional']) {
          let session;
          try {
            session = await open(browser, {name: `${engine}-${width}-${kind}-${scale}`, engine, width, height, fixture, scale});
            if (Date.now() >= at) throw new Error('Screenshot preparation exceeded the shared held-archive time');
            entries.push(await screenshot(session, session.name));
            report.cases.push({name: session.name, fixtureAudit: fixture.audit, heldUntil: at,
              build: session.build, initial: session.initial, errors: session.errors});
          } finally {await close(session);}
        }
        if (!same(entries[0].archive.journey, entries[1].archive.journey)
          || entries[0].archive.game.world.elapsedMs !== entries[1].archive.game.world.elapsedMs) throw new Error('Scale comparison did not use the same saved world');
      }
      for (const kind of ['jammed', 'building', 'cleared']) {
        let session;
        try {
          const fixture = feedbackFixture(kind, Date.now() + 15000);
          session = await open(browser, {name: `${engine}-${width}-sorting-${kind}`, engine, width, height, fixture});
          const scene = await screenshot(session, session.name);
          await session.page.locator('#fusion-wallet').tap();
          await session.page.locator('#fusion-drawer-body #fusion-open-sorting').tap();
          await session.page.locator('#fusion-sorting-cost').waitFor();
          const drawer = await screenshot(session, `${session.name}-ledger`);
          report.cases.push({name: session.name, fixtureAudit: fixture.audit, build: session.build,
            entityId: 'parcel/old-sorting', renderer: 'fusion/sorting-scene:refinement/sorting-machine',
            sceneFacilities: scene.diagnostics.facilities, sorting: drawer.archive.progression.sorting,
            displayedCost: await session.page.locator('#fusion-sorting-cost').innerText(), errors: session.errors});
        } finally {await close(session);}
      }
    } finally {await browser.close();}
  }
  const browser = await chromium.launch();
  try {
    const fixture = feedbackFixture('revealed', Date.now() + 15000);
    const comparison = [];
    for (const source of ['old', 'new']) {
      let session;
      try {
        session = await open(browser, {name: `${source}-revealed-machines-390`, fixture, source});
        if (Date.now() >= fixture.state.game.lastAt) throw new Error('Machine comparison exceeded its common held-archive time');
        await screenshot(session, session.name);
        comparison.push(session.initial);
        report.cases.push({name: session.name, source, build: session.build, fixtureAudit: fixture.audit,
          initial: session.initial, diagnostics: await diagnostics(session.page), errors: session.errors});
      } finally {await close(session);}
    }
    if (!same(gameArchive(comparison[0]), gameArchive(comparison[1]))) throw new Error('Old/new machine comparison archives differ');
    // Keep the baseline's original render sources measurable independently.
    for (const isolate of ['legacy-sorter', 'layered-sorter', 'robot']) {
      let session;
      try {
        const fixture = feedbackFixture('revealed', Date.now() + 15000);
        session = await open(browser, {name: `old-source-isolation-${isolate}-390`, fixture, source: 'old', isolate});
        const screen = await screenshot(session, session.name);
        const blocked = Object.entries(screen.diagnostics.textures.images).filter(([, counts]) => counts.blocked);
        if (!blocked.length) throw new Error(`Texture isolation did not match baseline source: ${isolate}`);
        report.cases.push({name: session.name, source: 'old', fixtureAudit: fixture.audit, build: session.build,
          textureIsolation: true, isolate, blocked, diagnostics: screen.diagnostics, errors: session.errors});
      } finally {await close(session);}
    }
  } finally {await browser.close();}
}

async function sample(page, startAt) {
  // Both the ledger and the drawn pose are read in one browser task. IDB is
  // authoritative for work/rewards; dataset is the last actual render call.
  return page.evaluate(({name, startAt}) => new Promise((resolve, reject) => {
    const request = indexedDB.open(name, 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result, get = db.transaction('archive', 'readonly').objectStore('archive').get('current');
      get.onerror = () => {db.close();reject(get.error);};
      get.onsuccess = () => {
        const saved = get.result, game = saved.game, canvas = document.querySelector('#fusion-world canvas');
        const wallAt = Date.now();
        const visual = canvas ? {...canvas.dataset} : {};
        db.close();resolve({wallAt, wallMs: wallAt - startAt, worldMs: game.world.elapsedMs, savedAt: game.lastAt,
          storageRevision: saved.storageRevision, cycles: game.cycles, cycleMs: game.cycleMs,
          accepted: game.assist?.actionSeq ?? 0, applied: game.assist?.appliedWorkMs ?? 0,
          enqueued: game.assist?.enqueuedWorkMs ?? 0, pending: game.assist?.pendingWorkMs ?? 0,
          balance: game.resources, grossIncome: game.station.grossIncome, repairSpent: game.station.repairSpent,
          discoveryAt: {...game.discoveryAt}, collection: [...game.collection],
          journey: saved.journey,
          robot: {workSeconds: visual.robotWorkSeconds ?? null, gaitFrame: visual.robotGaitFrame ?? null,
            scanAngle: visual.robotScanAngle ?? null, received: visual.robotReceived ?? null,
            action: visual.robotAnimationAction ?? visual.action ?? null,
            renderPasses: visual.robotRenderPasses ?? null, source: visual.robotRenderSource ?? null,
            appliedWorkMs: visual.robotAppliedWorkMs ?? null, assistRate: visual.robotAssistRate ?? null}, visual});
      };
    };
  }), {name: database, startAt});
}

async function sampleFor(session, startAt, durationMs, shots = []) {
  const trace = [], arrivals = [];let nextShot = 0;
  for (let scheduledMs = 0; scheduledMs <= durationMs; scheduledMs += 100) {
    await waitUntil(startAt + scheduledMs);
    const current = await sample(session.page, startAt), previous = trace.at(-1);
    current.scheduledMs = scheduledMs;trace.push(current);
    if (previous && current.cycles > previous.cycles) arrivals.push({wallMs: current.wallMs, worldMs: current.worldMs,
      cycles: current.cycles, increase: current.cycles - previous.cycles,
      grossIncrease: current.grossIncome - previous.grossIncome, balance: current.balance, discoveryAt: current.discoveryAt,
      note: 'Arrival observed from a persisted cycle increment, not an input effect'});
    if (nextShot < shots.length && current.wallMs >= shots[nextShot]) {
      await screenshot(session, `${session.name}-${String(shots[nextShot] / 1000).replace('.', '_')}s`);nextShot++;
    }
  }
  return {trace, arrivals, sampleIntervalMs: 100, firstSampleAt: trace[0].wallAt, lastSampleAt: trace.at(-1).wallAt};
}

async function terrainTap(session, startAt, scheduledMs) {
  await waitUntil(startAt + scheduledMs);
  const point = await session.page.evaluate(() => {
    const canvas = document.querySelector('#fusion-world canvas'), box = canvas.getBoundingClientRect(), api = window.__FUSION__;
    // Re-pick each event against the current rendered scene; avoid the robot,
    // residents, ship and all site textures, with a small contact safety margin.
    for (const [px, py] of [[416, 610], [460, 600], [380, 600], [420, 570], [350, 560], [390, 650]]) {
      const x = box.x + box.width * px / canvas.width, y = box.y + box.height * py / canvas.height;
      if ([[0,0],[-4,0],[4,0],[0,-4],[0,4]].every(([dx, dy]) => api.pickAtClient(x + dx, y + dy).kind === 'planet')) return {x, y, hit: api.pickAtClient(x, y)};
    }
    return null;
  });
  if (!point) throw new Error(`${session.name}: no visible terrain pixel for native input`);
  const before = await sample(session.page, startAt), actualAt = Date.now();
  await session.page.touchscreen.tap(point.x, point.y);
  if (await session.page.locator('#fusion-drawer[open]').count()) throw new Error(`${session.name}: terrain input opened an object drawer`);
  return {scheduledMs, actualMs: actualAt - startAt, ...point, acceptedBefore: before.accepted};
}

const burstTimes = [200, 550, 900, 1250, 1600, 12400, 12750, 13100, 13450, 13800, 24600, 24950, 25300, 25650, 26000];
async function nativeBursts(session, startAt) {
  const attempts = [];
  for (const time of burstTimes) attempts.push(await terrainTap(session, startAt, time));
  return attempts;
}

async function comparisons() {
  const browser = await chromium.launch();
  try {
    for (const configuration of [
      {name: 'new-idle-assist-360', width: 360, sources: ['new', 'new'], inputs: ['idle', 'assist']},
      {name: 'new-idle-assist-390', width: 390, sources: ['new', 'new'], inputs: ['idle', 'assist']},
      {name: 'old-new-assist-390', width: 390, sources: ['old', 'new'], inputs: ['assist', 'assist']},
    ]) {
      const startAt = Date.now() + 15000, fixture = feedbackFixture('unrevealed', startAt), sessions = [];
      let pair;
      try {
        // Only this pair's two contexts exist; other sizes run after finalization.
        for (let index = 0; index < 2; index++) sessions.push(await open(browser, {
          name: `${configuration.name}-${index === 0 ? 'left' : 'right'}`, width: configuration.width,
          height: configuration.width === 360 ? 800 : 844, fixture, source: configuration.sources[index], video: true}));
        if (Date.now() >= startAt) throw new Error('Comparison preparation exceeded its common future start');
        if (!same(gameArchive(sessions[0].initial), gameArchive(sessions[1].initial))) throw new Error('Comparison initial saved archives differ');
        for (const session of sessions) if (session.initial.game.world.elapsedMs !== 0 || session.initial.game.resources !== 120
          || session.initial.journey.seed !== 3801) throw new Error('Comparison did not hold the seed3801 initial world');
        for (const session of sessions) await screenshot(session, `${session.name}-held-start`);
        if (Date.now() >= startAt) throw new Error('Comparison start screenshots exceeded the common future start');
        const measurements = await Promise.all(sessions.map(async (session, index) => {
          const [measurement, attempts] = await Promise.all([
            sampleFor(session, startAt, 30000),
            configuration.inputs[index] === 'assist' ? nativeBursts(session, startAt) : Promise.resolve([]),
          ]);
          await screenshot(session, `${session.name}-end`);
          return {...measurement, attempts, input: configuration.inputs[index], source: session.source,
            name: session.name, build: session.build, initial: session.initial,
            final: await readArchive(session.page), diagnostics: await diagnostics(session.page), errors: session.errors};
        }));
        for (const measurement of measurements) {
          const assist = measurement.final.game.assist ?? {enqueuedWorkMs: 0, appliedWorkMs: 0, pendingWorkMs: 0, actionSeq: 0};
          if (Math.abs(assist.enqueuedWorkMs - assist.appliedWorkMs - assist.pendingWorkMs) > .01
            || assist.enqueuedWorkMs !== assist.actionSeq * 600 || assist.actionSeq > measurement.attempts.length) throw new Error('Actual assist ledger did not balance');
          if (measurement.input === 'idle' && assist.actionSeq !== 0) throw new Error('Idle arm accepted input');
          if (measurement.input === 'assist' && !assist.actionSeq) throw new Error('Native assist arm accepted no input');
          measurement.firstDiscoveryMs = measurement.final.game.discoveryAt.receipt - startAt;
          measurement.uniqueRewards = measurement.arrivals.map(({wallMs, cycles, increase, grossIncrease}) => ({wallMs, cycles, increase, grossIncrease}));
        }
        pair = {name: configuration.name, width: configuration.width, startAt, fixtureAudit: fixture.audit,
          inputScheduleMs: burstTimes, inputs: configuration.inputs, measurements,
          method: 'Same complete seed3801 archive and shared Date.now()+15s start; 100ms saved ledger plus actual render datasets. Native 30s 1x input; no clock overrides.'};
        report.cases.push(pair);
      } finally {for (const session of sessions) await close(session);}
      if (pair) {
        const filter = sessions.map((session, index) => `[${index}:v]trim=start=${Math.max(0, (startAt - session.createdAfter) / 1000)}:duration=30,setpts=PTS-STARTPTS[v${index}]`).join(';')
          + ';[v0][v1]hstack=inputs=2[out]';
        pair.video = {...encode(`${configuration.name}-30s.mp4`, ['-i', sessions[0].raw, '-i', sessions[1].raw, '-filter_complex', filter, '-map', '[out]', '-an']),
          speed: 1, left: configuration.inputs[0], right: configuration.inputs[1],
          alignment: sessions.map(session => ({name: session.name, pageCreatedBefore: session.createdBefore,
            pageCreatedAfter: session.createdAfter, trimLeadInSeconds: (startAt - session.createdAfter) / 1000})),
          alignmentNote: 'Lead-in estimated from each page creation timestamp bracket; actual ledger uses engine wall timestamps.'};
        console.log(`captured ${configuration.name}`);
      }
    }
  } finally {await browser.close();}
}

function persistence(before, after) {
  const registration = state => ({seed: state.journey.seed, sites: state.journey.sites.map(({id, anchor, variant}) => ({id, anchor, variant}))});
  const result = {registrationStable: same(registration(before), registration(after)),
    revealStable: before.journey.sites.every(site => {
      const next = after.journey.sites.find(candidate => candidate.id === site.id);
      return next.progress >= site.progress && (site.revealedAt === null || site.revealedAt === next.revealedAt);
    }), collectionRetained: before.game.collection.every(id => after.game.collection.includes(id)),
    timeContinued: after.game.lastAt >= before.game.lastAt && after.game.world.elapsedMs >= before.game.world.elapsedMs,
    cyclesContinued: after.game.cycles >= before.game.cycles,
    constructionPaymentStable: after.progression.sorting.paidCost === before.progression.sorting.paidCost};
  if (Object.values(result).some(value => !value)) throw new Error(`Refresh persistence failed: ${JSON.stringify(result)}`);
  return result;
}

async function worlds() {
  const browser = await chromium.launch();
  try {
    for (const {kind, seconds, shots} of [
      {kind: 'unrevealed', seconds: 45, shots: [0, 8000, 10500, 12000, 18000, 24000, 34000, 36500, 40000, 44500]},
      {kind: 'night', seconds: 70, shots: [0, 8000, 19000, 32000, 47000, 54000, 60000, 69000]},
    ]) {
      const startAt = Date.now() + 15000, fixture = feedbackFixture(kind, startAt);let session, entry;
      try {
        session = await open(browser, {name: kind === 'night' ? 'night-morning-70s' : 'surface-dissolve-45s', fixture, video: true});
        if (Date.now() >= startAt) throw new Error('World recording preparation exceeded held archive time');
        const measurement = await sampleFor(session, startAt, seconds * 1000, shots);
        const beforeRefresh = await readArchive(session.page);
        await session.page.reload();await session.page.locator(worldSelector).waitFor();
        const afterRefresh = await readArchive(session.page);
        const persisted = persistence(beforeRefresh, afterRefresh);
        await screenshot(session, `${session.name}-same-archive-refresh`);
        entry = {name: session.name, startAt, seconds, fixtureAudit: fixture.audit, build: session.build,
          playerFixture: true, naturalTime: true, measurement, beforeRefresh, afterRefresh, persistence: persisted,
          note: kind === 'night' ? 'Supplied real-model fixture begins at world246000ms: the remaining first-night events and dawn continue naturally; its earlier reveals stay earned.'
            : 'Fresh seed3801 archive naturally explores and dissolves its real sites without input or time overrides.',
          diagnostics: await diagnostics(session.page), errors: session.errors};
        if (kind === 'unrevealed' && !beforeRefresh.journey.sites.every(site => site.revealedAt !== null)) throw new Error('The 45s recording did not naturally clear all three fog sites');
        report.cases.push(entry);
      } finally {await close(session);}
      if (entry) {entry.video = encodeOne(session, startAt, seconds, entry.name);console.log(`captured ${entry.name}`);}
    }
  } finally {await browser.close();}
}

try {
  if (mode === 'screens') await frameScreens();
  if (mode === 'compare') await comparisons();
  if (mode === 'world') await worlds();
} catch (error) {report.errors.push(error.stack ?? String(error));process.exitCode = 1;console.error(error);}
finally {
  await writeFile(`${output}/${mode}-evidence.json`, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({mode, cases: report.cases.length, screenshots: report.screenshots.length,
    videos: report.videos.length, errors: report.errors.length, sourceCommit: report.sourceCommit}));
}
if (report.errors.length) process.exitCode = 1;
