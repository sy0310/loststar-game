const { chromium } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = process.cwd();
const { steer } = require(path.join(root, 'prototypes/salvage-survivor-demo/tests/capture-v065.cjs'));
const rehearsal = process.argv.includes('--rehearse');
const seconds = rehearsal ? 15 : 60;
const output = path.resolve(process.env.ACTIVE_VIDEO_OUT || path.join(root, 'releases/survivor-v0610-private/active-video', rehearsal ? 'rehearsal' : 'recording'));
const url = process.env.SURVIVOR_URL || 'http://127.0.0.1:4283/';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch();
  const report = {
    scope: 'Prepared legal late-game equipment and clock checkpoint, resumed through ordinary player UI in an isolated browser profile. Actual continuous pointer steering, normal spawning, damage, enemies, audio and rewards. This is a loadout demonstration, not a natural-progression record or physical-phone recording.',
    preparation: { elapsedSeconds: 705, seed: 87, perkPurchases: false, invincibility: false, enemyEdits: false, damageOrSpeedEdits: false },
    rehearsal,
    samples: [],
    choices: [],
    errors: [],
  };
  try {
    const prepare = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const setup = await prepare.newPage();
    await setup.goto(url + '?qa=1');
    await setup.waitForFunction(() => SurvivorDemo.ready());
    report.source = await setup.evaluate(() => SurvivorBuild);
    assert.equal(report.source.commit, 'ea26e29d3061542913e7a587a1fe6cc889250d33');
    const snapshot = await setup.evaluate(() => {
      const Q = SurvivorQA;
      const g = Q.startModel(87);
      function pick(id) {
        if (!Q.pick(id)) throw Error('Illegal preparation ' + id);
      }
      function rank(id, level) {
        while ((g.active[id] || g.passive[id] || 0) < level) pick(id);
      }
      function evolve(weapon, support, result) {
        rank(weapon, 5);
        rank(support, 5);
        Q.reward(true);
        pick(result);
      }
      evolve('arc', 'capacitor', 'chainstorm');
      evolve('drone', 'lock', 'hunterswarm');
      Q.reward(true);
      pick('thunderhive');
      for (const id of ['cannon', 'prism', 'blade', 'missile']) rank(id, 3);
      const earnedLevels = 1 + g.metrics.events.filter((e) => ['active', 'passive', 'evo', 'fusion'].includes(e.kind)).length;
      while (g.level < earnedLevels) Q.level();
      g.time = 705;
      g.spawnTime = 0;
      g.anomalySeen = true;
      g.encounters.schedule = g.encounters.schedule.filter((event) => event.at > g.time);
      g.milestoneSeen = SurvivorBalance.showcase.milestones.filter((m) => m.at <= g.time).map((m) => m.type + ':' + m.at);
      g.mode = 'pause';
      g.presented = [];
      g.upgradeSource = null;
      g.celebration = null;
      g.p.inv = 0;
      const saved = Q.snapshot();
      Q.validate(saved);
      return saved;
    });
    fs.writeFileSync(path.join(output, 'prepared-checkpoint.json'), JSON.stringify(snapshot, null, 2));
    await prepare.close();

    const contextOptions = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true };
    if (!rehearsal) contextOptions.recordVideo = { dir: path.join(output, 'raw'), size: { width: 390, height: 844 } };
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();
    const pageStart = Date.now();
    page.on('pageerror', (error) => report.errors.push(String(error)));
    await page.goto(url);
    await page.waitForFunction(() => SurvivorDemo.ready());
    assert(await page.evaluate(() => !window.SurvivorQA));
    report.discovery = await page.locator('button').evaluateAll((buttons) => buttons.filter((b) => b.offsetParent).map((b) => ({ id: b.id, text: b.textContent.trim() })));
    await page.evaluate(async (saved) => {
      const store = await SurvivorPersistence.create();
      await store.begin('active-video-' + crypto.randomUUID(), saved);
      store.close();
    }, snapshot);
    await page.reload();
    await page.waitForFunction(() => SurvivorDemo.ready());
    await page.locator('#continueBtn').tap();
    await page.waitForFunction(() => SurvivorDemo.state()?.mode === 'play' && !SurvivorDemo.saving());

    let held = false;
    let previous = -1;
    let dx = 1;
    let dy = 0;
    async function drive() {
      const game = await page.evaluate(() => SurvivorDemo.state());
      if (game.mode === 'results') throw Error('Capture ended in defeat before requested duration');
      if (game.mode === 'upgrade') {
        if (held) await page.mouse.up();
        held = false;
        const cards = page.locator('.skill');
        const texts = await cards.allTextContents();
        report.choices.push({ at: game.time, offered: texts, selected: texts[0] });
        await sleep(1600);
        await cards.first().tap();
        return;
      }
      if (!held) {
        await page.mouse.move(305, 735);
        await page.mouse.down();
        held = true;
      }
      previous = steer(game, previous, true);
      const angle = previous * Math.PI / 4;
      dx = dx * 0.35 + Math.cos(angle) * 0.65;
      dy = dy * 0.35 + Math.sin(angle) * 0.65;
      const magnitude = Math.hypot(dx, dy) || 1;
      await page.mouse.move(305 + dx / magnitude * 44, 735 + dy / magnitude * 44, { steps: 5 });
      report.samples.push({ wallMs: Date.now() - pageStart, at: game.time, x: game.p.x, y: game.p.y, hp: game.p.hp, kills: game.kills, enemies: game.enemy.length, shots: game.enemyShots.length, direction: previous, inputActive: game.input.active, active: game.active, damage: game.metrics.damage });
    }

    const warmup = Date.now();
    while (Date.now() - warmup < 7000) { await drive(); await sleep(160); }
    report.initial = await page.evaluate(() => SurvivorDemo.state());
    assert(report.initial.input.active);
    assert(report.initial.enemy.length > 0);
    report.recordingStartedWallMs = Date.now() - pageStart;
    const audioFile = path.join(output, 'actual-output-audio.webm');
    if (!rehearsal) {
      fs.writeFileSync(audioFile, Buffer.alloc(0));
      await page.exposeFunction('saveRecordedAudio', (chunk) => fs.promises.appendFile(audioFile, Buffer.from(chunk, 'base64')));
      await page.evaluate(() => {
        const stream = SurvivorAudio.recordingStream();
        if (!stream?.getAudioTracks().length) throw Error('Actual game output audio unavailable');
        window.activeVideoWrites = Promise.resolve();
        window.activeVideoDone = false;
        window.activeAudioRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 });
        activeAudioRecorder.ondataavailable = (event) => {
          if (!event.data.size) return;
          activeVideoWrites = activeVideoWrites.then(async () => {
            const bytes = new Uint8Array(await event.data.arrayBuffer());
            let text = '';
            for (let i = 0; i < bytes.length; i += 16384) text += String.fromCharCode(...bytes.subarray(i, i + 16384));
            await saveRecordedAudio(btoa(text));
          });
        };
        activeAudioRecorder.onstop = () => activeVideoWrites.then(() => { window.activeVideoDone = true; });
        activeAudioRecorder.start(400);
      });
    }
    const started = Date.now();
    while (Date.now() - started < seconds * 1000) {
      await drive();
      await sleep(160);
    }
    report.recordingEndedWallMs = Date.now() - pageStart;
    report.final = await page.evaluate(() => SurvivorDemo.state());
    if (!rehearsal) {
      await page.evaluate(() => activeAudioRecorder.stop());
      await page.waitForFunction(() => activeVideoDone);
    }
    await page.screenshot({ path: path.join(output, 'actual-end-frame.png') });
    let travelled = 0;
    for (let i = 1; i < report.samples.length; i++) travelled += Math.hypot(report.samples[i].x - report.samples[i - 1].x, report.samples[i].y - report.samples[i - 1].y);
    report.travelledWorldPixels = travelled;
    report.distinctSteeringDirections = [...new Set(report.samples.map((s) => s.direction))];
    assert(travelled > (rehearsal ? 700 : 2500));
    assert(report.distinctSteeringDirections.length >= 4);
    assert.equal(report.final.mode, 'play');
    assert(report.final.kills > report.initial.kills);
    assert.deepEqual(report.errors, []);
    if (held) await page.mouse.up();
    report.contextCloseWallMs = Date.now() - pageStart;
    const video = page.video();
    await context.close();
    if (video) await video.saveAs(path.join(output, 'whole-ui-original.webm'));
    fs.writeFileSync(path.join(output, 'capture.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ rehearsal, source: report.source, seconds: (report.recordingEndedWallMs - report.recordingStartedWallMs) / 1000, travelledWorldPixels: travelled, directions: report.distinctSteeringDirections, kills: report.final.kills - report.initial.kills, health: report.final.p.hp, path: output }));
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
