/* Original, local 24px line icons. Decorative SVGs always retain a text label. */
(function (root) {
  "use strict";
  const paths = {
    fuel: '<path d="M12 2 6 10a7 7 0 1 0 12 0Z"/><path d="M8 13a4 4 0 0 0 4 5"/>',
    hull: '<path d="m12 2 8 3v7c0 5-8 10-8 10S4 17 4 12V5Z"/><path d="m8 11 3 3 5-5"/>',
    money: '<path d="m8 3-5 5v8l5 5h8l5-5V8l-5-5Z"/><path d="M9 9h6v6H9Z"/>',
    cargo:
      '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
    port: '<path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/><path d="M2 21h20"/>',
    route:
      '<circle cx="5" cy="19" r="2"/><circle cx="7" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><path d="M5 17v-3c0-4 14 0 14-6V7M5 15 7 7"/>',
    journal:
      '<path d="M6 3h15v18H6a3 3 0 0 1 0-6h15M6 3a3 3 0 0 0-3 3v12M9 7h8M9 11h5"/>',
    ship: '<path d="m12 2 7 9 3 9-10-4-10 4 3-9Z"/><path d="M12 3v13M9 20v2M15 20v2"/>',
    wreck:
      '<path d="m3 6 7-3 4 4 6-1 1 10-8 5-10-5Z"/><path d="m4 7 8 5 8-5M12 12v9M7 4l2 4M17 15l-3 2"/>',
    station:
      '<path d="M4 10h16v11H4ZM8 10V4h8v6M2 15h20M9 18h6"/><path d="M12 2v5M10 5h4"/>',
    repair:
      '<path d="m15 3-4 4 2 4 4 2 4-4a7 7 0 0 1-9 9l-6 4-4-4 5-6a7 7 0 0 1 8-9Z"/>',
    trade: '<path d="M3 7h17l-4-4M21 17H4l4 4M20 7l-4 4M4 17l4-4"/>',
    cabin:
      '<path d="M4 7h16v14H4ZM8 7V3h8v4M4 13h16M8 10v6M16 10v6M7 21v1M17 21v1"/>',
    anomaly:
      '<circle cx="12" cy="12" r="3"/><path d="M7 5a9 9 0 0 0 0 14M17 5a9 9 0 0 1 0 14M10 2v2M14 20v2"/>',
    warning: '<path d="m12 2 10 19H2Z"/><path d="M12 8v6M12 17v1"/>',
    rotate: '<path d="M4 9a8 8 0 1 1 1 9M4 3v6h6"/><path d="M10 10h6v6h-6Z"/>',
    arrange: '<path d="M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z"/>',
    check: '<path d="m4 12 5 6L21 5"/>',
    close: '<path d="m5 5 14 14M19 5 5 19"/>',
    arrow: '<path d="M3 12h18M14 5l7 7-7 7"/>',
    return: '<path d="m9 3-6 6 6 6M3 9h11a7 7 0 0 1 0 14h-3"/>',
    scan: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9l6-6M7 12a5 5 0 0 0 10 0M12 17v4"/>',
    package:
      '<path d="m3 7 9-4 9 4v12l-9 3-9-3Z"/><path d="m3 7 9 4 9-4M12 11v11M7 5l9 4v5"/>',
    contract: '<path d="M5 3h11l4 4v14H5ZM15 3v5h5M8 12h8M8 16h5"/>',
    leave: '<path d="M10 3H3v18h7M8 12h13M16 7l5 5-5 5"/>',
    debt: '<path d="M5 3h14v18l-3-2-4 2-4-2-3 2ZM8 8h8M8 12h8M8 16h4"/>',
    use: '<path d="M8 3h8v4h3v14H5V7h3ZM9 13h6M12 10v6"/>',
    collect:
      '<path d="M5 3v6l4 4M19 3v6l-4 4M9 3h6M7 16h10v6H7ZM12 9v9M9 15l3 3 3-3"/>',
  };
  const aliases = {
    salvage: "wreck",
    supply: "station",
    sell: "trade",
    discard: "close",
    tools: "repair",
    play: "ship",
  };
  function icon(name, className = "") {
    const key = aliases[name] || name;
    const safeClass = String(className).replace(/[^a-zA-Z0-9 _-]/g, "");
    return `<svg class="icon ${safeClass}" data-icon="${paths[key] ? key : "package"}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[key] || paths.package}</svg>`;
  }
  const routeKinds = {
    tank: "wreck",
    plates: "wreck",
    cabin: "cabin",
    luggage: "cabin",
    mirror: "anomaly",
    conduit: "wreck",
    beacon: "anomaly",
    engine: "wreck",
    reserve: "wreck",
    trader: "trade",
    workshop: "repair",
    archive: "anomaly",
    station: "station",
  };
  Object.assign(routeKinds, { comet_label:'wreck',ring_sampler:'wreck',silent_fuel:'station',drifting_cup:'cabin',frozen_freight:'wreck',reverse_beacon:'anomaly',lost_probe:'cabin',magnetic_blind:'anomaly',backwards_clock:'anomaly',orbital_archive_vendor:'trade',darkside_signal:'anomaly',foldback_marker:'anomaly' });
  function routeIcon(node) {
    return (
      routeKinds[node?.id] ||
      routeKinds[node?.kind] ||
      (paths[node?.kind] ? node.kind : "anomaly")
    );
  }
  function choiceIcon(choice) {
    if (choice.id === "leave") return "leave";
    if (choice.tool === "scanner") return "scan";
    if (choice.effect?.loot?.length) return "collect";
    if (choice.effect?.remove) return "trade";
    if (choice.effect?.hull > 0) return "repair";
    if (choice.effect?.fuel || choice.effect?.bonusFuel) return "fuel";
    if (choice.effect?.money) return "money";
    return "arrow";
  }
  root.SalvageIcons = { icon, routeIcon, choiceIcon };
})(typeof window !== "undefined" ? window : globalThis);
