/* Verify the shipped runtime against its immutable git source and actual HTTP. */
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const cp = require("node:child_process");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../..");
const folder = path.join(root, "artifacts/survivor-v06");
const sha = (raw) => crypto.createHash("sha256").update(raw).digest("hex");
const read = (file) => fs.readFileSync(path.join(root, file));
(async () => {
  const info = JSON.parse(
    read("artifacts/survivor-v06/current/build-info.json"),
  );
  assert(!info.dirty);
  assert.equal(info.fileCount, 46);
  assert.equal(info.pngCount, 39);
  const archive = read("artifacts/survivor-v06/current/" + info.archive);
  assert.equal(archive.length, info.bytes);
  assert.equal(sha(archive), info.sha256);
  for (const file of info.sourceFiles) {
    const raw = cp.execFileSync(
      "git",
      ["show", info.sourceCommit + ":" + file.path],
      { cwd: root, maxBuffer: 10 * 1024 * 1024 },
    );
    assert.equal(sha(raw), file.sha256, file.path);
  }
  const browser = JSON.parse(
    read("artifacts/survivor-v06/current/browser.json"),
  );
  assert.equal(browser.stats.expected, 108);
  assert.equal(browser.stats.unexpected, 0);
  assert.equal(browser.stats.skipped, 0);
  assert.equal(browser.stats.flaky, 0);
  const tapInfo = JSON.parse(
    read("artifacts/survivor-v06/current/taptap-build-info.json"),
  );
  const tap = JSON.parse(
    read("artifacts/survivor-v06/current/taptap-receipt.json"),
  );
  const tapBrowser = JSON.parse(
    read("artifacts/survivor-v06/current/taptap-package-browser.json"),
  );
  assert.equal(tapInfo.sourceCommit, info.sourceCommit);
  assert.equal(tapInfo.payloadUnchanged, true);
  assert.equal(tapInfo.originalArchiveSha256, info.sha256);
  const tapArchive = read("artifacts/survivor-v06/current/" + tapInfo.archive);
  assert.equal(sha(tapArchive), tapInfo.sha256);
  assert.equal(tapArchive.length, tapInfo.bytes);
  assert.equal(tap.localUploadedZipSha256, tapInfo.sha256);
  assert.equal(tap.serverReadback.file_size, tapInfo.bytes);
  assert.equal(tap.serverReadback.original_file_name, tapInfo.archive);
  assert.equal(tap.serverReadback.screen_orientation, 1);
  assert.equal(tap.serverReadback.is_releasing, false);
  assert.equal(tap.mainModuleUnchanged, true);
  assert.equal(tap.boundMainPackage, false);
  assert.equal(tap.submittedForReview, false);
  assert.equal(tap.formallyPublished, false);
  for (const field of ["unexpected", "skipped", "flaky"])
    assert.equal(tapBrowser.stats[field], 0);
  assert.equal(tapBrowser.stats.expected, 108);
  cp.execFileSync("python3", [
    "-c",
    "import sys,zipfile; a=zipfile.ZipFile(sys.argv[1]); b=zipfile.ZipFile(sys.argv[2]); assert len(b.namelist())==46; assert set(b.namelist())=={'loststar-survivor/'+n for n in a.namelist()}; assert all(a.read(n)==b.read('loststar-survivor/'+n) for n in a.namelist())",
    path.join(folder, "current", info.archive),
    path.join(folder, "current", tapInfo.archive),
  ]);
  const natural = JSON.parse(
    read("artifacts/survivor-v06/current/natural-report.json"),
  );
  assert.equal(natural.source.commit, info.sourceCommit);
  assert.equal(natural.runs.length, 2);
  assert.equal(natural.qa, false);
  assert.equal(natural.seedOrTimeOverride, false);
  assert.equal(natural.imports, false);
  assert.equal(natural.errors.length, 0);
  for (const run of natural.runs) {
    assert(run.samples.some((sample) => sample.threshold === 60));
    assert(run.upgrades[0].time >= 10 && run.upgrades[0].time <= 35);
    assert(
      Object.keys(run.end.state.evolved).length +
        Object.keys(run.end.state.fused).length >
        0,
    );
  }
  const qa = JSON.parse(read("artifacts/survivor-v06/current/qa-weapons.json"));
  assert.equal(qa.source.commit, info.sourceCommit);
  assert.equal(qa.notNaturalProgress, true);
  assert.equal(qa.rows.length, 8);
  const performance = JSON.parse(
    read("artifacts/survivor-v06/current/compatibility-performance.json"),
  );
  assert.equal(performance.source.commit, info.sourceCommit);
  assert.equal(performance.engines.length, 2);
  assert(
    performance.engines.every(
      (row) => row.closeReopen === "PASS" && row.errors.length === 0,
    ),
  );
  const url = process.env.SURVIVOR_URL;
  const http = [];
  if (url)
    for (const file of info.files) {
      const response = await fetch(new URL(file.path, url));
      assert(response.ok);
      const raw = Buffer.from(await response.arrayBuffer());
      assert.equal(sha(raw), file.sha256, file.path);
      http.push({ path: file.path, bytes: raw.length, sha256: sha(raw) });
    }
  const tapHttp = [];
  if (process.env.SURVIVOR_TAP_URL)
    for (const file of info.files) {
      const response = await fetch(
        new URL(file.path, process.env.SURVIVOR_TAP_URL),
      );
      assert(response.ok);
      const raw = Buffer.from(await response.arrayBuffer());
      assert.equal(sha(raw), file.sha256, file.path);
      tapHttp.push({ path: file.path, bytes: raw.length, sha256: sha(raw) });
    }
  const files = [];
  function inventory(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (
        entry.name === "raw" ||
        entry.name.endsWith(".webm") ||
        entry.name === "verification.json"
      )
        continue;
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) inventory(file);
      else {
        const raw = fs.readFileSync(file);
        files.push({
          path: path.relative(root, file),
          bytes: raw.length,
          sha256: sha(raw),
        });
      }
    }
  }
  inventory(folder);
  const report = {
    schema: 1,
    runtimeSourceSha: info.sourceCommit,
    zip: {
      path: "artifacts/survivor-v06/current/" + info.archive,
      bytes: info.bytes,
      sha256: info.sha256,
      fileCount: 46,
      pngCount: 39,
    },
    actualHttpFiles: http,
    actualTapExtractedHttpFiles: tapHttp,
    tapTap: {
      version: tap.taptapVersion,
      sourceCommit: tap.sourceCommit,
      path: tapInfo.archive,
      bytes: tapInfo.bytes,
      sha256: tapInfo.sha256,
      mainModuleUnchanged: true,
      remoteChecksumProvided: false,
      physicalPhone: "PENDING_USER_SCAN",
    },
    fixedPackageBrowser: {
      expected: 108,
      unexpected: 0,
      skipped: 0,
      flaky: 0,
      engines: ["Chromium", "WebKit"],
      viewports: ["360x800", "390x844"],
    },
    naturalRuns: natural.runs.map((run) => ({
      run: run.run,
      firstUpgradeSeconds: run.upgrades[0].time,
      seconds: run.end.time,
      kills: run.end.kills,
      evolved: run.end.state.evolved,
      fused: run.end.state.fused,
      bossSeen: run.end.state.bossSpawned,
      bossKilled: run.end.state.bossKilled,
    })),
    actualSafari: {
      desktop: true,
      version: "recorded-in-safari.json",
      movement: true,
      autoAttack: true,
      upgrade: true,
      pause: true,
      reloadContinue: true,
      backgroundPause: true,
      settlement: true,
      physicalPhone: false,
    },
    oldMain: {
      runtime: "066a657945b45756a05ea350a1ca5c42972dc371",
      tapTap: 469033,
      kept: true,
      originalArchiveBackedUpPrivately: true,
    },
    phone: "PENDING_PHYSICAL_DEVICE_RECORD",
    userArt: "PENDING",
    humanEnjoyment: "PENDING",
    main4283Replacement: "PENDING_PHONE_GATE",
    newTapTapSelfTest: "UPLOADED_DEVELOPMENT_SELF_TEST_469298",
    evidenceFiles: files,
  };
  if (process.argv.includes("--write")) {
    assert.equal(http.length, 46);
    assert.equal(tapHttp.length, 46);
    fs.writeFileSync(
      path.join(folder, "verification.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
  } else {
    const committed = JSON.parse(
      fs.readFileSync(path.join(folder, "verification.json")),
    );
    assert.equal(committed.runtimeSourceSha, info.sourceCommit);
    assert.equal(committed.actualHttpFiles.length, 46);
    assert.equal(committed.actualTapExtractedHttpFiles.length, 46);
    assert.equal(committed.tapTap.version, 469298);
    for (const file of committed.evidenceFiles) {
      const raw = read(file.path);
      assert.equal(raw.length, file.bytes, file.path);
      assert.equal(sha(raw), file.sha256, file.path);
    }
  }
  console.log(
    JSON.stringify(
      {
        runtime: info.sourceCommit,
        files: files.length,
        httpFiles: http.length,
        browser: report.fixedPackageBrowser,
        phone: report.phone,
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
