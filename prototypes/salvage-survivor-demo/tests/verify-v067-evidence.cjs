/* Fixed-package delivery and independent, version-specific evidence checks. */
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  cp = require("node:child_process");
const root = path.resolve(__dirname, "../../.."),
  folder = path.join(root, "artifacts/survivor-v067");
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(folder, name), "utf8"));
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const b = read("build-info.json"),
  w = read("taptap-build-info.json"),
  proof = read("verification.json");
assert.equal(b.version, "0.6.7");
assert.equal(b.dirty, false);
assert.equal(b.sourceCommit, proof.runtimeSourceSha);
assert.equal(b.fileCount, 80);
assert.equal(b.pngCount, 70);
cp.execFileSync(
  "git",
  ["merge-base", "--is-ancestor", b.sourceCommit, "HEAD"],
  { cwd: root },
);
for (const item of b.sourceFiles) {
  const bytes = cp.execFileSync(
    "git",
    ["show", b.sourceCommit + ":" + item.path],
    { cwd: root, maxBuffer: 12 * 1024 * 1024 },
  );
  assert.equal(bytes.length, item.bytes, item.path);
  assert.equal(hash(bytes), item.sha256, item.path);
}
for (const item of proof.files) {
  assert(!path.isAbsolute(item.path) && !item.path.split("/").includes(".."));
  const bytes = fs.readFileSync(path.join(root, item.path));
  assert.equal(bytes.length, item.bytes, item.path);
  assert.equal(hash(bytes), item.sha256, item.path);
}
for (const info of [b, w]) {
  const archive = path.join(folder, info.archive),
    bytes = fs.readFileSync(archive);
  assert.equal(bytes.length, info.bytes);
  assert.equal(hash(bytes), info.sha256);
  assert.equal(bytes.subarray(0, 2).toString(), "PK");
  const rows = JSON.parse(
    cp.execFileSync(
      "python3",
      [
        "-c",
        'import sys,json,zipfile,hashlib;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps([{\"path\":n,\"hash\":hashlib.sha256(z.read(n)).hexdigest()}for n in z.namelist()]))',
        archive,
      ],
      { encoding: "utf8" },
    ),
  );
  assert.equal(rows.length, 80);
  for (const row of rows) {
    if (info.prefix) assert(row.path.startsWith(info.prefix));
    const name = info.prefix ? row.path.slice(info.prefix.length) : row.path;
    assert.equal(row.hash, b.files.find((x) => x.path === name)?.sha256, name);
  }
}
assert.equal(read("model.json").passed, 99);
assert.deepEqual(read("model.json").errors, []);
for (const [name, count] of [
  ["browser.json", 320],
  ["taptap-browser.json", 320],
  ["new-ui-browser.json", 24],
  ["claim-regression.json", 80],
]) {
  const r = read(name);
  assert.equal(r.stats.expected, count);
  for (const key of ["skipped", "unexpected", "flaky"])
    assert.equal(r.stats[key], 0);
}
for (const [name, count] of [
  ["simulation.json", 160],
  ["simulation-adaptive.json", 20],
])
  assert.equal(read(name).rows.length, count);
const migration = read("migration.json");
assert.equal(migration.engines.length, 10);
for (const r of migration.engines) {
  assert.equal(r.oldWallet, 27049);
  assert.equal(r.newBuild.commit, b.sourceCommit);
  assert(
    r.wholeOldRecordExactOnReload &&
      r.oldEvoAndFusionRetained &&
      r.newRunFivePlusFive,
  );
  assert.deepEqual(r.errors, []);
}
for (const name of [
  "compatibility-performance.json",
  "compatibility-repair.json",
]) {
  const r = read(name);
  assert.equal(r.engines.length, 2);
  for (const e of r.engines) {
    assert.equal(e.closeReopen, "PASS");
    assert.equal(e.nextRun, "PASS");
    assert.deepEqual(e.errors, []);
    assert(e.syntheticMaximumLoad.frames > 0);
  }
}
const qa = read("qa-report.json"),
  scene = (name) => qa.scenes.find((x) => x.name === name);
assert.equal(qa.source.commit, b.sourceCommit);
assert.deepEqual(qa.errors, []);
for (const name of [
  "three-different-icons",
  "three-repeat-icons",
  "healing-choice",
  "repair-pod-level1",
  "repair-pod-level5-before",
  "repair-pod-level5-after",
  "dock-before",
  "dock-max",
  "launch-reserved",
  "prepared-departure",
])
  assert(scene(name), name);
