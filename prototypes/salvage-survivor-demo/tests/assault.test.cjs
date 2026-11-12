/* Version3 fixtures exercise the real900-second controller in a unit DOM adapter. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
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
let Q, balance;
function start(seed = 91, perks = {}) {
  const game = Q.startModel(seed, perks);
  game.active = {};
  game.spawnTime = 9999;
  game.p.inv = 10000;
  game.encounters.schedule = [];
  return game;
}
function equip(id, count = 1) {
  for (let index = 0; index < count; index++)
    assert(Q.pick(id), "Acquire " + id);
}
function evolve(id) {
  const [, passive, result] = recipes.find(([weapon]) => weapon === id);
  equip(id, 5);
  equip(passive, 5);
  Q.reward(true);
  assert(Q.pick(result));
}
(async () => {
  const context = await createModel();
  Q = context.SurvivorQA;
  balance = context.SurvivorBalance;
  const report = JSON.parse(fs.readFileSync(output));
  report.scope =
    "53 saved-rule groups plus explicit v064900-second, trajectory, refraction, color, elite and legacy parity fixtures. Browser, natural and phone evidence are separate.";
  async function test(name, run) {
    try {
      const detail = await run();
      report.passed++;
      report.cases.push({ name: "v064 " + name, detail: detail || null });
      console.log("PASS v064", name);
    } catch (error) {
      report.errors.push({ name: "v064 " + name, message: error.stack });
      console.error("FAIL v064", name, error);
      process.exitCode = 1;
    }
  }
  await test("new runs900seconds and previous rules keep600seconds and their original XP", () => {
    let game = start();
    assert.equal(game.endTime, 900);
    assert.equal(game.rules.combatVersion, 3);
    assert.equal(game.xpNext, 100);
    Q.legacyV063();
    assert.equal(game.endTime, 600);
    assert.equal(game.xpNext, 72);
    Q.legacyProgression();
    assert.equal(game.xpNext, 112);
    assert.equal(game.rules.combatVersion, 2);
  });
  await test("ordinary drone bolts retain their launch vector after target movement and later evolution", () => {
    const game = start();
    equip("drone");
    Q.enemy("skimmer", 0, -150, 100000);
    Q.step(0.01);
    const shot = game.shots[0];
    assert.equal(shot.homing, false);
    const velocity = [shot.vx, shot.vy];
    game.enemy[0].x = 180;
    game.active = {};
    Q.step(0.12);
    assert.deepEqual([shot.vx, shot.vy], velocity);
    game.evolved.drone = "hunterswarm"; // Explicit mid-flight fixture only.
    Q.step(0.12);
    assert.deepEqual([shot.vx, shot.vy], velocity);
  });
  await test("legal five-plus-five drone evolution grants actual steering", () => {
    const game = start();
    evolve("drone");
    Q.enemy("skimmer", 0, -180, 100000);
    Q.step(0.01);
    const shot = game.shots[0];
    assert(shot.homing && shot.evolvedAtLaunch);
    const velocity = [shot.vx, shot.vy];
    game.enemy[0].x = 170;
    Q.step(0.15);
    assert.notDeepEqual([shot.vx, shot.vy], velocity);
    Q.validate(Q.snapshot());
  });
  await test("ordinary missiles strike their frozen region and never chase a moved target", () => {
    const game = start();
    equip("missile");
    Q.enemy("skimmer", 0, -130, 100000);
    Q.step(0.01);
    const shot = game.shots[0];
    assert.equal(shot.homing, false);
    assert.deepEqual([shot.destinationX, shot.destinationY], [0, -130]);
    const velocity = [shot.vx, shot.vy];
    game.enemy[0].x = 180;
    game.active = {};
    Q.step(0.5);
    assert.deepEqual([shot.vx, shot.vy], velocity);
    assert(shot.t <= 0);
    assert(game.rings.some((ring) => ring.x === 0 && ring.y === -130));
    assert.equal(game.metrics.damage.missile || 0, 0);
  });
  await test("missile evolution steers and stores capability on each projectile", () => {
    const game = start();
    evolve("missile");
    Q.enemy("skimmer", 0, -180, 100000);
    Q.step(0.01);
    const shot = game.shots[0];
    assert(shot.homing && shot.evolvedAtLaunch);
    const velocity = [shot.vx, shot.vy];
    game.enemy[0].x = 150;
    Q.step(0.1);
    assert.notDeepEqual([shot.vx, shot.vy], velocity);
    Q.validate(Q.snapshot());
  });
  await test("prism attacks launch from orbiting crystals and create no rail beam", () => {
    const game = start();
    equip("prism", 3);
    Q.enemy("skimmer", 0, -160, 100000);
    Q.step(0.01);
    const shots = game.shots.filter((shot) => shot.kind === "crystal");
    assert.equal(shots.length, 3);
    assert(shots.every((shot) => Math.hypot(shot.x, shot.y) > 34));
    assert(shots.every((shot) => shot.bounces === 0));
    assert.equal(game.beams.length, 0);
    Q.validate(Q.snapshot());
  });
  await test("the first refraction accessory enables a real second-target hit", () => {
    const game = start();
    equip("prism");
    equip("refraction");
    Q.enemy("skimmer", 0, -80, 100000);
    Q.enemy("skimmer", 80, -80, 100000);
    Q.step(0.7);
    assert(game.enemy.every((enemy) => enemy.hp < 100000));
    assert(game.metrics.refractions > 0);
    assert(game.metrics.damage.prism > 43);
    assert.equal(game.beams.length, 0);
  });
  await test("prism and gravity cooperation aims at the actual well from a crystal", () => {
    const game = start();
    equip("prism");
    equip("gravity");
    Q.enemy("skimmer", 0, -120, 100000);
    Q.step(1);
    assert(game.metrics.damage.gravityPrism > 0);
    assert(game.metrics.events.some((event) => event.id === "gravityPrism"));
  });
  await test("lightning is blue at low rank, gold at higher rank and violet after evolution", () => {
    const colors = [];
    for (const stage of [1, 3, "evolved"]) {
      const game = start();
      if (stage === "evolved") evolve("arc");
      else equip("arc", stage);
      Q.enemy("skimmer", 0, -100, 100000);
      Q.step(0.01);
      colors.push(game.arcs[0].color);
    }
    assert.deepEqual(colors, ["#73d9e8", "#f4c57a", "#c49bef"]);
  });
  await test("thunderhive is legally fused and produces violet-gold lightning", () => {
    const game = start();
    evolve("drone");
    evolve("arc");
    Q.reward(true);
    assert(Q.pick("thunderhive"));
    Q.enemy("skimmer", 0, -100, 100000);
    Q.enemy("skimmer", 30, -110, 100000);
    for (let step = 0; step < 10 && !game.arcs.length; step++) Q.step(0.05);
    assert(
      game.arcs.some(
        (arc) => arc.color === "#bc85f2" && arc.core === "#ffe5a1",
      ),
    );
    assert(game.metrics.damage.thunderhive > 0);
  });
  await test("three elite profiles have distinct real attacks and damage", () => {
    const rows = [];
    for (const profile of ["hunter", "raider", "warden"]) {
      const game = start();
      game.p.inv = 0;
      game.p.hp = game.p.maxhp = 10000;
      Q.enemy("elite", 0, -140, 100000, profile);
      game.enemy[0].fire = 0;
      Q.step(12);
      assert(game.metrics.shipDamage > 0, profile + " actual damage");
      assert(game.metrics.shots["hostile-elite"] > 0);
      if (profile === "raider")
        assert(game.enemyShots.some((shot) => shot.color === "#c49bef"));
      if (profile === "warden") {
        assert(game.metrics.shots["hostile-mine"] >= 3);
        assert(game.metrics.shots["hostile-beam"] > 0);
        assert(game.metrics.shots["hostile-shock"] > 0);
      }
      Q.validate(Q.snapshot());
      rows.push({
        profile,
        damage: game.metrics.shipDamage,
        attacks: game.metrics.shots,
      });
    }
    return rows;
  });
  await test("warden armor absorbs actual damage then breaks once", () => {
    const game = start();
    equip("cannon");
    Q.enemy("elite", 0, -100, 1000, "warden");
    game.enemy[0].barrier = game.enemy[0].maxBarrier = 10;
    Q.step(1);
    assert.equal(game.enemy[0].barrier, 0);
    assert.equal(game.metrics.armorAbsorbed, 10);
    assert.equal(
      game.metrics.events.filter((event) => event.id === "armorBreak").length,
      1,
    );
    assert(game.enemy[0].hp < 1000);
  });
  await test("late pressure increases real health and speed while retaining entity budgets", () => {
    const early = start();
    Q.forceEnemies(1, "skimmer");
    const earlyHP = early.enemy[0].maxhp;
    const late = start();
    late.time = 780;
    Q.forceEnemies(1, "skimmer");
    assert(late.enemy[0].maxhp > earlyHP * 6);
    const before = late.enemy[0].x;
    Q.step(0.01);
    assert.notEqual(late.enemy[0].x, before);
    assert(
      late.enemy.length <= 40 &&
        late.enemyShots.length <= 56 &&
        late.hazards.length <= 12,
    );
  });
  await test("late Boss shows a saved second attack and bypasses a single shield recharge window", () => {
    const game = start();
    evolve("shield");
    game.time = 600;
    game.milestoneSeen = balance.assault.milestones.map(
      (milestone) => milestone.type + ":" + milestone.at,
    );
    game.p.inv = 0;
    game.p.hp = game.p.maxhp = 1000;
    Q.enemy("boss", 0, -150, 100000);
    game.enemy[0].fire = 0;
    Q.step(3);
    assert(game.metrics.shots["hostile-boss-echo"] > 0);
    assert(game.metrics.shieldsBlocked > 0);
    assert(game.metrics.shipDamage > 0);
    return {
      damage: game.metrics.shipDamage,
      shieldsBlocked: game.metrics.shieldsBlocked,
    };
  });
  await test("a legal6plus6 two-fusion maximum build takes real late damage while standing", () => {
    const game = start(93, { hull: 3, gun: 3 });
    for (const [first, second, fusion] of [
      ["cannon", "shield", "ionbastion"],
      ["drone", "arc", "thunderhive"],
    ]) {
      evolve(first);
      evolve(second);
      Q.reward(true);
      assert(Q.pick(fusion));
    }
    evolve("prism");
    evolve("gravity");
    equip("missile", 5);
    equip("blade", 5);
    assert.equal(
      Object.keys(game.active).length + Object.keys(game.fused).length,
      6,
    );
    assert.equal(Object.keys(game.passive).length, 6);
    game.time = 840;
    game.spawnTime = 0.25;
    game.xpNext = 1e9; // Fixed late-build fixture isolates damage from XP heal choices.
    game.p.inv = 0;
    game.milestoneSeen = balance.assault.milestones
      .filter((milestone) => milestone.at <= 840)
      .map((milestone) => milestone.type + ":" + milestone.at);
    Q.step(45);
    assert(game.metrics.shipDamage > 0);
    assert(game.p.hp < game.p.maxhp);
    assert(
      game.enemy.length <= 40 &&
        game.enemyShots.length <= 56 &&
        game.hazards.length <= 12,
    );
    Q.validate(Q.snapshot());
    return {
      seconds: game.time - 840,
      damage: game.metrics.shipDamage,
      blocked: game.metrics.shieldsBlocked,
    };
  });
  await test("new snapshots reject900-second mismatches and malformed flight/refraction state", () => {
    const game = start();
    equip("drone");
    Q.enemy("skimmer", 0, -160, 100000);
    Q.step(0.01);
    const valid = Q.snapshot();
    Q.validate(valid);
    for (const mutate of [
      (snapshot) => {
        snapshot.game.rules.runSeconds = 600;
      },
      (snapshot) => {
        delete snapshot.game.shots[0].homing;
      },
      (snapshot) => {
        snapshot.game.shots[0].destinationX = Infinity;
      },
    ]) {
      const snapshot = structuredClone(valid);
      mutate(snapshot);
      assert.throws(() => Q.validate(snapshot));
    }
  });
  await test("actual v063 ordinary card vectors and basic homing remain compatible", async () => {
    const archive = path.resolve(
      __dirname,
      "../../../artifacts/survivor-v063/loststar-survivor-f9bf85c.zip",
    );
    const sources = JSON.parse(
      cp.execFileSync(
        "python3",
        [
          "-c",
          "import json,zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({n:z.read('src/'+n).decode() for n in ['balance.js','game.js']}))",
          archive,
        ],
        { encoding: "utf8", maxBuffer: 1024 * 1024 },
      ),
    );
    const previous = (await createModel(sources)).SurvivorQA;
    const rows = [];
    for (const seed of [41, 81, 91, 2026]) {
      const old = previous.startModel(seed);
      const current = Q.startModel(seed);
      Q.legacyV063();
      for (let index = 0; index < 24; index++) {
        previous.level();
        Q.level();
        assert.equal(
          JSON.stringify(current.presented),
          JSON.stringify(old.presented),
        );
        assert(previous.select(0) && Q.select(0));
      }
      rows.push({ seed, vectors: 24 });
    }
    const game = start();
    Q.legacyV063();
    equip("drone");
    Q.enemy("skimmer", 0, -150, 100000);
    Q.step(0.01);
    const shot = game.shots[0];
    const velocity = [shot.vx, shot.vy];
    game.enemy[0].x = 180;
    Q.step(0.15);
    assert.notDeepEqual([shot.vx, shot.vy], velocity);
    return rows;
  });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log("PASS", report.passed, "total saved/current model groups");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
