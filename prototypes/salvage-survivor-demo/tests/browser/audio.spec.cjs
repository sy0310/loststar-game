const { test, expect } = require("@playwright/test");
const { boot, start, pause, state, stored } = require("./helpers.cjs");

test("music is gesture-started, streams approved tracks and does not change game RNG", async ({
  page,
}) => {
  await boot(page);
  expect(
    await page.evaluate(() => SurvivorAudio.inspect().contextCreated),
  ).toBe(false);
  await start(page);
  await page.waitForFunction(
    () => SurvivorAudio.inspect().contextState === "running",
  );
  await page.waitForFunction(
    () => SurvivorAudio.inspect().externalMusic.activeMedia === 1,
  );
  await pause(page);
  const before = await stored(page);
  await page.evaluate(() => {
    SurvivorAudio.setState({ playing: false, paused: false });
    for (let i = 0; i < 50; i++) SurvivorAudio.play("cannon");
  });
  await page.evaluate(() => SurvivorQA.save());
  const after = await stored(page);
  expect(after.active.snapshot.seed).toBe(before.active.snapshot.seed);
  expect(after.profile).toEqual(before.profile);
  const audio = await page.evaluate(() => SurvivorAudio.inspect());
  expect(audio.externalMusic.fullTrackDecodeCalls).toBe(0);
  expect(audio.externalMusic.tracks.map((track) => track.title)).toEqual([
    "Nebula Groove",
    "Nebula Loop",
  ]);
  expect(audio.externalMusic.activeMedia).toBe(0);
});

test("independent music and SFX controls survive refresh and keep the run paused", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await pause(page);
  await page.locator("#musicVolume").press("Home");
  for (let i = 0; i < 8; i++)
    await page.locator("#musicVolume").press("ArrowRight");
  await page.locator("#sfxVolume").press("Home");
  for (let i = 0; i < 6; i++)
    await page.locator("#sfxVolume").press("ArrowRight");
  await page.locator("#audioMuteBtn").click();
  expect((await state(page)).mode).toBe("pause");
  expect(
    await page.evaluate(() => SurvivorAudio.inspect().settings),
  ).toMatchObject({ music: 0.4, sfx: 0.3, muted: true });
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect(
    await page.evaluate(() => SurvivorAudio.inspect().settings),
  ).toMatchObject({ music: 0.4, sfx: 0.3, muted: true });
  await page.locator("#continueBtn").click();
  await page.waitForFunction(() => SurvivorDemo.state()?.mode === "play");
  await pause(page);
  await expect(page.locator("#audioMuteBtn")).toHaveText("开启声音");
});

test("a permanently pending audio permission never blocks start, pause or resume", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const type = window.AudioContext || window.webkitAudioContext;
    if (type) type.prototype.resume = () => new Promise(() => {});
  });
  await boot(page);
  await start(page);
  await page.waitForTimeout(120);
  expect((await state(page)).time).toBeGreaterThan(0);
  await pause(page);
  await page.locator("#resumeBtn").click();
  await page.waitForFunction(() => SurvivorDemo.state()?.mode === "play");
});

test("real musical byte ranges include correct MIME, length and immutable source bytes", async ({
  page,
}) => {
  await boot(page);
  const result = await page.evaluate(async () => {
    const name = "./assets/audio/nebula-groove.mp3";
    const part = await fetch(name, { headers: { Range: "bytes=0-4095" } }),
      bytes = new Uint8Array(await part.arrayBuffer());
    const head = await fetch(name, { method: "HEAD" });
    const bad = await fetch(name, { headers: { Range: "bytes=99999999-" } });
    return {
      status: part.status,
      range: part.headers.get("content-range"),
      mime: part.headers.get("content-type"),
      count: bytes.length,
      size: head.headers.get("content-length"),
      bad: bad.status,
    };
  });
  expect(result).toMatchObject({
    status: 206,
    count: 4096,
    bad: 416,
    mime: "audio/mpeg",
    size: "2400932",
  });
  expect(result.range).toBe("bytes 0-4095/2400932");
});
