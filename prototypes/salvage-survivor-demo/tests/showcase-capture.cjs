/* Explicit QA fixtures. Actual controller, real wall time, native pixels and live audio. */
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const output = path.resolve(
  process.env.SURVIVOR_CAPTURE_OUT || "artifacts/survivor-v065",
);
const url = process.env.SURVIVOR_URL || "http://127.0.0.1:4429/";
const recipes = [
  ["cannon", "lens", "piercebeam"],
  ["drone", "lock", "hunterswarm"],
  ["arc", "capacitor", "chainstorm"],
  ["missile", "cooler", "meteorbarrage"],
  ["blade", "magnet", "spiralsaw"],
  ["shield", "armor", "reactiveaegis"],
  ["prism", "refraction", "kaleidoscope"],
  ["gravity", "singularity", "collapse"],
];
async function setup(page, label) {
  await page.evaluate((label) => {
    const g = SurvivorQA.startModel(93);
    g.active = {};
    g.spawnTime = 9999;
    g.encounters.schedule = [];
    g.milestoneSeen = SurvivorBalance.showcase.milestones.map(
      (m) => m.type + ":" + m.at,
    );
    g.p.hp = g.p.maxhp = 1000;
    g.p.inv = 0;
    g.qaLabel = label;
  }, label);
}
async function evolve(page, recipe) {
  await page.evaluate(([id, passive]) => {
    const Q = SurvivorQA;
    for (let i = 0; i < 5; i++) {
      if (!Q.pick(id) || !Q.pick(passive)) throw Error("Invalid equipment");
    }
    Q.reward(true);
  }, recipe);
  const index = await page.evaluate(
    (result) =>
      SurvivorQA.state().presented.findIndex((option) => option.id === result),
    recipe[2],
  );
  assert(index >= 0, "Actual EVO card was not offered");
  await page.waitForTimeout(650);
  await page.locator("#upgradeList [data-pick]").nth(index).click();
  await page.waitForFunction(() => SurvivorDemo.state().mode === "play");
}
async function summarize(page, name) {
  return page.evaluate((name) => {
    const g = SurvivorDemo.state();
    return {
      name,
      time: g.time,
      shots: g.metrics.shots,
      damage: g.metrics.damage,
      shipDamage: g.metrics.shipDamage,
      shieldBlocks: g.metrics.shieldsBlocked,
      active: g.active,
      passive: g.passive,
      evolved: g.evolved,
      fused: g.fused,
      enemies: g.enemy.map((e) => ({
        type: e.t,
        profile: e.eliteProfile || e.bossProfile,
        summonsLeft: e.summonsLeft,
        hp: e.hp,
        maxhp: e.maxhp,
      })),
      hazards: g.hazards,
    };
  }, name);
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    recordVideo: {
      dir: path.join(output, "raw"),
      size: { width: 390, height: 844 },
    },
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(url + "?qa=1");
  await page.waitForFunction(() => SurvivorDemo.ready());
  await page.locator("#startBtn").click();
  await page.waitForFunction(
    () => SurvivorAudio.inspect().contextState === "running",
  );
  const report = {
    source: await page.evaluate(() => SurvivorBuild),
    qa: true,
    scope:
      "Explicit equipment, forced valid reward rolls, highHP, enemy identity and phase fixtures. Real wall-clock controller and output mix. Ordinary play is separate.",
    captureSourceSha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(__filename))
      .digest("hex"),
    rows: [],
    errors,
  };
  const media = path.join(output, "qa-v065-live-mix.webm");
  fs.writeFileSync(media, Buffer.alloc(0));
  await page.exposeFunction("writeV065Chunk", (encoded) =>
    fs.promises.appendFile(media, Buffer.from(encoded, "base64")),
  );
  await page.evaluate(() => {
    const stream = document.querySelector("#game").captureStream(30);
    stream.addTrack(SurvivorAudio.recordingStream().getAudioTracks()[0]);
    window.showcaseRecorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp8,opus",
      videoBitsPerSecond: 1100000,
      audioBitsPerSecond: 96000,
    });
    window.showcaseWrites = Promise.resolve();
    window.showcaseDone = false;
    showcaseRecorder.ondataavailable = (event) => {
      if (event.data.size)
        showcaseWrites = showcaseWrites.then(async () => {
          const bytes = new Uint8Array(await event.data.arrayBuffer());
          let text = "";
          for (let i = 0; i < bytes.length; i += 32768)
            text += String.fromCharCode(...bytes.subarray(i, i + 32768));
          await writeV065Chunk(btoa(text));
        });
    };
    showcaseRecorder.onstop = () =>
      showcaseWrites.then(() => (window.showcaseDone = true));
    showcaseRecorder.start(500);
  });
  async function capture(name, seconds = 4) {
    await page.waitForTimeout(seconds * 1000);
    await page.screenshot({ path: path.join(output, name + ".png") });
    report.rows.push(await summarize(page, name));
  }
  await setup(page, "内层晶阵／外层护航 · 普通武装");
  await page.evaluate(() => {
    SurvivorQA.pick("drone");
    SurvivorQA.pick("prism");
    SurvivorQA.enemy("tank", 0, -170, 1000000);
  });
  await capture("qa-basic-companions");
  for (const recipe of recipes) {
    await setup(page, "进化武装 · " + recipe[2]);
    await evolve(page, recipe);
    await page.evaluate((id) => {
      const Q = SurvivorQA;
      Q.enemy("tank", 0, -100, 1000000);
      Q.enemy("tank", 80, -140, 1000000);
      Q.enemy("tank", 65, 25, 1000000);
      if (id === "shield") Q.forceDamage(12);
    }, recipe[0]);
    await capture("qa-evo-" + recipe[2]);
  }
  for (const [a, b, id] of [
    ["cannon", "shield", "ionbastion"],
    ["drone", "arc", "thunderhive"],
    ["missile", "blade", "blastwheel"],
    ["prism", "gravity", "eventhorizon"],
  ]) {
    await setup(page, "最高融合 · " + id);
    for (const weapon of [a, b])
      await evolve(
        page,
        recipes.find((r) => r[0] === weapon),
      );
    await page.evaluate((id) => {
      const Q = SurvivorQA;
      Q.reward(true);
      if (!Q.pick(id)) throw Error("Fusion rejected");
      Q.enemy("tank", 0, -170, 1000000);
      Q.enemy("tank", 75, -150, 1000000);
      Q.enemy("tank", 65, 20, 1000000);
    }, id);
    await capture("qa-fusion-" + id, 5);
    if (id === "ionbastion") {
      await page.evaluate(() => SurvivorQA.forceDamage(12));
      await capture("qa-bastion-counter", 1);
    }
  }
  for (const profile of ["hunter", "raider", "warden", "reaver", "hive"]) {
    await setup(page, "精英 · " + profile);
    await page.evaluate((profile) => {
      const Q = SurvivorQA;
      Q.pick("cannon");
      const id = Q.enemy("elite", 0, -145, 1000000, profile);
      const e = Q.state().enemy.find((e) => e.id === id);
      e.speed =
        SurvivorBalance.assault.enemies.elite.speed *
        SurvivorBalance.showcase.eliteProfiles[profile].speedScale;
      e.fire = 0.1;
    }, profile);
    await capture("qa-elite-" + profile, 6);
  }
  for (const profile of ["core", "weaver", "ark", "judicator"])
    for (const phase of [1, 2]) {
      await setup(page, "Boss · " + profile + " · 阶段" + phase);
      await page.evaluate(
        ({ profile, phase }) => {
          const Q = SurvivorQA;
          Q.pick("cannon");
          const id = Q.enemy("boss", 0, -150, 1000000, profile),
            e = Q.state().enemy.find((e) => e.id === id);
          e.speed =
            SurvivorBalance.assault.enemies.boss.speed *
            SurvivorBalance.showcase.bossProfiles[profile].speedScale;
          e.fire = 0.1;
          if (phase === 2) e.hp = e.maxhp * 0.4;
        },
        { profile, phase },
      );
      await capture("qa-boss-" + profile + "-phase" + phase, 9);
    }
  await page.evaluate(() => showcaseRecorder.stop());
  await page.waitForFunction(() => showcaseDone);
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(output, "qa-v065-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  const video = page.video();
  await context.close();
  await video.saveAs(path.join(output, "qa-v065-ui-silent.webm"));
  await browser.close();
  console.log("PASS actual QA scenes " + report.rows.length);
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
