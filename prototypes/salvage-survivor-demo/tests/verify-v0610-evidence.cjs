/* Re-open the exact delivered archives, source bytes, reports and marketing files. */
const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../..");
const folder = path.join(root, "artifacts/survivor-v0610");
const read = (name) => JSON.parse(fs.readFileSync(path.join(folder, name)));
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const v = read("verification.json"),
  b = read("build-info.json"),
  w = read("taptap-build-info.json");
assert.equal(b.version, "0.6.10");
assert.equal(v.runtimeSourceSha, b.sourceCommit);
assert(!b.dirty);
assert.equal(b.fileCount, 84);
assert.equal(b.pngCount, 74);
assert.equal(w.sourceCommit, b.sourceCommit);
assert(w.payloadUnchanged);
for (const file of v.files) {
  const bytes = fs.readFileSync(path.join(root, file.path));
  assert.equal(bytes.length, file.bytes, file.path);
  assert.equal(hash(bytes), file.sha256, file.path);
}
for (const build of [b, w]) {
  const bytes = fs.readFileSync(path.join(folder, build.archive));
  assert.equal(bytes.length, build.bytes);
  assert.equal(hash(bytes), build.sha256);
}
for (const file of b.sourceFiles) {
  const bytes = cp.execFileSync(
    "git",
    ["show", b.sourceCommit + ":" + file.path],
    { cwd: root, maxBuffer: 16 * 1024 * 1024 },
  );
  assert.equal(hash(bytes), file.sha256, file.path);
}
const payload = JSON.parse(
  cp.execFileSync(
    "python3",
    [
      "-c",
      `import zipfile,json,hashlib,sys
r=zipfile.ZipFile(sys.argv[1]);w=zipfile.ZipFile(sys.argv[2]);assert len(r.namelist())==len(w.namelist())==84
assert set(w.namelist())=={'loststar-survivor/'+n for n in r.namelist()}
for n in r.namelist():assert r.read(n)==w.read('loststar-survivor/'+n)
print(json.dumps({n:hashlib.sha256(r.read(n)).hexdigest()for n in r.namelist()}))`,
      path.join(folder, b.archive),
      path.join(folder, w.archive),
    ],
    { encoding: "utf8" },
  ),
);
const retained = read("retained-assets.json");
assert.equal(retained.exact.length, 76);
for (const file of retained.exact)
  assert.equal(payload[file.path], file.sha256);