const before = scene("repair-pod-level5-before"),
  after = scene("repair-pod-level5-after");
assert(
  Math.abs((after.hp - before.hp) / (after.time - before.time) - 0.9) < 1e-6,
);
assert.equal(scene("repair-pod-level1").active.repairpod, 1);
assert.equal(scene("dock-max").profile.credits, 6649);
assert.equal(scene("launch-reserved").profile.credits, 6449);
assert.equal(scene("prepared-departure").active.prism, 1);
assert(!scene("prepared-departure").profile.launchPlan);
const rings = scene("three-rings").orbits;
for (const p of rings.drone) assert(Math.abs(Math.hypot(p.x, p.y) - 56) < 1e-6);
for (const p of rings.prism)
  assert(Math.abs(Math.hypot(p.x, p.y) - 108) < 1e-6);
assert.equal(rings.bladeRadius, 152);
const natural = read("natural-report.json");
assert.equal(natural.source.commit, b.sourceCommit);
assert.equal(natural.qa, false);
assert.equal(natural.imports, false);
assert.equal(natural.timeOrSeedOverride, false);
assert(natural.refreshPreserved && natural.nextRunRefreshPreserved);
assert.deepEqual(natural.errors, []);
assert.equal(natural.returnWallet, 1684);
assert.equal(natural.nextRun.profile.credits, 1184);
assert.equal(natural.nextRun.active.prism, 1);
assert.equal(natural.nextRun.speed, 178.5);
const economy = read("economy.json");
assert.equal(economy.engineeringTotal, 20400);
assert.equal(
  economy.inputSha256,
  hash(fs.readFileSync(path.join(folder, "simulation-adaptive.json"))),
);
for (const s of economy.scenarios) {
  assert.deepEqual(
    s.table.map((x) => x.minutes),
    [0, 5, 15, 30, 60, 120],
  );
  for (const row of s.table) {
    assert.equal(row.wallet, s.initial + row.settledIncome - row.spent);
    assert(row.wallet >= 0);
  }
}
const tap = read("taptap-receipt.json");
assert.equal(tap.version, 476192);
assert.equal(tap.sourceCommit, b.sourceCommit);
assert.equal(tap.bytes, w.bytes);
assert.equal(tap.zipSha256, w.sha256);
assert.equal(tap.status, "ready");
assert.equal(tap.boundMainPackage, false);
assert.equal(tap.isReleasing, false);
assert(tap.mainModuleUnchanged);
const mac = read("mac-http.json");
assert.equal(mac.sourceCommit, b.sourceCommit);
assert(mac.servers.every((x) => x.verifiedFiles === 80));
const historical = JSON.parse(
  cp.execFileSync(
    "git",
    [
      "show",
      "e3106495eeea25b5d1af56b9842b8b5e0f91a581:design/visual-renewal/ASSET_REGISTRY.json",
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 12 * 1024 * 1024 },
  ),
).acceptance;
const current = JSON.parse(
  fs.readFileSync(path.join(root, "design/visual-renewal/ASSET_REGISTRY.json")),
).acceptance;
assert.deepEqual(current.requirements.slice(0, 360), historical.requirements);
assert.deepEqual(current.requiredIds.slice(0, 360), historical.requiredIds);
const frozen067 = JSON.parse(
  cp.execFileSync(
    "git",
    [
      "show",
      "9c82a78832de9d84d7b9a1c5da2a735b10f5aaca:design/visual-renewal/ASSET_REGISTRY.json",
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 12 * 1024 * 1024 },
  ),
).acceptance;
assert.deepEqual(current.requirements.slice(0, 365), frozen067.requirements);
assert.deepEqual(current.requiredIds.slice(0, 365), frozen067.requiredIds);
assert(current.requirements.length >= 365);
assert.equal(new Set(current.requiredIds).size, current.requiredIds.length);
for (const row of current.requirements.slice(360, 365)) {
  assert.equal(row.implementation, "IMPLEMENTED");
  assert.equal(row.phone, "NOT_TESTED");
  assert.equal(row.sandboxBinding.sourceCommit, b.sourceCommit);
  const contract = fs
    .readFileSync(path.join(root, row.sourceRefs[0].path), "utf8")
    .split("\n")[row.sourceRefs[0].startLine - 1];
  assert(contract.includes(row.requirement));
}
console.log(
  "PASS v06780 real payload files,99 model,640HTTP+24focused,80claims,180policies,10oldZIP migrations,actual repair/engineering/natural movies and365 requirements. User/phone pending.",
);
