/* Independently bind this delivery to real Git inputs, two fixed ZIPs and actual reports. */
const fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  cp = require("node:child_process"),
  assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../.."),
  folder = path.join(root, "artifacts/survivor-v068");
const read = (n) => JSON.parse(fs.readFileSync(path.join(folder, n)));
const hash = (b) => crypto.createHash("sha256").update(b).digest("hex");
const v = read("verification.json"),
  b = read("build-info.json"),
  w = read("taptap-build-info.json");
assert.equal(v.runtimeSourceSha, b.sourceCommit);
assert.equal(b.version, "0.6.8");
assert(!b.dirty);
assert.equal(b.fileCount, 84);
assert.equal(b.pngCount, 74);
assert.equal(w.sourceCommit, b.sourceCommit);
assert.equal(w.fileCount, 84);
assert(w.payloadUnchanged);
for (const file of v.files) {
  const raw = fs.readFileSync(path.join(root, file.path));
  assert.equal(raw.length, file.bytes, file.path);
  assert.equal(hash(raw), file.sha256, file.path);
}
for (const info of [b, w]) {
  const raw = fs.readFileSync(path.join(folder, info.archive));
  assert.equal(raw.length, info.bytes);
  assert.equal(hash(raw), info.sha256);
}
for (const item of b.sourceFiles) {
  const bytes = cp.execFileSync(
    "git",
    ["show", b.sourceCommit + ":" + item.path],
    { cwd: root, maxBuffer: 12 * 1024 * 1024 },
  );
  assert.equal(bytes.length, item.bytes);
  assert.equal(hash(bytes), item.sha256);
}
const zip = JSON.parse(
  cp.execFileSync(
    "python3",
    [
      "-c",
      `import zipfile,json,hashlib,sys
r=zipfile.ZipFile(sys.argv[1]);w=zipfile.ZipFile(sys.argv[2]);assert len(r.namelist())==len(w.namelist())==84
assert set(w.namelist())=={'loststar-survivor/'+n for n in r.namelist()}
for n in r.namelist():assert r.read(n)==w.read('loststar-survivor/'+n)
print(json.dumps({n:{'bytes':len(r.read(n)),'sha256':hashlib.sha256(r.read(n)).hexdigest()}for n in r.namelist()}))`,
      path.join(folder, b.archive),
      path.join(folder, w.archive),
    ],
    { encoding: "utf8", maxBuffer: 2 * 1024 * 1024 },
  ),
);
for (const file of b.files)
  assert.deepEqual(zip[file.path], { bytes: file.bytes, sha256: file.sha256 });
const retained = read("retained-assets.json");
assert.equal(retained.png, 70);
assert.equal(retained.mp3, 2);
for (const row of retained.exact)
  assert.equal(zip[row.path].sha256, row.sha256);
