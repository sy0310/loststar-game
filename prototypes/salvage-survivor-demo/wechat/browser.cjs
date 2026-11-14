/* Graphical compatibility tests for the exported entry using WeChat API bindings. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium, webkit } = require("@playwright/test");
const source = path.resolve(__dirname, "..");
const built = path.resolve(source, "../../releases/wechat-minigame");
const output = path.resolve(source, "../../artifacts/wechat-v0610");
const types = { ".js": "text/javascript", ".html": "text/html", ".css": "text/css", ".png": "image/png", ".mp3": "audio/mpeg" };
const server = http.createServer((request, response) => {
  const name = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  if (name === "/wx/") {
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.end('<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#17172b"></body></html>');
    return;
  }
  const base = name.startsWith("/h5/") ? source : built;
  const relative = name.replace(/^\/(h5|wx)\//, "") || "index.html";
  const target = path.resolve(base, relative);
  if (!target.startsWith(base + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { response.writeHead(404); response.end(); return; }
  const type = types[path.extname(target)] || "application/octet-stream";
  response.setHeader("Content-Type", type.startsWith("text/") ? type + "; charset=utf-8" : type);
  response.end(fs.readFileSync(target));
});

async function installBindings(page, dimensions) {
  await page.evaluate(({ width, height }) => {
    const callbacks = {};
    let mainCanvas;
    let labels = [];
    window.GameGlobal = {};
    window.wechatTest = { callbacks, labels: () => labels, reset: () => { labels = []; } };
    const emit = (name, event) => (callbacks[name] || []).forEach((callback) => callback(event));
    window.wx = {
      getWindowInfo: () => ({ windowWidth: width, windowHeight: height, safeArea: { top: 47, bottom: height - 34 } }),
      getPerformance: () => performance,
      getMenuButtonBoundingClientRect: () => ({ bottom: 80 }),
      getStorageInfoSync: () => ({ keys: Object.keys(localStorage) }),
      getStorageSync: (key) => JSON.parse(localStorage.getItem(key)),
      setStorageSync: (key, value) => localStorage.setItem(key, JSON.stringify(value)),
      createImage: () => new Image(),
      createCanvas() {
        const canvas = document.createElement("canvas");
        if (!mainCanvas) {
          mainCanvas = canvas;
          document.body.appendChild(canvas);
          const ctx = canvas.getContext("2d");
          const fillText = ctx.fillText.bind(ctx);
          ctx.fillText = (value, x, y, ...args) => { labels.push({ value: String(value), x, y }); if (labels.length > 1000) labels.shift(); fillText(value, x, y, ...args); };
          for (const [dom, native] of [["pointerdown", "TouchStart"], ["pointermove", "TouchMove"], ["pointerup", "TouchEnd"], ["pointercancel", "TouchCancel"]]) canvas.addEventListener(dom, (event) => emit(native, { changedTouches: [{ identifier: event.pointerId, clientX: event.clientX, clientY: event.clientY }] }));
        }
        return canvas;
      },
      loadSubpackage({ success }) { success(); },
      createInnerAudioContext() {
        const audio = new Audio();
        return {
          set src(value) { audio.src = value; },
          set volume(value) { audio.volume = value; },
          play: () => { void audio.play().catch(() => {}); }, pause: () => audio.pause(),
          stop: () => { audio.pause(); audio.currentTime = 0; }, destroy: () => { audio.pause(); audio.src = ""; },
          onEnded: (callback) => audio.addEventListener("ended", callback), onError: (callback) => audio.addEventListener("error", callback),
        };
      },
    };
    for (const name of ["Hide", "Show", "WindowResize", "MemoryWarning", "TouchStart", "TouchMove", "TouchEnd", "TouchCancel"]) wx["on" + name] = (callback) => { (callbacks[name] ||= []).push(callback); };
  }, dimensions);
  await page.addScriptTag({ url: "/wx/game.js" });
  await page.waitForFunction(() => GameGlobal.Loststar?.SurvivorDemo.ready());
}
async function tap(page, value) {
  const point = await page.evaluate((value) => {
    wechatTest.reset(); GameGlobal.Loststar.SurvivorNativeUI.draw();
    return wechatTest.labels().find((item) => item.value.includes(value) && item.y > 95 && item.y < innerHeight - 55);
  }, value);
  assert(point, "Visible canvas button " + value + " " + JSON.stringify(await page.evaluate(() => wechatTest.labels())));
  await page.mouse.click(point.x + 5, point.y + 8);
}
async function main() {
  fs.mkdirSync(output, { recursive: true });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = "http://127.0.0.1:" + server.address().port;
  const report = [];
  try {
    for (const [engine, type] of [["chromium", chromium], ["webkit", webkit]]) {
      const browser = await type.launch();
      try {
        for (const dimensions of [{ width: 360, height: 800 }, { width: 390, height: 844 }]) {
          const context = await browser.newContext({ viewport: dimensions });
          const page = await context.newPage();
          const errors = [];
          page.on("pageerror", (error) => errors.push(error.message));
          await page.goto(base + "/wx/");
          await installBindings(page, dimensions);
          const prefix = engine + "-" + dimensions.width;
          await page.screenshot({ path: path.join(output, prefix + "-native-start.png") });
          await tap(page, "飞船整备");
          await page.waitForFunction(() => !GameGlobal.Loststar.SurvivorNative.element("dock").hidden);
          await page.screenshot({ path: path.join(output, prefix + "-native-dock.png") });
          for (let repeat = 0; repeat < 3; repeat++) await page.evaluate(() => {
            const p = { identifier: 90, clientX: 300, clientY: 650 };
            const q = { ...p, clientY: 180 };
            for (const handler of wechatTest.callbacks.TouchStart) handler({ changedTouches: [p] });
            for (const handler of wechatTest.callbacks.TouchMove) handler({ changedTouches: [q] });
            for (const handler of wechatTest.callbacks.TouchEnd) handler({ changedTouches: [q] });
          });
          await tap(page, "返回");
          await tap(page, "开始一局");
          await page.waitForFunction(() => GameGlobal.Loststar.SurvivorDemo.state()?.time > 0.8);
          await page.screenshot({ path: path.join(output, prefix + "-native-combat.png") });
          await page.evaluate(() => wechatTest.callbacks.Hide.forEach((callback) => callback()));
          await page.waitForFunction(() => GameGlobal.Loststar.SurvivorDemo.state()?.mode === "pause");
          await page.screenshot({ path: path.join(output, prefix + "-native-pause.png") });
          await page.reload();
          await installBindings(page, dimensions);
          await tap(page, "继续上次");
          await page.waitForFunction(() => GameGlobal.Loststar.SurvivorDemo.state()?.mode === "play");
          const art = await page.evaluate(() => GameGlobal.Loststar.SurvivorDemo.artCount());
          assert.equal(art, 74); assert.deepEqual(errors, []);
          await page.goto(base + "/h5/index.html");
          await page.waitForFunction(() => SurvivorDemo.ready());
          await page.screenshot({ path: path.join(output, prefix + "-h5-start.png") });
          assert.deepEqual(errors, []);
          report.push({ engine, ...dimensions, art, errors, tested: ["native entry", "canvas menu", "scroll", "battle", "background pause", "serialized restart", "H5 entry"], evidenceKind: "WeChat API compatibility harness, desktop browser" });
          await context.close();
        }
      } finally { await browser.close(); }
    }
    fs.writeFileSync(path.join(output, "browser.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report));
  } finally { server.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; server.close(); });
