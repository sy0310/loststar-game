/* Bind the reviewed delivery to real Git sources, package bytes and live reports. */
const fs = require("node:fs"),
  path = require("node:path"),
  cp = require("node:child_process"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../.."),
  folder = path.join(root, "artifacts/survivor-v069");
const read = (n) => JSON.parse(fs.readFileSync(path.join(folder, n)));
const hash = (b) => crypto.createHash("sha256").update(b).digest("hex");
const v = read("verification.json"),
  b = read("build-info.json"),
  w = read("taptap-build-info.json");
assert.equal(b.version, "0.6.9");
assert.equal(v.runtimeSourceSha, b.sourceCommit);
assert(!b.dirty);
assert.equal(b.fileCount, 84);
assert.equal(b.pngCount, 74);
assert.equal(w.sourceCommit, b.sourceCommit);
assert(w.payloadUnchanged);
for (const f of v.files) {
  const bytes = fs.readFileSync(path.join(root, f.path));
  assert.equal(bytes.length, f.bytes, f.path);
  assert.equal(hash(bytes), f.sha256, f.path);
}
for (const j of [b, w]) {
  const raw = fs.readFileSync(path.join(folder, j.archive));
  assert.equal(raw.length, j.bytes);
  assert.equal(hash(raw), j.sha256);
}
for (const i of b.sourceFiles) {
  const bytes = cp.execFileSync(
    "git",
    ["show", b.sourceCommit + ":" + i.path],
    { cwd: root, maxBuffer: 16 * 1024 * 1024 },
  );
  assert.equal(hash(bytes), i.sha256, i.path);
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
assert.equal(retained.png, 74);
assert.equal(retained.mp3, 2);
for (const x of retained.exact) assert.equal(payload[x.path], x.sha256);
assert.equal(read("model.json").passed, 112);
assert.deepEqual(read("model.json").errors, []);
for (const [file, count] of [
  ["browser.json", 360],
  ["taptap-browser.json", 360],
  ["claim-regression.json", 80],
  ["reroll-repeat.json", 60],
]) {
  const r = read(file);
  assert.equal(r.stats.expected, count);
  for (const k of ["unexpected", "skipped", "flaky"])
    assert.equal(r.stats[k], 0);
  assert.deepEqual(r.errors, []);
}
assert.equal(read("audio.json").passed, 38);
assert.equal(
  read("audio.json").sourceSha256,
  b.sourceFiles.find((x) => x.path.endsWith("/audio-engine.js")).sha256,
);
assert.equal(read("simulation.json").rows.length, 160);
assert.equal(read("simulation-adaptive.json").rows.length, 20);
const economy = read("economy.json");
assert.equal(
  economy.inputSha256,
  hash(fs.readFileSync(path.join(folder, "simulation-adaptive.json"))),
);
assert.equal(economy.engineeringTotal, 36450);
for (const s of economy.scenarios)
  for (const row of s.table)
    assert.equal(row.wallet, s.initial + row.settledIncome - row.spent);
const migrations = read("migration.json").engines;
assert.equal(migrations.length, 14);
for (const m of migrations) {
  assert.equal(m.newBuild.commit, b.sourceCommit);
  assert(
    m.wholeOldRecordExactOnReload &&
      m.oldEvoAndFusionRetained &&
      m.newRunFivePlusFive &&
      m.newRunFifteenMinutes,
  );
  assert.equal(m.oldWallet, 27049);
  assert.deepEqual(m.errors, []);
}
for (const f of [
  "compatibility-performance.json",
  "compatibility-repair.json",
]) {
  const r = read(f);
  assert.equal(r.source.commit, b.sourceCommit);
  assert.equal(r.engines.length, 2);
  for (const e of r.engines) {
    assert.equal(e.closeReopen, "PASS");
    assert.equal(e.nextRun, "PASS");
    assert.deepEqual(e.errors, []);
    assert(
      e.syntheticMaximumLoad.seconds >= 30 && e.syntheticMaximumLoad.persisted,
    );
  }
}
const qa = read("qa-report.json");
assert.equal(qa.source.commit, b.sourceCommit);
assert(qa.qa && qa.rerollsReloadExact);
assert.deepEqual(
  qa.rerolls.map((x) => x.remaining),
  [2, 1, 0],
);
assert.equal(qa.scenes.length, 4);
for (const s of qa.scenes) {
  assert.equal(s.art, 74);
  assert(Object.values(s.damage).some((x) => x > 0));
}
assert.deepEqual(qa.errors, []);
for (const f of [
  "natural-avoidance-report.json",
  "natural-collection-report.json",
]) {
  const r = read(f);
  assert.equal(r.source.commit, b.sourceCommit);
  assert.equal(r.qa, false);
  assert.equal(r.imports, false);
  assert.equal(r.timeOrSeedOverride, false);
  assert(r.refreshPreserved && r.nextRunRefreshPreserved);
  assert.equal(r.last.mode, "results");
  assert.deepEqual(r.errors, []);
  assert(r.last.time > 180);
  assert(r.returnWallet >= 0);
}
const balance = JSON.parse(
  cp.execFileSync(
    "git",
    ["show", b.sourceCommit + ":design/star-salvage/v069/BALANCE_V069.json"],
    { cwd: root },
  ),
);
assert.equal(balance.pickup.baseExperienceRadius, 36);
assert.equal(balance.selection.rerolls, 3);
assert.equal(balance.selection.focusWeight, 1.35);
assert.equal(balance.activeSlots, 6);
assert.equal(balance.passiveSlots, 6);
const tap = read("taptap-receipt.json");
assert.equal(tap.version, 480314);
assert.equal(tap.sourceCommit, b.sourceCommit);
assert.equal(tap.bytes, w.bytes);
assert.equal(tap.zipSha256, w.sha256);
assert.equal(tap.status, "ready");
assert(!tap.boundMainPackage && !tap.isReleasing && tap.mainModuleUnchanged);
const mac = read("mac-http.json");
assert.equal(mac.sourceCommit, b.sourceCommit);
assert(mac.servers.every((x) => x.verifiedFiles === 84));
assert.equal(mac.fallback.verifiedFiles, 84);
for (const m of read("media.json").files) {
  assert(m.seconds >= 15);
  assert.equal(m.speed, 1);
  assert(
    m.streams.some((x) => x.codec_type === "video" && x.codec_name === "h264"),
  );
  if (m.audio) assert(m.streams.some((x) => x.codec_type === "audio"));
}
const old = JSON.parse(
  cp.execFileSync(
    "git",
    [
      "show",
      "6cd7bab2c485a136ae639807fba2b2005bd52848:design/visual-renewal/ASSET_REGISTRY.json",
    ],
    { cwd: root, maxBuffer: 16 * 1024 * 1024 },
  ),
).acceptance;
const now = JSON.parse(
  fs.readFileSync(path.join(root, "design/visual-renewal/ASSET_REGISTRY.json")),
).acceptance;
assert.deepEqual(now.requirements.slice(0, 371), old.requirements);
assert.deepEqual(now.requiredIds.slice(0, 371), old.requiredIds);
assert(now.requirements.length >= 377);
assert.equal(new Set(now.requiredIds).size, now.requiredIds.length);
assert.deepEqual(
  now.requirements.slice(371, 377),
  read("requirements-audit.json").rows,
);
for (const row of now.requirements.slice(371, 377)) {
  assert.equal(row.sandboxBinding.sourceCommit, b.sourceCommit);
  assert.equal(row.sandboxBinding.taptapVersion, tap.version);
  assert.equal(row.implementation, "IMPLEMENTED");
  assert.equal(row.phone, "NOT_TESTED");
  const ref = row.sourceRefs[0];
  assert(
    fs
      .readFileSync(path.join(root, ref.path), "utf8")
      .split("\n")
      [ref.startLine - 1].includes(row.requirement),
  );
}
console.log(
  "PASS v069112models/720HTTP/80claims/60reroll repeats/38audio/180policies/14oldZIPs, fixed84file packages, natural losses, QA gold lightning and377requirements. User/phone pending.",
);
