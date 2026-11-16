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
    const dims=()=>E.cargoSpace(latestState);
    const visual=(item,rotation=0)=>root.SalvageCargoArt.render(item,rotation);
    const valid = () => G.validate(remainingItems(), session.placements,dims());
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
        selected:null, rotation:0, preview:null, confirmDiscard:false, settled:false, mode:draft?.complete?'quick':'edit', message:'', messageKind:'neutral',
      };
      if(draft&&session.newUids.length){session.selected=session.newUids[0];session.rotation=placement(session.selected)?.rotation||0;}
      if (draft) notice(draft.complete?'确认后才结算；可先手动调整。':'安排未放入的物件，或明确取舍。');
      else if (wasEditing) notice('存档已有更新，已读取最新货舱。请重新检查排布。', 'warning');
      else notice('点物品选中，点空格放置。');
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
      for (let y = 0; y < dims().height; y++) for (let x = 0; x < dims().width; x++) {
        const item = occupant(x, y);
        const space = dims();
        const usable = !space.usableCellMask || space.usableCellMask[y][x];
        const tray = space.fixedTrayCells?.some(([tx, ty]) => tx === x && ty === y);
        grid += `<button type="button" class="cargo-cell${tray ? ' fixed-tray' : ''}${usable ? '' : ' hold-closed'}${item ? ' occupied' : ''}${item?.uid === session.selected ? ' selected' : ''}" data-cargo-cell="${x},${y}" aria-label="第${y + 1}行第${x + 1}列，${!usable ? '船体边界' : item ? esc(item.name) : tray ? '固定货台空格' : '主舱空格'}"${disabled || busy || !usable ? ' disabled' : ''}></button>`;
      }
      let shapes = '', marks = '';
      for (const p of session.placements) {
        const item = itemById(p.uid), index = session.items.findIndex(x => x.uid === p.uid), selected = p.uid === session.selected;
        const mask = cells(item, p.rotation), shape = shapePath(mask), color = COLORS[index % COLORS.length];
        if(selected)shapes += `<g class="cargo-object is-selected" transform="translate(${p.x * 100},${p.y * 100})" style="--cargo-color:${color}"><path class="cargo-object-outline" d="${shape.outline}"/></g>`;
        const box=root.SalvageCargoArt.metadata(item,p.rotation),badge=mask[0];
        marks += `<span class="cargo-physical-object${selected?' is-selected':''}" data-cargo-object="${item.uid}" style="left:${p.x*100/dims().width}%;top:${p.y*100/dims().height}%;width:${box.width*100/dims().width}%;height:${box.height*100/dims().height}%">${visual(item,p.rotation)}<small class="cargo-piece-number" style="left:${badge[0]/box.width*100}%;top:${badge[1]/box.height*100}%">#${index+1}</small></span>`;

      }
      if (session.preview && session.selected != null) {
        const item = itemById(session.selected), p = session.preview, shape = shapePath(cells(item, session.rotation));
        shapes += `<g class="cargo-preview ${p.ok ? 'can-place' : 'cannot-place'}" transform="translate(${p.x * 100},${p.y * 100})"><path d="${shape.fill}"/><path class="cargo-preview-outline" d="${shape.outline}"/></g>`;
      }
      return `<div class="cargo-board" data-hold-ship="${E.shipStats(latestState).id}" aria-label="${E.capacityCells(latestState)}个有效格，${dims().height}行${dims().width}列拼图货舱" style="--cargo-cols:${dims().width};--cargo-rows:${dims().height}"><div class="cargo-cells">${grid}</div><svg class="cargo-shapes" viewBox="0 0 ${dims().width*100} ${dims().height*100}" aria-hidden="true">${shapes}</svg><div class="cargo-physical-layer" aria-hidden="true">${marks}</div></div>`;
    }

    function itemButtons(items, tray = false) {
      return items.map(item => {
        const p = placement(item.uid), index = session.items.indexOf(item), selected = item.uid === session.selected;
        return `<button type="button" class="cargo-item-pick${selected ? ' is-selected' : ''}${tray ? ' in-tray' : ''}" data-cargo-pick="${item.uid}" aria-pressed="${selected}"${disabled || busy ? ' disabled' : ''} style="--cargo-color:${COLORS[index % COLORS.length]}"><span class="cargo-pick-shape">${visual(item)}</span><span class="cargo-pick-label"><b>${index + 1}. ${esc(item.name)}</b><small>${area(item)}格 · 1件${session.newUids.includes(item.uid) ? ' · 待装载' : ''}${item.contract ? ' · 委托物' : ''}${!p ? ' · 未放入' : ''}</small></span></button>`;
      }).join('');
    }

    function mission() {
      const record=latestState.missionSlot,m=E.activeMission(latestState);
      return '<div class="mission-slot">'+icon('contract')+'<span>任务槽 · '+(record?'测绘 '+(m?.status==='accepted'?0:Math.min(latestState.depth,3))+'/3 · 记录箱随船':session.action?.type==='depart'?(m?'已接 '+E.PORT.missions[m.type].name:'未接委托，不领取记录箱'):m?'已接 '+E.PORT.missions[m.type].name:'没有接取委托')+'</span>'+(record&&!session.action?'<button type="button" data-cargo-mission '+(disabled||busy?'disabled':'')+'>放弃任务</button>':'')+'</div>';
    }
    function detail() {
      const item=itemById(session.selected);
      if(!item||session.discardUids.includes(item.uid))return '<div class="cargo-detail empty-selection">点选物件查看；物件外形就是实际占格。</div>';
      const isNew=session.newUids.includes(item.uid);
      const actions=!session.action&&!dirty() ? (['port','summary'].includes(latestState.phase)?'<button data-cargo-action="sell">'+icon('money')+'出售</button>':'')+(['patch','fuel'].includes(item.ability)?'<button data-cargo-action="use" '+(latestState[item.ability==='fuel'?'fuel':'hull']===E.resourceLimit(latestState,item.ability==='fuel'?'fuel':'hull')?'disabled':'')+'>'+icon('repair')+'使用用品</button>':'')+(['route','event','result'].includes(latestState.phase)?'<button data-cargo-action="discard">放弃货物</button>':'') : '';
      return '<section class="cargo-detail" aria-label="选中货物"><div class="cargo-detail-head"><span class="cargo-selected-shape">'+visual(item)+'</span><div><h3>'+esc(item.name)+'</h3><p>'+area(item)+'格 · 售价 '+item.value+' 零件'+(item.ability==='patch'?' · 用后修22耐久':item.ability==='fuel'?' · 用后补20燃料':' · 可出售')+(item.shapeId.startsWith('legacy')?' · 原包装':'')+'</p></div></div><details class="cargo-more"><summary>物品操作</summary><div class="cargo-item-actions"><button type="button" data-cargo-stage '+(!placement(item.uid)?'disabled':'')+'>暂时拿起</button>'+actions+(session.action?.type==='choose'&&!isNew?'<button class="danger" data-cargo-discard>换下此旧货</button>':'')+'</div></details>'+(session.confirmDiscard?'<div class="cargo-discard-confirm" role="group" aria-label="确认弃货"><p>确认装载时放弃「'+esc(item.name)+'」，不获得零件。</p><div><button data-cargo-keep>保留</button><button class="danger" data-cargo-confirm-discard>确认放弃</button></div></div>':'')+'</section>';
    }
    function toolbar(){const noItem=session.selected==null;return '<div class="cargo-tools"><button type="button" data-cargo-rotate '+(disabled||busy||noItem?'disabled':'')+'>'+icon('rotate')+'<span>旋转</span></button><button type="button" data-cargo-arrange '+(disabled||busy||!remainingItems().length?'disabled':'')+'>'+icon('arrange')+'<span>整理</span></button></div>';}
    function holdCaption() {
      const space = dims();
      return '<div class="hold-caption"><b>'+esc(E.shipStats(latestState).name)+'</b><span>'+esc(space.label)+'</span><small><i></i>主舱 <i class="tray-key"></i>固定货台</small></div>';
    }
    function markup() {
      if(!session)return '';
      const items=remainingItems(),unplaced=items.filter(x=>!placement(x.uid)),validation=valid(),used=items.reduce((n,x)=>n+area(x),0),quick=session.mode==='quick'&&!!session.action;
      const discarded=session.items.filter(x=>session.discardUids.includes(x.uid));
      const saveDisabled=disabled||busy||!validation.ok||(!session.action&&!dirty());
      const title=quick?(session.action.type==='depart'?'准备出发':'本次收获'):(session.action?'调整装载':'货舱');
      const footer='<div class="cargo-save-panel">'+(latestOptions.costHTML||'')+(!validation.ok?'<p class="cargo-save-reason">'+icon('warning')+(unplaced.length?'还有'+unplaced.length+'件未放入':esc(validation.message))+'</p>':'')+'<div class="cargo-save-actions"><button type="button" data-cargo-cancel '+(busy?'disabled':'')+'>'+icon('close')+(session.action?'取消':'取消调整')+'</button><button type="button" class="primary" data-cargo-save '+(saveDisabled?'disabled':'')+'>'+icon('check')+(busy?'保存中…':session.action?.type==='depart'?'确认出发':session.action?'收下并装入':'保存排布')+'</button></div></div>';
      let body='';
      if(quick){const incoming=items.filter(x=>session.newUids.includes(x.uid));body='<div class="cargo-body cargo-quick"><div class="cargo-choice-summary">'+(latestOptions.summaryHTML||'')+'</div>'+mission()+'<div class="quick-loot" aria-label="待收下物品">'+incoming.map(x=>'<div class="quick-loot-item"><span>'+visual(x)+'</span><div><b>'+esc(x.name)+'</b><small>'+area(x)+'格 · 售价 '+x.value+' 零件</small></div></div>').join('')+'</div><p class="cargo-quick-note">'+(session.action.type==='depart'?'普通货舱可用'+(E.capacityCells(latestState)-used)+'格；任务状态以已接取委托为准。':'已找到合法位置，现有货物保持原位。确认时才结算。')+'</p><button type="button" class="ghost full" data-cargo-edit>'+icon('cargo')+'手动调整</button></div>';}
      else body='<div class="cargo-body">'+mission()+holdCaption()+'<div class="cargo-editor"><div class="cargo-board-row">'+board()+toolbar()+'</div><p data-cargo-status role="status" aria-live="polite" class="cargo-status '+session.messageKind+'">'+icon(session.messageKind==='warning'?'warning':session.messageKind==='success'?'check':'cargo')+'<span>'+esc(session.message)+'</span></p></div>'+detail()+'<section class="cargo-tray"><h2>货物清单 <small>'+items.length+'件'+(unplaced.length?' · '+unplaced.length+'件未放入':'')+'</small></h2><div class="cargo-item-list" data-cargo-strip>'+itemButtons(items)+'</div></section>'+(discarded.length?'<section class="cargo-discard-list"><h2>确认后将放弃</h2>'+discarded.map(x=>'<div><span>'+esc(x.name)+'</span><button data-cargo-restore="'+x.uid+'">恢复</button></div>').join('')+'</section>':'')+'</div>';
      return '<section data-cargo-view class="cargo-view '+(session.action?'cargo-loading ':'')+(quick?'is-quick':'')+'"><div class="section-head"><h1>'+title+'</h1>'+(!session.action&&latestState.phase==='port'?'<button class="cargo-expand" data-cargo-growth>扩容</button>':'')+'<span class="tag">'+used+'/'+E.capacityCells(latestState)+' 格</span></div>'+body+footer+'</section>';
    }

    function repaint() {
      if (!host) return;
      const current = host.querySelector('[data-cargo-view]');
      if (!current) return;
      const focused = document.activeElement;
      const focusAttr = focused && current.contains(focused) ? [...focused.attributes].find(a => a.name.startsWith('data-cargo-')) : null;
      const scrollTop=current.querySelector('.cargo-body')?.scrollTop||0,scrollLeft=current.querySelector('[data-cargo-strip]')?.scrollLeft||0;
      current.outerHTML = markup();
      const fresh=host.querySelector('[data-cargo-view]');if(fresh?.querySelector('.cargo-body'))fresh.querySelector('.cargo-body').scrollTop=scrollTop;if(fresh?.querySelector('[data-cargo-strip]'))fresh.querySelector('[data-cargo-strip]').scrollLeft=scrollLeft;
      if (focusAttr && !drag) {
        const candidate = [...host.querySelectorAll(`[${focusAttr.name}]`)].find(x => x.getAttribute(focusAttr.name) === focusAttr.value);
        if (candidate && !candidate.disabled) candidate.focus({preventScroll:true});
      }
    }

    function select(uid) {
      const item = itemById(uid);
      if (!item || session.discardUids.includes(item.uid)) return;
      const sameSelection = session.selected === item.uid;
      session.selected = item.uid;
      session.rotation = placement(item.uid)?.rotation ?? (sameSelection ? session.rotation : 0);
      session.preview = null;
      session.confirmDiscard = false;
      notice(`已选「${item.name}」。点击空格放置，或拖动调整。`);
    }

    function tryPlace(x, y) {
      if (session.selected == null) return;
      const result = G.place(remainingItems(), session.placements, session.selected, x, y, session.rotation,dims());
      if (!result.ok) { notice(result.message || '此处无法放置，货物仍留在原位。', 'warning'); session.preview = {x,y,ok:false}; }
      else { session.placements = copy(result.placements); session.preview = null; notice('已放入草案。确认后保存排布。', 'success'); }
    }

    function tapCell(x, y) {
      const at = occupant(x, y);
      if (at) { select(at.uid); return; }
      if (session.selected == null) { notice('先点选一个物件。'); return; }
      const anchor = cells(itemById(session.selected), session.rotation)[0];
      tryPlace(x - anchor[0], y - anchor[1]);
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
      if (b.hasAttribute('data-cargo-growth')) {options.onGrowth?.();return;}
      if (b.hasAttribute('data-cargo-save')) { void commit(); return; }
      if(b.hasAttribute('data-cargo-edit')){session.mode='edit';repaint();return;}
      if(b.hasAttribute('data-cargo-mission')){options.onMission?.(latestState.missionSlot);return;}
      if (b.hasAttribute('data-cargo-pick')) select(Number(b.dataset.cargoPick));
      else if (b.hasAttribute('data-cargo-cell')) tapCell(...b.dataset.cargoCell.split(',').map(Number));
      else if (b.hasAttribute('data-cargo-rotate')) {
        if (session.selected == null) return;
        session.rotation = (session.rotation + 1) % 4;
        const p = placement(session.selected);
        if (p) {
          const rotated = G.place(remainingItems(), session.placements, p.uid, p.x, p.y, session.rotation, dims());
          session.preview = { ...p, ok: rotated.ok };
          if (rotated.ok) {
            session.placements = copy(rotated.placements);
            session.preview = null;
            notice('已旋转，确认后保存。', 'success');
          } else notice('此处转不开，点空格重新放置。', 'warning');
        } else {
          session.preview = null;
          notice(`轮廓已旋转${session.rotation * 90}°，点击目标格放置。`);
        }
      } else if (b.hasAttribute('data-cargo-stage')) {
        session.placements = session.placements.filter(p => p.uid !== session.selected);
        session.preview = null;
        notice('暂放到整理区；仍是你的货，确认前需要重新放入。');
      } else if (b.hasAttribute('data-cargo-arrange')) {
        const result = G.solve(remainingItems(), session.placements,dims());
        if (result) { session.placements = copy(result); session.preview = null; session.rotation = placement(session.selected)?.rotation || 0; notice('已找到可行排布。你可以继续微调，再确认保存。', 'success'); }
        else notice(session.action?.type === 'depart' ? '这些货物无法一起装入，请取消装载，回港先出售部分旧货。' : '这些形状无法一起装入当前货舱，需要明确选择保留哪些货物。', 'warning');
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
      if (pick) {
        const rotation = placement(uid)?.rotation ?? (session.selected === uid ? session.rotation : 0);
        [ox, oy] = cells(itemById(uid), rotation)[0];
      }
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
      const x = Math.floor((event.clientX - rect.left) * dims().width / rect.width) - drag.ox;
      const y = Math.floor((event.clientY - rect.top) * dims().height / rect.height) - drag.oy;
      const result = G.place(remainingItems(), session.placements, drag.uid, x, y, session.rotation,dims());
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
      if(session&&host){session.bodyScroll=host.querySelector('.cargo-body')?.scrollTop||0;session.trayScroll=host.querySelector('[data-cargo-strip]')?.scrollLeft||0;}
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
        detach(); host = element;if(session){const body=host.querySelector('.cargo-body'),strip=host.querySelector('[data-cargo-strip]');if(body)body.scrollTop=session.bodyScroll||0;if(strip)strip.scrollLeft=session.trayScroll||0;}
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