assert.equal(read("model.json").passed, 118);
assert.deepEqual(read("model.json").errors, []);
for (const [file, count] of [
  ["browser.json", 376],
  ["taptap-browser.json", 376],
  ["claim-regression.json", 80],
]) {
  const report = read(file);
  assert.equal(report.stats.expected, count);
  for (const key of ["unexpected", "skipped", "flaky"])
    assert.equal(report.stats[key], 0);
  assert.deepEqual(report.errors, []);
}
assert.equal(read("audio.json").passed, 38);
assert.equal(read("audio.json").sourceSha256,b.sourceFiles.find(f=>f.path.endsWith('/audio-engine.js')).sha256);
assert.equal(read("simulation.json").rows.length, 160);
assert.equal(read("simulation-adaptive.json").rows.length, 20);
assert.equal(read("economy.json").engineeringTotal, 36450);
assert.equal(
  read("economy.json").inputSha256,
  hash(fs.readFileSync(path.join(folder, "simulation-adaptive.json"))),
);
const oldBalance = JSON.parse(
  cp.execFileSync(
    "git",
    ["show", b.sourceCommit + ":design/star-salvage/v069/BALANCE_V069.json"],
    { cwd: root, encoding: "utf8" },
  ),
);
const newBalance = JSON.parse(
  cp.execFileSync(
    "git",
    ["show", b.sourceCommit + ":design/star-salvage/v0610/BALANCE_V0610.json"],
    { cwd: root, encoding: "utf8" },
  ),
);
assert.deepEqual(newBalance.upgradeRepair, { startRatio: 0.28, endRatio: 0.7 });
delete newBalance.upgradeRepair;
newBalance.version = oldBalance.version;
assert.deepEqual(newBalance, oldBalance);
const migrations = read("migration.json").engines;
assert.equal(migrations.length, 16);
for (const row of migrations) {
  assert.equal(row.newBuild.commit, b.sourceCommit);
  assert.equal(row.oldWallet, 27049);
  assert(
    row.wholeOldRecordExactOnReload &&
      row.oldEvoAndFusionRetained &&
      row.newRunFifteenMinutes,
  );
  assert.deepEqual(row.errors, []);
}
for (const file of [
  "compatibility-performance.json",
  "compatibility-repair.json",
]) {
  const report = read(file);
  assert.equal(report.source.commit, b.sourceCommit);
  assert.equal(report.engines.length, 2);
  for (const row of report.engines) {
    assert.equal(row.closeReopen, "PASS");
    assert.equal(row.nextRun, "PASS");
    assert.deepEqual(row.errors, []);
    assert(
      row.syntheticMaximumLoad.seconds >= 30 &&
        row.syntheticMaximumLoad.persisted,
    );
  }
}
const capture = read("capture.json");
assert.equal(capture.source.commit, b.sourceCommit);
assert(capture.qa);
assert.deepEqual(
  capture.repairs.map((r) => r.hp),
  [38, 52, 66],
);
assert.deepEqual(capture.errors, []);
assert.equal(read("screenshots-validation.json").valid, true);
assert.equal(read("screenshots-validation.json").candidates.length, 3);
for (const file of read("media.json").files) {
  assert(file.seconds >= 15);
  assert.equal(file.speed, 1);
  const video = file.streams.find((s) => s.codec_type === "video");
  assert.equal(video.codec_name, "h264");
  assert.equal(video.width, 780);
  assert.equal(video.height, 1688);
}
const tap = read("taptap-receipt.json");
assert.equal(tap.version, 480638);
assert.equal(tap.sourceCommit, b.sourceCommit);
assert.equal(tap.bytes, w.bytes);
assert.equal(tap.zipSha256, w.sha256);
assert.equal(tap.status, "ready");
assert(tap.readinessCheck.packageRecordAvailable && tap.mainModuleUnchanged);
assert(!tap.boundMainPackage && !tap.isReleasing);
const mac = read("mac-http.json");
assert.equal(mac.sourceCommit, b.sourceCommit);
assert(mac.servers.every((s) => s.verifiedFiles === 84));
assert.equal(mac.fallback.verifiedFiles, 84);
const materials = read("test-materials.json");
assert.equal(materials.sourceCommit, b.sourceCommit);
assert.equal(materials.files.length, 12);
assert.equal(materials.taptapVersion, tap.version);
for (const file of materials.files) {
  const bytes = fs.readFileSync(path.join(root, file.path));
  assert.equal(hash(bytes), file.sha256);
}
const materialArchive = fs.readFileSync(
  path.join(root, materials.archive.path),
);
assert.equal(hash(materialArchive), materials.archive.sha256);
const audit = read("requirements-audit.json");
assert.equal(audit.total, 384);
assert.equal(audit.rows.length, 7);
const old = JSON.parse(
  cp.execFileSync(
    "git",
    [
      "show",
      "abc454799e1c5dc54baaab982bb083913a550f3c:design/visual-renewal/ASSET_REGISTRY.json",
    ],
    { cwd: root, maxBuffer: 16 * 1024 * 1024 },
  ),
).acceptance;
const now = JSON.parse(
  fs.readFileSync(path.join(root, "design/visual-renewal/ASSET_REGISTRY.json")),
).acceptance;
assert.deepEqual(now.requirements.slice(0, 377), old.requirements);
assert.deepEqual(now.requiredIds.slice(0, 377), old.requiredIds);
assert.deepEqual(now.requirements.slice(377, 384), audit.rows);
for (const row of audit.rows) {
  assert.equal(row.sandboxBinding.sourceCommit, b.sourceCommit);
  assert.equal(row.sandboxBinding.taptapVersion, tap.version);
  assert.equal(row.phone, "NOT_TESTED");
  const ref = row.sourceRefs[0];
  assert(
    fs
      .readFileSync(path.join(root, ref.path), "utf8")
      .split("\n")
      [ref.startLine - 1].includes(row.requirement),
  );
}
const art = JSON.parse(
  fs.readFileSync(
    path.join(
      root,
      "design/star-salvage/v0610/test-materials/art/verification.json",
    ),
  ),
);
assert.equal(art.checkCount, 18);
console.log(
  "PASS v0610 fixed84files,118models,752HTTP,80claims,38audio,180policies,16oldZIPs and five-item reviewed test materials. User/phone pending.",
);
