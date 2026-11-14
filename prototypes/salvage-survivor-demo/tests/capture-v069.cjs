/* Labelled QA recordings of actual UI, persistent counters and live combat. */
const { chromium } = require("@playwright/test");
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const out = path.resolve(
  process.env.SURVIVOR_CAPTURE_OUT || "releases/survivor-v069-capture",
);
const url = process.env.SURVIVOR_URL || "http://127.0.0.1:4448/";
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      recordVideo: {
        dir: path.join(out, "raw"),
        size: { width: 390, height: 844 },
      },
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(url + "?qa=1");
    await page.waitForFunction(() => SurvivorDemo.ready());
    const report = {
      source: await page.evaluate(() => SurvivorBuild),
      qa: true,
      scope:
        "QA-prepared equipment and targets. Actual UI clicks, persistent rerolls, real clock, damage, pickup geometry and game audio. Natural input separate.",
      rerolls: [],
      scenes: [],
      errors,
    };
    await page.locator("#startBtn").tap();
    await page.waitForFunction(
      () => SurvivorDemo.state()?.mode === "play" && !SurvivorDemo.saving(),
    );
    await page.evaluate(async () => {
      const g = SurvivorQA.state();
      g.spawnTime = 9999;
      g.p.inv = 9999;
      g.enemy = [];
      g.encounters.schedule = [];
      SurvivorQA.level();
      await SurvivorQA.save();
      await SurvivorQA.settled();
    });
    await page.waitForTimeout(1200);
    await page.screenshot({
      path: path.join(out, "upgrade-three-rerolls.png"),
    });
    for (let i = 2; i >= 0; i--) {
      const before = await page.evaluate(() => SurvivorDemo.state().presented);
      await page.locator("#rerollBtn").tap();
      await page.waitForFunction(() => !SurvivorDemo.saving());
      const after = await page.evaluate(() => ({
        choices: SurvivorDemo.state().presented,
        remaining: SurvivorDemo.state().rerollsRemaining,
      }));
      assert.equal(after.remaining, i);
      report.rerolls.push({ before, ...after });
      await page.waitForTimeout(1200);
    }
    await page.screenshot({
      path: path.join(out, "upgrade-rerolls-exhausted.png"),
    });
    const saved = await page.evaluate(() => SurvivorDemo.store());
    await page.reload();
    await page.waitForFunction(() => SurvivorDemo.ready());
    await page.locator("#continueBtn").tap();
    await page.waitForFunction(
      () => SurvivorDemo.state()?.mode === "upgrade" && !SurvivorDemo.saving(),
    );
    assert.deepEqual(
      await page.evaluate(() => SurvivorDemo.state().presented),
      saved.active.snapshot.game.presented,
    );
    assert.equal(
      await page.evaluate(() => SurvivorDemo.state().rerollsRemaining),
      0,
    );
    report.rerollsReloadExact = true;
    await page.waitForTimeout(2000);
    await page.locator('[data-pick="0"]').tap();
    await page.waitForFunction(() => SurvivorDemo.state()?.mode === "play");
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      const g = SurvivorQA.startModel(91);
      g.spawnTime = 9999;
      g.p.inv = 9999;
      g.encounters.schedule = [];
      g.qaLabel = "QA · 基础经验范围36";
      g.pickups = [{ x: 70, y: 0, t: 20, type: "xp", value: 7 }];
    });
    await page.waitForTimeout(1300);
    assert.equal(await page.evaluate(() => SurvivorDemo.state().xp), 0);
    await page.screenshot({ path: path.join(out, "xp-base36.png") });
    await page.evaluate(() => {
      SurvivorQA.pick("magnet");
      SurvivorQA.state().qaLabel = "QA · 局内磁场一级 · 范围71.75";
    });
    await page.waitForTimeout(1400);
    assert.equal(await page.evaluate(() => SurvivorDemo.state().xp), 7);
    await page.screenshot({ path: path.join(out, "xp-magnet1.png") });
    await page.evaluate(() => {
      const g = SurvivorQA.startModel(91, {
        engineering: { version: 1, thrusters: 0, salvage: 6, plating: 0 },
      });
      g.spawnTime = 9999;
      g.p.inv = 9999;
      g.encounters.schedule = [];
      g.qaLabel = "QA · 局外天线六级 · 范围84";
      g.pickups = [{ x: 80, y: 0, t: 20, type: "xp", value: 7 }];
    });
    await page.waitForTimeout(1300);
    assert.equal(await page.evaluate(() => SurvivorDemo.state().xp), 7);
    await page.screenshot({ path: path.join(out, "xp-antenna6.png") });
    report.pickup = {
      base: 36,
      antenna6: 84,
      magnet1: 71.75,
      both: 119.75,
      actualCollectedEach: 7,
    };
    const video = page.video();
    await context.close();
    await video.saveAs(path.join(out, "qa-ui-silent.webm"));
    const battle = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
    });
    const p = await battle.newPage();
    p.on("pageerror", (e) => errors.push(String(e)));
    await p.goto(url + "?qa=1");
    await p.waitForFunction(() => SurvivorDemo.ready());
    await p.locator("#startBtn").tap();
    await p.waitForFunction(() => SurvivorDemo.state()?.mode === "play");
    const av = path.join(out, "qa-lightning-live-mix.webm");
    fs.writeFileSync(av, Buffer.alloc(0));
    await p.exposeFunction("writeChunk", (encoded) =>
      fs.promises.appendFile(av, Buffer.from(encoded, "base64")),
    );
    await p.evaluate(() => {
      const stream = document.querySelector("#game").captureStream(30);
      stream.addTrack(SurvivorAudio.recordingStream().getAudioTracks()[0]);
      window.recorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8,opus",
        videoBitsPerSecond: 1100000,
        audioBitsPerSecond: 96000,
      });
      window.writes = Promise.resolve();
      window.done = false;
      recorder.ondataavailable = (e) => {
        if (e.data.size)
          writes = writes.then(async () => {
            const b = new Uint8Array(await e.data.arrayBuffer());
            let text = "";
            for (let i = 0; i < b.length; i += 16384)
              text += String.fromCharCode(...b.subarray(i, i + 16384));
            await writeChunk(btoa(text));
          });
      };
      recorder.onstop = async () => {
        await writes;
        window.done = true;
      };
      recorder.start(500);
    });
    for (const stage of ["basic", "gold", "evolved", "fusion"]) {
      await p.evaluate((stage) => {
        const Q = SurvivorQA,
          g = Q.startModel(91);
        g.spawnTime = 9999;
        g.p.inv = 9999;
        g.encounters.schedule = [];
        g.active = {};
        function equip(w, p, e) {
          for (let i = 0; i < 5; i++) {
            if (!Q.pick(w) || !Q.pick(p)) throw Error("equip");
          }
          Q.reward(true);
          if (!Q.pick(e)) throw Error("evolve");
        }
        if (stage === "basic") Q.pick("arc");
        else if (stage === "gold") {
          for (let i = 0; i < 3; i++) Q.pick("arc");
        } else equip("arc", "capacitor", "chainstorm");
        if (stage === "fusion") {
          equip("drone", "lock", "hunterswarm");
          Q.reward(true);
          if (!Q.pick("thunderhive")) throw Error("fusion");
        }
        g.qaLabel = {
          basic: "QA · 基础电弧",
          gold: "QA · 三级金色电链",
          evolved: "QA · 星链雷网 · 紫金双层电弧",
          fusion: "QA · 雷暴蜂群 · 紫金连锁",
        }[stage];
        for (const [x, y] of [
          [-120, -65],
          [-50, -140],
          [100, -120],
          [130, 30],
        ])
          Q.enemy("tank", x, y, 1e7);
      }, stage);
      await p.waitForTimeout(
        stage === "basic" || stage === "gold" ? 2800 : 5000,
      );
      await p.waitForFunction(() =>
        SurvivorDemo.state().arcs.some((a) => a.t > 0.17),
      );
      await p.screenshot({
        path: path.join(out, "lightning-" + stage + ".png"),
      });
      report.scenes.push(
        await p.evaluate((stage) => {
          const g = SurvivorDemo.state();
          return {
            stage,
            seconds: g.time,
            damage: g.metrics.damage,
            arcs: g.arcs,
            art: SurvivorArt.loaded(),
          };
        }, stage),
      );
    }
    await p.evaluate(() => recorder.stop());
    await p.waitForFunction(() => done);
    await battle.close();
    assert.deepEqual(errors, []);
    assert(
      report.scenes.every((s) => Object.values(s.damage).some((d) => d > 0)),
    );
    fs.writeFileSync(
      path.join(out, "qa-report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      "PASS actual rerolls/resume, three pickup configurations and four live lightning stages",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
