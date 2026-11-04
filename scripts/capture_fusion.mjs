import {chromium, webkit} from '@playwright/test';
import {mkdirSync, writeFileSync, readFileSync, unlinkSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {captureFixture} from '../releases/fusion-capture/fusion_capture_fixtures.js';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:4207';
const output = process.env.OUTPUT_DIR ?? 'artifacts/fusion';
mkdirSync(output, {recursive: true});
mkdirSync(`${output}/raw`, {recursive: true});
const source = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
const browser = await chromium.launch();
const entries = [];
const errors = [];
const shots = [];
const videos = [];
async function state(page) {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('loststar.fusion.v1', 1);
    request.onerror = () => reject(String(request.error));
    request.onsuccess = () => {
      const db = request.result;
      const get = db.transaction('archive', 'readonly').objectStore('archive').get('current');
      get.onsuccess = () => {resolve(get.result);db.close();};
    };
  }));
}
async function open(name, fixture, engine = browser, width = 390, record = true) {
  const context = await engine.newContext({viewport: {width, height: width === 360 ? 800 : 844}, deviceScaleFactor: 1,
    isMobile: true, hasTouch: true, ...(record ? {recordVideo: {dir: `${output}/raw`, size: {width, height: 844}}} : {})});
  if (fixture) {
    const seed = await context.newPage();
    await seed.route('**/*.js', route => route.abort());
    await seed.goto(base, {waitUntil: 'domcontentloaded'});
    const value = captureFixture(fixture, Date.now());
    await seed.evaluate(value => new Promise((resolve, reject) => {
      const request = indexedDB.open('loststar.fusion.v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('archive');
      request.onerror = () => reject(String(request.error));
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('archive', 'readwrite');
        tx.objectStore('archive').put(value, 'current');
        tx.oncomplete = () => {db.close();resolve();};
        tx.onerror = () => reject(String(tx.error));
      };
    }), value);
    const unused = record ? await seed.video().path() : null;
    await seed.close();
    if (unused) try {unlinkSync(unused);} catch {}
  }
  const page = await context.newPage();
  const localErrors = [];
  page.on('pageerror', error => localErrors.push(error.message));
  page.on('response', response => {if(response.status() >= 400) localErrors.push(`${response.status()} ${response.url()}`);});
  await page.goto(base);
  await page.locator('#fusion-world canvas[data-ready="true"]').waitFor();
  const build = await page.locator('.fu-build').textContent();
  const started = Date.now();
  async function shot(label) {
    await page.screenshot({path: `${output}/${label}.png`});
    shots.push({file: `${label}.png`, width, height: width === 360 ? 800 : 844, at: Date.now() - started, context: name});
  }
  async function close(videoName) {
    const saved = await state(page);
    const original = await page.evaluate(() => localStorage.getItem('loststar.save.v1'));
    const raw = record ? await page.video().path() : null;
    entries.push({name, fixture: fixture ?? 'fresh new player', engine: engine === browser ? 'chromium' : 'webkit', width,
      build, wallMs: Date.now() - started, worldMs: saved.game.world.elapsedMs, balance: saved.game.resources,
      transactions: saved.receipt.transactions, projects: saved.projects, records: saved.records,
      assist: saved.game.assist, originalSave: original, errors: localErrors});
    errors.push(...localErrors);
    await context.close();
    if (raw && videoName) videos.push({raw, file: `${videoName}.mp4`, context: name});
  }
  return {page, shot, close, started};
}
async function click(page, selector) {
  const element = page.locator(selector);
  await element.scrollIntoViewIfNeeded();
  await element.tap();
  await page.waitForTimeout(180);
}
async function fresh() {
  const {page, shot, close} = await open('fresh', null);
  await shot('390-explore');
  await click(page, '#fusion-tap');
  await page.waitForTimeout(350);await click(page, '#fusion-tap');
  await shot('390-assist');
  await click(page, '#fusion-upgrades');await shot('390-upgrades-before');
  await click(page, '[data-upgrade="scanner"]');await shot('390-upgrades-after');
  await click(page, '#fusion-close');
  await page.waitForTimeout(11000);await shot('390-first-discovery');
  await click(page, '[data-tab="collection"]');await shot('390-collection-first');
  await click(page, '#fusion-collection-list [data-detail="receipt"]');await shot('390-receipt-soil');
  await click(page, '#fusion-paper-primary');await page.waitForTimeout(6800);await shot('390-receipt-dirty');
  await click(page, '#fusion-paper-primary');await page.waitForTimeout(4300);await shot('390-receipt-clean');
  await click(page, '#fusion-close');await click(page, '[data-tab="explore"]');
  await close('exploration-upgrade-live');
}
async function paper() {
  const {page, shot, close} = await open('paper-lifecycle', 'paper');
  await click(page, '[data-tab="collection"]');
  await click(page, '#fusion-collection-list [data-detail="receipt"]');await shot('receipt-s0');
  await click(page, '#fusion-paper-primary');await page.waitForTimeout(3200);await shot('receipt-excavation');
  await page.waitForTimeout(3600);await shot('receipt-found');
  await click(page, '#fusion-paper-primary');await page.waitForTimeout(2000);await shot('receipt-brush');
  await page.waitForTimeout(2300);await shot('receipt-s1');
  await click(page, '#fusion-paper-primary');await page.waitForTimeout(2100);await shot('receipt-patching');
  await page.waitForTimeout(2300);await shot('receipt-s2');
  if ((await page.locator('#fusion-paper-primary').getAttribute('data-kind')) === 'identify') {
    await click(page, '#fusion-paper-primary');await page.waitForTimeout(3000);await shot('receipt-evidence');
  }
  await click(page, '#fusion-try');await page.waitForTimeout(1100);await shot('receipt-try');
  await close('receipt-restoration-live');
}
async function night(kind) {
  const {page, shot, close, started} = await open(kind, kind);
  const times = [1000, 8000, 14500, 28500, 33500, 45500, 53000, 60000, 65000, 69000];
  for (const at of times) {
    await page.waitForTimeout(Math.max(0, started + at - Date.now()));
    await shot(`${kind}-${at / 1000}`);
  }
  await click(page, '[data-tab="base"]');await click(page, '[data-drawer="station"]');await shot(`${kind}-receipt`);
  await close(`${kind}-live`);
}
async function fullCycle() {
  const {page, shot, close, started} = await open('full-cycle', null);
  for (const at of [1000, 60000, 229000, 240500, 254000, 269000, 287000, 301000, 307000, 310000]) {
    await page.waitForTimeout(Math.max(0, started + at - Date.now()));
    await shot(`cycle-${at / 1000}`);
  }
  await close('day-night-cycle-live');
}
async function baseAndProjects() {
  const {page, shot, close} = await open('base-projects', 'base');
  await click(page, '[data-tab="base"]');await shot('390-base');
  await page.waitForTimeout(15000);await shot('390-robot-next-case');
  await click(page, '[data-tab="collection"]');await shot('390-collection');
  for (const id of ['receipt', 'tape', 'nested', 'stamp', 'cosmic-parcel', 'bell']) {
    await click(page, `#fusion-collection-list [data-detail="${id}"]`);await page.waitForTimeout(250);await shot(`closeup-${id}`);
    await click(page, '#fusion-close');
  }
  await click(page, '[data-tab="base"]');await click(page, '[data-drawer="research"]');await shot('390-research');
  await click(page, '[data-task="residents"]');await shot('390-research-active');
  await page.waitForTimeout(1500);await click(page, '[data-cancel-task]');await shot('390-research-cancel');
  await click(page, '#fusion-close');await click(page, '[data-drawer="build"]');await shot('390-workshop');
  for (const id of ['evidence-bench', 'habitat-window', 'archive']) {
    await click(page, `[data-project="${id}"]`);await page.waitForTimeout(250);await shot(`project-${id}`);
    if (id === 'evidence-bench') {await click(page, '[data-light="side"]');await shot('project-side-light');}
    await click(page, '#fusion-close');await click(page, '[data-drawer="build"]');
  }
  await click(page, '#fusion-close');await click(page, '#fusion-map');await shot('390-radar');
  await close('museum-projects-live');
}
async function caseUpgrades() {
  const {page, shot, close} = await open('paid-case-tiers', 'base');
  await click(page, '[data-tab="base"]');await shot('cases-paid-tier0');
  for (let tier = 1; tier <= 3; tier++) {
    await click(page, '[data-drawer="build"]');
    for (let index = 0; index < 6; index++) {
      await page.locator('summary', {hasText: '展柜'}).tap();
      await click(page, `[data-growth="case-${index}"]`);
      await page.locator('#fusion-case-preview[data-ready="true"]').waitFor();
      if (index === 0 || index === 1) {
        await click(page, `[data-case-preview="${tier - 1}"]`);await shot(`case-${index}-tier${tier}-before`);
        await click(page, `[data-case-preview="${tier}"]`);await shot(`case-${index}-tier${tier}-after`);
      }
      await click(page, '#fusion-return-build');
    }
    await click(page, '#fusion-close');await shot(`cases-paid-tier${tier}`);
  }
  await close('case-upgrades-live');
}
async function archive() {
  const {page, shot, close} = await open('actual-night-replay', 'base');
  await click(page, '[data-tab="base"]');await click(page, '[data-drawer="build"]');
  await click(page, '[data-project="archive"]');await click(page, '#fusion-replay-night');
  await page.locator('#fusion-archive-replay canvas[data-ready="true"]').waitFor();
  await page.waitForTimeout(5500);await shot('archive-replay-5');
  await page.waitForTimeout(20000);await shot('archive-replay-25');
  await page.waitForTimeout(34000);await shot('archive-replay-59');
  await close('archive-replay-live');
}
async function curio(id) {
  const {page, shot, close} = await open(`curio-${id}`, 'paper');
  await click(page, '[data-tab="collection"]');await click(page, `#fusion-collection-list [data-detail="${id}"]`);
  await shot(`curio-${id}-found`);
  await click(page, '#fusion-curio-primary');await page.waitForTimeout(1300);await shot(`curio-${id}-cleaning`);
  await page.waitForTimeout(2200);await shot(`curio-${id}-clean`);
  await click(page, '#fusion-curio-primary');await page.waitForTimeout(1400);await shot(`curio-${id}-repairing`);
  await page.waitForTimeout(2100);await shot(`curio-${id}-repaired`);
  await click(page, '#fusion-try');await page.waitForTimeout(700);await shot(`curio-${id}-interaction`);
  await close(`curio-${id}-live`);
}
try {
  await Promise.all([fresh(), paper(), night('night-basic'), night('night-strong'), fullCycle(), baseAndProjects()]);
  await Promise.all([caseUpgrades(), archive()]);
  for (const id of ['tape', 'nested', 'stamp', 'cosmic-parcel', 'bell']) await curio(id);
  const wk = await webkit.launch();
  for (const engine of [browser, wk]) for (const width of [360, 390]) {
    const {page, shot, close} = await open(`compat-${engine === browser ? 'chromium' : 'webkit'}-${width}`, 'base', engine, width, false);
    await shot(`${width}-${engine === browser ? 'chromium' : 'webkit'}-explore`);
    await click(page, '[data-tab="base"]');await shot(`${width}-${engine === browser ? 'chromium' : 'webkit'}-base`);
    await close();
  }
  await wk.close();
  for (const video of videos) {
    const target = `${output}/${video.file}`;
    execFileSync('ffmpeg', ['-y', '-i', video.raw, '-c:v', 'libx264', '-preset', 'fast', '-crf', '25', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', target], {stdio: 'ignore'});
    video.probe = JSON.parse(execFileSync('ffprobe', ['-v', 'quiet', '-show_format', '-show_streams', '-of', 'json', target], {encoding: 'utf8'}));
    video.bytes = readFileSync(target).length;
  }
  writeFileSync(`${output}/recordings.json`, JSON.stringify({sourceCommit: source, base, at: new Date().toISOString(), method: 'Real wall-clock, 1x playback, native-touch desktop emulation. Fresh contexts have no seeded state. Configured paper is actual engine16-minute progress; other configured scenes use explicit legacy rights/guard states. No simulation clock injection during recording.', entries, shots, videos, errors}, null, 2)+'\n');
  if (errors.length) throw new Error(JSON.stringify(errors));
  console.log(JSON.stringify({source, screenshots: shots.length, videos: videos.length, errors: errors.length}));
} finally {await browser.close();}
