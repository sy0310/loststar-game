const { test, expect } = require("@playwright/test");
const { boot, start, state, stored, pause } = require("./helpers.cjs");

test("v065 actual basic and evolved bodies separate crystal and drone flight bands", async ({
  page,
}, info) => {
  await boot(page);
  const rows = await page.evaluate(() => {
    const Q = SurvivorQA,
      results = [];
    for (const evolved of [false, true]) {
      const game = Q.startModel(91);
      Q.legacyV065();
      game.active = {};
      game.spawnTime = 9999;
      game.encounters.schedule = [];
      game.p.inv = 10000;
      for (const [weapon, passive, result] of [
        ["drone", "lock", "hunterswarm"],
        ["prism", "refraction", "kaleidoscope"],
      ]) {
        if (evolved) {
          for (let i = 0; i < 5; i++) {
            Q.pick(weapon);
            Q.pick(passive);
          }
          Q.reward(true);
          Q.pick(result);
        } else Q.pick(weapon);
      }
      const calls = [],
        original = SurvivorArt.draw;
      try {
        SurvivorArt.draw = function (ctx, id, x, y, options = {}) {
          if (["drone_body", "hunter_drone", "prism_crystal"].includes(id))
            calls.push({
              id,
              x,
              y,
              scale: options.scale,
              center: [innerWidth / 2, innerHeight * 0.51],
            });
          return original.apply(this, arguments);
        };
        Q.runRender();
      } finally {
        SurvivorArt.draw = original;
      }
      results.push({ evolved, calls });
    }
    return results;
  });
  for (const row of rows) {
    const drone = row.calls.find(
        (c) => c.id === (row.evolved ? "hunter_drone" : "drone_body"),
      ),
      crystal = row.calls.find((c) => c.id === "prism_crystal");
    expect(drone).toBeTruthy();
    expect(crystal).toBeTruthy();
    expect(drone.scale).toBeGreaterThanOrEqual(1.4);
    expect(crystal.scale).toBeGreaterThanOrEqual(row.evolved ? 1.5 : 1.15);
    const radius = (c) => Math.hypot(c.x - c.center[0], c.y - c.center[1]);
    expect(radius(drone) - radius(crystal)).toBeGreaterThan(60);
  }
  await info.attach("actual-body-placements", {
    body: Buffer.from(JSON.stringify(rows)),
    contentType: "application/json",
  });
});
test("v065 final fusion renders its own transparent mount and dedicated icon and beam", async ({
  page,
}, info) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const Q = SurvivorQA,
      g = Q.startModel(91);
    Q.legacyV065();
    g.active = {};
    g.spawnTime = 9999;
    g.encounters.schedule = [];
    for (const [weapon, passive, evo] of [
      ["cannon", "lens", "piercebeam"],
      ["shield", "armor", "reactiveaegis"],
    ]) {
      for (let i = 0; i < 5; i++) {
        Q.pick(weapon);
        Q.pick(passive);
      }
      Q.reward(true);
      Q.pick(evo);
    }
    Q.reward(true);
    Q.pick("ionbastion");
    Q.enemy("skimmer", 0, -180, 100000);
    Q.step(0.001);
    const calls = [],
      original = SurvivorArt.draw;
    try {
      SurvivorArt.draw = function (ctx, id, x, y, options) {
        calls.push({ id, options });
        return original.apply(this, arguments);
      };
      Q.runRender();
    } finally {
      SurvivorArt.draw = original;
    }
    return {
      calls,
      beam: g.beams[0],
      icon: document.querySelector("#loadout").innerHTML,
      assets: SurvivorArt.loaded(),
    };
  });
  expect(result.assets).toBe(74);
  expect(result.calls.find((c) => c.id === "bastion_mount").options.scale).toBe(
    1.6,
  );
  expect(result.beam.source).toBe("ionbastion");
  expect(result.icon).toContain("ionbastion");
  await page.screenshot({ path: info.outputPath("fusion.png") });
});
test("v065 all new bosses and elites decode real distinct sprites and fire their own attacks", async ({
  page,
}, info) => {
  await boot(page);
  const rows = await page.evaluate(() => {
    const results = [];
    for (const [type, profile, kind] of [
      ["boss", "weaver", "spiral"],
      ["boss", "ark", "siege"],
      ["boss", "judicator", "pincer"],
      ["elite", "reaver", "hook"],
      ["elite", "hive", "escort"],
    ]) {
      const Q = SurvivorQA,
        g = Q.startModel(91);
      Q.legacyV065();
      g.active = {};
      g.spawnTime = 9999;
      g.encounters.schedule = [];
      g.p.inv = 10000;
      const id = Q.enemy(type, 0, -130, 100000, profile);
      const e = g.enemy.find((e) => e.id === id);
      Object.assign(e, {
        pattern: 1,
        aim: Math.PI / 2,
        warn: 0.001,
        targetX: 0,
        targetY: 0,
      });
      Q.step(0.01);
      Q.validate(Q.snapshot());
      Q.runRender();
      const spec =
        type === "boss"
          ? SurvivorBalance.showcase.bossProfiles[profile]
          : SurvivorBalance.showcase.eliteProfiles[profile];
      results.push({
        type,
        profile,
        kind,
        metric: g.metrics.shots["hostile-" + kind],
        asset: SurvivorArt.catalog[spec.art],
        phase: e.hp / e.maxhp,
      });
    }
    return results;
  });
  expect(new Set(rows.map((r) => r.asset.src)).size).toBe(5);
  for (const row of rows) {
    expect(row.metric).toBeGreaterThan(0);
    const response = await page.request.get(row.asset.src);
    expect(response.ok()).toBeTruthy();
    expect((await response.body()).subarray(1, 4).toString()).toBe("PNG");
  }
  await info.attach("five-actual-ships", {
    body: Buffer.from(JSON.stringify(rows)),
    contentType: "application/json",
  });
});
test("v065 real pause reload keeps boss identity, finite escort budget and pincer state", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await page.evaluate(async () => {
    const Q = SurvivorQA,
      g = Q.state();
    g.spawnTime = 9999;
    g.encounters.schedule = [];
    g.p.inv = 10000;
    g.active = {};
    Q.enemy("boss", 0, -160, 10000, "judicator");
    Q.enemy("elite", 100, -130, 10000, "hive");
    const hive = g.enemy.find((e) => e.eliteProfile === "hive");
    Object.assign(hive, { summonsLeft: 2 });
    g.hazards.push({
      kind: "pincer",
      x: 0,
      y: 0,
      heading: Math.PI / 2,
      age: 0.1,
      duration: 2.6,
      warning: 1.1,
      damage: 9,
    });
    await Q.save();
  });
  await pause(page);
  const before = await stored(page);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  await page.locator("#continueBtn").click();
  await page.waitForFunction(() => SurvivorDemo.state()?.mode === "play");
  await pause(page);
  const after = await state(page);
  expect(after.rules.combatVersion).toBe(8);
  expect(after.enemy.find((e) => e.t === "boss").bossProfile).toBe("judicator");
  expect(after.enemy.find((e) => e.eliteProfile === "hive").summonsLeft).toBe(
    2,
  );
  expect(after.hazards[0].kind).toBe("pincer");
  expect((await stored(page)).profile).toEqual(before.profile);
});
test("v065 natural milestones reveal four unique boss identities with no replacement of legacy rules", async ({
  page,
}) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const Q = SurvivorQA,
      g = Q.startModel(91);
    Q.legacyV065();
    g.active = {};
    g.spawnTime = 9999;
    g.encounters.schedule = [];
    g.p.inv = 10000;
    const names = [];
    for (const at of [300, 440, 650, 850]) {
      g.enemy = [];
      g.hazards = [];
      g.enemyShots = [];
      g.milestoneSeen = SurvivorBalance.showcase.milestones
        .filter((m) => m.at < at)
        .map((m) => m.type + ":" + m.at);
      g.time = at;
      Q.step(0.001);
      names.push(g.enemy.find((e) => e.t === "boss").bossProfile);
    }
    Q.validate(Q.snapshot());
    return names;
  });
  expect(result).toEqual(["core", "weaver", "ark", "judicator"]);
});
