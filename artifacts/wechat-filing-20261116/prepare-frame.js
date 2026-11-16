async function (plan) {
  const root = globalThis.Loststar || globalThis.GameGlobal?.Loststar || globalThis.__gameContextWindow?.Loststar;
  if (!root?.SurvivorDemo.ready() || !root.SurvivorQA) throw Error("Isolated native QA runtime required");
  const q = root.SurvivorQA;
  const g = q.startModel(plan.seed, { hull: 2, gun: 1 });
  const picks = [];
  for (const [id, target] of Object.entries(plan.equipment)) {
    while ((g.active[id] || g.passive[id] || 0) < target) {
      q.level();
      if (!q.pick(id)) throw Error("Illegal equipment selection: " + id);
      picks.push(id);
    }
  }
  const milestones = root.SurvivorBalance.showcase.milestones;
  g.time = plan.time;
  g.milestoneSeen = milestones.filter(m => m.at < plan.time || (plan.kind !== "boss" && m.at <= plan.time + 10)).map(m => m.type + ":" + m.at);
  if (plan.kind === "visitor") {
    const visit = g.encounters.schedule.find(e => e.kind === plan.visitor);
    g.time = visit.at - 0.01;
    g.encounters.seen = g.encounters.schedule.filter(e => e.kind !== plan.visitor).map(e => e.kind);
  } else {
    g.encounters.seen = g.encounters.schedule.map(e => e.kind);
  }
  let remaining = plan.seconds;
  while (remaining > 0 && g.mode !== "results" && g.mode !== "settling") {
    if (g.mode === "upgrade") {
      if (!q.select(0)) throw Error("Cannot resolve earned upgrade");
    }
    if (g.mode !== "play") throw Error("Unexpected mode: " + g.mode);
    q.step(Math.min(0.2, remaining));
    remaining -= 0.2;
  }
  // Freeze the actual rendered frame for a deterministic IDE screenshot.
  // No art, UI text, damage, enemy health, or entity placement is fabricated.
  g.mode = "pause";
  q.validate(q.snapshot());
  q.runRender();
  root.SurvivorNativeUI.draw();
  return {
    plan, storage: q.storageName(), build: root.SurvivorBuild,
    size: [root.SurvivorNative.canvas.width, root.SurvivorNative.canvas.height],
    time: g.time, level: g.level, hp: g.p.hp, maxhp: g.p.maxhp,
    equipment: { active: g.active, passive: g.passive, evolved: g.evolved, fused: g.fused },
    enemies: g.enemy.map(e => ({ type: e.t, boss: e.bossProfile, elite: e.eliteProfile, x: e.x, y: e.y, hp: e.hp })),
    encounters: g.encounters, picks,
    capture: "Native WeChat Devtools screenshot; isolated QA checkpoint; actual controller and assets"
  };
}
