const { test, expect } = require("@playwright/test");
const { boot, start, state, stored } = require("./helpers.cjs");

test("v064 actual drawImage restores normal2x and visitor3x with attached native nozzles", async ({
  page,
}, info) => {
  await boot(page);
  const rows = await page.evaluate(() => {
    const results = [];
    for (const [type, profile, id] of [
      ["skimmer", null, "skimmer"],
      ["tank", null, "tank"],
      ["elite", "hunter", "elite"],
      ["elite", "raider", "elite_raider"],
      ["elite", "warden", "elite_warden"],
      ["boss", null, "boss"],
      ["lancer", null, "lancer"],
      ["courier", null, "courier"],
      ["watcher", null, "watcher"],
    ]) {
      const Q = SurvivorQA;
      const game = Q.startModel(91);
      game.active = {};
      game.spawnTime = 999;
      Q.enemy(type, 20, -100, 100000, profile || "hunter");
      Object.assign(game.enemy[0], { speed: 1, arrivalAge: 2 });
      const calls = [];
      const original = CanvasRenderingContext2D.prototype.drawImage;
      try {
        CanvasRenderingContext2D.prototype.drawImage = function (
          image,
          ...args
        ) {
          if (
            image.src?.includes("/actors/" + id + "@2x.png") ||
            image.src?.endsWith("/thruster@2x.png")
          ) {
            const matrix = this.getTransform();
            calls.push({
              id: image.src,
              args,
              matrix: {
                a: matrix.a,
                b: matrix.b,
                c: matrix.c,
                d: matrix.d,
                e: matrix.e,
                f: matrix.f,
              },
            });
          }
          return original.apply(this, arguments);
        };
        Q.runRender();
      } finally {
        CanvasRenderingContext2D.prototype.drawImage = original;
      }
      const actor = SurvivorArt.catalog[id];
      const scale = ["courier", "watcher"].includes(type) ? 3 : 2;
      const bodyIndex = calls.findIndex((call) =>
        call.id.includes("/actors/" + id + "@2x.png"),
      );
      const body = calls[bodyIndex];
      const flames = calls
        .slice(0, bodyIndex)
        .filter((call) => call.id.endsWith("/thruster@2x.png"));
      results.push({
        id,
        native: actor.nativeSize,
        scale,
        body,
        flames,
        anchors: actor.exhaustAnchors || [],
        center: actor.center,
      });
    }
    return results;
  });
  for (const row of rows) {
    expect(row.body.args[6]).toBe(row.native[0] * row.scale);
    expect(row.body.args[7]).toBe(row.native[1] * row.scale);
    if (row.anchors.length) {
      expect(row.flames).toHaveLength(row.anchors.length);
      row.flames.forEach((flame, index) => {
        const matrix = row.body.matrix;
        const x = (row.anchors[index][0] - row.center[0]) * row.scale;
        const y = (row.anchors[index][1] - row.center[1]) * row.scale;
        expect(
          Math.abs(flame.matrix.e - (matrix.e + matrix.a * x + matrix.c * y)),
        ).toBeLessThanOrEqual(0.8);
        expect(
          Math.abs(flame.matrix.f - (matrix.f + matrix.b * x + matrix.d * y)),
        ).toBeLessThanOrEqual(0.8);
      });
    }
  }
  expect(rows.find((row) => row.id === "skimmer").body.args[6]).toBe(48);
  await info.attach("actual-native-size-and-nozzles", {
    body: Buffer.from(JSON.stringify(rows, null, 2)),
    contentType: "application/json",
  });
});

