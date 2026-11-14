/* Verify this revision's immutable files and reported checks independently. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const cp = require("node:child_process");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../..");
const folder = path.join(root, "artifacts/survivor-v064");
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(folder, name), "utf8"));
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const proof = read("verification.json");
const build = read("build-info.json");
const wrapped = read("taptap-build-info.json");
assert.equal(proof.schema, 1);
assert.equal(build.version, "0.6.4");
assert.equal(proof.runtimeSourceSha, build.sourceCommit);
assert.equal(build.dirty, false);
assert.equal(build.fileCount, 69);
assert.equal(build.pngCount, 59);
assert.equal(build.sourceFiles.length, 69);
cp.execFileSync(
  "git",
  ["merge-base", "--is-ancestor", build.sourceCommit, "HEAD"],
  { cwd: root },
);
for (const row of build.sourceFiles) {
  const bytes = cp.execFileSync(
    "git",
    ["show", build.sourceCommit + ":" + row.path],
    { cwd: root, maxBuffer: 12 * 1024 * 1024 },
  );
  assert.equal(bytes.length, row.bytes, row.path);
  assert.equal(hash(bytes), row.sha256, row.path);
}
for (const row of proof.files) {
  assert(!path.isAbsolute(row.path) && !row.path.split("/").includes(".."));
  const bytes = fs.readFileSync(path.join(root, row.path));
  assert.equal(bytes.length, row.bytes, row.path);
  assert.equal(hash(bytes), row.sha256, row.path);
}
for (const info of [build, wrapped]) {
  const bytes = fs.readFileSync(path.join(folder, info.archive));
  assert.equal(bytes.length, info.bytes);
  assert.equal(hash(bytes), info.sha256);
}
assert.equal(wrapped.sourceCommit, build.sourceCommit);
assert.equal(wrapped.payloadUnchanged, true);
const inventory = cp.execFileSync(
  "python3",
  [
    "-c",
    [
      "import json,sys,zipfile,hashlib",
      "from pathlib import Path",
      "p=Path(sys.argv[1])",
      'b=json.loads((p/"build-info.json").read_text())',
      't=json.loads((p/"taptap-build-info.json").read_text())',
      'a=zipfile.ZipFile(p/b["archive"]); z=zipfile.ZipFile(p/t["archive"])',
      "assert len(a.namelist())==len(z.namelist())==69",
      'assert {n.split("/")[0] for n in z.namelist()}=={"loststar-survivor"}',
      'for r in b["files"]:',
      ' raw=a.read(r["path"])',
      ' assert raw==z.read("loststar-survivor/"+r["path"])',
      ' assert len(raw)==r["bytes"] and hashlib.sha256(raw).hexdigest()==r["sha256"]',
      'print("69 byte-identical files")',
    ].join("\n"),
    folder,
  ],
  { encoding: "utf8" },
);
for (const name of ["browser.json", "taptap-package-browser.json"]) {
  const report = read(name);
  assert.equal(report.stats.expected, 260, name);
  for (const key of ["skipped", "unexpected", "flaky"])
    assert.equal(report.stats[key], 0, name);
  assert.deepEqual(report.errors, []);
}
const model = read("model.json");
assert.equal(model.passed, 70);
assert.deepEqual(model.errors, []);
const simulation = read("simulation.json");
assert.equal(simulation.rows.length, 160);
for (const row of simulation.rows) {
  assert(row.time > 0 && row.time <= 900.001);
  assert(Number.isInteger(row.credits) && row.credits >= 0);
}
assert.equal(simulation.movement, "square");
const adaptive = read("simulation-adaptive.json");
assert.equal(adaptive.movement, "adaptive");
assert.equal(adaptive.rows.length, 20);
assert.deepEqual(adaptive.policies, simulation.policies);
const audio = read("audio.json");
assert.equal(audio.passed, 38);
assert.deepEqual(audio.errors, []);
assert.equal(
  audio.sourceSha256,
  build.sourceFiles.find((row) => row.path.endsWith("/src/audio-engine.js"))
    .sha256,
);
for (const cue of ["enemyCharge", "enemyFire"])
  assert.equal(
    audio.cases.filter((row) => row.id === cue + "-actual-offline-signal")
      .length,
    2,
  );
const compatibility = read("compatibility-performance.json");
assert.equal(compatibility.engines.length, 2);
for (const engine of compatibility.engines) {
  assert.equal(engine.closeReopen, "PASS");
  assert.equal(engine.nextRun, "PASS");
  assert.deepEqual(engine.errors, []);
  assert(engine.syntheticMaximumLoad.max.hazards <= 12);
}
const natural = read("natural-report.json");
assert.equal(natural.qa, false);
assert.equal(natural.imports, false);
assert.equal(natural.timeOrSeedOverride, false);
assert.equal(natural.source.commit, build.sourceCommit);
assert.deepEqual(natural.errors, []);
assert(natural.runs.some((row) => row.end.time >= 900));
assert.equal(natural.continuation.sameRecordOnRefresh, true);
const qa = read("qa-v064-report.json");
assert.equal(qa.qa, true);
assert.equal(qa.rows.length, 14);
assert.equal(qa.source.commit, build.sourceCommit);
assert.deepEqual(qa.errors, []);
assert.equal(
  qa.rows.filter(
    (row) => row.kind === "eliteProfile" && row.shots["hostile-elite"] > 0,
  ).length,
  3,
);
assert.equal(qa.rows.filter((row) => row.kind === "lightningStage").length, 3);
assert(qa.rows.find((row) => row.kind === "prismRefraction").refractions > 0);
assert(
  qa.rows.find((row) => row.kind === "prismEvolution").damage.kaleidoscope > 0,
);
assert(
  qa.rows.find((row) => row.kind === "thunderhiveVioletGold").damage
    .thunderhive > 0,
);
assert(
  qa.rows.find((row) => row.kind === "lateBossEcho").shots[
    "hostile-boss-echo"
  ] > 0,
);
const comparison = read("body-comparison.json");
assert.equal(
  comparison.images[0].source.commit,
  "f9bf85c1ac9313d44edfc63403761a648cd9b2cb",
);
assert.equal(comparison.images[1].source.commit, build.sourceCommit);
const captureCode = cp.execFileSync(
  "git",
  [
    "show",
    build.sourceCommit +
      ":prototypes/salvage-survivor-demo/tests/capture-v064.cjs",
  ],
  { cwd: root },
);
assert.equal(hash(captureCode), qa.captureSourceSha256);
const migration = read("migration.json");
assert.equal(migration.engines.length, 4);
for (const engine of migration.engines) {
  assert.equal(engine.oldWallet, 27049);
  assert.equal(engine.oldHull, 3);
  assert.equal(engine.oldGun, 3);
  assert.equal(engine.wholeOldRecordExactOnReload, true);
  assert.equal(engine.oldEvoAndFusionRetained, true);
  assert.equal(engine.newRunFivePlusFive, true);
  assert.equal(engine.newRunFifteenMinutes, true);
  assert.equal(engine.newBuild.commit, build.sourceCommit);
  assert.deepEqual(engine.errors, []);
}
const previous = JSON.parse(
  fs.readFileSync(path.join(root, "artifacts/survivor-v063/build-info.json")),
);
for (const row of previous.sourceFiles.filter((file) =>
  /\.(png|mp3)$/.test(file.path),
)) {
  const current = build.sourceFiles.find((file) => file.path === row.path);
  assert.deepEqual(
    current,
    row,
    "All approved images and music retained " + row.path,
  );
}
const recipes = {
  piercebeam: ["cannon", "lens"],
  hunterswarm: ["drone", "lock"],
  chainstorm: ["arc", "capacitor"],
  meteorbarrage: ["missile", "cooler"],
  spiralsaw: ["blade", "magnet"],
  reactiveaegis: ["shield", "armor"],
  kaleidoscope: ["prism", "refraction"],
  collapse: ["gravity", "singularity"],
};
const fusions = {
  thunderhive: ["drone", "arc"],
  blastwheel: ["missile", "blade"],
  eventhorizon: ["prism", "gravity"],
  ionbastion: ["cannon", "shield"],
};
const activeIds = Object.values(recipes).map(([id]) => id);
const passiveIds = Object.values(recipes).map(([, id]) => id);
for (const row of [...simulation.rows, ...adaptive.rows]) {
  const active = { cannon: 1 },
    passive = {},
    evolved = new Set(),
    consumed = new Set(),
    spentRewards = new Set();
  for (const choice of row.choices) {
    if (choice.source) {
      assert.equal(choice.source.kind, "boss");
      assert(!spentRewards.has(choice.source.id));
      spentRewards.add(choice.source.id);
    }
    for (const offered of choice.offered.filter(
      (id) => recipes[id] || fusions[id],
    )) {
      assert(choice.source && choice.source.advancedRoll === true);
    }
    if (activeIds.includes(choice.id)) {
      assert(!consumed.has(choice.id));
      active[choice.id] = (active[choice.id] || 0) + 1;
      assert(active[choice.id] <= 5);
    } else if (passiveIds.includes(choice.id)) {
      passive[choice.id] = (passive[choice.id] || 0) + 1;
      assert(passive[choice.id] <= 5);
    } else if (recipes[choice.id]) {
      const [weapon, aux] = recipes[choice.id];
      assert.equal(active[weapon], 5);
      assert.equal(passive[aux], 5);
      assert(!evolved.has(weapon));
      evolved.add(weapon);
    } else if (fusions[choice.id]) {
      for (const source of fusions[choice.id]) {
        assert(evolved.has(source));
        evolved.delete(source);
        delete active[source];
        consumed.add(source);
      }
    }
  }
}
const tap = read("taptap-receipt.json");
assert.equal(tap.sourceCommit, build.sourceCommit);
assert.equal(tap.mainModuleUnchanged, true);
assert.equal(tap.boundMainPackage, false);
assert.equal(tap.submittedForReview, false);
assert.equal(tap.formallyPublished, false);
assert.equal(tap.localUploadedZipSha256, wrapped.sha256);
assert(Number.isInteger(tap.version));
assert.equal(proof.phone, "NOT_TESTED");
console.log(
  "PASS v0.6.4 frozen source,",
  inventory.trim(),
  ", model70 / HTTP520 / audio38 / policies160+adaptive20 / natural900 / real persistence",
);
