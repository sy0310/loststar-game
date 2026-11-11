const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { createModel } = require("./model-harness.cjs");
const output = path.resolve(
  process.env.SURVIVOR_MODEL_OUT || "releases/survivor-v06-model.json",
);
const report = {
  scope:
    "Actual game functions in a unit DOM adapter. Explicit enemy/equipment/clock fixtures. Not browser, phone or natural-play evidence.",
  passed: 0,
  cases: [],
  errors: [],
};
const evo = [
  ["cannon", "lens", "piercebeam"],
  ["drone", "lock", "hunterswarm"],
  ["arc", "capacitor", "chainstorm"],
  ["missile", "cooler", "meteorbarrage"],
  ["blade", "magnet", "spiralsaw"],
  ["shield", "armor", "reactiveaegis"],
];
let context, Q;
function start(seed = 91, perks = {}) {
  const g = Q.startModel(seed, perks);
  g.active = {};
  g.p.inv = 10000;
  g.spawnTime = 999;
  g.upgradeGrace = 0;
  return g;
}
function equip(id, level) {
  for (let index = 0; index < level; index++)
    assert(Q.pick(id), "legal acquisition " + id);
}
function enemies(points) {
  return points.map(([x, y]) => Q.enemy("skimmer", x, y, 100000));
}
function setup(active, passive, evolved) {
  const g = start();
  equip(active, 3);
  if (passive) equip(passive, 2);
  if (evolved) assert(Q.pick(evo.find((row) => row[0] === active)[2]));
  g.upgradeGrace = 0;
  return g;
}
async function test(name, run) {
  try {
    const detail = await run();
    report.passed++;
    report.cases.push({ name, detail: detail || null });
    console.log("PASS", name);
  } catch (error) {
    report.errors.push({ name, message: error.stack });
    console.error("FAIL", name, error);
    process.exitCode = 1;
  }
}
(async () => {
  context = await createModel();
  Q = context.SurvivorQA;
  await test("six EVO prerequisites and mutual exclusion are actual legal choices", () => {
    for (const [active, passive, id] of evo) {
      start();
      equip(active, 2);
      equip(passive, 2);
      assert(!Q.pick(id));
      equip(active, 1);
      assert(Q.pick(id));
      assert.equal(Q.state().evolved[active], id);
      assert(!Q.pick(id));
    }
  });
  await test("piercebeam immediately damages a whole line including beyond basic range", () => {
    setup("cannon", "lens", false);
    const basicIds = enemies([
      [0, -90],
      [0, -230],
      [0, -510],
    ]);
    Q.step(1 / 60);
    const before = Q.state().enemy.map((enemy) => enemy.hp);
    setup("cannon", "lens", true);
    const ids = enemies([
      [0, -90],
      [0, -230],
      [0, -510],
    ]);
    Q.step(1 / 60);
    const g = Q.state();
    assert(g.metrics.damage.piercebeam > 0);
    assert(g.beams.length > 0);
    assert(g.enemy.every((enemy, index) => enemy.hp < before[index]));
    return { targets: ids.length, damage: g.metrics.damage.piercebeam };
  });
  await test("hunter swarm produces more actual homing fire and damage than basic drones", () => {
    setup("drone", "lock", false);
    enemies([
      [0, -100],
      [35, -120],
    ]);
    Q.step(1.4);
    const base = {
      shots: Q.state().metrics.shots.drone,
      damage: Q.state().metrics.damage.drone || 0,
    };
    setup("drone", "lock", true);
    enemies([
      [0, -100],
      [35, -120],
    ]);
    Q.step(1.4);
    const g = Q.state();
    assert(g.metrics.shots.drone > base.shots);
    assert(g.metrics.damage.drone > base.damage);
    return {
      base,
      evolved: { shots: g.metrics.shots.drone, damage: g.metrics.damage.drone },
    };
  });
  await test("chainstorm reaches the far second target and actually interrupts movement", () => {
    setup("arc", "capacitor", false);
    enemies([
      [0, -220],
      [0, -510],
    ]);
    Q.step(1 / 60);
    const base = Q.state().enemy[1].hp;
    setup("arc", "capacitor", true);
    enemies([
      [0, -220],
      [0, -510],
    ]);
    Q.step(1 / 60);
    const g = Q.state();
    assert(g.enemy[1].hp < base);
    assert(g.enemy[0].disabled > 0);
    assert(g.arcs.length <= 4);
    assert(g.metrics.damage.chainstorm > 0);
    return { farTargetBefore: base, after: g.enemy[1].hp };
  });
  await test("meteor barrage launches four sequential missiles and causes greater real area damage", () => {
    setup("missile", "cooler", false);
    enemies([
      [-20, -110],
      [10, -115],
      [35, -120],
    ]);
    Q.step(2);
    const base = {
      shots: Q.state().metrics.shots.missile,
      damage: Q.state().metrics.damage.missile || 0,
    };
    setup("missile", "cooler", true);
    enemies([
      [-20, -110],
      [10, -115],
      [35, -120],
    ]);
    Q.step(2);
    const g = Q.state();
    assert(g.metrics.shots.missile > base.shots);
    assert(g.metrics.damage.meteorbarrage > 0);
    assert(
      (g.metrics.damage.missile || 0) + g.metrics.damage.meteorbarrage >
        base.damage,
    );
    return {
      base,
      shots: g.metrics.shots.missile,
      areaDamage: g.metrics.damage.meteorbarrage,
    };
  });
  await test("spiralsaw hits outside the old orbit and extends real pickup attraction", () => {
    setup("blade", "magnet", false);
    enemies([[90, 0]]);
    Q.state().pickups = [{ x: 290, y: 0, t: 30, type: "xp", value: 8 }];
    Q.step(0.15);
    const base = { hp: Q.state().enemy[0].hp, pickup: Q.state().pickups[0].x };
    setup("blade", "magnet", true);
    enemies([[90, 0]]);
    Q.state().pickups = [{ x: 290, y: 0, t: 30, type: "xp", value: 8 }];
    Q.step(0.15);
    const g = Q.state();
    assert(g.enemy[0].hp < base.hp);
    assert(g.pickups[0].x < base.pickup);
    assert(g.metrics.damage.spiralsaw > 0);
    return { base, evolved: { hp: g.enemy[0].hp, pickup: g.pickups[0].x } };
  });
  await test("reactive aegis blocks, damages nearby enemies and recharges earlier", () => {
    const values = [];
    for (const upgraded of [false, true]) {
      setup("shield", "armor", upgraded);
      enemies([[90, 0]]);
      Q.step(1 / 60);
      const g = Q.state();
      g.p.inv = 0;
      const hp = g.p.hp;
      Q.forceDamage(30);
      assert.equal(g.p.hp, hp);
      assert.equal(g.p.shield, 0);
      assert.equal(g.metrics.shieldsBlocked, 1);
      values.push({
        enemy: g.enemy[0].hp,
        cooldown: g.p.shieldCooldown,
        damage: g.metrics.damage.reactiveaegis || 0,
      });
      Q.step(3.5);
      values.at(-1).shieldAfter3point5 = g.p.shield;
    }
    assert(values[1].enemy < values[0].enemy);
    assert(values[1].cooldown < values[0].cooldown);
    assert.equal(values[1].shieldAfter3point5, 1);
    assert.equal(values[0].shieldAfter3point5, 0);
    return values;
  });
  for (const [a, b, id] of [
    ["drone", "arc", "thunderhive"],
    ["missile", "blade", "blastwheel"],
  ])
    await test(
      id +
        " consumes two full weapons, frees a slot and deals its own combat damage",
      () => {
        const g = start();
        equip(a, 2);
        equip(b, 3);
        assert(!Q.pick(id));
        equip(a, 1);
        const before = Object.keys(g.active).length;
        assert(Q.pick(id));
        assert(!g.active[a] && !g.active[b]);
        assert.equal(
          Object.keys(g.active).length + Object.keys(g.fused).length,
          before - 1,
        );
        assert(!Q.options().some((option) => [a, b].includes(option.id)));
        enemies(
          id === "blastwheel"
            ? [
                [78, 0],
                [112, 0],
              ]
            : [
                [0, -75],
                [35, -75],
                [65, -80],
              ],
        );
        Q.step(id === "blastwheel" ? 0.06 : 1);
        assert(g.metrics.damage[id] > 0);
        assert(g.enemy[1].hp < 100000);
        return {
          slotsBefore: before,
          slotsAfter:
            Object.keys(g.active).length + Object.keys(g.fused).length,
          damage: g.metrics.damage[id],
        };
      },
    );
  await test("a single-weapon evolution prevents later double-weapon fusion", () => {
    start();
    equip("drone", 3);
    equip("lock", 2);
    assert(Q.pick("hunterswarm"));
    equip("arc", 3);
    assert(!Q.pick("thunderhive"));
  });
  await test("all four low-level synergies cause real damage or shielding", () => {
    const results = {};
    start();
    equip("cannon", 1);
    equip("arc", 1);
    Q.state().attackClock.arc = 999;
    enemies([
      [75, 0],
      [140, 0],
    ]);
    Q.step(0.4);
    results.pulseArc = Q.state().metrics.damage.pulseArc || 0;
    start();
    equip("drone", 1);
    equip("arc", 1);
    Q.state().attackClock.arc = 999;
    enemies([
      [75, 0],
      [140, 0],
    ]);
    Q.step(0.4);
    results.droneArc = Q.state().metrics.damage.droneArc || 0;
    start();
    equip("shield", 1);
    equip("arc", 1);
    Q.state().attackClock.arc = 999;
    enemies([
      [90, 0],
      [150, 0],
    ]);
    Q.step(1 / 60);
    Q.state().p.inv = 0;
    Q.forceDamage(30);
    results.shieldArc = Q.state().metrics.damage.shieldArc || 0;
    assert.equal(Q.state().p.hp, 100);
    start();
    equip("cannon", 1);
    equip("drone", 1);
    enemies([[100, 0]]);
    Q.step(1.8);
    results.marked = Q.state().enemy[0].marked;
    assert(Q.state().metrics.damage.drone > 27);
    for (const value of Object.values(results)) assert(value > 0);
    return results;
  });
  await test("lock, lens, capacitor, cooler, magnet and armor have actual passive effects", () => {
    const damage = [],
      shots = [];
    for (const level of [0, 2]) {
      start();
      equip("drone", 3);
      equip("lock", level);
      enemies([[0, -100]]);
      Q.step(3.4);
      damage.push(Q.state().metrics.damage.drone);
      shots.push(Q.state().metrics.shots.drone);
    }
    assert(damage[1] > damage[0]);
    assert(shots[1] > shots[0]);
    const lens = [];
    for (const level of [0, 2]) {
      start();
      equip("cannon", 1);
      equip("lens", level);
      enemies([
        [75, 0],
        [150, 0],
      ]);
      Q.step(0.5);
      lens.push(Q.state().enemy[1].hp);
    }
    assert(lens[1] < lens[0]);
    const capacitor = [];
    for (const level of [0, 2]) {
      start();
      equip("arc", 1);
      equip("capacitor", level);
      enemies([
        [0, -250],
        [0, -500],
      ]);
      Q.step(1 / 60);
      capacitor.push(Q.state().metrics.damage.arc || 0);
    }
    assert(capacitor[1] > capacitor[0]);
    const cooler = [];
    for (const level of [0, 2]) {
      start();
      equip("cannon", 1);
      equip("cooler", level);
      enemies([[0, -100]]);
      Q.step(2.5);
      cooler.push(Q.state().metrics.shots.pulse);
    }
    assert(cooler[1] > cooler[0]);
    const magnet = [];
    for (const level of [0, 2]) {
      start();
      equip("magnet", level);
      Q.state().pickups = [{ x: 220, y: 0, t: 30, type: "xp", value: 8 }];
      Q.step(1);
      magnet.push(Q.state().metrics.collectedXP);
    }
    assert(magnet[1] > magnet[0]);
    const reduced = [];
    for (const level of [0, 2]) {
      start();
      equip("armor", level);
      const g = Q.state();
      g.p.inv = 0;
      const before = g.p.hp;
      Q.forceDamage(20);
      reduced.push(before - g.p.hp);
    }
    assert(reduced[1] < reduced[0]);
    return {
      lockDamage: damage,
      lockShots: shots,
      lensSecondTarget: lens,
      capacitorDamage: capacitor,
      coolerShots: cooler,
      magnetCollected: magnet,
      armorDamage: reduced,
    };
  });
  await test("latched experience catches a continuously moving ship and never vanishes on an upgrade", () => {
    const g = start();
    g.active = { cannon: 1 };
    g.keys.d = true;
    g.pickups = [{ x: -100, y: 0, type: "xp", value: 8, t: 30 }];
    Q.step(1);
    assert.equal(g.metrics.collectedXP, 8);
    assert.equal(g.pickups.length, 0);
    g.keys = {};
    g.xp = g.xpNext - 1;
    g.upgradeGrace = 0;
    g.pickups = [
      { x: g.p.x, y: g.p.y, type: "xp", value: 8, t: 30 },
      { x: g.p.x, y: g.p.y, type: "xp", value: 8, t: 30 },
    ];
    Q.step(1 / 60);
    assert.equal(g.mode, "upgrade");
    assert.equal(g.pickups.filter((p) => p.t > 0).length, 1);
    assert.equal(g.metrics.collectedXP, 16);
  });
  await test("elites and bosses remain real pursuing entities beyond the ordinary culling boundary", () => {
    const g = start();
    g.time = 131;
    g.bossSpawned = g.eliteSpawned = true;
    const id = Q.enemy("boss", 900, 0, 100000);
    const enemy = g.enemy.find((e) => e.id === id);
    enemy.speed = 82;
    Q.step(1);
    assert(g.enemy.some((e) => e.id === id));
    assert(enemy.x < 900);
    assert(enemy.x > 0);
    return { startDistance: 900, endDistance: enemy.x };
  });
  await test("a legal maximized build keeps entities, shots, chains and pixel effects bounded", () => {
    const g = start();
    equip("cannon", 3);
    equip("lens", 2);
    Q.pick("piercebeam");
    equip("drone", 3);
    equip("arc", 3);
    Q.pick("thunderhive");
    equip("missile", 3);
    equip("blade", 3);
    Q.pick("blastwheel");
    equip("shield", 3);
    equip("armor", 2);
    Q.pick("reactiveaegis");
    equip("cooler", 2);
    g.time = 140;
    g.bossSpawned = g.eliteSpawned = true;
    for (let index = 0; index < 38; index++)
      Q.enemy(
        "tank",
        ((index % 7) - 3) * 65,
        (Math.floor(index / 7) - 3) * 70,
        1000000,
      );
    Q.enemy("elite", 180, 100, 1000000);
    Q.enemy("boss", -160, -100, 1000000);
    for (let index = 0; index < 600; index++) {
      Q.step(0.025);
      for (const [field, max] of [
        ["enemy", 40],
        ["shots", 60],
        ["enemyShots", 48],
        ["particles", 128],
        ["arcs", 20],
        ["rings", 20],
        ["bursts", 24],
        ["texts", 28],
        ["pickups", 140],
      ])
        assert(g[field].length <= max, field + " exceeded cap");
    }
    return {
      enemies: g.enemy.length,
      shots: g.shots.length,
      effects: g.bursts.length,
    };
  });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  if (report.errors.length) process.exitCode = 1;
  else console.log("PASS", report.passed, "actual game model groups");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