test("v064 trusted touch only grants drone homing after a legal5plus5 evolution", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  const basic = await page.evaluate(() => {
    const Q = SurvivorQA;
    const game = Q.state();
    game.active = {};
    game.spawnTime = 999;
    game.p.inv = 999;
    Q.pick("drone");
    Q.enemy("skimmer", 0, -180, 100000);
    Q.step(0.01);
    const shot = game.shots[0];
    const before = [shot.vx, shot.vy];
    game.enemy[0].x = 180;
    Q.step(0.1);
    return {
      homing: shot.homing,
      unchanged: before[0] === shot.vx && before[1] === shot.vy,
    };
  });
  expect(basic).toEqual({ homing: false, unchanged: true });
  await page.evaluate(() => {
    const Q = SurvivorQA;
    for (let index = 1; index < 5; index++) Q.pick("drone");
    for (let index = 0; index < 5; index++) Q.pick("lock");
    Q.reward(true);
  });
  await page.getByRole("button", { name: /猎手蜂群/ }).tap();
  expect((await state(page)).evolved.drone).toBe("hunterswarm");
  const evolved = await page.evaluate(() => {
    const game = SurvivorQA.state();
    game.shots = [];
    game.attackClock.drone = 0;
    SurvivorQA.step(0.01);
    return game.shots.some((shot) => shot.homing && shot.evolvedAtLaunch);
  });
  expect(evolved).toBe(true);
});

test("v064 ordinary missile has a fixed region, evolved missile really changes velocity", async ({
  page,
}) => {
  await boot(page);
  const rows = await page.evaluate(() => {
    return [false, true].map((evolved) => {
      const Q = SurvivorQA;
      const game = Q.startModel(91);
      game.active = {};
      game.p.inv = 999;
      game.spawnTime = 999;
      for (let index = 0; index < (evolved ? 5 : 1); index++) Q.pick("missile");
      if (evolved) {
        for (let index = 0; index < 5; index++) Q.pick("cooler");
        Q.reward(true);
        if (!Q.pick("meteorbarrage")) throw Error("EVO refused");
      }
      Q.enemy("skimmer", 0, -160, 100000);
      Q.step(0.01);
      const shot = game.shots[0];
      const before = [shot.vx, shot.vy];
      game.enemy[0].x = 170;
      Q.step(0.1);
      Q.validate(Q.snapshot());
      return {
        evolved,
        homing: shot.homing,
        destination: [shot.destinationX, shot.destinationY],
        changed: before[0] !== shot.vx || before[1] !== shot.vy,
      };
    });
  });
  expect(rows[0]).toMatchObject({
    homing: false,
    changed: false,
    destination: [0, -160],
  });
  expect(rows[1]).toMatchObject({ homing: true, changed: true });
});

test("v064 prism uses orbiting decoded crystal art and actual refraction instead of rail beams", async ({
  page,
}, info) => {
  await boot(page);
  const result = await page.evaluate(() => {
    const Q = SurvivorQA;
    const game = Q.startModel(91);
    game.active = {};
    game.spawnTime = 999;
    game.p.inv = 999;
    for (let index = 0; index < 3; index++) Q.pick("prism");
    Q.pick("refraction");
    Q.enemy("skimmer", 0, -100, 100000);
    Q.enemy("skimmer", 80, -100, 100000);
    Q.step(0.01);
    const origins = game.shots.map((shot) => [shot.x, shot.y]);
    Q.step(0.65);
    let orbitImages = 0;
    const original = SurvivorArt.draw;
    try {
      SurvivorArt.draw = function (ctx, id, x, y, options) {
        if (id === "prism_crystal" && [0.9, 1.1].includes(options?.scale))
          orbitImages++;
        return original.apply(this, arguments);
      };
      Q.runRender();
    } finally {
      SurvivorArt.draw = original;
    }
    return {
      origins,
      orbitImages,
      refractions: game.metrics.refractions,
      damage: game.metrics.damage.prism,
      beams: game.beams.length,
    };
  });
  expect(result.origins).toHaveLength(3);
  expect(result.origins.every(([x, y]) => Math.hypot(x, y) > 34)).toBe(true);
  expect(result.orbitImages).toBe(3);
  expect(result.refractions).toBeGreaterThan(0);
  expect(result.damage).toBeGreaterThan(0);
  expect(result.beams).toBe(0);
  await info.attach("actual-prism", {
    body: Buffer.from(JSON.stringify(result)),
    contentType: "application/json",
  });
});

