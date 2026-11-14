/* Immutable versions at identical QA positions. No ordinary-progress claim. */
const { chromium } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");
(async () => {
  const output = path.resolve("artifacts/survivor-v065"),
    browser = await chromium.launch(),
    context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    }),
    report = {
      scope:
        "Identical QA equipment and positions, real decoded pixels. Motion is paused after one actual combat tick. Labels, fixture ranks and source versions retained.",
      images: [],
    };
  for (const [name, url] of [
    ["before", "http://127.0.0.1:4426/"],
    ["after", "http://127.0.0.1:4430/"],
  ])
    for (const kind of ["companions", "bastion"]) {
      const page = await context.newPage();
      await page.goto(url + "?qa=1");
      await page.waitForFunction(() => SurvivorDemo.ready());
      await page.evaluate((kind) => {
        const Q = SurvivorQA,
          g = Q.startModel(93);
        g.active = {};
        g.spawnTime = 9999;
        g.encounters.schedule = [];
        g.p.inv = 10000;
        g.time = 2;
        g.qaLabel = "固定位置对照 · " + kind;
        g.milestoneSeen = [];
        if (kind === "companions") {
          Q.pick("drone");
          Q.pick("prism");
        } else {
          for (const [weapon, passive, evo] of [
            ["cannon", "lens", "piercebeam"],
            ["shield", "armor", "reactiveaegis"],
          ]) {
            for (let i = 0; i < 5; i++) {
              Q.pick(weapon);
              Q.pick(passive);
            }
            Q.reward(true);
            Q.pick(evo);
          }
          Q.reward(true);
          Q.pick("ionbastion");
        }
        Q.enemy("tank", 0, -180, 100000);
        Q.step(0.001);
        g.mode = "pause";
        Q.runRender();
      }, kind);
      const file = `compare-${kind}-${name}.png`;
      await page.screenshot({ path: path.join(output, file) });
      report.images.push({
        file,
        kind,
        name,
        source: await page.evaluate(() => SurvivorBuild),
      });
      await page.close();
    }
  await context.close();
  await browser.close();
  fs.writeFileSync(
    path.join(output, "visual-comparison.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
