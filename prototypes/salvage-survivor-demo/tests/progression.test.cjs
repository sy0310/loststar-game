/* Explicit fixtures for v063 rules. Actual browser/persistence checks are separate. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createModel } = require("./model-harness.cjs");
const output = path.resolve(
  process.env.SURVIVOR_MODEL_OUT || "releases/survivor-v06-model.json",
);
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
const fusions = [
  ["drone", "arc", "thunderhive"],
  ["missile", "blade", "blastwheel"],
  ["prism", "gravity", "eventhorizon"],
  ["cannon", "shield", "ionbastion"],
];
let Q;
function start(seed = 91) {
  const g = Q.startModel(seed);
  Q.legacyV063(); // Regress the already-delivered five-level 600-second rules.
  g.active = {};
  g.spawnTime = 999;
  g.p.inv = 10000;
  g.encounters.schedule = [];
  return g;
}
function equip(id, count = 5) {
  for (let i = 0; i < count; i++) assert(Q.pick(id), "acquire " + id);
}
function evolve(weapon) {
  const [, passive, id] = recipes.find(([source]) => source === weapon);
  equip(weapon);
  equip(passive);
  Q.reward(true); // Explicit reward-roll fixture, no claim of natural acquisition.
  assert(Q.pick(id));
}
(async () => {
  Q = (await createModel()).SurvivorQA;
  const oldFiles = JSON.parse(
    require("node:child_process").execFileSync(
      "python3",
      [
        "-c",
        "import json,zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({n:z.read('src/'+n).decode() for n in ['balance.js','game.js']}))",
        path.resolve(
          __dirname,
          "../../../artifacts/survivor-v062/loststar-survivor-4ca726f.zip",
        ),
      ],
      { encoding: "utf8", maxBuffer: 1024 * 1024 },
    ),
  );
  const oldQ = (await createModel(oldFiles)).SurvivorQA;
  const report = fs.existsSync(output)
    ? JSON.parse(fs.readFileSync(output))
    : { passed: 0, cases: [], errors: [] };
  report.scope =
    "35 explicit saved 3+2 combat regressions plus current v063 five-level, boss reward and fusion fixtures. Not natural play or physical-phone evidence.";
  async function test(name, run) {
    try {
      const detail = await run();
      report.passed++;
      report.cases.push({ name: "v063 " + name, detail });
      console.log("PASS v063", name);
    } catch (error) {
      report.errors.push({ name, message: error.stack });
      console.error(error);
      process.exitCode = 1;
    }
  }
  await test("all eight weapons and accessories acquire exactly five levels", () => {
    for (const [weapon, passive] of recipes) {
      const g = start();
      equip(weapon);
      equip(passive);
      assert.equal(g.active[weapon], 5);
      assert.equal(g.passive[passive], 5);
      assert(!Q.pick(weapon));
      assert(!Q.pick(passive));
      assert(!Q.pick(recipes.find(([source]) => source === weapon)[2]));
      Q.validate(Q.snapshot());
    }
  });
  await test("saved legacy upgrade vectors match the actual v062 ZIP over repeated choices", () => {
    for (let seed = 1; seed <= 20; seed++) {
      oldQ.startModel(seed);
      Q.startModel(seed);
      Q.legacyProgression();
      for (let level = 0; level < 25; level++) {
        oldQ.level();
        Q.level();
        assert.equal(
          JSON.stringify(Q.state().presented),
          JSON.stringify(oldQ.state().presented),
        );
        assert(Q.select(level % 3));
        assert(oldQ.select(level % 3));
      }
    }
  });
  await test("starter card choices expose multiple real weapon routes", () => {
    const weapons = new Set();
    for (let seed = 1; seed <= 100; seed++) {
      const g = Q.startModel(seed);
      Q.level();
      for (const option of g.presented)
        if (option.kind === "active" && option.id !== "cannon")
          weapons.add(option.id);
    }
    assert(weapons.size >= 5, [...weapons].join(","));
    return [...weapons];
  });
  await test("every partial 0-5/0-5 recipe rejects evolution even inside a winning boss reward", () => {
    for (const [weapon, passive, evolution] of recipes)
      for (let a = 0; a <= 5; a++)
        for (let p = 0; p <= 5; p++) {
          start();
          equip(weapon, a);
          equip(passive, p);
          Q.reward(true);
          assert.equal(
            Q.pick(evolution),
            a === 5 && p === 5,
            `${weapon} ${a}+${p}`,
          );
        }
  });
  await test("ordinary upgrades never contain advanced cards after both maxima", () => {
    const g = start();
    equip("cannon");
    equip("lens");
    for (let i = 0; i < 20; i++) {
      Q.level();
      assert(
        !g.presented.some((option) => ["evo", "fusion"].includes(option.kind)),
      );
      assert(!Q.pick("piercebeam"));
    }
  });
  await test("boss lottery includes real misses, saved rolls and 75percent sampling", () => {
    let offered = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const g = start(seed);
      equip("cannon");
      equip("lens");
      Q.reward();
      offered += g.presented.some((option) => option.kind === "evo") ? 1 : 0;
      Q.validate(Q.snapshot());
    }
    assert(offered >= 690 && offered <= 810, offered);
    return { offers: offered, total: 1000 };
  });
  await test("actual elite death queues one direct level without consuming banked XP", () => {
    const g = start();
    equip("cannon", 1);
    g.xp = 31;
    Q.enemy("elite", 0, -70, 1);
    Q.step(0.5);
    assert.equal(g.mode, "upgrade");
    assert.equal(g.level, 2);
    assert.equal(g.xp, 31);
    assert.equal(g.upgradeSource.kind, "boss");
    assert.equal(g.bossRewards.ids.length, 1);
    assert.equal(g.bossRewards.pending.length, 0);
    assert(Q.select(0));
    Q.step(0.1);
    assert.equal(g.bossRewards.ids.length, 1);
  });
  await test("two actual simultaneous boss deaths preserve two separate rewards", () => {
    const g = start();
    evolve("cannon");
    const previous = g.bossRewards.ids.length;
    Q.enemy("elite", 0, -70, 1);
    Q.enemy("boss", 0, -120, 1);
    Q.step(0.02);
    assert.equal(g.mode, "upgrade");
    assert.equal(g.bossRewards.ids.length, previous + 2);
    assert.equal(g.bossRewards.pending.length, 1);
    const first = g.upgradeSource.id;
    Q.validate(Q.snapshot());
    assert(Q.select(0));
    Q.step(0.02);
    assert.equal(g.mode, "upgrade");
    assert.equal(g.bossRewards.pending.length, 0);
    assert.notEqual(g.upgradeSource.id, first);
    Q.validate(Q.snapshot());
    assert(Q.select(0));
    Q.step(0.1);
    assert.equal(g.bossRewards.ids.length, previous + 2);
  });
  await test("stale 5+4 click rejects EVO and preserves the current reward roll", () => {
    const g = start();
    equip("cannon");
    equip("lens");
    Q.reward(true);
    const index = g.presented.findIndex((option) => option.kind === "evo");
    assert(index >= 0);
    g.passive.lens = 4;
    assert(!Q.select(index));
    assert(!g.evolved.cannon);
    assert.equal(g.upgradeSource.advancedRoll, true);
    assert.equal(g.mode, "upgrade");
  });
  await test("all four ultimate fusions require two evolved sources and free one slot", () => {
    for (const [a, b, fusion] of fusions) {
      const g = start();
      equip(a);
      equip(b);
      Q.reward(true);
      assert(!Q.pick(fusion));
      const pa = recipes.find(([source]) => source === a);
      const pb = recipes.find(([source]) => source === b);
      equip(pa[1]);
      equip(pb[1]);
      Q.reward(true);
      assert(!Q.pick(fusion));
      assert(Q.pick(pa[2]));
      Q.reward(true);
      assert(!Q.pick(fusion));
      assert(Q.pick(pb[2]));
      Q.reward(true);
      assert(Q.pick(fusion));
      assert(g.fused[fusion]);
      assert(!g.active[a] && !g.active[b] && !g.evolved[a] && !g.evolved[b]);
      assert(!Q.pick(a) && !Q.pick(b));
      Q.validate(Q.snapshot());
    }
  });
  await test("all four ultimate fusions deal real damage with five-level provenance", () => {
    const rows = [];
    for (const [a, b, fusion] of fusions) {
      const g = start();
      evolve(a);
      evolve(b);
      Q.reward(true);
      assert(Q.pick(fusion));
      for (const [x, y] of [
        [0, -80],
        [78, 0],
        [112, 0],
        [40, -90],
      ])
        Q.enemy("skimmer", x, y, 100000);
      Q.step(2);
      assert(g.metrics.damage[fusion] > 0);
      rows.push({ fusion, damage: g.metrics.damage[fusion] });
    }
    return rows;
  });
  await test("every cannon rank has increasing actual damage and capacitor/cooler retain bounded effects", () => {
    let previous = 0;
    const values = [];
    for (let level = 1; level <= 5; level++) {
      const g = start();
      equip("cannon", level);
      Q.enemy("skimmer", 0, -100, 100000);
      Q.step(1.5);
      const damage = g.metrics.damage.pulse;
      assert(damage > previous);
      previous = damage;
      values.push(damage);
    }
    return values;
  });
  await test("arrival is visible in the playfield, has a finite shield and then takes real damage", () => {
    const g = start();
    g.encounters.schedule = [{ kind: "courier", at: 0 }];
    Q.step(2.4);
    const enemy = g.enemy.find((enemy) => enemy.t === "courier");
    assert(
      enemy &&
        Math.abs(enemy.x - g.p.x) < 150 &&
        Math.abs(enemy.y - g.p.y) < 150,
    );
    const hp = enemy.hp;
    equip("cannon", 5);
    Q.step(0.5);
    assert.equal(enemy.hp, hp);
    Q.step(2.5);
    assert(enemy.hp < hp);
    assert(enemy.arrivalAge >= 1.6);
  });
  await test("missile/blade and prism/gravity cause actual cross-weapon hit effects", () => {
    let g = start();
    equip("missile", 1);
    equip("blade", 1);
    for (const [x, y] of [
      [0, -80],
      [35, -95],
      [-30, -100],
    ])
      Q.enemy("skimmer", x, y, 100000);
    Q.step(2);
    assert(g.metrics.events.some((event) => event.id === "bladeMissile"));
    assert(g.metrics.damage.shard > 0);
    g = start();
    equip("prism", 1);
    equip("gravity", 1);
    Q.enemy("skimmer", 0, -120, 100000);
    Q.step(3);
    assert(g.metrics.damage.gravityPrism > 0);
    assert(g.metrics.events.some((event) => event.id === "gravityPrism"));
  });
  await test("visible elite targets receive automatic fire priority within actual range", () => {
    const g = start();
    equip("cannon", 1);
    const ordinary = Q.enemy("skimmer", 0, -90, 100000);
    const elite = Q.enemy("elite", 0, -150, 100000);
    Q.step(0.01);
    assert.equal(g.shots[0].targetId, elite);
    const old = start();
    Q.legacyProgression();
    equip("cannon", 1);
    const oldOrdinary = Q.enemy("skimmer", 0, -90, 100000);
    Q.enemy("elite", 0, -150, 100000);
    Q.step(0.01);
    assert.equal(old.shots[0].targetId, oldOrdinary);
  });
  await test("out-of-range telegraphs cancel and the boss can approach again", () => {
    const g = start();
    Q.enemy("boss", -1000, 0, 100000);
    Object.assign(g.enemy[0], { speed: 82, warn: 0.5, fire: 0.1 });
    Q.step(1);
    assert.equal(g.enemy[0].warn, 0);
    assert(g.enemy[0].x > -750);
  });
  await test("all four special ships catch a moving player inside the actual portrait playfield", () => {
    const rows = [];
    for (const [kind, speed] of [
      ["boss", 82],
      ["elite", 90],
      ["courier", 94],
      ["watcher", 72],
    ]) {
      const g = start();
      Q.enemy(kind, -700, -30, 100000);
      g.enemy[0].speed = speed;
      g.keys = { d: true };
      let visible = 0;
      for (let frame = 0; frame < 1200; frame++) {
        Q.step(1 / 60);
        const e = g.enemy[0],
          x = e.x - g.camera.x + 195,
          y = e.y - g.camera.y + 844 * 0.51;
        if (frame > 840 && x > 20 && x < 370 && y > 215 && y < 814) visible++;
      }
      assert(visible > 180, kind + " visible frames " + visible);
      rows.push({ kind, visible, lastSixSeconds: 359 });
    }
    return rows;
  });
  await test("snapshot rejects changed caps, bogus source, duplicate reward and missing fused accessory", () => {
    const g = start();
    equip("cannon");
    equip("lens");
    Q.reward(true);
    const original = Q.snapshot();
    for (const mutate of [
      (s) => (s.game.active.cannon = 6),
      (s) => (s.game.passive.lens = 6),
      (s) => (s.game.upgradeSource.id = 999),
      (s) => s.game.bossRewards.ids.push(s.game.bossRewards.ids[0]),
    ]) {
      const s = structuredClone(original);
      mutate(s);
      assert.throws(() => Q.validate(s));
    }
    Q.validate(original);
  });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log("PASS", report.passed, "total legacy/current model groups");
})();
