/* Presentation-only localization. Canonical game data and save keys stay in the core. */
(function () {
  "use strict";
  const dictionary = window.SurvivorEnglish;
  const han = /[\u3400-\u9fff]+/g;
  const containsHan = /[\u3400-\u9fff]/;
  const preferenceKey = "loststar.survivor.locale.v1";
  const originals = new WeakMap();
  const originalAttributes = new WeakMap();
  const missing = new Set();
  let locale = "en";
  try {
    const requested = new URLSearchParams(location.search).get("lang");
    const saved = localStorage.getItem(preferenceKey);
    if ((requested || saved) === "zh-CN") locale = "zh-CN";
  } catch {}

  function english(source) {
    const value = String(source);
    if (!containsHan.test(value)) return value;
    const complete = {
      "拖动飞船躲避，武器自动攻击": "Drag to steer and dodge. Weapons fire automatically.",
      "拖动飞船躲避，武器自动开火。": "Drag to dodge. Weapons fire automatically.",
      "武器与辅助各5级，击退精英抽取进化。": "Max weapon + support to Lv5. Defeat elites to roll evolution.",
      "武器与专属辅助各5级，击退精英抽取进化": "Max weapon + support to Lv5. Defeat elites to roll evolution.",
      "1～3级随机分配 · 选择后装载，刷新保留结果": "1–3 levels rolled. Select to apply. Results stay locked.",
      "符合满级条件时，75%机会出现进化／融合": "With both requirements maxed: 75% evolution / fusion chance.",
      "9种武装选6 · 8种增强选6": "6 of 9 weapons · 6 of 8 supports",
      "9种武装选6": "6 of 9 weapons",
      "8种增强选6": "6 of 8 supports",
      "360°星海": "360° Space",
      "15分钟挑战": "15-minute runs",
      "融合": "FUSE",
      "默认主炮免费 · 预约替换起始武器，占1武器槽": "Default cannon is free. A reserved starter uses one weapon slot.",
      "两件已进化武器 · 合并空出1格": "Fuse two evolved weapons to free one slot",
      "合并两件武器 · 空出1格": "Combine two weapons to free one slot",
      "船体 +12，碰撞减伤提高": "+12 hull and reduced collision damage",
      "船体＋5，碰撞减伤提高": "+5 hull and reduced collision damage",
      "双满级后可抽取进化": "Max both to roll evolution",
      "再与另一进化武器融合": "Combine with a second evolution",
    };
    if (Object.prototype.hasOwnProperty.call(complete, value.trim())) {
      return value.replace(value.trim(), complete[value.trim()]);
    }
    return value.replace(han, (token, offset) => {
      const translated = dictionary[token];
      if (translated === undefined) {
        missing.add(token);
        return token;
      }
      const before = /[A-Za-z0-9]/.test(value[offset - 1] || "");
      const after = /[A-Za-z0-9]/.test(value[offset + token.length] || "");
      return (before ? " " : "") + translated + (after ? " " : "");
    }).replace(/，/g, ", ").replace(/。/g, ". ").replace(/！/g, "!")
      .replace(/（/g, "(").replace(/）/g, ")").replace(/／/g, " / ")
      .replace(/～/g, "–").replace(/、/g, ", ").replace(/ {2,}/g, " ");
  }

  function text(source) {
    return locale === "en" ? english(source) : String(source);
  }

  function skipped(element) {
    return !element || !!element.closest("script,style,[data-i18n-skip]");
  }

  function localizeText(node) {
    if (skipped(node.parentElement)) return;
    const current = node.nodeValue;
    const previous = originals.get(node);
    const source = previous && current === previous.rendered ? previous.source : current;
    const rendered = text(source);
    originals.set(node, { source, rendered });
    if (current !== rendered) node.nodeValue = rendered;
  }

  function localizeAttributes(element) {
    if (skipped(element)) return;
    let record = originalAttributes.get(element);
    if (!record) {
      record = {};
      originalAttributes.set(element, record);
    }
    for (const name of ["aria-label", "title"]) {
      const current = element.getAttribute(name);
      if (current === null) continue;
      const previous = record[name];
      const source = previous && current === previous.rendered ? previous.source : current;
      const rendered = text(source);
      record[name] = { source, rendered };
      if (current !== rendered) element.setAttribute(name, rendered);
    }
  }

  function localize(root) {
    if (root.nodeType === Node.TEXT_NODE) {
      localizeText(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE || skipped(root)) return;
    localizeAttributes(root);
    for (const element of root.querySelectorAll("[aria-label],[title]")) localizeAttributes(element);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) localizeText(walker.currentNode);
  }

  function updateLanguageButtons() {
    for (const button of document.querySelectorAll("[data-language-toggle]")) {
      button.textContent = locale === "en" ? "中文" : "English";
      button.setAttribute("aria-label", locale === "en" ? "Switch to Chinese" : "切换为英文");
    }
    document.documentElement.lang = locale;
    document.title = locale === "en" ? "Lostship: Star Surge" : "失物号：星海突进";
  }

  function setLocale(value) {
    locale = value === "zh-CN" ? "zh-CN" : "en";
    try { localStorage.setItem(preferenceKey, locale); } catch {}
    localize(document.body);
    updateLanguageButtons();
  }

  for (const id of ["start", "pause"]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "language-toggle";
    button.dataset.languageToggle = "";
    button.dataset.i18nSkip = "";
    button.addEventListener("click", () => setLocale(locale === "en" ? "zh-CN" : "en"));
    document.getElementById(id).prepend(button);
  }

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") localizeText(record.target);
      else if (record.type === "attributes") localizeAttributes(record.target);
      else for (const node of record.addedNodes) localize(node);
    }
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["aria-label", "title"],
  });
  localize(document.body);
  updateLanguageButtons();

  // Android lifecycle and Back use the same pause button as the player.
  window.addEventListener("lostship:native-pause", () => {
    const button = document.getElementById("pauseBtn");
    const hud = document.getElementById("hud");
    if (!hud.hidden && !button.hidden && document.getElementById("pause").hidden) button.click();
  });
  window.SurvivorI18n = Object.freeze({
    text, english, setLocale,
    getLocale: () => locale,
    missing: () => [...missing],
  });
})();
