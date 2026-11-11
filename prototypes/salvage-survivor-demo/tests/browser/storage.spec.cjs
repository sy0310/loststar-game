const { test, expect } = require("@playwright/test");
const { boot, start, state, stored, pause, settle } = require("./helpers.cjs");

async function abortNextPut(page) {
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...args) {
      IDBObjectStore.prototype.put = original;
      this.transaction.abort();
      throw new DOMException(
        "Deliberate QA storage failure",
        "QuotaExceededError",
      );
    };
  });
}

test("refresh continues the same world, loadout and selected random choices", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await page.keyboard.down("d");
  await page.waitForTimeout(400);
  await page.keyboard.up("d");
  await page.evaluate(() => {
    SurvivorQA.pick("drone");
    SurvivorQA.level();
  });
  await page.waitForFunction(() => !SurvivorDemo.saving());
  const before = await stored(page);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  await page.locator("#continueBtn").click();
  await page.waitForFunction(
    () => SurvivorDemo.state()?.mode === "upgrade" && !SurvivorDemo.saving(),
  );
  const after = await state(page);
  expect(after.p).toEqual(before.active.snapshot.game.p);
  expect(after.active).toEqual(before.active.snapshot.game.active);
  expect(after.presented).toEqual(before.active.snapshot.game.presented);
  expect(after.enemy).toEqual(before.active.snapshot.game.enemy);
  expect((await stored(page)).active.id).toBe(before.active.id);
  await page.locator('[data-pick="0"]').click();
  await pause(page);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  await page.locator("#continueBtn").click();
  await page.waitForFunction(() => SurvivorDemo.state()?.mode === "play");
  expect((await state(page)).level).toBe(after.level);
});

test("a pickup consumed just before an upgrade is absent from the persisted snapshot", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await page.evaluate(() => {
    const g = SurvivorQA.state();
    g.xp = g.xpNext - 8;
    g.pickups = [
      { x: g.p.x, y: g.p.y, type: "xp", value: 8, t: 10 },
      { x: g.p.x, y: g.p.y, type: "xp", value: 8, t: 10 },
    ];
    SurvivorQA.step(1 / 60);
  });
  await page.waitForFunction(() => !SurvivorDemo.saving());
  const saved = await stored(page);
  expect(saved.active.snapshot.game.pickups).toHaveLength(1);
  const collected = saved.active.snapshot.game.metrics.collectedXP;
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  await page.locator("#continueBtn").click();
  await page.locator('[data-pick="0"]').click();
  await expect.poll(async () => (await state(page)).pickups.length).toBe(0);
  expect((await state(page)).metrics.collectedXP).toBe(collected + 8);
});

test("settlement replay and refresh credit the run once; the next run uses saved upgrades", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  const active = (await stored(page)).active;
  await settle(page, 300);
  const once = await stored(page);
  await page.evaluate(async (active) => {
    const store = await SurvivorPersistence.create({ qa: true });
    await store.settle(active.id, active.revision, { credits: 300, kills: 0 });
    store.close();
  }, active);
  expect((await stored(page)).profile).toEqual(once.profile);
  await page.locator("#upgradeHullBtn").click();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  expect((await stored(page)).profile).toMatchObject({
    credits: 230,
    hull: 1,
    runs: 1,
  });
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  await page.locator("#retryBtn").click();
  await page.waitForFunction(() => SurvivorDemo.state()?.mode === "play");
  expect((await state(page)).p.maxhp).toBe(116);
  expect((await stored(page)).profile.runs).toBe(1);
});

test("rapid permanent-upgrade input charges only the displayed tier", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await settle(page, 1000);
  await page.locator("#upgradeHullBtn").dblclick({ delay: 80 });
  await page.waitForFunction(() => !SurvivorDemo.saving());
  expect((await stored(page)).profile).toMatchObject({ hull: 1, credits: 930 });
  await page.waitForTimeout(600);
  await page.locator("#upgradeHullBtn").click();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  expect((await stored(page)).profile).toMatchObject({ hull: 2, credits: 790 });
});

test("two IndexedDB clients cannot both buy the same displayed upgrade", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await settle(page, 1000);
  const results = await page.evaluate(async () => {
    const a = await SurvivorPersistence.create({ qa: true }),
      b = await SurvivorPersistence.create({ qa: true });
    const results = await Promise.allSettled([
      a.buy("gun", 0),
      b.buy("gun", 0),
    ]);
    a.close();
    b.close();
    return results.map((result) => result.status);
  });
  expect(results.sort()).toEqual(["fulfilled", "rejected"]);
  expect((await stored(page)).profile).toMatchObject({ gun: 1, credits: 910 });
});

