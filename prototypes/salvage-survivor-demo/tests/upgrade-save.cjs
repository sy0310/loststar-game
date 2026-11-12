/* Actual v062 HTTP -> v063 HTTP on the same isolated origin and persistent browser. */
const { chromium, webkit } = require("@playwright/test");
const { spawn, execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const here = path.resolve(__dirname, "..");
const root = path.resolve(here, "../..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "loststar-v063-migration-"));
const oldRoot = path.join(temp, "old");
const newRoot = process.env.SURVIVOR_CURRENT_ROOT || here;
const output = path.resolve(
  process.env.SURVIVOR_MIGRATION_OUT || "releases/survivor-migration.json",
);
const port = Number(process.env.SURVIVOR_MIGRATION_PORT || 4441);
const url = `http://127.0.0.1:${port}/?qa=1`;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let server;
async function serve(folder) {
  if (server) {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill();
    await exited;
  }
  server = spawn(
    process.execPath,
    [path.join(here, "serve.cjs"), "--port", String(port), "--root", folder],
    { stdio: "ignore" },
  );
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await delay(100);
  }
  throw Error("Migration HTTP server did not start");
}
async function stored(page) {
  return page.evaluate(async () => {
    const s = await SurvivorPersistence.create({ qa: true });
    const r = (await s.read()).record;
    s.close();
    return r;
  });
}
(async () => {
  const archive = path.join(
    root,
    "artifacts/survivor-v062/loststar-survivor-4ca726f.zip",
  );
  execFileSync("python3", [
    "-c",
    "import sys,zipfile;zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])",
    archive,
    oldRoot,
  ]);
  const report = {
    scope:
      "Actual committed4ca726f ZIP served over HTTP, same-origin server replacement and isolated persistent browser. No original user browser or namespaces touched.",
    engines: [],
  };
  for (const type of [chromium, webkit]) {
    await serve(oldRoot);
    const folder = path.join(temp, type.name());
    const context = await type.launchPersistentContext(folder, {
      headless: true,
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    try {
      await page.goto(url);
      await page.waitForFunction(() => SurvivorDemo.ready());
      const oldBuild = await page.evaluate(() => SurvivorBuild);
      assert.equal(oldBuild.commit, "4ca726f6a18cc0b2e597379d68cf1df9e87b6c4b");
      await page.locator("#startBtn").click();
      await page.waitForFunction(
        () => SurvivorDemo.state()?.mode === "play" && !SurvivorDemo.saving(),
      );
      await page.evaluate(async () => {
        SurvivorQA.state().credits = 28009;
        await SurvivorQA.end(false);
      });
      await page.waitForFunction(() => !SurvivorDemo.saving());
      for (const id of ["upgradeHullBtn", "upgradeGunBtn"])
        for (let rank = 0; rank < 3; rank++) {
          await page.locator("#" + id).click();
          await page.waitForFunction(() => !SurvivorDemo.saving());
          await delay(600);
        }
      await page.locator("#retryBtn").click();
      await page.waitForFunction(
        () => SurvivorDemo.state()?.mode === "play" && !SurvivorDemo.saving(),
      );
      await page.evaluate(async () => {
        const Q = SurvivorQA,
          g = Q.state();
        g.spawnTime = 999;
        g.p.inv = 999;
        Q.pick("cannon");
        Q.pick("cannon");
        Q.pick("lens");
        Q.pick("lens");
        if (!Q.pick("piercebeam")) throw Error("Old EVO fixture rejected");
        for (const id of ["drone", "arc"])
          for (let i = 0; i < 3; i++) Q.pick(id);
        if (!Q.pick("thunderhive")) throw Error("Old fusion fixture rejected");
        g.mode = "pause";
        await Q.save();
        await Q.settled();
      });
      const before = await stored(page);
      assert.equal(before.profile.credits, 27049);
      assert.equal(before.profile.hull, 3);
      assert.equal(before.profile.gun, 3);
      assert.equal(before.active.snapshot.game.active.cannon, 3);
      assert.equal(before.active.snapshot.game.evolved.cannon, "piercebeam");
      assert.equal(before.active.snapshot.game.fused.thunderhive, true);
      await serve(newRoot);
      await page.reload();
      await page.waitForFunction(() => SurvivorDemo.ready());
      const newBuild = await page.evaluate(() => SurvivorBuild);
      assert.equal(newBuild.version, "0.6.3");
      assert.deepEqual(await stored(page), before);
      await page.locator("#continueBtn").click();
      await page.waitForFunction(
        () => SurvivorDemo.state()?.mode === "play" && !SurvivorDemo.saving(),
      );
      const oldRun = await page.evaluate(() => SurvivorDemo.state());
      assert.equal(oldRun.active.cannon, 3);
      assert.equal(oldRun.evolved.cannon, "piercebeam");
      assert.equal(oldRun.fused.thunderhive, true);
      assert(!oldRun.rules.progressionVersion);
      await page.locator("#pauseBtn").click();
      await page.waitForFunction(() => !SurvivorDemo.saving());
      await page.locator("#leaveBtn").click();
      await page.waitForFunction(() => !SurvivorDemo.saving());
      assert.equal((await stored(page)).profile.credits, 27049);
      await page.locator("#retryBtn").click();
      await page.waitForFunction(
        () => SurvivorDemo.state()?.mode === "play" && !SurvivorDemo.saving(),
      );
      const next = await page.evaluate(() => SurvivorDemo.state());
      assert.equal(next.rules.progressionVersion, 2);
      assert.equal((await stored(page)).profile.credits, 27049);
      assert.equal(next.p.maxhp, 148);
      assert.deepEqual(errors, []);
      report.engines.push({
        engine: type.name(),
        oldBuild,
        newBuild,
        oldWallet: 27049,
        oldHull: 3,
        oldGun: 3,
        wholeOldRecordExactOnReload: true,
        oldEvoAndFusionRetained: true,
        newRunFivePlusFive: true,
        errors,
      });
    } finally {
      await context.close();
    }
  }
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
  console.log(
    "PASS both engines actual v062 ZIP -> v063 HTTP, old27049/rights/EVO/fusion and new run",
  );
})()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => {
    server?.kill();
    fs.rmSync(temp, { recursive: true, force: true });
  });
