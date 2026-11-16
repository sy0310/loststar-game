/* Exercises the exported entry and actual controller through native touch callbacks. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const folder = path.resolve(__dirname, "../../../releases/wechat-minigame");
const bundle = fs.readFileSync(path.join(folder, "game.js"), "utf8");
const flush = () => new Promise((resolve) => setImmediate(resolve));

async function boot(storage = new Map(), dimensions = { windowWidth: 390, windowHeight: 844 }, options = {}) {
  let now = 0;
  let nextFrame;
  let failWrites = false;
  let failPlayerImage = !!options.failPlayerImage;
  let labels = [];
  const callbacks = {};
  const audio = [];
  const context = new Proxy({
    measureText: (value) => ({ width: String(value).length * 8 }),
    fillText: (value, x, y) => labels.push({ value: String(value), x, y }),
  }, { get: (target, key) => target[key] || (() => {}) });
  const wx = {
    getWindowInfo: () => ({ ...dimensions, safeArea: { top: 47, bottom: dimensions.windowHeight - 34 } }),
    getPerformance: () => ({ now: () => now }),
    getMenuButtonBoundingClientRect: () => ({ bottom: 80 }),
    getStorageInfoSync: () => ({ keys: [...storage.keys()] }),
    getStorageSync: (key) => structuredClone(storage.get(key)),
    setStorageSync(key, value) { if (failWrites) throw Error("存储写入失败"); storage.set(key, structuredClone(value)); },
    createCanvas: () => ({ width: dimensions.windowWidth, height: dimensions.windowHeight, getContext: () => context }),
    createImage() {
      return {
        set src(value) {
          this.path = value;
          if (failPlayerImage && value.includes("/player-2x.png")) {
            queueMicrotask(() => this.onerror({ errMsg: "Deliberate image load failure" }));
            return;
          }
          if (value.startsWith("./")) {
            queueMicrotask(() => this.onerror({ errMsg: "Package loader requires a path from the game root" }));
            return;
          }
          const data = fs.readFileSync(path.join(folder, value));
          this.width = data.readUInt32BE(16); this.height = data.readUInt32BE(20);
          queueMicrotask(() => this.onload());
        },
        get src() { return this.path; },
      };
    },
    loadSubpackage({ name, success }) { assert(fs.existsSync(path.join(folder, name, "music.mp3"))); success(); },
    createInnerAudioContext() {
      const object = { pause() {}, stop() {}, destroy() {}, onEnded() {}, onError() {}, play() { assert(fs.existsSync(path.join(folder, this.src))); } };
      audio.push(object); return object;
    },
  };
  for (const name of ["Hide", "Show", "WindowResize", "MemoryWarning", "TouchStart", "TouchMove", "TouchEnd", "TouchCancel"]) wx["on" + name] = (handler) => { (callbacks[name] ||= []).push(handler); };
  const scope = { wx, GameGlobal: {}, console, setTimeout, clearTimeout, queueMicrotask, requestAnimationFrame: (fn) => { nextFrame = fn; return 1; } };
  vm.createContext(scope);
  // These APIs are absent in older Android game engines, even when ES6 transpilation is enabled.
  vm.runInContext("delete Array.prototype.findLast; delete Array.prototype.at;", scope);
  vm.runInContext(bundle, scope);
  for (let index = 0; index < 10 && !scope.GameGlobal.Loststar.SurvivorDemo.ready(); index++) await flush();
  const root = scope.GameGlobal.Loststar;
  if (!options.failPlayerImage) {
    assert(root.SurvivorDemo.ready(), root.SurvivorNative.element("saveStatus").textContent);
    assert.equal(root.SurvivorArt.loaded(), 74);
  }
  function tick(seconds = 0.05) { now += seconds * 1000; labels = []; nextFrame(now); }
  const emit = (name, event = {}) => callbacks[name].forEach((handler) => handler(event));
  async function tap(value) {
    tick();
    const label = labels.find((item) => item.value.includes(value) && item.y >= 90 && item.y < dimensions.windowHeight - 60);
    assert(label, "Visible button " + value + ", found " + labels.map((item) => item.value).join(" | "));
    const point = { identifier: 1, clientX: label.x + 5, clientY: label.y + 10 };
    emit("TouchStart", { changedTouches: [point] }); emit("TouchEnd", { changedTouches: [point] });
    await flush(); tick();
  }
  function drag(x, y, toX, toY) {
    const a = { identifier: 2, clientX: x, clientY: y };
    const b = { identifier: 2, clientX: toX, clientY: toY };
    emit("TouchStart", { changedTouches: [a] }); emit("TouchMove", { changedTouches: [b] }); tick(); emit("TouchEnd", { changedTouches: [b] }); tick();
  }
  tick();
  return { root, storage, callbacks, tick, tap, drag, emit, labels: () => labels, fail: (value) => { failWrites = value; }, failPlayerImage: (value) => { failPlayerImage = value; } };
}

async function main() {
  for (const dimensions of [{ windowWidth: 360, windowHeight: 800 }, { windowWidth: 390, windowHeight: 844 }]) {
    const loading = await boot(new Map(), dimensions, { failPlayerImage: true });
    assert.equal(loading.root.SurvivorDemo.ready(), false);
    assert.equal(loading.root.SurvivorNative.element("startBtn").disabled, true);
    assert.match(loading.root.SurvivorNative.element("saveStatus").textContent, /player-2x.png/);
    loading.failPlayerImage(false);
    await loading.tap("重新加载");
    assert.equal(loading.root.SurvivorDemo.ready(), true);
    assert.equal(loading.root.SurvivorArt.loaded(), 74);
    await loading.tap("开始一局");
    assert.equal(loading.root.SurvivorDemo.state().mode, "play");
    console.log("PASS package-root image paths, failed player image blocks launch, visible reload recovers all 74 images and starts battle", dimensions.windowWidth);
    const game = await boot(new Map(), dimensions);
    const node = (id) => game.root.SurvivorNative.element(id);
    await game.tap("飞船整备"); assert.equal(node("dock").hidden, false);
    await game.tap("选择 ›"); assert.equal(node("launchPicker").hidden, false);
    assert.equal((node("launchCards").innerHTML.match(/<button/g) || []).length, 6);
    assert(node("bookLaunchBtn").disabled);
    game.drag(300, 650, 300, 150); game.drag(300, 650, 300, 150); game.drag(300, 650, 300, 150);
    await game.tap("返回整备");
    game.drag(300, 650, 300, 150);
    await game.tap("返回");
    await game.tap("开始一局");
    assert.equal(game.root.SurvivorDemo.state().rules.runSeconds, 900);
    assert.equal(game.root.SurvivorDemo.state().rules.repairScalingVersion, 1);
    const before = game.root.SurvivorDemo.state().p.x;
    const a = { identifier: 5, clientX: 190, clientY: 500 };
    game.emit("TouchStart", { changedTouches: [a] });
    game.emit("TouchMove", { changedTouches: [{ ...a, clientX: 250 }] });
    for (let index = 0; index < 20; index++) game.tick();
    assert(game.root.SurvivorDemo.state().p.x > before);
    game.emit("TouchCancel", { changedTouches: [a] });
    assert.equal(game.root.SurvivorDemo.state().input.active, false);
    game.emit("Hide"); await flush(); game.tick();
    assert.equal(game.root.SurvivorDemo.state().mode, "pause");
    const frozen = game.root.SurvivorDemo.state().time;
    game.tick(60); assert.equal(game.root.SurvivorDemo.state().time, frozen);
    game.emit("Show"); await game.tap("继续战斗");
    assert.equal(game.root.SurvivorDemo.state().mode, "play");
    game.emit("Hide"); await flush(); game.tick();
    const reloaded = await boot(game.storage, dimensions);
    await reloaded.tap("继续上次");
    assert(Math.abs(reloaded.root.SurvivorDemo.state().time - frozen) < 0.15);
    reloaded.emit("Hide"); await flush(); reloaded.tick();
    await reloaded.tap("结束本局并结算");
    assert.equal(reloaded.root.SurvivorDemo.store().profile.runs, 1);
    const receipt = structuredClone(reloaded.root.SurvivorDemo.store());
    await reloaded.tap("再挑战一次");
    assert.equal(reloaded.root.SurvivorDemo.store().profile.runs, receipt.profile.runs);
    reloaded.emit("Hide"); await flush(); reloaded.tick();
    const previous = structuredClone([...game.storage.values()]);
    reloaded.fail(true);
    await reloaded.tap("结束本局并结算");
    assert.equal(reloaded.root.SurvivorNative.element("retrySaveBtn").hidden, false);
    assert.deepEqual([...game.storage.values()], previous);
    reloaded.fail(false);
    await reloaded.tap("重试保存");
    assert.equal(reloaded.root.SurvivorDemo.store().profile.runs, 2);
    assert.equal(reloaded.root.SurvivorDemo.store().receipts.length, 2);
    console.log("PASS WeChat entry, 74 images, menus, scrolling, touch, cancel, background, resume, restart, settlement and failed-write retry", dimensions.windowWidth);

    // An isolated saved-state fixture reaches an ordinary level-up immediately.
    const fixture = await boot(new Map(), dimensions);
    await fixture.tap("开始一局");
    fixture.emit("Hide"); await flush();
    const key = [...fixture.storage.keys()].find((name) => name.endsWith(".wechat.v1"));
    const record = JSON.parse(fixture.storage.get(key));
    const snapshot = record.active.snapshot.game;
    snapshot.xp = snapshot.xpNext - 1;
    snapshot.pickups = [{ x: snapshot.p.x, y: snapshot.p.y, type: "xp", value: 1, t: 30 }];
    fixture.storage.set(key, JSON.stringify(record));
    const upgrading = await boot(fixture.storage, dimensions);
    await upgrading.tap("继续上次");
    await flush(); upgrading.tick();
    const upgradeNode = (id) => upgrading.root.SurvivorNative.element(id);
    assert.equal(upgrading.root.SurvivorDemo.state().mode, "upgrade");
    assert.equal((upgradeNode("upgradeList").innerHTML.match(/data-pick=/g) || []).length, 3);
    upgrading.drag(300, 650, 300, 150);
    upgrading.drag(300, 650, 300, 150);
    await upgrading.tap("刷新选项");
    assert.equal(upgrading.root.SurvivorDemo.state().rerollsRemaining, 2);
    upgrading.tick(1);
    upgrading.drag(300, 200, 300, 700);
    upgrading.drag(300, 200, 300, 700);
    const choice = /<h3>([^<]+)<\/h3>/.exec(upgradeNode("upgradeList").innerHTML)[1];
    await upgrading.tap(choice);
    assert.equal(upgrading.root.SurvivorDemo.state().mode, "play");
    console.log("PASS isolated native level-up fixture, three choices, saved reroll counter and actual selected upgrade", dimensions.windowWidth);
  }
  const broken = new Map([["loststar.survivor.demo.v06.wechat.v1", { broken: true }]]);
  await assert.rejects(boot(broken));
  assert.deepEqual(broken.get("loststar.survivor.demo.v06.wechat.v1"), { broken: true });
  console.log("PASS corrupt native record remains intact");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