test("a second tab claims a saved run and a stale writer cannot settle it", async ({
  page,
  context,
}) => {
  await boot(page);
  await start(page);
  await pause(page);
  const before = (await stored(page)).active;
  const second = await context.newPage();
  await boot(second);
  await second.locator("#continueBtn").click();
  await page.waitForTimeout(200);
  const failure = await page.evaluate(async (active) => {
    const store = await SurvivorPersistence.create({ qa: true });
    try {
      await store.settle(active.id, active.revision, {
        credits: 999,
        kills: 0,
      });
      return null;
    } catch (error) {
      return error.message;
    } finally {
      store.close();
    }
  }, before);
  expect(failure).toContain("未重复结算");
  expect((await stored(page)).profile.credits).toBe(0);
  await settle(second, 33);
  expect((await stored(page)).profile).toMatchObject({ credits: 33, runs: 1 });
  await second.close();
});

test("checkpoint failure preserves the previous record and can be retried", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  const before = await stored(page);
  await abortNextPut(page);
  await page.locator("#pauseBtn").click();
  await expect(page.locator("#retrySaveBtn")).toBeVisible();
  expect((await stored(page)).revision).toBe(before.revision);
  await page.locator("#retrySaveBtn").click();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  expect((await stored(page)).revision).toBeGreaterThan(before.revision);
});

test("failed settlement retains the run and blocks retry play until one successful save", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await abortNextPut(page);
  await settle(page, 123);
  expect((await stored(page)).profile.credits).toBe(0);
  expect((await stored(page)).active).not.toBeNull();
  await expect(page.locator("#retryBtn")).toBeDisabled();
  await page.locator("#retrySaveBtn").click();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  expect((await stored(page)).profile).toMatchObject({ credits: 123, runs: 1 });
  await expect(page.locator("#retryBtn")).toBeEnabled();
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect((await stored(page)).profile.credits).toBe(123);
});

test("failed permanent purchase changes neither cash nor level", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await settle(page, 300);
  const before = (await stored(page)).profile;
  await abortNextPut(page);
  await page.locator("#upgradeGunBtn").click();
  await expect(page.locator("#retrySaveBtn")).toBeVisible();
  expect((await stored(page)).profile).toEqual(before);
  expect(await page.evaluate(() => SurvivorDemo.profile())).toEqual(before);
});

test("own legacy prototype profile is copied with raw backup and no extra charge", async ({
  page,
}) => {
  await page.goto("");
  await page.waitForFunction(() => SurvivorDemo.ready());
  const profile = { credits: 500, best: 83, runs: 7, hull: 2, gun: 1 };
  await page.evaluate(async (profile) => {
    // Delete only this synthetic browser context's new survivor DB, never a user profile.
    localStorage.setItem(SurvivorBalance.profileKey, JSON.stringify(profile));
  }, profile);
  // This new context already initialized its new DB. A second same-origin path is
  // unnecessary; remove this context's synthetic current record to test first migration.
  await page.evaluate(async () => {
    const request = indexedDB.open(SurvivorBalance.database, 1);
    await new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("state", "readwrite");
        tx.objectStore("state").delete("current");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  });
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect((await stored(page)).profile).toEqual(profile);
  const raw = await page.evaluate(async () => {
    const request = indexedDB.open(SurvivorBalance.database, 1);
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const db = request.result;
        const get = db
          .transaction("state")
          .objectStore("state")
          .get("backup/prototype-v01");
        get.onsuccess = () => {
          resolve([
            get.result,
            localStorage.getItem(SurvivorBalance.profileKey),
          ]);
          db.close();
        };
      };
    });
  });
  expect(raw).toEqual([JSON.stringify(profile), JSON.stringify(profile)]);
});