const model = read("model.json");
assert.equal(model.passed, 105);
assert.deepEqual(model.errors, []);
for (const file of ["browser.json", "taptap-browser.json"]) {
  const r = read(file);
  assert.equal(r.stats.expected, 336);
  for (const k of ["unexpected", "skipped", "flaky"])
    assert.equal(r.stats[k], 0);
  assert.deepEqual(r.errors, []);
}
for (const [file, count] of [
  ["claim-regression.json", 80],
  ["legacy-heal-repeat.json", 20],
]) {
  const r = read(file);
  assert.equal(r.stats.expected, count);
  for (const k of ["unexpected", "skipped", "flaky"])
    assert.equal(r.stats[k], 0);
  assert.deepEqual(r.errors, []);
}
const audio = read("audio.json");
assert.equal(audio.passed, 38);
assert.deepEqual(audio.errors, []);
assert.equal(read("simulation.json").rows.length, 160);
assert.equal(read("simulation-adaptive.json").rows.length, 20);
const economy = read("economy.json");
assert.equal(economy.engineeringTotal, 36450);
assert.equal(economy.perBranchTotal, 12150);
assert.equal(
  economy.inputSha256,
  hash(fs.readFileSync(path.join(folder, "simulation-adaptive.json"))),
);
for (const s of economy.scenarios) {
  assert.deepEqual(
    s.table.map((x) => x.minutes),
    [0, 5, 15, 30, 60, 120],
  );
  for (const x of s.table) {
    assert.equal(x.wallet, s.initial + x.settledIncome - x.spent);
    assert(x.wallet >= 0);
  }
}
const migrations = read("migration.json").engines;
assert.equal(migrations.length, 12);
for (const x of migrations) {
  assert.equal(x.newBuild.commit, b.sourceCommit);
  assert(
    x.wholeOldRecordExactOnReload &&
      x.oldEvoAndFusionRetained &&
      x.newRunFivePlusFive &&
      x.newRunFifteenMinutes,
  );
  assert.equal(x.oldWallet, 27049);
  assert.equal(x.oldHull, 3);
  assert.equal(x.oldGun, 3);
  assert.deepEqual(x.errors, []);
}
for (const file of [
  "compatibility-performance.json",
  "compatibility-repair.json",
]) {
  const r = read(file);
  assert.equal(r.source.commit, b.sourceCommit);
  assert.equal(r.engines.length, 2);
  for (const e of r.engines) {
    assert.equal(e.closeReopen, "PASS");
    assert.equal(e.nextRun, "PASS");
    assert.deepEqual(e.errors, []);
    assert(e.syntheticMaximumLoad.seconds >= 30);
    assert(e.syntheticMaximumLoad.persisted);
  }
}
const qa = read("qa-report.json");
assert.equal(qa.source.commit, b.sourceCommit);
assert(qa.qa);
assert.deepEqual(qa.errors, []);
assert.equal(qa.initialExperience.actualXP, 10);
assert.equal(qa.initialExperience.engineering, 0);
assert.equal(qa.scenes.length, 4);
for (const s of qa.scenes) {
  assert(s.damage > 0);
  assert.equal(s.art, 74);
}
const natural = read("natural-report.json");
assert.equal(natural.source.commit, b.sourceCommit);
assert.equal(natural.qa, false);
assert.equal(natural.imports, false);
assert.equal(natural.timeOrSeedOverride, false);
assert.deepEqual(natural.errors, []);
assert(natural.refreshPreserved && natural.nextRunRefreshPreserved);
assert(natural.returnWallet >= 750);
assert.equal(natural.preparedProfile.credits, natural.returnWallet - 750);
assert.equal(natural.nextRun.active.prism, 1);
assert.equal(natural.nextRun.engineering.thrusters, 1);
assert.equal(natural.nextRun.profile.credits, natural.preparedProfile.credits);
assert(natural.liveMix.playSegments.some((x) => x.end - x.start >= 15));
const tap = read("taptap-receipt.json");
assert(tap.version > 476192);
assert.equal(tap.sourceCommit, b.sourceCommit);
assert.equal(tap.bytes, w.bytes);
assert.equal(tap.zipSha256, w.sha256);
assert.equal(tap.status, "ready");
assert.equal(tap.boundMainPackage, false);
assert.equal(tap.isReleasing, false);
assert(tap.mainModuleUnchanged);
const mac = read("mac-http.json");
assert.equal(mac.sourceCommit, b.sourceCommit);
assert(mac.servers.every((s) => s.verifiedFiles === 84));
const media = read("media.json");
for (const item of media.files) {
  assert(item.seconds >= 15);
  assert.equal(item.speed, 1);
  assert(
    item.streams.some(
      (x) => x.codec_type === "video" && x.codec_name === "h264",
    ),
  );
  if (item.audio) assert(item.streams.some((x) => x.codec_type === "audio"));
}
const specifications = read("store-media-validation.json");
assert(
  specifications.icon &&
    specifications.header &&
    specifications.square &&
    specifications.actualScreenshots,
);
assert(specifications.gameplayCandidate && specifications.trailerCandidate);
const frozen = JSON.parse(
  cp.execFileSync(
    "git",
    [
      "show",
      "9c82a78832de9d84d7b9a1c5da2a735b10f5aaca:design/visual-renewal/ASSET_REGISTRY.json",
    ],
    { cwd: root, encoding: "utf8", maxBuffer: 12 * 1024 * 1024 },
  ),
).acceptance;
const a = JSON.parse(
  fs.readFileSync(path.join(root, "design/visual-renewal/ASSET_REGISTRY.json")),
).acceptance;
assert.deepEqual(a.requirements.slice(0, 365), frozen.requirements);
assert.deepEqual(a.requiredIds.slice(0, 365), frozen.requiredIds);
assert(a.requirements.length >= 371);
assert.equal(new Set(a.requiredIds).size, a.requiredIds.length);
assert.deepEqual(
  a.requirements.slice(365, 371),
  read("requirements-audit.json").rows,
);
for (const row of a.requirements.slice(365, 371)) {
  assert.equal(row.sandboxBinding.sourceCommit, b.sourceCommit);
  assert.equal(row.sandboxBinding.taptapVersion, tap.version);
  assert.equal(row.phone, "NOT_TESTED");
  assert.equal(row.implementation, "IMPLEMENTED");
  const source = fs
    .readFileSync(path.join(root, row.sourceRefs[0].path), "utf8")
    .split("\n")[row.sourceRefs[0].startLine - 1];
  assert(source.includes(row.requirement));
}
console.log(
  "PASS v06884payload/74PNG,105model,672HTTP,80claims+20legacy repeats,38audio,180policies,12oldZIPs,natural next-run,live fusions,store candidates and371 requirements. User/phone pending.",
);
