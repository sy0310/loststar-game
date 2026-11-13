(function () {
  "use strict";
  const $ = (id) => document.getElementById(id),
    canvas = $("game"),
    ctx = canvas.getContext("2d", { alpha: false });
  ctx.imageSmoothingEnabled = false;
  const B = window.SurvivorBalance;
  const T = 6.28318530718,
    ACTIVE = [
      "cannon",
      "drone",
      "arc",
      "missile",
      "blade",
      "shield",
      "prism",
      "gravity",
    ],
    PASSIVE = [
      "lens",
      "lock",
      "capacitor",
      "cooler",
      "magnet",
      "armor",
      "refraction",
      "singularity",
    ];
  const NAMES = {
    cannon: "脉冲主炮",
    drone: "护航无人机",
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
    prism: "折跃棱镜",
    gravity: "引力锚",
    refraction: "折射晶核",
    singularity: "引力透镜",
    kaleidoscope: "万花星阵",
    collapse: "坍缩星核",
    eventhorizon: "星环奇点",
    ionbastion: "星舰壁垒",
  };

  const DESCS = {
    cannon: "增强齐射火力，自动瞄准近敌",
    drone: "环绕副机，锁定位置后直射",
    arc: "连锁电击，扫开成群目标",
    missile: "直射目标区域，命中范围爆炸",
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
    prism: "晶体环绕，射出折射晶片",
    gravity: "短时吸聚敌群，脉冲粉碎",
    refraction: "晶片命中后折射，提高伤害",
    singularity: "扩大引力范围，延长牵引",
    kaleidoscope: "六晶环阵，多次折射穿梭",
    collapse: "引力收束，中心爆破",
    eventhorizon: "吸聚敌群，旋转折射光环",
    ionbastion: "强化贯穿轨炮，护盾破裂时追加反击",
  };
  const EVO = [
    ["cannon", "lens", "piercebeam"],
    ["drone", "lock", "hunterswarm"],
    ["arc", "capacitor", "chainstorm"],
    ["missile", "cooler", "meteorbarrage"],
    ["blade", "magnet", "spiralsaw"],
    ["shield", "armor", "reactiveaegis"],
    ["prism", "refraction", "kaleidoscope"],
    ["gravity", "singularity", "collapse"],
  ];
  const FUSION = [
    ["drone", "arc", "thunderhive"],
    ["missile", "blade", "blastwheel"],
    ["prism", "gravity", "eventhorizon"],
    ["cannon", "shield", "ionbastion"],
  ];
  const ENEMY_STATS = {
    skimmer: { hp: 32, radius: 16, speed: 112 },
    wisp: { hp: 44, radius: 13, speed: 121 },
    ranger: { hp: 60, radius: 17, speed: 85 },
    tank: { hp: 135, radius: 25, speed: 64 },
    elite: { hp: 470, radius: 32, speed: 90 },
    boss: { hp: 1900, radius: 44, speed: 82 },
    lancer: { hp: 54, radius: 15, speed: 90 },
    sentinel: { hp: 112, radius: 22, speed: 66 },
    minelayer: { hp: 96, radius: 22, speed: 78 },
    courier: { hp: 260, radius: 24, speed: 94 },
    watcher: { hp: 420, radius: 30, speed: 72 },
  };
  const VISITORS = {
    courier: {
      name: "逆向投递员",
      hint: "有份快递，寄件人填了你。",
      tactic: "留意包裹落点",
      result: "退件已拒收 · 零件回收",
    },
    watcher: {
      name: "折光巡游者",
      hint: "未识别舰影，正在描摹你的航迹。",
      tactic: "避开折射光束",
      result: "舰影已散开 · 零件回收",
    },
  };

  const playSound = (id, options) => window.SurvivorAudio?.play(id, options);
  function unlockAudio() {
    // A denied or pending audio gesture must never hold the battle controller.
    const request = window.SurvivorAudio?.unlock();
    request?.catch(() => {
      $("audioStatus").textContent = "声音等待下一次点击";
    });
  }
  function runRules(game = g) {
    return (
      game?.rules || {
        version: "0.6.0",
        runSeconds: game?.endTime || 180,
        activeSlots: 4,
        passiveSlots: 3,
      }
    );
  }
  const newCombat = (game = g) =>
    [2, 3, 4, 5].includes(runRules(game).combatVersion);
  const assaultCombat = (game = g) =>
    [3, 4, 5].includes(runRules(game).combatVersion);
  const showcaseCombat = (game = g) => [4, 5].includes(runRules(game).combatVersion);
  const recoveryCombat = (game = g) => runRules(game).combatVersion === 5;
  const eliteSpec = (enemy, game = g) =>
    (showcaseCombat(game) ? B.showcase : B.assault).eliteProfiles[
      enemy.eliteProfile
    ];
  const bossSpec = (enemy) =>
    B.showcase.bossProfiles[enemy.bossProfile || "core"];
  const newProgression = (game = g) => runRules(game).progressionVersion === 2;
  const activeMaximum = (game = g) => (newProgression(game) ? 5 : 3);
  const passiveMaximum = (game = g) => (newProgression(game) ? 5 : 2);
  const activePower = (id) =>
    newProgression()
      ? B.progression.activePower[g.active[id] || 0]
      : g.active[id] || 0;
  const passivePower = (id) =>
    newProgression()
      ? B.progression.passivePower[g.passive[id] || 0]
      : g.passive[id] || 0;
  function pixelIcon(id, size = 32) {
    return window.SurvivorArt.icon(
      assaultCombat() && id === "prism"
        ? "prism_crystal"
        : id === "repair"
          ? "armor"
          : id === "ionbastion" && !showcaseCombat()
            ? "piercebeam"
            : id,
      size,
    );
  }
  const QA = new URLSearchParams(location.search).has("qa");
  $("qaWatermark").hidden = !QA;
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

  function resetWorld(initialSeed) {
    seed =
      initialSeed ??
      (crypto && crypto.getRandomValues
        ? crypto.getRandomValues(new Uint32Array(1))[0]
        : Date.now()) >>> 0;
    g = {
      mode: "play",
      rules: {
        version: B.version,
        runSeconds: B.runSeconds,
        activeSlots: B.activeSlots,
        passiveSlots: B.passiveSlots,
        combatVersion: 5,
        progressionVersion: 2,
      },
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
      wells: [],
      milestoneSeen: [],
      celebration: null,
      bursts: [],
      salvos: [],
      facing: 0,
      aim: -Math.PI / 2,
      thrust: 0,
      hazards: [],
      encounters: {
        schedule: [
          { at: 165 + Math.floor(rand() * 25), kind: "courier" },
          { at: 380 + Math.floor(rand() * 35), kind: "watcher" },
        ],
        seen: [],
        pending: null,
        active: null,
        log: [],
        notice: null,
      },
      upgradeGrace: 0,
      bossRewards: { ids: [], pending: [] },
      upgradeSource: null,
      linkTimes: {},
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
  function syncAudioState() {
    window.SurvivorAudio?.setState({
      playing: ["play", "upgrade"].includes(g?.mode),
      upgrade: g?.mode === "upgrade",
      paused: document.hidden || ["pause", "loading"].includes(g?.mode),
      phase: g?.wave || 0,
      boss: !!g?.enemy?.some((enemy) => enemy.t === "boss" && enemy.hp > 0),
    });
  }
  function setMode(mode) {
    if (!g) return;
    g.mode = mode;
    syncAudioState();
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
    const curve = assaultCombat()
      ? B.assault.levelXP
      : newProgression()
        ? B.levelXP
        : B.legacyLevelXP;
    return Math.round(
      curve.base +
        curve.linear * growth +
        curve.powerScale * Math.pow(growth, curve.power),
    );
  };
  function availableUpgrades(game = g) {
    if (!game) return [];
    const options = [];
    const activeSlots =
      Object.keys(game.active).length + Object.keys(game.fused).length;
    const consumed = FUSION.filter(([, , id]) => game.fused[id]).flatMap(
      ([a, b]) => [a, b],
    );
    for (const id of ACTIVE) {
      const level = game.active[id] || 0;
      if (
        !consumed.includes(id) &&
        !game.evolved[id] &&
        level < activeMaximum(game) &&
        (level > 0 || activeSlots < runRules(game).activeSlots)
      ) {
        options.push({ id, kind: "active", level: level + 1 });
      }
    }
    for (const id of PASSIVE) {
      const level = game.passive[id] || 0;
      if (
        level < passiveMaximum(game) &&
        (level > 0 ||
          Object.keys(game.passive).length < runRules(game).passiveSlots)
      ) {
        options.push({ id, kind: "passive", level: level + 1 });
      }
    }
    const advancedAllowed =
      !newProgression(game) ||
      (game.upgradeSource?.kind === "boss" &&
        game.upgradeSource.advancedRoll === true);
    for (const [id, passive, evolution] of EVO) {
      if (
        advancedAllowed &&
        game.active[id] === activeMaximum(game) &&
        game.passive[passive] === passiveMaximum(game) &&
        !game.evolved[id]
      ) {
        options.push({ id: evolution, kind: "evo", source: id, level: "MAX" });
      }
    }
    for (const [a, b, id] of FUSION) {
      if (id === "ionbastion" && !newProgression(game)) continue;
      if (
        advancedAllowed &&
        game.active[a] === activeMaximum(game) &&
        game.active[b] === activeMaximum(game) &&
        (newProgression(game)
          ? !!game.evolved[a] && !!game.evolved[b]
          : !game.evolved[a] && !game.evolved[b]) &&
        !game.fused[id]
      ) {
        options.push({ id, kind: "fusion", source: [a, b], level: "FUSION" });
      }
    }
    return options;
  }
  function isLegalUpgrade(option) {
    if (option.kind === "bonus")
      return ["repair", "reserveShield", "salvage"].includes(option.id);
    return availableUpgrades().some(
      (candidate) =>
        candidate.id === option.id &&
        candidate.kind === option.kind &&
        candidate.level === option.level &&
        JSON.stringify(candidate.source) === JSON.stringify(option.source),
    );
  }
  function chooseOptions() {
    const available = availableUpgrades();
    const advanced = available.filter((option) =>
      ["evo", "fusion"].includes(option.kind),
    );
    const picks = newProgression()
      ? advanced.length
        ? [advanced[Math.floor(rand() * advanced.length)]]
        : []
      : advanced.slice(0, 2);
    function add(option) {
      if (
        option &&
        picks.length < 3 &&
        !picks.some((pick) => pick.id === option.id)
      )
        picks.push(option);
    }
    if (runRules().runSeconds > 180 && g.p.hp / g.p.maxhp < 0.35)
      add({ id: "repair", kind: "bonus", level: 0 });
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
      ([a, b, id]) =>
        (newProgression() || id !== "ionbastion") &&
        !g.fused[id] &&
        (g.active[a] || g.active[b]) &&
        (!newProgression() || !g.active[a] || !g.active[b]),
    );
    if (complement && (!newProgression() || rand() < 0.35)) {
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
    if (g.presented?.some((option) => !isLegalUpgrade(option))) reuse = false;
    if (!reuse || !g.presented?.length) g.presented = chooseOptions();
    $("upgradeList").innerHTML = g.presented
      .map((option, index) => {
        const type = {
          active: "主动武器",
          passive: "辅助配件",
          evo: "满级进化",
          fusion: newProgression() ? "终极融合" : "双武器融合",
          bonus: "应急补给",
        }[option.kind];
        const current = g.active[option.id] || g.passive[option.id] || 0;
        const maximum =
          option.kind === "active" ? activeMaximum() : passiveMaximum();
        const rank = ["active", "passive"].includes(option.kind)
          ? "Lv" +
            current +
            " → " +
            (option.level === maximum ? "MAX" : option.level)
          : type;
        const name =
          NAMES[option.id] ||
          {
            repair: "船体修补",
            reserveShield: "应急护盾",
            salvage: "回收零件",
          }[option.id];
        const description =
          (newProgression()
            ? {
                armor: "船体＋5，碰撞减伤提高",
                thunderhive: "六架蜂机，命中连锁放电",
                blastwheel: "八刃环绕，接触触发爆破",
              }[option.id]
            : null) ||
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
        if (option.kind === "evo") {
          const recipe = EVO.find(([, , result]) => result === option.id);
          hint = NAMES[recipe[0]] + " MAX ＋ " + NAMES[recipe[1]] + " MAX";
        } else if (option.kind === "fusion")
          hint = newProgression()
            ? "两件已进化武器 · 合并空出1格"
            : "合并两件武器 · 空出1格";
        else if (pair) {
          const weaponLevel =
            option.id === pair[0] ? option.level : g.active[pair[0]] || 0;
          const passiveLevel =
            option.id === pair[1] ? option.level : g.passive[pair[1]] || 0;
          hint =
            "双满级进化 · " +
            NAMES[pair[0]] +
            " " +
            weaponLevel +
            "/" +
            activeMaximum() +
            " ＋ " +
            NAMES[pair[1]] +
            " " +
            passiveLevel +
            "/" +
            passiveMaximum() +
            (newProgression() ? " · 精英战利品中抽取" : "");
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
      "/" +
      runRules().activeSlots +
      " · 增强 " +
      Object.keys(g.passive).length +
      "/" +
      runRules().passiveSlots;
    const bossReward = g.upgradeSource?.kind === "boss";
    $("upgradeTitle").textContent = bossReward
      ? "精英战利品 · 等级＋1"
      : "等级提升";
    $("upgradeHint").textContent = newProgression()
      ? bossReward
        ? "符合满级条件时，75%机会出现进化／融合"
        : "武器与专属辅助各5级，击退精英抽取进化"
      : "选一项，继续出击";
    const fusion = FUSION.find(
      ([a, b, id]) => !g.fused[id] && (g.active[a] || g.active[b]),
    );
    $("fusionGuide").textContent =
      newProgression() && fusion
        ? NAMES[fusion[0]] +
          " ＋ " +
          NAMES[fusion[1]] +
          " → " +
          NAMES[fusion[2]] +
          " · 两者进化后可融合"
        : "";
  }
  function levelUp(source = null) {
    releaseInput();
    g.upgradeSource = source;
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
    if (!isLegalUpgrade(option)) {
      renderUpgrades();
      notify("装置状态已更新 · 请重新选择");
      return false;
    }
    if (option.kind === "active") g.active[option.id] = option.level;
    else if (option.kind === "passive") {
      g.passive[option.id] = option.level;
      if (option.id === "armor") {
        const increase = newProgression() ? 5 : 12;
        g.p.maxhp += increase;
        g.p.hp += increase;
      }
    } else if (option.kind === "evo") g.evolved[option.source] = option.id;
    else if (option.kind === "fusion") {
      option.source.forEach((id) => {
        delete g.active[id];
        delete g.evolved[id];
      });
      g.fused[option.id] = true;
    } else if (option.id === "repair")
      g.p.hp = Math.min(g.p.maxhp, g.p.hp + 28);
    else if (option.id === "reserveShield") g.p.shield = 1;
    else g.credits += 8;
    g.metrics.events.push({
      kind: option.kind,
      id: option.id,
      time: g.time,
      rewardId: g.upgradeSource?.id || null,
    });
    if (option.kind === "active") g.buildFocus = option.id;
    if (option.kind === "passive") {
      const pair = EVO.find(([, passive]) => passive === option.id);
      if (pair && g.active[pair[0]]) g.buildFocus = pair[0];
    }
    playSound(
      option.kind === "evo"
        ? "evolution"
        : option.kind === "fusion"
          ? "fusion"
          : "upgrade",
    );
    if (["evo", "fusion"].includes(option.kind))
      g.celebration = { kind: option.kind, id: option.id, t: 0.9, max: 0.9 };
    g.presented = [];
    g.upgradeSource = null;
    g.upgradeGrace = 0.4;
    g.p.inv = Math.max(g.p.inv, 0.65);
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
  function queueBossReward(enemy) {
    if (!newProgression() || g.bossRewards.ids.includes(enemy.id)) return;
    g.bossRewards.ids.push(enemy.id);
    g.bossRewards.pending.push({ id: enemy.id, enemy: enemy.t, at: g.time });
  }
  function openBossReward() {
    if (!newProgression() || g.mode !== "play" || !g.bossRewards.pending.length)
      return false;
    const reward = g.bossRewards.pending.shift();
    g.level++;
    g.xpNext = levelXP(g.level);
    levelUp({
      kind: "boss",
      id: reward.id,
      advancedRoll: rand() < B.progression.bossAdvancedChance,
    });
    return true;
  }
  function showLink(id, x, y) {
    if (!newProgression() || g.time < (g.linkTimes[id] || 0)) return;
    g.linkTimes[id] = g.time + 4;
    const label = {
      droneArc: "蜂机 × 电弧",
      pulseArc: "主炮 × 电弧",
      shieldArc: "护盾 × 电弧",
      bladeMissile: "旋刃 × 导弹",
      gravityPrism: "引力 × 棱镜",
      armorBreak: "装甲破裂",
    }[id];
    g.metrics.events.push({ kind: "link", id, time: g.time });
    if (g.texts.length < B.maxDamageNumbers)
      g.texts.push({ x, y: y - 25, t: 1.1, s: label, color: "#73d9e8" });
  }
  function actorId(enemy) {
    if (assaultCombat() && enemy.t === "elite") return eliteSpec(enemy).art;
    if (showcaseCombat() && enemy.t === "boss") return bossSpec(enemy).art;
    return enemy.t;
  }
  function enemyPose(enemy) {
    if (showcaseCombat() && ["boss", "elite"].includes(enemy.t))
      return enemy.facing ?? angle(enemy, g.p) + Math.PI / 2;
    return enemy.t === "boss"
      ? Math.sin(g.time * 0.8) * 0.1
      : (enemy.charge > 0
          ? enemy.chargeAngle
          : enemy.warn > 0
            ? enemy.aim
            : angle(enemy, g.p)) +
          Math.PI / 2;
  }
  function enemyAnchor(enemy, anchor) {
    const body = window.SurvivorArt.catalog[actorId(enemy)];
    if (!anchor || !body) return { x: enemy.x, y: enemy.y };
    const x = (anchor[0] - body.center[0]) * 2;
    const y = (anchor[1] - body.center[1]) * 2;
    const rotation = enemyPose(enemy);
    return {
      x: enemy.x + x * Math.cos(rotation) - y * Math.sin(rotation),
      y: enemy.y + x * Math.sin(rotation) + y * Math.cos(rotation),
    };
  }
  function enemyPort(enemy, index = 0, launcher = false) {
    const body = window.SurvivorArt.catalog[actorId(enemy)];
    const ports = launcher
      ? body?.launcherAnchors || body?.launchAnchors
      : body?.shotNozzles || body?.weaponAnchors || body?.muzzleAnchors;
    return enemyAnchor(enemy, ports?.[index % ports.length]);
  }
  function enemyCircles(enemy) {
    const body = window.SurvivorArt.catalog[actorId(enemy)];
    if (showcaseCombat() && body?.collisionCircles)
      return body.collisionCircles.map((circle) => ({
        ...enemyAnchor(enemy, [circle.x, circle.y]),
        radius: circle.r * 2,
      }));
    return [{ x: enemy.x, y: enemy.y, radius: enemy.radius }];
  }
  function hitsEnemy(enemy, x1, y1, x2, y2, width) {
    return enemyCircles(enemy).some(
      (circle) =>
        segmentDistance(circle, x1, y1, x2, y2) < circle.radius + width,
    );
  }
  function spawnEnemy(
    force,
    tier = 1,
    eliteProfile = "hunter",
    bossProfile = "core",
  ) {
    if (!g) return null;
    const special = force === "boss" || force === "elite" || !!VISITORS[force];
    if (g.enemy.length >= (special ? B.maxEnemies : B.maxEnemies - 2))
      return null;
    let type = force;
    if (!type && newCombat()) {
      const pool = (assaultCombat() ? B.assault.waves : B.combat.waves)
        .filter((entry) => g.time >= entry.from)
        .at(-1).pool;
      type = pool[Math.floor(rand() * pool.length)];
      const cap = B.combat.populationCaps[type];
      if (
        cap &&
        g.enemy.filter((enemy) => enemy.t === type && enemy.hp > 0).length >=
          cap + (assaultCombat() && g.time >= 360 ? 1 : 0)
      )
        type = "skimmer";
    }
    type ||=
      g.time > 24 && rand() < 0.12
        ? "tank"
        : rand() < 0.18
          ? "ranger"
          : rand() < 0.27
            ? "wisp"
            : "skimmer";
    const stats =
      (assaultCombat() && B.assault.enemies[type]) || ENEMY_STATS[type];
    const profile =
      assaultCombat() && type === "elite"
        ? (showcaseCombat() ? B.showcase : B.assault).eliteProfiles[
            eliteProfile
          ]
        : showcaseCombat() && type === "boss"
          ? B.showcase.bossProfiles[bossProfile]
          : null;
    const scale =
      (1 +
        g.time /
          (assaultCombat()
            ? B.assault.healthTimeScale
            : newCombat()
              ? B.combat.healthTimeScale
              : runRules().runSeconds > 180
                ? B.enemyHealthTimeScale
                : 125)) *
      (1 + 0.35 * (tier - 1)) *
      (profile?.hpScale || 1);
    const lateHealth = assaultCombat()
      ? Math.max(0, g.time - B.assault.lateHealthAfter) ** 2 *
        B.assault.lateHealthQuadratic
      : 0;
    const side = Math.floor(rand() * 4),
      ex = VW / 2 + 30,
      ey = VH / 2 + 35;
    const enemy = {
      id: ++g.numberSpawned,
      t: type,
      tier,
      x: g.p.x + (side < 2 ? (side === 0 ? -ex : ex) : rr(-ex, ex)),
      y: g.p.y + (side < 2 ? rr(-ey, ey) : side === 2 ? -ey : ey),
      hp: Math.round(stats.hp * (scale + lateHealth) * (recoveryCombat() && type === "elite" ? B.recovery.eliteHullMultiplier : 1)),
      maxhp: Math.round(stats.hp * (scale + lateHealth) * (recoveryCombat() && type === "elite" ? B.recovery.eliteHullMultiplier : 1)),
      radius: profile?.radius || stats.radius,
      speed: stats.speed * (profile?.speedScale || 1),
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
    if (showcaseCombat() && ["boss", "elite"].includes(type)) {
      enemy.facing = angle(enemy, g.p) + Math.PI / 2;
      if (type === "boss") enemy.bossProfile = bossProfile;
      if (eliteProfile === "hive" && type === "elite") enemy.summonsLeft = 4;
    }
    if (profile && type === "elite") {
      enemy.eliteProfile = eliteProfile;
      enemy.barrier = Math.round(enemy.maxhp * profile.barrier);
      enemy.maxBarrier = enemy.barrier;
    }
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
      if (n >= range * range) continue;
      const special = ["boss", "elite"].includes(e.t) || VISITORS[e.t];
      const score = newProgression() && special ? n * 0.25 : n;
      if (score < d2) {
        d2 = score;
        best = e;
      }
    }
    return best;
  }
  function fireBullet(
    x,
    y,
    target,
    kind = "pulse",
    damage = 19,
    speed = 305,
    properties = {},
  ) {
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
      ...(assaultCombat()
        ? {
            homing:
              kind === "hive" ||
              (kind === "drone" && !!g.evolved.drone) ||
              (kind === "missile" && !!g.evolved.missile),
            destinationX: target.x,
            destinationY: target.y,
            evolvedAtLaunch:
              kind === "hive" ||
              !!g.evolved[kind === "pulse" ? "cannon" : kind],
            ...properties,
          }
        : {}),
      pierce: kind === "pulse" ? 1 + Math.min(1, g.passive.lens || 0) : 1,
    };
    g.shots.push(shot);
    playSound(kind === "pulse" ? "cannon" : kind === "hive" ? "drone" : kind, {
      evolved:
        kind === "hive" || !!g.evolved[kind === "pulse" ? "cannon" : kind],
      fused: kind === "hive",
    });
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
    playSound("arc", { evolved: sourceKind !== "arc" });
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
          ...(assaultCombat()
            ? {
                color:
                  sourceKind === "thunderhive"
                    ? "#bc85f2"
                    : g.evolved.arc
                      ? "#c49bef"
                      : g.active.arc >= 3
                        ? "#f4c57a"
                        : "#73d9e8",
                core: sourceKind === "thunderhive" ? "#ffe5a1" : "#fff0ce",
              }
            : {}),
        });
      hurtEnemy(target, damage, false, sourceKind);
      const stunScale =
        assaultCombat() && ["elite", "boss"].includes(target.t)
          ? B.assault.eliteStunScale
          : 1;
      target.disabled = Math.max(target.disabled, stun * stunScale);
      excluded.add(target);
      origin = target;
    }
    if (["droneArc", "pulseArc", "shieldArc"].includes(sourceKind))
      showLink(sourceKind, x, y);
  }
  function hurtEnemy(enemy, amount, mark = false, source = "pulse") {
    if (enemy.hp <= 0) return;
    if (newProgression() && VISITORS[enemy.t] && (enemy.arrivalAge || 0) < 1.6)
      return;
    let damage = Math.max(1, amount * (1 + 0.13 * passivePower("lens")));
    if (assaultCombat() && ["elite", "boss"].includes(enemy.t)) {
      damage *=
        1 -
        (enemy.t === "boss"
          ? B.assault.bossDamageResistance
          : B.assault.eliteDamageResistance);
      if (enemy.barrier > 0) {
        const absorbed = Math.min(enemy.barrier, damage * 0.7);
        enemy.barrier -= absorbed;
        damage -= absorbed;
        g.metrics.armorAbsorbed = (g.metrics.armorAbsorbed || 0) + absorbed;
        if (enemy.barrier === 0) {
          ring(enemy.x, enemy.y, 56, "#f4c57a", 0.45);
          showLink("armorBreak", enemy.x, enemy.y);
        }
      }
    }
    const actual = Math.min(enemy.hp, damage);
    playSound("hit", { strength: damage / 120 });
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
    playSound("explosion", { strength: enemy.t === "boss" ? 1 : 0.4 });
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
    if (runRules().runSeconds > 180 && ["boss", "elite"].includes(enemy.t)) {
      // Reserve the repair pack even when the field is full. Merge the displaced
      // ordinary pickup's value into the same resource type without losing XP/cash.
      if (recoveryCombat() && g.pickups.length >= B.maxPickups) {
        const index = g.pickups.findIndex((pickup) => pickup.type !== "heal" &&
          g.pickups.some((other) => other !== pickup && other.type === pickup.type));
        if (index >= 0) {
          const displaced = g.pickups[index];
          g.pickups.find((pickup, i) => i !== index && pickup.type === displaced.type).value += displaced.value;
          g.pickups.splice(index, 1);
        } else {
          // A field already full of repair packs keeps their full combined value.
          g.pickups[0].value += enemy.t === "boss" ? B.recovery.bossRepair : B.recovery.eliteRepair;
        }
      }
      if (g.pickups.length < B.maxPickups)
        g.pickups.push({
          x: enemy.x,
          y: enemy.y,
          type: "heal",
          value: recoveryCombat()
            ? enemy.t === "boss" ? B.recovery.bossRepair : B.recovery.eliteRepair
            : enemy.t === "boss" ? 24 : 12,
          t: 40,
        });
    }
    if (VISITORS[enemy.t]) {
      // An event's only payout uses the same per-enemy death/receipt path.
      // Re-entering its banner or restoring a checkpoint cannot pay it again.
      const visitor = VISITORS[enemy.t];
      g.encounters.log.push({
        kind: enemy.t,
        result: "repelled",
        time: g.time,
      });
      g.encounters.active = null;
      g.encounters.notice = {
        title: visitor.name,
        text: visitor.result,
        until: g.time + 7,
      };
      g.metrics.events.push({
        kind: "encounterResult",
        visitor: enemy.t,
        result: "repelled",
        time: g.time,
      });
      if (g.pickups.length >= B.maxPickups) {
        const replace = g.pickups.findIndex(
          (pickup) =>
            pickup.type === "xp" ||
            (pickup.type === "scrap" && pickup.value < 12),
        );
        g.pickups.splice(Math.max(0, replace), 1);
      }
      g.pickups.push({
        x: enemy.x,
        y: enemy.y,
        type: "scrap",
        value: 12,
        t: 40,
      });
      notify(visitor.result);
    } else if (enemy.t === "boss") {
      g.bossKilled = true;
      g.metrics.events.push({ kind: "bossDefeated", time: g.time });
      notify("守卫已击退！");
    } else if (enemy.t === "elite") notify("精英击退 · 能量散落");
    if (["boss", "elite"].includes(enemy.t)) queueBossReward(enemy);
  }
  function damageShip(amount) {
    if (!g || g.mode !== "play" || g.p.inv > 0) return;
    if (assaultCombat()) amount *= 1 + Math.max(0, g.time - 300) / 1800;
    if (g.p.shield > 0) {
      g.p.shield = 0;
      g.metrics.shieldsBlocked++;
      playSound("shield", {
        evolved: !!g.evolved.shield || !!g.fused.ionbastion,
        fused: !!g.fused.ionbastion,
      });
      const evolved = !!g.evolved.shield || !!g.fused.ionbastion;
      g.p.shieldCooldown =
        (evolved ? 4.5 : 12 - (activePower("shield") || 1) * 1.5) *
        (1 - 0.12 * passivePower("armor"));
      ring(g.p.x, g.p.y, evolved ? 112 : 63, "#73d9e8", 0.35);
      if (evolved) {
        for (const enemy of g.enemy)
          if (dist(enemy, g.p) < 112 + enemy.radius) {
            hurtEnemy(
              enemy,
              g.fused.ionbastion ? 85 : 58,
              false,
              g.fused.ionbastion ? "ionbastion" : "reactiveaegis",
            );
            enemy.disabled = 0.4;
          }
        if (g.fused.ionbastion) {
          const target = closest(g.p.x, g.p.y, 660);
          if (target) beamAttack(target, 170, "ionbastion");
        }
      } else if (g.active.arc || g.fused.thunderhive)
        chain(g.p.x, g.p.y, 3, 22, 165, null, "shieldArc");
      g.p.inv = 0.5;
      return;
    }
    const damage = amount * (1 - 0.08 * passivePower("armor"));
    g.p.hp = Math.max(0, g.p.hp - damage);
    g.metrics.shipDamage += damage;
    playSound("hurt");
    g.p.inv = 0.85;
    particle(g.p.x, g.p.y, "#ff7597", 8, 100);
    if (g.p.hp <= 0) {
      updateHud();
      void finish(false);
    }
  }
  function cooldown(id, base) {
    let r = base * (1 - 0.115 * passivePower("cooler"));
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
  function prismRay(
    heading,
    length,
    damage,
    source,
    width = 5,
    destination = null,
  ) {
    if (assaultCombat()) {
      const node = prismNodes()[0];
      if (node)
        fireCrystal(
          node,
          destination || {
            x: g.p.x + Math.cos(heading) * length,
            y: g.p.y + Math.sin(heading) * length,
          },
          damage,
          source,
        );
      return;
    }
    const x = g.p.x + Math.cos(heading) * length,
      y = g.p.y + Math.sin(heading) * length;
    g.beams.push({
      x1: g.p.x,
      y1: g.p.y,
      x2: x,
      y2: y,
      t: 0.2,
      kind: source,
      width,
    });
    if (g.beams.length > 12) g.beams.shift();
    g.metrics.shots[source] = (g.metrics.shots[source] || 0) + 1;
    for (const enemy of g.enemy)
      if (enemy.hp > 0 && hitsEnemy(enemy, g.p.x, g.p.y, x, y, width))
        hurtEnemy(enemy, damage, false, source);
  }
  function prismNodes() {
    if (!g.active.prism && !g.fused.eventhorizon) return [];
    const evolved = !!g.evolved.prism || !!g.fused.eventhorizon;
    const count = evolved ? 6 : Math.max(1, g.active.prism || 1);
    const radius = showcaseCombat()
      ? evolved
        ? 51
        : 40 + Math.min(5, g.passive.refraction || 0)
      : evolved
        ? 66
        : 42 + (g.passive.refraction || 0) * 2;
    return Array.from({ length: count }, (_, index) => {
      const heading = g.time * 0.65 + (index * T) / count;
      return {
        x: g.p.x + Math.cos(heading) * radius,
        y: g.p.y + Math.sin(heading) * radius,
        heading,
      };
    });
  }
  function droneNodes() {
    const count = g.fused.thunderhive
      ? newProgression()
        ? 6
        : 5
      : g.evolved.drone
        ? 4
        : Math.ceil(activePower("drone"));
    return Array.from({ length: count }, (_, index) => {
      const heading =
        g.time * (showcaseCombat() ? -0.75 : 1.6) + (index * T) / count;
      return {
        x: g.p.x + Math.cos(heading) * (recoveryCombat() ? B.recovery.droneOrbit[0] : showcaseCombat() ? 130 : 47),
        y: g.p.y + Math.sin(heading) * (recoveryCombat() ? B.recovery.droneOrbit[1] : showcaseCombat() ? 114 : 47),
        heading,
      };
    });
  }
  function fireCrystal(origin, target, damage, source) {
    if (!target || g.shots.length >= B.maxFriendlyShots) return;
    const heading = angle(origin, target);
    const evolved = !!g.evolved.prism || !!g.fused.eventhorizon;
    g.shots.push({
      x: origin.x,
      y: origin.y,
      vx: Math.cos(heading) * 520,
      vy: Math.sin(heading) * 520,
      damage,
      kind: "crystal",
      source,
      r: evolved ? 7 : 5,
      t: 2.2,
      hit: new Set(),
      pierce: 1,
      bounces: evolved ? 4 : Math.ceil((g.passive.refraction || 0) / 2),
    });
    g.metrics.shots[source] = (g.metrics.shots[source] || 0) + 1;
    if (g.arcs.length < B.maxArcs)
      g.arcs.push({
        x1: g.p.x,
        y1: g.p.y,
        x2: origin.x,
        y2: origin.y,
        t: 0.12,
        color: evolved ? "#f4c57a" : "#b9a1e8",
        core: "#f5dff7",
      });
  }
  function prismArray(dt, fused) {
    const evolved = !!g.evolved.prism;
    clock(
      "prism",
      dt,
      cooldown("prism", fused ? 1.2 : evolved ? 1.45 : 1.9),
      () => {
        const nodes = prismNodes();
        const targets = g.enemy
          .filter((enemy) => enemy.hp > 0 && dist(enemy, g.p) < 390)
          .sort((a, b) => dist(a, g.p) - dist(b, g.p));
        if (!targets.length) return;
        const damage =
          (30 + 30 * (activePower("prism") || 3)) *
          (1 + 0.1 * passivePower("refraction")) *
          (fused ? 1.25 : 1);
        const source = fused
          ? "eventhorizon"
          : evolved
            ? "kaleidoscope"
            : "prism";
        for (let index = 0; index < nodes.length; index++)
          fireCrystal(
            nodes[index],
            targets[index % targets.length],
            damage,
            source,
          );
        g.prismFlashUntil = g.time + 0.18;
        playSound("prism", { evolved, fused });
      },
    );
  }
  function advancedWeapons(dt) {
    g.wells ||= [];
    const fused = !!g.fused.eventhorizon;
    if (assaultCombat() && (g.active.prism || fused)) prismArray(dt, fused);
    else if (g.active.prism || fused) {
      const level = activePower("prism") || 3,
        evolved = !!g.evolved.prism;
      clock(
        "prism",
        dt,
        cooldown("prism", fused ? 1.1 : evolved ? 1.3 : 2.4 - 0.2 * level),
        () => {
          const target = closest(g.p.x, g.p.y, 500);
          if (!target) return;
          const targets = g.enemy
            .filter((enemy) => enemy.hp > 0 && dist(enemy, g.p) < 520)
            .sort((a, b) => dist(a, g.p) - dist(b, g.p));
          const heading = angle(g.p, target),
            count =
              fused && newProgression()
                ? 8
                : fused || evolved
                  ? 6
                  : Math.ceil(level + 1);
          playSound("prism", { evolved, fused });
          for (let i = 0; i < count; i++)
            prismRay(
              targets[i]
                ? angle(g.p, targets[i])
                : heading + (i * T) / count + g.time * 0.2,
              520,
              (24 + 28 * level) *
                (1 + 0.1 * passivePower("refraction")) *
                (fused && newProgression() ? 1.25 : 1),
              fused ? "eventhorizon" : evolved ? "kaleidoscope" : "prism",
              (evolved ? 7 : 5) + passivePower("refraction") * 1.5,
            );
          const well = g.wells.find((item) => item.t > 0);
          if (newProgression() && !fused && g.active.gravity && well) {
            prismRay(angle(g.p, well), 560, 32 + 12 * level, "gravityPrism", 8);
            showLink("gravityPrism", well.x, well.y);
          }
        },
      );
    }
    if (g.active.gravity || fused) {
      const level = activePower("gravity") || 3,
        evolved = !!g.evolved.gravity;
      clock(
        "gravity",
        dt,
        cooldown("gravity", fused ? 3.4 : evolved ? 3.6 : 5.2 - 0.35 * level),
        () => {
          const target = closest(g.p.x, g.p.y, 430);
          if (!target || g.wells.length >= 3) return;
          const distance = dist(g.p, target),
            heading = angle(g.p, target);
          const center = {
            x: g.p.x + Math.cos(heading) * Math.max(100, distance),
            y: g.p.y + Math.sin(heading) * Math.max(100, distance),
          };
          const duration =
            (evolved || fused ? 2.4 : 1.5) + 0.2 * passivePower("singularity");
          if (g.arcs.length < B.maxArcs)
            g.arcs.push({
              x1: g.p.x,
              y1: g.p.y,
              x2: center.x,
              y2: center.y,
              t: 0.22,
              color: "#b9a1e8",
            });
          g.wells.push({
            x: center.x,
            y: center.y,
            t: duration,
            max: duration,
            born: g.time,
            radius:
              (evolved || fused ? 128 : 85) +
              level * 7 +
              passivePower("singularity") * 15,
            clock: 0,
            damage: (18 + level * 9) * (fused && newProgression() ? 1.35 : 1),
            evolved,
            fused,
            level,
          });
          blast(
            center.x,
            center.y,
            ((evolved || fused ? 128 : 85) + level * 7) * 0.75,
            25 + level * 18,
            "#a795db",
            fused ? "eventhorizon" : evolved ? "collapse" : "gravity",
          );
          playSound("gravity", { evolved, fused });
          if (newProgression() && !fused && g.active.prism) {
            prismRay(
              angle(g.p, center),
              560,
              32 + 12 * activePower("prism"),
              "gravityPrism",
              8,
              center,
            );
            showLink("gravityPrism", center.x, center.y);
          }
        },
      );
    }
    for (const well of g.wells) {
      well.t -= dt;
      well.clock -= dt;
      const pulse = well.clock <= 0;
      if (pulse) well.clock = 0.3;
      for (const enemy of g.enemy) {
        const distance = Math.hypot(enemy.x - well.x, enemy.y - well.y);
        if (enemy.hp <= 0 || distance >= well.radius) continue;
        const pull = Math.min(
          distance,
          dt *
            (["boss", "elite"].includes(enemy.t)
              ? 18
              : well.evolved || well.fused
                ? 115
                : 75),
        );
        if (distance > 0) {
          enemy.x += ((well.x - enemy.x) / distance) * pull;
          enemy.y += ((well.y - enemy.y) / distance) * pull;
        }
        enemy.gravitySlow = Math.max(
          enemy.gravitySlow || 0,
          ["boss", "elite"].includes(enemy.t) ? 0.08 : 0.35,
        );
        if (pulse)
          hurtEnemy(
            enemy,
            well.damage,
            false,
            well.fused ? "eventhorizon" : well.evolved ? "collapse" : "gravity",
          );
      }
      if (well.t <= 0 && (well.evolved || well.fused)) {
        playSound("gravity", { evolved: true, strength: 0.7 });
        burst(well.x, well.y, "gravity_burst", well.radius / 48);
        blast(
          well.x,
          well.y,
          well.radius,
          95,
          "#b9a1e8",
          well.fused ? "eventhorizon" : "collapse",
        );
      }
    }
    g.wells = g.wells.filter((well) => well.t > 0);
  }
  function weapons(dt) {
    const player = g.p;
    advancedWeapons(dt);
    if (g.active.cannon || g.fused.ionbastion) {
      const level = activePower("cannon") || 3;
      const rail = !!g.evolved.cannon || !!g.fused.ionbastion;
      clock(
        "cannon",
        dt,
        cooldown(
          "cannon",
          g.fused.ionbastion
            ? assaultCombat()
              ? B.assault.bastionInterval
              : 0.28
            : rail
              ? assaultCombat()
                ? B.assault.railInterval
                : 0.34
              : 0.54 - (level - 1) * 0.1,
        ),
        () => {
          const target = closest(player.x, player.y, rail ? 660 : 465);
          if (!target) return;
          g.aim = angle(player, target);
          if (rail)
            beamAttack(
              target,
              (g.fused.ionbastion ? 150 : 128) + profile.gun * 5,
              g.fused.ionbastion ? "ionbastion" : "piercebeam",
            );
          else
            for (let index = 0; index < Math.ceil(level); index++) {
              const offset = (index - (Math.ceil(level) - 1) / 2) * 9;
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
      const level = activePower("drone") || 3;
      const interval =
        (g.fused.thunderhive ? 0.39 : g.evolved.drone ? 0.55 : 0.87) *
        (1 - 0.08 * passivePower("lock"));
      clock("drone", dt, cooldown("drone", interval), () => {
        for (const origin of droneNodes()) {
          const marked = g.enemy.find(
            (enemy) =>
              enemy.hp > 0 && enemy.marked > 0 && dist(enemy, origin) < 460,
          );
          const target =
            marked ||
            closest(origin.x, origin.y, 440 + passivePower("lock") * 25);
          if (target)
            fireBullet(
              origin.x,
              origin.y,
              target,
              g.fused.thunderhive ? "hive" : "drone",
              (18 + level * 12) *
                (1 + 0.08 * passivePower("lock")) *
                (g.fused.thunderhive && newProgression() ? 1.25 : 1),
              345,
            );
        }
      });
    }
    if (g.active.arc) {
      const level = activePower("arc"),
        evolved = !!g.evolved.arc,
        capacitor = passivePower("capacitor");
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
      const level = activePower("missile"),
        evolved = !!g.evolved.missile;
      clock(
        "missile",
        dt,
        cooldown("missile", evolved ? 0.9 : 2.25 - 0.3 * level),
        () => {
          const target = assaultCombat()
            ? closest(player.x, player.y, 400)
            : null;
          if (assaultCombat() && !target) return;
          const count = evolved ? 4 : Math.max(1, Math.ceil(level - 1));
          for (let index = 0; index < count; index++) {
            const offset =
              !evolved && target ? (index - (count - 1) / 2) * 18 : 0;
            const heading = target ? angle(player, target) : 0;
            if (g.salvos.length < 8)
              g.salvos.push({
                delay: evolved
                  ? index * 0.1
                  : assaultCombat()
                    ? index * 0.12
                    : 0,
                damage: 23 + 12 * level,
                evolved,
                ...(target
                  ? {
                      destination: {
                        id: target.id,
                        x: target.x - Math.sin(heading) * offset,
                        y: target.y + Math.cos(heading) * offset,
                      },
                    }
                  : {}),
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
          salvo.destination || closest(player.x, player.y, 540),
          "missile",
          salvo.damage,
          270,
          { homing: salvo.evolved, evolvedAtLaunch: salvo.evolved },
        );
        salvo.fired = true;
      }
    }
    g.salvos = g.salvos.filter((salvo) => !salvo.fired);
    if (g.active.blade || g.fused.blastwheel) {
      const level = activePower("blade") || 3;
      const count = g.fused.blastwheel
        ? newProgression()
          ? 8
          : 6
        : g.evolved.blade
          ? 5
          : Math.ceil(level + 1);
      const radius = g.evolved.blade || g.fused.blastwheel ? 78 : 48;
      for (const enemy of g.enemy) {
        if (enemy.hp <= 0 || enemy.bladeAt > g.time) continue;
        for (let index = 0; index < count; index++) {
          const heading = g.time * 2.7 + (index * T) / count;
          const x = player.x + Math.cos(heading) * radius,
            y = player.y + Math.sin(heading) * radius;
          if (Math.hypot(enemy.x - x, enemy.y - y) < enemy.radius + 11) {
            enemy.bladeAt = g.time + (g.evolved.blade ? 0.2 : 0.26);
            playSound("blade", {
              evolved: !!g.evolved.blade,
              fused: !!g.fused.blastwheel,
            });
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
    if (g.active.shield || g.fused.ionbastion) {
      g.p.shieldCooldown = Math.max(0, g.p.shieldCooldown - dt);
      if (g.p.shield === 0 && g.p.shieldCooldown === 0) g.p.shield = 1;
    }
  }
  function wave(dt) {
    if (runRules().runSeconds > 180) {
      const milestones = showcaseCombat()
        ? B.showcase.milestones
        : assaultCombat()
          ? B.assault.milestones
          : newProgression()
            ? B.progression.milestones
            : B.milestones;
      for (const milestone of milestones) {
        const key = milestone.type + ":" + milestone.at;
        if (g.time < milestone.at || g.milestoneSeen.includes(key)) continue;
        const existing = g.enemy.find(
          (enemy) => enemy.t === milestone.type && enemy.hp > 0,
        );
        if (existing) {
          if (newProgression()) continue;
          existing.tier = Math.max(existing.tier || 1, milestone.tier);
          existing.fire = Math.min(existing.fire, 0.3);
        } else if (
          !spawnEnemy(
            milestone.type,
            milestone.tier,
            milestone.profile,
            milestone.bossProfile,
          )
        )
          continue;
        g.milestoneSeen.push(key);
        g.metrics.events.push({
          kind: milestone.type,
          time: g.time,
          tier: milestone.tier,
          ...(showcaseCombat()
            ? { identity: milestone.bossProfile || milestone.profile }
            : {}),
        });
        if (milestone.type === "boss") {
          g.bossSpawned = true;
          playSound("boss");
          notify(
            showcaseCombat()
              ? B.showcase.bossProfiles[milestone.bossProfile || "core"].name +
                  " · 来袭"
              : milestone.tier === 3
                ? "最终守卫 · 深空合围"
                : milestone.tier === 2
                  ? "第二守卫 · 火力升阶"
                  : "星海守卫者 · 来袭",
          );
        } else {
          g.eliteSpawned = true;
          notify(
            assaultCombat()
              ? (showcaseCombat() ? B.showcase : B.assault).eliteProfiles[
                  milestone.profile
                ].name + " · 来袭"
              : "追猎者 · 第" + milestone.tier + "阶段",
          );
        }
      }
    } else {
      if (g.time >= 130 && !g.bossSpawned) {
        if (spawnEnemy("boss")) {
          g.bossSpawned = true;
          g.metrics.events.push({ kind: "boss", time: g.time });
          notify("星海守卫者 · 来袭");
          playSound("boss");
        }
      }
      if (g.time >= 70 && !g.eliteSpawned) {
        if (spawnEnemy("elite")) {
          g.eliteSpawned = true;
          g.metrics.events.push({ kind: "elite", time: g.time });
          notify("反应堆追猎者 · 接近");
        }
      }
    }
    if (g.time >= 48 && !g.anomalySeen) {
      g.anomalySeen = true;
      g.anomalyTime = 9;
      notify("碎星回波 · 敌群正在集结");
    }
    g.spawnTime -= dt;
    if (g.spawnTime <= 0) {
      const count =
        g.time > 420
          ? 6
          : g.time > 240
            ? 5
            : g.time > 115
              ? 4
              : g.time > 55
                ? 3
                : g.time > 12
                  ? 2
                  : 1;
      for (let index = 0; index < count; index++) spawnEnemy();
      g.spawnTime =
        Math.max(0.46, 1.05 - g.time * 0.0033) *
        (newCombat() ? B.combat.spawnIntervalScale : 1) *
        (assaultCombat() && g.time < 180 ? B.assault.earlySpawnScale : 1);
    }
    if (newCombat()) updateEncounters(dt);
  }
  function updateEncounters(dt) {
    const events = g.encounters;
    if (events.active) {
      const visitor = g.enemy.find(
        (enemy) => enemy.id === events.active.id && enemy.hp > 0,
      );
      if (visitor && g.time >= events.active.until) {
        visitor.hp = 0;
        events.log.push({ kind: visitor.t, result: "departed", time: g.time });
        events.notice = {
          title: VISITORS[visitor.t].name,
          text: "舰影离去 · 继续航行",
          until: g.time + 6,
        };
        g.metrics.events.push({
          kind: "encounterResult",
          visitor: visitor.t,
          result: "departed",
          time: g.time,
        });
        events.active = null;
      }
      return;
    }
    if (events.pending) {
      events.pending.remaining -= dt;
      if (events.pending.remaining <= 0) {
        const enemy = spawnEnemy(events.pending.kind);
        if (!enemy) return;
        if (newProgression()) {
          enemy.x = g.p.x + (enemy.t === "courier" ? -1 : 1) * VW * 0.3;
          enemy.y = g.p.y - Math.min(100, VH * 0.13);
          enemy.arrivalAge = 0;
          enemy.hp *= 2.5;
          enemy.maxhp = enemy.hp;
          enemy.fire = 1.7;
        }
        events.active = { kind: enemy.t, id: enemy.id, until: g.time + 42 };
        events.pending = null;
        g.metrics.events.push({
          kind: "encounterArrival",
          visitor: enemy.t,
          time: g.time,
        });
      }
      return;
    }
    const next = events.schedule.find(
      (entry) => !events.seen.includes(entry.kind) && g.time >= entry.at,
    );
    if (!next) return;
    events.seen.push(next.kind);
    events.pending = { kind: next.kind, remaining: 2.2 };
    events.notice = null;
    playSound("boss", { strength: 0.45 });
    notify("异常航迹 · " + VISITORS[next.kind].name);
    g.metrics.events.push({
      kind: "encounterWarning",
      visitor: next.kind,
      time: g.time,
    });
  }
  function update(dt) {
    if (!g || g.mode !== "play") return;
    if (g.time >= runRules().runSeconds) {
      void finish(true);
      return;
    }
    dt = Math.min(dt, runRules().runSeconds - g.time);
    g.time += dt;
    if (g.time >= runRules().runSeconds) {
      updateHud(true);
      void finish(true);
      return;
    }
    g.wave = Math.min(
      runRules().runSeconds > 180 ? 5 : 4,
      Math.floor(g.time / (runRules().runSeconds > 180 ? 120 : 45)) + 1,
    );
    if (g.celebration) {
      g.celebration.t -= dt;
      if (g.celebration.t <= 0) g.celebration = null;
    }
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
    if (newCombat()) updateHazards(dt);
    if (g.mode !== "play") return;
    if (openBossReward()) {
      updateHud(true);
      return;
    }
    const siegeDetonations = [];
    for (const shot of g.enemyShots) {
      const previousX = shot.x,
        previousY = shot.y;
      if (shot.turn) {
        const heading = Math.atan2(shot.vy, shot.vx) + shot.turn * dt;
        const speed = Math.hypot(shot.vx, shot.vy);
        shot.vx = Math.cos(heading) * speed;
        shot.vy = Math.sin(heading) * speed;
      }
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.t -= dt;
      if (
        shot.kind === "siege" &&
        (shot.t <= 0 ||
          segmentDistance(
            { x: shot.destinationX, y: shot.destinationY },
            previousX,
            previousY,
            shot.x,
            shot.y,
          ) < 5)
      ) {
        siegeDetonations.push({ x: shot.destinationX, y: shot.destinationY });
        shot.t = 0;
        continue;
      }
      if (
        segmentDistance(g.p, previousX, previousY, shot.x, shot.y) <
        10 + (shot.radius || 2)
      ) {
        damageShip(shot.damage || 8);
        shot.t = 0;
        if (shot.kind === "siege")
          siegeDetonations.push({ x: shot.x, y: shot.y });
      }
      if (g.mode !== "play") return;
    }
    g.enemyShots = g.enemyShots.filter((shot) => shot.t > 0);
    for (const origin of siegeDetonations) {
      g.metrics.shots["hostile-siege-detonation"] =
        (g.metrics.shots["hostile-siege-detonation"] || 0) + 1;
      burst(origin.x, origin.y, "explosion", 1.8);
      ring(origin.x, origin.y, 32, "#f4c57a", 0.3);
      if (dist(origin, g.p) < 32) damageShip(9);
      for (let index = 0; index < 6; index++)
        hostileShot(origin, (index * T) / 6, 105, {
          t: 1.8,
          color: "#f4c57a",
          damage: 8,
        });
    }
    const attraction =
      150 + passivePower("magnet") * 55 + (g.evolved.blade ? 65 : 0);
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
        if (pickup.type === "xp") {
          playSound("pickup");
          awardXP(pickup.value);
        } else if (pickup.type === "heal") {
          const restored = Math.min(pickup.value, g.p.maxhp - g.p.hp);
          g.p.hp += restored;
          if (recoveryCombat()) {
            ring(g.p.x, g.p.y, 36, "#a5edb8", 0.55);
            if (g.texts.length >= B.maxDamageNumbers) g.texts.shift();
            g.texts.push({x: g.p.x, y: g.p.y - 28, t: 1.3,
              s: restored > 0 ? "船体 +" + Math.round(restored) : "船体已满", color: "#a5edb8"});
          }
          playSound("heal");
        } else {
          g.credits += pickup.value;
          playSound("scrap");
        }
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
    if (g.mode === "play" && g.time >= runRules().runSeconds) void finish(true);
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
    ctx.fillStyle = "#0b1024";
    ctx.fillRect(0, 0, VW, VH);
    const ox = g ? g.camera.x : 0,
      oy = g ? g.camera.y : 0;
    const backdrop = window.SurvivorArt.catalog.deep_space;
    if (backdrop) {
      const reduced = window.matchMedia?.(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      window.SurvivorArt.draw(
        ctx,
        "deep_space",
        VW / 2 + (reduced ? 0 : Math.sin(ox / 950) * 8),
        VH / 2 + (reduced ? 0 : Math.sin(oy / 1200) * 10),
        {
          scale: Math.max(
            (VW + 24) / backdrop.nativeSize[0],
            (VH + 28) / backdrop.nativeSize[1],
          ),
        },
      );
    }
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
  }
  function drawShip() {
    if (!g) return;
    const position = toScreen(g.p.x, g.p.y);
    const actor = window.SurvivorArt.catalog.player;
    const frame = window.SurvivorArt.frameAt("thruster", g.time * 1000, true);
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
    const bastion = showcaseCombat() && g.fused.ionbastion;
    window.SurvivorArt.draw(
      ctx,
      bastion ? "bastion_mount" : "cannon",
      position.x,
      position.y - 1,
      {
        angle: g.aim + Math.PI / 2,
        scale: bastion
          ? 1.6
          : showcaseCombat() && g.evolved.cannon
            ? 1.05
            : 0.55,
      },
    );
    if (bastion) {
      const charge =
        1 - clamp((g.attackClock.cannon || 0) / cooldown("cannon", 0.9), 0, 1);
      ctx.save();
      ctx.translate(position.x, position.y - 1);
      ctx.rotate(g.aim + Math.PI / 2);
      for (const side of [-1, 1]) {
        ctx.fillStyle = "#b694d9";
        ctx.fillRect(side * 20 - 2, 8, 4, 9);
        ctx.fillStyle = "#fff0ce";
        ctx.fillRect(
          side * 20 - 1,
          17 - Math.round(charge * 9),
          2,
          Math.max(1, Math.round(charge * 9)),
        );
      }
      ctx.restore();
    }
    if (g.p.shield > 0) {
      const radius =
        showcaseCombat() && g.fused.ionbastion
          ? 45
          : g.evolved.shield
            ? showcaseCombat()
              ? 41
              : 35
            : 29;
      ctx.strokeStyle = g.evolved.shield ? "#d4f6ed" : "#73d9e8";
      ctx.lineWidth =
        showcaseCombat() && (g.evolved.shield || g.fused.ionbastion) ? 4 : 2;
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
        {
          scale:
            showcaseCombat() && (g.evolved.shield || g.fused.ionbastion)
              ? 1
              : 0.6,
        },
      );
    }
  }
  function render() {
    background();
    if (!g || !window.SurvivorArt.loaded()) return;
    const art = window.SurvivorArt;
    for (const pickup of g.pickups) {
      const point = toScreen(pickup.x, pickup.y);
      if (recoveryCombat() && pickup.type === "heal") {
        ctx.fillStyle = "#18382f";
        ctx.fillRect(point.x - 12, point.y - 12, 24, 24);
        ctx.strokeStyle = "#a5edb8";
        ctx.lineWidth = 2;
        ctx.strokeRect(point.x - 12, point.y - 12, 24, 24);
      }
      art.draw(
        ctx,
        pickup.type === "xp"
          ? "xp_crystal"
          : pickup.type === "heal"
            ? "shield_piece"
            : "scrap",
        point.x,
        point.y,
        { scale: recoveryCombat() && pickup.type === "heal" ? 1 : 0.6 },
      );
      if (recoveryCombat() && pickup.type === "heal") {
        ctx.fillStyle = "#e6ffe8";
        ctx.fillRect(point.x - 2, point.y - 7, 4, 14);
        ctx.fillRect(point.x - 7, point.y - 2, 14, 4);
      }
    }
    drawHazards();
    for (const enemy of g.enemy) {
      if (enemy.hp <= 0) continue;
      const point = toScreen(enemy.x, enemy.y);
      const artId = actorId(enemy);
      const body = art.catalog[artId];
      const bodyScale = newProgression() && VISITORS[enemy.t] ? 3 : 2;
      if (assaultCombat() && enemy.t === "elite") {
        const healthY = point.y + (body.nativeSize[1] * bodyScale) / 2 + 5;
        ctx.fillStyle = "#211b31";
        ctx.fillRect(point.x - 32, healthY, 64, 6);
        ctx.fillStyle = "#f4c57a";
        ctx.fillRect(
          point.x - 32,
          healthY,
          64 * Math.max(0, enemy.hp / enemy.maxhp),
          4,
        );
        if (enemy.barrier > 0) {
          ctx.strokeStyle = "#bc85f2";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.ellipse(
            point.x,
            point.y,
            54,
            39,
            angle(enemy, g.p) + Math.PI / 2,
            0,
            T,
          );
          ctx.stroke();
          ctx.fillStyle = "#bc85f2";
          ctx.fillRect(
            point.x - 32,
            healthY + 7,
            (64 * enemy.barrier) / enemy.maxBarrier,
            3,
          );
        }
      }
      if (newProgression() && VISITORS[enemy.t]) {
        const age = enemy.arrivalAge || 0;
        const healthY = point.y + (body.nativeSize[1] * bodyScale) / 2 + 4;
        ctx.save();
        ctx.strokeStyle = age < 1.6 ? "#c8b4ef" : "#73d9e8";
        ctx.lineWidth = age < 1.6 ? 3 : 1;
        if (age < 2.8) {
          ctx.globalAlpha = Math.max(0, 1 - age / 2.8);
          ctx.beginPath();
          ctx.ellipse(point.x, point.y, 42 + age * 12, 56 + age * 8, 0, 0, T);
          ctx.stroke();
          for (let i = 0; i < 8; i++) {
            const heading = (i * T) / 8 + age;
            ctx.fillStyle = "#73d9e8";
            ctx.fillRect(
              point.x + Math.cos(heading) * 52 - 2,
              point.y + Math.sin(heading) * 52 - 2,
              4,
              4,
            );
          }
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#1b1730";
        ctx.fillRect(point.x - 28, healthY, 56, 5);
        ctx.fillStyle = age < 1.6 ? "#c8b4ef" : "#73d9e8";
        ctx.fillRect(
          point.x - 28,
          healthY,
          56 * Math.max(0, enemy.hp / enemy.maxhp),
          3,
        );
        ctx.restore();
      }
      if (enemy.warn > 0) drawWarning(enemy, point);
      if (assaultCombat() && enemy.echo) {
        ctx.strokeStyle = "#c49bef";
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 7]);
        ctx.beginPath();
        for (const spread of [-0.36, 0, 0.36]) {
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(
            point.x + Math.cos(enemy.echo.aim + spread) * 170,
            point.y + Math.sin(enemy.echo.aim + spread) * 170,
          );
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }
      const heading = enemyPose(enemy);
      const propelled =
        ["lancer", "sentinel", "minelayer", "courier", "watcher"].includes(
          enemy.t,
        ) ||
        (showcaseCombat() &&
          ["elite", "boss"].includes(enemy.t) &&
          body.exhaustAnchors) ||
        (assaultCombat() && enemy.eliteProfile && body.exhaustAnchors);
      if (newCombat() && propelled && (enemy.speed > 0 || enemy.charge > 0)) {
        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.rotate(heading);
        for (const [x, y] of body.exhaustAnchors)
          art.draw(
            ctx,
            "thruster",
            (x - body.center[0]) * bodyScale,
            (y - body.center[1]) * bodyScale,
            {
              frame: art.frameAt("thruster", g.time * 1000, true),
              scale: (enemy.charge > 0 ? 0.15 : 0.065) * bodyScale,
              anchor: [12, 3],
            },
          );
        ctx.restore();
      }
      art.draw(ctx, artId, point.x, point.y, {
        angle: heading,
        flash: enemy.flash > 0,
        flashAlpha:
          assaultCombat() && ["elite", "boss"].includes(enemy.t) ? 0.28 : 0.8,
        scale: bodyScale,
      });
      if (
        showcaseCombat() &&
        enemy.t === "boss" &&
        enemy.hp < enemy.maxhp / 2
      ) {
        const core = toScreen(enemy.x, enemy.y);
        ctx.strokeStyle = "#f4c57a";
        ctx.lineWidth = 2;
        for (const sign of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(core.x + sign * 10, core.y - 8);
          ctx.lineTo(core.x + sign * 15, core.y);
          ctx.lineTo(core.x + sign * 10, core.y + 8);
          ctx.stroke();
        }
      }
      if (enemy.marked > 0) {
        ctx.strokeStyle = "#f4c57a";
        ctx.lineWidth = 1;
        ctx.strokeRect(point.x - 10, point.y - 10, 20, 20);
      }
      if (["boss", "elite"].includes(enemy.t) || VISITORS[enemy.t])
        drawOffscreenMarker(point);
    }
    drawOrbitals();
    for (const shot of g.shots) {
      const point = toScreen(shot.x, shot.y);
      const heading = Math.atan2(shot.vy, shot.vx);
      if (shot.kind === "crystal") {
        art.draw(ctx, "prism_crystal", point.x, point.y, {
          angle: heading + Math.PI / 2,
          scale: showcaseCombat()
            ? shot.source === "prism"
              ? 0.8
              : 1.2
            : 0.65,
        });
        ctx.fillStyle = "#d2b5f0";
        ctx.globalAlpha = 0.55;
        ctx.fillRect(
          Math.round(point.x - Math.cos(heading) * 9),
          Math.round(point.y - Math.sin(heading) * 9),
          3,
          3,
        );
        ctx.globalAlpha = 1;
        continue;
      }
      if (shot.kind === "shard") {
        art.draw(ctx, "blade_body", point.x, point.y, {
          angle: heading + g.time * 8,
          scale: showcaseCombat() ? 1 : 0.6,
        });
        continue;
      }
      const missileScale = showcaseCombat() && shot.evolvedAtLaunch ? 1.4 : 0.9;
      if (shot.kind === "missile") {
        // The native nozzle [12,20] follows the same body scale as its projectile.
        art.draw(
          ctx,
          "thruster",
          point.x - Math.cos(heading) * 8 * missileScale,
          point.y - Math.sin(heading) * 8 * missileScale,
          {
            angle: heading + Math.PI / 2,
            anchor: [12, 3],
            scale: missileScale / 3,
            frame: art.frameAt("thruster", g.time * 1000, true),
          },
        );
      } else {
        ctx.fillStyle =
          shot.kind === "hive"
            ? "#f4c57a"
            : shot.kind === "drone"
              ? "#b9a1e8"
              : "#73d9e8";
        for (let trail = 1; trail <= 3; trail++) {
          ctx.globalAlpha = 0.4 / trail;
          ctx.fillRect(
            Math.round(point.x - Math.cos(heading) * trail * 5),
            Math.round(point.y - Math.sin(heading) * trail * 5),
            2,
            2,
          );
        }
        ctx.globalAlpha = 1;
      }
      art.draw(
        ctx,
        shot.kind === "missile" ? "missile_body" : "pulse",
        point.x,
        point.y,
        {
          angle: Math.atan2(shot.vy, shot.vx) + Math.PI / 2,
          scale:
            shot.kind === "missile"
              ? missileScale
              : showcaseCombat() && shot.evolvedAtLaunch
                ? 0.95
                : 0.55,
        },
      );
    }
    for (const well of g.wells || []) {
      const point = toScreen(well.x, well.y),
        progress = 1 - well.t / well.max;
      ctx.save();
      ctx.translate(point.x, point.y);
      ctx.rotate(g.time * (well.fused ? 1.8 : 0.7));
      ctx.strokeStyle = well.fused ? "#f4c57a" : "#a795db";
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 2;
      for (let layer = 0; layer < 3; layer++) {
        const radius =
          well.radius * (0.28 + ((progress + layer / 3) % 1) * 0.6);
        ctx.beginPath();
        for (let step = 0; step <= 12; step++) {
          const heading = (step * T) / 12;
          const x = Math.round(Math.cos(heading) * radius),
            y = Math.round(Math.sin(heading) * radius * 0.52);
          if (!step) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();
      if (art.catalog.gravity_burst)
        art.draw(ctx, "gravity_burst", point.x, point.y, {
          frame:
            Math.floor(g.time * 12) % art.catalog.gravity_burst.frames.length,
          scale: showcaseCombat()
            ? well.fused
              ? 1.9
              : g.evolved.gravity
                ? 1.4
                : 0.8
            : 0.8,
          alpha: 0.65,
        });
    }
    for (const beam of g.beams) {
      const start = toScreen(beam.x1, beam.y1),
        end = toScreen(beam.x2, beam.y2);
      const bastion = showcaseCombat() && beam.source === "ionbastion";
      ctx.globalAlpha = clamp(beam.t / (bastion ? 0.26 : 0.16), 0, 1);
      if (bastion) {
        const heading = Math.atan2(end.y - start.y, end.x - start.x);
        ctx.save();
        ctx.translate(start.x, start.y);
        ctx.rotate(heading + Math.PI / 2);
        ctx.strokeStyle = "#f4c57a";
        ctx.lineWidth = 4;
        for (const [x, y] of window.SurvivorArt.catalog.bastion_mount
          .muzzleAnchors) {
          ctx.beginPath();
          ctx.moveTo((x - 20) * 1.6, (y - 20) * 1.6 - 1);
          ctx.lineTo(0, -52);
          ctx.stroke();
        }
        ctx.restore();
        const dx = Math.cos(heading),
          dy = Math.sin(heading);
        for (
          let step = 45;
          step < Math.hypot(end.x - start.x, end.y - start.y);
          step += 34
        ) {
          const x = start.x + dx * step,
            y = start.y + dy * step;
          ctx.strokeStyle = "#b694d9";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(x - dy * 14 - dx * 4, y + dx * 14 - dy * 4);
          ctx.lineTo(x - dy * 18, y + dx * 18);
          ctx.moveTo(x + dy * 14 - dx * 4, y - dx * 14 - dy * 4);
          ctx.lineTo(x + dy * 18, y - dx * 18);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = bastion ? "#8c6846" : beam.kind ? "#7151a0" : "#497c9d";
      ctx.lineWidth = bastion
        ? 20
        : showcaseCombat() && beam.source === "piercebeam"
          ? 16
          : 12;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.strokeStyle = bastion ? "#f4c57a" : beam.kind ? "#bd9ee8" : "#73d9e8";
      ctx.lineWidth = bastion ? 10 : beam.width || 6;
      ctx.stroke();
      ctx.strokeStyle = "#fff0ce";
      ctx.lineWidth = bastion ? 4 : 2;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    for (const arc of g.arcs) {
      const start = toScreen(arc.x1, arc.y1),
        end = toScreen(arc.x2, arc.y2);
      ctx.globalAlpha = clamp(arc.t / 0.22, 0, 1);
      ctx.strokeStyle = arc.color || "#73d9e8";
      ctx.lineWidth =
        showcaseCombat() && (g.evolved.arc || g.fused.thunderhive) ? 6 : 3;
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo((start.x + end.x) / 2 - 5, (start.y + end.y) / 2 + 5);
      ctx.lineTo((start.x + end.x) / 2 + 5, (start.y + end.y) / 2 - 4);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
      ctx.strokeStyle = arc.core || "#e4f4ec";
      ctx.lineWidth = 1;
      ctx.stroke();
      art.draw(ctx, "beam_cap", end.x, end.y, {
        scale:
          showcaseCombat() && (g.evolved.arc || g.fused.thunderhive)
            ? 0.6
            : 0.28,
      });
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
      const frame = art.frameAt(effect.kind, (effect.max - effect.t) * 1000);
      art.draw(ctx, effect.kind, point.x, point.y, {
        frame,
        scale: effect.scale,
        angle: effect.rotation || 0,
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
    if (g.celebration) {
      const point = toScreen(g.p.x, g.p.y),
        effect = g.celebration;
      const id = effect.kind === "fusion" ? "fusion_nova" : "evolution_corona";
      if (art.catalog[id])
        art.draw(ctx, id, point.x, point.y, {
          frame: art.frameAt(id, (effect.max - effect.t) * 1000),
          scale: 2.4,
          alpha: Math.min(1, effect.t * 2),
        });
    }
    for (const shot of g.enemyShots) {
      const point = toScreen(shot.x, shot.y);
      if (shot.kind === "siege") {
        const target = toScreen(shot.destinationX, shot.destinationY);
        ctx.strokeStyle = "#f4c57a";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(target.x - 16, target.y - 16, 32, 32);
        ctx.setLineDash([]);
        art.draw(ctx, "missile_body", point.x, point.y, {
          angle: Math.atan2(shot.vy, shot.vx) + Math.PI / 2,
          scale: 1.15,
        });
      } else if (["needle", "curl"].includes(shot.kind)) {
        ctx.save();
        ctx.translate(point.x, point.y);
        ctx.rotate(Math.atan2(shot.vy, shot.vx));
        ctx.fillStyle =
          shot.color || (shot.kind === "needle" ? "#f0a565" : "#b9a1e8");
        if (showcaseCombat() && shot.kind === "curl" && shot.radius === 7) {
          ctx.beginPath();
          ctx.lineWidth = 4;
          ctx.strokeStyle = "#73d9e8";
          ctx.arc(-2, 0, 8, -1.5, 1.5);
          ctx.stroke();
        } else ctx.fillRect(-7, -3, 11, 6);
        ctx.fillStyle = "#fff0ce";
        ctx.fillRect(-2, -1, 7, 2);
        ctx.restore();
      } else
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
    if (QA && g?.qaLabel) {
      ctx.fillStyle = "#c4bed2";
      ctx.font = "12px sans-serif";
      ctx.fillText("QA 靶场 · " + g.qaLabel, 12, VH - 25);
    }
  }
  function updateHud(force = false) {
    syncAudioState();
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
    $("footHint").hidden = QA || g.time > 8 || g.mode !== "play";
    const events = g.encounters;
    const eventKind = events?.pending?.kind || events?.active?.kind;
    const activeVisitor = events?.active
      ? g.enemy.find((enemy) => enemy.id === events.active.id)
      : null;
    const notice = events?.notice;
    const eventVisible =
      newCombat() &&
      ["play", "pause", "upgrade"].includes(g.mode) &&
      (eventKind || (notice && notice.until > g.time));
    $("encounterNotice").hidden = !eventVisible;
    if (eventVisible) {
      $("encounterTitle").textContent = eventKind
        ? VISITORS[eventKind].name
        : notice.title;
      $("encounterText").textContent = events.pending
        ? VISITORS[eventKind].hint
        : events.active
          ? newProgression() && (activeVisitor?.arrivalAge || 0) < 1.6
            ? "跃迁入场 · 护盾正在消散"
            : VISITORS[eventKind].tactic +
              (newProgression()
                ? " · " +
                  Math.ceil(
                    ((activeVisitor?.hp || 0) / (activeVisitor?.maxhp || 1)) *
                      100,
                  ) +
                  "%"
                : "")
          : notice.text;
    }
    const special =
      g.enemy.find((enemy) => enemy.hp > 0 && enemy.t === "boss") ||
      g.enemy.find((enemy) => enemy.hp > 0 && enemy.t === "elite");
    if (newCombat())
      $("waveTip").textContent = special
        ? special.t === "boss"
          ? "守卫锁定 · 留意攻击预警"
          : "精英追猎 · 侧向避让"
        : (assaultCombat() ? B.assault.waves : B.combat.waves)
            .filter((entry) => g.time >= entry.from)
            .at(-1).hint;
    $("bossBar").hidden = !special || g.mode === "results";
    if (special) {
      $("bossName").textContent =
        special.t === "boss"
          ? showcaseCombat()
            ? bossSpec(special).name +
              (special.hp < special.maxhp / 2 ? " · 第二阶段" : "")
            : "星海守卫者"
          : assaultCombat()
            ? eliteSpec(special).name + (special.barrier > 0 ? " · 护甲" : "")
            : "反应堆追猎者";
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
        rank: g.evolved[id]
          ? "EVO"
          : g.active[id] === activeMaximum()
            ? activeMaximum() + " MAX"
            : g.active[id],
        kind: g.evolved[id]
          ? "evo"
          : g.active[id] === activeMaximum()
            ? "maxed"
            : "",
      }))
      .concat(
        Object.keys(g.fused).map((id) => ({ id, rank: "融合", kind: "fused" })),
      );
    const passive = Object.keys(g.passive).map((id) => ({
      id,
      rank:
        g.passive[id] === passiveMaximum()
          ? passiveMaximum() + " MAX"
          : g.passive[id],
      kind: g.passive[id] === passiveMaximum() ? "maxed" : "",
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
    $("loadout").innerHTML =
      row("武装", active, runRules().activeSlots) +
      row("增强", passive, runRules().passiveSlots);
  }
  async function finish(victory) {
    if (!g || ["results", "settling"].includes(g.mode)) return;
    releaseInput();
    const summary = {
      time: g.time,
      endTime: runRules().runSeconds,
      kills: g.kills,
      credits: g.credits,
      level: g.level,
      victory: !!victory,
      bossKilled: g.bossKilled,
      active: { ...g.active },
      passive: { ...g.passive },
      evolved: { ...g.evolved },
      fused: { ...g.fused },
      encounters: structuredClone(g.encounters?.log || []),
    };
    g.mode = "settling";
    syncAudioState();
    playSound(victory ? "victory" : "defeat");
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
    unlockAudio();
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
  function burst(x, y, kind, scale, rotation = 0) {
    const duration =
      (window.SurvivorArt.catalog[kind]?.durationMs ||
        (kind === "explosion" ? 390 : kind === "hit" ? 180 : 500)) / 1000;
    g.bursts.push({ x, y, kind, scale, rotation, t: duration, max: duration });
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
  function beamAttack(target, damage, source = "piercebeam") {
    const heading = angle(g.p, target),
      x = g.p.x + Math.cos(heading) * 660,
      y = g.p.y + Math.sin(heading) * 660;
    g.beams.push({
      x1: g.p.x,
      y1: g.p.y,
      x2: x,
      y2: y,
      t: showcaseCombat() && source === "ionbastion" ? 0.26 : 0.16,
      source,
    });
    if (g.beams.length > 6) g.beams.shift();
    playSound("cannon", { evolved: true });
    if (window.SurvivorArt.catalog.rail_muzzle)
      burst(
        g.p.x + Math.cos(heading) * 14,
        g.p.y + Math.sin(heading) * 14,
        "rail_muzzle",
        1.1,
        heading + Math.PI / 2,
      );
    g.metrics.shots[source] = (g.metrics.shots[source] || 0) + 1;
    for (const enemy of g.enemy)
      if (enemy.hp > 0 && hitsEnemy(enemy, g.p.x, g.p.y, x, y, 5)) {
        hurtEnemy(
          enemy,
          damage,
          !!(g.active.drone || g.fused.thunderhive),
          source,
        );
      }
  }
  function enemyFire(enemy) {
    if (
      assaultCombat() &&
      enemy.t === "boss" &&
      g.time >= 450 &&
      (!showcaseCombat() || enemy.bossProfile === "core")
    )
      enemy.echo = { remaining: 0.75, aim: enemy.aim };
    if (newCombat() && fireModernAttack(enemy)) return;
    const boss = enemy.t === "boss",
      elite = enemy.t === "elite";
    const radial =
      boss && enemy.hp / enemy.maxhp < 0.5 && enemy.pattern % 2 === 0;
    const count = radial
      ? 10 + 2 * (enemy.tier || 1)
      : boss
        ? 5 + 2 * (enemy.tier || 1)
        : elite
          ? 3
          : 1;
    for (
      let index = 0;
      index < count && g.enemyShots.length < B.maxEnemyShots;
      index++
    ) {
      const heading = radial
        ? (index * T) / count
        : enemy.aim + (index - (count - 1) / 2) * 0.17;
      const speed = boss ? 150 + 8 * ((enemy.tier || 1) - 1) : 125;
      g.enemyShots.push({
        x: enemy.x,
        y: enemy.y,
        vx: Math.cos(heading) * speed,
        vy: Math.sin(heading) * speed,
        t: 3.6,
        kind: "pulse",
      });
    }
    if (boss && enemy.pattern % 3 === 0) {
      enemy.charge = 0.42;
      enemy.chargeAngle = enemy.aim;
    }
  }
  function attackKind(enemy) {
    if (assaultCombat() && enemy.t === "elite") {
      const patterns = eliteSpec(enemy).attacks;
      return patterns[Math.max(0, enemy.pattern - 1) % patterns.length];
    }
    if (enemy.t === "lancer") return "dash";
    if (["minelayer", "courier"].includes(enemy.t)) return "mine";
    if (["sentinel", "watcher"].includes(enemy.t)) return "beam";
    if (enemy.t === "tank") return "shock";
    if (showcaseCombat() && enemy.t === "boss") {
      const profile = bossSpec(enemy);
      const patterns =
        enemy.hp / enemy.maxhp < 0.5 ? profile.phaseTwo : profile.attacks;
      return patterns[Math.max(0, enemy.pattern - 1) % patterns.length];
    }
    if (enemy.t === "boss") return ["fan", "beam", "shock"][enemy.pattern % 3];
    if (enemy.t === "elite") return enemy.pattern % 2 ? "fan" : "dash";
    return "fan";
  }
  function addHazard(hazard) {
    if (g.hazards.length >= B.combat.maxHazards) return false;
    g.hazards.push(hazard);
    g.metrics.shots["hostile-" + hazard.kind] =
      (g.metrics.shots["hostile-" + hazard.kind] || 0) + 1;
    return true;
  }
  function fireModernAttack(enemy) {
    const kind = attackKind(enemy);
    g.metrics.shots["hostile-" + enemy.t] =
      (g.metrics.shots["hostile-" + enemy.t] || 0) + 1;
    if (showcaseCombat() && fireShowcaseAttack(enemy, kind)) {
      playSound("enemyFire", { strength: 0.8 });
      return true;
    }
    if (kind === "dash") {
      enemy.charge = 0.48;
      enemy.chargeAngle = enemy.aim;
      enemy.recovery = 1.2;
    } else if (kind === "beam") {
      const count = enemy.t === "watcher" ? 3 : 1;
      for (let index = 0; index < count; index++)
        addHazard({
          kind,
          owner: enemy.id,
          x: enemy.x,
          y: enemy.y,
          heading: enemy.aim + (index - (count - 1) / 2) * 0.72 - 0.2,
          sweep: assaultCombat() && enemy.t === "elite" ? 0.65 : 0.4,
          length: enemy.t === "boss" ? 440 : 310,
          width: assaultCombat() && enemy.t === "elite" ? 12 : 9,
          age: 0,
          duration: assaultCombat() && enemy.t === "elite" ? 0.9 : 0.65,
          damage: B.combat.damage.beam,
        });
    } else if (kind === "mine") {
      const targetMines =
        assaultCombat() &&
        (enemy.eliteProfile === "warden" ||
          (showcaseCombat() &&
            ["hive", "ark"].includes(enemy.eliteProfile || enemy.bossProfile)));
      const count = enemy.t === "courier" || targetMines ? 3 : 1;
      for (let index = 0; index < count; index++) {
        const heading = enemy.aim + (index - (count - 1) / 2) * 0.85;
        addHazard({
          kind,
          owner: enemy.id,
          x: (targetMines ? enemy.targetX : enemy.x) + Math.cos(heading) * 38,
          y: (targetMines ? enemy.targetY : enemy.y) + Math.sin(heading) * 38,
          age: 0,
          duration: 6,
          stage: "arming",
          fuse: 0,
          radius: 42,
          damage: B.combat.damage.mine,
          parcel: enemy.t === "courier",
        });
      }
    } else if (kind === "shock") {
      addHazard({
        kind,
        owner: enemy.id,
        x: enemy.x,
        y: enemy.y,
        age: 0,
        duration: 1.5,
        radius: enemy.t === "boss" ? 240 : 165,
        opening: enemy.aim + 0.5,
        damage: B.combat.damage.shock,
      });
    } else {
      if (assaultCombat() && enemy.t === "elite") {
        const count = kind === "cross" ? 8 : 5;
        const speed =
          155 * (1 + Math.max(0, g.time - 300) * B.assault.lateProjectileScale);
        for (
          let index = 0;
          index < count && g.enemyShots.length < B.maxEnemyShots;
          index++
        ) {
          const heading =
            kind === "cross"
              ? enemy.aim +
                (Math.floor(index / 2) * T) / 4 +
                (index % 2 ? 0.12 : -0.12)
              : enemy.aim + (index - 2) * 0.22;
          g.enemyShots.push({
            x: enemy.x,
            y: enemy.y,
            vx: Math.cos(heading) * speed,
            vy: Math.sin(heading) * speed,
            t: 3.8,
            kind: "needle",
            color: kind === "cross" ? "#c49bef" : "#f4c57a",
            damage: 9,
            radius: 4,
          });
        }
        playSound("enemyFire", { strength: 0.8 });
        return true;
      }
      if (!["ranger", "wisp"].includes(enemy.t)) return false;
      const count =
        enemy.t === "wisp" ? 2 : assaultCombat() && g.time < 150 ? 1 : 3;
      for (
        let index = 0;
        index < count && g.enemyShots.length < B.maxEnemyShots;
        index++
      ) {
        const heading =
          enemy.aim +
          (index - (count - 1) / 2) * (enemy.t === "wisp" ? 0.55 : 0.22);
        const speed =
          (enemy.t === "wisp" ? 118 : 155) *
          B.combat.fireSpeedScale *
          (assaultCombat()
            ? 1 + Math.max(0, g.time - 300) * B.assault.lateProjectileScale
            : 1);
        g.enemyShots.push({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(heading) * speed,
          vy: Math.sin(heading) * speed,
          t: 3.8,
          kind: enemy.t === "wisp" ? "curl" : "needle",
          turn: enemy.t === "wisp" ? (index ? -0.32 : 0.32) : 0,
          damage: B.combat.damage.shot,
          radius: 3,
        });
      }
    }
    playSound("enemyFire", { strength: 0.5 });
    return true;
  }
  function hostileShot(origin, heading, speed, properties = {}) {
    if (g.enemyShots.length >= B.maxEnemyShots) return false;
    g.enemyShots.push({
      ...origin,
      vx: Math.cos(heading) * speed,
      vy: Math.sin(heading) * speed,
      t: 3.8,
      kind: "needle",
      radius: 4,
      damage: 9,
      ...properties,
    });
    return true;
  }
  function fireShowcaseAttack(enemy, kind) {
    const phaseTwo = enemy.hp / enemy.maxhp < 0.5;
    if (kind === "escort") {
      const live = g.enemy.filter(
        (e) => e.ownerId === enemy.id && e.hp > 0,
      ).length;
      const count = Math.min(2 - live, enemy.summonsLeft);
      for (let index = 0; index < count; index++) {
        const escort = spawnEnemy("wisp");
        if (!escort) break;
        const origin = enemyPort(enemy, 4 - enemy.summonsLeft, true);
        Object.assign(escort, origin, { ownerId: enemy.id, fire: 1.5 });
        enemy.summonsLeft--;
        g.metrics.shots["hostile-escort-launched"] =
          (g.metrics.shots["hostile-escort-launched"] || 0) + 1;
        ring(origin.x, origin.y, 24, "#b9a1e8", 0.4);
      }
    } else if (kind === "hook" || kind === "spiral") {
      const count = kind === "hook" ? 2 : phaseTwo ? 8 : 6;
      for (let index = 0; index < count; index++) {
        const heading =
          kind === "hook"
            ? enemy.aim + (index ? 0.55 : -0.55)
            : enemy.aim + (index * T) / count;
        hostileShot(
          enemyPort(enemy, index % 2),
          heading,
          kind === "hook" ? 155 : 115,
          {
            kind: "curl",
            turn: (index % 2 ? -1 : 1) * (kind === "hook" ? 1.15 : 0.5),
            radius: kind === "hook" ? 7 : 4,
            color: kind === "hook" ? "#73d9e8" : "#d0a4ef",
          },
        );
      }
    } else if (kind === "splitbeam") {
      for (let index = 0; index < 2; index++) {
        const origin = enemyPort(enemy, index);
        addHazard({
          kind: "beam",
          owner: enemy.id,
          portIndex: index,
          ...origin,
          heading: enemy.aim + (index ? 0.28 : -0.28),
          sweep: index ? -0.5 : 0.5,
          length: 420,
          width: 10,
          age: 0,
          duration: phaseTwo ? 1 : 0.8,
          damage: B.combat.damage.beam,
        });
      }
    } else if (kind === "siege") {
      for (let index = 0; index < 3; index++) {
        const origin = enemyPort(enemy, index * 2, true);
        const destination = {
          x: enemy.targetX + (index - 1) * 65,
          y: enemy.targetY,
        };
        hostileShot(origin, angle(origin, destination), 150, {
          kind: "siege",
          t: 3,
          destinationX: destination.x,
          destinationY: destination.y,
          radius: 7,
          damage: 10,
        });
      }
    } else if (kind === "pincer") {
      addHazard({
        kind,
        owner: enemy.id,
        x: enemy.targetX,
        y: enemy.targetY,
        heading: enemy.aim,
        age: 0,
        duration: 2.6,
        warning: 1.1,
        damage: 9,
      });
    } else if (kind === "dualburst") {
      for (let port = 0; port < 2; port++)
        for (let index = 0; index < (phaseTwo ? 4 : 3); index++)
          hostileShot(
            enemyPort(enemy, port),
            enemy.aim + (index - (phaseTwo ? 1.5 : 1)) * 0.18,
            165,
            { color: port ? "#f4c57a" : "#c49bef" },
          );
    } else if (enemy.t === "boss" && kind === "cross") {
      for (let index = 0; index < 8; index++)
        hostileShot(
          enemyPort(enemy, index % 2),
          enemy.aim +
            (Math.floor(index / 2) * T) / 4 +
            (index % 2 ? 0.12 : -0.12),
          145,
          { color: "#f4c57a" },
        );
    } else return false;
    g.metrics.shots["hostile-" + kind] =
      (g.metrics.shots["hostile-" + kind] || 0) + 1;
    return true;
  }
  function pincerWalls(hazard) {
    const progress = clamp(
      (hazard.age - hazard.warning) / (hazard.duration - hazard.warning),
      0,
      1,
    );
    const separation = 90 - progress * 56;
    const normalX = -Math.sin(hazard.heading),
      normalY = Math.cos(hazard.heading);
    const alongX = Math.cos(hazard.heading) * 120,
      alongY = Math.sin(hazard.heading) * 120;
    return [-1, 1].map((side) => {
      const x = hazard.x + normalX * separation * side;
      const y = hazard.y + normalY * separation * side;
      return { x1: x - alongX, y1: y - alongY, x2: x + alongX, y2: y + alongY };
    });
  }
  function updateHazards(dt) {
    for (const hazard of g.hazards) {
      hazard.age += dt;
      if (hazard.kind === "beam") {
        const owner = g.enemy.find(
          (enemy) => enemy.id === hazard.owner && enemy.hp > 0,
        );
        if (!owner) {
          hazard.age = hazard.duration;
          continue;
        }
        const origin =
          hazard.portIndex === undefined
            ? owner
            : enemyPort(owner, hazard.portIndex);
        hazard.x = origin.x;
        hazard.y = origin.y;
        const heading =
          hazard.heading + (hazard.sweep * hazard.age) / hazard.duration;
        if (
          segmentDistance(
            g.p,
            hazard.x,
            hazard.y,
            hazard.x + Math.cos(heading) * hazard.length,
            hazard.y + Math.sin(heading) * hazard.length,
          ) <
          10 + hazard.width / 2
        )
          damageShip(hazard.damage);
      } else if (hazard.kind === "pincer") {
        if (
          hazard.age >= hazard.warning &&
          pincerWalls(hazard).some(
            (wall) =>
              segmentDistance(g.p, wall.x1, wall.y1, wall.x2, wall.y2) < 16,
          )
        )
          damageShip(hazard.damage);
      } else if (hazard.kind === "shock") {
        const radius = (hazard.radius * hazard.age) / hazard.duration;
        const heading = angle(hazard, g.p);
        const gap = Math.abs(
          Math.atan2(
            Math.sin(heading - hazard.opening),
            Math.cos(heading - hazard.opening),
          ),
        );
        if (gap > 0.48 && Math.abs(dist(hazard, g.p) - radius) < 13)
          damageShip(hazard.damage);
      } else {
        if (hazard.stage === "arming" && hazard.age >= 0.9)
          hazard.stage = "armed";
        if (
          hazard.stage === "armed" &&
          (dist(hazard, g.p) < 54 || hazard.age >= 4.8)
        ) {
          hazard.stage = "fuse";
          hazard.fuse = 0.6;
        }
        if (hazard.stage === "fuse") {
          hazard.fuse -= dt;
          if (hazard.fuse <= 0) {
            hazard.stage = "blast";
            hazard.age = 0;
            hazard.duration = 0.24;
            ring(hazard.x, hazard.y, hazard.radius, "#e5a76c", 0.24);
            burst(hazard.x, hazard.y, "explosion", 1.25);
            if (dist(hazard, g.p) < hazard.radius + 10)
              damageShip(hazard.damage);
          }
        }
      }
      if (g.mode !== "play") return;
    }
    g.hazards = g.hazards.filter((hazard) => hazard.age < hazard.duration);
  }
  function updateEnemies(dt) {
    for (const enemy of g.enemy) {
      if (enemy.hp <= 0) continue;
      if (newProgression() && VISITORS[enemy.t]) {
        enemy.arrivalAge = (enemy.arrivalAge || 0) + dt;
        if (enemy.arrivalAge < 1.6) {
          if (enemy.arrivalAge >= 0.6) {
            enemy.aim = angle(enemy, g.p);
            enemy.warn = 1.6 - enemy.arrivalAge;
            enemy.fire = 3.5;
          }
          continue;
        }
      }
      enemy.flash = Math.max(0, enemy.flash - dt);
      enemy.marked = Math.max(0, enemy.marked - dt);
      if (enemy.disabled > 0) {
        enemy.disabled -= dt;
        continue;
      }
      const distance = dist(enemy, g.p);
      const special = ["boss", "elite"].includes(enemy.t) || VISITORS[enemy.t];
      const point = toScreen(enemy.x, enemy.y);
      const visibleThreat =
        !newProgression() ||
        !special ||
        (point.x > 15 &&
          point.x < VW - 15 &&
          point.y > 215 &&
          point.y < VH - 30);
      if (assaultCombat() && enemy.echo) {
        enemy.echo.remaining -= dt;
        if (!visibleThreat || distance > 420) enemy.echo = null;
        else if (enemy.echo.remaining <= 0) {
          for (
            let index = 0;
            index < 5 && g.enemyShots.length < B.maxEnemyShots;
            index++
          ) {
            const heading = enemy.echo.aim + (index - 2) * 0.18;
            const speed =
              170 *
              (1 + Math.max(0, g.time - 300) * B.assault.lateProjectileScale);
            g.enemyShots.push({
              x: enemy.x,
              y: enemy.y,
              vx: Math.cos(heading) * speed,
              vy: Math.sin(heading) * speed,
              t: 3.8,
              kind: "needle",
              color: "#c49bef",
              damage: 9,
              radius: 4,
            });
          }
          g.metrics.shots["hostile-boss-echo"] =
            (g.metrics.shots["hostile-boss-echo"] || 0) + 1;
          playSound("enemyFire", { strength: 0.8 });
          enemy.echo = null;
        }
      }
      if (
        newProgression() &&
        enemy.warn > 0 &&
        (!visibleThreat || distance >= 380)
      ) {
        enemy.warn = 0;
        enemy.fire = Math.max(enemy.fire, 0.65);
      }
      let heading = angle(enemy, g.p);
      if (
        (["ranger", "sentinel", "watcher"].includes(enemy.t) ||
          (assaultCombat() && enemy.eliteProfile === "warden")) &&
        distance < (newProgression() && enemy.t === "watcher" ? 130 : 175)
      )
        heading += Math.PI;
      else if (["minelayer", "courier"].includes(enemy.t))
        heading +=
          distance < 145
            ? Math.PI * 0.65
            : Math.sin(g.time + enemy.phase) * 0.35;
      else if (enemy.t === "wisp")
        heading += Math.sin(g.time * 2.5 + enemy.phase) * 0.5;
      let speed =
        enemy.speed *
        (1 + Math.min(300, g.time) / 1000) *
        (assaultCombat()
          ? 1 +
            Math.max(0, g.time - B.assault.lateSpeedAfter) *
              B.assault.lateSpeedScale
          : 1) *
        (1 - (enemy.gravitySlow || 0));
      enemy.gravitySlow = 0;
      enemy.recovery = Math.max(0, (enemy.recovery || 0) - dt);
      if (newCombat() && enemy.recovery > 0 && enemy.charge <= 0) speed *= 0.4;
      if (
        special &&
        distance >
          Math.min(VW, VH) *
            (newProgression() ? 0.38 : VISITORS[enemy.t] ? 0.58 : 0.85)
      )
        speed *= newProgression() ? 4 : 2.7;
      if (enemy.charge > 0) {
        enemy.charge -= dt;
        speed = newCombat() ? 350 : 315;
        heading = enemy.chargeAngle;
      }
      if (enemy.warn > 0) speed *= 0.35;
      if (showcaseCombat() && ["elite", "boss"].includes(enemy.t)) {
        const desired =
          (enemy.charge > 0
            ? enemy.chargeAngle
            : enemy.warn > 0
              ? enemy.aim
              : angle(enemy, g.p)) +
          Math.PI / 2;
        const delta = Math.atan2(
          Math.sin(desired - enemy.facing),
          Math.cos(desired - enemy.facing),
        );
        enemy.facing += clamp(
          delta,
          -(enemy.t === "boss" ? 1.9 : 4) * dt,
          (enemy.t === "boss" ? 1.9 : 4) * dt,
        );
      }
      enemy.x += Math.cos(heading) * speed * dt;
      enemy.y += Math.sin(heading) * speed * dt;
      const canFire = newCombat()
        ? enemy.t !== "skimmer" &&
          g.time >=
            ((assaultCombat() ? B.assault.attackUnlock : B.combat.attackUnlock)[
              enemy.t
            ] || 0)
        : ["ranger", "elite", "boss"].includes(enemy.t);
      if (canFire && visibleThreat && distance < (newCombat() ? 380 : 520)) {
        if (enemy.warn > 0) {
          enemy.warn -= dt;
          if (enemy.warn <= 0) enemyFire(enemy);
        } else {
          enemy.fire -= dt;
          if (enemy.fire <= 0) {
            enemy.aim = angle(enemy, g.p);
            if (assaultCombat()) {
              enemy.targetX = g.p.x;
              enemy.targetY = g.p.y;
            }
            enemy.pattern++;
            if (newCombat()) playSound("enemyCharge");
            enemy.warn =
              assaultCombat() && enemy.t === "elite"
                ? enemy.eliteProfile === "warden"
                  ? 1.2
                  : 0.9
                : newCombat()
                  ? {
                      lancer: 0.9,
                      sentinel: 1.1,
                      watcher: 1.2,
                      minelayer: 0.8,
                      courier: 1,
                      tank: 1,
                      ranger: 0.7,
                      wisp: 0.65,
                    }[enemy.t] || 1
                  : enemy.t === "boss"
                    ? 0.7
                    : 0.4;
            enemy.fire =
              assaultCombat() && enemy.t === "elite"
                ? enemy.eliteProfile === "warden"
                  ? 3.2
                  : 2.5
                : newCombat()
                  ? {
                      lancer: 3.1,
                      sentinel: 3.8,
                      watcher: 3.5,
                      minelayer: 4.2,
                      courier: 3.7,
                      tank: 5,
                      ranger: 2.6,
                      wisp: 3.5,
                    }[enemy.t] ||
                    Math.max(1.7, 2.5 - 0.3 * ((enemy.tier || 1) - 1))
                  : enemy.t === "boss"
                    ? Math.max(1, 1.8 - 0.25 * ((enemy.tier || 1) - 1))
                    : enemy.t === "elite"
                      ? 2
                      : 2.5;
          }
        }
      }
      if (
        enemyCircles(enemy).some(
          (circle) => dist(circle, g.p) < circle.radius + 12,
        )
      ) {
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
          VISITORS[enemy.t] ||
          (Math.abs(enemy.x - g.p.x) < VW / 2 + 150 &&
            Math.abs(enemy.y - g.p.y) < VH / 2 + 150)),
    );
  }
  function updateShots(dt) {
    for (const shot of g.shots) {
      shot.t -= dt;
      const previousX = shot.x,
        previousY = shot.y;
      const steering = assaultCombat()
        ? shot.homing === true
        : ["missile", "drone", "hive"].includes(shot.kind);
      if (steering) {
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
            rate =
              shot.kind === "missile"
                ? 3.4
                : assaultCombat() || g.evolved.drone
                  ? 4.8
                  : 2.8;
          const heading = current + clamp(turn, -rate * dt, rate * dt);
          shot.vx = Math.cos(heading) * speed;
          shot.vy = Math.sin(heading) * speed;
        }
      }
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      if (
        assaultCombat() &&
        shot.kind === "missile" &&
        !shot.homing &&
        segmentDistance(
          { x: shot.destinationX, y: shot.destinationY },
          previousX,
          previousY,
          shot.x,
          shot.y,
        ) < 8
      ) {
        blast(
          shot.destinationX,
          shot.destinationY,
          46,
          shot.damage,
          "#f4c57a",
          "missile",
        );
        shot.t = 0;
        continue;
      }
      for (const enemy of g.enemy) {
        if (
          enemy.hp <= 0 ||
          shot.hit.has(enemy.id) ||
          !hitsEnemy(enemy, previousX, previousY, shot.x, shot.y, shot.r)
        )
          continue;
        shot.hit.add(enemy.id);
        const mark =
          shot.kind === "pulse" && !!(g.active.drone || g.fused.thunderhive);
        const damage =
          shot.damage + (enemy.marked > 0 && shot.kind !== "pulse" ? 7 : 0);
        hurtEnemy(enemy, damage, mark, shot.source || shot.kind);
        if (shot.kind === "crystal" && shot.bounces > 0) {
          const target = g.enemy
            .filter(
              (candidate) =>
                candidate.hp > 0 &&
                !shot.hit.has(candidate.id) &&
                dist(candidate, shot) < 210,
            )
            .sort((a, b) => dist(a, shot) - dist(b, shot))[0];
          if (target) {
            const heading = angle(shot, target);
            const speed = Math.hypot(shot.vx, shot.vy);
            shot.vx = Math.cos(heading) * speed;
            shot.vy = Math.sin(heading) * speed;
            shot.damage *= 0.84;
            shot.bounces--;
            g.metrics.refractions = (g.metrics.refractions || 0) + 1;
            ring(shot.x, shot.y, 12, "#b9a1e8", 0.18);
            break;
          }
        }
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
            (assaultCombat() ? shot.evolvedAtLaunch : g.evolved.missile)
              ? 68
              : 46,
            shot.damage * 0.7,
            "#f4c57a",
            (assaultCombat() ? shot.evolvedAtLaunch : g.evolved.missile)
              ? "meteorbarrage"
              : "missile",
          );
        if (
          newProgression() &&
          shot.kind === "missile" &&
          g.active.blade &&
          g.time >= (g.shardsAt || 0)
        ) {
          g.shardsAt = g.time + 0.6;
          showLink("bladeMissile", shot.x, shot.y);
          for (let i = 0; i < 3 && g.shots.length < B.maxFriendlyShots; i++) {
            const heading = (i * T) / 3;
            g.shots.push({
              x: shot.x,
              y: shot.y,
              vx: Math.cos(heading) * 230,
              vy: Math.sin(heading) * 230,
              damage: 16 + activePower("blade") * 8,
              kind: "shard",
              r: 7,
              t: 0.65,
              pierce: 2,
              hit: new Set([enemy.id]),
            });
          }
        }
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
    ctx.globalAlpha = 0.65;
    const kind = newCombat() ? attackKind(enemy) : "fan";
    ctx.strokeStyle =
      kind === "dash" ? "#73d9e8" : kind === "mine" ? "#bd9ce9" : "#efad72";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 7]);
    if (
      showcaseCombat() &&
      [
        "hook",
        "spiral",
        "escort",
        "siege",
        "pincer",
        "splitbeam",
        "dualburst",
      ].includes(kind)
    ) {
      if (["siege", "pincer"].includes(kind)) {
        const target = toScreen(enemy.targetX, enemy.targetY);
        ctx.strokeRect(target.x - 24, target.y - 24, 48, 48);
        if (kind === "pincer") {
          for (const wall of pincerWalls({
            x: enemy.targetX,
            y: enemy.targetY,
            heading: enemy.aim,
            age: 0,
            warning: 1.1,
            duration: 2.6,
          })) {
            const a = toScreen(wall.x1, wall.y1),
              b = toScreen(wall.x2, wall.y2);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      } else if (kind === "splitbeam" || kind === "dualburst") {
        for (let port = 0; port < 2; port++) {
          const origin = enemyPort(enemy, port),
            start = toScreen(origin.x, origin.y);
          const heading = enemy.aim + (port ? 0.28 : -0.28);
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(
            start.x + Math.cos(heading) * 320,
            start.y + Math.sin(heading) * 320,
          );
          ctx.stroke();
        }
      } else {
        for (let port = 0; port < 2; port++) {
          const origin = enemyPort(enemy, port, kind === "escort"),
            start = toScreen(origin.x, origin.y);
          ctx.beginPath();
          ctx.arc(
            start.x,
            start.y,
            kind === "escort" ? 22 : 38,
            enemy.aim - 0.9,
            enemy.aim + 0.9,
          );
          ctx.stroke();
        }
      }
      ctx.restore();
      return;
    }
    if (newCombat() && ["shock", "mine"].includes(kind)) {
      if (kind === "shock") {
        ctx.beginPath();
        const opening = enemy.aim + 0.5;
        ctx.arc(point.x, point.y, 60, opening + 0.48, opening + T - 0.48);
        ctx.stroke();
      } else {
        const targetMines =
          assaultCombat() &&
          (enemy.eliteProfile === "warden" ||
            (showcaseCombat() &&
              ["hive", "ark"].includes(
                enemy.eliteProfile || enemy.bossProfile,
              )));
        const origin = targetMines
          ? toScreen(enemy.targetX, enemy.targetY)
          : point;
        const count = enemy.t === "courier" || targetMines ? 3 : 1;
        for (let index = 0; index < count; index++) {
          const heading = enemy.aim + (index - (count - 1) / 2) * 0.85;
          ctx.beginPath();
          ctx.arc(
            origin.x + Math.cos(heading) * 38,
            origin.y + Math.sin(heading) * 38,
            26,
            0,
            T,
          );
          ctx.stroke();
        }
      }
      ctx.restore();
      return;
    }
    const length =
      kind === "beam"
        ? enemy.t === "boss"
          ? 440
          : 310
        : kind === "dash"
          ? 180
          : enemy.t === "boss"
            ? 160
            : 100;
    ctx.beginPath();
    const count =
      kind === "cross" ? 4 : kind === "beam" && enemy.t === "watcher" ? 3 : 1;
    for (let index = 0; index < count; index++) {
      const heading =
        kind === "cross"
          ? enemy.aim + (index * T) / 4
          : enemy.aim + (index - (count - 1) / 2) * 0.72;
      for (const spread of kind === "beam" ? [-0.2, 0.2] : [0]) {
        ctx.moveTo(point.x, point.y);
        ctx.lineTo(
          point.x + Math.cos(heading + spread) * length,
          point.y + Math.sin(heading + spread) * length,
        );
      }
    }
    ctx.stroke();
    ctx.restore();
  }
  function drawHazards() {
    for (const hazard of g.hazards || []) {
      const point = toScreen(hazard.x, hazard.y);
      ctx.save();
      ctx.translate(point.x, point.y);
      if (hazard.kind === "beam") {
        const heading =
          hazard.heading + (hazard.sweep * hazard.age) / hazard.duration;
        ctx.rotate(heading);
        ctx.fillStyle = "#aa4d51";
        ctx.fillRect(0, -7, hazard.length, 14);
        ctx.fillStyle = "#f3a66c";
        ctx.fillRect(0, -3, hazard.length, 6);
        ctx.fillStyle = "#fff0ce";
        ctx.fillRect(0, -1, hazard.length, 2);
      } else if (hazard.kind === "pincer") {
        ctx.restore();
        ctx.save();
        const active = hazard.age >= hazard.warning;
        ctx.strokeStyle = active ? "#f4c57a" : "#c49bef";
        ctx.lineWidth = active ? 12 : 2;
        ctx.setLineDash(active ? [] : [5, 6]);
        for (const wall of pincerWalls(hazard)) {
          const start = toScreen(wall.x1, wall.y1),
            end = toScreen(wall.x2, wall.y2);
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
          if (active) {
            ctx.strokeStyle = "#fff0ce";
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.strokeStyle = "#f4c57a";
            ctx.lineWidth = 12;
          }
        }
      } else if (hazard.kind === "shock") {
        ctx.lineWidth = 5;
        ctx.strokeStyle = "#cf805f";
        ctx.beginPath();
        ctx.arc(
          0,
          0,
          Math.max(1, (hazard.radius * hazard.age) / hazard.duration),
          hazard.opening + 0.48,
          hazard.opening + T - 0.48,
        );
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.strokeStyle = "#ffe4a1";
        ctx.stroke();
      } else if (hazard.stage !== "blast") {
        const danger = hazard.stage === "fuse";
        ctx.lineWidth = danger ? 2 : 1;
        ctx.strokeStyle = danger ? "#ffb36b" : "#bca1da";
        ctx.setLineDash(danger ? [] : [3, 5]);
        ctx.beginPath();
        ctx.arc(0, 0, hazard.radius, 0, T);
        ctx.stroke();
        ctx.fillStyle = hazard.parcel ? "#b88858" : "#705785";
        ctx.fillRect(-7, -6, 14, 12);
        ctx.fillStyle = hazard.parcel ? "#f4d590" : "#ceb8e7";
        ctx.fillRect(-5, -4, 10, 2);
        ctx.fillRect(-1, -5, 2, 11);
        if (danger) {
          ctx.fillStyle = "#fff0ce";
          ctx.fillRect(-1, -17, 2, 6);
          ctx.fillRect(-1, -9, 2, 2);
        }
      }
      ctx.restore();
    }
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
    if (assaultCombat()) {
      const nodes = prismNodes();
      const energized = g.time < (g.prismFlashUntil || 0);
      for (const node of nodes) {
        const point = toScreen(node.x, node.y);
        if (nodes.length > 1 && energized) {
          const next = toScreen(
            nodes[(nodes.indexOf(node) + 1) % nodes.length].x,
            nodes[(nodes.indexOf(node) + 1) % nodes.length].y,
          );
          ctx.strokeStyle =
            g.evolved.prism || g.fused.eventhorizon ? "#f4c57a" : "#b9a1e8";
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(point.x, point.y);
          ctx.lineTo(next.x, next.y);
          ctx.stroke();
        }
        art.draw(ctx, "prism_crystal", point.x, point.y, {
          angle: node.heading,
          scale: showcaseCombat()
            ? g.fused.eventhorizon
              ? 1.7
              : g.evolved.prism
                ? 1.5
                : 1.15
            : energized
              ? 1.1
              : 0.9,
        });
      }
    }
    if (g.active.blade || g.fused.blastwheel) {
      const count = g.fused.blastwheel
        ? newProgression()
          ? 8
          : 6
        : g.evolved.blade
          ? 5
          : Math.ceil(activePower("blade") + 1);
      const radius = g.evolved.blade || g.fused.blastwheel ? 78 : 48;
      for (let index = 0; index < count; index++) {
        const heading = g.time * 2.7 + (index * T) / count;
        if (!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches)
          for (let trail = 1; trail <= 2; trail++) {
            const old = heading - trail * 0.14;
            art.draw(
              ctx,
              "blade_body",
              player.x + Math.cos(old) * radius,
              player.y + Math.sin(old) * radius,
              {
                angle: old,
                scale:
                  showcaseCombat() && (g.evolved.blade || g.fused.blastwheel)
                    ? 1.2
                    : 0.9,
                alpha: 0.22 / trail,
              },
            );
          }
        art.draw(
          ctx,
          "blade_body",
          player.x + Math.cos(heading) * radius,
          player.y + Math.sin(heading) * radius,
          {
            angle: heading,
            scale:
              showcaseCombat() && (g.evolved.blade || g.fused.blastwheel)
                ? 1.2
                : 0.9,
          },
        );
      }
    }
    for (const node of droneNodes()) {
      const point = toScreen(node.x, node.y);
      const id = showcaseCombat()
        ? g.fused.thunderhive
          ? "hive_drone"
          : g.evolved.drone
            ? "hunter_drone"
            : "drone_body"
        : "drone_body";
      art.draw(ctx, id, point.x, point.y, {
        angle: g.aim + Math.PI / 2,
        scale: showcaseCombat()
          ? g.fused.thunderhive
            ? 1.4
            : g.evolved.drone
              ? 1.45
              : 1.7
          : 0.8,
      });
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
    const rules = runRules(game);
    if (
      snapshot?.schema !== 1 ||
      !Number.isSafeInteger(snapshot.seed) ||
      !game ||
      !["pause", "upgrade"].includes(game.mode) ||
      !Number.isFinite(game.time) ||
      game.time < 0 ||
      game.time > rules.runSeconds
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
        rules.activeSlots ||
      Object.keys(game.passive).length > rules.passiveSlots
    )
      throw Error("武装槽位无效");
    if (
      ![180, 600, 900].includes(rules.runSeconds) ||
      (rules.combatVersion !== undefined &&
        ![2, 3, 4, 5].includes(rules.combatVersion)) ||
      (rules.progressionVersion !== undefined &&
        rules.progressionVersion !== 2) ||
      (newProgression(game) &&
        (!newCombat(game) || ![600, 900].includes(rules.runSeconds))) ||
      (assaultCombat(game) &&
        (rules.runSeconds !== 900 || !newProgression(game))) ||
      (rules.runSeconds === 900 && !assaultCombat(game)) ||
      (rules.runSeconds === 180 &&
        (rules.activeSlots !== 4 || rules.passiveSlots !== 3)) ||
      ([600, 900].includes(rules.runSeconds) &&
        (rules.activeSlots !== 6 || rules.passiveSlots !== 6))
    )
      throw Error("对局规则快照无效，原数据保留");
    if (
      newCombat(game) &&
      (!Array.isArray(game.hazards) ||
        game.hazards.length > B.combat.maxHazards ||
        game.hazards.some(
          (hazard) =>
            !(
              showcaseCombat(game)
                ? ["mine", "beam", "shock", "pincer"]
                : ["mine", "beam", "shock"]
            ).includes(hazard.kind) ||
            ![hazard.x, hazard.y, hazard.age, hazard.duration].every(
              Number.isFinite,
            ),
        ) ||
        !Array.isArray(game.encounters?.schedule) ||
        !Array.isArray(game.encounters?.seen) ||
        !Array.isArray(game.encounters?.log))
    )
      throw Error("遭遇记录无效，原数据保留");
    if (assaultCombat(game)) {
      for (const enemy of game.enemy) {
        if (
          enemy.echo &&
          (enemy.t !== "boss" ||
            !Number.isFinite(enemy.echo.aim) ||
            !Number.isFinite(enemy.echo.remaining) ||
            enemy.echo.remaining <= 0 ||
            enemy.echo.remaining > 0.75)
        )
          throw Error("守卫追加预警无效，原数据保留");
        if (showcaseCombat(game) && ["boss", "elite"].includes(enemy.t)) {
          if (
            !Number.isFinite(enemy.facing) ||
            (enemy.t === "boss" &&
              !B.showcase.bossProfiles[enemy.bossProfile]) ||
            (enemy.eliteProfile === "hive" &&
              (!Number.isInteger(enemy.summonsLeft) ||
                enemy.summonsLeft < 0 ||
                enemy.summonsLeft > 4))
          )
            throw Error("舰体行为记录无效，原数据保留");
        }
        if (enemy.t !== "elite") continue;
        if (
          !eliteSpec(enemy, game) ||
          !Number.isFinite(enemy.barrier) ||
          enemy.barrier < 0 ||
          !Number.isFinite(enemy.maxBarrier) ||
          enemy.barrier > enemy.maxBarrier
        )
          throw Error("精英装甲记录无效，原数据保留");
      }
      if (showcaseCombat(game)) {
        for (const hazard of game.hazards) {
          if (
            hazard.kind === "pincer" &&
            (![hazard.heading, hazard.warning, hazard.damage].every(
              Number.isFinite,
            ) ||
              hazard.warning < 0 ||
              hazard.warning >= hazard.duration)
          )
            throw Error("合围记录无效，原数据保留");
          if (
            hazard.portIndex !== undefined &&
            (!Number.isInteger(hazard.portIndex) ||
              hazard.portIndex < 0 ||
              hazard.portIndex > 5)
          )
            throw Error("炮口记录无效，原数据保留");
        }
        for (const shot of game.enemyShots) {
          if (
            shot.kind === "siege" &&
            ![
              shot.destinationX,
              shot.destinationY,
              shot.x,
              shot.y,
              shot.vx,
              shot.vy,
              shot.t,
            ].every(Number.isFinite)
          )
            throw Error("重雷记录无效，原数据保留");
        }
      }
      for (const shot of game.shots) {
        if (
          ["drone", "missile", "hive"].includes(shot.kind) &&
          (typeof shot.homing !== "boolean" ||
            typeof shot.evolvedAtLaunch !== "boolean" ||
            !Number.isFinite(shot.destinationX) ||
            !Number.isFinite(shot.destinationY))
        )
          throw Error("发射记录无效，原数据保留");
        if (
          shot.kind === "crystal" &&
          (!Number.isInteger(shot.bounces) ||
            shot.bounces < 0 ||
            shot.bounces > 4 ||
            !["prism", "kaleidoscope", "eventhorizon", "gravityPrism"].includes(
              shot.source,
            ))
        )
          throw Error("晶体折射记录无效，原数据保留");
      }
    }
    for (const [id, level] of Object.entries(game.active))
      if (
        !ACTIVE.includes(id) ||
        !Number.isSafeInteger(level) ||
        level < 1 ||
        level > activeMaximum(game)
      )
        throw Error("主动武器无效");
    for (const [id, level] of Object.entries(game.passive))
      if (
        !PASSIVE.includes(id) ||
        !Number.isSafeInteger(level) ||
        level < 1 ||
        level > passiveMaximum(game)
      )
        throw Error("辅助装置无效");
    for (const [id, evolved] of Object.entries(game.evolved)) {
      const recipe = EVO.find(
        ([source, , result]) => source === id && result === evolved,
      );
      if (
        !recipe ||
        game.active[id] !== activeMaximum(game) ||
        game.passive[recipe[1]] !== passiveMaximum(game)
      )
        throw Error("进化记录无效，原数据保留");
    }
    for (const [id, enabled] of Object.entries(game.fused)) {
      const recipe = FUSION.find(([, , result]) => result === id);
      if (
        !recipe ||
        (id === "ionbastion" && !newProgression(game)) ||
        enabled !== true ||
        game.active[recipe[0]] ||
        game.active[recipe[1]] ||
        game.evolved[recipe[0]] ||
        game.evolved[recipe[1]]
      )
        throw Error("融合记录无效，原数据保留");
      if (
        newProgression(game) &&
        recipe.some(
          (source, index) =>
            index < 2 &&
            game.passive[EVO.find(([weapon]) => weapon === source)[1]] !== 5,
        )
      )
        throw Error("融合辅助等级无效，原数据保留");
    }
    if (newProgression(game)) {
      const rewards = game.bossRewards;
      if (
        !rewards ||
        !Array.isArray(rewards.ids) ||
        !Array.isArray(rewards.pending) ||
        rewards.ids.length > 32 ||
        new Set(rewards.ids).size !== rewards.ids.length ||
        rewards.ids.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
        new Set(rewards.pending.map((reward) => reward.id)).size !==
          rewards.pending.length ||
        rewards.pending.some(
          (reward) =>
            !rewards.ids.includes(reward.id) ||
            !["elite", "boss"].includes(reward.enemy),
        )
      )
        throw Error("精英战利品记录无效，原数据保留");
      if (
        game.upgradeSource &&
        (game.upgradeSource.kind !== "boss" ||
          !rewards.ids.includes(game.upgradeSource.id) ||
          rewards.pending.some(
            (reward) => reward.id === game.upgradeSource.id,
          ) ||
          typeof game.upgradeSource.advancedRoll !== "boolean")
      )
        throw Error("强化来源无效，原数据保留");
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
    unlockAudio();
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
    unlockAudio();
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
      g.wells ||= [];
      g.milestoneSeen ||= [];
      g.hazards ||= [];
      seed = snapshot.seed;
      runId = storeView.active.id;
      runRevision = storeView.active.revision;
      g.persisted = true;
      if (runRules().runSeconds === 180)
        notify("继续原短局 · 下一局15分钟、6+6");
      else if (!newProgression()) notify("继续原等级规则 · 新开一局启用5＋5");
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
  function updateAudioSettings() {
    const settings = window.SurvivorAudio?.inspect().settings;
    if (!settings) return;
    for (const kind of ["music", "sfx"]) {
      $(kind + "Volume").value = Math.round(settings[kind] * 100);
      $(kind + "VolumeValue").textContent =
        Math.round(settings[kind] * 100) + "%";
    }
    $("audioMuteBtn").textContent = settings.muted ? "开启声音" : "静音";
    $("audioMuteBtn").setAttribute?.("aria-pressed", String(settings.muted));
    $("audioStatus").textContent = settings.muted
      ? "已静音"
      : "Nebula Groove / Nebula Loop · 交替循环";
  }
  function configureAudio(change) {
    window.SurvivorAudio?.configure(change);
    try {
      localStorage.setItem(
        "loststar.survivor.audio.v1",
        JSON.stringify(window.SurvivorAudio?.inspect().settings),
      );
    } catch {}
    updateAudioSettings();
  }
  function initializeAudioSettings() {
    try {
      const saved = JSON.parse(
        localStorage.getItem("loststar.survivor.audio.v1") || "null",
      );
      if (saved)
        window.SurvivorAudio?.configure(
          Object.fromEntries(
            ["master", "music", "sfx", "muted"]
              .filter((key) => key in saved)
              .map((key) => [key, saved[key]]),
          ),
        );
    } catch {}
    for (const kind of ["music", "sfx"])
      $(kind + "Volume").addEventListener("input", (event) =>
        configureAudio({ [kind]: Number(event.target.value) / 100 }),
      );
    $("audioMuteBtn").onclick = () =>
      configureAudio({
        muted: !window.SurvivorAudio?.inspect().settings.muted,
      });
    updateAudioSettings();
  }
  function showStart() {
    window.SurvivorAudio?.setState({ playing: false, paused: false });
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
      ? "继续上次 · " +
        fmt(active.snapshot.game.time) +
        (!assaultCombat(active.snapshot.game) ? " · 原规则" : "")
      : "继续上次";
    $("startBtn").disabled = !ready;
    $("startBtn").textContent = active
      ? assaultCombat(active.snapshot.game)
        ? "结算上局，开始15分钟"
        : "结算上局，开始新版"
      : "开始一局";
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
    syncAudioState();
    $("resultState").textContent = committed ? "本局已归档" : "结算等待保存";
    $("resultTitle").textContent = summary.victory
      ? summary.endTime >= 900
        ? "十五分钟，穿过星海"
        : summary.endTime >= 600
          ? "十分钟，穿过星海"
          : "三分钟，稳稳归来"
      : "下一局，会更强";
    $("resultDesc").textContent = summary.victory
      ? summary.bossKilled
        ? "守卫已击退。带着新武装，再试一种搭配。"
        : "坚持到了最后。下次，试着击退守卫。"
      : "带回已收集的零件，整备后再出发。";
    const encounters = summary.encounters || [];
    $("resultEncounters").hidden = encounters.length === 0;
    $("resultEncounters").textContent = encounters.length
      ? "途中奇遇 " +
        encounters.length +
        " 次 · 击退 " +
        encounters.filter((event) => event.result === "repelled").length +
        " 次"
      : "";
    $("encounterNotice").hidden = true;
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
    if (!g || ["INPUT", "TEXTAREA", "SELECT"].includes(event.target?.tagName))
      return;
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
  window.addEventListener("blur", () => {
    pause();
    window.SurvivorAudio?.setState({ playing: false, paused: true });
  });
  window.addEventListener("focus", syncAudioState);
  window.addEventListener("orientationchange", () => {
    pause();
    resize();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      window.SurvivorAudio?.setState({ playing: false, paused: true });
      releaseInput();
      pause();
      void saveCheckpoint();
    }
  });
  window.addEventListener("pagehide", () => {
    window.SurvivorAudio?.setState({ playing: false, paused: true });
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
        resetWorld(value >>> 0);
        g.persisted = false;
        return g;
      },
      legacyProgression: () => {
        g.rules.combatVersion = 2;
        g.rules.runSeconds = 600;
        g.endTime = 600;
        g.xpNext = 112;
        delete g.rules.progressionVersion;
        return g;
      },
      legacyV065: () => {
        g.rules.version = "0.6.5";
        g.rules.combatVersion = 4;
        return g;
      },
      spawn: spawnEnemy,
      legacyV064: () => {
        g.rules.version = "0.6.4";
        g.rules.combatVersion = 3;
        return g;
      },
      legacyV063: () => {
        g.rules.version = "0.6.3";
        g.rules.combatVersion = 2;
        g.rules.runSeconds = 600;
        g.endTime = 600;
        g.xpNext = 72;
        return g;
      },
      reward: (forcedRoll) => {
        queueBossReward({ id: ++g.numberSpawned, t: "elite" });
        g.mode = "play";
        const opened = openBossReward();
        if (opened && typeof forcedRoll === "boolean") {
          g.upgradeSource.advancedRoll = forcedRoll;
          renderUpgrades();
        }
        return opened;
      },
      snapshot: captureSnapshot,
      validate: validateSnapshot,
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
      enemy: (type, x, y, hp = 1000, profile = "hunter") => {
        const enemy = spawnEnemy(
          type,
          1,
          profile,
          B.showcase.bossProfiles[profile] ? profile : "core",
        );
        if (!enemy) return null;
        Object.assign(enemy, { x, y, hp, maxhp: hp, speed: 0, fire: 999 });
        if (showcaseCombat() && ["elite", "boss"].includes(type))
          enemy.facing = angle(enemy, g.p) + Math.PI / 2;
        if (assaultCombat() && type === "elite") {
          enemy.barrier = Math.round(hp * eliteSpec(enemy).barrier);
          enemy.maxBarrier = enemy.barrier;
        }
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
  initializeAudioSettings();
  void initialize();
  raf = requestAnimationFrame(loop);
})();
