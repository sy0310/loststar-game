(function () {
  "use strict";
  const $ = (id) => document.getElementById(id),
    canvas = $("game"),
    ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;
  const B = window.SurvivorBalance;
  const T = 6.28318530718,
    ACTIVE = ["cannon", "drone", "arc", "missile", "blade", "shield"],
    PASSIVE = ["lens", "lock", "capacitor", "cooler", "magnet", "armor"];
  const NAMES = {
    cannon: "脉冲主炮",
    drone: "追踪无人机",
    arc: "电弧线圈",
    missile: "震荡导弹",
    blade: "旋刃护卫",
    shield: "离子护盾",
    lens: "聚能透镜",
    lock: "锁定芯片",
    capacitor: "超导电容",
    cooler: "冷却矩阵",
    magnet: "回收磁场",
    armor: "反应装甲",
    piercebeam: "贯星轨炮",
    hunterswarm: "猎手蜂群",
    chainstorm: "星链雷网",
    meteorbarrage: "彗星弹幕",
    spiralsaw: "磁旋收割阵",
    reactiveaegis: "反应壁垒",
    thunderhive: "雷暴蜂群",
    blastwheel: "爆裂刃环",
  };

  const DESCS = {
    cannon: "增强齐射火力，自动瞄准近敌",
    drone: "环绕副机，发射追踪弹",
    arc: "连锁电击，扫开成群目标",
    missile: "追踪弹头，命中范围爆炸",
    blade: "环绕切割，保护近处空域",
    shield: "抵挡伤害，自动恢复护盾",
    lens: "增加贯穿，提高武器伤害",
    lock: "副机锁定更快，伤害提高",
    capacitor: "电链更远，连锁更强",
    cooler: "缩短武器开火间隔",
    magnet: "扩大经验与零件的吸附范围",
    armor: "船体 +12，碰撞减伤提高",
    piercebeam: "长束贯穿，击中成排目标",
    hunterswarm: "四机协同，更快追击",
    chainstorm: "远距电网，短暂停敌",
    meteorbarrage: "四连追踪弹，扩大爆破",
    spiralsaw: "五枚旋刃，扩大吸附",
    reactiveaegis: "更快恢复护盾，冲击反制",
    thunderhive: "五架蜂机，命中连锁放电",
    blastwheel: "六刃环绕，接触触发爆破",
  };
  const EVO = [
    ["cannon", "lens", "piercebeam"],
    ["drone", "lock", "hunterswarm"],
    ["arc", "capacitor", "chainstorm"],
    ["missile", "cooler", "meteorbarrage"],
    ["blade", "magnet", "spiralsaw"],
    ["shield", "armor", "reactiveaegis"],
  ];
  const FUSION = [
    ["drone", "arc", "thunderhive"],
    ["missile", "blade", "blastwheel"],
  ];

  function pixelIcon(id, size = 32) {
    return window.SurvivorArt.icon(id === "repair" ? "armor" : id, size);
  }
  const QA = new URLSearchParams(location.search).has("qa");
  let profile = { credits: 0, best: 0, runs: 0, hull: 0, gun: 0 };
  let storage = null,
    storeView = null,
    ready = false,
    actionBusy = false,
    purchaseLockedUntil = 0,
    runDetached = false;
  let runId = null,
    runRevision = 0,
    lastCheckpointTime = 0,
    saving = false;
  let pendingWrite = Promise.resolve();
  let g = null,
    raf = 0,
    lastFrame = performance.now(),
    VW = 360,
    VH = 700,
    seed = 38191,
    toastT = 0;
  const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    },
    rr = (a, b) => a + (b - a) * rand(),
    clamp = (x, a, b) => Math.max(a, Math.min(b, x)),
    dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y),
    angle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const hideAll = () =>
    ["start", "upgrade", "pause", "results"].forEach(
      (id) => ($(id).hidden = true),
    );
  function resize() {
    const rect = canvas.getBoundingClientRect();
    VW = Math.max(240, Math.round(rect.width));
    VH = Math.max(300, Math.round(rect.height));
    canvas.width = VW;
    canvas.height = VH;
    ctx.imageSmoothingEnabled = false;
  }
  window.addEventListener("resize", resize);
  function notify(s) {
    toastT = 2.15;
    $("toast").textContent = s;
    $("toast").classList.add("visible");
  }
  function particle(x, y, color, n = 5, power = 90) {
    if (!g) return;
    for (let i = 0; i < n && g.particles.length < B.maxParticles; i++) {
      const a = rr(0, T),
        v = rr(power * 0.25, power);
      g.particles.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        t: rr(0.2, 0.65),
        max: 0.65,
        size: rr(1, 4),
        c: color,
      });
    }
  }

  function resetWorld() {
    seed =
      (crypto && crypto.getRandomValues
        ? crypto.getRandomValues(new Uint32Array(1))[0]
        : Date.now()) >>> 0;
    g = {
      mode: "play",
      time: 0,
      p: {
        x: 0,
        y: 0,
        hp: 100 + profile.hull * 16,
        maxhp: 100 + profile.hull * 16,
        inv: 0,
        shield: 0,
        shieldCooldown: 0,
        speed: 175,
      },
      camera: { x: 0, y: 0 },
      level: 1,
      xp: 0,
      xpNext: B.firstLevelXP,
      credits: 0,
      kills: 0,
      active: { cannon: 1 },
      passive: {},
      evolved: {},
      fused: {},
      wave: 1,
      bossSpawned: false,
      bossKilled: false,
      eliteSpawned: false,
      spawnTime: 0.25,
      attackClock: {},
      enemy: [],
      shots: [],
      enemyShots: [],
      pickups: [],
      particles: [],
      texts: [],
      arcs: [],
      rings: [],
      objectives: [],
      keys: {},
      input: { dx: 0, dy: 0, active: false, px: 0, py: 0 },
      anomalyTime: 0,
      lastHit: 0,
      endTime: B.runSeconds,
      toast: "",
      upgradeCount: 0,
      numberSpawned: 0,
    };
    Object.assign(g, {
      persisted: false,
      beams: [],
      bursts: [],
      salvos: [],
      facing: 0,
      aim: -Math.PI / 2,
      thrust: 0,
      upgradeGrace: 0,
      metrics: {
        damage: {},
        shots: {},
        spawned: {},
        killed: {},
        events: [],
        collectedXP: 0,
        shipDamage: 0,
        shieldsBlocked: 0,
      },
    });
    hideAll();
    $("hud").hidden = false;
    $("pauseBtn").hidden = false;
    $("joystick").hidden = true;
    $("footHint").hidden = false;
    lastFrame = performance.now();
    updateHud(true);
    notify("失物号启动 · 自动开火！");
  }
  function setMode(mode) {
    if (!g) return;
    g.mode = mode;
    hideAll();
    releaseInput();
    if (["upgrade", "pause", "results"].includes(mode)) $(mode).hidden = false;
    $("pauseBtn").hidden = mode === "results" || mode === "settling";
    $("joystick").hidden = true;
    if (mode === "results" || mode === "settling") $("bossBar").hidden = true;
    lastFrame = performance.now();
  }
  const levelXP = (level) => {
    const growth = Math.max(0, level - 2);
    return Math.round(
      B.levelXP.base +
        B.levelXP.linear * growth +
        B.levelXP.powerScale * Math.pow(growth, B.levelXP.power),
    );
  };
  function availableUpgrades() {
    if (!g) return [];
    const options = [];
    const activeSlots =
      Object.keys(g.active).length + Object.keys(g.fused).length;
    const consumed = FUSION.filter(([, , id]) => g.fused[id]).flatMap(
      ([a, b]) => [a, b],
    );
    for (const id of ACTIVE) {
      const level = g.active[id] || 0;
      if (
        !consumed.includes(id) &&
        level < B.activeMaxLevel &&
        (level > 0 || activeSlots < B.activeSlots)
      ) {
        options.push({ id, kind: "active", level: level + 1 });
      }
    }
    for (const id of PASSIVE) {
      const level = g.passive[id] || 0;
      if (
        level < B.passiveMaxLevel &&
        (level > 0 || Object.keys(g.passive).length < B.passiveSlots)
      ) {
        options.push({ id, kind: "passive", level: level + 1 });
      }
    }
    for (const [id, passive, evolution] of EVO) {
      if (g.active[id] === 3 && g.passive[passive] === 2 && !g.evolved[id]) {
        options.push({ id: evolution, kind: "evo", source: id, level: "MAX" });
      }
    }
    for (const [a, b, id] of FUSION) {
      if (
        g.active[a] === 3 &&
        g.active[b] === 3 &&
        !g.evolved[a] &&
        !g.evolved[b] &&
        !g.fused[id]
      ) {
        options.push({ id, kind: "fusion", source: [a, b], level: "FUSION" });
      }
    }
    return options;
  }
  function chooseOptions() {
    const available = availableUpgrades();
    const picks = available
      .filter((option) => ["evo", "fusion"].includes(option.kind))
      .slice(0, 2);
    function add(option) {
      if (
        option &&
        picks.length < 3 &&
        !picks.some((pick) => pick.id === option.id)
      )
        picks.push(option);
    }
    const ordinary = available.filter((option) =>
      ["active", "passive"].includes(option.kind),
    );
    const strongest = Object.keys(g.active)
      .filter((id) => !g.evolved[id])
      .sort(
        (a, b) =>
          g.active[b] - g.active[a] || ACTIVE.indexOf(a) - ACTIVE.indexOf(b),
      );
    const focus =
      g.buildFocus && g.active[g.buildFocus] && !g.evolved[g.buildFocus]
        ? g.buildFocus
        : strongest[0];
    const pair = EVO.find(([id]) => id === focus);
    add(ordinary.find((option) => option.id === focus));
    if (pair) add(ordinary.find((option) => option.id === pair[1]));
    const complement = FUSION.find(
      ([a, b, id]) => !g.fused[id] && (g.active[a] || g.active[b]),
    );
    if (complement) {
      const other = g.active[complement[0]] ? complement[1] : complement[0];
      add(ordinary.find((option) => option.id === other));
    }
    const newWeapons = ordinary.filter(
      (option) => option.kind === "active" && !g.active[option.id],
    );
    if (newWeapons.length)
      add(newWeapons[Math.floor(rand() * newWeapons.length)]);
    const rest = ordinary.filter(
      (option) => !picks.some((pick) => pick.id === option.id),
    );
    while (picks.length < 3 && rest.length) {
      const index = Math.floor(rand() * rest.length);
      add(rest.splice(index, 1)[0]);
    }
    for (const id of ["repair", "reserveShield", "salvage"])
      add({ id, kind: "bonus", level: 0 });
    return picks;
  }
  function renderUpgrades(reuse = false) {
    if (!reuse || !g.presented?.length) g.presented = chooseOptions();
    $("upgradeList").innerHTML = g.presented
      .map((option, index) => {
        const type = {
          active: "主动武器",
          passive: "辅助装置",
          evo: "满级进化",
          fusion: "双武器融合",
          bonus: "应急补给",
        }[option.kind];
        const current = g.active[option.id] || g.passive[option.id] || 0;
        const rank = ["active", "passive"].includes(option.kind)
          ? "Lv" + current + " → " + option.level
          : type;
        const name =
          NAMES[option.id] ||
          {
            repair: "船体修补",
            reserveShield: "应急护盾",
            salvage: "回收零件",
          }[option.id];
        const description =
          DESCS[option.id] ||
          {
            repair: "恢复28船体",
            reserveShield: "立即获得一次护盾",
            salvage: "本局带回零件 +8",
          }[option.id];
        const pair = EVO.find(
          ([id, passive]) => id === option.id || passive === option.id,
        );
        let hint = "";
        if (option.kind === "evo") hint = "替换原武器 · 槽位不变";
        else if (option.kind === "fusion") hint = "合并两件武器 · 空出1格";
        else if (pair) {
          const weaponLevel =
            option.id === pair[0] ? option.level : g.active[pair[0]] || 0;
          const passiveLevel =
            option.id === pair[1] ? option.level : g.passive[pair[1]] || 0;
          hint =
            "进化搭配 " +
            NAMES[pair[1]] +
            " · " +
            weaponLevel +
            "/3 + " +
            passiveLevel +
            "/2";
        }
        const icon =
          { repair: "armor", reserveShield: "shield", salvage: "scrap" }[
            option.id
          ] || option.id;
        return (
          '<button class="skill ' +
          (option.kind === "evo"
            ? "evolution"
            : option.kind === "fusion"
              ? "fusion"
              : "") +
          '" data-pick="' +
          index +
          '">' +
          '<span class="ico">' +
          pixelIcon(icon, 44) +
          '</span><div><span class="type-label">' +
          type +
          "</span><h3>" +
          name +
          "</h3><p>" +
          description +
          '</p><span class="tag">' +
          hint +
          '</span></div><span class="rank">' +
          rank +
          "</span></button>"
        );
      })
      .join("");
    $("upgradeBuild").textContent =
      "主动 " +
      (Object.keys(g.active).length + Object.keys(g.fused).length) +
      "/4 · 辅助 " +
      Object.keys(g.passive).length +
      "/3";
  }
  function levelUp() {
    releaseInput();
    g.upgradeCount++;
    g.metrics.events.push({ kind: "upgrade", time: g.time, level: g.level });
    renderUpgrades();
    setMode("upgrade");
    void saveCheckpoint();
  }
  function pick(index, qaBypass = false) {
    if (!g || g.mode !== "upgrade" || (!qaBypass && actionBusy)) return false;
    const option = g.presented[index];
    if (!option) return false;
    if (option.kind === "active") g.active[option.id] = option.level;
    else if (option.kind === "passive") {
      g.passive[option.id] = option.level;
      if (option.id === "armor") {
        g.p.maxhp += 12;
        g.p.hp += 12;
      }
    } else if (option.kind === "evo") g.evolved[option.source] = option.id;
    else if (option.kind === "fusion") {
      option.source.forEach((id) => delete g.active[id]);
      g.fused[option.id] = true;
    } else if (option.id === "repair")
      g.p.hp = Math.min(g.p.maxhp, g.p.hp + 28);
    else if (option.id === "reserveShield") g.p.shield = 1;
    else g.credits += 8;
    g.metrics.events.push({ kind: option.kind, id: option.id, time: g.time });
    if (option.kind === "active") g.buildFocus = option.id;
    if (option.kind === "passive") {
      const pair = EVO.find(([, passive]) => passive === option.id);
      if (pair && g.active[pair[0]]) g.buildFocus = pair[0];
    }
    g.presented = [];
    g.upgradeGrace = 0.4;
    g.mode = "play";
    hideAll();
    releaseInput();
    lastFrame = performance.now();
    burst(g.p.x, g.p.y, "hit", 1.8);
    if (["evo", "fusion"].includes(option.kind)) {
      ring(
        g.p.x,
        g.p.y,
        105,
        option.kind === "evo" ? "#f4c57a" : "#73d9e8",
        0.6,
      );
      notify(
        (option.kind === "evo" ? "进化完成 · " : "融合完成 · ") +
          NAMES[option.id],
      );
    } else notify(NAMES[option.id] || "补给已装载");
    updateHud(true);
    void saveCheckpoint();
    return true;
  }
  function awardXP(amount) {
    if (!g || g.mode !== "play") return;
    g.xp += amount;
    g.metrics.collectedXP += amount;
    if (g.xp >= g.xpNext && g.upgradeGrace <= 0) {
      g.xp -= g.xpNext;
      g.level++;
      g.xpNext = levelXP(g.level);
      levelUp();
    }
  }
  function spawnEnemy(force) {
    if (!g) return null;
    const special = force === "boss" || force === "elite";
    if (g.enemy.length >= (special ? B.maxEnemies : B.maxEnemies - 2))
      return null;
    const type =
      force ||
      (g.time > 24 && rand() < 0.12
        ? "tank"
        : rand() < 0.18
          ? "ranger"
          : rand() < 0.27
            ? "wisp"
            : "skimmer");
    const stats = {
      skimmer: { hp: 32, radius: 16, speed: 112 },
      wisp: { hp: 44, radius: 13, speed: 121 },
      ranger: { hp: 60, radius: 17, speed: 85 },
      tank: { hp: 135, radius: 25, speed: 64 },
      elite: { hp: 470, radius: 32, speed: 90 },
      boss: { hp: 1900, radius: 44, speed: 82 },
    }[type];
    const scale = 1 + g.time / 125;
    const side = Math.floor(rand() * 4),
      ex = VW / 2 + 30,
      ey = VH / 2 + 35;
    const enemy = {
      id: ++g.numberSpawned,
      t: type,
      x: g.p.x + (side < 2 ? (side === 0 ? -ex : ex) : rr(-ex, ex)),
      y: g.p.y + (side < 2 ? rr(-ey, ey) : side === 2 ? -ey : ey),
      hp: Math.round(stats.hp * scale),
      maxhp: Math.round(stats.hp * scale),
      radius: stats.radius,
      speed: stats.speed,
      fire: rr(1.3, 2.5),
      phase: rr(0, T),
      marked: 0,
      flash: 0,
      bladeAt: 0,
      disabled: 0,
      warn: 0,
      aim: 0,
      pattern: 0,
      charge: 0,
    };
    g.enemy.push(enemy);
    g.metrics.spawned[type] = (g.metrics.spawned[type] || 0) + 1;
    return enemy;
  }
  function closest(x, y, range = 9999, exclude = null) {
    let best = null,
      d2 = range * range;
    for (const e of g.enemy) {
      if (e.hp <= 0 || e === exclude) continue;
      const n = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (n < d2) {
        d2 = n;
        best = e;
      }
    }
    return best;
  }
  function fireBullet(x, y, target, kind = "pulse", damage = 19, speed = 305) {
    if (!target || g.shots.length >= B.maxFriendlyShots) return;
    const heading = angle({ x, y }, target);
    const shot = {
      x,
      y,
      vx: Math.cos(heading) * speed,
      vy: Math.sin(heading) * speed,
      damage,
      kind,
      r: kind === "missile" ? 6 : 3,
      t: 3.2,
      hit: new Set(),
      targetId: target.id,
      pierce: kind === "pulse" ? 1 + Math.min(1, g.passive.lens || 0) : 1,
    };
    g.shots.push(shot);
    g.metrics.shots[kind] = (g.metrics.shots[kind] || 0) + 1;
  }
  function blast(x, y, radius, damage, color = "#f4c57a", source = "missile") {
    ring(x, y, radius, color, 0.32);
    burst(x, y, "explosion", Math.min(2.4, radius / 24));
    for (const enemy of g.enemy) {
      if (
        enemy.hp > 0 &&
        Math.hypot(enemy.x - x, enemy.y - y) < radius + enemy.radius
      )
        hurtEnemy(enemy, damage, false, source);
    }
  }
  function chain(
    x,
    y,
    count,
    damage,
    range,
    first = null,
    sourceKind = "arc",
    stun = 0,
  ) {
    let origin = { x, y };
    const excluded = new Set(first ? [first] : []);
    for (let index = 0; index < Math.min(B.maxChainTargets, count); index++) {
      let target = null,
        minimum = range;
      for (const enemy of g.enemy) {
        if (enemy.hp <= 0 || excluded.has(enemy)) continue;
        const distance = Math.hypot(enemy.x - origin.x, enemy.y - origin.y);
        if (distance < minimum) {
          minimum = distance;
          target = enemy;
        }
      }
      if (!target) break;
      if (g.arcs.length < B.maxArcs)
        g.arcs.push({
          x1: origin.x,
          y1: origin.y,
          x2: target.x,
          y2: target.y,
          t: 0.22,
        });
      hurtEnemy(target, damage, false, sourceKind);
      target.disabled = Math.max(target.disabled, stun);
      excluded.add(target);
      origin = target;
    }
  }
  function hurtEnemy(enemy, amount, mark = false, source = "pulse") {
    if (enemy.hp <= 0) return;
    const damage = Math.max(1, amount * (1 + 0.13 * (g.passive.lens || 0)));
    const actual = Math.min(enemy.hp, damage);
    g.metrics.damage[source] = (g.metrics.damage[source] || 0) + actual;
    enemy.hp -= damage;
    enemy.flash = 0.09;
    if (mark) enemy.marked = 2.1;
    if (g.texts.length < B.maxDamageNumbers)
      g.texts.push({
        x: enemy.x + rr(-6, 6),
        y: enemy.y - 15,
        t: 0.45,
        s: Math.ceil(damage),
        color: damage >= 40 ? "#f4c57a" : "#e8dff0",
      });
    burst(enemy.x, enemy.y, "hit", 0.65);
    if (enemy.hp <= 0) killEnemy(enemy);
  }
  function killEnemy(enemy) {
    enemy.hp = 0;
    g.kills++;
    g.metrics.killed[enemy.t] = (g.metrics.killed[enemy.t] || 0) + 1;
    burst(
      enemy.x,
      enemy.y,
      "explosion",
      enemy.t === "boss" ? 3.6 : enemy.t === "elite" ? 2.4 : 1.1,
    );
    particle(enemy.x, enemy.y, "#f4c57a", enemy.t === "boss" ? 16 : 4, 95);
    const count =
      enemy.t === "boss"
        ? 13
        : enemy.t === "elite"
          ? 9
          : enemy.t === "tank"
            ? 3
            : 1;
    for (
      let index = 0;
      index < count && g.pickups.length < B.maxPickups;
      index++
    ) {
      g.pickups.push({
        x: enemy.x + rr(-14, 14),
        y: enemy.y + rr(-14, 14),
        type: index % 4 === 3 ? "scrap" : "xp",
        value:
          enemy.t === "boss"
            ? 24
            : enemy.t === "elite"
              ? 14
              : enemy.t === "tank"
                ? 12
                : 8,
        t: 30,
      });
    }
    if (
      !["boss", "elite"].includes(enemy.t) &&
      rand() < 0.32 &&
      g.pickups.length < B.maxPickups
    ) {
      g.pickups.push({
        x: enemy.x + rr(-10, 10),
        y: enemy.y + rr(-10, 10),
        type: "scrap",
        value: Math.floor(rr(2, 5)),
        t: 30,
      });
    }
    if (enemy.t === "boss") {
      g.bossKilled = true;
      g.metrics.events.push({ kind: "bossDefeated", time: g.time });
      notify("守卫已击退！");
    } else if (enemy.t === "elite") notify("精英击退 · 能量散落");
  }
  function damageShip(amount) {
    if (!g || g.mode !== "play" || g.p.inv > 0) return;
    if (g.p.shield > 0) {
      g.p.shield = 0;
      g.metrics.shieldsBlocked++;
      const evolved = !!g.evolved.shield;
      g.p.shieldCooldown =
        (evolved ? 4.5 : 12 - (g.active.shield || 1) * 1.5) *
        (1 - 0.12 * (g.passive.armor || 0));
      ring(g.p.x, g.p.y, evolved ? 112 : 63, "#73d9e8", 0.35);
      if (evolved) {
        for (const enemy of g.enemy)
          if (dist(enemy, g.p) < 112 + enemy.radius) {
            hurtEnemy(enemy, 58, false, "reactiveaegis");
            enemy.disabled = 0.4;
          }
      } else if (g.active.arc || g.fused.thunderhive)
        chain(g.p.x, g.p.y, 3, 22, 165, null, "shieldArc");
      g.p.inv = 0.5;
      return;
    }
    const damage = amount * (1 - 0.08 * (g.passive.armor || 0));
    g.p.hp = Math.max(0, g.p.hp - damage);
    g.metrics.shipDamage += damage;
    g.p.inv = 0.85;
    particle(g.p.x, g.p.y, "#ff7597", 8, 100);
    if (g.p.hp <= 0) {
      updateHud();
      void finish(false);
    }
  }
  function cooldown(id, base) {
    let r = base * (1 - 0.115 * (g.passive.cooler || 0));
    if (g.evolved[id]) r *= 0.8;
    return Math.max(0.17, r);
  }
  function clock(id, dt, interval, callback) {
    g.attackClock[id] = (g.attackClock[id] || 0) - dt;
    if (g.attackClock[id] <= 0) {
      g.attackClock[id] = interval;
      callback();
    }
  }
  function weapons(dt) {
    const player = g.p;
    if (g.active.cannon) {
      const level = g.active.cannon;
      clock(
        "cannon",
        dt,
        cooldown("cannon", g.evolved.cannon ? 0.34 : 0.54 - (level - 1) * 0.1),
        () => {
          const target = closest(
            player.x,
            player.y,
            g.evolved.cannon ? 660 : 465,
          );
          if (!target) return;
          g.aim = angle(player, target);
          if (g.evolved.cannon) beamAttack(target, 128 + profile.gun * 5);
          else
            for (let index = 0; index < level; index++) {
              const offset = (index - (level - 1) / 2) * 9;
              fireBullet(
                player.x - Math.sin(g.aim) * offset + Math.cos(g.aim) * 15,
                player.y + Math.cos(g.aim) * offset + Math.sin(g.aim) * 15,
                target,
                "pulse",
                15 + level * 9 + profile.gun * 4,
                405,
              );
            }
        },
      );
    }
    if (g.active.drone || g.fused.thunderhive) {
      const level = g.active.drone || 3;
      const count = g.fused.thunderhive ? 5 : g.evolved.drone ? 4 : level;
      const interval =
        (g.fused.thunderhive ? 0.39 : g.evolved.drone ? 0.55 : 0.87) *
        (1 - 0.08 * (g.passive.lock || 0));
      clock("drone", dt, cooldown("drone", interval), () => {
        for (let index = 0; index < count; index++) {
          const heading = g.time * 1.6 + (index * T) / count;
          const origin = {
            x: player.x + Math.cos(heading) * 47,
            y: player.y + Math.sin(heading) * 47,
          };
          const marked = g.enemy.find(
            (enemy) =>
              enemy.hp > 0 && enemy.marked > 0 && dist(enemy, origin) < 460,
          );
          const target =
            marked ||
            closest(origin.x, origin.y, 440 + (g.passive.lock || 0) * 25);
          if (target)
            fireBullet(
              origin.x,
              origin.y,
              target,
              g.fused.thunderhive ? "hive" : "drone",
              (18 + level * 12) * (1 + 0.08 * (g.passive.lock || 0)),
              345,
            );
        }
      });
    }
    if (g.active.arc) {
      const level = g.active.arc,
        evolved = !!g.evolved.arc,
        capacitor = g.passive.capacitor || 0;
      clock(
        "arc",
        dt,
        cooldown("arc", evolved ? 0.8 : 1.42 - (level - 1) * 0.16),
        () => {
          chain(
            player.x,
            player.y,
            evolved ? 4 : Math.min(4, level + capacitor),
            (evolved ? 48 : 22 + 9 * level) * (1 + 0.08 * capacitor),
            (evolved ? 340 : 240) + capacitor * 18,
            null,
            evolved ? "chainstorm" : "arc",
            evolved ? 0.18 : 0,
          );
        },
      );
    }
    if (g.active.missile) {
      const level = g.active.missile,
        evolved = !!g.evolved.missile;
      clock(
        "missile",
        dt,
        cooldown("missile", evolved ? 0.9 : 2.25 - 0.3 * level),
        () => {
          for (
            let index = 0;
            index < (evolved ? 4 : Math.max(1, level - 1));
            index++
          ) {
            if (g.salvos.length < 8)
              g.salvos.push({
                delay: evolved ? index * 0.1 : 0,
                damage: 23 + 12 * level,
                evolved,
              });
          }
        },
      );
    }
    for (const salvo of g.salvos) {
      salvo.delay -= dt;
      if (salvo.delay <= 0) {
        fireBullet(
          player.x,
          player.y,
          closest(player.x, player.y, 540),
          "missile",
          salvo.damage,
          270,
        );
        salvo.fired = true;
      }
    }
    g.salvos = g.salvos.filter((salvo) => !salvo.fired);
    if (g.active.blade || g.fused.blastwheel) {
      const level = g.active.blade || 3;
      const count = g.fused.blastwheel ? 6 : g.evolved.blade ? 5 : level + 1;
      const radius = g.evolved.blade || g.fused.blastwheel ? 78 : 48;
      for (const enemy of g.enemy) {
        if (enemy.hp <= 0 || enemy.bladeAt > g.time) continue;
        for (let index = 0; index < count; index++) {
          const heading = g.time * 2.7 + (index * T) / count;
          const x = player.x + Math.cos(heading) * radius,
            y = player.y + Math.sin(heading) * radius;
          if (Math.hypot(enemy.x - x, enemy.y - y) < enemy.radius + 11) {
            enemy.bladeAt = g.time + (g.evolved.blade ? 0.2 : 0.26);
            hurtEnemy(
              enemy,
              (14 + level * 7) * (g.evolved.blade ? 1.25 : 1),
              false,
              g.fused.blastwheel
                ? "blastwheel"
                : g.evolved.blade
                  ? "spiralsaw"
                  : "blade",
            );
            if (g.fused.blastwheel)
              blast(x, y, 44, 24, "#f4c57a", "blastwheel");
            break;
          }
        }
      }
    }
    if (g.active.shield) {
      g.p.shieldCooldown = Math.max(0, g.p.shieldCooldown - dt);
      if (g.p.shield === 0 && g.p.shieldCooldown === 0) g.p.shield = 1;
    }
  }
  function wave(dt) {
    if (g.time >= B.bossAt && !g.bossSpawned) {
      const boss = spawnEnemy("boss");
      if (boss) {
        g.bossSpawned = true;
        g.metrics.events.push({ kind: "boss", time: g.time });
        notify("星海守卫者 · 来袭");
      }
    }
    if (g.time >= B.eliteAt && !g.eliteSpawned) {
      const elite = spawnEnemy("elite");
      if (elite) {
        g.eliteSpawned = true;
        g.metrics.events.push({ kind: "elite", time: g.time });
        notify("反应堆追猎者 · 接近");
      }
    }
    if (g.time >= 48 && !g.anomalySeen) {
      g.anomalySeen = true;
      g.anomalyTime = 9;
      notify("碎星回波 · 敌群正在集结");
    }
    g.spawnTime -= dt;
    if (g.spawnTime <= 0) {
      const count = g.time > 115 ? 4 : g.time > 55 ? 3 : g.time > 12 ? 2 : 1;
      for (let index = 0; index < count; index++) spawnEnemy();
      g.spawnTime = Math.max(0.46, 1.05 - g.time * 0.0033);
    }
  }
  function update(dt) {
    if (!g || g.mode !== "play") return;
    if (g.time >= B.runSeconds) {
      void finish(true);
      return;
    }
    dt = Math.min(dt, B.runSeconds - g.time);
    g.time += dt;
    if (g.time >= B.runSeconds) {
      updateHud(true);
      void finish(true);
      return;
    }
    g.wave = Math.min(4, Math.floor(g.time / 45) + 1);
    g.anomalyTime = Math.max(0, g.anomalyTime - dt);
    g.upgradeGrace = Math.max(0, g.upgradeGrace - dt);
    g.p.inv = Math.max(0, g.p.inv - dt);
    const keys = g.keys,
      input = g.input;
    let dx =
      (keys.arrowright || keys.d ? 1 : 0) - (keys.arrowleft || keys.a ? 1 : 0);
    let dy =
      (keys.arrowdown || keys.s ? 1 : 0) - (keys.arrowup || keys.w ? 1 : 0);
    if (input.active) {
      dx += input.dx;
      dy += input.dy;
    }
    const magnitude = Math.hypot(dx, dy);
    g.thrust = Math.min(1, magnitude);
    if (magnitude > 0.06) {
      g.p.x += (dx / Math.max(1, magnitude)) * g.p.speed * dt;
      g.p.y += (dy / Math.max(1, magnitude)) * g.p.speed * dt;
      const target = Math.atan2(dy, dx) + Math.PI / 2;
      g.facing +=
        Math.atan2(Math.sin(target - g.facing), Math.cos(target - g.facing)) *
        Math.min(1, dt * 12);
    }
    g.camera.x += (g.p.x - g.camera.x) * Math.min(1, dt * 10);
    g.camera.y += (g.p.y - g.camera.y) * Math.min(1, dt * 10);
    wave(dt);
    weapons(dt);
    updateEnemies(dt);
    if (g.mode !== "play") return;
    updateShots(dt);
    for (const shot of g.enemyShots) {
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.t -= dt;
      if (Math.hypot(shot.x - g.p.x, shot.y - g.p.y) < 12) {
        damageShip(8);
        shot.t = 0;
      }
      if (g.mode !== "play") return;
    }
    g.enemyShots = g.enemyShots.filter((shot) => shot.t > 0);
    const attraction =
      150 + (g.passive.magnet || 0) * 55 + (g.evolved.blade ? 65 : 0);
    for (const pickup of g.pickups) {
      if (pickup.t <= 0) continue;
      pickup.t -= dt;
      const distance = dist(pickup, g.p);
      if (distance < attraction || pickup.magnetized) {
        pickup.magnetized = true;
        const travel = Math.min(distance, dt * (360 + distance * 2));
        if (distance > 0) {
          pickup.x += ((g.p.x - pickup.x) / distance) * travel;
          pickup.y += ((g.p.y - pickup.y) / distance) * travel;
        }
      }
      if (dist(pickup, g.p) < 19) {
        pickup.t = 0;
        if (pickup.type === "xp") awardXP(pickup.value);
        else g.credits += pickup.value;
        if (g.mode !== "play") break;
      }
    }
    g.pickups = g.pickups.filter((pickup) => pickup.t > 0);
    for (const field of [
      "arcs",
      "rings",
      "beams",
      "bursts",
      "texts",
      "particles",
    ]) {
      for (const effect of g[field]) {
        effect.t -= dt;
        if (field === "particles") {
          effect.x += effect.vx * dt;
          effect.y += effect.vy * dt;
        }
        if (field === "texts") effect.y -= dt * 30;
      }
      g[field] = g[field].filter((effect) => effect.t > 0);
    }
    awardXP(0);
    if (g.mode === "play" && g.time >= B.runSeconds) void finish(true);
    if (
      g.persisted &&
      g.mode === "play" &&
      g.time - lastCheckpointTime >= B.checkpointSeconds
    )
      void saveCheckpoint();
    updateHud();
  }
  function toScreen(x, y) {
    return {
      x: Math.round(x - g.camera.x + VW / 2),
      y: Math.round(y - g.camera.y + VH * 0.51),
    };
  }
  function background() {
    ctx.fillStyle = "#101225";
    ctx.fillRect(0, 0, VW, VH);
    const ox = g ? g.camera.x : 0,
      oy = g ? g.camera.y : 0;
    for (let layer = 0; layer < 3; layer++) {
      const spacing = [43, 83, 151][layer],
        depth = [0.16, 0.3, 0.55][layer];
      const shiftX = (((ox * depth) % spacing) + spacing) % spacing,
        shiftY = (((oy * depth) % spacing) + spacing) % spacing;
      for (let x = -spacing; x < VW + spacing; x += spacing)
        for (let y = -spacing; y < VH + spacing; y += spacing) {
          const hash = Math.abs(Math.floor(x * 7 + y * 13 + layer * 71)) % 13;
          if (hash < 7) continue;
          ctx.globalAlpha = 0.25 + layer * 0.18;
          ctx.fillStyle = hash === 12 ? "#f4c57a" : "#a89ac2";
          ctx.fillRect(
            Math.round(x - shiftX),
            Math.round(y - shiftY),
            hash === 12 ? 2 : 1,
            hash === 12 ? 2 : 1,
          );
        }
    }
    ctx.globalAlpha = 1;
    const driftX = (((ox * 0.12) % 300) + 300) % 300,
      driftY = (((oy * 0.12) % 420) + 420) % 420;
    ctx.fillStyle = "#2a21423d";
    for (let index = 0; index < 6; index++) {
      const x = (index * 73 + 110 - driftX + VW) % VW,
        y = (index * 181 - driftY + VH) % VH;
      ctx.fillRect(Math.round(x), Math.round(y), index % 2 ? 44 : 30, 2);
      ctx.fillRect(
        Math.round(x + 7),
        Math.round(y + 3),
        index % 2 ? 26 : 18,
        2,
      );
    }
  }
  function drawShip() {
    if (!g) return;
    const position = toScreen(g.p.x, g.p.y);
    const actor = window.SurvivorArt.catalog.player;
    const frame = Math.floor(g.time * 15) % 4;
    const flameScale = 0.32 + g.thrust * 0.3;
    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.rotate(g.facing);
    for (const [x, y] of actor.exhaustAnchors) {
      window.SurvivorArt.draw(
        ctx,
        "thruster",
        (x - actor.center[0]) * 2,
        (y - actor.center[1]) * 2,
        {
          frame,
          scale: flameScale,
          anchor: [12, 3],
          alpha: g.thrust > 0.1 ? 1 : 0.55,
        },
      );
    }
    ctx.restore();
    window.SurvivorArt.draw(ctx, "player", position.x, position.y, {
      angle: g.facing,
      alpha: g.p.inv > 0 && Math.floor(g.time * 18) % 2 ? 0.6 : 1,
    });
    window.SurvivorArt.draw(ctx, "cannon", position.x, position.y - 1, {
      angle: g.aim + Math.PI / 2,
      scale: 0.55,
    });
    if (g.p.shield > 0) {
      const radius = g.evolved.shield ? 35 : 29;
      ctx.strokeStyle = g.evolved.shield ? "#d4f6ed" : "#73d9e8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let index = 0; index <= 6; index++) {
        const heading = (index * T) / 6;
        const x = position.x + Math.cos(heading) * radius,
          y = position.y + Math.sin(heading) * radius;
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      window.SurvivorArt.draw(
        ctx,
        "shield_piece",
        position.x,
        position.y - radius,
        { scale: 0.6 },
      );
    }
  }
  function render() {
    background();
    if (!g || !window.SurvivorArt.loaded()) return;
    const art = window.SurvivorArt;
    for (const pickup of g.pickups) {
      const point = toScreen(pickup.x, pickup.y);
      art.draw(
        ctx,
        pickup.type === "xp" ? "xp_crystal" : "scrap",
        point.x,
        point.y,
        { scale: 0.6 },
      );
    }
    for (const enemy of g.enemy) {
      if (enemy.hp <= 0) continue;
      const point = toScreen(enemy.x, enemy.y);
      if (enemy.warn > 0) drawWarning(enemy, point);
      const heading =
        Math.atan2(g.p.y - enemy.y, g.p.x - enemy.x) + Math.PI / 2;
      art.draw(ctx, enemy.t, point.x, point.y, {
        angle: enemy.t === "boss" ? Math.sin(g.time * 0.8) * 0.1 : heading,
        flash: enemy.flash > 0,
      });
      if (enemy.marked > 0) {
        ctx.strokeStyle = "#f4c57a";
        ctx.lineWidth = 1;
        ctx.strokeRect(point.x - 10, point.y - 10, 20, 20);
      }
      if (["boss", "elite"].includes(enemy.t)) drawOffscreenMarker(point);
    }
    drawOrbitals();
    for (const shot of g.shots) {
      const point = toScreen(shot.x, shot.y);
      art.draw(
        ctx,
        shot.kind === "missile" ? "missile_body" : "pulse",
        point.x,
        point.y,
        {
          angle: Math.atan2(shot.vy, shot.vx) + Math.PI / 2,
          scale: shot.kind === "missile" ? 0.9 : 0.55,
        },
      );
    }
    for (const beam of g.beams) {
      const start = toScreen(beam.x1, beam.y1),
        end = toScreen(beam.x2, beam.y2);
      ctx.globalAlpha = clamp(beam.t / 0.16, 0, 1);
      ctx.strokeStyle = "#497c9d";
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.strokeStyle = "#73d9e8";
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.strokeStyle = "#fff0ce";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const arc of g.arcs) {
      const start = toScreen(arc.x1, arc.y1),
        end = toScreen(arc.x2, arc.y2);
      ctx.globalAlpha = clamp(arc.t / 0.22, 0, 1);
      ctx.strokeStyle = "#73d9e8";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo((start.x + end.x) / 2 - 5, (start.y + end.y) / 2 + 5);
      ctx.lineTo((start.x + end.x) / 2 + 5, (start.y + end.y) / 2 - 4);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.strokeStyle = "#e4f4ec";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const effect of g.rings) {
      const point = toScreen(effect.x, effect.y);
      ctx.globalAlpha = clamp(effect.t / effect.max, 0, 1) * 0.6;
      ctx.strokeStyle = effect.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(point.x, point.y, effect.to * (1 - effect.t / effect.max), 0, T);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const effect of g.bursts) {
      const point = toScreen(effect.x, effect.y);
      const frames = art.catalog[effect.kind].frames;
      const frame = Math.min(
        frames.length - 1,
        Math.floor((1 - effect.t / effect.max) * frames.length),
      );
      art.draw(ctx, effect.kind, point.x, point.y, {
        frame,
        scale: effect.scale,
      });
    }
    for (const particle of g.particles) {
      const point = toScreen(particle.x, particle.y);
      ctx.globalAlpha = clamp(particle.t / particle.max, 0, 1);
      ctx.fillStyle = particle.c;
      ctx.fillRect(
        point.x,
        point.y,
        Math.ceil(particle.size / 2),
        Math.ceil(particle.size / 2),
      );
    }
    ctx.globalAlpha = 1;
    for (const shot of g.enemyShots) {
      const point = toScreen(shot.x, shot.y);
      art.draw(ctx, "threat", point.x, point.y, {
        angle: Math.atan2(shot.vy, shot.vx) + Math.PI / 2,
        scale: 0.65,
      });
    }
    drawShip();
    for (const text of g.texts) {
      const point = toScreen(text.x, text.y);
      ctx.globalAlpha = clamp(text.t / 0.3, 0, 1);
      ctx.fillStyle = "#17172b";
      ctx.font = "bold 10px monospace";
      ctx.fillText(text.s, point.x + 1, point.y + 1);
      ctx.fillStyle = text.color;
      ctx.fillText(text.s, point.x, point.y);
    }
    ctx.globalAlpha = 1;
  }
  function updateHud(force = false) {
    if (!g) return;
    $("hud").hidden = false;
    $("hpLabel").textContent = Math.ceil(g.p.hp) + "/" + g.p.maxhp;
    $("hpFill").style.width = Math.max(0, g.p.hp / g.p.maxhp) * 100 + "%";
    document
      .querySelector(".ship-health")
      .classList.toggle("low", g.p.hp / g.p.maxhp < 0.3);
    $("shieldLabel").textContent = g.p.shield ? "护盾就绪" : "";
    $("levelLabel").textContent = g.level;
    $("timeLabel").textContent = fmt(g.time);
    $("killsLabel").textContent = g.kills;
    $("scrapLabel").textContent = g.credits;
    $("xpFill").style.width = clamp((g.xp / g.xpNext) * 100, 0, 100) + "%";
    $("waveTip").textContent =
      g.time < B.eliteAt
        ? "四面来敌 · 自由移动"
        : g.time < B.bossAt
          ? "精英追猎"
          : "守卫来袭";
    $("footHint").hidden = g.time > 8 || g.mode !== "play";
    const special =
      g.enemy.find((enemy) => enemy.hp > 0 && enemy.t === "boss") ||
      g.enemy.find((enemy) => enemy.hp > 0 && enemy.t === "elite");
    $("bossBar").hidden = !special || g.mode === "results";
    if (special) {
      $("bossName").textContent =
        special.t === "boss" ? "星海守卫者" : "反应堆追猎者";
      $("bossHealth").textContent =
        Math.ceil(special.hp) + " / " + special.maxhp;
      $("bossFill").style.width =
        clamp((special.hp / special.maxhp) * 100, 0, 100) + "%";
    }
    if (!force && g.lastHudFrame === Math.floor(g.time * 4)) return;
    g.lastHudFrame = Math.floor(g.time * 4);
    const active = Object.keys(g.active)
      .map((id) => ({
        id: g.evolved[id] || id,
        rank: g.evolved[id] ? "EVO" : g.active[id],
        kind: g.evolved[id] ? "evo" : "",
      }))
      .concat(
        Object.keys(g.fused).map((id) => ({ id, rank: "融合", kind: "fused" })),
      );
    const passive = Object.keys(g.passive).map((id) => ({
      id,
      rank: g.passive[id],
      kind: "",
    }));
    function row(label, items, count) {
      return (
        '<div class="slot-row"><span class="slot-label">' +
        label +
        "</span>" +
        Array.from({ length: count }, (_, index) => {
          const item = items[index];
          return item
            ? '<span class="slot ' +
                item.kind +
                '" aria-label="' +
                NAMES[item.id] +
                " " +
                item.rank +
                '">' +
                pixelIcon(item.id, 24) +
                "<small>" +
                item.rank +
                "</small></span>"
            : '<span class="slot empty" aria-label="空槽"></span>';
        }).join("") +
        "</div>"
      );
    }
    $("loadout").innerHTML = row("武装", active, 4) + row("辅助", passive, 3);
  }
  async function finish(victory) {
    if (!g || ["results", "settling"].includes(g.mode)) return;
    releaseInput();
    const summary = {
      time: g.time,
      kills: g.kills,
      credits: g.credits,
      level: g.level,
      victory: !!victory,
      bossKilled: g.bossKilled,
      active: { ...g.active },
      passive: { ...g.passive },
      evolved: { ...g.evolved },
      fused: { ...g.fused },
    };
    g.mode = "settling";
    $("pauseBtn").hidden = true;
    if (!g.persisted) {
      profile.runs++;
      profile.best = Math.max(profile.best, g.kills);
      profile.credits += g.credits;
      showResults(summary);
      return;
    }
    actionBusy = true;
    g.pendingSummary = summary;
    try {
      const result = await enqueue(() =>
        storage.settle(runId, runRevision, summary),
      );
      applyStored(result.record);
      g.pendingSummary = null;
      showResults(result.receipt);
      savedMessage();
    } catch (error) {
      showResults(summary, false);
      storageWarning(error);
    } finally {
      actionBusy = false;
      refreshPerks();
    }
  }
  function refreshPerks() {
    for (const [button, kind, base] of [
      ["upgradeHullBtn", "hull", B.hullUpgradeBase],
      ["upgradeGunBtn", "gun", B.gunUpgradeBase],
    ]) {
      const level = profile[kind],
        cost = base * (level + 1);
      $(button).disabled =
        actionBusy ||
        !!storeView?.active ||
        level >= 3 ||
        profile.credits < cost;
      $(button).innerHTML =
        pixelIcon(kind === "hull" ? "armor" : "cannon", 26) +
        (kind === "hull" ? "船体加固" : "主炮校准") +
        "<br>" +
        level +
        "/3 · " +
        (level >= 3 ? "已满级" : cost + "零件");
    }
    $("progressText").textContent = profile.credits + "零件";
  }
  async function buy(kind) {
    if (
      actionBusy ||
      performance.now() < purchaseLockedUntil ||
      !storage ||
      !["hull", "gun"].includes(kind)
    )
      return;
    purchaseLockedUntil = performance.now() + 550;
    const expectedLevel = profile[kind];
    actionBusy = true;
    refreshPerks();
    try {
      const result = await enqueue(() => storage.buy(kind, expectedLevel));
      applyStored(result.record);
      savedMessage();
      notify(
        kind === "hull" ? "船体结构已加固 · 下局生效" : "炮组已校准 · 下局生效",
      );
    } catch (error) {
      storageWarning(error);
    } finally {
      actionBusy = false;
      refreshPerks();
    }
  }
  function pause() {
    releaseInput();
    if (!g || g.mode !== "play") return;
    setMode("pause");
    void saveCheckpoint();
  }
  async function unpause() {
    if (!g || g.mode !== "pause" || actionBusy) return;
    if (runDetached) {
      await resumeSavedRun();
      return;
    }
    releaseInput();
    g.mode = "play";
    hideAll();
    lastFrame = performance.now();
  }
  function loop(timestamp) {
    const elapsed = Math.max(0, (timestamp - lastFrame) / 1000);
    const dt = Math.min(0.05, elapsed);
    lastFrame = timestamp;
    if (g && g.mode === "play") update(dt);
    if (toastT > 0) {
      toastT -= dt;
      if (toastT <= 0) $("toast").classList.remove("visible");
    }
    render();
    raf = requestAnimationFrame(loop);
  }
  function handlePointer(event) {
    if (!g) return;
    if (
      ["pointerup", "pointercancel", "lostpointercapture"].includes(event.type)
    ) {
      if (g.input.id === event.pointerId) releaseInput();
      return;
    }
    if (g.mode !== "play") return;
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left,
      y = event.clientY - rect.top;
    if (event.type === "pointerdown") {
      if (g.input.active) return;
      g.input = {
        active: true,
        id: event.pointerId,
        px: x,
        py: y,
        dx: 0,
        dy: 0,
      };
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {}
      $("joystick").hidden = false;
      $("joystick").style.left = x - 44 + "px";
      $("joystick").style.top = y - 44 + "px";
      $("joystick").style.bottom = "auto";
    } else if (event.type === "pointermove" && g.input.id === event.pointerId) {
      const dx = x - g.input.px,
        dy = y - g.input.py,
        length = Math.hypot(dx, dy);
      g.input.dx = dx / Math.max(38, length);
      g.input.dy = dy / Math.max(38, length);
      $("stick").style.transform =
        "translate(" + g.input.dx * 29 + "px," + g.input.dy * 29 + "px)";
    }
  }
  function ring(x, y, radius, color, duration) {
    g.rings.push({ x, y, to: radius, t: duration, max: duration, color });
    if (g.rings.length > B.maxRings) g.rings.shift();
  }
  function burst(x, y, kind, scale) {
    const duration = kind === "explosion" ? 0.39 : 0.18;
    g.bursts.push({ x, y, kind, scale, t: duration, max: duration });
    if (g.bursts.length > B.maxBursts) g.bursts.shift();
  }
  function segmentDistance(point, x1, y1, x2, y2) {
    const dx = x2 - x1,
      dy = y2 - y1;
    const fraction = clamp(
      ((point.x - x1) * dx + (point.y - y1) * dy) / (dx * dx + dy * dy || 1),
      0,
      1,
    );
    return Math.hypot(
      point.x - x1 - dx * fraction,
      point.y - y1 - dy * fraction,
    );
  }
  function beamAttack(target, damage) {
    const heading = angle(g.p, target),
      x = g.p.x + Math.cos(heading) * 660,
      y = g.p.y + Math.sin(heading) * 660;
    g.beams.push({ x1: g.p.x, y1: g.p.y, x2: x, y2: y, t: 0.16 });
    if (g.beams.length > 6) g.beams.shift();
    g.metrics.shots.piercebeam = (g.metrics.shots.piercebeam || 0) + 1;
    for (const enemy of g.enemy)
      if (
        enemy.hp > 0 &&
        segmentDistance(enemy, g.p.x, g.p.y, x, y) < enemy.radius + 5
      ) {
        hurtEnemy(
          enemy,
          damage,
          !!(g.active.drone || g.fused.thunderhive),
          "piercebeam",
        );
      }
  }
  function enemyFire(enemy) {
    const boss = enemy.t === "boss",
      elite = enemy.t === "elite";
    const radial =
      boss && enemy.hp / enemy.maxhp < 0.5 && enemy.pattern % 2 === 0;
    const count = radial ? 12 : boss ? 7 : elite ? 3 : 1;
    for (
      let index = 0;
      index < count && g.enemyShots.length < B.maxEnemyShots;
      index++
    ) {
      const heading = radial
        ? (index * T) / count
        : enemy.aim + (index - (count - 1) / 2) * 0.17;
      const speed = boss ? 150 : 125;
      g.enemyShots.push({
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(heading) * speed,
        vy: Math.sin(heading) * speed,
        t: 3.6,
      });
    }
    if (boss && enemy.pattern % 3 === 0) {
      enemy.charge = 0.42;
      enemy.chargeAngle = enemy.aim;
    }
  }
  function updateEnemies(dt) {
    for (const enemy of g.enemy) {
      if (enemy.hp <= 0) continue;
      enemy.flash = Math.max(0, enemy.flash - dt);
      enemy.marked = Math.max(0, enemy.marked - dt);
      if (enemy.disabled > 0) {
        enemy.disabled -= dt;
        continue;
      }
      const distance = dist(enemy, g.p);
      let heading = angle(enemy, g.p);
      if (enemy.t === "ranger" && distance < 175) heading += Math.PI;
      else if (enemy.t === "wisp")
        heading += Math.sin(g.time * 2.5 + enemy.phase) * 0.5;
      let speed = enemy.speed * (1 + g.time / 1000);
      if (
        ["boss", "elite"].includes(enemy.t) &&
        distance > Math.min(VW, VH) * 0.85
      )
        speed *= 2.7;
      if (enemy.charge > 0) {
        enemy.charge -= dt;
        speed = 315;
        heading = enemy.chargeAngle;
      }
      if (enemy.warn > 0) speed *= 0.35;
      enemy.x += Math.cos(heading) * speed * dt;
      enemy.y += Math.sin(heading) * speed * dt;
      if (["ranger", "elite", "boss"].includes(enemy.t) && distance < 520) {
        if (enemy.warn > 0) {
          enemy.warn -= dt;
          if (enemy.warn <= 0) enemyFire(enemy);
        } else {
          enemy.fire -= dt;
          if (enemy.fire <= 0) {
            enemy.aim = angle(enemy, g.p);
            enemy.pattern++;
            enemy.warn = enemy.t === "boss" ? 0.7 : 0.4;
            enemy.fire =
              enemy.t === "boss" ? 1.5 : enemy.t === "elite" ? 2 : 2.5;
          }
        }
      }
      if (dist(enemy, g.p) < enemy.radius + 12) {
        damageShip(
          enemy.t === "boss"
            ? 22
            : enemy.t === "elite"
              ? 15
              : enemy.t === "tank"
                ? 10
                : 6,
        );
        enemy.x -= Math.cos(heading) * 14;
        enemy.y -= Math.sin(heading) * 14;
        if (g.mode !== "play") return;
      }
    }
    g.enemy = g.enemy.filter(
      (enemy) =>
        enemy.hp > 0 &&
        (["boss", "elite"].includes(enemy.t) ||
          (Math.abs(enemy.x - g.p.x) < VW / 2 + 150 &&
            Math.abs(enemy.y - g.p.y) < VH / 2 + 150)),
    );
  }
  function updateShots(dt) {
    for (const shot of g.shots) {
      shot.t -= dt;
      const previousX = shot.x,
        previousY = shot.y;
      if (["missile", "drone", "hive"].includes(shot.kind)) {
        const target =
          g.enemy.find((enemy) => enemy.id === shot.targetId && enemy.hp > 0) ||
          closest(shot.x, shot.y, 350);
        if (target) {
          shot.targetId = target.id;
          const desired = angle(shot, target),
            current = Math.atan2(shot.vy, shot.vx),
            turn = Math.atan2(
              Math.sin(desired - current),
              Math.cos(desired - current),
            );
          const speed = Math.hypot(shot.vx, shot.vy),
            rate = shot.kind === "missile" ? 3.4 : g.evolved.drone ? 4.8 : 2.8;
          const heading = current + clamp(turn, -rate * dt, rate * dt);
          shot.vx = Math.cos(heading) * speed;
          shot.vy = Math.sin(heading) * speed;
        }
      }
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      for (const enemy of g.enemy) {
        if (
          enemy.hp <= 0 ||
          shot.hit.has(enemy.id) ||
          segmentDistance(enemy, previousX, previousY, shot.x, shot.y) >=
            enemy.radius + shot.r
        )
          continue;
        shot.hit.add(enemy.id);
        const mark =
          shot.kind === "pulse" && !!(g.active.drone || g.fused.thunderhive);
        const damage =
          shot.damage + (enemy.marked > 0 && shot.kind !== "pulse" ? 7 : 0);
        hurtEnemy(enemy, damage, mark, shot.kind);
        if (
          shot.kind === "pulse" &&
          g.active.arc &&
          g.time >= (g.softArcAt || 0)
        ) {
          g.softArcAt = g.time + 0.65;
          chain(enemy.x, enemy.y, 1, 10, 130, enemy, "pulseArc");
        }
        if (
          ["drone", "hive"].includes(shot.kind) &&
          (g.active.arc || g.fused.thunderhive)
        )
          chain(
            enemy.x,
            enemy.y,
            g.fused.thunderhive ? 4 : 2,
            g.fused.thunderhive ? 28 : 14,
            g.fused.thunderhive ? 230 : 145,
            enemy,
            g.fused.thunderhive ? "thunderhive" : "droneArc",
          );
        if (shot.kind === "missile")
          blast(
            shot.x,
            shot.y,
            g.evolved.missile ? 68 : 46,
            shot.damage * 0.7,
            "#f4c57a",
            g.evolved.missile ? "meteorbarrage" : "missile",
          );
        shot.pierce--;
        if (shot.pierce <= 0) {
          shot.t = 0;
          break;
        }
      }
    }
    g.shots = g.shots.filter(
      (shot) => shot.t > 0 && Math.hypot(shot.x - g.p.x, shot.y - g.p.y) < 1000,
    );
  }
  function drawWarning(enemy, point) {
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.strokeStyle = "#ff7597";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 7]);
    const length = enemy.t === "boss" ? 160 : 70;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.lineTo(
      point.x + Math.cos(enemy.aim) * length,
      point.y + Math.sin(enemy.aim) * length,
    );
    ctx.stroke();
    ctx.restore();
  }
  function drawOffscreenMarker(point) {
    if (point.x > 20 && point.x < VW - 20 && point.y > 195 && point.y < VH - 25)
      return;
    const x = clamp(point.x, 15, VW - 15),
      y = clamp(point.y, 195, VH - 25),
      heading = Math.atan2(point.y - VH * 0.51, point.x - VW / 2);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heading);
    ctx.strokeStyle = "#ff7597";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-5, -5);
    ctx.lineTo(2, 0);
    ctx.lineTo(-5, 5);
    ctx.stroke();
    ctx.restore();
  }
  function drawOrbitals() {
    const art = window.SurvivorArt,
      player = toScreen(g.p.x, g.p.y);
    if (g.active.blade || g.fused.blastwheel) {
      const count = g.fused.blastwheel
        ? 6
        : g.evolved.blade
          ? 5
          : g.active.blade + 1;
      const radius = g.evolved.blade || g.fused.blastwheel ? 78 : 48;
      for (let index = 0; index < count; index++) {
        const heading = g.time * 2.7 + (index * T) / count;
        art.draw(
          ctx,
          "blade_body",
          player.x + Math.cos(heading) * radius,
          player.y + Math.sin(heading) * radius,
          { angle: heading, scale: 0.9 },
        );
      }
    }
    if (g.active.drone || g.fused.thunderhive) {
      const count = g.fused.thunderhive
        ? 5
        : g.evolved.drone
          ? 4
          : g.active.drone;
      for (let index = 0; index < count; index++) {
        const heading = g.time * 1.6 + (index * T) / count;
        art.draw(
          ctx,
          "drone_body",
          player.x + Math.cos(heading) * 47,
          player.y + Math.sin(heading) * 47,
          { angle: g.aim + Math.PI / 2, scale: 0.8 },
        );
      }
    }
  }
  function releaseInput() {
    if (g) {
      g.keys = {};
      g.input = { active: false, dx: 0, dy: 0, px: 0, py: 0 };
    }
    $("joystick").hidden = true;
    $("stick").style.transform = "";
  }
  function enqueue(operation) {
    const result = pendingWrite.then(operation, operation);
    pendingWrite = result.catch(() => {});
    return result;
  }
  function savedMessage() {
    $("saveStatus").textContent = "已保存";
    $("saveBar").classList.remove("error");
    $("retrySaveBtn").hidden = true;
  }
  function storageWarning(error) {
    $("saveStatus").textContent = error.message || "保存未完成，请重试";
    $("saveBar").classList.add("error");
    $("retrySaveBtn").hidden = false;
    if (/另一窗口/.test(error.message)) {
      runDetached = true;
      pause();
    }
  }
  function applyStored(record) {
    storeView = record;
    profile = { ...record.profile };
  }
  function captureSnapshot() {
    const game = structuredClone(g);
    game.pickups = game.pickups.filter((pickup) => pickup.t > 0);
    game.keys = {};
    game.input = { active: false, dx: 0, dy: 0, px: 0, py: 0 };
    game.mode = g.mode === "upgrade" ? "upgrade" : "pause";
    for (const field of [
      "particles",
      "texts",
      "arcs",
      "rings",
      "beams",
      "bursts",
    ])
      game[field] = [];
    return { schema: 1, seed, game };
  }
  function validateSnapshot(snapshot) {
    const game = snapshot?.game;
    if (
      snapshot?.schema !== 1 ||
      !Number.isSafeInteger(snapshot.seed) ||
      !game ||
      !["pause", "upgrade"].includes(game.mode) ||
      !Number.isFinite(game.time) ||
      game.time < 0 ||
      game.time > B.runSeconds
    )
      throw Error("对局快照无效，原数据保留");
    if (
      !Number.isFinite(game.p?.hp) ||
      !Number.isFinite(game.p?.x) ||
      !Number.isFinite(game.p?.y) ||
      !Number.isSafeInteger(game.credits) ||
      game.credits < 0
    )
      throw Error("对局数值无效");
    if (
      Object.keys(game.active).length + Object.keys(game.fused).length >
        B.activeSlots ||
      Object.keys(game.passive).length > B.passiveSlots
    )
      throw Error("武装槽位无效");
    for (const [id, level] of Object.entries(game.active))
      if (
        !ACTIVE.includes(id) ||
        !Number.isSafeInteger(level) ||
        level < 1 ||
        level > 3
      )
        throw Error("主动武器无效");
    for (const [id, level] of Object.entries(game.passive))
      if (
        !PASSIVE.includes(id) ||
        !Number.isSafeInteger(level) ||
        level < 1 ||
        level > 2
      )
        throw Error("辅助装置无效");
    for (const [id, evolved] of Object.entries(game.evolved)) {
      const recipe = EVO.find(
        ([source, , result]) => source === id && result === evolved,
      );
      if (!recipe || game.active[id] !== 3 || game.passive[recipe[1]] !== 2)
        throw Error("进化记录无效，原数据保留");
    }
    for (const [id, enabled] of Object.entries(game.fused)) {
      const recipe = FUSION.find(([, , result]) => result === id);
      if (
        !recipe ||
        enabled !== true ||
        game.active[recipe[0]] ||
        game.active[recipe[1]] ||
        game.evolved[recipe[0]] ||
        game.evolved[recipe[1]]
      )
        throw Error("融合记录无效，原数据保留");
    }
    if (
      !Number.isFinite(game.p.maxhp) ||
      game.p.maxhp <= 0 ||
      game.p.hp < 0 ||
      game.p.hp > game.p.maxhp ||
      !Number.isSafeInteger(game.level) ||
      game.level < 1 ||
      !Number.isFinite(game.xp) ||
      game.xp < 0 ||
      !Number.isFinite(game.xpNext) ||
      game.xpNext <= 0
    )
      throw Error("对局成长记录无效，原数据保留");
    for (const [field, maximum] of [
      ["enemy", B.maxEnemies],
      ["shots", B.maxFriendlyShots],
      ["enemyShots", B.maxEnemyShots],
      ["pickups", B.maxPickups],
    ])
      if (!Array.isArray(game[field]) || game[field].length > maximum)
        throw Error("对局实体记录无效");
    if (
      game.mode === "upgrade" &&
      (!Array.isArray(game.presented) || game.presented.length !== 3)
    )
      throw Error("强化选项未保存");
    return snapshot;
  }
  async function saveCheckpoint() {
    if (
      !storage ||
      !g?.persisted ||
      !["play", "pause", "upgrade"].includes(g.mode) ||
      runDetached
    )
      return;
    const id = runId,
      snapshot = captureSnapshot();
    lastCheckpointTime = g.time;
    saving = true;
    try {
      await enqueue(async () => {
        if (runId !== id) return;
        const result = await storage.checkpoint(id, runRevision, snapshot);
        runRevision = result.runRevision;
        applyStored(result.record);
        savedMessage();
      });
    } catch (error) {
      storageWarning(error);
    } finally {
      saving = false;
    }
  }
  function newRunId() {
    return Array.from(crypto.getRandomValues(new Uint32Array(4)))
      .map((value) => value.toString(16).padStart(8, "0"))
      .join("");
  }
  async function reset() {
    if (!ready || actionBusy) return;
    actionBusy = true;
    try {
      await pendingWrite;
      const latest = await storage.read();
      applyStored(latest.record);
      if (storeView.active) {
        const old = validateSnapshot(storeView.active.snapshot).game;
        await storage.settle(storeView.active.id, storeView.active.revision, {
          time: old.time,
          kills: old.kills,
          credits: old.credits,
          level: old.level,
          victory: false,
          bossKilled: old.bossKilled,
          active: old.active,
          passive: old.passive,
          evolved: old.evolved,
          fused: old.fused,
        });
        applyStored((await storage.read()).record);
      }
      resetWorld();
      g.mode = "loading";
      runDetached = false;
      runId = newRunId();
      const result = await storage.begin(runId, captureSnapshot());
      applyStored(result.record);
      runRevision = 0;
      lastCheckpointTime = 0;
      g.persisted = true;
      g.mode = "play";
      $("start").hidden = true;
      lastFrame = performance.now();
      savedMessage();
    } catch (error) {
      g = null;
      showStart();
      storageWarning(error);
    } finally {
      actionBusy = false;
    }
  }
  async function resumeSavedRun() {
    if (!ready || actionBusy) return;
    actionBusy = true;
    try {
      await pendingWrite;
      const current = await storage.read();
      applyStored(current.record);
      if (!storeView.active) {
        showResults(storeView.lastResult);
        return;
      }
      validateSnapshot(storeView.active.snapshot);
      const result = await storage.resume();
      applyStored(result.record);
      const snapshot = validateSnapshot(storeView.active.snapshot);
      g = structuredClone(snapshot.game);
      seed = snapshot.seed;
      runId = storeView.active.id;
      runRevision = storeView.active.revision;
      g.persisted = true;
      runDetached = false;
      lastCheckpointTime = g.time;
      releaseInput();
      if (g.mode === "upgrade") {
        renderUpgrades(true);
        setMode("upgrade");
      } else {
        g.mode = "play";
        hideAll();
      }
      $("hud").hidden = false;
      $("pauseBtn").hidden = false;
      lastFrame = performance.now();
      updateHud(true);
      savedMessage();
    } catch (error) {
      storageWarning(error);
    } finally {
      actionBusy = false;
      if (g?.mode === "results") refreshPerks();
    }
  }
  function showStart() {
    hideAll();
    $("start").hidden = false;
    $("hud").hidden = true;
    $("bossBar").hidden = true;
    $("pauseBtn").hidden = true;
    $("joystick").hidden = true;
    $("footHint").hidden = true;
    const active = storeView?.active;
    $("continueBtn").hidden = !active;
    $("continueBtn").textContent = active
      ? "继续上次 · " + fmt(active.snapshot.game.time)
      : "继续上次";
    $("startBtn").disabled = !ready;
    $("startBtn").textContent = active ? "结算上局并重新挑战" : "开始一局";
    $("recordText").textContent =
      "完成 " + profile.runs + " 局 · 最佳 " + profile.best + " 击落";
    $("buildStamp").textContent =
      "v" +
      window.SurvivorBuild.version +
      " · " +
      window.SurvivorBuild.commit.slice(0, 7);
  }
  function showResults(summary, committed = true) {
    if (!summary) {
      showStart();
      return;
    }
    hideAll();
    $("results").hidden = false;
    $("pauseBtn").hidden = true;
    $("bossBar").hidden = true;
    $("joystick").hidden = true;
    if (g) g.mode = "results";
    $("resultState").textContent = committed ? "本局已归档" : "结算等待保存";
    $("resultTitle").textContent = summary.victory
      ? "三分钟，稳稳归来"
      : "下一局，会更强";
    $("resultDesc").textContent = summary.victory
      ? summary.bossKilled
        ? "守卫已击退。带着新武装，再试一种搭配。"
        : "坚持到了最后。下次，试着击退守卫。"
      : "带回已收集的零件，整备后再出发。";
    $("statTime").textContent = fmt(summary.time);
    $("statKills").textContent = summary.kills;
    $("statScrap").textContent = summary.credits;
    $("statLevel").textContent = summary.level;
    const weapons = Object.keys(summary.active)
      .map((id) => summary.evolved[id] || id)
      .concat(Object.keys(summary.fused));
    $("resultBuild").innerHTML = weapons
      .map(
        (id) =>
          '<span class="result-weapon">' +
          pixelIcon(id, 25) +
          NAMES[id] +
          "</span>",
      )
      .join("");
    refreshPerks();
    $("retryBtn").disabled = !committed;
    $("menuBtn").disabled = !committed;
  }
  async function retrySaving() {
    if (!storage) {
      await initialize();
      return;
    }
    if (runDetached) {
      await resumeSavedRun();
      return;
    }
    if (g?.pendingSummary) {
      const summary = g.pendingSummary;
      g.mode = "pause";
      await finish(summary.victory);
      return;
    }
    await saveCheckpoint();
  }
  async function initialize() {
    try {
      await window.SurvivorArt.load();
      storage = await window.SurvivorPersistence.create({ qa: QA });
      applyStored((await storage.read()).record);
      if (storeView.active) validateSnapshot(storeView.active.snapshot);
      ready = true;
      showStart();
      savedMessage();
      if (storeView.lastResult && !storeView.active)
        showResults(storeView.lastResult);
      storage.subscribe(async () => {
        const result = await storage.read();
        if (
          g?.persisted &&
          ["play", "pause", "upgrade"].includes(g.mode) &&
          (result.record.active?.id !== runId ||
            result.record.active.revision !== runRevision) &&
          !saving
        ) {
          runDetached = true;
          pause();
          storageWarning(Error("另一窗口已更新本局，点重试以重新载入"));
        }
        applyStored(result.record);
        if (!g) showStart();
        else if (g.mode === "results") refreshPerks();
      });
    } catch (error) {
      ready = false;
      showStart();
      storageWarning(error);
    }
  }

  canvas.addEventListener("pointerdown", handlePointer);
  canvas.addEventListener("pointermove", handlePointer);
  canvas.addEventListener("pointerup", handlePointer);
  canvas.addEventListener("pointercancel", handlePointer);
  canvas.addEventListener("lostpointercapture", handlePointer);
  window.addEventListener("keydown", (event) => {
    if (!g) return;
    const key = event.key.toLowerCase();
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(key))
      event.preventDefault();
    if (["escape", "p"].includes(key)) {
      if (!event.repeat) {
        if (g.mode === "play") pause();
        else if (g.mode === "pause") void unpause();
      }
      return;
    }
    g.keys[key] = true;
  });
  window.addEventListener("keyup", (event) => {
    if (g) g.keys[event.key.toLowerCase()] = false;
  });
  window.addEventListener("blur", pause);
  window.addEventListener("orientationchange", () => {
    pause();
    resize();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      releaseInput();
      pause();
      void saveCheckpoint();
    }
  });
  window.addEventListener("pagehide", () => {
    releaseInput();
    pause();
    void saveCheckpoint();
  });
  $("startBtn").onclick = reset;
  $("retryBtn").onclick = reset;
  $("continueBtn").onclick = resumeSavedRun;
  $("menuBtn").onclick = () => {
    g = null;
    showStart();
  };
  $("resumeBtn").onclick = unpause;
  $("leaveBtn").onclick = () => finish(false);
  $("pauseBtn").onclick = pause;
  $("upgradeHullBtn").onclick = () => buy("hull");
  $("upgradeGunBtn").onclick = () => buy("gun");
  $("retrySaveBtn").onclick = retrySaving;
  $("upgradeList").onclick = (event) => {
    const button = event.target.closest("[data-pick]");
    if (button) pick(Number(button.dataset.pick));
  };

  window.SurvivorDemo = {
    ready: () => ready,
    state: () => (g ? structuredClone(g) : null),
    profile: () => ({ ...profile }),
    saving: () => saving || actionBusy,
    store: () => (storeView ? structuredClone(storeView) : null),
    artCount: () => window.SurvivorArt.loaded(),
  };
  if (QA)
    window.SurvivorQA = {
      start: reset,
      state: () => g,
      profile: () => profile,
      startModel: (value = 38191, perks = {}) => {
        profile = { credits: 0, best: 0, runs: 0, hull: 0, gun: 0, ...perks };
        resetWorld();
        seed = value >>> 0;
        g.persisted = false;
        return g;
      },
      level: () => {
        if (g) {
          g.level++;
          g.xpNext = levelXP(g.level);
          levelUp();
        }
      },
      pick: (id) => {
        const option = availableUpgrades().find((option) => option.id === id);
        if (!option) return false;
        g.presented = [option];
        g.mode = "upgrade";
        return pick(0, true);
      },
      options: availableUpgrades,
      select: (index) => pick(index, true),
      forceEnemies: (count = 5, type = "skimmer") => {
        for (let index = 0; index < count; index++) spawnEnemy(type);
      },
      enemy: (type, x, y, hp = 1000) => {
        const enemy = spawnEnemy(type);
        if (!enemy) return null;
        Object.assign(enemy, { x, y, hp, maxhp: hp, speed: 0, fire: 999 });
        return enemy.id;
      },
      forceDamage: damageShip,
      step: (seconds) => {
        let remaining = seconds;
        while (remaining > 1e-9 && g?.mode === "play") {
          const dt = Math.min(1 / 60, remaining);
          update(dt);
          remaining -= dt;
        }
      },
      end: finish,
      runRender: render,
      save: saveCheckpoint,
      settled: () => pendingWrite,
      storageName: () => storage?.name,
    };
  resize();
  void initialize();
  raf = requestAnimationFrame(loop);
})();
