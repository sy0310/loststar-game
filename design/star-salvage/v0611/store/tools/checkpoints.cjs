/* Play seeded runs using the fixed-step combat model. Save real frames, including all HUD counters. */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../../../..");
const game = path.join(root, "prototypes/salvage-survivor-demo");
const { createModel } = require(path.join(game, "tests/model-harness.cjs"));
const { steer, inputDirections } = require(
  path.join(game, "tests/capture-v065.cjs"),
);
const runtime =
  process.env.STORE_RUNTIME ||
  path.join(root, "releases/survivor-taptap-2322f30/loststar-survivor");
const out =
  process.env.STORE_CHECKPOINTS ||
  path.join(root, "releases/store-v0611/checkpoints");
const policies = {
  swarm: [
    "thunderhive",
    "hunterswarm",
    "chainstorm",
    "drone",
    "arc",
    "lock",
    "capacitor",
    "cannon",
    "lens",
    "shield",
    "armor",
    "reactiveaegis",
    "cooler",
  ],
  electric: [
    "thunderhive",
    "chainstorm",
    "hunterswarm",
    "arc",
    "capacitor",
    "drone",
    "lock",
    "cannon",
    "magnet",
    "armor",
    "shield",
  ],
  void: [
    "eventhorizon",
    "kaleidoscope",
    "collapse",
    "gravity",
    "prism",
    "singularity",
    "refraction",
    "cannon",
    "lens",
    "shield",
    "armor",
  ],
};
async function run(policy, seed) {
  const sources = Object.fromEntries(
    ["balance.js", "game.js"].map((f) => [
      f,
      fs.readFileSync(path.join(runtime, "src", f), "utf8"),
    ]),
  );
  const { SurvivorQA: q } = await createModel(sources);
  const perks = {
    hull: 3,
    gun: 3,
    engineering: { version: 1, thrusters: 6, salvage: 6, plating: 6 },
  };
  const g = q.startModel(seed, perks);
  const best = {};
  function candidate(scene, score) {
    if (best[scene] && best[scene].score >= score) return;
    const snapshot = q.snapshot();
    q.validate(snapshot);
    best[scene] = {
      scene,
      seed,
      policy,
      perks,
      score,
      time: g.time,
      kills: g.kills,
      level: g.level,
      active: { ...g.active },
      evolved: { ...g.evolved },
      fused: { ...g.fused },
      snapshot,
    };
  }
  let direction = -1;
  for (
    let frame = 0;
    frame < g.endTime * 60 + 100 && g.mode !== "results";
    frame++
  ) {
    if (g.mode === "upgrade") {
      const find = (id) => g.presented.findIndex((option) => option.id === id);
      const repair = find("repair");
      let i = policies[policy].map(find).find((index) => index >= 0);
      if (
        repair >= 0 &&
        (g.p.hp / g.p.maxhp < 0.35 ||
          (i === undefined && g.p.hp / g.p.maxhp < 0.6))
      )
        i = repair;
      assert(q.select(i ?? 0));
    }
    if (frame % 6 === 0) {
      direction = steer(g, direction);
      g.keys = Object.fromEntries(
        inputDirections[direction].map((key) => [key, true]),
      );
    }
    q.step(1 / 60);
    if (frame % 30 || g.mode !== "play") continue;
    const visible = g.enemy.filter(
      (e) =>
        e.hp > 0 && Math.abs(e.x - g.p.x) < 170 && Math.abs(e.y - g.p.y) < 265,
    );
    const near = visible.filter((e) => Math.abs(e.y - g.p.y) < 150);
    const around = new Set(
      visible.map((e) => (e.x > g.p.x ? 1 : 0) + (e.y > g.p.y ? 2 : 0)),
    ).size;
    const density = visible.length + near.length * 0.5 + around * 2;
    if (policy === "swarm") {
      if (g.time > 20 && g.time < 700 && g.xpNext - g.xp > 15)
        candidate("horde", density);
      const boss = visible.find((e) => e.t === "boss" && e.hp > e.maxhp * 0.3);
      if (boss && g.time > 400 && g.time < 892)
        candidate(
          "boss",
          density -
            Math.abs(Math.hypot(boss.x - g.p.x, boss.y - g.p.y) - 125) / 20,
        );
    } else if (policy === "electric") {
      if (
        ((g.evolved.arc && g.active.drone) || g.fused.thunderhive) &&
        g.time < 891 &&
        g.arcs.length
      ) {
        candidate(
          "electric",
          density +
            Math.min(g.arcs.length, 20) +
            Number(!!g.fused.thunderhive) * 100,
        );
      }
    } else if (g.fused.eventhorizon && g.time < 894)
      candidate("fusion", density + Math.min(3, g.wells.length) * 2);
  }
  for (const [scene, b] of Object.entries(best)) {
    fs.writeFileSync(
      path.join(out, scene + ".json"),
      JSON.stringify(b, (_, value) =>
        Object.prototype.toString.call(value) === "[object Set]"
          ? { storeCaptureSet: [...value] }
          : value,
      ),
    );
    console.log(scene, b.time, b.kills, b.level, b.score);
  }
}
(async () => {
  fs.mkdirSync(out, { recursive: true });
  assert(
    fs
      .readFileSync(path.join(runtime, "index.html"), "utf8")
      .includes("2322f30a696d90a73e4105bdff2049392eca2eeb"),
  );
  const policy = process.argv[2];
  if (!Object.hasOwn(policies, policy))
    throw Error("Pass swarm, electric or void");
  await run(policy, Number(process.argv[3] || (policy === "swarm" ? 1 : 5)));
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
