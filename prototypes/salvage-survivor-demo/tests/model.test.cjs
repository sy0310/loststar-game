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
  ["prism", "refraction", "kaleidoscope"],
  ["gravity", "singularity", "collapse"],
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
  await test("eight EVO prerequisites and mutual exclusion are actual legal choices", () => {
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
        ["shots", 72],
        ["enemyShots", 56],
        ["particles", 160],
        ["arcs", 24],
        ["rings", 24],
        ["bursts", 28],
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
  await test("new sessions use600seconds and6/6 slots, with eight meaningful acquisition choices", () => {
    const g = start();
    assert.equal(g.endTime, 600);
    assert.equal(g.rules.activeSlots, 6);
    assert.equal(g.rules.passiveSlots, 6);
    for (const id of ["cannon", "drone", "arc", "missile", "prism", "gravity"])
      equip(id, 1);
    assert(!Q.pick("blade"));
    for (const id of [
      "lens",
      "lock",
      "capacitor",
      "cooler",
      "refraction",
      "singularity",
    ])
      equip(id, 1);
    assert(!Q.pick("armor"));
    return { active: Object.keys(g.active), passive: Object.keys(g.passive) };
  });
  await test("prism has a central real hit and its evolution spreads six damaging rays", () => {
    const g = setup("prism", "refraction", false);
    Q.enemy("skimmer", 0, -260, 100000);
    Q.step(0.02);
    assert(g.metrics.damage.prism > 0);
    assert.equal(g.beams.length, 4);
    assert(Q.pick("kaleidoscope"));
    g.attackClock = {};
    Q.step(0.02);
    assert(g.metrics.damage.kaleidoscope > 0);
    assert(g.metrics.shots.kaleidoscope >= 6);
    return g.metrics.damage;
  });
  await test("gravity moves real enemies, scales with its passive and collapse adds a real final burst", () => {
    const g = setup("gravity", "singularity", true);
    const id = Q.enemy("skimmer", 90, 0, 100000);
    Q.enemy("skimmer", 130, 20, 100000);
    Q.step(0.02);
    const origin = g.enemy.find((enemy) => enemy.id === id);
    const before = g.enemy.find((enemy) => enemy.id !== id).x;
    assert(g.wells.length);
    assert(g.wells[0].radius >= 130);
    g.attackClock.gravity = 999;
    Q.step(3);
    assert(g.metrics.damage.collapse > 0);
    assert(g.enemy.find((enemy) => enemy.id !== id).x < before);
    assert(g.wells.length === 0);
    return {
      damage: g.metrics.damage.collapse,
      pulledEnemyX: g.enemy.find((enemy) => enemy.id !== id).x,
    };
  });
  await test("event horizon consumes prism/gravity and deals both line and field damage", () => {
    const g = start();
    equip("prism", 3);
    equip("gravity", 3);
    assert(Q.pick("eventhorizon"));
    assert.equal(Object.keys(g.active).length + Object.keys(g.fused).length, 1);
    assert(!Q.pick("prism"));
    assert(!Q.pick("gravity"));
    Q.enemy("skimmer", 0, -90, 100000);
    Q.enemy("skimmer", 30, -100, 100000);
    Q.step(2);
    assert(g.metrics.damage.eventhorizon > 0);
    assert(g.metrics.shots.eventhorizon >= 6);
    assert(g.wells.length);
    return g.metrics;
  });
  await test("600second milestones are one-time, bounded and never heal an existing boss", () => {
    const g = start();
    g.time = 129.99;
    Q.step(0.02);
    const boss = g.enemy.find((enemy) => enemy.t === "boss");
    assert(boss);
    boss.hp = 100;
    g.time = 309.99;
    Q.step(0.02);
    assert.equal(g.enemy.filter((enemy) => enemy.t === "boss").length, 1);
    assert.equal(boss.hp, 100);
    assert.equal(boss.tier, 2);
    const count = g.metrics.events.filter(
      (event) => event.kind === "boss",
    ).length;
    Q.step(0.1);
    assert.equal(
      g.metrics.events.filter((event) => event.kind === "boss").length,
      count,
    );
    return g.milestoneSeen;
  });
  await test("legacy180-second runs retain their deadline and never receive600-second spawns", () => {
    const g = start();
    delete g.rules;
    g.endTime = 180;
    g.time = 179.99;
    Q.step(0.02);
    assert.equal(g.time, 180);
    assert.equal(g.mode, "results");
    return { time: g.time };
  });
  await test("all eight EVO reject missing and half-level accessories before both maxima", () => {
    for (const [active, passive, evolution] of evo) {
      const g = start();
      equip(active, 3);
      assert(!Q.pick(evolution), active + " without accessory");
      equip(passive, 1);
      assert(!Q.pick(evolution), active + " with Lv1 accessory");
      assert(!Q.options().some((option) => option.id === evolution));
      equip(passive, 1);
      assert(Q.pick(evolution));
      assert.equal(g.evolved[active], evolution);
    }
  });
  await test("stale EVO input is revalidated against real equipment and never grants an evolution", () => {
    const g = start();
    equip("cannon", 3);
    equip("lens", 2);
    const option = Q.options().find((entry) => entry.id === "piercebeam");
    g.presented = [option];
    g.mode = "upgrade";
    g.passive.lens = 1;
    const credits = g.credits;
    assert.equal(Q.select(0), false);
    assert(!g.evolved.cannon);
    assert.equal(g.credits, credits);
    assert.equal(g.presented.length, 3);
  });
  function threat(type, x = 0, y = -150) {
    const g = start();
    g.active = {};
    g.encounters.schedule = [];
    g.time = 110;
    g.milestoneSeen = context.SurvivorBalance.milestones.map(
      (m) => m.type + ":" + m.at,
    );
    Q.enemy(type, x, y, 100000);
    const enemy = g.enemy[0];
    enemy.fire = 0;
    return { g, enemy };
  }
  await test("lancer telegraphs, locks heading, really charges then recovers", () => {
    const { g, enemy } = threat("lancer");
    Q.step(0.5);
    assert(enemy.warn > 0);
    assert.equal(enemy.y, -150);
    const aim = enemy.aim;
    g.p.x = 90;
    Q.step(0.5);
    assert(enemy.charge > 0);
    assert.equal(enemy.chargeAngle, aim);
    assert(enemy.y > -150);
    assert.equal(g.enemyShots.length, 0);
    Q.step(0.5);
    assert(enemy.recovery > 0 && enemy.charge <= 0);
  });
  await test("sentinel beam and tank shock have real safe paths and real ship damage", () => {
    const results = [];
    for (const type of ["sentinel", "tank"]) {
      const { g } = threat(type);
      Q.step(1.2);
      const hazard = g.hazards.find(
        (entry) => entry.kind === (type === "tank" ? "shock" : "beam"),
      );
      assert(hazard, type);
      if (type === "tank") Q.step(0.6);
      g.p.inv = 0;
      if (type === "tank") {
        const radius =
          (hazard.radius * (hazard.age + 1 / 60)) / hazard.duration;
        g.p.x = hazard.x + Math.cos(hazard.opening) * radius;
        g.p.y = hazard.y + Math.sin(hazard.opening) * radius;
      } else {
        g.p.x = hazard.x + 100;
        g.p.y = hazard.y - 100;
      }
      const hp = g.p.hp;
      Q.step(1 / 60);
      assert.equal(g.p.hp, hp, "safe path");
      if (type === "tank") {
        const heading = hazard.opening + Math.PI;
        const radius =
          (hazard.radius * (hazard.age + 1 / 60)) / hazard.duration;
        g.p.x = hazard.x + Math.cos(heading) * radius;
        g.p.y = hazard.y + Math.sin(heading) * radius;
      } else {
        const heading =
          hazard.heading +
          (hazard.sweep * (hazard.age + 1 / 60)) / hazard.duration;
        g.p.x = hazard.x + Math.cos(heading) * 120;
        g.p.y = hazard.y + Math.sin(heading) * 120;
      }
      Q.step(1 / 60);
      assert(g.p.hp < hp, "actual impact");
      results.push({ type, damage: hp - g.p.hp });
    }
    return results;
  });
  await test("killing a beam source interrupts it and mines wait for arm and fuse", () => {
    let { g, enemy } = threat("sentinel");
    Q.step(1.2);
    assert(g.hazards.some((entry) => entry.kind === "beam"));
    enemy.hp = 0;
    Q.step(1 / 60);
    assert.equal(g.hazards.length, 0);
    ({ g } = threat("minelayer"));
    Q.step(0.85);
    const mine = g.hazards[0];
    assert(mine && mine.stage === "arming");
    g.p.x = mine.x;
    g.p.y = mine.y;
    g.p.inv = 0;
    const hp = g.p.hp;
    Q.step(0.5);
    assert.equal(g.p.hp, hp);
    Q.step(0.5);
    assert.equal(mine.stage, "fuse");
    assert.equal(g.p.hp, hp);
    Q.step(0.6);
    assert(g.p.hp < hp);
  });
  await test("ranger needles and wisp curved pairs have distinct actual trajectories", () => {
    const rows = [];
    for (const type of ["ranger", "wisp"]) {
      const { g } = threat(type);
      Q.step(0.8);
      assert.equal(g.enemyShots.length, type === "ranger" ? 3 : 2);
      assert(
        g.enemyShots.every(
          (shot) => shot.kind === (type === "ranger" ? "needle" : "curl"),
        ),
      );
      const shot = g.enemyShots[0],
        vx = shot.vx;
      Q.step(0.1);
      assert.equal(shot.vx === vx, type === "ranger");
      rows.push({ type, count: g.enemyShots.length });
    }
    return rows;
  });
  await test("two finite visitors warn, arrive, depart and never respawn during the same run", () => {
    const g = start();
    g.active = {};
    g.encounters.schedule = [
      { at: 0, kind: "courier" },
      { at: 3, kind: "watcher" },
    ];
    Q.step(1);
    assert.equal(g.encounters.pending.kind, "courier");
    assert.equal(g.enemy.length, 0);
    Q.step(2);
    assert.equal(g.encounters.active.kind, "courier");
    g.encounters.active.until = g.time;
    Q.step(0.1);
    assert.equal(g.encounters.log[0].result, "departed");
    Q.step(2.5);
    assert.equal(g.encounters.active.kind, "watcher");
    g.encounters.active.until = g.time;
    Q.step(0.1);
    Q.step(1);
    assert.equal(g.encounters.log.length, 2);
    assert.equal(g.encounters.seen.length, 2);
    assert.equal(
      g.metrics.events.filter((event) => event.kind === "encounterArrival")
        .length,
      2,
    );
  });
  await test("visitor destruction uses actual damage, pays bounded scrap once and cannot be repeated", () => {
    const g = start();
    equip("cannon", 1);
    g.encounters.schedule = [{ at: 0, kind: "courier" }];
    Q.step(2.3);
    const visitor = g.enemy.find((enemy) => enemy.t === "courier");
    assert(visitor);
    Object.assign(visitor, { x: 0, y: -60, hp: 1, speed: 0, fire: 999 });
    g.attackClock = {};
    Q.step(0.3);
    assert.equal(g.encounters.log.length, 1);
    assert.equal(g.encounters.log[0].result, "repelled");
    const paid = g.pickups.filter(
      (pickup) => pickup.type === "scrap" && pickup.value === 12,
    ).length;
    const received = g.credits;
    assert(paid === 1 || received >= 12);
    Q.step(1);
    assert.equal(g.encounters.log.length, 1);
    assert(g.credits <= 12);
  });
  await test("legacy600 snapshots retain old combat population and never receive new visitors", () => {
    const g = start();
    delete g.rules.combatVersion;
    g.time = 170;
    g.spawnTime = 0;
    Q.step(0.5);
    assert(
      !g.enemy.some((enemy) =>
        ["lancer", "sentinel", "minelayer", "courier", "watcher"].includes(
          enemy.t,
        ),
      ),
    );
    assert.equal(g.encounters.seen.length, 0);
  });
  await test("fixed seeds include the visitor schedule and reproduce combat RNG exactly", () => {
    const rows = [];
    for (let i = 0; i < 2; i++) {
      const g = start(182);
      g.spawnTime = 0;
      Q.step(3);
      rows.push(
        JSON.stringify({
          schedule: g.encounters.schedule,
          enemy: g.enemy,
          shots: g.enemyShots,
        }),
      );
    }
    assert.equal(rows[0], rows[1]);
  });
  await test("wisp and tank attacks unlock progressively while their early movement remains live", () => {
    for (const [type, unlock] of [
      ["wisp", 30],
      ["tank", 70],
    ]) {
      const { g, enemy } = threat(type);
      g.time = 0;
      Q.step(2);
      assert.equal(g.hazards.length, 0);
      assert.equal(g.enemyShots.length, 0);
      assert.equal(g.metrics.shots["hostile-" + type], undefined);
      g.time = unlock;
      enemy.fire = 0;
      Q.step(1.2);
      assert(g.metrics.shots["hostile-" + type] > 0);
    }
  });
  await test("visitor catches up from outside the viewport and shows a real near-screen encounter", () => {
    const { g, enemy } = threat("courier", 0, -800);
    enemy.speed = 94;
    Q.step(3);
    assert(enemy.y > -300);
    assert(g.enemy.includes(enemy));
  });
  await test("a full pickup field preserves one actual visitor scrap drop within the same entity cap", () => {
    const g = start();
    equip("cannon", 1);
    g.encounters.schedule = [{ at: 0, kind: "courier" }];
    Q.step(2.3);
    const visitor = g.enemy.find((enemy) => enemy.t === "courier");
    Object.assign(visitor, { x: 0, y: -60, hp: 1, speed: 0, fire: 999 });
    g.pickups = Array.from({ length: 140 }, (_, i) => ({
      x: 1000 + i,
      y: 1000,
      t: 30,
      type: "xp",
      value: 8,
    }));
    g.attackClock = {};
    Q.step(0.4);
    assert.equal(g.encounters.log.length, 1);
    assert(g.pickups.length <= 140);
    assert(
      g.credits === 12 ||
        g.pickups.some(
          (pickup) => pickup.type === "scrap" && pickup.value === 12,
        ),
    );
  });
  await test("natural waves bound simultaneous specialists and retain a pursuing swarm", () => {
    const g = start(58);
    g.time = 110;
    g.encounters.schedule = [];
    g.milestoneSeen = context.SurvivorBalance.milestones.map(
      (m) => m.type + ":" + m.at,
    );
    for (let i = 0; i < 100; i++) {
      g.spawnTime = 0;
      Q.step(1 / 60);
    }
    for (const [type, cap] of Object.entries(
      context.SurvivorBalance.combat.populationCaps,
    ))
      assert(g.enemy.filter((enemy) => enemy.t === type).length <= cap, type);
    assert(g.enemy.filter((enemy) => enemy.t === "skimmer").length >= 12);
  });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  if (report.errors.length) process.exitCode = 1;
  else console.log("PASS", report.passed, "actual game model groups");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
