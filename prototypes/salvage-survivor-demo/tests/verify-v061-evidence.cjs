/* Frozen v0.6.1 delivery proofs, separate from the immutable v0.6.0 record. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const cp = require("node:child_process");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../..");
const folder = path.join(root, "artifacts/survivor-v061/current");
const raw = (name) => fs.readFileSync(path.join(folder, name));
const json = (name) => JSON.parse(raw(name));
const sha = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");
(async () => {
  const info = json("build-info.json");
  assert.equal(info.version, "0.6.1");
  assert.equal(info.dirty, false);
  assert.equal(info.fileCount, 60);
  assert.equal(info.pngCount, 50);
  assert.equal(raw(info.archive).length, info.bytes);
  assert.equal(sha(raw(info.archive)), info.sha256);
  cp.execFileSync(
    "git",
    ["merge-base", "--is-ancestor", info.sourceCommit, "HEAD"],
    { cwd: root },
  );
  for (const file of info.sourceFiles) {
    const bytes = cp.execFileSync(
      "git",
      ["show", `${info.sourceCommit}:${file.path}`],
      { cwd: root, maxBuffer: 12 * 1024 * 1024 },
    );
    assert.equal(sha(bytes), file.sha256, file.path);
  }
  for (const name of ["browser.json", "taptap-package-browser.json"]) {
    const report = json(name);
    assert.equal(report.stats.expected, 144);
    for (const key of ["unexpected", "skipped", "flaky"])
      assert.equal(report.stats[key], 0);
  }
  const wrapper = json("taptap-build-info.json");
  assert.equal(wrapper.sourceCommit, info.sourceCommit);
  assert.equal(wrapper.fileCount, 60);
  assert.equal(wrapper.payloadUnchanged, true);
  assert.equal(wrapper.originalArchiveSha256, info.sha256);
  assert.equal(sha(raw(wrapper.archive)), wrapper.sha256);
  cp.execFileSync("python3", [
    "-c",
    "import sys,zipfile; a=zipfile.ZipFile(sys.argv[1]); b=zipfile.ZipFile(sys.argv[2]); assert len(b.namelist())==60; assert set(b.namelist())=={'loststar-survivor/'+n for n in a.namelist()}; assert all(a.read(n)==b.read('loststar-survivor/'+n) for n in a.namelist())",
    path.join(folder, info.archive),
    path.join(folder, wrapper.archive),
  ]);
  const receipt = json("taptap-receipt.json");
  assert.equal(receipt.localUploadedZipSha256, wrapper.sha256);
  assert.equal(receipt.serverReadback.file_size, wrapper.bytes);
  assert.equal(receipt.serverReadback.original_file_name, wrapper.archive);
  assert.equal(receipt.serverReadback.screen_orientation, 1);
  assert.equal(receipt.serverReadback.is_releasing, false);
  assert.equal(receipt.mainModuleUnchanged, true);
  for (const key of [
    "boundMainPackage",
    "submittedForReview",
    "formallyPublished",
  ])
    assert.equal(receipt[key], false);
  const natural = json("natural-report.json");
  assert.equal(natural.source.commit, info.sourceCommit);
  assert.equal(natural.qa, false);
  assert.equal(natural.imports, false);
  assert.equal(natural.timeOrSeedOverride, false);
  assert.equal(natural.errors.length, 0);
  assert(natural.runs.some((row) => row.end.time >= 600));
  assert.equal(natural.continuation.sameRecordOnRefresh, true);
  const complete = natural.runs.find((row) => row.end.time >= 600);
  assert(complete.samples.some((row) => row.threshold === 590));
  assert(complete.end.audio.externalMusic.fadesCompleted >= 2);
  assert.equal(complete.end.audio.externalMusic.mediaFailures, 0);
  const av = json("qa-av-report.json");
  assert.equal(av.source.commit, info.sourceCommit);
  assert.equal(av.rows.length, 11);
  assert.equal(av.kind, "explicit-QA-live-canvas-and-final-audio-bus");
  assert.equal(av.errors.length, 0);
  assert.equal(av.maximumBuild.activeSlots, 6);
  assert.equal(av.maximumBuild.passiveSlots, 6);
  for (const row of av.rows)
    assert(Object.values(row.damage).some((value) => value > 0));
  const compat = json("compatibility-performance.json");
  assert.equal(compat.source.commit, info.sourceCommit);
  assert.equal(compat.engines.length, 2);
  for (const row of compat.engines) {
    assert.equal(row.closeReopen, "PASS");
    assert.equal(row.nextRun, "PASS");
    assert.equal(row.errors.length, 0);
    assert.equal(row.syntheticMaximumLoad.persisted, true);
    assert.equal(
      row.syntheticMaximumLoad.audio.externalMusic.fullTrackDecodeCalls,
      0,
    );
  }
  assert.equal(json("model.json").passed, 21);
  const simulation = json("simulation.json");
  assert.equal(simulation.rows.length, 160);
  const audio = json("audio.json");
  assert.equal(audio.cases.length, 32);
  assert.equal(
    audio.sourceSha256,
    info.sourceFiles.find((row) => row.path.endsWith("/audio-engine.js"))
      .sha256,
  );
  const media = json("media.json");
  assert(
    media.rows.some(
      (row) =>
        row.name === "qa-eleven-weapons-with-mix.mp4" &&
        row.streams.some((s) => s.codec_type === "audio"),
    ),
  );
  for (const row of media.rows) assert.equal(sha(raw(row.name)), row.sha256);
  const http = [];
  if (process.env.SURVIVOR_URL)
    for (const file of info.files) {
      const response = await fetch(
        new URL(file.path, process.env.SURVIVOR_URL),
      );
      assert(response.ok);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.equal(sha(bytes), file.sha256, file.path);
      http.push({ path: file.path, bytes: bytes.length, sha256: sha(bytes) });
    }
  const proof = {
    schema: 1,
    sourceCommit: info.sourceCommit,
    archiveSha256: info.sha256,
    wrapperSha256: wrapper.sha256,
    browserCases: 288,
    audioCases: 32,
    modelGroups: 21,
    simulationRuns: 160,
    natural600Seconds: true,
    qaRecipes: 11,
    http,
    phoneV061: "pending user review",
    visualV061: "pending user review",
  };
  proof.evidenceFiles = fs
    .readdirSync(folder)
    .filter(
      (name) =>
        name.endsWith(".json") ||
        name.endsWith(".mp4") ||
        name.endsWith(".png") ||
        name.endsWith(".txt"),
    )
    .sort()
    .map((name) => ({
      path: "artifacts/survivor-v061/current/" + name,
      bytes: raw(name).length,
      sha256: sha(raw(name)),
    }));
  const frozenProof = path.join(folder, "../verification.json");
  if (fs.existsSync(frozenProof) && !process.env.SURVIVOR_PROOF_OUT) {
    const committed = JSON.parse(fs.readFileSync(frozenProof));
    assert.equal(committed.sourceCommit, info.sourceCommit);
    assert.equal(committed.http.length, 60);
    for (const file of committed.evidenceFiles) {
      assert.equal(
        file.path,
        "artifacts/survivor-v061/current/" + path.basename(file.path),
      );
      const bytes = fs.readFileSync(path.join(root, file.path));
      assert.equal(bytes.length, file.bytes, file.path);
      assert.equal(sha(bytes), file.sha256, file.path);
    }
  }
  if (process.env.SURVIVOR_PROOF_OUT)
    fs.writeFileSync(
      process.env.SURVIVOR_PROOF_OUT,
      JSON.stringify(proof, null, 2) + "\n",
    );
  console.log(
    `PASS frozen v0.6.1 proofs, ${http.length} actual HTTP resources`,
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
