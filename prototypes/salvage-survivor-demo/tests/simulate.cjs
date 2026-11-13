/* Fixed-seed model policies. This is not natural browser or human play. */
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { createModel } = require("./model-harness.cjs");
const { steer, inputDirections } = require("./capture-v065.cjs");
const movement = process.env.SURVIVOR_MOVEMENT || "square";
assert(["square", "adaptive"].includes(movement));
const output = path.resolve(
  process.env.SURVIVOR_SIM_OUT || "releases/survivor-v06-simulation.json",
);
const priorities = {
  beam: [
    "ionbastion",
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
  optics: [
    "kaleidoscope",
    "prism",
    "refraction",
    "cannon",
    "lens",
    "shield",
    "armor",
    "reactiveaegis",
    "gravity",
    "singularity",
    "collapse",
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
  guard: [
    "ionbastion",
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
const seedCount = Number(process.env.SURVIVOR_SEEDS || 16);
assert(Number.isInteger(seedCount) && seedCount >= 1 && seedCount <= 16);
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
    policies: priorities,
    movement,
    rows: [],
    summary: {},
  };
  for (const perks of [0, 3])
    for (const policy of policyIds)
      for (let seed = 1; seed <= seedCount; seed++) {
        const g = Q.startModel(seed, {
          hull: perks,
          gun: perks,
          engineering: {
            version: 1,
            thrusters: perks ? 6 : 0,
            salvage: perks ? 6 : 0,
            plating: perks ? 6 : 0,
          },
        });
        const samples = [],
          choices = [];
        const thresholds = [
          10, 30, 60, 120, 180, 240, 300, 360, 420, 480, 540, 600, 660, 720,
          780, 840, 900,
        ];
        let sampleIndex = 0;
        let previousDirection = -1;
        for (let frame = 0; frame < g.endTime * 60 + 100; frame++) {
          if (g.mode === "results") break;
          if (g.mode === "upgrade") {
            const index = select(g, policy);
            choices.push({
              time: g.time,
              id: g.presented[index].id,
              offered: g.presented.map((option) => option.id),
              source: g.upgradeSource ? structuredClone(g.upgradeSource) : null,
            });
            assert(Q.select(index));
          }
          if (movement === "adaptive") {
            if (frame % 6 === 0) {
              previousDirection = steer(g, previousDirection);
              g.keys = Object.fromEntries(
                inputDirections[previousDirection].map((key) => [key, true]),
              );
            }
          } else {
            const direction = Math.floor(g.time / 1.5) % 4;
            g.keys = {
              d: direction === 0,
              s: direction === 1,
              a: direction === 2,
              w: direction === 3,
            };
          }
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
              damageTaken: g.metrics.shipDamage,
              shieldsBlocked: g.metrics.shieldsBlocked,
              hostileShots: g.enemyShots.length,
              nearestEnemy: g.enemy.length
                ? Math.min(
                    ...g.enemy.map((enemy) =>
                      Math.hypot(enemy.x - g.p.x, enemy.y - g.p.y),
                    ),
                  )
                : null,
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
              "ionbastion",
            ].includes(choice.id),
          ),
          bossSeen: !!g.metrics.spawned.boss,
          bossKilled: g.bossKilled,
          enemyKinds: Object.keys(g.metrics.spawned),
          rewards: structuredClone(g.bossRewards),
          evolved: structuredClone(g.evolved),
          fused: structuredClone(g.fused),
          links: g.metrics.events.filter((event) => event.kind === "link"),
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
    engineeringPerBranch: [300, 500, 800, 1200, 1700, 2300],
    engineeringTotal: 20400,
    launchPerRun: 200,
  };
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report.summary, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
