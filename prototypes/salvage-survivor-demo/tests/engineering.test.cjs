/* Current controller regressions. Store transactions have real HTTP browser tests. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const { createModel } = require("./model-harness.cjs");
(async () => {
  const context = await createModel(),
    Q = context.SurvivorQA;
  const file = path.resolve(
    process.env.SURVIVOR_MODEL_OUT || "releases/survivor-v067-model.json",
  );
  const report = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file))
    : { passed: 0, cases: [], errors: [] };
  function start(perks = {}) {
    const g = Q.startModel(91, perks);
    g.spawnTime = 9999;
    g.p.inv = 9999;
    g.encounters.schedule = [];
    return g;
  }
  async function test(name, run) {
    try {
      const detail = await run();
      report.passed++;
      report.cases.push({ name: "v067 " + name, detail: detail || null });
      console.log("PASS v067", name);
    } catch (error) {
      report.errors.push({ name: "v067 " + name, message: error.stack });
      console.error("FAIL v067", name, error.message);
      process.exitCode = 1;
    }
  }
  await test("repair module occupies a real weapon slot and five levels restore actual hull each active second", () => {
    const g = start();
    assert.equal(g.rules.combatVersion, 6);
    g.p.hp = 40;
    assert(Q.pick("repairpod"));
    assert.equal(Object.keys(g.active).length, 2);
    Q.step(4);
    assert(Math.abs(g.p.hp - 41) < 0.001);
    for (let i = 1; i < 5; i++) assert(Q.pick("repairpod"));
    const before = g.p.hp;
    Q.step(4);
    assert(Math.abs(g.p.hp - before - 3.6) < 0.001);
    assert(!Q.pick("repairpod"));
    Q.validate(Q.snapshot());
    return { hp: g.p.hp, level: g.active.repairpod };
  });
  await test("full hull caps repair and paused or upgrade time never regenerates", () => {
    const g = start();
    assert(Q.pick("repairpod"));
    g.p.hp = 99.9;
    Q.step(5);
    assert.equal(g.p.hp, 100);
    g.p.hp = 50;
    g.mode = "pause";
    Q.step(10);
    assert.equal(g.p.hp, 50);
    Q.level();
    Q.step(10);
    assert.equal(g.p.hp, 50);
    Q.validate(Q.snapshot());
  });
  await test("repair module cannot appear as a seventh weapon or evolve without a recipe", () => {
    const g = start();
    g.active = { cannon: 1, drone: 1, arc: 1, missile: 1, prism: 1, blade: 1 };
    assert(!Q.options().some((o) => o.id === "repairpod"));
    delete g.active.prism;
    assert(Q.pick("repairpod"));
    assert.equal(Object.keys(g.active).length, 6);
    Q.reward(true);
    assert(
      !Q.options().some((o) => o.kind === "evo" && o.source === "repairpod"),
    );
    Q.validate(Q.snapshot());
  });
  await test("current elites award equipment but no field heal while legacy rule5 retains repair drops", () => {
    for (const old of [false, true]) {
      const g = start();
      if (old) Q.legacyV066();
      Q.enemy("elite", 0, -70, 1);
      Q.step(0.7);
      assert.equal(
        g.pickups.some((p) => p.type === "heal"),
        old,
      );
      Q.validate(Q.snapshot());
    }
  });
  await test("all three committed lottery levels render their own labelled icons, including repeats", () => {
    const g = start();
    g.upgradeSource = {
      kind: "boss",
      id: 1,
      advancedRoll: false,
      loot: [{ id: "cannon", kind: "active", from: 1, level: 4 }],
    };
    g.bossRewards.ids = [1];
    Q.refreshUpgrades();
    const html = context.document.getElementById("upgradeList").innerHTML;
    assert.equal((html.match(/class="loot-award"/g) || []).length, 3);
    assert.equal((html.match(/data-equipment="cannon"/g) || []).length, 3);
    Q.validate(Q.snapshot());
  });
  await test("three separated rings share render and hit geometry with room for their physical bodies", () => {
    const g = start();
    g.active = { cannon: 1, drone: 1, prism: 1, blade: 1 };
    const o = Q.orbits();
    assert(o.drone.every((p) => Math.hypot(p.x - g.p.x, p.y - g.p.y) <= 74));
    const crystal = Math.hypot(o.prism[0].x - g.p.x, o.prism[0].y - g.p.y);
    assert(crystal >= 100 && crystal <= 110);
    assert(o.bladeRadius >= 144);
    assert(o.bladeRadius - crystal >= 38);
    const e = Q.enemy("skimmer", g.p.x + o.bladeRadius, g.p.y, 1000);
    g.active = { blade: 1 };
    Q.step(0.001);
    assert(
      g.enemy.find((x) => x.id === e).hp < 1000,
      "outer blade actually deals damage",
    );
    Q.validate(Q.snapshot());
  });
  await test("permanent engineering has real saved speed recovery radius and damage effects", () => {
    const g = start({
      engineering: { version: 1, thrusters: 6, salvage: 6, plating: 6 },
    });
    assert(Math.abs(g.p.speed - 196) < 0.001);
    assert.equal(g.engineering.salvage, 6);
    g.p.inv = 0;
    Q.forceDamage(20);
    assert(Math.abs(g.p.hp - 82.4) < 0.001);
    Q.validate(Q.snapshot());
    const bad = Q.snapshot();
    bad.game.engineering.thrusters = 99;
    assert.throws(() => Q.validate(bad));
  });
  await test("old rule5 snapshots keep their exact orbit and healing behavior", () => {
    const g = start();
    Q.legacyV066();
    g.active = { drone: 1, prism: 1 };
    Q.enemy("skimmer", 0, -220, 100000);
    Q.step(0.001);
    const s = g.shots.find((x) => x.kind === "drone");
    assert(Math.hypot(s.x - g.p.x, s.y - g.p.y) > 110);
    Q.validate(Q.snapshot());
  });
  await test("critical hull exposes both upgrade-based repair and the slot-based module", () => {
    const g = start();
    g.p.hp = 34;
    Q.level();
    assert(g.presented.some((o) => o.id === "repair"));
    assert(g.presented.some((o) => o.id === "repairpod"));
    assert(Q.select(g.presented.findIndex((o) => o.id === "repairpod")));
    assert.equal(g.p.hp, 34);
    assert.equal(g.active.repairpod, 1);
    Q.step(4);
    assert(Math.abs(g.p.hp - 35) < 0.001);
  });
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
})();
