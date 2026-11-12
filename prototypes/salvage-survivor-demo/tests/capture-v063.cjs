/* Actual UI/media recording. Equipment, enemy and RNG fixtures are explicitly QA. */
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const output = path.resolve(
  process.env.SURVIVOR_CAPTURE_OUT || "artifacts/survivor-v063",
);
process.env.SURVIVOR_CAPTURE_OUT = output;
const url = process.env.SURVIVOR_URL || "http://127.0.0.1:4416/";
process.env.SURVIVOR_URL = url;
const { natural } = require("./capture-v062.cjs");
async function qa(browser) {
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
    captureSourceSha256: require("node:crypto")
      .createHash("sha256")
      .update(fs.readFileSync(__filename))
      .digest("hex"),
    scope:
      "Explicit five-level gear, highHP, fixed elite/visitor and forced reward-roll fixtures. All interaction buttons, attacks, damage and audio use actual runtime. Whole UI video is silent; canvas recording has actual music/SFX. Natural progress is recorded separately.",
    rows: [],
    errors,
  };
  const mixed = path.join(output, "qa-progression-live-mix.webm");
  fs.writeFileSync(mixed, Buffer.alloc(0));
  await page.exposeFunction("writeV063Chunk", (encoded) =>
    fs.promises.appendFile(mixed, Buffer.from(encoded, "base64")),
  );
  await page.evaluate(() => {
    const stream = document.getElementById("game").captureStream(30),
      audio = SurvivorAudio.recordingStream();
    if (!audio?.getAudioTracks().length) throw Error("Actual mix unavailable");
    stream.addTrack(audio.getAudioTracks()[0]);
    window.v063Recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp8,opus",
      videoBitsPerSecond: 1100000,
      audioBitsPerSecond: 96000,
    });
    window.v063Writes = Promise.resolve();
    window.v063Done = false;
    v063Recorder.ondataavailable = (e) => {
      if (e.data.size)
        v063Writes = v063Writes.then(async () => {
          const bytes = new Uint8Array(await e.data.arrayBuffer());
          let s = "";
          for (let i = 0; i < bytes.length; i += 32768)
            s += String.fromCharCode(...bytes.subarray(i, i + 32768));
          await writeV063Chunk(btoa(s));
        });
    };
    v063Recorder.onstop = () => v063Writes.then(() => (window.v063Done = true));
    v063Recorder.start(500);
  });
  await page.evaluate(() => {
    const Q = SurvivorQA,
      g = Q.startModel(63);
    g.active = {};
    g.spawnTime = 999;
    g.encounters.schedule = [];
    g.p.inv = 999;
    g.qaLabel = "QA · 武器5＋辅助4";
    for (let i = 0; i < 5; i++) Q.pick("cannon");
    for (let i = 0; i < 4; i++) Q.pick("lens");
    Q.reward(true);
  });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: path.join(output, "qa-5-plus-4-no-evo.png") });
  assert.equal(await page.locator(".skill.evolution").count(), 0);
  await page.getByRole("button", { name: /聚能透镜/ }).click();
  await page.evaluate(() => {
    const Q = SurvivorQA,
      g = Q.state();
    g.qaLabel = "QA · 5＋5，击退实体精英";
    Q.enemy("elite", 0, -90, 40);
  });
  await page.waitForFunction(() => SurvivorDemo.state()?.mode === "upgrade");
  report.rows.push(
    await page.evaluate(() => ({
      kind: "actualEliteKill",
      source: SurvivorDemo.state().upgradeSource,
      ids: SurvivorDemo.state().bossRewards.ids,
    })),
  );
  await page.screenshot({
    path: path.join(output, "qa-actual-elite-reward.png"),
  });
  await page.waitForTimeout(1600);
  // The actual elite roll may miss. This separate marked fixture demonstrates the winning card.
  if (!(await page.locator(".skill.evolution").count())) {
    await page.locator(".skill").first().click();
    await page.evaluate(() => {
      SurvivorQA.reward(true);
      SurvivorQA.state().qaLabel = "QA · 固定命中进化抽选";
    });
  }
  await page.screenshot({ path: path.join(output, "qa-full-evo-offer.png") });
  await page.waitForTimeout(1600);
  await page.getByRole("button", { name: /贯星轨炮/ }).click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const Q = SurvivorQA,
      g = Q.startModel(66);
    g.active = {};
    g.spawnTime = 999;
    g.encounters.schedule = [];
    for (let i = 0; i < 5; i++) {
      Q.pick("cannon");
      Q.pick("lens");
    }
    Q.reward(false);
    g.qaLabel = "QA · 5＋5，固定抽选未命中";
  });
  assert.equal(await page.locator(".skill.evolution").count(), 0);
  await page.screenshot({
    path: path.join(output, "qa-qualified-lottery-miss.png"),
  });
  report.rows.push({
    kind: "qualifiedLotteryMiss",
    forcedRoll: false,
    evoCards: 0,
  });
  await page.waitForTimeout(1600);
  for (const [a, b, id, label] of [
    ["cannon", "shield", "ionbastion", "星舰壁垒"],
    ["drone", "arc", "thunderhive", "雷暴蜂群"],
    ["missile", "blade", "blastwheel", "爆裂刃环"],
    ["prism", "gravity", "eventhorizon", "星环奇点"],
  ]) {
    await page.evaluate(
      ({ a, b }) => {
        const Q = SurvivorQA,
          g = Q.startModel(64);
        g.active = {};
        g.spawnTime = 999;
        g.encounters.schedule = [];
        g.p.maxhp = g.p.hp = 1000;
        g.p.inv = 999;
        const recipes = {
          cannon: ["lens", "piercebeam"],
          shield: ["armor", "reactiveaegis"],
          drone: ["lock", "hunterswarm"],
          arc: ["capacitor", "chainstorm"],
          missile: ["cooler", "meteorbarrage"],
          blade: ["magnet", "spiralsaw"],
          prism: ["refraction", "kaleidoscope"],
          gravity: ["singularity", "collapse"],
        };
        for (const weapon of [a, b]) {
          const [aux, evo] = recipes[weapon];
          for (let i = 0; i < 5; i++) {
            Q.pick(weapon);
            Q.pick(aux);
          }
          Q.reward(true);
          if (!Q.pick(evo)) throw Error("Fixture EVO failed");
        }
        Q.reward(true);
        g.qaLabel = "QA · 两件已进化武器融合";
      },
      { a, b },
    );
    await page.screenshot({ path: path.join(output, `qa-${id}-offer.png`) });
    await page.waitForTimeout(1400);
    await page.getByRole("button", { name: new RegExp(label) }).click();
    await page.evaluate(() => {
      const Q = SurvivorQA;
      for (const [x, y] of [
        [0, -95],
        [78, 0],
        [115, 0],
        [40, -100],
      ])
        Q.enemy("skimmer", x, y, 100000);
    });
    await page.waitForTimeout(1600);
    if (id === "ionbastion")
      await page.evaluate(() => {
        SurvivorQA.state().p.inv = 0;
        SurvivorQA.forceDamage(20);
      });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(output, `qa-${id}-combat.png`) });
    const row = await page.evaluate(
      (id) => ({
        kind: "fusion",
        id,
        damage: SurvivorDemo.state().metrics.damage[id] || 0,
        active: SurvivorDemo.state().active,
        passive: SurvivorDemo.state().passive,
        fused: SurvivorDemo.state().fused,
      }),
      id,
    );
    assert(row.damage > 0);
    report.rows.push(row);
  }
  for (const kind of ["courier", "watcher"]) {
    await page.evaluate((kind) => {
      const Q = SurvivorQA,
        g = Q.startModel(65);
      g.active = {};
      g.spawnTime = 999;
      g.p.maxhp = g.p.hp = 1000;
      g.encounters.schedule = [{ kind, at: 0 }];
      g.qaLabel = "QA · 奇遇实体入场与攻击";
    }, kind);
    await page.waitForTimeout(2700);
    await page.screenshot({
      path: path.join(output, `qa-${kind}-materialize.png`),
    });
    await page.waitForTimeout(1300);
    await page.screenshot({ path: path.join(output, `qa-${kind}-attack.png`) });
    await page.waitForTimeout(2300);
    const row = await page.evaluate(
      (kind) => ({
        kind: "visitor",
        visitor: kind,
        shots: SurvivorDemo.state().metrics.shots,
        shipDamage: SurvivorDemo.state().metrics.shipDamage,
        enemy: SurvivorDemo.state().enemy.find((e) => e.t === kind),
      }),
      kind,
    );
    assert(row.shots["hostile-" + kind] > 0);
    report.rows.push(row);
  }
  await page.evaluate(() => v063Recorder.stop());
  await page.waitForFunction(() => v063Done);
  assert(fs.statSync(mixed).size > 100000);
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(output, "qa-progression-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  const video = page.video();
  await context.close();
  await video.saveAs(path.join(output, "qa-progression-ui-silent.webm"));
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch();
  try {
    if (!process.argv.includes("--qa-only")) await natural(browser);
    if (!process.argv.includes("--natural-only")) await qa(browser);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
