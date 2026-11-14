/* Verify this revision's immutable files and reported checks independently. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const cp = require("node:child_process");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../..");
const folder = path.join(root, "artifacts/survivor-v062");
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(folder, name), "utf8"));
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const proof = read("verification.json");
const build = read("build-info.json");
const wrapped = read("taptap-build-info.json");
assert.equal(proof.schema, 1);
assert.equal(build.version, "0.6.2");
assert.equal(proof.runtimeSourceSha, build.sourceCommit);
assert.equal(build.dirty, false);
assert.equal(build.fileCount, 66);
assert.equal(build.pngCount, 56);
assert.equal(build.sourceFiles.length, 66);
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
      "assert len(a.namelist())==len(z.namelist())==66",
      'assert {n.split("/")[0] for n in z.namelist()}=={"loststar-survivor"}',
      'for r in b["files"]:',
      ' raw=a.read(r["path"])',
      ' assert raw==z.read("loststar-survivor/"+r["path"])',
      ' assert len(raw)==r["bytes"] and hashlib.sha256(raw).hexdigest()==r["sha256"]',
      'print("66 byte-identical files")',
    ].join("\n"),
    folder,
  ],
  { encoding: "utf8" },
);
for (const name of ["browser.json", "taptap-package-browser.json"]) {
  const report = read(name);
  assert.equal(report.stats.expected, 180, name);
  for (const key of ["skipped", "unexpected", "flaky"])
    assert.equal(report.stats[key], 0, name);
  assert.deepEqual(report.errors, []);
}
const model = read("model.json");
assert.equal(model.passed, 35);
assert.deepEqual(model.errors, []);
const simulation = read("simulation.json");
assert.equal(simulation.rows.length, 160);
for (const row of simulation.rows) {
  assert(row.time > 0 && row.time <= 600.001);
  assert(Number.isInteger(row.credits) && row.credits >= 0);
}
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
assert(natural.runs.some((row) => row.end.time >= 600));
assert.equal(natural.continuation.sameRecordOnRefresh, true);
const qa = read("qa-threats-report.json");
assert.equal(qa.qa, true);
assert.equal(qa.rows.length, 9);
assert.equal(qa.source.commit, build.sourceCommit);
assert.deepEqual(qa.errors, []);
assert(qa.rows.find((row) => row.type === "minelayer").damage > 0);
const captureCode = cp.execFileSync(
  "git",
  ["cat-file", "blob", proof.qaCaptureHarnessBlob],
  { cwd: root },
);
assert.equal(hash(captureCode), qa.captureSourceSha256);
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
  "PASS v0.6.2 frozen source,",
  inventory.trim(),
  ", model35 / HTTP360 / audio38 / policies160 / natural600 / real persistence",
);