test("v064 actual canvas lightning strokes visibly use blue gold and violet", async ({
  page,
}) => {
  await boot(page);
  const stages = await page.evaluate(() => {
    return [1, 3, 5].map((rank) => {
      const Q = SurvivorQA;
      const game = Q.startModel(91);
      game.active = {};
      game.spawnTime = 999;
      game.p.inv = 999;
      for (let index = 0; index < rank; index++) Q.pick("arc");
      if (rank === 5) {
        for (let index = 0; index < 5; index++) Q.pick("capacitor");
        Q.reward(true);
        Q.pick("chainstorm");
      }
      Q.enemy("skimmer", 0, -100, 100000);
      Q.step(0.01);
      const strokes = [];
      const original = CanvasRenderingContext2D.prototype.stroke;
      try {
        CanvasRenderingContext2D.prototype.stroke = function () {
          strokes.push(this.strokeStyle.toLowerCase());
          return original.apply(this, arguments);
        };
        Q.runRender();
      } finally {
        CanvasRenderingContext2D.prototype.stroke = original;
      }
      return strokes;
    });
  });
  ["#73d9e8", "#f4c57a", "#c49bef"].forEach((color, index) =>
    expect(stages[index]).toContain(color),
  );
});

test("v064 all three elites use distinct body sources and real attacks", async ({
  page,
}, info) => {
  await boot(page);
  const rows = await page.evaluate(() => {
    return ["hunter", "raider", "warden"].map((profile) => {
      const Q = SurvivorQA;
      const game = Q.startModel(91);
      game.active = {};
      game.spawnTime = 999;
      game.encounters.schedule = [];
      game.p.hp = game.p.maxhp = 10000;
      Q.enemy("elite", 0, -140, 100000, profile);
      game.enemy[0].fire = 0;
      Q.step(12);
      Q.runRender();
      return {
        profile,
        art: SurvivorBalance.assault.eliteProfiles[profile].art,
        damage: game.metrics.shipDamage,
        attacks: game.metrics.shots,
        barrier: game.enemy[0].barrier,
      };
    });
  });
  expect(new Set(rows.map((row) => row.art)).size).toBe(3);
  rows.forEach((row) => expect(row.damage).toBeGreaterThan(0));
  expect(rows[2].attacks["hostile-mine"]).toBeGreaterThanOrEqual(3);
  expect(rows[2].attacks["hostile-beam"]).toBeGreaterThan(0);
  expect(rows[2].attacks["hostile-shock"]).toBeGreaterThan(0);
  expect(rows[2].barrier).toBeGreaterThan(0);
  await info.attach("actual-three-elites", {
    body: Buffer.from(JSON.stringify(rows)),
    contentType: "application/json",
  });
});

test("v064900-second shots refractions and elite armor persist through an actual reload", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await page.evaluate(async () => {
    const Q = SurvivorQA;
    const game = Q.state();
    game.active = {};
    game.spawnTime = 999;
    game.p.inv = 999;
    for (const id of ["drone", "missile", "prism", "refraction"]) Q.pick(id);
    Q.enemy("elite", 0, -170, 100000, "warden");
    Q.step(0.05);
    game.mode = "pause";
    await Q.save();
    await Q.settled();
  });
  const before = await stored(page);
  const snapshot = before.active.snapshot.game;
  expect(snapshot.rules.runSeconds).toBe(900);
  expect(
    snapshot.shots.some((shot) => shot.kind === "drone" && !shot.homing),
  ).toBe(true);
  expect(
    snapshot.shots.some(
      (shot) => shot.kind === "crystal" && shot.bounces === 1,
    ),
  ).toBe(true);
  expect(snapshot.enemy[0].eliteProfile).toBe("warden");
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect(await stored(page)).toEqual(before);
  await page.locator("#continueBtn").click();
  await page.waitForFunction(
    () => SurvivorDemo.state()?.mode === "play" && !SurvivorDemo.saving(),
  );
  expect((await state(page)).rules.combatVersion).toBe(3);
  expect((await state(page)).endTime).toBe(900);
});

