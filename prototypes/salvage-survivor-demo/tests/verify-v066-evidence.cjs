/* Independent source/package/evidence checks for the frozen v066 delivery. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const cp = require("node:child_process");
const root = path.resolve(__dirname, "../../.."),
  folder = path.join(root, "artifacts/survivor-v066");
const read = (name) =>
  JSON.parse(fs.readFileSync(path.join(folder, name), "utf8"));
const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
const build = read("build-info.json"),
  wrapped = read("taptap-build-info.json"),
  proof = read("verification.json");
assert.equal(build.version, "0.6.6");
assert.equal(build.dirty, false);
assert.equal(build.sourceCommit, proof.runtimeSourceSha);
assert.equal(build.fileCount, 78);
assert.equal(build.pngCount, 68);
cp.execFileSync(
  "git",
  ["merge-base", "--is-ancestor", build.sourceCommit, "HEAD"],
  { cwd: root },
);
for (const entry of build.sourceFiles) {
  const raw = cp.execFileSync(
    "git",
    ["show", build.sourceCommit + ":" + entry.path],
    { cwd: root, maxBuffer: 12 * 1024 * 1024 },
  );
  assert.equal(raw.length, entry.bytes, entry.path);
  assert.equal(hash(raw), entry.sha256, entry.path);
}
for (const entry of proof.files) {
  assert(!path.isAbsolute(entry.path) && !entry.path.split("/").includes(".."));
  const raw = fs.readFileSync(path.join(root, entry.path));
  assert.equal(raw.length, entry.bytes, entry.path);
  assert.equal(hash(raw), entry.sha256, entry.path);
}
for (const info of [build, wrapped]) {
  const archive = path.join(folder, info.archive),
    raw = fs.readFileSync(archive);
  assert.equal(raw.length, info.bytes);
  assert.equal(hash(raw), info.sha256);
  const rows = JSON.parse(
    cp.execFileSync(
      "python3",
      [
        "-c",
        'import sys,zipfile,json,hashlib;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps([{\"path\":n,\"sha256\":hashlib.sha256(z.read(n)).hexdigest()}for n in z.namelist()]))',
        archive,
      ],
      { encoding: "utf8" },
    ),
  );
  assert.equal(rows.length, 78);
  for (const row of rows) {
    const name = info.prefix ? row.path.slice(info.prefix.length) : row.path;
    if (info.prefix) assert(row.path.startsWith(info.prefix));
    assert.equal(
      row.sha256,
      build.files.find((item) => item.path === name)?.sha256,
      name,
    );
  }
}
assert.equal(read("model.json").passed, 89);
assert.deepEqual(read("model.json").errors, []);
for (const [name, count] of [
  ["browser.json", 296],
  ["taptap-browser.json", 296],
  ["claim-regression.json", 80],
]) {
  const r = read(name);
  assert.equal(r.stats.expected, count);
  assert.equal(r.stats.unexpected, 0);
  assert.equal(r.stats.flaky, 0);
  assert.equal(r.stats.skipped, 0);
}
for (const [name, count] of [
  ["simulation.json", 160],
  ["simulation-adaptive.json", 20],
])
  assert.equal(read(name).rows.length, count);
const ttk = read("elite-balance.json").rows;
assert.equal(ttk.length, 6);
for (let i = 0; i < ttk.length; i += 2) {
  assert(Math.abs(ttk[i + 1].hp - ttk[i].hp * 3) < 3);
  assert(ttk[i + 1].seconds > ttk[i].seconds * 2);
}
const migration = read("migration.json");
assert.equal(migration.engines.length, 8);
for (const row of migration.engines) {
  assert(row.wholeOldRecordExactOnReload && row.oldEvoAndFusionRetained);
  assert.equal(row.oldWallet, 27049);
  assert.equal(row.newBuild.commit, build.sourceCommit);
  assert.deepEqual(row.errors, []);
}
const compatibility = read("compatibility-performance.json");
assert.equal(compatibility.engines.length, 2);
for (const row of compatibility.engines) {
  assert(row.closeReopen && row.nextRun);
  assert.deepEqual(row.errors, []);
  assert(row.syntheticMaximumLoad.frames > 0);
}
const qa = read("qa-report.json");
assert.equal(qa.source.commit, build.sourceCommit);
assert.deepEqual(qa.errors, []);
assert(qa.scenes.some((row) => row.name === "lottery-result"));
assert(
  qa.scenes.some((row) => row.name === "repair-feedback" && row.hp === 72),
);
const natural = read("natural-report.json");
assert.equal(natural.source.commit, build.sourceCommit);
assert.equal(natural.qa, false);
assert.equal(natural.imports, false);
assert.equal(natural.timeOrSeedOverride, false);
assert(natural.refreshPreserved);
assert.deepEqual(natural.errors, []);
const mac = read("mac-http.json");
assert.equal(mac.sourceCommit, build.sourceCommit);
assert(mac.servers.every((row) => row.verifiedFiles === 78));
const tap = read("taptap-receipt.json");
assert.equal(tap.version, 475539);
assert.equal(tap.bytes, wrapped.bytes);
assert.equal(tap.zipSha256, wrapped.sha256);
assert.equal(tap.status, "ready");
assert.equal(tap.boundMainPackage, false);
assert.equal(tap.isReleasing, false);
assert(tap.mainModuleUnchanged);
const oldRegistry = JSON.parse(
  cp.execFileSync(
    "git",
    [
      "show",
      "6b75a870e9ec34d495c10febcabc2c63d4bdf258:design/visual-renewal/ASSET_REGISTRY.json",
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  ),
).acceptance;
const registry = JSON.parse(
  fs.readFileSync(path.join(root, "design/visual-renewal/ASSET_REGISTRY.json")),
).acceptance;
assert.deepEqual(registry.requirements.slice(0, 354), oldRegistry.requirements);
assert.deepEqual(registry.requiredIds.slice(0, 354), oldRegistry.requiredIds);
assert.equal(registry.requirements.length, 360);
assert.equal(new Set(registry.requiredIds).size, 360);
for (const row of registry.requirements.slice(354)) {
  assert.equal(row.implementation, "IMPLEMENTED");
  assert.equal(row.phone, "NOT_TESTED");
  assert.equal(row.sandboxBinding.sourceCommit, build.sourceCommit);
}
console.log(
  "PASS v066 frozen78 files,89 model,592 HTTP,80 claim,180 policies,8 old ZIP migrations,actual recordings and360 requirements. Phone/user acceptance pending.",
);
