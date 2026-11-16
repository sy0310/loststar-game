/* Real-time recordings in fresh browser profiles. No production game code is patched. */
const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { steer } = require('../../prototypes/salvage-survivor-demo/tests/capture-v065.cjs');

const root = path.resolve(__dirname, '../..');
const privateDir = path.join(root, 'releases/taptap-promo-v1-private');
const runtime = JSON.parse(fs.readFileSync(path.join(privateDir, 'runtime-source.json')));
const url = process.env.PROMO_URL || 'http://127.0.0.1:4472/';
const rehearsal = process.argv.includes('--rehearse');
const scene = process.argv.find(value => value.startsWith('--scene='))?.split('=')[1] || 'natural';
const durations = { natural: 180, evolution: 14, fusion: 22, climax: 45 };
assert(Object.hasOwn(durations, scene));
const seconds = rehearsal ? 7 : Number(process.env.PROMO_CAPTURE_SECONDS || durations[scene]);
const out = path.join(privateDir, rehearsal ? 'rehearsal-' + scene : scene);
fs.mkdirSync(out, { recursive: true });

async function fixture(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(url + '?qa=1');
  await page.waitForFunction(() => SurvivorDemo.ready());
  const result = await page.evaluate(scene => {
    const Q = SurvivorQA;
    const g = Q.startModel(87);
    function pick(id) {
      if (!Q.pick(id)) throw Error('Illegal equipment preparation ' + id);
    }
    function rank(id, level) {
      while ((g.active[id] || g.passive[id] || 0) < level) pick(id);
    }
    function reward(id) {
      // Choose an ordinary successful random reward checkpoint. No forced-roll API.
      for (let attempt = 0; attempt < 16; attempt++) {
        Q.reward();
        if (Q.options().some(option => option.id === id)) return;
        g.mode = 'play';
      }
      throw Error('No legal random reward offered for ' + id);
    }
    function evolve(w, p, e) {
      rank(w, 5); rank(p, 5); reward(e); pick(e);
    }
    evolve('drone', 'lock', 'hunterswarm');
    rank('arc', 5); rank('capacitor', 5);
    if (scene !== 'evolution') {
      reward('chainstorm'); pick('chainstorm');
    }
    if (scene === 'climax') {
      reward('thunderhive'); pick('thunderhive');
      evolve('prism', 'refraction', 'kaleidoscope');
      evolve('gravity', 'singularity', 'collapse');
      reward('eventhorizon'); pick('eventhorizon');
      rank('cannon', 4); rank('blade', 4); rank('missile', 4);
    } else {
      rank('cannon', 3); rank('prism', 3); rank('blade', 3);
    }
    const expectedLevel = 1 + g.metrics.events.filter(e =>
      ['active', 'passive', 'evo', 'fusion'].includes(e.kind)).length;
    while (g.level < expectedLevel) Q.level();
    g.time = scene === 'evolution' ? 630 : 705;
    g.spawnTime = 0;
    g.encounters.schedule = g.encounters.schedule.filter(e => e.at > g.time);
    g.anomalySeen = true;
    g.milestoneSeen = SurvivorBalance.showcase.milestones.filter(m => m.at <= g.time)
      .map(m => m.type + ':' + m.at);
    g.presented = [];
    g.upgradeSource = null;
    g.celebration = null;
    g.p.inv = 0;
    g.mode = 'pause';
    if (scene !== 'climax') reward(scene === 'evolution' ? 'chainstorm' : 'thunderhive');
    const snapshot = Q.snapshot();
    Q.validate(snapshot);
    return { snapshot, scope: 'Prepared legal equipment and elapsed-time checkpoint. Normal damage, HP, spawns, motion and controller. No invincibility, target dummies or forced damage.' };
  }, scene);
  await context.close();
  return result;
}

async function recordAudio(page, file) {
  fs.writeFileSync(file, Buffer.alloc(0));
  await page.exposeFunction('writePromoAudio', data =>
    fs.promises.appendFile(file, Buffer.from(data, 'base64')));
  await page.evaluate(() => {
    const stream = SurvivorAudio.recordingStream();
    if (!stream?.getAudioTracks().length) throw Error('Game audio output missing');
    window.promoWrites = Promise.resolve();
    window.promoAudioDone = false;
    window.promoAudio = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    promoAudio.ondataavailable = event => {
      if (!event.data.size) return;
      promoWrites = promoWrites.then(async () => {
        const data = new Uint8Array(await event.data.arrayBuffer());
        let binary = '';
        for (let i = 0; i < data.length; i += 16384)
          binary += String.fromCharCode(...data.subarray(i, i + 16384));
        await writePromoAudio(btoa(binary));
      });
    };
    promoAudio.onstop = () => promoWrites.then(() => { window.promoAudioDone = true; });
    promoAudio.start(400);
  });
}

