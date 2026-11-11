/* Fixed-seed model policies. This is not natural browser or human play. */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { createModel } = require("./model-harness.cjs");
const output = path.resolve(
  process.env.SURVIVOR_SIM_OUT || "releases/survivor-v06-simulation.json",
);
const priorities = {
  beam: [
    "piercebeam",
    "cannon",
    "lens",
    "shield",
    "armor",
    "reactiveaegis",
    "drone",
    "lock",
    "hunterswarm",
    "cooler",
    "arc",
  ],
  swarm: [
    "thunderhive",
    "drone",
    "arc",
    "shield",
    "armor",
    "reactiveaegis",
    "cannon",
    "lens",
    "cooler",
  ],
  optics: [
    "kaleidoscope",
    "prism",
    "refraction",
    "shield",
    "armor",
    "reactiveaegis",
    "cannon",
    "lens",
    "gravity",
    "singularity",
    "collapse",
  ],
  void: [
    "eventhorizon",
    "gravity",
    "prism",
    "shield",
    "armor",
    "cannon",
    "lens",
    "singularity",
    "refraction",
  ],
  guard: [
    "reactiveaegis",
    "shield",
    "armor",
    "cannon",
    "lens",
    "piercebeam",
    "blade",
    "magnet",
    "spiralsaw",
    "cooler",
  ],
};
const policyIds = process.env.SURVIVOR_POLICIES
  ? process.env.SURVIVOR_POLICIES.split(",")
  : Object.keys(priorities);
for (const id of policyIds) assert(priorities[id], "Unknown policy");
function select(g, policy) {
  const choices = g.presented;
  const emergency = choices.findIndex((choice) => choice.id === "repair");
  if (g.p.hp / g.p.maxhp < 0.35 && emergency >= 0) return emergency;
  for (const id of priorities[policy]) {
    const index = choices.findIndex((choice) => choice.id === id);
    if (index >= 0) return index;
  }
  const repair = choices.findIndex((choice) => choice.id === "repair");
  return g.p.hp / g.p.maxhp < 0.6 && repair >= 0 ? repair : 0;
}
(async () => {
  const context = await createModel();
  const Q = context.SurvivorQA;
  const report = {
    scope:
      "Actual update, damage, drops and offered-card choices under fixed model seeds. Square movement policy, no invulnerability or reward overrides. Not physical device, wall-clock or human preference evidence.",
    rows: [],
    summary: {},
  };
  for (const perks of [0, 3])
    for (const policy of policyIds)
      for (let seed = 1; seed <= 16; seed++) {
        const g = Q.startModel(seed, { hull: perks, gun: perks });
        const samples = [],
          choices = [];
        const thresholds = [
          10, 30, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600,
        ];
        let sampleIndex = 0;
        for (let frame = 0; frame < g.endTime * 60 + 100; frame++) {
          if (g.mode === "results") break;
          if (g.mode === "upgrade") {
            const index = select(g, policy);
            choices.push({
              time: g.time,
              id: g.presented[index].id,
              offered: g.presented.map((option) => option.id),
            });
            assert(Q.select(index));
          }
          const direction = Math.floor(g.time / 1.5) % 4;
          g.keys = {
            d: direction === 0,
            s: direction === 1,
            a: direction === 2,
            w: direction === 3,
          };
          Q.step(1 / 60);
          if (
            sampleIndex < thresholds.length &&
            g.time >= thresholds[sampleIndex]
          ) {
            samples.push({
              time: thresholds[sampleIndex],
              hp: g.p.hp,
              level: g.level,
              kills: g.kills,
              enemies: g.enemy.length,
              xp: g.xp,
              credits: g.credits,
            });
            sampleIndex++;
          }
          if (sampleIndex === thresholds.length) break;
        }
        const receipt = {
          seed,
          policy,
          perks,
          time: g.time,
          victory: g.time >= g.endTime,
          kills: g.kills,
          level: g.level,
          credits: g.credits,
          firstUpgrade: choices[0]?.time ?? null,
          advanced: choices.filter((choice) =>
            [
              "piercebeam",
              "hunterswarm",
              "chainstorm",
              "meteorbarrage",
              "spiralsaw",
              "reactiveaegis",
              "thunderhive",
              "blastwheel",
              "kaleidoscope",
              "collapse",
              "eventhorizon",
            ].includes(choice.id),
          ),
          bossSeen: !!g.metrics.spawned.boss,
          bossKilled: g.bossKilled,
          enemyKinds: Object.keys(g.metrics.spawned),
          samples,
          choices,
        };
        report.rows.push(receipt);
      }
  for (const perks of [0, 3])
    for (const policy of policyIds) {
      const rows = report.rows.filter(
        (row) => row.perks === perks && row.policy === policy,
      );
      const mean = (key) =>
        +(
          rows.reduce((sum, row) => sum + (row[key] || 0), 0) / rows.length
        ).toFixed(2);
      const first = rows
        .map((row) => row.firstUpgrade)
        .filter((value) => value !== null)
        .sort((a, b) => a - b);
      report.summary[policy + "-" + perks] = {
        runs: rows.length,
        clearRate: rows.filter((row) => row.victory).length / rows.length,
        meanSeconds: mean("time"),
        meanKills: mean("kills"),
        meanLevel: mean("level"),
        meanCredits: mean("credits"),
        medianFirstUpgrade: first[Math.floor(first.length / 2)],
        advancedRuns: rows.filter((row) => row.advanced.length).length,
        bossSeen: rows.filter((row) => row.bossSeen).length,
        bossKilled: rows.filter((row) => row.bossKilled).length,
      };
    }
  report.costs = {
    hull: [70, 140, 210],
    gun: [90, 180, 270],
    total: 960,
    oldWalletConversion: false,
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report.summary, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
