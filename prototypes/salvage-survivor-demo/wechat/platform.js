/* Native WeChat bindings for the existing controller and its UI state. */
(function (root) {
  "use strict";
  const info = wx.getWindowInfo();
  const canvas = wx.createCanvas();
  const listeners = new Map();
  const elements = new Map();
  const clone = (value) => {
    if (value === null || typeof value !== "object") return value;
    if (Object.prototype.toString.call(value) === "[object Set]") return new Set(Array.from(value, clone));
    if (Array.isArray(value)) return value.map(clone);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)]));
  };
  function listen(type, handler) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(handler);
  }
  function dispatch(type, event = {}) {
    for (const handler of listeners.get(type) || []) handler({ type, ...event });
  }
  function element(id) {
    if (!elements.has(id)) {
      const classes = new Set();
      const node = {
        id, hidden: true, disabled: false, value: "", style: {},
        textContent: "", innerHTML: "", handlers: new Map(),
        classList: {
          add: (name) => classes.add(name),
          remove: (name) => classes.delete(name),
          contains: (name) => classes.has(name),
          toggle(name, enabled) {
            if (enabled) classes.add(name);
            else classes.delete(name);
          },
        },
        addEventListener(type, handler) { this.handlers.set(type, handler); },
        setAttribute() {},
        setPointerCapture() {},
        getContext: (...args) => canvas.getContext(...args),
        getBoundingClientRect: () => ({ left: 0, top: 0, width: info.windowWidth, height: info.windowHeight }),
      };
      let value = "";
      let markup = "";
      Object.defineProperties(node, {
        textContent: { get: () => value, set: (next) => { value = String(next); markup = ""; } },
        innerHTML: { get: () => markup, set: (next) => { markup = String(next); value = ""; } },
      });
      elements.set(id, node);
    }
    return elements.get(id);
  }
  const game = element("game");
  Object.defineProperties(game, {
    width: { get: () => canvas.width, set: (value) => { canvas.width = value; } },
    height: { get: () => canvas.height, set: (value) => { canvas.height = value; } },
  });
  root.document = {
    hidden: false,
    getElementById: element,
    querySelector: element,
    addEventListener: listen,
    createElement(tag) {
      if (tag === "canvas") return wx.createCanvas();
      throw Error("Unsupported native element " + tag);
    },
  };
  root.window = root;
  root.structuredClone = clone;
  root.addEventListener = listen;
  root.setTimeout = setTimeout;
  root.clearTimeout = clearTimeout;
  root.performance = wx.getPerformance();
  root.location = { search: "" };
  root.URLSearchParams = class {
    constructor(search) { this.search = search; }
    has(key) { return this.search.slice(1).split("&").some((part) => part.split("=")[0] === key); }
  };
  // Run identifiers and game seeds carry no authentication authority.
  root.crypto = {
    getRandomValues(array) {
      for (let index = 0; index < array.length; index++) array[index] = Math.floor(Math.random() * 4294967296);
      return array;
    },
  };
  root.localStorage = {
    getItem: (key) => wx.getStorageInfoSync().keys.includes(key) ? wx.getStorageSync(key) : null,
    setItem: (key, value) => wx.setStorageSync(key, String(value)),
  };
  root.Image = function () {
    const image = wx.createImage();
    let resolveImage;
    let rejectImage;
    const loaded = new Promise((resolve, reject) => { resolveImage = resolve; rejectImage = reject; });
    image.onload = resolveImage;
    image.onerror = () => rejectImage(Error("无法加载素材 " + image.src));
    image.decode = () => loaded;
    Object.defineProperties(image, {
      naturalWidth: { get: () => image.width },
      naturalHeight: { get: () => image.height },
    });
    return image;
  };
  root.matchMedia = () => ({ matches: false });
  const frame = requestAnimationFrame;
  root.requestAnimationFrame = (callback) => frame((time) => {
    callback(time);
    root.SurvivorNativeUI?.draw();
  });
  root.SurvivorNativeStorage = {
    open(name) {
      const key = name + ".wechat.v1";
      return {
        async transaction(change, validateRecord, initialProfile) {
          const exists = wx.getStorageInfoSync().keys.includes(key);
          const raw = exists ? wx.getStorageSync(key) : null;
          const record = exists ? (typeof raw === "string" ? JSON.parse(raw, (_, value) => value?.__loststarType === "Set" && Array.isArray(value.items) ? new Set(value.items) : value) : clone(raw)) : {
            schema: 1, revision: 0, profile: initialProfile(), active: null, receipts: [], lastResult: null,
          };
          validateRecord(record);
          const result = change(record);
          if (result.write) record.revision++;
          validateRecord(record);
          // Commit the whole ledger once. A failed write leaves the previous ledger intact.
          if (!exists || result.write) wx.setStorageSync(key, JSON.stringify(record, (_, value) => Object.prototype.toString.call(value) === "[object Set]" ? { __loststarType: "Set", items: [...value] } : value));
          result.record = clone(record);
          return result;
        },
      };
    },
  };
  wx.onHide(() => {
    root.document.hidden = true;
    dispatch("visibilitychange");
    dispatch("blur");
  });
  wx.onShow(() => {
    root.document.hidden = false;
    dispatch("visibilitychange");
    dispatch("focus");
  });
  wx.onWindowResize((event) => {
    Object.assign(info, event.size);
    dispatch("orientationchange");
  });
  wx.onMemoryWarning(() => { dispatch("blur"); });
  root.SurvivorNative = { canvas, info, element, elements, dispatch };
})(SurvivorPlatform);