(async () => {
  const browser = await chromium.launch();
  const report = { scene, rehearsal, source: runtime.sourceCommit, samples: [], choices: [], errors: [],
    origin: scene === 'natural' ? 'New ordinary game, no QA, no perks, no imported state' : 'Advanced loadout demonstration',
    playbackSpeed: 1, invincibility: false, gameDamageEdits: false, enemyEdits: false };
  try {
    const prepared = scene === 'natural' ? null : await fixture(browser);
    if (prepared) {
      report.preparation = prepared;
      fs.writeFileSync(path.join(out, 'checkpoint.json'), JSON.stringify(prepared.snapshot));
    }
    const options = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true };
    if (!rehearsal) options.recordVideo = { dir: path.join(out, 'raw'), size: { width: 390, height: 844 } };
    const context = await browser.newContext(options);
    const page = await context.newPage();
    const pageStarted = Date.now();
    page.on('pageerror', error => report.errors.push(String(error)));
    await page.goto(url);
    await page.waitForFunction(() => SurvivorDemo.ready());
    assert(await page.evaluate(() => !window.SurvivorQA));
    assert.equal(await page.evaluate(() => SurvivorBuild.commit), runtime.sourceCommit);
    report.discovery = await page.locator('button').evaluateAll(elements => elements
      .filter(e => e.offsetParent).map(e => ({ id: e.id, text: e.textContent.trim() })));
    if (prepared) {
      await page.evaluate(async snapshot => {
        const store = await SurvivorPersistence.create();
        await store.begin('promo-' + crypto.randomUUID(), snapshot);
        store.close();
      }, prepared.snapshot);
      await page.reload();
      await page.waitForFunction(() => SurvivorDemo.ready());
    }
    // Only the music bus is muted, preserving the actual game SFX bus.
    await page.evaluate(() => SurvivorAudio.configure({ music: 0, master: 0.9, sfx: 0.65, muted: false }));
    const entry = page.locator(prepared ? '#continueBtn' : '#startBtn');
    await entry.waitFor({ state: 'visible' });
    await entry.tap();
    await page.waitForFunction(() => !SurvivorDemo.saving());
    await page.evaluate(() => SurvivorAudio.configure({ music: 0, master: 0.9, sfx: 0.65, muted: false }));
    report.initial = await page.evaluate(() => SurvivorDemo.state());
    if (!rehearsal) await recordAudio(page, path.join(out, 'game-sfx.webm'));
    report.recordingStartedWallMs = Date.now() - pageStarted;
    let held = false;
    let previous = -1;
    let directionX = 1;
    let directionY = 0;
    let knownMode = null;
    let cardSince = 0;
    let loggedCards = false;
    const started = Date.now();
    while (Date.now() - started < seconds * 1000) {
      const g = await page.evaluate(() => SurvivorDemo.state());
      if (g.mode === 'results') throw Error('Defeat interrupted ' + scene);
      if (g.mode !== knownMode) { knownMode = g.mode; cardSince = Date.now(); loggedCards = false; }
      if (g.mode === 'upgrade') {
        if (held) await page.mouse.up();
        held = false;
        const cards = page.locator('.skill');
        if (!loggedCards) {
          report.choices.push({ wallSecond: (Date.now() - started) / 1000, gameTime: g.time,
            offered: await cards.allTextContents(), source: g.upgradeSource });
          loggedCards = true;
        }
        if (Date.now() - cardSince > 2100) {
          let selection = cards.first();
          const target = scene === 'evolution' ? '星链雷网' : scene === 'fusion' ? '雷暴蜂群' : null;
          if (target && await cards.filter({ hasText: target }).count()) selection = cards.filter({ hasText: target }).first();
          if (scene === 'natural') {
            for (const name of ['电弧线圈', '护航无人机', '脉冲主炮', '折跃棱镜', '回收磁场']) {
              if (await cards.filter({ hasText: name }).count()) { selection = cards.filter({ hasText: name }).first(); break; }
            }
          }
          report.choices.at(-1).selected = await selection.textContent();
          await selection.tap();
        }
      } else if (g.mode === 'play') {
        if (!held) { await page.mouse.move(302, 736); await page.mouse.down(); held = true; }
        previous = steer(g, previous, true);
        const angle = previous * Math.PI / 4;
        directionX = directionX * .3 + Math.cos(angle) * .7;
        directionY = directionY * .3 + Math.sin(angle) * .7;
        const length = Math.hypot(directionX, directionY) || 1;
        await page.mouse.move(302 + directionX / length * 45, 736 + directionY / length * 45, { steps: 4 });
      }
      report.samples.push({ second: (Date.now() - started) / 1000, time: g.time, x: g.p.x, y: g.p.y,
        mode: g.mode, hp: g.p.hp, inv: g.p.inv, kills: g.kills, enemies: g.enemy.length,
        activeInput: g.input.active, active: g.active, evolved: g.evolved, fused: g.fused,
        damage: g.metrics.damage });
      await page.waitForTimeout(150);
    }
    report.recordingEndedWallMs = Date.now() - pageStarted;
    report.final = await page.evaluate(() => SurvivorDemo.state());
    if (!rehearsal) {
      await page.evaluate(() => promoAudio.stop());
      await page.waitForFunction(() => promoAudioDone);
    }
    report.audio = await page.evaluate(() => SurvivorAudio.inspect());
    await page.screenshot({ path: path.join(out, 'end.png') });
    if (held) await page.mouse.up();
    report.contextCloseWallMs = Date.now() - pageStarted;
    const video = page.video();
    await context.close();
    if (video) await video.saveAs(path.join(out, 'raw-page.webm'));
    assert.deepEqual(report.errors, []);
    assert(report.final.kills > report.initial.kills || scene === 'evolution');
    fs.writeFileSync(path.join(out, 'capture.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ scene, rehearsal, seconds, kills: report.final.kills - report.initial.kills,
      hp: report.final.p.hp, level: report.final.level, choices: report.choices.length, out }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
