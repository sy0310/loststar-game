/* Whole-run balance guardrails for the v0.6.11 rework.
 *
 * Runs tests/simulate.cjs (fixed-seed model policies, adaptive dodging, all
 * five card policies, perks 0 and 3) and checks the 15-minute clear rate,
 * survival and mid-run level against targets. This is a model proxy, not
 * human or phone play.
 *
 *   FULL_RUN_ENFORCE=1 node prototypes/salvage-survivor-demo/tests/full-run-guardrails.cjs
 *
 * Env: FULL_RUN_SEEDS (6), FULL_RUN_OUT (releases/full-run/<timestamp>),
 *      FULL_RUN_REPORT=<simulate.cjs report> evaluates an existing report,
 *      FULL_RUN_ENFORCE=1 exits non-zero when a target is missed.
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SEEDS = Number(process.env.FULL_RUN_SEEDS || 6);
const OUT = path.resolve(
  process.env.FULL_RUN_OUT || path.join("releases", "full-run", String(Date.now())),
);
const EXISTING = process.env.FULL_RUN_REPORT;
const ENFORCE = process.env.FULL_RUN_ENFORCE === "1";
const LEVEL_MARK = 300;

/* newPlayer: no permanent upgrades. veteran: hull/gun 3 and all refits 6. */
const TARGETS = {
  newPlayer: {
    perks: 0,
    clearRate: { min: 0.1, max: 0.35 },
    medianSurvival: { min: 360, max: 720 },
    medianLevelAt300: { min: 12, max: 20 },
  },
  veteran: {
    perks: 3,
    clearRate: { min: 0.5, max: 0.9 },
  },
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null;
};

function simulate() {
  fs.mkdirSync(OUT, { recursive: true });
  const report = path.join(OUT, "simulation.json");
  const result = spawnSync(process.execPath, [path.join(__dirname, "simulate.cjs")], {
    stdio: ["ignore", "ignore", "inherit"],
    env: {
      ...process.env,
      SURVIVOR_MOVEMENT: "adaptive",
      SURVIVOR_SEEDS: String(SEEDS),
      SURVIVOR_SIM_OUT: report,
    },
  });
  if (result.status !== 0) throw Error("simulate.cjs failed with " + result.status);
  return report;
}

/* Level at 300 s, or the final level for a run destroyed before 300 s. */
function levelAt(row, mark) {
  const sample = row.samples.find((entry) => entry.time === mark);
  return sample ? sample.level : row.level;
}

function evaluate(report) {
  const groups = {};
  for (const [name, target] of Object.entries(TARGETS)) {
    const rows = report.rows.filter((row) => row.perks === target.perks);
    const metrics = {
      runs: rows.length,
      clearRate: rows.length
        ? Math.round((rows.filter((row) => row.victory).length / rows.length) * 1000) / 1000
        : null,
      medianSurvival: median(rows.map((row) => row.time)),
      medianLevelAt300: median(rows.map((row) => levelAt(row, LEVEL_MARK))),
    };
    const checks = Object.entries(target)
      .filter(([key]) => key !== "perks")
      .map(([key, bound]) => {
        const value = metrics[key];
        const pass =
          value !== null &&
          (bound.min === undefined || value >= bound.min) &&
          (bound.max === undefined || value <= bound.max);
        return { key, value, target: bound, pass };
      });
    groups[name] = { perks: target.perks, metrics, checks };
  }
  return groups;
}

function main() {
  const source = EXISTING ? path.resolve(EXISTING) : simulate();
  const report = JSON.parse(fs.readFileSync(source, "utf8"));
  const groups = evaluate(report);
  const failures = Object.entries(groups).flatMap(([name, group]) =>
    group.checks.filter((check) => !check.pass).map((check) => name + "." + check.key),
  );
  const movementOk = report.movement === "adaptive";
  if (!movementOk) failures.push("report.movementNotAdaptive");
  const summary = {
    source: path.relative(process.cwd(), source),
    movement: report.movement,
    seeds: Math.max(...report.rows.map((row) => row.seed)),
    targets: TARGETS,
    groups,
    failures,
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "guardrails.json"), JSON.stringify(summary, null, 2));
  for (const [name, group] of Object.entries(groups))
    console.log(name, JSON.stringify(group.metrics));
  console.log("failures", failures.length ? failures.join(", ") : "none");
  console.log("output", OUT);
  if (ENFORCE && failures.length) process.exitCode = 1;
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
