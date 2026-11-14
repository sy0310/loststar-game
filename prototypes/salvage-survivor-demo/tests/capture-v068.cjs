/* Arranged, clearly labelled QA. Real native sprites, combat and output audio mix. */
const { chromium } = require("@playwright/test");
const fs = require("node:fs"),
  path = require("node:path"),
  assert = require("node:assert/strict");
const out = path.resolve(
  process.env.SURVIVOR_CAPTURE_OUT || "releases/survivor-v068-capture",
);
const url = process.env.SURVIVOR_URL || "http://127.0.0.1:4440/";
const names = {
  thunderhive: "雷暴蜂群",
  blastwheel: "爆裂刃环",
  eventhorizon: "星环奇点",
  ionbastion: "星舰壁垒",
};
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
    const report = {
      qa: true,
      scope:
        "Arranged loadouts, legal forced reward rolls, rich wallet and durable stationary targets. Real wall-clock controller and live output mix. Natural play is separate.",
      scenes: [],
      errors,
    };
    await page.goto(url + "?qa=1");
    await page.waitForFunction(() => SurvivorDemo.ready());
    report.source = await page.evaluate(() => SurvivorBuild);
    await page.locator("#startBtn").click();
    await page.waitForFunction(() => !SurvivorDemo.saving());
    await page.evaluate(async () => {
      SurvivorQA.state().credits = 27049;
      await SurvivorQA.end(false);
    });
    await page.waitForFunction(() => !SurvivorDemo.saving());
    await page.locator("#resultDockBtn").click();
    await page.screenshot({ path: path.join(out, "dock-prices.png") });
    await page.locator("#chooseLaunchBtn").tap();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(out, "launch-drone.png") });
    for (const id of ["arc", "missile", "blade", "gravity", "prism"]) {
      await page.locator(`[data-launch-weapon="${id}"]`).tap();
      await page.waitForTimeout(450);
    }
    await page.screenshot({ path: path.join(out, "launch-prism.png") });
    await page.locator("#bookLaunchBtn").tap();
    await page.waitForFunction(() => !SurvivorDemo.saving());
    assert(
      (await page.evaluate(() => SurvivorDemo.profile())).launchPlan.weapon ===
        "prism",
    );
    await page.screenshot({ path: path.join(out, "launch-reserved.png") });
    await page.waitForTimeout(900);
    await page.locator("#cancelLaunchBtn").tap();
    await page.waitForFunction(() => !SurvivorDemo.saving());
    assert.equal(
      (await page.evaluate(() => SurvivorDemo.profile())).credits,
      27049,
    );
    await page.locator("#closeLaunchBtn").tap();
    await page.locator("#closeDockBtn").tap();
    await page.locator("#retryBtn").tap();
    await page.waitForFunction(() => !SurvivorDemo.saving());
    await page.evaluate(() => {
      const g = SurvivorQA.startModel(91);
      g.spawnTime = 9999;
      g.enemy = [];
      g.encounters.schedule = [];
      g.active = { cannon: 1 };
      g.pickups = Array.from({ length: 10 }, (_, i) => ({
        x: Math.cos((i * Math.PI) / 5) * 180,
        y: Math.sin((i * Math.PI) / 5) * 180,
        t: 20,
        type: "xp",
        value: 1,
      }));
      g.qaLabel = "零整备 · 初始经验吸附";
    });
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(out, "initial-attraction.png") });
    await page.waitForTimeout(1500);
    assert.equal((await page.evaluate(() => SurvivorDemo.state())).xp, 10);
    report.initialExperience = {
      fixtureRadius: 180,
      actualXP: 10,
      engineering: 0,
      passiveMagnet: 0,
    };
    const av = path.join(out, "fusions-live-mix.webm");
    fs.writeFileSync(av, Buffer.alloc(0));
    await page.exposeFunction("writeFusionChunk", (encoded) =>
      fs.promises.appendFile(av, Buffer.from(encoded, "base64")),
    );
    await page.evaluate(() => {
      const stream = document.querySelector("#game").captureStream(30),
        audio = SurvivorAudio.recordingStream();
      if (!audio?.getAudioTracks().length) throw Error("Actual mix missing");
      stream.addTrack(audio.getAudioTracks()[0]);
      window.fusionRecorder = new MediaRecorder(stream, {
        mimeType: "video/webm;codecs=vp8,opus",
        videoBitsPerSecond: 1400000,
        audioBitsPerSecond: 96000,
      });
      window.fusionWrites = Promise.resolve();
      window.fusionDone = false;
      fusionRecorder.ondataavailable = (e) => {
        if (e.data.size)
          fusionWrites = fusionWrites.then(async () => {
            const bytes = new Uint8Array(await e.data.arrayBuffer());
            let s = "";
            for (let i = 0; i < bytes.length; i += 32768)
              s += String.fromCharCode(...bytes.subarray(i, i + 32768));
            await writeFusionChunk(btoa(s));
          });
      };
      fusionRecorder.onstop = () =>
        fusionWrites.then(() => (window.fusionDone = true));
      fusionRecorder.start(500);
    });
    for (const spec of [
      [
        "prism",
        "refraction",
        "kaleidoscope",
        "gravity",
        "singularity",
        "collapse",
        "eventhorizon",
      ],
      [
        "drone",
        "lock",
        "hunterswarm",
        "arc",
        "capacitor",
        "chainstorm",
        "thunderhive",
      ],
      [
        "missile",
        "cooler",
        "meteorbarrage",
        "blade",
        "magnet",
        "spiralsaw",
        "blastwheel",
      ],
      [
        "cannon",
        "lens",
        "piercebeam",
        "shield",
        "armor",
        "reactiveaegis",
        "ionbastion",
      ],
    ]) {
      await page.evaluate(
        ({ spec, label }) => {
          const Q = SurvivorQA,
            g = Q.startModel(91);
          g.active = {};
          g.spawnTime = 9999;
          g.p.inv = 9999;
          g.encounters.schedule = [];
          g.qaLabel = label;
          const [a, pa, ea, b, pb, eb, id] = spec;
          function evolve(w, p, e) {
            for (let i = 0; i < 5; i++) {
              if (!Q.pick(w) || !Q.pick(p)) throw Error("Equip");
            }
            Q.reward(true);
            if (!Q.pick(e)) throw Error("Evolve");
          }
          evolve(a, pa, ea);
          evolve(b, pb, eb);
          Q.reward(true);
          if (!Q.pick(id)) throw Error("Fuse");
          g.celebration = null;
          if (id === "eventhorizon")
            for (const [x, y] of [
              [0, 130],
              [-100, 150],
              [110, 165],
            ])
              Q.enemy("tank", x, y, 1e7);
          else
            for (const [x, y] of [
              [0, -175],
              [154, 16],
              [-156, 28],
              [80, 155],
            ])
              Q.enemy("tank", x, y, 1e7);
          if (id === "ionbastion") Q.forceDamage(10);
        },
        { spec, label: names[spec[6]] + " · 两项进化后融合" },
      );
      await page.waitForTimeout(650);
      await page.screenshot({
        path: path.join(out, "fusion-" + spec[6] + "-early.png"),
      });
      await page.waitForTimeout(1700);
      await page.screenshot({
        path: path.join(out, "fusion-" + spec[6] + ".png"),
      });
      await page.waitForTimeout(5650);
      report.scenes.push(
        await page.evaluate((id) => {
          const g = SurvivorQA.state();
          SurvivorQA.validate(SurvivorQA.snapshot());
          return {
            id,
            seconds: g.time,
            damage: g.metrics.damage[id] || 0,
            shots: g.metrics.shots,
            art: SurvivorArt.loaded(),
          };
        }, spec[6]),
      );
    }
    await page.evaluate(() => fusionRecorder.stop());
    await page.waitForFunction(() => fusionDone);
    report.audio = await page.evaluate(() => SurvivorAudio.inspect());
    assert.deepEqual(errors, []);
    assert(report.scenes.every((s) => s.damage > 0 && s.art === 74));
    fs.writeFileSync(
      path.join(out, "qa-report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    const video = page.video();
    await context.close();
    await video.saveAs(path.join(out, "qa-ui-silent.webm"));
    console.log(
      "PASS launch cards, refund, initial pickup and four live fusion scenes",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
