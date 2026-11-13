/* v066 actual controller regressions. HTTP persistence tests are separate. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createModel } = require("./model-harness.cjs");
(async () => {
  const Q = (await createModel()).SurvivorQA;
  const file = path.resolve(
    process.env.SURVIVOR_MODEL_OUT || "releases/survivor-v066-model.json",
  );
  const report = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file))
    : { passed: 0, cases: [], errors: [] };
  function start(seed = 91) {
    const game = Q.startModel(seed);
    game.spawnTime = 9999;
    game.p.inv = 10000;
    game.encounters.schedule = [];
    return game;
  }
  async function test(name, run) {
    try {
      const detail = await run();
      report.passed++;
      report.cases.push({ name: "v066 " + name, detail: detail || null });
      console.log("PASS v066", name);
    } catch (error) {
      report.errors.push({ name: "v066 " + name, message: error.stack });
      console.error("FAIL v066", name, error.message);
      process.exitCode = 1;
    }
  }
  await test("new rules5 preserve fifteen minutes and the existing 5+5 limits", () => {
    const game = start();
    assert.equal(game.rules.combatVersion, 5);
    assert.equal(game.endTime, 900);
    for (let n = 1; n < 5; n++) assert(Q.pick("cannon"));
    for (let n = 0; n < 4; n++) assert(Q.pick("lens"));
    Q.reward(true);
    assert(!Q.pick("piercebeam"));
    assert(Q.pick("lens"));
    Q.reward(true);
    assert(Q.pick("piercebeam"));
    Q.validate(Q.snapshot());
  });
  await test("low health offers optional repair below35percent and never applies it automatically", () => {
    const game = start();
    game.p.hp = 34;
    Q.level();
    assert(game.presented.some((option) => option.id === "repair"));
    assert.equal(game.p.hp, 34);
    assert(
      Q.select(game.presented.findIndex((option) => option.id === "repair")),
    );
    assert.equal(game.p.hp, 62);
    assert(!Q.select(0));
    Q.validate(Q.snapshot());
  });
  await test("escort orbit shrinks modestly and remains outside the crystal band", () => {
    const game = start();
    game.active = { drone: 1, prism: 1 };
    Q.enemy("skimmer", 0, -220, 100000);
    Q.step(0.001);
    const shot = game.shots.find((item) => item.kind === "drone");
    const radius = Math.hypot(shot.x - game.p.x, shot.y - game.p.y);
    assert(radius > 100 && radius < 121, String(radius));
    return { radius };
  });
  await test("all five elites have triple saved hull while ordinary enemies and bosses retain prior values", () => {
    const values = [];
    for (const type of ["skimmer", "boss", "elite"]) {
      for (const profile of type === "elite"
        ? ["hunter", "raider", "warden", "reaver", "hive"]
        : ["hunter"]) {
        const game = start();
        game.time = 350;
        Q.spawn(type, 2, profile);
        const hp = game.enemy[0].maxhp;
        start();
        Q.legacyV065();
        Q.state().time = 350;
        Q.spawn(type, 2, profile);
        const old = Q.state().enemy[0].maxhp;
        assert(Math.abs(hp - old * (type === "elite" ? 3 : 1)) <= 2);
        values.push({ type, profile, old, hp });
        Q.validate(Q.snapshot());
      }
    }
    return values;
  });
  await test("elite repair pack survives a saturated pickup field and heals once up to the hull cap", () => {
    const game = start();
    game.p.hp = 70;
    game.pickups = Array.from({ length: 140 }, () => ({
      x: 3000,
      y: 3000,
      type: "xp",
      value: 1,
      t: 30,
    }));
    Q.enemy("elite", 0, -70, 1);
    Q.step(0.6);
    const packs = game.pickups.filter((item) => item.type === "heal");
    assert.equal(packs.length, 1);
    assert.equal(packs[0].value, 24);
    assert(game.pickups.length <= 140);
    const pack = packs[0];
    game.presented = [];
    game.upgradeSource = null;
    game.mode = "play";
    game.p.x = pack.x;
    game.p.y = pack.y;
    Q.step(0.01);
    assert.equal(game.p.hp, 94);
    assert(game.texts.some((item) => item.s === "船体 +24"));
    Q.step(0.01);
    assert.equal(game.p.hp, 94);
    game.pickups.push({
      x: game.p.x,
      y: game.p.y,
      type: "heal",
      value: 24,
      t: 40,
    });
    Q.step(0.01);
    assert.equal(game.p.hp, game.p.maxhp);
    Q.validate(Q.snapshot());
  });
  await test("elite lottery grants1to3 total owned equipment levels, with real misses for evolution", () => {
    const counts = new Set(),
      targets = new Set();
    for (let seed = 1; seed <= 500; seed++) {
      const game = start(seed);
      game.active = { cannon: 1, drone: 1 };
      game.passive = { lens: 1, lock: 1 };
      Q.reward(false);
      const option = game.presented.find((item) => item.kind === "cache");
      assert(option, "a committed random cache is shown");
      const levels = option.grants.reduce(
        (sum, grant) => sum + grant.level - grant.from,
        0,
      );
      assert(levels >= 1 && levels <= 3);
      counts.add(levels);
      const before = JSON.parse(
        JSON.stringify({ active: game.active, passive: game.passive }),
      );
      for (const grant of option.grants) {
        assert(before[grant.kind][grant.id] > 0);
        targets.add(grant.kind);
      }
      const snapshot = Q.snapshot();
      Q.validate(snapshot);
      assert(Q.select(game.presented.indexOf(option)));
      let delta = 0;
      for (const kind of ["active", "passive"])
        for (const [id, level] of Object.entries(game[kind]))
          delta += level - before[kind][id];
      assert.equal(delta, levels);
      assert(!Q.select(0), "a second tap cannot award the same cache");
      assert.deepEqual(snapshot.game.upgradeSource.loot, option.grants);
      Q.validate(Q.snapshot());
    }
    assert.deepEqual([...counts].sort(), [1, 2, 3]);
    assert.equal(targets.size, 2);
  });
  await test("random levels clamp to5, cannot auto-evolve, and preserve armor hull benefits", () => {
    const game = start();
    game.active = { cannon: 5 };
    game.passive = { armor: 4 };
    const hp = game.p.maxhp;
    Q.reward(false);
    const option = game.presented.find((item) => item.kind === "cache");
    assert.equal(option.grants.length, 1);
    assert.equal(option.grants[0].level, 5);
    assert(Q.select(game.presented.indexOf(option)));
    assert.equal(game.p.maxhp, hp + 5);
    assert.equal(game.passive.armor, 5);
    assert.deepEqual(Object.keys(game.evolved), []);
    Q.reward(false);
    assert(game.presented.every((item) => item.kind === "bonus"));
    Q.validate(Q.snapshot());
  });
  await test("tampered, duplicated and stale lottery grants are rejected without changing equipment", () => {
    const game = start();
    Q.reward(false);
    const snapshot = Q.snapshot();
    const bad = structuredClone(snapshot);
    bad.game.upgradeSource.loot[0].level = 100;
    assert.throws(() => Q.validate(bad));
    const duplicate = structuredClone(snapshot);
    duplicate.game.upgradeSource.loot.push(
      duplicate.game.upgradeSource.loot[0],
    );
    assert.throws(() => Q.validate(duplicate));
    const option = game.presented.find((item) => item.kind === "cache");
    option.grants[0].level = 100;
    assert(!Q.select(game.presented.indexOf(option)));
    assert.equal(game.active.cannon, 1);
    Q.validate(Q.snapshot());
  });
  await test("saturated mixed drops keep XP and cash separate from combined repair", () => {
    const game = start();
    game.pickups = [
      { x: 3000, y: 3000, type: "xp", value: 7, t: 30 },
      { x: 3000, y: 3000, type: "scrap", value: 9, t: 30 },
      ...Array.from({ length: 138 }, () => ({
        x: 3000,
        y: 3000,
        type: "heal",
        value: 2,
        t: 30,
      })),
    ];
    Q.enemy("elite", 0, -70, 1);
    Q.step(0.6);
    const sum = (type) =>
      game.pickups
        .filter((item) => item.type === type)
        .reduce((total, item) => total + item.value, 0);
    assert.equal(sum("xp"), 7);
    assert.equal(sum("scrap"), 9);
    assert.equal(sum("heal"), 138 * 2 + 24);
    assert.equal(game.pickups.length, 140);
  });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
})();