test("invalid own profile or impossible evolution keeps raw data and blocks launch", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await pause(page);
  const bad = await stored(page);
  bad.active.snapshot.game.evolved.cannon = "piercebeam";
  await page.evaluate(async (record) => {
    const request = indexedDB.open(SurvivorBalance.database + ".qa", 1);
    await new Promise((resolve) => {
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("state", "readwrite");
        tx.objectStore("state").put(record, "current");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
  }, bad);
  await page.reload();
  await expect(page.locator("#retrySaveBtn")).toBeVisible();
  await expect(page.locator("#startBtn")).toBeDisabled();
  expect((await stored(page)).active.snapshot.game.evolved).toEqual({
    cannon: "piercebeam",
  });
});

test("all legacy planet, chapter and route namespaces remain byte-for-byte untouched", async ({
  page,
}) => {
  await boot(page, false);
  const sentinels = {
    "loststar.fusion.firstplanet.v037": JSON.stringify({
      balance: 27049,
      collection: ["receipt"],
      rights: { case: 3 },
    }),
    "loststar.fusion.firstplanet.v037.backup": "original-planet-backup",
    "loststar.review.parcel-story.v1": JSON.stringify({
      chapter: 1,
      complete: true,
    }),
    "loststar.review.parcel-story.v1.backup": "original-chapter-backup",
    "lostcargo.route-demo.v1": "untouched-route-local-copy",
  };
  await page.evaluate(async (values) => {
    for (const [key, value] of Object.entries(values))
      localStorage.setItem(key, value);
    const request = indexedDB.open("lostcargo.route-demo.v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("state");
    await new Promise((resolve) => {
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("state", "readwrite");
        tx.objectStore("state").put(
          {
            schema: 8,
            credits: 27049,
            fleet: ["sloop", "freighter", "scout", "tug"],
            rights: [1, 2, 3, 4],
            inFlight: true,
          },
          "synthetic-legacy",
        );
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
  }, sentinels);
  await start(page);
  await pause(page);
  await page.locator("#leaveBtn").click();
  await expect(page.locator("#results")).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  expect(
    await page.evaluate(
      (keys) =>
        Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])),
      Object.keys(sentinels),
    ),
  ).toEqual(sentinels);
  const route = await page.evaluate(async () => {
    const request = indexedDB.open("lostcargo.route-demo.v1", 1);
    return new Promise((resolve) => {
      request.onsuccess = () => {
        const db = request.result;
        const get = db
          .transaction("state")
          .objectStore("state")
          .get("synthetic-legacy");
        get.onsuccess = () => {
          resolve(get.result);
          db.close();
        };
      };
    });
  });
  expect(route).toEqual({
    schema: 8,
    credits: 27049,
    fleet: ["sloop", "freighter", "scout", "tug"],
    rights: [1, 2, 3, 4],
    inFlight: true,
  });
});

test("old v0.6 short-run snapshots retain180seconds,4/3slots and the original cash", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await pause(page);
  const before = await stored(page);
  const legacy = structuredClone(before);
  delete legacy.active.snapshot.game.rules;
  legacy.active.snapshot.game.endTime = 180;
  legacy.active.snapshot.game.time = 150;
  legacy.profile.credits = 27049;
  legacy.profile.hull = 3;
  legacy.profile.gun = 3;
  await page.evaluate(async (record) => {
    const request = indexedDB.open(SurvivorBalance.database + ".qa", 1);
    await new Promise((resolve) => {
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction("state", "readwrite");
        tx.objectStore("state").put(record, "current");
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
      };
    });
  }, legacy);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  await page.locator("#continueBtn").click();
  await page.waitForFunction(
    () => SurvivorDemo.state()?.mode === "play" && !SurvivorDemo.saving(),
  );
  expect((await state(page)).endTime).toBe(180);
  expect((await stored(page)).profile.credits).toBe(27049);
  await page.evaluate(() => {
    const g = SurvivorQA.state();
    g.time = 179.99;
    SurvivorQA.step(0.02);
  });
  await expect(page.locator("#results")).toBeVisible();
  await page.waitForFunction(() => !SurvivorDemo.saving());
  expect((await state(page)).time).toBe(180);
  const cash = (await stored(page)).profile.credits;
  await page.locator("#retryBtn").click();
  await page.waitForFunction(() => SurvivorDemo.state()?.mode === "play");
  expect((await state(page)).endTime).toBe(600);
  expect((await state(page)).rules).toMatchObject({
    activeSlots: 6,
    passiveSlots: 6,
  });
  expect((await stored(page)).profile.credits).toBe(cash);
});

test("a long-run repair pickup restores HP once and adds no currency", async ({
  page,
}) => {
  await boot(page);
  await start(page);
  await page.evaluate(() => {
    const g = SurvivorQA.state();
    g.p.hp = 40;
    g.pickups = [{ x: g.p.x, y: g.p.y, type: "heal", value: 12, t: 10 }];
    SurvivorQA.step(0.02);
  });
  await pause(page);
  const once = await stored(page);
  expect(once.active.snapshot.game.p.hp).toBe(52);
  expect(once.active.snapshot.game.credits).toBe(0);
  await page.reload();
  await page.waitForFunction(() => SurvivorDemo.ready());
  await page.locator("#continueBtn").click();
  await pause(page);
  expect((await stored(page)).active.snapshot.game.p.hp).toBe(52);
  expect((await stored(page)).active.snapshot.game.pickups.length).toBe(0);
});
