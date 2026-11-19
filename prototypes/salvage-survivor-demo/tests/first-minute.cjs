/* First-minute onboarding harness (v0.6.11 plan, design/star-salvage/v0611).
 *
 * Plays fresh profiles at 390x844 in real time with two scripted players and
 * reports level-up timing, enemy density and survival. It also checks the
 * start screen copy and two startup failure paths. It does not replace play
 * on a real phone.
 *
 *   node prototypes/salvage-survivor-demo/serve.cjs --port 4472
 *   SURVIVOR_URL=http://127.0.0.1:4472/ \
 *     node prototypes/salvage-survivor-demo/tests/first-minute.cjs
 *
 * Env: FIRST_MINUTE_RUNS (3), FIRST_MINUTE_CAP (180 game seconds),
 *      FIRST_MINUTE_OUT (releases/first-minute/<timestamp>),
 *      FIRST_MINUTE_ENFORCE=1 exits non-zero when a target is missed,
 *      FIRST_MINUTE_ONLY=startup runs only the start screen and startup checks
 *      (a quick partial run that never counts as acceptance).
 */
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
const { steer, inputDirections } = require("./capture-v065.cjs");

const URL = process.env.SURVIVOR_URL || "http://127.0.0.1:4472/";
const RUNS = Number(process.env.FIRST_MINUTE_RUNS || 3);
const CAP = Number(process.env.FIRST_MINUTE_CAP || 180);
const OUT = path.resolve(
  process.env.FIRST_MINUTE_OUT ||
    path.join("releases", "first-minute", String(Date.now())),
);
const ENFORCE = process.env.FIRST_MINUTE_ENFORCE === "1";
const STARTUP_ONLY = process.env.FIRST_MINUTE_ONLY === "startup";
const MARKS = [10, 20, 30, 60, 120, 180];
const SHOT_MARKS = new Set([10, 30, 60]);
const WANDER_TURN_MS = 1300;
const WANDER = [["a"], ["s"], ["d"], ["w"]];
const VIEWPORT = { width: 390, height: 844 };

/* Medians over RUNS. A run that never levels up counts as Infinity.
 * affordsFirstUpgrade compares parts carried out of the run with the cheapest
 * first-tier permanent upgrade read from the running build. */
const TARGETS = {
  wanderer: {
    firstLevelUp: { max: 8 },
    levelAt60: { min: 5, max: 8 },
    survival: { min: 90 },
    enemiesAt10: { min: 6 },
    killsAt20: { min: 15 },
    affordsFirstUpgrade: { min: 1 },
    invalidRuns: { max: 0 },
  },
  dodger: {
    firstLevelUp: { max: 15 },
    levelAt60: { min: 4 },
    levelAt180: { min: 7 },
    survival: { min: 180 },
    invalidRuns: { max: 0 },
  },
};

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const median = (values) => {
  const sorted = values
    .map((value) => (value === null || value === undefined ? Infinity : value))
    .sort((a, b) => a - b);
  return sorted.length ? sorted[Math.floor((sorted.length - 1) / 2)] : null;
};

async function newPage(browser, init) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  return { context, page, errors };
}

async function hold(page, held, keys) {
  for (const key of held) await page.keyboard.up(key);
  for (const key of keys) await page.keyboard.down(key);
  return keys;
}

async function chooseCard(page, strategy, g) {
  const cards = await page
    .locator("[data-pick]")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.innerText.replace(/\s+/g, " ").trim()),
    );
  let index = 0;
  if (strategy === "dodger" && g.p.hp / g.p.maxhp < 0.4) {
    const repair = cards.findIndex((text) => text.includes("船体修补"));
    if (repair >= 0) index = repair;
  }
  await page.locator("[data-pick]").nth(index).click();
  return { cards, picked: index };
}

