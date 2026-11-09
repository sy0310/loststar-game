/* Read-only projection of the actual saved voyage. Rendering never rolls routes. */
(function (root) {
  "use strict";
  const esc = (v) =>
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
  function render(state, options = {}) {
    const E = root.LostCargo,
      I = root.SalvageIcons,
      icon = I.icon;
    const view = E.routeView(state);
    const atHome = state.phase === "port" || state.phase === "summary";
    const active = !atHome;
    const candidates = state.phase === "route" ? view.candidates : [];
    const selected = candidates.find((n) => n.uid === options.selectedUid);
    const nodeSpacing = 104;
    const currentY = 56 + view.nodes.length * nodeSpacing;
    const branchY = currentY + 124;
    const height = Math.max(210, currentY + (candidates.length ? 220 : 120));
    const mainX = 150;
    const nodeHtml = (node, index) => {
      const y = 56 + (index + 1) * nodeSpacing;
      const isCurrent = active && index === view.nodes.length - 1;
      return `<div class="map-stop ${isCurrent ? "is-current" : "is-visited"}" style="top:${y}px" data-route-visited="${esc(node.uid)}"><span class="map-dot">${icon(isCurrent ? "ship" : I.routeIcon(node))}</span><span class="map-stop-label"><b>${esc(node.name)}</b><small>${isCurrent ? "当前位置" : "已走过"} · 第${node.depth}站 · ${icon("fuel")} ${node.legFuel}</small></span>${isCurrent ? '<span class="map-location">在这里</span>' : ""}</div>`;
    };
    const path = view.nodes
      .map(
        (_, i) =>
          `<path class="map-line visited" d="M${mainX} ${56 + i * nodeSpacing + 18}V${56 + (i + 1) * nodeSpacing - 18}"/>`,
      )
      .join("");
    const branchLines = candidates
      .map(
        (n, i) =>
          `<path class="map-line future" d="M${mainX} ${currentY + 18}C${mainX} ${currentY + 65} ${i ? 238 : 62} ${currentY + 65} ${i ? 238 : 62} ${branchY - 17}"/>`,
      )
      .join("");
    const homeLine = view.nodes.length
      ? `<path class="map-line home" d="M${mainX - 20} ${currentY}H28V56H${mainX - 20}"/><path class="home-arrow" d="m${mainX - 26} 51 6 5-6 5"/>`
      : "";
    const branches = candidates
      .map((n, i) => {
        const q = E.quote(state, n),
          chosen = n.uid === selected?.uid;
        return `<button class="map-candidate ${chosen ? "selected" : ""} ${q.enabled ? "" : "unreachable"}" style="left:${i ? 79.333 : 20.667}%;top:${branchY}px" data-route-select="${esc(n.uid)}" aria-pressed="${chosen}" aria-label="查看${esc(n.name)}，前进${q.out}燃料，${q.enabled ? "可前往" : "燃料不足"}"><span class="map-dot">${icon(I.routeIcon(n))}</span><strong>${esc(n.name)}</strong><small>${icon("fuel")} ${q.out} · 风险${esc(n.risk)}</small>${q.enabled ? "" : `<small class="warning">差${Math.max(0, q.out + q.returnCost - state.fuel)}燃料</small>`}</button>`;
      })
      .join("");
    let detail = "";
    if (selected) {
      const q = E.quote(state, selected);
      detail = `<section class="panel route-detail" data-route-detail="${esc(selected.uid)}"><div class="section-head"><h2>${icon(I.routeIcon(selected))}${esc(selected.name)}</h2><span class="tag">风险 ${esc(selected.risk)}</span></div><details class="route-signal"><summary>信号详情</summary><p class="note">${esc(selected.signal)}</p></details><div class="forecast"><span>${icon("fuel")} 前进耗油<b>${q.out}</b></span><span>${icon("return")} 抵达后返航<b>${q.returnCost}</b></span><span>预留后余油<b>${q.free}</b></span></div><p class="note">抵达后剩余${q.arrival}燃料${q.enabled ? "，已为返港留油。" : `；安全前往还差${Math.max(0, q.out + q.returnCost - state.fuel)}燃料。`}</p><button class="primary full" data-travel="${esc(selected.uid)}" ${!q.enabled || options.disabled ? "disabled" : ""}>${icon("ship")} 前往${esc(selected.name)}</button></section>`;
    } else if (candidates.length)
      detail =
        '<p class="note map-instruction">点一个信号查看费用，再决定是否前往。</p>';
    else if (state.phase === "event" || state.phase === "result")
      detail = `<section class="panel"><h3>${icon("warning")} 当前现场${state.phase === "event" ? "尚未处理" : "已记录"}</h3><p class="note">${state.phase === "event" ? "可以查看地图，处理完现场后再扫描下一站。" : "返回现场继续航行，才会探测下一站信号。"}</p><button class="full" data-act="play">${icon("arrow")} 返回当前现场</button></section>`;
    else if (state.depth >= 8 && !atHome)
      detail =
        '<section class="panel"><h3>本趟已到航区边缘</h3><p class="note">最多8站。现在可以整理货舱，准备带着收获返港。</p></section>';
    else if (atHome)
      detail = `<section class="panel"><h3>${state.depth ? "本趟航线已归档" : "还没有离港"}</h3><p class="note">${state.depth ? "保留刚走过的路线。下次正式出发后，开始新的航次。" : "出发后才会探测第一组航点。更远的信号尚未探明。"}</p><button class="full" data-act="play">${icon("port")} 回港口准备</button></section>`;
    const footer = active
      ? state.depth
        ? `<button class="primary full" data-act="home" ${options.disabled || state.fuel < view.returnCost ? "disabled" : ""}>${icon("return")} 返回望潮港 · ${icon("fuel")} ${view.returnCost}燃料</button>`
        : '<button class="full ghost" data-act="abort">取消本次出发，回港准备</button>'
      : "";
    return `<section class="route-map-view" aria-label="本趟实际航路"><div class="section-head"><div><div class="eyebrow">VOYAGE / ROUTE MAP</div><h1>本趟航路</h1></div><span class="tag">已走 ${state.depth} / 8</span></div><div class="map-status"><span>${icon(atHome ? "port" : "ship")}${atHome ? "已在望潮港" : state.depth ? `当前位置 · 第${state.depth}站` : "港口外 · 待启航"}</span><b>${icon("fuel")} ${atHome ? "无需返航耗油" : `回港需${view.returnCost}`}</b></div><div class="map-legend"><span><i class="legend-line solid"></i>已走</span><span><i class="legend-line dashed"></i>候选</span><span><i class="legend-line return"></i>直接返港</span></div><div class="route-scroll" tabindex="0" aria-label="可滚动的航路图"><div class="route-canvas" style="height:${height}px"><svg class="route-lines" viewBox="0 0 300 ${height}" preserveAspectRatio="none" aria-hidden="true">${path}${branchLines}${homeLine}</svg><div class="map-stop map-port ${atHome || !state.depth ? "is-current" : ""}" style="top:56px"><span class="map-dot">${icon("port")}</span><span class="map-stop-label"><b>望潮港</b><small>${atHome ? "飞船已停靠" : "出发港"}</small></span></div>${view.nodes.map(nodeHtml).join("")}${branches}<div class="map-unknown" style="top:${currentY + (candidates.length ? 196 : 76)}px">${state.depth < 8 && active ? "更远航区 · 尚未探明" : "本趟最多8站"}</div></div></div>${detail}${footer}<p class="note">${icon("return")} 虚线表示直接返港，按实际已走距离计油；查看地图不消耗资源。</p></section>`;
  }
  function focusCurrent(container, scrollTop) {
    const area = container.querySelector(".route-scroll");
    if (!area) return;
    if (Number.isFinite(scrollTop)) area.scrollTop = scrollTop;
    else area.scrollTop = Math.max(0, area.scrollHeight - area.clientHeight);
  }
  root.SalvageRouteView = { render, focusCurrent };
})(typeof window !== "undefined" ? window : globalThis);
