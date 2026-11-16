/* Canvas menus project the existing controller's text, flags and click handlers. */
(function (root) {
  "use strict";
  const { canvas, info, element } = root.SurvivorNative;
  const ctx = canvas.getContext("2d");
  const colors = { ink: "#f3eff8", muted: "#b2a7c5", gold: "#f4c57a", ice: "#73d9e8", pane: "#252139", line: "#756584" };
  let zones = [];
  let page = "";
  let scroll = 0;
  let contentHeight = 0;
  let touch = null;
  let cursor = 0;
  let left = 20;
  let width = 350;
  let clipTop = 0;
  let clipBottom = 0;
  const text = (id) => String(element(id).textContent || "");
  const decode = (value) => value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
  function plain(html) {
    return decode(html.replace(/<br\s*\/?\s*>/gi, "\n").replace(/<\/(h[123]|p|strong|b|small|div|span)>/gi, "\n").replace(/<[^>]+>/g, "")).replace(/\n\s*\n/g, "\n").trim();
  }
  function htmlButtons(id) {
    return [...element(id).innerHTML.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((match) => {
      const attributes = Object.fromEntries([...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map((item) => [item[1], item[2]]));
      const dataset = Object.fromEntries(Object.entries(attributes).filter(([key]) => key.startsWith("data-")).map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value]));
      return { html: match[2], disabled: /\bdisabled\b/.test(match[1]), attributes, dataset };
    });
  }
  function lines(value, maximumWidth, font = 14) {
    ctx.font = font + "px sans-serif";
    const result = [];
    for (const paragraph of String(value).split("\n")) {
      let line = "";
      for (const letter of paragraph) {
        if (line && ctx.measureText(line + letter).width > maximumWidth) { result.push(line); line = ""; }
        line += letter;
      }
      result.push(line);
    }
    return result;
  }
  function label(value, x, y, font = 14, color = colors.ink, maximumWidth = width) {
    ctx.font = font + "px sans-serif";
    ctx.fillStyle = color;
    ctx.textBaseline = "top";
    for (const line of lines(value, maximumWidth, font)) { ctx.fillText(line, x, y); y += font + 7; }
    return y;
  }
  function paragraph(value, font = 14, color = colors.muted) {
    if (!value) return;
    cursor = label(value, left, cursor, font, color) + 12;
  }
  function panel(x, y, w, h, fill = colors.pane, stroke = colors.line) {
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
  function zone(key, x, y, w, h, action, disabled = false, dragAction = null) {
    if (!disabled && y + h > clipTop && y < clipBottom) zones.push({ key, x, y: Math.max(y, clipTop), w, h: Math.min(y + h, clipBottom) - Math.max(y, clipTop), action, dragAction, page });
  }
  function click(id) {
    const node = element(id);
    if (!node.disabled && !node.hidden) node.onclick?.({ target: node });
  }
  function imageFromHTML(html, x, y, size) {
    const source = /<img[^>]+src="([^"]+)"/.exec(html)?.[1];
    const id = Object.keys(root.SurvivorArtCatalog).find((key) => root.SurvivorArtCatalog[key].src === source);
    if (!id) return;
    const frame = root.SurvivorArtCatalog[id].frames[0];
    root.SurvivorArt.draw(ctx, id, x + size / 2, y + size / 2, { scale: size / Math.max(frame.width, frame.height), anchor: [frame.width / 2, frame.height / 2] });
  }
  function buttonCard(key, value, action, options = {}) {
    const x = options.x ?? left;
    const w = options.width ?? width;
    const y = options.y ?? cursor;
    const html = options.html || "";
    const hasImage = /<img\b/.test(html);
    const font = options.font || 14;
    const inset = hasImage ? 58 : 14;
    const content = lines(value, w - inset - 14, font);
    const h = Math.max(options.height || 50, content.length * (font + 7) + 24);
    const fill = options.primary ? colors.gold : options.selected ? "#3b344e" : colors.pane;
    ctx.globalAlpha = options.disabled ? 0.5 : 1;
    panel(x, y, w, h, fill, options.selected ? colors.ice : colors.line);
    if (hasImage) imageFromHTML(html, x + 9, y + 14, 40);
    label(value, x + inset, y + 12, font, options.primary ? "#292135" : colors.ink, w - inset - 14);
    ctx.globalAlpha = 1;
    zone(key, x, y, w, h, action, options.disabled);
    if (options.y === undefined) cursor += h + 10;
    return h;
  }
  function button(id, primary = false) {
    const node = element(id);
    if (node.hidden) return;
    buttonCard(id, node.innerHTML ? plain(node.innerHTML) : text(id), () => click(id), { disabled: node.disabled, primary, html: node.innerHTML });
  }
  function list(id) {
    for (const [index, item] of htmlButtons(id).entries()) {
      const target = { dataset: item.dataset, disabled: item.disabled, closest: () => target };
      buttonCard(id + index, plain(item.html), () => element(id).onclick?.({ target }), { disabled: item.disabled, html: item.html, selected: item.attributes["aria-pressed"] === "true" });
    }
  }
  function html(id, font = 13) { paragraph(plain(element(id).innerHTML) || text(id), font); }
  function title(value, subtitle) {
    paragraph(subtitle, 12, colors.gold);
    paragraph(value, 28, colors.ink);
  }
  function start() {
    title("星海突进", "失物号");
    const y = cursor + 12;
    root.SurvivorArt?.draw(ctx, "player", canvas.width / 2, y + 52, { scale: 4 });
    cursor = y + 124;
    paragraph("拖动飞船躲避，武器自动开火。\n拾取晶体，三选一强化，尝试进化武装。", 15);
    paragraph("15分钟挑战 · 武器与辅助各6槽", 13, colors.ice);
    button("continueBtn", true);
    button("startBtn", true);
    button("dockBtn");
    paragraph(text("recordText"), 12);
    paragraph(text("buildStamp"), 11);
  }
  function upgrades() {
    title(text("upgradeTitle"), "武装补给");
    paragraph(text("upgradeHint"));
    list("upgradeList");
    button("rerollBtn");
    html("upgradeBuild", 12);
    paragraph(text("fusionGuide"), 12);
  }
  function audioSlider(kind, name) {
    const node = element(kind + "Volume");
    paragraph(name + "  " + text(kind + "VolumeValue"), 13);
    const y = cursor;
    panel(left, y, width, 46);
    meter(left + 14, y + 20, width - 28, Number(node.value) / 100, colors.ice);
    const x = left + 14;
    const w = width - 28;
    const change = (point) => {
      node.value = Math.max(0, Math.min(100, Math.round((point.clientX - x) / w * 20) * 5));
      node.handlers.get("input")?.({ target: node });
    };
    zone(kind + "Volume", left, y, width, 46, change, false, change);
    cursor += 62;
  }
  function pause() {
    title("歇一会儿", "失物号待命");
    paragraph("回来后，从这里继续。");
    button("audioMuteBtn");
    audioSlider("music", "音乐");
    audioSlider("sfx", "音效");
    paragraph(text("audioStatus"), 12);
    button("resumeBtn", true);
    button("leaveBtn");
    paragraph("切换应用或锁屏时自动暂停。", 12);
  }
  function dock() {
    title("飞船整备", text("dockCredits"));
    button("dockHullBtn");
    button("dockGunBtn");
    list("engineeringList");
    paragraph("下局起始武器", 16, colors.ink);
    buttonCard("chooseLaunchBtn", plain(element("launchSummary").innerHTML), () => click("chooseLaunchBtn"), { html: element("launchSummary").innerHTML });
    button("closeDockBtn", true);
  }
  function launch() {
    title("选择起始武器", text("launchBalance"));
    html("launchPortrait", 14);
    list("launchCards");
    html("launchRoute", 12);
    paragraph(text("launchStatus"), 12);
    button("bookLaunchBtn", true);
    button("cancelLaunchBtn");
    button("closeLaunchBtn");
  }
  function results() {
    title(text("resultTitle"), text("resultState"));
    paragraph(text("resultDesc"));
    paragraph("生存 " + text("statTime") + "   击落 " + text("statKills") + "\n零件 " + text("statScrap") + "   等级 " + text("statLevel"), 17, colors.ice);
    html("resultBuild", 12);
    if (!element("resultEncounters").hidden) paragraph(text("resultEncounters"), 12);
    paragraph(text("progressText"), 15, colors.gold);
    button("upgradeHullBtn");
    button("upgradeGunBtn");
    button("resultDockBtn");
    button("retryBtn", true);
    button("menuBtn");
  }
  function meter(x, y, w, fraction, color) {
    ctx.fillStyle = "#45394f"; ctx.fillRect(x, y, w, 5);
    ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, fraction)), 5);
  }
  function hud(top) {
    if (element("hud").hidden) return;
    panel(10, top, canvas.width - 20, 64, "#17172be8");
    label("船体 " + text("hpLabel"), 20, top + 9, 13, colors.ink, 160);
    label(text("timeLabel") + "  击落 " + text("killsLabel"), canvas.width - 186, top + 9, 13, colors.ink, 135);
    meter(20, top + 29, canvas.width - 80, parseFloat(element("hpFill").style.width) / 100, "#e58da7");
    label("Lv" + text("levelLabel") + "   零件 " + text("scrapLabel"), 20, top + 43, 11, colors.muted);
    meter(20, top + 63, canvas.width - 40, parseFloat(element("xpFill").style.width) / 100, colors.ice);
    if (!element("pauseBtn").hidden) {
      panel(canvas.width - 54, top + 2, 44, 44);
      label("Ⅱ", canvas.width - 41, top + 12, 18);
      zone("pauseBtn", canvas.width - 54, top, 44, 46, () => click("pauseBtn"));
    }
    const slots = [...element("loadout").innerHTML.matchAll(/<span class="slot[^>]*>([\s\S]*?)<\/span>/g)];
    for (const [index, slot] of slots.entries()) {
      const x = 14 + index % 6 * 32;
      const y = top + 77 + Math.floor(index / 6) * 28;
      imageFromHTML(slot[1], x, y, 23);
      const rank = /<small>([^<]+)<\/small>/.exec(slot[1])?.[1];
      if (rank) label(rank, x + 18, y + 14, 9, colors.gold, 15);
    }
    label(text("waveTip"), 14, top + 138, 11, colors.muted);
    label(text("shieldLabel"), 14, top + 154, 11, colors.ice);
    if (!element("bossBar").hidden) {
      const y = top + 178;
      panel(15, y, canvas.width - 30, 46, "#17172be8");
      label(text("bossName") + "  " + text("bossHealth"), 23, y + 8, 12);
      meter(23, y + 33, canvas.width - 46, parseFloat(element("bossFill").style.width) / 100, "#ff7597");
    }
    if (!element("encounterNotice").hidden) {
      const value = text("encounterTitle") + "\n" + text("encounterText");
      const h = lines(value, width - 20, 12).length * 19 + 20;
      panel(20, canvas.height - h - 110, width, h, "#252139ed");
      label(value, 30, canvas.height - h - 100, 12, colors.gold, width - 20);
    }
    if (!element("footHint").hidden) label("按住并拖动 · 自动攻击", 20, canvas.height - 80, 12, colors.muted);
    if (!element("joystick").hidden) {
      const node = element("joystick");
      const x = parseFloat(node.style.left) + 44;
      const y = parseFloat(node.style.top) + 44;
      ctx.strokeStyle = "#b2a7c580";
      ctx.beginPath(); ctx.arc(x, y, 42, 0, Math.PI * 2); ctx.stroke();
      const offset = /translate\(([-\d.]+)px,([-\d.]+)px\)/.exec(element("stick").style.transform || "");
      ctx.fillStyle = "#73d9e870";
      ctx.beginPath(); ctx.arc(x + Number(offset?.[1] || 0), y + Number(offset?.[2] || 0), 15, 0, Math.PI * 2); ctx.fill();
    }
  }
  function draw() {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.textBaseline = "top";
    ctx.globalAlpha = 1;
    zones = [];
    left = canvas.width > 480 ? Math.round((canvas.width - 440) / 2) : 20;
    width = Math.min(440, canvas.width - 40);
    const safeTop = Math.max((info.safeArea?.top || 0) + 40, wx.getMenuButtonBoundingClientRect?.().bottom || 0);
    const safeBottom = Math.max(12, canvas.height - (info.safeArea?.bottom || canvas.height));
    clipTop = safeTop + 12;
    clipBottom = canvas.height - safeBottom - 28;
    const active = ["launchPicker", "dock", "results", "pause", "upgrade", "start"].find((id) => !element(id).hidden) || "";
    if (page !== active) { page = active; scroll = 0; contentHeight = 0; }
    if (page) {
      ctx.fillStyle = "#17172bf2";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save(); ctx.beginPath(); ctx.rect(0, clipTop, canvas.width, clipBottom - clipTop); ctx.clip();
      cursor = clipTop + 12 - scroll;
      ({ start, upgrade: upgrades, pause, dock, launchPicker: launch, results })[page]();
      contentHeight = cursor + scroll - clipTop;
      ctx.restore();
      if (contentHeight > clipBottom - clipTop) {
        const track = clipBottom - clipTop;
        const handle = track * track / contentHeight;
        ctx.fillStyle = colors.line;
        ctx.fillRect(canvas.width - 7, clipTop + scroll / (contentHeight - track) * (track - handle), 3, handle);
      }
    } else hud(clipTop);
    label("失物号-星海突进", left, clipTop - 25, 12, colors.gold, width - 90);
    if (element("toast").classList.contains("visible")) {
      const value = text("toast");
      const h = lines(value, width - 20, 13).length * 20 + 16;
      panel(left, canvas.height - safeBottom - h - 55, width, h, "#3b344ef5");
      label(value, left + 10, canvas.height - safeBottom - h - 47, 13, colors.ink, width - 20);
    }
    label(text("saveStatus"), left, canvas.height - safeBottom - 17, 10, element("saveBar").classList.contains("error") ? "#ff7597" : colors.muted, width - 90);
    if (!element("retrySaveBtn").hidden) {
      const y = clipBottom - 46;
      panel(canvas.width - 100, y, 90, 44);
      label(root.SurvivorDemo?.ready() ? "重试保存" : "重新加载", canvas.width - 91, y + 13, 13);
      zone("retrySaveBtn", canvas.width - 100, y, 90, 44, () => click("retrySaveBtn"));
    }
    ctx.restore();
  }
  function hit(x, y) {
    for (let index = zones.length - 1; index >= 0; index--) {
      const item = zones[index];
      if (
        x >= item.x && x <= item.x + item.w &&
        y >= item.y && y <= item.y + item.h
      ) return item;
    }
  }
  function pointer(type, point) {
    element("game").handlers.get(type)?.({ type, pointerId: point.identifier, clientX: point.clientX, clientY: point.clientY });
  }
  wx.onTouchStart((event) => {
    if (touch) return;
    const point = event.changedTouches[0];
    if (!point) return;
    const target = hit(point.clientX, point.clientY);
    touch = { id: point.identifier, x: point.clientX, y: point.clientY, lastY: point.clientY, target, page, moved: false };
    if (!page && !target) pointer("pointerdown", point);
  });
  wx.onTouchMove((event) => {
    const point = event.changedTouches.find((item) => item.identifier === touch?.id);
    if (!point || !touch) return;
    if (Math.hypot(point.clientX - touch.x, point.clientY - touch.y) > 12) touch.moved = true;
    if (touch.target?.dragAction) touch.target.dragAction(point);
    else if (page && page === touch.page) scroll = Math.max(0, Math.min(Math.max(0, contentHeight - (clipBottom - clipTop)), scroll + touch.lastY - point.clientY));
    else if (!touch.target) pointer("pointermove", point);
    touch.lastY = point.clientY;
  });
  function end(event, cancelled) {
    const point = event.changedTouches.find((item) => item.identifier === touch?.id);
    if (!point || !touch) return;
    const previous = touch;
    touch = null;
    pointer(cancelled ? "pointercancel" : "pointerup", point);
    const target = hit(point.clientX, point.clientY);
    if (!cancelled && !previous.moved && previous.page === page && target?.key === previous.target?.key) target?.action(point);
  }
  wx.onTouchEnd((event) => end(event, false));
  wx.onTouchCancel((event) => end(event, true));
  wx.onHide(() => { touch = null; });
  root.SurvivorNativeUI = { draw };
})(SurvivorPlatform);