async function playRun(browser, strategy, index) {
  const { context, page, errors } = await newPage(browser);
  const shots = index === 0;
  const run = {
    strategy,
    index,
    levelUps: [],
    marks: {},
    firstCards: null,
    end: null,
    errors,
  };
  try {
    await page.goto(URL);
    await page.waitForFunction(() => window.SurvivorDemo?.ready(), null, {
      timeout: 30000,
    });
    await page.click("#startBtn");
    await page.waitForFunction(
      () => window.SurvivorDemo.state()?.mode === "play",
      null,
      { timeout: 30000 },
    );
    let held = [];
    let previous = -1;
    let wanderIndex = 0;
    let turnAt = 0;
    let lastMode = "play";
    const began = Date.now();
    while (Date.now() - began < (CAP + 150) * 1000) {
      const g = await page.evaluate(() => window.SurvivorDemo.state());
      if (!g) {
        await pause(100);
        continue;
      }
      /* Record marks before the cap check so the 180 s mark is never skipped. */
      if (g.mode === "play" || g.time >= CAP) {
        for (const mark of MARKS) {
          if (g.time >= mark && !run.marks[mark]) {
            run.marks[mark] = {
              level: g.level,
              kills: g.kills,
              enemies: g.enemy.length,
              hp: Math.round(g.p.hp),
            };
            if (shots && SHOT_MARKS.has(mark))
              await page.screenshot({
                path: path.join(OUT, `${strategy}-${mark}s.png`),
              });
          }
        }
      }
      if (g.mode === "results" || g.mode === "settling") {
        run.end = {
          reason: g.p.hp <= 0 ? "destroyed" : "finished",
          time: g.time,
          level: g.level,
          kills: g.kills,
          credits: g.credits,
        };
        break;
      }
      if (g.time >= CAP) {
        run.end = {
          reason: "cap",
          time: g.time,
          level: g.level,
          kills: g.kills,
          credits: g.credits,
        };
        break;
      }
      if (g.mode === "upgrade") {
        held = await hold(page, held, []);
        previous = -1;
        if (lastMode !== "upgrade") {
          run.levelUps.push({ time: g.time, level: g.level });
          if (run.levelUps.length === 1 && shots)
            await page.screenshot({
              path: path.join(OUT, `${strategy}-first-upgrade.png`),
            });
        }
        const choice = await chooseCard(page, strategy, g);
        if (!run.firstCards) run.firstCards = choice.cards;
        lastMode = "upgrade";
        await pause(150);
        continue;
      }
      lastMode = g.mode;
      if (g.mode === "play") {
        if (strategy === "dodger") {
          const direction = steer(g, previous, true);
          if (direction !== previous) {
            held = await hold(page, held, inputDirections[direction]);
            previous = direction;
          }
        } else if (Date.now() - turnAt > WANDER_TURN_MS) {
          held = await hold(page, held, WANDER[wanderIndex++ % WANDER.length]);
          turnAt = Date.now();
        }
      }
      await pause(100);
    }
    await hold(page, held, []);
    if (shots) await page.screenshot({ path: path.join(OUT, `${strategy}-end.png`) });
  } catch (error) {
    run.errors.push(String(error));
  } finally {
    await context.close();
  }
  if (!run.end) run.end = { reason: "wall-limit", time: null };
  return run;
}

function summarize(strategy, runs, cheapestUpgrade) {
  /* Runs that never reached the cap or a result screen are invalid and score 0. */
  const survival = (run) =>
    run.end.reason === "destroyed"
      ? run.end.time
      : ["cap", "finished"].includes(run.end.reason)
        ? CAP
        : 0;
  const partsAtEnd = median(runs.map((run) => run.end.credits ?? 0));
  const levelAt = (run, mark) =>
    run.marks[mark]?.level ?? (run.end.reason === "destroyed" ? 0 : null);
  const metrics = {
    firstLevelUp: median(runs.map((run) => run.levelUps[0]?.time ?? null)),
    levelAt60: median(runs.map((run) => levelAt(run, 60) ?? 0)),
    levelAt180: median(runs.map((run) => levelAt(run, 180) ?? 0)),
    survival: median(runs.map(survival)),
    enemiesAt10: median(runs.map((run) => run.marks[10]?.enemies ?? 0)),
    killsAt20: median(runs.map((run) => run.marks[20]?.kills ?? 0)),
    levelUpsBy60: median(
      runs.map((run) => run.levelUps.filter((up) => up.time <= 60).length),
    ),
    invalidRuns: runs.filter(
      (run) =>
        !["destroyed", "cap", "finished"].includes(run.end.reason) ||
        run.errors.length > 0,
    ).length,
    partsAtEnd,
    cheapestUpgrade,
    affordsFirstUpgrade:
      Number.isFinite(cheapestUpgrade) && partsAtEnd >= cheapestUpgrade ? 1 : 0,
  };
  const checks = Object.entries(TARGETS[strategy]).map(([key, target]) => {
    const value = metrics[key];
    const pass =
      (target.max === undefined || value <= target.max) &&
      (target.min === undefined || value >= target.min);
    return { key, value, target, pass };
  });
  return { metrics, checks };
}

async function checkHome(browser) {
  const { context, page } = await newPage(browser);
  try {
    await page.goto(URL);
    await page.waitForFunction(() => window.SurvivorDemo?.ready(), null, {
      timeout: 30000,
    });
    const home = await page.evaluate(() => ({
      title: document.title,
      heading: document.querySelector("#start h1")?.textContent.trim() || "",
      text: document.getElementById("start").innerText,
    }));
    await page.screenshot({ path: path.join(OUT, "home.png") });
    return {
      ...home,
      checks: [
        { key: "noDevLabel", pass: !home.text.includes("开发自测") },
        { key: "noCommitHash", pass: !/\b[0-9a-f]{7}\b/.test(home.text) },
        {
          key: "storeTitle",
          pass: (home.heading + home.title).includes("星海突进"),
        },
      ],
    };
  } finally {
    await context.close();
  }
}

