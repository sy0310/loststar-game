/* Stationary range fixture with legal equipment. Not natural play or a phone result. */
const { createModel } = require("./model-harness.cjs");
const fs = require("node:fs");
const assert = require("node:assert/strict");
(async () => {
  const context = await createModel(),
    Q = context.SurvivorQA,
    B = context.SurvivorBalance,
    rows = [];
  for (const at of [140, 350, 590])
    for (const previous of [true, false]) {
      const game = Q.startModel(91);
      if (previous) Q.legacyV065();
      game.spawnTime = 99999;
      game.p.inv = 9999;
      game.encounters.schedule = [];
      game.active = {};
      for (const [id, count] of [
        ["cannon", at === 140 ? 4 : 5],
        ["lens", at === 140 ? 3 : 5],
        ["drone", at === 140 ? 2 : 5],
        ["lock", at === 140 ? 1 : 5],
      ])
        for (let index = 0; index < count; index++) assert(Q.pick(id));
      if (at > 140) {
        Q.reward(true);
        assert(Q.pick("piercebeam"));
        Q.reward(true);
        assert(Q.pick("hunterswarm"));
      }
      game.time = at;
      game.milestoneSeen = B.showcase.milestones.map(
        (item) => item.type + ":" + item.at,
      );
      const enemy = Q.spawn(
        "elite",
        at === 140 ? 1 : 3,
        at === 140 ? "hunter" : "warden",
      );
      Object.assign(enemy, { x: 0, y: -140, speed: 0, fire: 99999 });
      const hp = enemy.hp,
        barrier = enemy.barrier;
      let elapsed = 0;
      while (enemy.hp > 0 && elapsed < 90 && game.mode === "play") {
        Q.step(0.01);
        elapsed += 0.01;
      }
      assert(enemy.hp <= 0, "Stationary fixture must resolve");
      rows.push({
        at,
        version: previous ? "0.6.5" : "0.6.6",
        hp,
        barrier,
        seconds: +elapsed.toFixed(2),
        build: {
          active: game.active,
          passive: game.passive,
          evolved: game.evolved,
        },
      });
    }
  for (let index = 0; index < rows.length; index += 2)
    assert(rows[index + 1].seconds > rows[index].seconds * 2);
  const output =
    process.env.SURVIVOR_ELITE_OUT || "releases/survivor-elite-balance.json";
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        scope:
          "Stationary range, same legal equipment and actual damage controller. Hostile movement disabled only in this QA fixture.",
        rows,
      },
      null,
      2,
    ),
  );
  console.log(rows.map(({ build, ...row }) => row));
})();