test("v064900-second deadline settles exactly once ahead of an XP pickup", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await page.evaluate(() => {
    const game = SurvivorQA.state();
    game.time = 899.999;
    game.xp = game.xpNext - 1;
    game.pickups = [{ x: game.p.x, y: game.p.y, type: "xp", value: 50, t: 10 }];
    SurvivorQA.step(1 / 60);
  });
  await expect(page.locator("#results")).toBeVisible();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  expect((await state(page)).time).toBe(900);
  expect((await stored(page)).profile.runs).toBe(1);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect((await stored(page)).profile.runs).toBe(1);
});

test("v064 actual elite hit flash preserves hull colors under concentrated fire", async ({
  page,
}) => {
  await boot(page);
  const alphas = await page.evaluate(() => {
    const Q = SurvivorQA;
    const game = Q.startModel(91);
    game.active = {};
    game.spawnTime = 999;
    Q.enemy("elite", 0, -120, 100000, "warden");
    game.enemy[0].flash = 0.09;
    const values = [];
    const original = CanvasRenderingContext2D.prototype.drawImage;
    try {
      CanvasRenderingContext2D.prototype.drawImage = function (image) {
        if (
          image instanceof HTMLCanvasElement &&
          image.width === 96 &&
          image.height === 96
        )
          values.push(this.globalAlpha);
        return original.apply(this, arguments);
      };
      Q.runRender();
    } finally {
      CanvasRenderingContext2D.prototype.drawImage = original;
    }
    return values;
  });
  expect(alphas).toHaveLength(1);
  expect(alphas[0]).toBeCloseTo(0.28, 6);
});

test("v064 legal two-fusion6plus6 maximum gear still takes late damage without movement", async ({
  page,
}, info) => {
  await boot(page);
  const result = await page.evaluate(() => {
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
        if (!Q.pick(id)) throw Error("Rejected " + id);
    }
    function evolve(id) {
      equip(id);
      equip(recipes[id][0]);
      Q.reward(true);
      if (!Q.pick(recipes[id][1])) throw Error("Rejected EVO " + id);
    }
    for (const [first, second, fusion] of [
      ["cannon", "shield", "ionbastion"],
      ["drone", "arc", "thunderhive"],
    ]) {
      evolve(first);
      evolve(second);
      Q.reward(true);
      if (!Q.pick(fusion)) throw Error("Rejected fusion " + fusion);
    }
    evolve("prism");
    evolve("gravity");
    equip("missile");
    equip("blade");
    game.time = 840;
    game.p.inv = 0;
    game.xpNext = 1e9; // Explicit fixed build with no XP heal choices.
    game.encounters.schedule = [];
    game.milestoneSeen = SurvivorBalance.assault.milestones
      .filter((milestone) => milestone.at <= 840)
      .map((milestone) => milestone.type + ":" + milestone.at);
    Q.step(45);
    Q.runRender();
    Q.validate(Q.snapshot());
    return {
      activeSlots:
        Object.keys(game.active).length + Object.keys(game.fused).length,
      passiveSlots: Object.keys(game.passive).length,
      seconds: game.time - 840,
      hp: game.p.hp,
      maxhp: game.p.maxhp,
      damage: game.metrics.shipDamage,
      blocked: game.metrics.shieldsBlocked,
    };
  });
  expect(result.activeSlots).toBe(6);
  expect(result.passiveSlots).toBe(6);
  expect(result.damage).toBeGreaterThan(0);
  expect(result.hp).toBeLessThan(result.maxhp);
  await info.attach("explicit-maximum-build-standing-pressure", {
    body: Buffer.from(JSON.stringify(result)),
    contentType: "application/json",
  });
});
