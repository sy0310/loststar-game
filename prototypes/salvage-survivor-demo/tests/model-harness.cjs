/* Unit adapter only. Real storage, graphics and entry points have HTTP browser tests. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const folder = path.resolve(__dirname, "..");

async function createModel(sourceFiles = {}) {
  const elements = new Map();
  const context2d = new Proxy(
    {},
    {
      get: (target, key) => target[key] || (() => {}),
      set: (target, key, value) => {
        target[key] = value;
        return true;
      },
    },
  );
  function element(id) {
    if (!elements.has(id))
      elements.set(id, {
        style: {},
        classList: { add() {}, remove() {}, toggle() {} },
        hidden: true,
        textContent: "",
        innerHTML: "",
        addEventListener() {},
        getContext: () => context2d,
        getBoundingClientRect: () => ({
          width: 390,
          height: 844,
          left: 0,
          top: 0,
        }),
        setPointerCapture() {},
      });
    return elements.get(id);
  }
  const record = {
    schema: 1,
    revision: 0,
    profile: { credits: 0, best: 0, runs: 0, hull: 0, gun: 0 },
    active: null,
    receipts: [],
    lastResult: null,
  };
  const scope = {
    console,
    URLSearchParams,
    structuredClone,
    crypto: webcrypto,
    performance: { now: () => 0 },
    location: { search: "?qa=1" },
    requestAnimationFrame: () => 1,
    addEventListener() {},
    document: {
      getElementById: element,
      querySelector: element,
      addEventListener() {},
      hidden: false,
    },
    SurvivorBuild: { version: "0.6.0", commit: "UNIT_MODEL", dirty: true },
    SurvivorArt: {
      icon: () => "",
      draw() {},
      load: async () => {},
      loaded: () => 39,
      catalog: {
        player: {
          center: [12, 12],
          exhaustAnchors: [
            [8.5, 23],
            [14.5, 23],
          ],
        },
      },
    },
    SurvivorPersistence: {
      create: async () => ({ read: async () => ({ record }), subscribe() {} }),
    },
  };
  scope.window = scope;
  vm.createContext(scope);
  vm.runInContext(
    fs.readFileSync(path.join(folder, "src/art-catalog.js"), "utf8"),
    scope,
  );
  for (const [id, entry] of Object.entries(scope.SurvivorArtCatalog))
    if (
      entry.src.includes("/v065/") ||
      entry.src.includes("/v067/") ||
      entry.src.includes("/v068/")
    )
      scope.SurvivorArt.catalog[id] = entry;
  for (const file of ["balance.js", "game.js"])
    vm.runInContext(
      sourceFiles[file] ||
        fs.readFileSync(path.join(folder, "src", file), "utf8"),
      scope,
      { filename: file },
    );
  await new Promise((resolve) => setImmediate(resolve));
  if (!scope.SurvivorDemo.ready())
    throw Error("Model adapter did not initialize");
  return scope;
}
module.exports = { createModel };
