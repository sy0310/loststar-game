/* Cargo editor: all geometry is checked by the shared model; only a draft lives here. */
(function (root) {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const copy = value => JSON.parse(JSON.stringify(value));
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const COLORS = ['#baa0cf', '#c3b184', '#8db9b1', '#c394a6', '#91a8c8', '#c0ad9b'];
  const normalizePlacements = list => [...list].sort((a, b) => a.uid - b.uid).map(p => ({uid:p.uid, x:p.x, y:p.y, rotation:p.rotation}));

  function create(options = {}) {
    const E = options.engine || root.LostCargo;
    const G = E.Cargo;
    let host = null, session = null, latestState = null, latestOptions = {}, disabled = false;
    let drag = null, suppressedClick = 0, busy = false, sessionSerial = 0;
    const pointers = new Set();
    const icon = name => (options.icons || root.SalvageIcons)?.icon(name) || '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4zM4 12h16M12 4v16" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
    const area = item => G.area(item);
    const cells = (item, rotation = 0) => G.cells(item, rotation);
    const itemById = uid => session?.items.find(item => item.uid === Number(uid));
    const placement = uid => session?.placements.find(p => p.uid === Number(uid));
    const remainingItems = () => session.items.filter(item => !session.discardUids.includes(item.uid));
    const activeItems = () => remainingItems().filter(item => session.placements.some(p => p.uid === item.uid));
    const valid = () => G.validate(remainingItems(), session.placements);
    const dirty = () => !!session && (session.discardUids.length > 0 || !same(normalizePlacements(session.placements), normalizePlacements(session.original)));
    const itemIcon = item => item.contract ? 'contract' : item.ability === 'patch' ? 'repair' : item.ability === 'fuel' ? 'fuel' : 'package';
    const notice = (message, kind = 'neutral') => { if (session) { session.message = message; session.messageKind = kind; } };
    const notify = message => { notice(message, 'warning'); options.onNotice?.(message); };

    function establish(state, settings) {
      latestState = state;
      latestOptions = settings;
      disabled = !!settings.disabled;
      const draft = settings.draft || null;
      const revision = settings.revision ?? state.revision;
      const key = draft ? JSON.stringify(draft.action) : 'cargo';
      if (session && session.revision === revision && session.key === key) return;
      // Own commits can synchronously render their new state before onCommit resolves.
      // Defer any failure notice to that result; only invalidate an unconfirmed external draft here.
      const wasEditing = session && session.revision !== revision && !session.settled && !busy && (dirty() || !!session.action);
      if (drag) endDrag(false);
      const items = copy(draft?.items || state.cargo);
      const itemIds = new Set(items.map(item => item.uid));
      const layout = copy(draft?.placements || state.cargoGrid?.placements || []).filter(p => itemIds.has(p.uid));
      session = {
        serial: ++sessionSerial, key, revision, action: draft ? copy(draft.action) : null,
        items, placements:layout, original:copy(layout), newUids:[...(draft?.newUids || [])], discardUids:[],
        selected:null, rotation:0, preview:null, confirmDiscard:false, settled:false, message:'', messageKind:'neutral',
      };
      if (draft && session.newUids.length) session.selected = session.newUids[0];
      if (draft) notice('先摆好全部货物，再确认装载。现在还没有扣费或回收。');
      else if (wasEditing) notice('存档已有更新，已读取最新货舱。请重新检查排布。', 'warning');
      else notice('点选货物，再点目标格；也可以拖动。排布确认后保存。');
    }

    function shapePath(mask, unit = 100, inset = 5) {
      // Each occupied square is filled once; the perimeter follows the real mask, including concave corners.
      const occupied = new Set(mask.map(([x, y]) => `${x},${y}`));
      let fill = '', outline = '';
      for (const [x, y] of mask) {
        const left = x * unit, top = y * unit;
        fill += `M${left + 1},${top + 1}h${unit - 2}v${unit - 2}h-${unit - 2}z`;
        if (!occupied.has(`${x},${y - 1}`)) outline += `M${left + inset},${top + inset}H${left + unit - inset}`;
        if (!occupied.has(`${x + 1},${y}`)) outline += `M${left + unit - inset},${top + inset}V${top + unit - inset}`;
        if (!occupied.has(`${x},${y + 1}`)) outline += `M${left + unit - inset},${top + unit - inset}H${left + inset}`;
        if (!occupied.has(`${x - 1},${y}`)) outline += `M${left + inset},${top + unit - inset}V${top + inset}`;
      }
      return {fill, outline};
    }

    function thumbnail(item, rotation = 0) {
      const mask = cells(item, rotation), width = Math.max(...mask.map(c => c[0])) + 1, height = Math.max(...mask.map(c => c[1])) + 1;
      return `<svg class="cargo-thumbnail" viewBox="0 0 ${width * 16} ${height * 16}" aria-hidden="true">${mask.map(([x,y]) => `<rect x="${x * 16 + 1}" y="${y * 16 + 1}" width="14" height="14" rx="2"/>`).join('')}</svg>`;
    }

    function occupant(x, y) {
      for (const p of session.placements) {
        const item = itemById(p.uid);
        if (item && cells(item, p.rotation).some(([dx,dy]) => p.x + dx === x && p.y + dy === y)) return item;
      }
      return null;
    }

    function board() {
      let grid = '';
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        const item = occupant(x, y);
        grid += `<button type="button" class="cargo-cell${item ? ' occupied' : ''}${item?.uid === session.selected ? ' selected' : ''}" data-cargo-cell="${x},${y}" aria-label="第${y + 1}行第${x + 1}列，${item ? esc(item.name) : '空格'}"${disabled || busy ? ' disabled' : ''}></button>`;
      }
      let shapes = '', marks = '';
      for (const p of session.placements) {
        const item = itemById(p.uid), index = session.items.findIndex(x => x.uid === p.uid), selected = p.uid === session.selected;
        const mask = cells(item, p.rotation), shape = shapePath(mask), color = COLORS[index % COLORS.length];
        shapes += `<g class="cargo-object${selected ? ' is-selected' : ''}" transform="translate(${p.x * 100},${p.y * 100})" style="--cargo-color:${color}"><path class="cargo-object-fill" d="${shape.fill}"/><path class="cargo-object-outline" d="${shape.outline}"/></g>`;
        const center = mask.reduce((n, c) => [n[0] + (c[0] + .5) / mask.length, n[1] + (c[1] + .5) / mask.length], [0,0]);
        const occupied = new Set(mask.map(c => c.join(',')));
        const inside = [-.24,.24].every(dx => [-.24,.24].every(dy => occupied.has(`${Math.floor(center[0] + dx)},${Math.floor(center[1] + dy)}`)));
        const anchor = inside ? center : mask.map(([x,y]) => [x+.5,y+.5]).sort((a,b) => Math.hypot(a[0] - center[0], a[1] - center[1]) - Math.hypot(b[0] - center[0], b[1] - center[1]))[0];
        marks += `<span class="cargo-object-mark${selected ? ' is-selected' : ''}" style="left:${(p.x + anchor[0]) * 25}%;top:${(p.y + anchor[1]) * 25}%;--cargo-color:${color}">${icon(itemIcon(item))}<span>${index + 1}</span></span>`;
      }
      if (session.preview && session.selected != null) {
        const item = itemById(session.selected), p = session.preview, shape = shapePath(cells(item, session.rotation));
        shapes += `<g class="cargo-preview ${p.ok ? 'can-place' : 'cannot-place'}" transform="translate(${p.x * 100},${p.y * 100})"><path d="${shape.fill}"/><path class="cargo-preview-outline" d="${shape.outline}"/></g>`;
      }
      return `<div class="cargo-board" aria-label="4行4列拼图货舱"><div class="cargo-cells">${grid}</div><svg class="cargo-shapes" viewBox="0 0 400 400" aria-hidden="true">${shapes}</svg>${marks}</div>`;
    }

    function itemButtons(items, tray = false) {
      return items.map(item => {
        const p = placement(item.uid), index = session.items.indexOf(item), selected = item.uid === session.selected;
        return `<button type="button" class="cargo-item-pick${selected ? ' is-selected' : ''}${tray ? ' in-tray' : ''}" data-cargo-pick="${item.uid}" aria-pressed="${selected}"${disabled || busy ? ' disabled' : ''} style="--cargo-color:${COLORS[index % COLORS.length]}"><span class="cargo-pick-shape">${thumbnail(item, p?.rotation || 0)}</span><span class="cargo-pick-label"><b>${index + 1}. ${esc(item.name)}</b><small>${area(item)}小格${session.newUids.includes(item.uid) ? ' · 待装载' : ''}${item.contract ? ' · 委托物' : ''}${!p ? ' · 未放入' : ''}</small></span></button>`;
      }).join('');
    }

    function detail() {
      const item = itemById(session.selected);
      if (!item || session.discardUids.includes(item.uid)) return '<p class="cargo-instruction">选择货物，可以查看形状、旋转或调整位置。</p>';
      const p = placement(item.uid), staged = !p, isNew = session.newUids.includes(item.uid);
      const description = item.contract ? '委托记录箱；返港按原委托条件交付。' : item.ability === 'patch' ? '可在货舱使用，修补船体。' : item.ability === 'fuel' ? '可在货舱使用，补充燃料。' : '带回港口后可出售。';
      return `<section class="cargo-detail" aria-label="选中货物"><div class="cargo-detail-head"><span class="cargo-selected-shape">${thumbnail(item, session.rotation)}</span><div><h3>${esc(item.name)}</h3><p>${area(item)}小格 · ${item.contract ? '不可出售' : `已知售价 ${esc(item.value)} 零件`}${item.shapeId?.startsWith('legacy') ? ' · 旧货包装' : ''}</p></div></div><p class="cargo-purpose">${description}</p><div class="cargo-tools"><button type="button" data-cargo-rotate${disabled || busy ? ' disabled' : ''}>${icon('rotate')}<span>旋转90°</span></button><button type="button" data-cargo-stage${disabled || busy || staged ? ' disabled' : ''}>${icon('cargo')}<span>暂移整理区</span></button></div><p class="cargo-instruction">${session.preview ? session.preview.ok ? '可以放置：点目标格或松开手指。' : '无法放置：调整位置，货物仍留在原处。' : '旋转后点击目标格放置；未放好的货不能带走。'}</p>${session.action?.type === 'choose' && !isNew ? `<button type="button" class="cargo-discard-button" data-cargo-discard${disabled || busy ? ' disabled' : ''}>${icon('warning')}<span>放弃这件旧货，腾出空间</span></button>` : ''}${!session.action && !dirty() ? `<div class="cargo-item-actions">${!item.contract && ['port','summary'].includes(latestState.phase) ? `<button type="button" data-cargo-action="sell"${disabled || busy ? ' disabled' : ''}>${icon('money')}<span>出售</span></button>` : ''}${item.ability === 'patch' ? `<button type="button" data-cargo-action="use"${disabled || busy || latestState.hull >= 100 ? ' disabled' : ''}>${icon(itemIcon(item))}<span>${latestState.hull >= 100 ? '船体完好' : '使用'}</span></button>` : ''}${['route','event','result'].includes(latestState.phase) ? `<button type="button" data-cargo-action="discard"${disabled || busy ? ' disabled' : ''}>${icon('warning')}<span>放弃货物</span></button>` : ''}</div>` : ''}${session.confirmDiscard ? `<div class="cargo-discard-confirm" role="group" aria-label="确认弃货"><p>确认装载时会放弃「${esc(item.name)}」，不会获得零件。${item.contract ? '放弃记录箱也会失去本趟委托报酬。' : ''}</p><div><button type="button" data-cargo-keep>继续保留</button><button type="button" class="danger" data-cargo-confirm-discard>确认放弃此货</button></div></div>` : ''}</section>`;
    }

    function markup() {
      if (!session) return '';
      const items = remainingItems(), placed = activeItems(), unplaced = items.filter(x => !placement(x.uid)), validation = valid();
      const used = placed.reduce((n, item) => n + area(item), 0);
      const discarded = session.items.filter(x => session.discardUids.includes(x.uid));
      const saveDisabled = disabled || busy || !validation.ok || (!session.action && !dirty());
      return `<section data-cargo-view class="cargo-view${session.action ? ' cargo-loading' : ''}"><div class="section-head"><div><div class="eyebrow">CARGO HOLD · 4 × 4</div><h1>${session.action ? '安排这次装载' : '船上货舱'}</h1></div><span class="tag">${used}/16 小格</span></div>${session.action ? '<p class="cargo-draft-notice">当前是装载草案。确认时才结算本次选择的费用和风险；取消回到原现场。</p>' : '<p class="cargo-draft-notice">货物有不同形状。旋转、挪位置，把想带走的东西装好。</p>'}<div class="cargo-editor">${board()}<p data-cargo-status role="status" aria-live="polite" class="cargo-status ${session.messageKind}">${icon(session.messageKind === 'warning' ? 'warning' : session.messageKind === 'success' ? 'check' : 'cargo')}<span>${esc(session.message)}</span></p>${detail()}<div class="cargo-arrange-row"><button type="button" data-cargo-arrange${disabled || busy || !items.length ? ' disabled' : ''}>${icon('arrange')}<span>辅助整理</span></button><span>只调整草案，确认后保存</span></div></div>${unplaced.length ? `<section class="cargo-tray" data-cargo-tray><h2>${icon('cargo')}整理区 <small>${unplaced.length}件未放好</small></h2><p>仅供本次摆放；未放入的货物不能随船带走。</p><div class="cargo-item-list">${itemButtons(unplaced, true)}</div></section>` : ''}${placed.length ? `<section class="cargo-manifest"><h2>已放货物 <small>${placed.length}件</small></h2><div class="cargo-item-list">${itemButtons(placed)}</div></section>` : !items.length ? '<p class="empty">货舱是空的。回收后在这里摆放货物。</p>' : ''}${discarded.length ? `<section class="cargo-discard-list"><h2>${icon('warning')}确认后将放弃</h2>${discarded.map(x => `<div><span>${esc(x.name)}${x.contract ? '（同时放弃委托报酬）' : ''}</span><button type="button" data-cargo-restore="${x.uid}"${disabled || busy ? ' disabled' : ''}>恢复保留</button></div>`).join('')}</section>` : ''}<div class="cargo-save-panel">${!validation.ok ? `<p class="cargo-save-reason">${icon('warning')}<span>${unplaced.length ? `还有${unplaced.length}件货物未放入。${session.action?.type === 'depart' ? '整理空出记录箱的位置，或取消回港先出售旧货。' : '请摆好或明确取舍。'}` : esc(validation.message)}</span></p>` : ''}<div class="cargo-save-actions"><button type="button" data-cargo-cancel${busy ? ' disabled' : ''}>${icon('close')}<span>${session.action ? '取消装载' : '取消调整'}</span></button><button type="button" class="primary" data-cargo-save${saveDisabled ? ' disabled' : ''}>${icon('check')}<span>${busy ? '正在保存…' : session.action ? '确认装载' : '保存排布'}</span></button></div></div></section>`;
    }

    function repaint() {
      if (!host) return;
      const current = host.querySelector('[data-cargo-view]');
      if (!current) return;
      const focused = document.activeElement;
      const focusAttr = focused && current.contains(focused) ? [...focused.attributes].find(a => a.name.startsWith('data-cargo-')) : null;
      current.outerHTML = markup();
      if (focusAttr && !drag) {
        const candidate = [...host.querySelectorAll(`[${focusAttr.name}]`)].find(x => x.getAttribute(focusAttr.name) === focusAttr.value);
        if (candidate && !candidate.disabled) candidate.focus({preventScroll:true});
      }
    }

    function select(uid) {
      const item = itemById(uid);
      if (!item || session.discardUids.includes(item.uid)) return;
      session.selected = item.uid;
      session.rotation = placement(item.uid)?.rotation || 0;
      session.preview = null;
      session.confirmDiscard = false;
      notice(`已选「${item.name}」。点击空格放置，或拖动调整。`);
    }

    function tryPlace(x, y) {
      if (session.selected == null) return;
      const result = G.place(remainingItems(), session.placements, session.selected, x, y, session.rotation);
      if (!result.ok) { notice(result.message || '此处无法放置，货物仍留在原位。', 'warning'); session.preview = {x,y,ok:false}; }
      else { session.placements = copy(result.placements); session.preview = null; notice('已放入草案。确认后保存排布。', 'success'); }
    }

    function tapCell(x, y) {
      const at = occupant(x, y);
      if (session.selected == null) {
        if (at) select(at.uid);
        else notice('先选择一件货物，再点目标格。');
      } else if (at?.uid === session.selected && !session.preview) {
        notice('已选中。可拖动，或旋转后点击目标格。');
      } else tryPlace(x, y);
    }

    async function commit() {
      if (busy || disabled || !valid().ok || (!session.action && !dirty())) return;
      const submitted = session, serial = session.serial;
      const payload = {action:copy(session.action || {type:'layout'}), placements:copy(session.placements), discard:copy(session.discardUids), discardUids:copy(session.discardUids), revision:session.revision};
      busy = true;
      repaint();
      try {
        const result = await options.onCommit?.(payload);
        if (result?.ok) submitted.settled = true;
        if (session?.serial !== serial) {
          if (!result?.ok) notify(result?.message || '排布尚未保存，请重新检查当前货舱。');
          return;
        }
        if (result?.ok) {
          submitted.original = copy(submitted.placements);
          submitted.discardUids = [];
          notice('排布已保存。', 'success');
        } else notify(result?.message || '排布尚未保存，请重试。');
      } catch (error) {
        if (session?.serial === serial) notify(error?.message || '未能保存排布，原存档没有改变。');
      } finally { busy = false; repaint(); }
    }

    function cancel(callParent = true) {
      if (!session || busy) return;
      endDrag(false);
      const wasAction = !!session.action;
      if (wasAction) session.settled = true;
      session.placements = copy(session.original);
      session.discardUids = [];
      session.preview = null;
      session.confirmDiscard = false;
      session.selected = null;
      notice('已取消调整，恢复上次排布。');
      if (callParent && wasAction) options.onCancel?.();
      repaint();
    }

    function click(event) {
      if (!host || !event.target.closest('[data-cargo-view]')) return;
      const b = event.target.closest('button');
      if (!b || b.disabled) return;
      if (![...b.attributes].some(a => a.name.startsWith('data-cargo-'))) return;
      event.stopPropagation();
      if (event.detail !== 0 && performance.now() < suppressedClick) { event.preventDefault(); return; }
      if (b.hasAttribute('data-cargo-cancel')) { cancel(); return; }
      if (busy || disabled) return;
      if (b.hasAttribute('data-cargo-save')) { void commit(); return; }
      if (b.hasAttribute('data-cargo-pick')) select(Number(b.dataset.cargoPick));
      else if (b.hasAttribute('data-cargo-cell')) tapCell(...b.dataset.cargoCell.split(',').map(Number));
      else if (b.hasAttribute('data-cargo-rotate')) {
        if (session.selected == null) return;
        session.rotation = (session.rotation + 1) % 4;
        const p = placement(session.selected);
        session.preview = p ? {...p, ok:G.place(remainingItems(), session.placements, p.uid, p.x, p.y, session.rotation).ok} : null;
        notice(`轮廓已旋转${session.rotation * 90}°，点击目标格放置。`);
      } else if (b.hasAttribute('data-cargo-stage')) {
        session.placements = session.placements.filter(p => p.uid !== session.selected);
        session.preview = null;
        notice('暂放到整理区；仍是你的货，确认前需要重新放入。');
      } else if (b.hasAttribute('data-cargo-arrange')) {
        const result = G.solve(remainingItems(), session.placements);
        if (result) { session.placements = copy(result); session.preview = null; session.rotation = placement(session.selected)?.rotation || 0; notice('已找到可行排布。你可以继续微调，再确认保存。', 'success'); }
        else notice(session.action?.type === 'depart' ? '这些货物无法一起装入，请取消装载，回港先出售部分旧货。' : '这些形状无法一起装入4×4货舱，需要明确选择保留哪些货物。', 'warning');
      } else if (b.hasAttribute('data-cargo-discard')) session.confirmDiscard = true;
      else if (b.hasAttribute('data-cargo-keep')) session.confirmDiscard = false;
      else if (b.hasAttribute('data-cargo-confirm-discard')) {
        const item = itemById(session.selected);
        if (item && session.action?.type === 'choose' && !session.newUids.includes(item.uid)) {
          session.discardUids.push(item.uid);
          session.placements = session.placements.filter(p => p.uid !== item.uid);
          session.selected = null;
          session.preview = null;
          session.confirmDiscard = false;
          notice('已标记此旧货；确认装载时才会放弃。取消可全部恢复。', 'warning');
        }
      } else if (b.hasAttribute('data-cargo-restore')) {
        const uid = Number(b.dataset.cargoRestore);
        session.discardUids = session.discardUids.filter(x => x !== uid);
        select(uid);
        notice('已恢复保留，货物在整理区等待放入。');
      } else if (b.hasAttribute('data-cargo-action')) {
        const item = itemById(session.selected);
        if (item && !session.action && !dirty()) options.onAction?.(b.dataset.cargoAction, copy(item));
      }
      repaint();
    }

    function endDrag(showNotice = true) {
      if (!drag) return;
      const id = drag.id;
      drag = null;
      session && (session.preview = null);
      try { if (host?.hasPointerCapture(id)) host.releasePointerCapture(id); } catch { /* Browser already cancelled capture. */ }
      if (showNotice) notice('已取消拖动，货物仍在原处。');
    }

    function pointerDown(event) {
      if (!host || disabled || busy || event.button > 0 || !event.target.closest('[data-cargo-view]')) return;
      if (!pointers.size) suppressedClick = 0;
      pointers.add(event.pointerId);
      if (pointers.size > 1) { endDrag(); suppressedClick = performance.now() + 400; repaint(); return; }
      const cell = event.target.closest('[data-cargo-cell]'), pick = event.target.closest('[data-cargo-pick]');
      let uid = pick ? Number(pick.dataset.cargoPick) : null, ox = 0, oy = 0;
      if (cell) {
        const [x,y] = cell.dataset.cargoCell.split(',').map(Number), item = occupant(x,y);
        if (!item) return;
        uid = item.uid;
        const p = placement(uid); ox = x - p.x; oy = y - p.y;
      }
      if (uid == null) return;
      // A touch on the text scrolls the manifest; the shape thumbnail is its drag handle.
      if (pick && event.pointerType === 'touch' && !event.target.closest('.cargo-pick-shape')) return;
      drag = {id:event.pointerId, uid, startX:event.clientX, startY:event.clientY, ox, oy, moved:false, cell:cell?.dataset.cargoCell || null, pick:pick?.dataset.cargoPick || null};
      try { host.setPointerCapture(event.pointerId); } catch { /* Pointer capture is an enhancement; tap controls remain available. */ }
    }

    function pointerMove(event) {
      if (!drag || drag.id !== event.pointerId || pointers.size > 1) return;
      if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 7) return;
      if (!drag.moved) { select(drag.uid); drag.moved = true; }
      event.preventDefault();
      const rect = host.querySelector('.cargo-board')?.getBoundingClientRect();
      if (!rect) { endDrag(); return; }
      const x = Math.floor((event.clientX - rect.left) * 4 / rect.width) - drag.ox;
      const y = Math.floor((event.clientY - rect.top) * 4 / rect.height) - drag.oy;
      const result = G.place(remainingItems(), session.placements, drag.uid, x, y, session.rotation);
      session.preview = {x,y,ok:result.ok};
      notice(result.ok ? '可以放置，松开后加入草案。' : `${result.message || '此处无法放置'}；松开会留在原位。`, result.ok ? 'success' : 'warning');
      repaint();
    }

    function pointerUp(event) {
      pointers.delete(event.pointerId);
      if (!drag || drag.id !== event.pointerId) return;
      const wasMoved = drag.moved, preview = session.preview, tappedCell = drag.cell, tappedPick = drag.pick;
      endDrag(false);
      if (wasMoved) {
        suppressedClick = performance.now() + 400;
        if (preview?.ok) tryPlace(preview.x, preview.y);
        else notice('落点无法放置，货物仍在原位。', 'warning');
        repaint();
      } else {
        suppressedClick = performance.now() + 250;
        if (tappedPick) select(Number(tappedPick));
        else if (tappedCell) tapCell(...tappedCell.split(',').map(Number));
        repaint();
      }
    }

    function pointerCancel(event) {
      pointers.delete(event.pointerId);
      if (drag?.id === event.pointerId) {
        endDrag(); suppressedClick = performance.now() + 400; repaint();
      }
    }
    function blur() { if (drag) { endDrag(); pointers.clear(); suppressedClick = performance.now() + 400; repaint(); } }
    function visibility() { if (document.hidden) blur(); }
    function anotherPointer(event) {
      if (drag && drag.id !== event.pointerId) { endDrag(); suppressedClick = performance.now() + 400; repaint(); }
    }
    function keydown(event) {
      if (event.key !== 'Escape' || !host?.querySelector('[data-cargo-view]')) return;
      if (drag) { endDrag(); repaint(); event.preventDefault(); event.stopPropagation(); }
    }

    function detach() {
      endDrag(false); pointers.clear();
      if (host) {
        host.removeEventListener('click', click);
        host.removeEventListener('pointerdown', pointerDown);
        host.removeEventListener('pointermove', pointerMove);
        host.removeEventListener('pointerup', pointerUp);
        host.removeEventListener('pointercancel', pointerCancel);
        host.removeEventListener('lostpointercapture', pointerCancel);
        host.removeEventListener('keydown', keydown);
      }
      root.removeEventListener('blur', blur);
      root.removeEventListener('popstate', blur);
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('pointerdown', anotherPointer, true);
      host = null;
    }

    return {
      render(state, settings = {}) { establish(state, settings); return markup(); },
      mount(element) {
        if (host === element) return;
        detach(); host = element;
        host.addEventListener('click', click);
        host.addEventListener('pointerdown', pointerDown);
        host.addEventListener('pointermove', pointerMove, {passive:false});
        host.addEventListener('pointerup', pointerUp);
        host.addEventListener('pointercancel', pointerCancel);
        host.addEventListener('lostpointercapture', pointerCancel);
        host.addEventListener('keydown', keydown);
        root.addEventListener('blur', blur);
        root.addEventListener('popstate', blur);
        document.addEventListener('visibilitychange', visibility);
        document.addEventListener('pointerdown', anotherPointer, true);
      },
      update(state, settings = latestOptions) { establish(state, settings); repaint(); },
      cancel,
      dirty,
      destroy() { detach(); session = null; },
      unmount: detach,
    };
  }
  root.SalvageCargoView = {create};
})(typeof window !== 'undefined' ? window : globalThis);
