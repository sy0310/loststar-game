/* Explicit QA presets and real-time recorded combat. Ordinary play is separate. */
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const output = path.resolve(
  process.env.SURVIVOR_CAPTURE_OUT || "artifacts/survivor-v064",
);
const url = process.env.SURVIVOR_URL || "http://127.0.0.1:4425/";
process.env.SURVIVOR_CAPTURE_OUT = output;
process.env.SURVIVOR_URL = url;
const { natural } = require("./capture-v062.cjs");

async function fixture(page, label) {
  await page.evaluate((label) => {
    const game = SurvivorQA.startModel(93);
    game.active = {};
    game.spawnTime = 9999;
    game.encounters.schedule = [];
    game.p.hp = game.p.maxhp = 1000;
    game.p.inv = 0;
    game.qaLabel = label;
  }, label);
}
async function evolveOnScreen(page, weapon, passive, result, label) {
  await page.evaluate(
    ({ weapon, passive, label }) => {
      const Q = SurvivorQA;
      const game = Q.state();
      while ((game.active[weapon] || 0) < 5) Q.pick(weapon);
      while ((game.passive[passive] || 0) < 5) Q.pick(passive);
      game.qaLabel = label;
      Q.reward(true);
    },
    { weapon, passive, label },
  );
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: new RegExp(result) }).click();
}
async function snapshot(page, name) {
  await page.screenshot({ path: path.join(output, name + ".png") });
}
async function summary(page, kind) {
  return page.evaluate((kind) => {
    const game = SurvivorDemo.state();
    return {
      kind,
      time: game.time,
      mode: game.mode,
      damage: game.metrics.damage,
      shots: game.metrics.shots,
      shipDamage: game.metrics.shipDamage,
      shieldsBlocked: game.metrics.shieldsBlocked,
      refractions: game.metrics.refractions || 0,
      active: game.active,
      passive: game.passive,
      evolved: game.evolved,
      fused: game.fused,
      hp: game.p.hp,
      maxhp: game.p.maxhp,
    };
  }, kind);
}
async function bodyComparison(browser) {
  const result = {
    scope:
      "Identical stationary QA positions and actual decoded source sprites.",
    images: [],
  };
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  for (const [name, source] of [
    ["before", process.env.SURVIVOR_BASELINE_URL || "http://127.0.0.1:4423/"],
    ["after", url],
  ]) {
    const page = await context.newPage();
    await page.goto(source + "?qa=1");
    await page.waitForFunction(() => SurvivorDemo.ready());
    await page.evaluate(() => {
      const Q = SurvivorQA;
      const game = Q.startModel(93);
      game.active = {};
      game.spawnTime = 9999;
      game.encounters.schedule = [];
      game.p.inv = 10000;
      game.qaLabel = "固定位置 · 实际敌机体量";
      for (const [kind, x, y] of [
        ["skimmer", -115, -130],
        ["wisp", -40, -170],
        ["ranger", 70, -150],
        ["tank", 110, 80],
        ["elite", -95, 80],
      ])
        Q.enemy(kind, x, y, 100000);
      Q.runRender();
    });
    await snapshot(page, "body-" + name);
    result.images.push({
      file: "body-" + name + ".png",
      source: await page.evaluate(() => SurvivorBuild),
    });
    await page.close();
  }
  await context.close();
  fs.writeFileSync(
    path.join(output, "body-comparison.json"),
    JSON.stringify(result, null, 2) + "\n",
  );
}
async function qa(browser) {
  await bodyComparison(browser);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    recordVideo: {
      dir: path.join(output, "raw"),
      size: { width: 390, height: 844 },
    },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(url + "?qa=1");
  await page.waitForFunction(() => SurvivorDemo.ready());
  await page.locator("#startBtn").click();
  await page.waitForFunction(
    () => SurvivorAudio.inspect().contextState === "running",
  );
  const report = {
    source: await page.evaluate(() => SurvivorBuild),
    qa: true,
    captureSourceSha256: crypto
      .createHash("sha256")
      .update(fs.readFileSync(__filename))
      .digest("hex"),
    scope:
      "Explicit equipment, health, forced reward roll, enemy and late-clock fixtures. Real controller attacks, damage, audio and actual upgrade buttons. Canvas video carries the live output mix, whole-page UI video is silent. Natural play is recorded separately.",
    rows: [],
    errors,
  };
  const media = path.join(output, "qa-v064-live-mix.webm");
  fs.writeFileSync(media, Buffer.alloc(0));
  await page.exposeFunction("writeV064Chunk", (encoded) =>
    fs.promises.appendFile(media, Buffer.from(encoded, "base64")),
  );
  await page.evaluate(() => {
    const stream = document.getElementById("game").captureStream(30);
    const mix = SurvivorAudio.recordingStream();
    if (!mix?.getAudioTracks().length)
      throw Error("Actual output mix unavailable");
    stream.addTrack(mix.getAudioTracks()[0]);
    window.v064Recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp8,opus",
      videoBitsPerSecond: 1100000,
      audioBitsPerSecond: 96000,
    });
    window.v064Writes = Promise.resolve();
    window.v064Done = false;
    v064Recorder.ondataavailable = (event) => {
      if (!event.data.size) return;
      v064Writes = v064Writes.then(async () => {
        const bytes = new Uint8Array(await event.data.arrayBuffer());
        let text = "";
        for (let index = 0; index < bytes.length; index += 32768)
          text += String.fromCharCode(...bytes.subarray(index, index + 32768));
        await writeV064Chunk(btoa(text));
      });
    };
    v064Recorder.onstop = () =>
      v064Writes.then(() => {
        window.v064Done = true;
      });
    v064Recorder.start(500);
  });

  await fixture(page, "普通蜂机／导弹 · 锁定后直飞");
  await page.evaluate(() => {
    const Q = SurvivorQA;
    Q.pick("drone");
    Q.pick("missile");
    Q.enemy("wisp", -100, -130, 1000000);
    Q.enemy("wisp", 100, -140, 1000000);
    for (const enemy of Q.state().enemy) enemy.speed = 105;
  });
  await page.waitForTimeout(2500);
  await snapshot(page, "qa-basic-straight");
  report.rows.push(await summary(page, "ordinaryBallistics"));
  await evolveOnScreen(
    page,
    "drone",
    "lock",
    "猎手蜂群",
    "双满进化 · 蜂机开始追踪",
  );
  await page.waitForTimeout(2500);
  await snapshot(page, "qa-drone-homing");
  report.rows.push(await summary(page, "evolvedDrone"));
  await evolveOnScreen(
    page,
    "missile",
    "cooler",
    "彗星弹幕",
    "双满进化 · 导弹开始追踪",
  );
  await page.waitForTimeout(3000);
  await snapshot(page, "qa-missile-homing");
  report.rows.push(await summary(page, "evolvedMissile"));

  await fixture(page, "环绕晶体 · 实体晶片发射");
  await page.evaluate(() => {
    const Q = SurvivorQA;
    for (let index = 0; index < 3; index++) Q.pick("prism");
    for (const [x, y] of [
      [0, -110],
      [80, -100],
      [-80, -80],
    ])
      Q.enemy("skimmer", x, y, 1000000);
  });
  await page.waitForTimeout(2500);
  await snapshot(page, "qa-prism-orbit");
  await page.evaluate(() => {
    SurvivorQA.pick("refraction");
    SurvivorQA.state().qaLabel = "折射晶核 · 命中后转向另一目标";
  });
  await page.waitForTimeout(3500);
  await snapshot(page, "qa-prism-refraction");
  report.rows.push(await summary(page, "prismRefraction"));
  await evolveOnScreen(
    page,
    "prism",
    "refraction",
    "万花星阵",
    "六晶星阵 · 连续折射",
  );
  await page.waitForTimeout(3500);
  await snapshot(page, "qa-prism-evolved");
  report.rows.push(await summary(page, "prismEvolution"));

  for (const [rank, color, label] of [
    [1, "#73d9e8", "蓝色 · 初阶电弧"],
    [3, "#f4c57a", "金色 · 高阶电弧"],
    [5, "#c49bef", "紫色 · 进化雷网"],
  ]) {
    await fixture(page, label);
    await page.evaluate((rank) => {
      const Q = SurvivorQA;
      for (let index = 0; index < rank; index++) Q.pick("arc");
      if (rank === 5) {
        for (let index = 0; index < 5; index++) Q.pick("capacitor");
        Q.reward(true);
      }
      for (const [x, y] of [
        [0, -120],
        [70, -100],
        [-65, -85],
      ])
        Q.enemy("skimmer", x, y, 1000000);
    }, rank);
    if (rank === 5)
      await page.getByRole("button", { name: /星链雷网/ }).click();
    await page.waitForFunction(
      (color) => SurvivorDemo.state().arcs.some((arc) => arc.color === color),
      color,
    );
    await snapshot(page, "qa-lightning-" + rank);
    await page.waitForTimeout(1800);
    report.rows.push({
      ...(await summary(page, "lightningStage")),
      rank,
      actualColor: color,
    });
  }
  await evolveOnScreen(
    page,
    "drone",
    "lock",
    "猎手蜂群",
    "蜂机与雷网 · 双进化后融合",
  );
  await page.evaluate(() => SurvivorQA.reward(true));
  await page.getByRole("button", { name: /雷暴蜂群/ }).click();
  await page.waitForFunction(() =>
    SurvivorDemo.state().arcs.some((arc) => arc.color === "#bc85f2"),
  );
  await snapshot(page, "qa-thunderhive-violet-gold");
  await page.waitForTimeout(2500);
  report.rows.push(await summary(page, "thunderhiveVioletGold"));

  for (const profile of ["hunter", "raider", "warden"]) {
    await fixture(
      page,
      profile === "hunter"
        ? "追猎者 · 冲锋与扇射"
        : profile === "raider"
          ? "破阵先锋 · 突进与交叉针弹"
          : "封锁母舰 · 护甲与矿舱封锁",
    );
    await page.evaluate((profile) => {
      const Q = SurvivorQA;
      Q.pick("cannon");
      Q.enemy("elite", 0, -135, 1000000, profile);
      const enemy = Q.state().enemy[0];
      enemy.speed =
        SurvivorBalance.assault.enemies.elite.speed *
        SurvivorBalance.assault.eliteProfiles[profile].speedScale;
      enemy.fire = 0;
    }, profile);
    await page.waitForTimeout(650);
    await snapshot(page, "qa-elite-" + profile + "-warning");
    await page.waitForTimeout(profile === "warden" ? 10800 : 6500);
    await snapshot(page, "qa-elite-" + profile + "-attack");
    report.rows.push({ ...(await summary(page, "eliteProfile")), profile });
  }
  await fixture(page, "后段守卫 · 第二段扇射预警");
  await page.evaluate(() => {
    const Q = SurvivorQA;
    const game = Q.state();
    for (let index = 0; index < 5; index++) {
      Q.pick("shield");
      Q.pick("armor");
    }
    Q.reward(true);
    Q.pick("reactiveaegis");
    game.time = 600;
    game.milestoneSeen = SurvivorBalance.assault.milestones.map(
      (milestone) => milestone.type + ":" + milestone.at,
    );
    Q.enemy("boss", 0, -155, 1000000);
    game.enemy[0].fire = 0;
  });
  await page.waitForTimeout(1500);
  await snapshot(page, "qa-boss-second-warning");
  await page.waitForTimeout(2800);
  await snapshot(page, "qa-boss-second-attack");
  report.rows.push(await summary(page, "lateBossEcho"));

  await fixture(page, "固定满配 · 最终守卫承压");
  await page.evaluate(() => {
    const Q = SurvivorQA;
    const game = Q.startModel(93, { hull: 3, gun: 3 });
    game.active = {};
    const recipes = {
      cannon: ["lens", "piercebeam"],
      shield: ["armor", "reactiveaegis"],
      drone: ["lock", "hunterswarm"],
      arc: ["capacitor", "chainstorm"],
      prism: ["refraction", "kaleidoscope"],
      gravity: ["singularity", "collapse"],
    };
    function equip(id) {
      for (let index = 0; index < 5; index++)
        if (!Q.pick(id)) throw Error("Equip refused " + id);
    }
    function evolve(id) {
      equip(id);
      equip(recipes[id][0]);
      Q.reward(true);
      if (!Q.pick(recipes[id][1])) throw Error("EVO refused " + id);
    }
    for (const [first, second, fusion] of [
      ["cannon", "shield", "ionbastion"],
      ["drone", "arc", "thunderhive"],
    ]) {
      evolve(first);
      evolve(second);
      Q.reward(true);
      if (!Q.pick(fusion)) throw Error("Fusion refused " + fusion);
    }
    evolve("prism");
    evolve("gravity");
    equip("missile");
    equip("blade");
    game.time = 840;
    game.p.inv = 0;
    game.xpNext = 1e9;
    game.encounters.schedule = [];
    game.qaLabel = "固定满配 · 最终守卫承压";
    game.milestoneSeen = SurvivorBalance.assault.milestones
      .filter((milestone) => milestone.at <= 840)
      .map((milestone) => milestone.type + ":" + milestone.at);
  });
  await page.waitForTimeout(30000);
  await snapshot(page, "qa-late-standing");
  report.rows.push(await summary(page, "lateStandingMaximumBuild"));

  await page.evaluate(() => v064Recorder.stop());
  await page.waitForFunction(() => v064Done);
  assert(fs.statSync(media).size > 100000);
  assert.deepEqual(errors, []);
  assert(
    report.rows.find((row) => row.kind === "prismRefraction").refractions > 0,
  );
  assert(
    report.rows.find((row) => row.kind === "lateBossEcho").shots[
      "hostile-boss-echo"
    ] > 0,
  );
  for (const row of report.rows.filter((row) => row.kind === "eliteProfile"))
    assert(row.shots["hostile-elite"] > 0);
  fs.writeFileSync(
    path.join(output, "qa-v064-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  const video = page.video();
  await context.close();
  await video.saveAs(path.join(output, "qa-v064-ui-silent.webm"));
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
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
