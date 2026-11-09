(async function () {
  "use strict";
  const E = window.LostCargo,
    $ = (s) => document.querySelector(s),
    esc = (v) =>
      String(v ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
  const I = window.SalvageIcons,
    icon = I.icon;
  let cargoDraft = null,
    cargoDraftRevision = null,
    cargoReturnTab = "play",
    routeSelected = null;
  const scrollPositions = new Map(),
    routeScrollPositions = new Map();
  let state,
    tab = "play",
    storageOK = true,
    blocked = false,
    busy = false,
    toastTimer,
    modalAction = null,
    lastInput = -Infinity;
  let initialSeed = (() => {
    try {
      return crypto.getRandomValues(new Uint32Array(1))[0];
    } catch {
      return Date.now() >>> 0;
    }
  })();
  const controller = await window.SalvageStore.open(initialSeed);
  state = controller.state;
  storageOK = controller.persisted;
  blocked = controller.blocked || !controller.readable;
  const raw = !controller.created;
  let inputRevision = controller.revision,
    lastCommand = -Infinity;
  let observedStorageRevision = controller.revision, closingModalHistory = false;
  const cargoUI = window.SalvageCargoView.create({
    engine: E,
    icons: I,
    onNotice: toast,
    onCommit: async (payload) => {
      const command = {
        ...(payload.action || { type: "layout" }),
        layout: payload.placements,
        discardUids: payload.discard || payload.discardUids || [],
      };
      return act(
        command,
        payload.revision ?? controller.revision,
        command.type === "layout" ? "cargo" : command.type === "depart" ? "route" : "play",
      );
    },
    onCancel: () => {
      const previousTab = cargoReturnTab;
      cargoDraft = null;
      cargoDraftRevision = null;
      if (tab === "cargo") {
        tab = previousTab;
        render(true);
      }
    },
    onAction: (name, item) => cargoAction(name, item),
    onMission: record => {if(!record)return;const expected=controller.revision;modal('放弃测绘任务？','<p>记录箱会离船，本趟不再结算180零件委托报酬。普通货物保留。</p>','确认放弃',()=>act({type:'discardMission',id:record.uid},expected,'cargo'));},
  });
  function units(text){return String(text??'');}

  function cargoAction(name, item) {
    if (!item) return;
    const expected = controller.revision;
    if (name === "discard")
      modal(
        "放弃这件货物？",
        `<p>${esc(item.name)}将离开货舱，不获得零件。${item.contract ? "放弃记录箱也会失去本趟180零件委托报酬。" : ""}</p>`,
        "确认放弃",
        () => act({ type: "discard", id: item.uid }, expected, "cargo"),
      );
    else if (name === "sell" || name === "use")
      act({ type: name, id: item.uid }, expected, "cargo");
  }
  function beginCargo(command) {
    if (!storageOK || blocked || busy)
      return toast("当前无法提交，请先处理存档");
    const draft = E.cargoDraft(state, command);
    if (!draft.ok) return toast(draft.message);
    cargoReturnTab = tab;
    cargoDraft = draft;
    cargoDraftRevision = controller.revision;
    tab = "cargo";
    render(true);
  }
  function switchTab(next) {
    scrollPositions.set(tab, window.scrollY);
    const routeArea = $(".route-scroll");
    if (routeArea)
      routeScrollPositions.set(
        `${state.runNo}:${state.depth}:${state.phase}`,
        routeArea.scrollTop,
      );
    tab = next;
    render();
    window.scrollTo({ top: scrollPositions.get(next) || 0, behavior: "auto" });
  }
  function choiceChips(c) {
    const e = c.effect || {},
      chips = [];
    const chip = (name, value, label, cls = "") =>
      `<span class="cost-chip ${cls}">${icon(name)} ${value} ${label}</span>`;
    if (e.money)
      chips.push(
        chip(
          "money",
          (e.money > 0 ? "+" : "") + e.money,
          "零件",
          e.money > 0 ? "positive" : "negative",
        ),
      );
    if (e.fuel < 0) chips.push(chip("fuel", e.fuel, "探索油", "negative"));
    const afterSpend = state.fuel + Math.min(0, e.fuel || 0);
    const gainFuel = Math.min(
      100 - afterSpend,
      Math.max(0, e.fuel || 0) + (e.bonusFuel || 0),
    );
    if (gainFuel) chips.push(chip("fuel", "+" + gainFuel, "燃料", "positive"));
    if (e.hull)
      chips.push(
        chip(
          "hull",
          (e.hull > 0 ? "+" : "") + Math.min(e.hull, 100 - state.hull),
          "耐久",
          e.hull > 0 ? "positive" : "negative",
        ),
      );
    if (c.risk)
      chips.push(
        chip("warning", `−${c.risk[0]}～${c.risk[1]}`, "耐久风险", "risk"),
      );
    if (e.loot?.length)
      chips.push(
        chip(
          "cargo",
          e.loot.reduce((n, x) => n + x.cells, 0),
          "小格待装载",
        ),
      );
    if (c.tool)
      chips.push(
        chip(
          c.tool === "scanner" ? "scan" : "repair",
          "",
          c.tool === "scanner" ? "扫描仪" : "牵引绞盘",
        ),
      );
    return chips.length
      ? `<div class="cost-chips">${chips.join("")}</div>`
      : "";
  }
  function toast(t) {
    $("#toast").textContent = t;
    $("#toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($("#toast").hidden = true), 2800);
  }
  function active() {
    return ["route", "event", "result"].includes(state.phase);
  }
  function button(label, action, cls = "", disabled = false) {
    disabled =
      disabled ||
      (!storageOK &&
        ([
          "depart",
          "fuel",
          "repair",
          "aid",
          "sellAll",
          "continue",
          "abort",
        ].includes(action) ||
          /^(pay|buy-|feedback-)/.test(action)));
    return `<button class="${cls}" data-rev="${controller.revision}" data-act="${action}" ${disabled ? "disabled" : ""}>${label}</button>`;
  }
  function picture(type = "port", caption = "") {
    let image =
      type === "port"
        ? "port"
        : type === "station"
          ? "harbor"
          : ["wreck", "route", "anomaly", "cabin"].includes(type)
            ? "wreck"
            : null;
    return `<div class="hero ${type === "port" ? "" : "short"}">${image && ART[image] ? `<img src="${ART[image]}" alt="${type === "port" ? "停靠在港口的旧飞船" : type === "wreck" ? "静默的空间残骸" : "轨道港口"}">` : spaceArt(type)}${(!image || !ART[image]) && ART.ship ? `<img class="salvage-ship" src="${ART.ship}" alt="失物号民用飞船">` : ""}${caption ? `<div class="caption">${caption}</div>` : ""}</div>`;
  }
  function spaceArt(kind) {
    return `<svg class="hero-svg" viewBox="0 0 420 190" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="sky"><stop stop-color="#745a85"/><stop offset="1" stop-color="#26273e"/></radialGradient><linearGradient id="orb"><stop stop-color="#ba8ea9"/><stop offset=".5" stop-color="#665a82"/><stop offset="1" stop-color="#383d60"/></linearGradient></defs><rect width="420" height="190" fill="url(#sky)"/><g fill="#efcaa6" opacity=".8">${Array.from({ length: 31 }, (_, i) => `<rect x="${(i * 43 + 19) % 415}" y="${(i * 67 + 9) % 187}" width="${i % 5 === 0 ? 3 : 1.5}" height="${i % 5 === 0 ? 3 : 1.5}"/>`).join("")}</g><circle cx="320" cy="75" r="62" fill="url(#orb)"/><path d="M263 66q55 25 113-5M263 97q66 21 108-3" fill="none" stroke="#b29abb" stroke-width="6" opacity=".4"/>${ART.ship ? "" : `<g transform="translate(95 80)"><path d="M0 25L24 8H88L107 31L93 47H15Z" fill="#a9a1b6" stroke="#3a304c" stroke-width="4"/><path d="M45 9L56 0H75L83 9" fill="#94869f" stroke="#392e48" stroke-width="4"/><path d="M20 22H41V34H12ZM49 21H63V34H49ZM69 21H83V34H69Z" fill="#8eb5cc"/><path d="M37 45L31 58H75L81 45" fill="#d2b8a4" stroke="#3a304c" stroke-width="3"/><rect x="90" y="28" width="17" height="8" fill="#d69a7e"/><path d="M0 28L-22 33L0 38" fill="#92cfe5"/></g>`}<path d="M28 153Q180 125 255 160" stroke="#c9ab87" opacity=".6" stroke-dasharray="3 8" fill="none"/></svg>`;
  }
  function reserveBox() {
    return `<div class="reserve"><div class="row"><span>${icon("return")} 现在回港需 <b class="num">${E.homeCost(state)}</b> ${icon("fuel")}燃料</span><span>探索余油 <b class="num">${E.spare(state)}</b></span></div><p class="note" style="margin-bottom:0">越深入，前进与返航都更费油。加油不会缩短已走距离。</p></div>`;
  }
  function port() {
    const fuel = E.portQuote(state, "buyFuel"),
      repair = E.portQuote(state, "repair");
    let debt = 12000 - state.debt;
    return `<div class="section-head"><div><div class="eyebrow">LOST CARGO / HOME PORT</div><h1>望潮港</h1></div><span class="tag">第${state.runNo + 1}趟准备</span></div><section class="panel"><div class="debt"><div><small>${icon("debt")}剩余船款</small><div class="badge">没有利息 · 没有离线罚款</div></div><b class="num">${state.debt.toLocaleString()}</b></div><div class="bar"><i style="width:${debt / 120}%"></i></div><p class="note" style="margin-bottom:0">已还 ${debt.toLocaleString()} / 12,000。第一步：平安带回一趟收获。</p></section>${picture("port", "失物号 · 二手民用接驳船<small>船不新了，远处还有新的东西。</small>")}${button(icon("ship") + "出发 · 废环回收线", "depart", "primary full")}<div class="spacer"></div><section class="panel"><h3>${icon("contract")}本趟委托 · 航区测绘</h3><p class="note">带着记录箱探索至少3处航点，再返回港口。记录箱使用独立任务槽，不占货舱。不要求走满8站。</p><div class="section-head" style="margin:0"><b style="color:var(--amber)">报酬 180 零件</b><small>安全返港后自动结算</small></div></section><div class="split">${button(`<strong>${icon("fuel")}补充燃料 +${fuel.amount}</strong><small>实付${fuel.cost}零件 · 每点2零件</small>`, "fuel", "", !fuel.amount)}${button(`<strong>${icon("hull")}维修船体 +${repair.amount}</strong><small>实付${repair.cost}零件 · 每点2零件</small>`, "repair", "", !repair.amount)}</div><p class="note">最多8站。返航由你决定；不要求在线等计时。剩余油量、船况与收入会延续到下一趟。</p><div class="split">${button("改装设备", "tools", "ghost")}${button("偿还船款", "repay", "ghost")}</div>${state.cargo.length ? `<div class="spacer"></div>${button("货舱已用 " + E.used(state) + " / 16 小格 · 查看／出售", "cargo", "full")}` : ""}${E.preparation(state).needsAid ? `<div class="spacer"></div>${button("码头短工 · 获取基本补给", "aid", "full")}<p class="note">保底救助，不加船债、不需要广告。</p>` : ""}`;
  }
  function route(){return window.SalvageRouteView.render(state,{selectedUid:routeSelected,disabled:!storageOK||blocked});}

  function event() {
    const ev=E.encounter(state),intro=ev.text.split('。')[0]+'。';
    return '<div class="section-head"><div><div class="eyebrow">ENCOUNTER / '+state.depth+'</div><h1>探索现场</h1></div><span class="tag">'+icon('fuel')+'返航 '+E.homeCost(state)+'</span></div>'+picture(ev.kind)+'<section class="panel event-intro"><h2>'+icon(I.routeIcon(ev))+esc(ev.title)+'</h2><p>'+esc(intro)+'</p><details class="event-story"><summary>现场记录</summary><p>'+esc(ev.text)+'</p></details></section><div class="event-options">'+ev.choices.map(c=>{const err=E.checkChoice(state,c,{ignoreCargo:true});return '<button class="choice" data-choice="'+esc(c.id)+'" data-nonce="'+esc(ev.nonce)+'" '+(err?'disabled':'')+'><strong>'+icon(I.choiceIcon(c))+esc(c.label)+icon('arrow','choice-arrow')+'</strong>'+((c.effect.remove||!Object.keys(c.effect).length)?'<small>'+esc(c.desc)+'</small>':'')+choiceChips(c)+((c.risk?.[1]||-(c.effect.hull||0))>=state.hull?'<small class="risk">可能触发拖航救援</small>':'')+(err?'<small>'+icon('warning')+esc(err)+'</small>':'')+'</button>';}).join('')+'</div>'+reserveBox()+'<div class="split">'+button(icon('cargo')+'货舱','cargo','ghost')+button(icon('return')+'返港','home','ghost')+'</div>';
  }

  function result() {
    const r = state.result;
    const delta = r.delta
      ? [
          ["fuel", "燃料", r.delta.fuel],
          ["hull", "耐久", r.delta.hull],
          ["money", "零件", r.delta.money],
          ["cargo", "货舱小格", r.delta.cargoCells],
        ]
          .filter(([, , n]) => n)
          .map(
            ([id, label, n]) =>
              `<span class="change ${n > 0 ? "positive" : "negative"}">${icon(id)}${label} ${n > 0 ? "+" : ""}${n}</span>`,
          )
          .join("")
      : r.changes.map((x) => `<span>${esc(units(x))}</span>`).join("");
    const goods = [...(r.cargoChanges?.added || []).map(x=>`<span class="change positive">${icon('cargo')}装入：${esc(x.name)}</span>`), ...(r.cargoChanges?.removed || []).map(x=>`<span class="change negative">${icon(x.reason==='sale'?'trade':'leave')}${x.reason==='sale'?'售出':'放弃'}：${esc(x.name)}</span>`)].join('');
    return `<div class="eyebrow">CHOICE RECORDED</div><section class="panel" style="margin-top:15px"><div class="result-mark">${icon("check")}</div><h2 style="text-align:center">${esc(r.title)}</h2><p class="lead" style="margin-top:18px">${esc(r.text)}</p><div class="changes">${delta || goods ? delta + goods : "<span>资源未变化</span>"}</div></section>${reserveBox()}${button(icon("route") + (state.depth >= 8 ? "查看返航路线" : "继续查看航路"), "continue", "primary full")}<div class="spacer"></div>${button(icon("return") + `见好就收 · 返航需${E.homeCost(state)}燃料`, "home", "full ghost")}`;
  }
  function summary(){
    const r=E.summaryView(state);
    return '<div class="eyebrow">VOYAGE '+r.run+' / RETURN</div><h1>'+ (r.rescue?'已被拖回港口':'平安归航')+'</h1><div class="stats-grid"><div><b>'+r.depth+'</b><small>探索航点</small></div><div><b>'+E.cargoValue(state)+'</b><small>未售货值</small></div><div><b>'+(r.cashDelta>=0?'+':'')+r.cashDelta+'</b><small>现金实际变动</small></div></div>'+(E.cargoValue(state)?button(icon('trade')+'出售回收货 · +'+E.cargoValue(state)+'零件','sellAll','primary full'):'')+'<div class="spacer"></div>'+button(icon('port')+'港口补给 / 再出发','port','full')+'<div class="spacer"></div>'+button('查看保留的货物','cargo','ghost full')+(r.rescue?'<p class="note">本趟失去'+r.lost+'件新货；旧货和永久工具保留。拖航实付'+r.rescueFee+'零件。</p>':'<p class="note">返航实耗'+r.returnFuel+'燃料；货物、补给和还款仍由你决定。</p>')+
      `<details class="voyage-ledger panel"><summary>本趟账目</summary><div class="ledger"><span>途中收入（非售货）</span><b class="positive">+${r.eventIncome}</b><span>委托结算</span><b class="positive">+${r.reward}</b><span>途中服务支出</span><b class="negative">−${r.spent}</b>${r.rescue ? `<span>拖航实付</span><b class="negative">−${r.rescueFee}</b>` : ""}<span>本趟新货已售</span><b class="positive">+${r.salesCurrent}</b><span>跨趟旧货已售</span><b class="positive">+${r.salesCarried}</b><span>港口油料／维修</span><b class="negative">−${r.supplySpent + r.repairSpent}</b><span>设备／还款</span><b class="negative">−${r.toolSpent + r.debtPaid}</b><span>新收获已实现收支</span><b>${r.operatingNet}</b><span class="total">现金实际变动</span><b class="total">${r.cashDelta >= 0 ? "+" : ""}${r.cashDelta}</b></div><p class="note">未售货不是现金；只计实际补给与维修。旧货、设备和还款分列，未做的补给不预扣。${r.legacy?'旧版历史明细无法完整追溯，余额保留。':''}</p></details>`+'<details class="feedback"><summary>记录本趟感受（可不填）</summary><div class="split">'+button('平稳','feedback-steady')+button('紧张','feedback-tense')+button('没看懂','feedback-unclear')+button('暂不回答','feedback-skip')+'</div></details>';
  }

  function cargo(){
    let summaryHTML='',costHTML='';
    if(cargoDraft?.action.type==='choose'&&state.phase==='event'){const choice=E.encounter(state).choices.find(c=>c.id===cargoDraft.action.id);if(choice){summaryHTML='<h3>'+icon(I.choiceIcon(choice))+esc(choice.label)+'</h3>';costHTML=choiceChips(choice);}}
    else if(cargoDraft?.action.type==='depart')summaryHTML='<h3>'+icon('contract')+'接受测绘委托</h3><p>完成3站并安全带回记录箱，按原规则结算180零件。</p>';
    return cargoUI.render(state,{draft:cargoDraft,revision:cargoDraftRevision??controller.revision,disabled:!storageOK||blocked||busy,summaryHTML,costHTML});
  }

  function journal() {
    return `<div class="section-head"><div><div class="eyebrow">LOCAL FLIGHT LOG</div><h1>${icon("journal")}航行手记</h1></div><span class="tag">${state.archive.length}件见闻</span></div><p class="note">只记录已经发生的事情。卖掉货物，不会抹掉见闻。</p>${state.archive.length ? `<section class="panel"><h3>带上过船的物件</h3><div class="changes">${state.archive.map((x) => `<span>${esc(x.name)}</span>`).join("")}</div></section>` : ""}<section class="panel">${
      state.log.length
        ? [...state.log]
            .reverse()
            .slice(0, 40)
            .map(
              (x) =>
                `<div class="log-item"><small>第${x.run}趟 · ${x.depth ? `航点${x.depth}` : "港口"}</small>${esc(x.text)}</div>`,
            )
            .join("")
        : '<div class="empty">下一页，等你自己填写。</div>'
    }</section>`;
  }
  function render(resetScroll = false) {
    document.body.classList.toggle('cargo-screen',tab==='cargo'&&!blocked);
    document.body.dataset.phase=state.phase;document.body.dataset.screen=tab;
    if (tab !== "cargo") cargoUI.unmount();
    const health = $("#storage-warning");
    health.hidden = storageOK && !blocked;
    if (!health.hidden)
      health.textContent = blocked
        ? "档案校验失败，原数据保留。当前只读，请导出原始备份或导入有效存档。"
        : "保存不可用，操作不会提交。请导出当前档案或在设置中重试。";
    $("#resources").innerHTML = [
      [
        "燃料",
        "fuel",
        state.fuel + "/100",
        state.fuel <= E.homeCost(state) + 8 && active(),
        state.fuel,
        "油量偏低",
      ],
      [
        "耐久",
        "hull",
        state.hull + "/100",
        state.hull < 30,
        state.hull,
        "船体受损",
      ],
      ["零件", "money", state.money.toLocaleString(), false, null, ""],
      [
        "货舱",
        "cargo",
        E.used(state) + "/" + state.capacity * 4,
        E.used(state) === 16,
        null,
        "已装满",
      ],
    ]
      .map(
        ([label, id, value, low, meter, warning]) =>
          `<div class="resource ${low ? "low" : ""}"><span class="resource-label">${icon(id)}${label}</span><b class="num">${value}</b>${meter === null ? "" : `<span class="resource-meter" aria-hidden="true"><i style="width:${meter}%"></i></span>`}${low ? `<small class="low-label">${warning}</small>` : ""}</div>`,
      )
      .join("");
    const routeKey = `${state.runNo}:${state.depth}:${state.phase}`;
    const previousMap = $(".route-scroll");
    if (previousMap && tab === "route")
      routeScrollPositions.set(routeKey, previousMap.scrollTop);
    const body =
      tab === "cargo"
        ? cargo()
        : tab === "route"
          ? window.SalvageRouteView.render(state, {
              selectedUid: routeSelected,
              disabled: !storageOK || blocked,
            })
          : tab === "journal"
            ? journal()
            : state.phase === "port"
              ? port()
              : state.phase === "route"
                ? route()
                : state.phase === "event"
                  ? event()
                  : state.phase === "result"
                    ? result()
                    : summary();
    $("#main").innerHTML =
      '<div class="reveal">' +
      (blocked
        ? '<section class="panel"><h2>档案暂未接通</h2><p>原数据保留，请打开设置处理。</p></section>'
        : body) +
      `</div><div class="footer-note">开发自测 ${E.VERSION} · ${(window.LostCargoBuild?.commit || "dev").slice(0, 7)} · ${storageOK ? "已保存" : "未保存"}<br>没有广告 · 没有真实支付</div>`;
    $("#nav").innerHTML = [
      ["play", active() ? "ship" : "port", active() ? "航行" : "港口"],
      ["route", "route", "航路"],
      ["cargo", "cargo", "货舱"],
      ["journal", "journal", "航记"],
    ]
      .map(
        ([id, ic, label]) =>
          `<button data-tab="${id}" class="${tab === id ? "active" : ""}" ${tab === id ? 'aria-current="page"' : ""}>${icon(ic)}${label}</button>`,
      )
      .join("");
    if (!storageOK || blocked)
      $("#main")
        .querySelectorAll(
          "[data-travel],[data-choice],[data-sell],[data-use],[data-discard]",
        )
        .forEach((b) => (b.disabled = true));
    $("#main")
      .querySelectorAll("button")
      .forEach((b) => (b.dataset.rev = String(controller.revision)));
    if (blocked)
      $("#resources")
        .querySelectorAll("b")
        .forEach((b) => (b.textContent = "—"));
    document.documentElement.style.setProperty("--dock-height",$("#nav").getBoundingClientRect().height+"px");
    if (tab === "cargo" && !blocked) cargoUI.mount($("#main"));
    if (tab === "route" && !blocked)
      window.SalvageRouteView.focusCurrent(
        $("#main"),
        routeScrollPositions.get(routeKey),
      );
    if (resetScroll) window.scrollTo({ top: 0, behavior: "auto" });
  }
  async function act(command, expected = inputRevision, nextTab = "play") {
    if (busy || !storageOK || blocked)
      return { ok: false, message: "当前不能提交，请先在设置中处理保存" };
    if (performance.now() - lastCommand < 450)
      return { ok: false, message: "请稍候，上一项操作正在落定" };
    lastCommand = performance.now();
    const savedScroll=window.scrollY,retainScroll=nextTab===tab&&["buyFuel","repair","layout","sell","sellAll","use"].includes(command.type);
    busy = true;
    let r;
    try {
      r = await controller.act(command, expected);
      state = controller.state;
      storageOK = controller.persisted;
      blocked = controller.blocked || !controller.readable;
      if (!r.ok) {
        toast(r.message);
        if (controller.revision !== expected) {
          cargoDraft = null;
          cargoDraftRevision = null;
        }
      } else {
        cargoDraft = null;
        cargoDraftRevision = null;
        routeSelected = null;
        tab = nextTab;
        if (command.type === "layout") toast("货舱排布已保存");
      }
    } finally {
      busy = false;
      render(!!r?.ok&&!retainScroll);
      if(retainScroll)window.scrollTo({top:savedScroll,behavior:"auto"});
    }
    return r;
  }
  async function replaceState(value, expected) {
    if (busy) return;
    busy = true;
    try {
      const r = await controller.replace(value, expected);
      if (!r.ok) toast(r.message);
      else {
        cargoDraft = null; cargoDraftRevision = null; routeSelected = null;
        tab = "play";
        close();
      }
    } finally {
      busy = false;
      state = controller.state;
      storageOK = controller.persisted;
      blocked = controller.blocked || !controller.readable;
      render(true);
    }
  }
  function modal(title, html, confirmLabel, action) {
    if ($("#overlay").hidden && !history.state?.salvageModal)
      history.pushState({ salvageModal: true }, "");
    modalAction = action;
    $("#modal-title").textContent = title;
    $("#modal-body").innerHTML = html;
    $("#modal-buttons").innerHTML = confirmLabel
      ? button("暂不操作", "close", "ghost") +
        button(esc(confirmLabel), "confirm", "primary")
      : button("知道了", "close", "primary");
    $("#overlay").hidden = false;
    $("#modal-close").focus();
  }
  function close(fromPop = false) {
    modalAction = null;
    $("#overlay").hidden = true;
    if (!fromPop && !closingModalHistory && history.state?.salvageModal) {closingModalHistory = true; history.back();}
  }
  function tools() {
    modal(
      "港口改装",
      `<p>工具不是纯数值加速，它们能在部分遭遇中提供新的处理办法。只在港口购买，之后一直保留。</p><div class="panel"><h3>扫描仪 · 240零件</h3><p>帮助识别某些异常和回收方式。</p>${button(state.tools.includes("scanner") ? "已安装" : "安装扫描仪", "buy-scanner", "full primary", state.tools.includes("scanner") || state.money < 240)}</div><div class="panel"><h3>牵引绞盘 · 280零件</h3><p>部分重型回收可以减少损伤或占用。</p>${button(state.tools.includes("winch") ? "已安装" : "安装牵引绞盘", "buy-winch", "full primary", state.tools.includes("winch") || state.money < 280)}</div>`,
    );
  }
  function repay() {
    modal(
      "偿还船款",
      `<p>还款由你主动决定，不会把本趟利润自动扣走。至少保留50零件作下次补给。</p><h2 class="num">剩余 ${state.debt.toLocaleString()}</h2><div class="spacer"></div><div class="split">${button("归还100", "pay100", "primary", state.money < Math.min(100, state.debt) + 50 || !state.debt)}${button("归还500", "pay500", "primary", state.money < Math.min(500, state.debt) + 50 || !state.debt)}</div>`,
    );
  }
  function settings() {
    modal(
      "规则与存档",
      `<div class="help-rule"><b>你的目标</b><p>开着二手船跑航线，把收获带回港口，慢慢还清12,000零件船款。没有时限、利息、挂机罚款。</p></div><div class="help-rule"><b>油耗会随深入增加</b><p>每站前进费用逐步提高。返航油耗 = 3 + 已走航线距离的一半（向上取整）。距离使用各次航行实际耗油记录，加油不会减少它。第1～8站的基础前进油耗为${E.LEG.join("、")}，支线另有少量差别。</p></div><div class="help-rule"><b>保持可返航</b><p>选择下一站前，必须有足够油抵达并预留新的返航费用。事件使用探索余油，不动返航储备。船体仍然可能损坏，请看清选择上的代价。</p></div><div class="help-rule"><b>不必走完8站</b><p>探索3站即可满足本趟测绘委托。早回来不是失败。全程没有强制倒计时；离线时不会偷偷损耗资源。</p></div><div class="help-rule"><b>保存方式</b><p>只保存到本浏览器的独立本地存档，刷新继续。文件移动、更换浏览器或清理数据可能使存档不可见，请导出备份。与旧版《失物星球》完全隔离。</p></div><div class="split" style="margin-top:15px">${button("导出存档", "export", "primary")}${button("导入存档", "import")}</div><div class="spacer"></div>${button("导出试玩反馈（不含未遇事件）", "report", "full")}<div class="spacer"></div>${button("重试保存", "retry", "full")}<p class="note">无联网、无广告SDK、无真实付款。当前使用开发后备画面，美术仍待审核。</p>`,
    );
  }
  function download(name, data) {
    const b = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(b),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function action(name) {
    if (name === "close") {
      close();
      return;
    }
    if (name === "confirm") {
      const f = modalAction;
      close();
      f?.();
      return;
    }
    if (name === "settings") {
      settings();
      return;
    }
    if (["cargo", "journal", "play", "route"].includes(name)) {
      switchTab(name);
      return;
    }
    if (name === "depart") {
      beginCargo({ type: "depart" });
      return;
    }
    if (name === "home") {
      modal(
        "现在返航？",
        `<p>消耗 <b>${E.homeCost(state)} 燃料</b>，带回当前货物。${state.phase === "event" ? "当前未处理的现场将放弃。" : ""}</p><p>不会自动卖货、维修或偿还船款。</p>`,
        "确认返航",
        () => act({ type: "return" }),
      );
      return;
    }
    if (name === "rescue") {
      modal(
        "呼叫普通救援",
        `<p>本趟货物抵扣拖航费用，现金最多再扣50零件。带回基本油料与可航行船体；已发现见闻保留，不增加债务。</p>`,
        "接受救援",
        () => act({ type: "rescue" }),
      );
      return;
    }
    if (name === "tools") {
      tools();
      return;
    }
    if (name === "repay") {
      repay();
      return;
    }
    if (name === "export") {
      download("lostcargo-save-" + Date.now() + ".json", controller.export());
      return;
    }
    if (name === "report") {
      download("lostcargo-feedback-" + Date.now() + ".json", {
        version: E.VERSION,
        runNo: state.runNo,
        fuel: state.fuel,
        hull: state.hull,
        money: state.money,
        debt: state.debt,
        summary: E.summaryView(state),
        log: state.log,
        decisions: state.telemetry,
        ledger: state.ledger,
      });
      return;
    }
    if (name === "import") {
      $("#import-file").click();
      return;
    }
    if (name === "retry") {
      void controller.retry();
      close();
      return;
    }
    if (name === "reset") {
      modal(
        "只重开这个Demo",
        `<p>先导出备份。此操作只删除本Demo的测试进度，不接触旧版游戏。将从120零件、60燃料、100耐久开始，航路重新生成。</p>`,
        "确认重开",
        () => {
          void replaceState(E.create(Date.now() >>> 0), inputRevision);
        },
      );
      return;
    }
    if (name.startsWith("feedback-")) {
      act({ type: "feedback", answer: name.slice(9) }).then(() =>
        toast("已记在本地，感谢。"),
      );
      return;
    }
    if (name.startsWith("buy-")) {
      close();
      act({ type: "tool", id: name.slice(4) });
      return;
    }
    if (name.startsWith("pay")) {
      close();
      act({ type: "repay", amount: Number(name.slice(3)) });
      return;
    }
    const map = {
      fuel: "buyFuel",
      repair: "repair",
      depart: "depart",
      continue: "continue",
      port: "port",
      abort: "abort",
      aid: "aid",
      sellAll: "sellAll",
    };
    if (map[name]) act({type:map[name]},inputRevision,map[name]==="continue"?"route":"play");
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b || b.disabled || b.closest("[data-cargo-view]")) return;
    inputRevision = Number(b.dataset.rev ?? controller.revision);
    const a = b.dataset.act || "";
    if (b.dataset.tab) {
      switchTab(b.dataset.tab);
      return;
    }
    if (b.dataset.routeSelect) {
      routeSelected = b.dataset.routeSelect;
      render();
      return;
    }
    if (a) {
      action(a);
      return;
    }
    const now = performance.now();
    if (now - lastInput < 350) return;
    lastInput = now;
    if (b.dataset.travel) act({ type: "travel", id: b.dataset.travel });
    else if (b.dataset.choice) {
      const command = {
        type: "choose",
        id: b.dataset.choice,
        nonce: b.dataset.nonce,
      };
      const c = E.encounter(state).choices.find((x) => x.id === command.id);
      if (c?.effect.loot?.length) beginCargo(command);
      else act(command);
    } else if (b.dataset.sell) act({ type: "sell", id: +b.dataset.sell });
    else if (b.dataset.use) act({ type: "use", id: +b.dataset.use });
    else if (b.dataset.discard) {
      const x = state.cargo.find((x) => x.uid === +b.dataset.discard);
      modal(
        "放弃这件货物？",
        `<p>${esc(x?.name)}将离开货舱，不获得零件。${x?.contract ? "放弃记录箱也会失去本趟180零件委托报酬。" : ""}</p>`,
        "确认放弃",
        () => act({ type: "discard", id: +b.dataset.discard }),
      );
    }
  });
  $("#modal-close").onclick = () => close();
  $("#overlay").addEventListener("click", (e) => {
    if (e.target === $("#overlay")) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!$("#overlay").hidden) close();
      else if (tab === "cargo" && (cargoDraft || cargoUI.dirty()))
        cargoUI.cancel();
    }
    if (e.key === "Tab" && !$("#overlay").hidden) {
      const els = [
          ...$("#overlay").querySelectorAll("button:not(:disabled),input"),
        ],
        first = els[0],
        last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });
  $("#import-file").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      if (f.size > 2000000) throw Error("文件过大");
      const s = E.restore(await f.text());
      modal(
        "使用导入存档？",
        `<p>将替换本Demo当前进度。第${s.runNo}趟，剩余船款${s.debt}。建议先导出当前备份。</p>`,
        "确认导入",
        () => {
          void replaceState(s, inputRevision);
        },
      );
    } catch (err) {
      toast("导入失败，原档未动：" + err.message);
    }
    e.target.value = "";
  });
  controller.subscribe(() => {
    const previous = observedStorageRevision;
    observedStorageRevision = controller.revision;
    state = controller.state;
    storageOK = controller.persisted;
    blocked = controller.blocked || !controller.readable;
    if (!busy && controller.revision !== previous) {
      cargoDraft = null;
      cargoDraftRevision = null;
      routeSelected = null;
      close();
      toast("另一窗口已更新，已同步当前进度；未确认的排布需要重新整理。");
    }
    if (!busy) render();
  });
  window.addEventListener("popstate", () => {
    if (closingModalHistory) {closingModalHistory = false; return;}
    if (!$("#overlay").hidden) {
      close(true);
      return;
    }
    if (tab === "cargo" && (cargoDraft || cargoUI.dirty())) cargoUI.cancel();
    else if (tab !== "play") switchTab("play");
  });
  window.__SALVAGE__ = {
    state: () => E.restore(state),
    status: () => ({
      revision: controller.revision,
      persisted: controller.persisted,
      blocked: controller.blocked,
      error: controller.error,
    }),
    build: window.LostCargoBuild,
    ready: () => !busy && performance.now() - lastCommand >= 450,
  };

  render();
  if (!raw && !blocked && storageOK)
    modal(
      "欢迎登船，船长",
      `<div class="eyebrow">失物号：星海拾荒 · 首航Demo</div><p>你赊来一艘旧民航接驳船，欠下12,000零件。卖家说它九成新，剩下一成是保修。</p><p>先完成一趟回收：选择航点、处理遇见的事，把收获带回港口。走得越远，前进和返航都更费油。</p><p>每趟最多8站；随时可以收手。没有广告，也不会在你离开时替你做危险决定。</p><p class="note">新档：燃料60／耐久100／零件120／货舱4×4，共16小格。途中内容不预先揭示。</p>`,
    );
})();