async function checkNoStorage(browser) {
  const { context, page, errors } = await newPage(browser, () => {
    Object.defineProperty(window, "indexedDB", {
      configurable: true,
      get: () => undefined,
    });
  });
  try {
    await page.goto(URL);
    const ready = await page
      .waitForFunction(
        () =>
          window.SurvivorDemo?.ready() &&
          !document.getElementById("startBtn").disabled,
        null,
        { timeout: 15000 },
      )
      .then(() => true)
      .catch(() => false);
    const status = await page.locator("#saveStatus").innerText().catch(() => "");
    await page.screenshot({ path: path.join(OUT, "startup-no-storage.png") });
    return { key: "playsWithoutStorage", pass: ready, status, errors };
  } finally {
    await context.close();
  }
}

/* Only the art loader requests the skimmer sprite (the start screen <img> is the
 * player ship), so failing its first request makes SurvivorArt.load() reject. */
async function checkImageRetry(browser) {
  const { context, page, errors } = await newPage(browser);
  let blocked = 0;
  await page.route(/actors\/skimmer(@|-)2x\.png/, (route) => {
    if (blocked++ === 0) return route.abort();
    return route.continue();
  });
  try {
    await page.goto(URL);
    const reload = page.getByRole("button", { name: /重新加载/ });
    const offered = await reload
      .waitFor({ state: "visible", timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    await page.screenshot({ path: path.join(OUT, "startup-image-failure.png") });
    let recovered = false;
    if (offered) {
      await reload.click();
      recovered = await page
        .waitForFunction(
          () =>
            window.SurvivorDemo?.ready() &&
            !document.getElementById("startBtn").disabled,
          null,
          { timeout: 15000 },
        )
        .then(() => true)
        .catch(() => false);
    }
    return { key: "imageFailureRetry", pass: offered && recovered, offered, recovered, errors };
  } finally {
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const report = { url: URL, cap: CAP, runsPerStrategy: RUNS, targets: TARGETS };
  try {
    const runtime = await (async () => {
      const { context, page } = await newPage(browser);
      await page.goto(URL);
      const values = await page.evaluate(() => ({
        build: window.SurvivorBuild || null,
        costs: window.SurvivorBalance?.permanentCosts || null,
      }));
      await context.close();
      return values;
    })();
    report.build = runtime.build;
    report.permanentCosts = runtime.costs;
    const cheapestUpgrade = runtime.costs
      ? Math.min(runtime.costs.hull[0], runtime.costs.gun[0])
      : Infinity;
    report.home = await checkHome(browser);
    report.startup = [await checkNoStorage(browser), await checkImageRetry(browser)];
    report.strategies = {};
    report.partial = STARTUP_ONLY;
    for (const strategy of STARTUP_ONLY ? [] : ["wanderer", "dodger"]) {
      const runs = await Promise.all(
        Array.from({ length: RUNS }, (_, index) => playRun(browser, strategy, index)),
      );
      report.strategies[strategy] = {
        runs,
        ...summarize(strategy, runs, cheapestUpgrade),
      };
    }
  } finally {
    await browser.close();
  }
  const failures = [
    ...report.home.checks.filter((check) => !check.pass).map((c) => "home." + c.key),
    ...report.startup.filter((check) => !check.pass).map((c) => "startup." + c.key),
    ...Object.entries(report.strategies).flatMap(([name, result]) =>
      result.checks.filter((check) => !check.pass).map((c) => name + "." + c.key),
    ),
  ];
  report.failures = failures;
  fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(report, null, 2));
  for (const [name, result] of Object.entries(report.strategies)) {
    console.log(name, JSON.stringify(result.metrics));
    for (const run of result.runs)
      console.log(
        "  run",
        run.index,
        "levelUps",
        run.levelUps.map((up) => up.time.toFixed(1)).join(","),
        "end",
        JSON.stringify(run.end),
        run.errors.length ? "errors " + run.errors.length : "",
      );
  }
  console.log("home", report.home.checks.map((c) => c.key + "=" + c.pass).join(" "));
  console.log("startup", report.startup.map((c) => c.key + "=" + c.pass).join(" "));
  console.log("failures", failures.length ? failures.join(", ") : "none");
  if (STARTUP_ONLY) console.log("partial run: startup checks only, not an acceptance result");
  console.log("output", OUT);
  if (ENFORCE && failures.length) process.exitCode = 1;
  if (ENFORCE && STARTUP_ONLY) process.exitCode = 2;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
