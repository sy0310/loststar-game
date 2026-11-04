import './style.css';
import {icon} from '../icons';
import {discoveries, discoveryById, planetById} from '../content/catalog';
import {curioPrices, projectAvailable, latestNightHistory} from './domain';
import {drawCurioSpecimen} from './curio-condition';
import {cost, MAX_LEVEL, publicRadar, tuning, type UpgradeId, type SaveData} from '../game/engine';
import {growthCatalog, growthChange, growthLevel} from '../game/growth';
import {repairPrice} from '../game/station';
import {worldView} from '../game/world';
import {MuseumScene, residentIds} from '../render/museum';
import {FusionHabitatScene} from './habitat';
import {ArchiveNightReplay} from './archive-replay';
import {drawCaseEngineering} from './case-engineering';
import {RadarScene} from '../render/radar-scene';
import {StarMapScene} from '../render/star-map';
import type {ExpeditionScene} from '../render/scene';
import {receiptRestorationFrame, receiptRestorationMainAction} from '../review/receipt-restoration';
import {InteractionDirector} from '../ui/interaction';
import {equipment, itemArt} from '../ui/art';
import {fusionProjects, fusionTargets, type FusionAction, type FusionController, type FusionSave} from './contracts';

type Tab = 'explore' | 'collection' | 'base';
type Drawer = 'upgrades' | 'station' | 'build' | 'research' | 'map' | 'return' | 'project' | 'detail' | 'case-preview';
type Filter = 'artifact' | 'creature' | 'event';
interface CasePreview {
  id: string;
  name: string;
  before: number;
  after: number;
  price: number;
  at: number;
  receipt: FusionSave['receipt'];
  curios: FusionSave['curios'];
}

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]!));
const format = (value: number) => Math.floor(value).toLocaleString('zh-CN');
const minutes = (milliseconds: number) => `${Math.max(1, Math.ceil(milliseconds / 60000))}分钟`;
const conditionLabels = {found: '带着泥', clean: '已清理', stabilized: '已修补'};
const recordOrigins: Record<string, string> = {marker: '管道箱标', residents: '生态观察窗', night: '收件站夜班'};
const upgradeNames: Record<UpgradeId, string> = {scanner: '机器人', recycler: '飞船', radar: '雷达', cargo: '货舱'};

export function mountFusion(controller: FusionController) {
  const app = document.querySelector<HTMLElement>('#app')!;
  app.innerHTML = `
    <div id="fusion-app">
      <header class="fu-header">
        <button id="fusion-map" class="fu-location" aria-label="打开星图"><span>退货箱星</span><small>退件平原 ${icon('arrow')}</small></button>
        <div class="fu-wallet" aria-label="零件余额">${icon('cube')}<b id="fusion-parts">120</b><small>零件</small></div>
      </header>
      <main id="fusion-scroll">
        <section id="fusion-explore" class="fu-view">
          <div class="fu-world-shell">
            <div id="fusion-tap" role="button" tabindex="0" aria-label="点星球，协助探索"><div id="fusion-world"></div><span id="fusion-tap-hint">星球接通中…</span></div><button id="fusion-scene-retry" class="fu-scene-retry" hidden>重新接通信号</button>
            <span id="fusion-period" class="fu-period">白天</span><div id="fusion-inspection-panel" class="fu-inspection" hidden><canvas id="fusion-inspection" width="780" height="180" aria-label="同一球面的事件近景"></canvas><small>现场观察</small></div>
          </div>
          <section class="fu-explore-controls">
            <div class="fu-action-line"><strong id="fusion-action">搜索箱堆</strong><span id="fusion-percent">0%</span></div>
            <div class="fu-progress" role="progressbar" aria-label="探索进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="fusion-assist-progress"></i><i id="fusion-progress"></i></div>
            <div class="fu-action-bottom"><span id="fusion-auto">自动探索中</span><button id="fusion-upgrades" class="fu-primary">${icon('bolt')}升级</button></div>
            <button id="fusion-damage" class="fu-damage" hidden></button>
          </section>
          <button id="fusion-found" class="fu-found" hidden><span id="fusion-found-art"></span><span><small>新发现</small><strong id="fusion-found-name"></strong></span>${icon('arrow')}</button>
        </section>
        <section id="fusion-collection" class="fu-view" hidden>
          <div class="fu-page-heading"><div><small>失物档案</small><h1>每一件，都有来历</h1></div><span id="fusion-collection-count"></span></div>
          <div id="fusion-collection-dock"></div>
          <div class="fu-filters" role="group" aria-label="收藏分类"><button data-filter="artifact" aria-pressed="true">奇物</button><button data-filter="creature" aria-pressed="false">居民</button><button data-filter="event" aria-pressed="false">事件</button></div>
          <div id="fusion-collection-list"></div>
        </section>
        <section id="fusion-base" class="fu-view" hidden>
          <div class="fu-page-heading"><div><small>失物号 · 归航港</small><h1>收件站</h1></div><button data-drawer="station" class="fu-small" id="fusion-base-integrity">完整度100</button></div>
          <div id="fusion-base-dock"></div>
          <p id="fusion-robot-status" class="fu-robot-status">咔哒正在整理展柜</p>
          <div class="fu-base-actions"><button data-drawer="upgrades">${icon('gear')}设备</button><button data-drawer="build">${icon('base')}建设</button><button data-drawer="research">${icon('book')}调查</button><button data-drawer="station">${icon('radar')}站务</button></div>
          <div id="fusion-project-shortcuts" class="fu-project-shortcuts"></div>
          <div id="fusion-habitats"></div>
        </section>
        <button id="fusion-return-chip" class="fu-return-chip" hidden>飞船回来了 ${icon('arrow')}</button>
        <p id="fusion-save-warning" class="fu-save-warning" hidden>本次进度暂存中，存储恢复后会自动保存。</p>
        <small class="fu-build">${__BUILD_INFO__.version} · ${__BUILD_INFO__.commit}</small>
      </main>
      <nav class="fu-nav" aria-label="主导航"><button data-tab="explore" aria-current="page">${icon('planet')}探索</button><button data-tab="collection" aria-current="false">${icon('book')}收藏<i id="fusion-unread" hidden></i></button><button data-tab="base" aria-current="false">${icon('base')}基地</button></nav>
      <div id="fusion-toast" role="status" aria-live="polite" hidden></div>
      <div id="fusion-museum-source" hidden><div id="fusion-museum"></div></div>
    </div>
    <dialog id="fusion-drawer" aria-labelledby="fusion-drawer-title"><header class="fu-drawer-heading"><h2 id="fusion-drawer-title"></h2><button id="fusion-close" aria-label="关闭详情">${icon('close')}</button></header><div id="fusion-drawer-body"></div></dialog>`;

  const query = <T extends HTMLElement = HTMLElement>(selector: string) => app.querySelector<T>(selector)!;
  const dialog = query<HTMLDialogElement>('#fusion-drawer');
  const body = query('#fusion-drawer-body');
  const worldRoot = query('#fusion-world');
  const museumRoot = query('#fusion-museum');
  const museum = new MuseumScene(museumRoot, () => controller.state.game, id => growthLevel(controller.state.game, id), () => (controller.state.game.world.elapsedMs + Math.min(250, Math.max(0, Date.now() - controller.state.game.lastAt))) / 1000, {
    receiptStudy: true,
    caseEngineering: drawCaseEngineering,
    receiptFrame: () => {
      if (!paperReady || !controller.state.game.collection.includes('receipt')) return undefined;
      const preview = drawer === 'case-preview' ? casePreview : undefined;
      return receiptRestorationFrame(preview?.receipt ?? controller.state.receipt, (preview?.at ?? Date.now()) / 1000);
    },
    drawSpecimen: (context, exhibit, time, image) => {
      const preview = drawer === 'case-preview' ? casePreview : undefined;
      const condition = (preview?.curios ?? controller.state.curios)[exhibit.id];
      if (!condition) return false;
      drawCurioSpecimen(context, exhibit, image, condition, preview?.at ?? Date.now());
      return true;
    },
    specimenOpening: id => {
      const preview = drawer === 'case-preview' ? casePreview : undefined;
      const action = (preview?.curios ?? controller.state.curios)[id]?.action;
      return action ? Math.sin(Math.min(1, Math.max(0, ((preview?.at ?? Date.now()) - action.startedAt) / (action.endsAt - action.startedAt))) * Math.PI) : 0;
    },
  });
  const habitats: FusionHabitatScene[] = [];
  const projectHabitats: FusionHabitatScene[] = [];
  const interactions = new InteractionDirector(body);
  let scene: ExpeditionScene | undefined;
  let pulse: (() => void) | undefined;
  let focus: (() => {x: number; y: number}) | undefined;
  let inspectionCenter = {x: 416, y: 350};
  let lastInspectionPaint = 0;
  let tab: Tab = 'explore';
  let filter: Filter = 'artifact';
  let drawer: Drawer = 'upgrades';
  let detailId = '';
  let projectId = '';
  let collectionSignature = '';
  let baseSignature = '';
  let habitatSignature = '';
  let previousCollection = new Set(controller.state.game.collection);
  let lastPointer = 'mouse';
  let toastTimer: ReturnType<typeof setTimeout>;
  let foundTimer: ReturnType<typeof setTimeout>;
  let paperReady = false;
  let focusReady = false;
  let lastFocusPaint = 0;
  let sideLight = false;
  let radar: RadarScene | undefined;
  let starMap: StarMapScene | undefined;
  let archiveReplay: ArchiveNightReplay | undefined;
  let archiveSource: SaveData | undefined;
  let casePreview: CasePreview | undefined;
  let casePreviewLevel = 0;
  let casePreviewDirty = false;

  function toast(message: string) {
    const element = query('#fusion-toast');
    element.textContent = message;
    element.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {element.hidden = true;}, 2300);
  }

  async function act(action: FusionAction, success?: string) {
    const result = await controller.act(action);
    if (result.message) toast(result.message);
    else if (result.ok && success) toast(success);
    return result;
  }

  function selectTab(next: Tab) {
    tab = next;
    for (const id of ['explore', 'collection', 'base'] as const) query(`#fusion-${id}`).hidden = id !== next;
    for (const button of app.querySelectorAll<HTMLElement>('[data-tab]')) button.setAttribute('aria-current', button.dataset.tab === next ? 'page' : 'false');
    scene?.setActive(next === 'explore' && !dialog.open);
    museum.setActive(next !== 'explore' && !dialog.open);
    if (next !== 'explore') museum.mount(query(next === 'collection' ? '#fusion-collection-dock' : '#fusion-base-dock'));
    for (const habitat of habitats) habitat.setActive(next === 'base' && !dialog.open);
    if (next === 'collection') query('#fusion-unread').hidden = true;
    query('#fusion-scroll').scrollTo(0, 0);
    update();
  }

  function clearProjectHabitats() {
    archiveReplay?.stop();
    for (const habitat of projectHabitats) habitat.dispose();
    projectHabitats.length = 0;
  }

  function closeDrawer() {
    interactions.hide();
    clearProjectHabitats();
    radar?.setActive(false);
    starMap?.setActive(false);
    dialog.close();
    scene?.setActive(tab === 'explore');
    museum.setActive(tab !== 'explore');
    for (const habitat of habitats) habitat.setActive(tab === 'base');
  }

  function showDrawer(kind: Drawer, title: string, content: string) {
    interactions.hide();
    clearProjectHabitats();
    radar?.setActive(false);
    starMap?.setActive(false);
    drawer = kind;
    query('#fusion-drawer-title').textContent = title;
    body.innerHTML = content;
    focusReady = false;
    sideLight = false;
    if (!dialog.open) dialog.showModal();
    body.scrollTop = 0;
    dialog.scrollTop = 0;
    scene?.setActive(false);
    museum.setActive(false);
    for (const habitat of habitats) habitat.setActive(false);
    updateLiveDrawer();
  }

  function upgradeCard(id: UpgradeId) {
    const state = controller.state.game;
    const level = state.upgrades[id];
    const current = tuning(state);
    const nextState = {...state, upgrades: {...state.upgrades, [id]: level + 1}};
    const next = tuning(nextState);
    const effect = id === 'scanner' ? `${(current.scanner / 1000).toFixed(1)}秒 → ${(next.scanner / 1000).toFixed(1)}秒`
      : id === 'recycler' ? `${current.recycler} → ${next.recycler}零件／轮`
        : id === 'radar' ? `${current.radar.toFixed(2)} → ${next.radar.toFixed(2)}倍勘测`
          : `${current.cargo / 3600} → ${next.cargo / 3600}小时离线`;
    const hint = {scanner: '探索更快', recycler: '带回更多', radar: '听见更多回波', cargo: '安心离开久一点'}[id];
    return `<article class="fu-upgrade"><img src="${equipment[id]}" alt=""><div><header><h3>${upgradeNames[id]}</h3><small>Lv${level}</small></header><p>${hint}</p><strong>${level < MAX_LEVEL ? effect : '已完成本阶段升级'}</strong></div><button data-upgrade="${id}" data-expected="${level}" ${level >= MAX_LEVEL || state.resources < cost(state, id) ? 'disabled' : ''}>${level >= MAX_LEVEL ? '已完成' : `升级 ${cost(state, id)}`}</button></article>`;
  }

  function openUpgrades() {
    showDrawer('upgrades', '设备升级', `<div class="fu-upgrade-list">${upgradeCard('scanner')}${upgradeCard('recycler')}</div><details class="fu-details"><summary>其他设备</summary>${upgradeCard('radar')}${upgradeCard('cargo')}</details>`);
  }

  function openStation() {
    const state = controller.state.game;
    const night = worldView(state).phase === 'night';
    const report = state.station.lastNight;
    showDrawer('station', '收件站', `
      <div class="fu-integrity"><b id="fusion-station-value">${state.station.integrity}<small>/100</small></b><span>基地完整度</span></div>
      <div class="fu-progress"><i id="fusion-station-progress" style="width:${state.station.integrity}%"></i></div>
      <label class="fu-switch">自动维修<input id="fusion-auto-repair" type="checkbox" ${state.station.autoRepair ? 'checked' : ''}></label>
      <p class="fu-muted">每点${repairPrice(state)}零件，清晨按实际损伤维修。</p>
      <button class="fu-wide fu-primary" id="fusion-manual-repair" ${night || state.station.integrity >= 100 || state.resources < repairPrice(state) ? 'disabled' : ''}>${night ? '清晨安排维修' : `维修 ${Math.min(100 - state.station.integrity, Math.floor(state.resources / repairPrice(state))) * repairPrice(state)}`}</button>
      ${report ? `<div class="fu-result"><strong>上一夜</strong><p>收容${report.intercepted}位 · 抵站${report.arrived}位</p><p>修复${report.repaired}点 · 花费${report.spent}零件</p></div>` : ''}
      <details class="fu-details"><summary>安保设备</summary>${[0, 1].map(slot => `<label class="fu-switch">${slot ? '隔离门' : '探照灯'}<input type="checkbox" data-slot="${slot}" ${state.world.slots[slot] ? 'checked' : ''} ${night ? 'disabled' : ''}></label>`).join('')}${['guard-0', 'guard-1', 'repair-bay'].map(growthCard).join('')}</details>`);
  }

  function growthCard(id: string) {
    const state = controller.state.game;
    const entry = growthCatalog.find(item => item.id === id)!;
    const level = growthLevel(state, id);
    const change = growthChange(state, id);
    const available = !entry.requires || state.collection.includes(entry.requires);
    const price = entry.costs[level];
    return `<article class="fu-growth" data-growth-id="${id}"><div><h3>${entry.name}<small>Lv${level}</small></h3><p>${escape(level >= entry.costs.length ? change.before : `${change.before} → ${change.after}`)}</p></div><button data-growth="${id}" data-expected="${level}" ${!available || price === undefined || state.resources < price ? 'disabled' : ''}>${!available ? '等待发现' : price === undefined ? '已建成' : `升级 ${price}`}</button></article>`;
  }

  function openBuild() {
    const sections = [
      ['展柜', growthCatalog.filter(entry => entry.group === '展示')],
      ['生态与基地', growthCatalog.filter(entry => ['生态', '设施', '装饰'].includes(entry.group))],
      ['勘探模块', growthCatalog.filter(entry => entry.group === '研究')],
    ] as const;
    showDrawer('build', '基地建设', `${fusionProjects.map(project => {
      const owned = controller.state.projects.includes(project.id);
      const available = projectAvailable(controller.state, project.id);
      return `<article class="fu-project"><div><small>永久工程</small><h3>${project.name}</h3><p>${project.effect}</p></div><button ${owned ? `data-open-project="${project.id}"` : `data-project="${project.id}"`} ${!owned && !available.available ? 'disabled' : ''}>${owned ? '进入' : available.available ? `建设 ${project.price}` : available.reason}</button></article>`;
    }).join('')}${sections.map(([title, entries]) => `<details class="fu-details"><summary>${title}</summary>${entries.filter(entry => !entry.requires || controller.state.game.collection.includes(entry.requires)).map(entry => growthCard(entry.id)).join('')}</details>`).join('')}`);
  }

  async function openCasePreview(id: string, before: number, price: number) {
    const entry = growthCatalog.find(item => item.id === id)!;
    const state = controller.state;
    casePreview = {
      id, name: entry.name, before, after: growthLevel(state.game, id), price,
      at: state.game.lastAt, receipt: structuredClone(state.receipt), curios: structuredClone(state.curios),
    };
    casePreviewLevel = casePreview.after;
    casePreviewDirty = true;
    showDrawer('case-preview', `${entry.name}已升级`, `
      <canvas id="fusion-case-preview" width="400" height="430" role="img" aria-label="同一展柜升级前后近景"></canvas>
      <div class="fu-mode-buttons"><button data-case-preview="${before}" aria-pressed="false">升级前 Lv${before}</button><button data-case-preview="${casePreview.after}" aria-pressed="true">升级后 Lv${casePreview.after}</button></div>
      <p class="fu-muted">本次花费${price}零件</p><button id="fusion-return-build" class="fu-wide">返回建设</button>`);
    await museum.ready;
    if (id === 'case-0') await prepareFocus();
    casePreviewDirty = true;
  }

  function openResearch() {
    const state = controller.state;
    showDrawer('research', '定向调查', `
      <div id="fusion-active-task"></div>
      ${fusionTargets.map(target => `<article class="fu-project"><div><h3>${target.name}</h3><p>${target.effect}</p><small>${minutes(target.duration)} · ${target.price}零件</small></div><button data-task="${target.id}" ${state.task || state.game.resources < target.price ? 'disabled' : ''}>安排</button></article>`).join('')}
      <details class="fu-details"><summary>调查规则</summary><p class="fu-muted">离线继续计时，完成还需对应现场实际发生。已有记录可复核，取消按剩余时间退还零件。</p></details>
      <div class="fu-records">${renderRecords(state.records.slice(-8).reverse())}</div>`);
  }

  function renderRecords(records: FusionSave['records']) {
    return records.length ? records.map(record => `<article class="fu-record"><small>${new Date(record.at).toLocaleTimeString('zh-CN', {hour: '2-digit', minute: '2-digit'})} · ${escape(recordOrigins[record.target] ?? '现场观察')}</small><p>${escape(record.detail)}</p></article>`).join('') : '<p class="fu-empty">观察之后，记录会留在这里。</p>';
  }

  function openProject(id: string) {
    projectId = id;
    const project = fusionProjects.find(item => item.id === id)!;
    if (!controller.state.projects.includes(id)) return;
    if (id === 'evidence-bench') {
      showDrawer('project', project.name, `<div class="fu-bench"><canvas id="fusion-paper-focus" width="400" height="480" role="img" aria-label="已取得收据的实物观察"></canvas></div><div class="fu-mode-buttons"><button data-light="normal" aria-pressed="true">原光</button><button data-light="side" aria-pressed="false">侧光</button></div><p class="fu-muted">同一原件 · RET-031</p><h3>现场对照</h3>${renderRecords(controller.state.records.filter(record => record.target === 'marker'))}`);
      void prepareFocus();
    } else if (id === 'habitat-window') {
      showDrawer('project', project.name, `<div id="fusion-project-habitats"></div><h3>观察记录</h3>${renderRecords(controller.state.records.filter(record => record.target === 'residents').slice(-8).reverse())}`);
      addHabitats(query('#fusion-project-habitats'), true);
    } else {
      archiveSource = latestNightHistory(controller.state) ?? undefined;
      const report = archiveSource?.station.lastNight ?? controller.state.game.station.lastNight;
      const canReplay = report && archiveSource?.world.lastReport?.result && archiveSource.world.lastReport.number === report.number;
      showDrawer('project', project.name, `${report ? `<div class="fu-result"><strong>第${report.number}夜</strong><p>收容${report.intercepted}位 · 抵站${report.arrived}位</p><p>损伤${report.damage}点 · 维修${report.spent}零件</p></div>` : ''}<div id="fusion-archive-replay" class="fu-archive-replay"></div><button class="fu-wide fu-primary" id="fusion-replay-night" ${!canReplay ? 'disabled' : ''}>回放这一夜</button><p id="fusion-replay-status" class="fu-muted">${report ? `第${report.number}夜 · 处置回放` : '等待一次实际夜班记录'}</p><div class="fu-records">${renderRecords(controller.state.records.filter(record => record.target === 'night').slice(-12).reverse())}</div><button class="fu-wide" id="fusion-watch-world">观察收件站</button>`);
      if (archiveReplay) archiveReplay.mount(query('#fusion-archive-replay'));
    }
  }

  function openMap() {
    const state = controller.state.game;
    showDrawer('map', '星域雷达', `<div id="fusion-local-radar" class="fu-radar"></div><div class="fu-map-status"><strong id="fusion-radar-stage"></strong><span id="fusion-radar-percent"></span></div><p id="fusion-radar-note" class="fu-muted"></p><details class="fu-details"><summary>已确认航路</summary><div id="fusion-star-map"></div><div id="fusion-routes"></div></details>`);
    radar = new RadarScene(query('#fusion-local-radar'), () => publicRadar(controller.state.game));
    radar.setActive(true);
    starMap = new StarMapScene(query('#fusion-star-map'), () => {
      const scan = publicRadar(controller.state.game, 'interstellar');
      return {stage: scan.stage, progress: scan.progress, records: controller.state.game.chart.records.map(record => ({id: record.id, name: planetById(record.id)!.name, x: record.x, y: record.y})), research: growthLevel(controller.state.game, 'receiver')};
    });
    query('#fusion-star-map').closest('details')!.addEventListener('toggle', event => starMap?.setActive((event.currentTarget as HTMLDetailsElement).open));
    query('#fusion-routes').innerHTML = controller.state.game.chart.records.map(record => `<div class="fu-record"><strong>${escape(planetById(record.id)!.name)}</strong><small>已记录航路</small></div>`).join('');
    updateLiveDrawer();
  }

  function openReturn() {
    const cargo = controller.state.game.pendingReturn;
    if (!cargo) return;
    showDrawer('return', '失物号回来了', `<div class="fu-return-art">${icon('rocket')}</div><div class="fu-reward"><small>本次带回</small><b>+${format(cargo.resources)}<span>零件</span></b></div><p class="fu-muted">有效探索${Math.floor(cargo.seconds / 60)}分钟${cargo.maintenance ? ` · 维修${cargo.maintenance}零件` : ''}</p><div class="fu-return-items">${cargo.discoveries.map(id => `<div>${itemArt(id)}<span>${escape(discoveryById(id)?.name ?? '')}</span></div>`).join('')}</div><button id="fusion-claim" class="fu-wide fu-primary">收下成果</button>`);
  }

  async function prepareFocus() {
    await museum.ready;
    if (!paperReady) {
      await museum.prepareReceiptRestoration();
      paperReady = true;
    }
    focusReady = true;
    updateLiveDrawer();
  }

  function showDetail(id: string) {
    const state = controller.state;
    if (!state.game.collection.includes(id)) return;
    const discovery = discoveryById(id)!;
    detailId = id;
    showDrawer('detail', discovery.name, `
      ${id === 'receipt' ? '<canvas id="fusion-paper-focus" width="400" height="520" role="img" aria-label="收据物理状态与修补近景"></canvas><div class="fu-paper-status"><span id="fusion-paper-condition"></span><span id="fusion-paper-missing"></span></div><div class="fu-progress"><i id="fusion-paper-progress"></i></div>' : `<canvas id="fusion-exhibit-focus" width="400" height="370" role="img" aria-label="${escape(discovery.name)}玻璃容器近景"></canvas>`}
      <div class="fu-detail-actions">${id === 'receipt' ? '<button id="fusion-paper-primary" class="fu-primary"></button>' : ''}${curioPrices[id] ? '<button id="fusion-curio-primary" class="fu-primary"></button>' : ''}<button id="fusion-try">试一试</button></div>
      <div id="interaction-feedback" class="fu-interaction" hidden><canvas width="320" height="180" aria-label="奇物互动演出"></canvas><p id="interaction"></p><button id="fusion-hide-interaction">收起</button></div>
      ${curioPrices[id] ? '<p id="fusion-curio-condition" class="fu-muted"></p>' : ''}<details class="fu-details"><summary>它的来历</summary><p>${escape(discovery.description)}</p><p>${escape(discovery.fieldNote)}</p>${id === 'receipt' ? '<p id="fusion-paper-evidence"></p>' : ''}</details>`);
    if (id === 'receipt') void prepareFocus().catch(() => toast('整理台暂未接通，请再试一次'));
    else {
      void museum.ready.then(() => {
        if (!dialog.open || drawer !== 'detail' || detailId !== id) return;
        const canvas = query<HTMLCanvasElement>('#fusion-exhibit-focus');
        const index = ['receipt', 'tape', 'nested', 'stamp', 'cosmic-parcel', 'bell'].indexOf(id);
        if (canvas && index >= 0) museum.renderExhibit(canvas, id, growthLevel(controller.state.game, `case-${index}`));
        else if (canvas) {
          canvas.replaceWith(document.createElement('div'));
          body.insertAdjacentHTML('afterbegin', `<div class="fu-detail-art">${itemArt(id)}</div>`);
        }
      });
    }
    updateLiveDrawer();
  }

  function addHabitats(root: HTMLElement, active: boolean, only?: typeof residentIds[number]) {
    for (const [index, id] of residentIds.entries()) {
      if (!controller.state.game.collection.includes(id) || only && only !== id) continue;
      const card = document.createElement('button');
      card.className = 'fu-habitat';
      card.dataset.detail = id;
      card.innerHTML = `<span class="fu-habitat-window"></span><span>${escape(discoveryById(id)!.name)} ${icon('arrow')}</span>`;
      root.append(card);
      const habitat = new FusionHabitatScene(card.querySelector('.fu-habitat-window')!, id, () => controller.state.game, () => growthLevel(controller.state.game, `habitat-${index}`));
      habitat.setActive(active);
      (root.id === 'fusion-project-habitats' ? projectHabitats : habitats).push(habitat);
    }
  }

  function renderCollection() {
    const state = controller.state.game;
    const known = discoveries.filter(item => state.collection.includes(item.id) && item.kind === filter);
    query('#fusion-collection-count').textContent = `${state.collection.length}份记录`;
    query('#fusion-collection-list').innerHTML = known.length ? known.map(item => `<button class="fu-collection-item" data-detail="${item.id}">${itemArt(item.id)}<span><strong>${escape(item.name)}</strong><small>${item.rarity}${item.id === 'receipt' ? ` · ${controller.state.receipt.stage === 'buried' ? '土样中' : conditionLabels[controller.state.receipt.condition]}` : ''}</small></span>${icon('arrow')}</button>`).join('') : '<p class="fu-empty">咔哒正在找，下一次会带回什么？</p>';
  }

  function updateLiveDrawer() {
    if (!dialog.open) return;
    const state = controller.state;
    if (drawer === 'detail' && detailId === 'receipt') {
      const frame = receiptRestorationFrame(state.receipt, Date.now() / 1000);
      const main = receiptRestorationMainAction({...state.receipt, parts: state.game.resources});
      const primary = query<HTMLButtonElement>('#fusion-paper-primary');
      const labels = {excavate: '取出', clean: '清理 40', repair: '修补 120', identify: '对照线索', 'visit-field': '去找线索'};
      primary.textContent = state.receipt.activeAction ? '正在整理…' : labels[main.kind as keyof typeof labels];
      primary.dataset.kind = main.kind;
      primary.disabled = !focusReady || main.disabled;
      query<HTMLButtonElement>('#fusion-try').disabled = state.receipt.stage === 'buried' || !!state.receipt.activeAction;
      query('#fusion-paper-condition').textContent = state.receipt.stage === 'buried' ? '土样中' : conditionLabels[state.receipt.condition];
      query('#fusion-paper-missing').textContent = `待查${frame.reading.missingCount}项`;
      query('#fusion-paper-missing').dataset.count = String(frame.reading.missingCount);
      query('#fusion-paper-progress').style.width = `${state.receipt.activeAction ? frame.progress * 100 : 0}%`;
      query('#fusion-paper-evidence').textContent = `原件RET-031。${state.receipt.verifiedEvidenceIds.length ? '来源已核对。' : '来源待现场核对。'}签收记录仍待证。`;
    }
    if (drawer === 'detail' && curioPrices[detailId]) {
      const curio = state.curios[detailId];
      const primary = query<HTMLButtonElement>('#fusion-curio-primary');
      if (curio) {
        const next = curio.condition === 'found' ? 'clean' : 'repair';
        primary.textContent = curio.action ? '正在整理…' : curio.condition === 'stabilized' ? '已整理' : `${next === 'clean' ? '清理' : '修补'} ${curioPrices[detailId][next]}`;
        primary.dataset.kind = next;
        primary.disabled = !!curio.action || curio.condition === 'stabilized' || state.game.resources < curioPrices[detailId][next];
        query('#fusion-curio-condition').textContent = conditionLabels[curio.condition];
      }
    }
    if (drawer === 'research') {
      const task = state.task;
      const active = query('#fusion-active-task');
      const legacyTask = task ? null : state.game.research.active;
      if (active.dataset.task !== (task?.id ?? legacyTask?.id ?? '')) {
        active.dataset.task = task?.id ?? legacyTask?.id ?? '';
        active.innerHTML = task ? `<div class="fu-active-task"><span>${fusionTargets.find(target => target.id === task.target)!.name}</span><strong id="fusion-task-remaining"></strong><button data-cancel-task="${task.id}">取消，退还未用零件</button></div>` : legacyTask ? '<p id="fusion-legacy-task" class="fu-muted"></p>' : '';
      }
      if (legacyTask) query('#fusion-legacy-task').textContent = `已有调查进行中 · 余${minutes(Math.max(0, legacyTask.end - state.game.world.elapsedMs))}`;
      if (task) query('#fusion-task-remaining').textContent = task.endsAt > state.game.lastAt ? minutes(task.endsAt - state.game.lastAt) : '等待现场发生';
      for (const button of body.querySelectorAll<HTMLButtonElement>('[data-task]')) {
        const target = fusionTargets.find(item => item.id === button.dataset.task)!;
        const eligible = target.id === 'marker' ? state.game.collection.includes('receipt') : target.id === 'residents' ? residentIds.some(id => state.game.collection.includes(id)) : state.game.world.settledNights > 0;
        button.disabled = !!task || !!state.game.research.active || state.game.resources < target.price || !eligible;
        button.textContent = eligible ? '安排' : target.id === 'marker' ? '等待收据' : target.id === 'residents' ? '等待居民' : '等待夜班';
      }
    }
    if (drawer === 'station') {
      query('#fusion-station-value').innerHTML = `${state.game.station.integrity}<small>/100</small>`;
      query('#fusion-station-progress').style.width = `${state.game.station.integrity}%`;
      const manual = query<HTMLButtonElement>('#fusion-manual-repair');
      const night = worldView(state.game).phase === 'night';
      manual.disabled = night || state.game.station.integrity >= 100 || state.game.resources < repairPrice(state.game);
      manual.textContent = night ? '清晨安排维修' : `维修 ${Math.min(100 - state.game.station.integrity, Math.floor(state.game.resources / repairPrice(state.game))) * repairPrice(state.game)}`;
    }
    for (const button of body.querySelectorAll<HTMLButtonElement>('[data-upgrade]')) {
      const id = button.dataset.upgrade as UpgradeId;
      button.disabled = state.game.upgrades[id] >= MAX_LEVEL || state.game.resources < cost(state.game, id);
    }
    for (const button of body.querySelectorAll<HTMLButtonElement>('[data-growth]')) {
      const entry = growthCatalog.find(item => item.id === button.dataset.growth)!;
      const price = entry.costs[growthLevel(state.game, entry.id)];
      button.disabled = price === undefined || state.game.resources < price || !!entry.requires && !state.game.collection.includes(entry.requires);
    }
    for (const button of body.querySelectorAll<HTMLButtonElement>('[data-project]')) {
      const availability = projectAvailable(state, button.dataset.project!);
      button.disabled = !availability.available;
      button.textContent = availability.available ? `建设 ${fusionProjects.find(project => project.id === button.dataset.project)!.price}` : availability.reason!;
    }
    if (drawer === 'map') {
      const radarState = publicRadar(state.game);
      const labels = {searching: '持续扫描中', anomaly: '听见异常回波', locking: '正在核对位置', surveyed: '现场已定位'};
      query('#fusion-radar-stage').textContent = labels[radarState.stage];
      query('#fusion-radar-percent').textContent = `${radarState.progress}%`;
      query('#fusion-radar-note').textContent = radarState.stage === 'surveyed' ? radarState.signal.name : '先听清脚下这颗星球。';
    }
  }

  function update() {
    const state = controller.state;
    const game = state.game;
    const world = worldView(game);
    const night = world.phase === 'night';
    query('#fusion-parts').textContent = format(game.resources);
    query('#fusion-save-warning').hidden = controller.persisted;
    query('#fusion-period').textContent = {day: '白天', dusk: '黄昏', night: '夜间', dawn: '清晨'}[world.period];
    query('#fusion-period').dataset.period = world.period;
    query('#fusion-tap').setAttribute('aria-label', night ? '查看夜间行动' : '点星球，协助探索');
    const worldFailed = worldRoot.dataset.error === 'true';
    const worldReady = scene?.ready === true && !worldFailed;
    query('#fusion-tap').setAttribute('aria-disabled', String(!worldReady));
    query('#fusion-scene-retry').hidden = !worldFailed;
    const progress = night ? Math.min(100, world.nightBase / 60 * 100) : Math.min(100, game.cycleMs / tuning(game).scanner * 100);
    const pending = (game as typeof game & {assist?: {pendingWorkMs: number}}).assist?.pendingWorkMs ?? 0;
    query('#fusion-progress').style.width = `${progress}%`;
    query('#fusion-assist-progress').style.width = `${night ? progress : Math.min(100, progress + pending / tuning(game).scanner * 100)}%`;
    query('.fu-explore-controls [role="progressbar"]').setAttribute('aria-valuenow', String(Math.floor(progress)));
    query('#fusion-percent').textContent = night ? `${Math.ceil(world.untilNextMs / 1000)}秒` : `${Math.floor(progress)}%`;
    query('.fu-explore-controls [role="progressbar"]').setAttribute('aria-label', night ? '夜班进度' : '探索进度');
    const phase = scene?.canvas.dataset.fusionPhase;
    const repair = game.station.lastRepair;
    const showInspection = tab === 'explore' && (night && ['patrol', 'track', 'identify', 'contain', 'result', 'return'].includes(phase ?? '') || !!repair && game.lastAt - repair.at < 4000);
    query('#fusion-inspection-panel').hidden = !showInspection;
    query('#fusion-action').textContent = night ? ({appear: '箱堆传来动静', track: '咔哒正在追踪', identify: '核对访客标记', contain: '引导访客入站', result: '正在归档结果', return: '咔哒正在回站'}[phase ?? ''] ?? '咔哒正在巡守') : world.period === 'dawn' ? '清晨，继续探索' : '搜索箱堆';
    query('#fusion-auto').textContent = night ? '夜间自动守护' : pending > 0 ? '助力探索中' : '自动探索中';
    query('#fusion-tap-hint').textContent = worldFailed ? '信号中断，请重新接通' : !worldReady ? '星球接通中…' : night ? '点一下，关注夜间行动' : pending > 0 ? '咔哒收到啦' : '点一下，帮咔哒探索';
    query('#fusion-damage').hidden = game.station.integrity >= 100;
    query('#fusion-damage').textContent = `完整度${game.station.integrity} · 查看维修`;
    query('#fusion-base-integrity').textContent = `完整度${game.station.integrity}`;
    query('#fusion-return-chip').hidden = !game.pendingReturn;
    const fresh = game.collection.find(id => !previousCollection.has(id));
    previousCollection = new Set(game.collection);
    if (fresh) {
      query('#fusion-found-art').innerHTML = itemArt(fresh);
      query('#fusion-found-name').textContent = discoveryById(fresh)!.name;
      query('#fusion-found').dataset.detail = fresh;
      query('#fusion-found').hidden = false;
      query('#fusion-unread').hidden = tab === 'collection';
      scene?.celebrate(discoveryById(fresh)!.presentation.cue);
      clearTimeout(foundTimer);
      foundTimer = setTimeout(() => {query('#fusion-found').hidden = true;}, 5000);
    }
    if (game.collection.includes('receipt') && !paperReady) void prepareFocus().catch(() => {});
    const signature = `${game.collection.join(',')}/${filter}/${state.receipt.condition}/${state.receipt.stage}`;
    if (signature !== collectionSignature) {collectionSignature = signature;renderCollection();museum.refresh();}
    const baseKey = `${game.collection.join(',')}/${JSON.stringify(game.growth)}/${state.projects.join(',')}`;
    if (baseKey !== baseSignature) {
      baseSignature = baseKey;
      query('#fusion-project-shortcuts').innerHTML = fusionProjects.filter(project => state.projects.includes(project.id)).map(project => `<button data-open-project="${project.id}">${project.name}${icon('arrow')}</button>`).join('');
      const habitatKey = residentIds.filter(id => game.collection.includes(id)).join(',');
      if (habitatKey !== habitatSignature) {
        habitatSignature = habitatKey;
        for (const id of residentIds) {
          if (game.collection.includes(id) && !query('#fusion-habitats').querySelector(`[data-detail="${id}"]`)) addHabitats(query('#fusion-habitats'), tab === 'base', id);
        }
      }
    }
    updateLiveDrawer();
  }

  museumRoot.addEventListener('robot-state', event => {
    const pose = (event as CustomEvent).detail;
    const labels: Record<string, string> = {walk: '走向展柜', observe: '观察藏品', open: '打开玻璃罩', lift: '轻轻取出', inspect: '检查与整理', place: '放回原位', wipe: '擦拭展柜', return: '返回工作台'};
    query('#fusion-robot-status').textContent = `咔哒 · ${labels[pose.action] ?? '整理中'}`;
  });

  let down: {x: number; y: number; id: number} | null = null;
  query('#fusion-tap').addEventListener('pointerdown', event => {
    const pointer = event as PointerEvent;
    down = {x: pointer.clientX, y: pointer.clientY, id: pointer.pointerId};
  });
  query('#fusion-tap').addEventListener('pointercancel', () => {down = null;});
  async function assist() {
    if (!scene?.ready || worldRoot.dataset.error === 'true' || dialog.open || tab !== 'explore') return;
    if (worldView(controller.state.game).phase === 'night') {pulse?.();return;}
    const result = await act({type: 'tap'});
    if (result.ok) pulse?.();
  }
  query('#fusion-tap').addEventListener('pointerup', event => {
    const pointer = event as PointerEvent;
    if (!down || down.id !== pointer.pointerId) return;
    const moved = Math.hypot(pointer.clientX - down.x, pointer.clientY - down.y);
    down = null;
    const bounds = scene?.canvas.getBoundingClientRect();
    const onPlanet = bounds && ((pointer.clientX - bounds.left - bounds.width * .5) / (bounds.width * .46)) ** 2 + ((pointer.clientY - bounds.top - bounds.height * .52) / (bounds.height * .5)) ** 2 <= 1;
    if (moved <= 10 && onPlanet && !dialog.open && tab === 'explore') void assist();
  });
  query('#fusion-tap').addEventListener('keydown', event => {
    const key = event as KeyboardEvent;
    if (key.key !== 'Enter' && key.key !== ' ') return;
    key.preventDefault();
    if (!key.repeat) void assist();
  });
  app.addEventListener('pointerup', event => {lastPointer = (event as PointerEvent).pointerType || 'mouse';}, {passive: true});
  app.addEventListener('click', async event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || button.disabled) return;
    if (button.dataset.tab) {selectTab(button.dataset.tab as Tab);return;}
    if (button.dataset.filter) {
      filter = button.dataset.filter as Filter;
      for (const option of app.querySelectorAll<HTMLElement>('[data-filter]')) option.setAttribute('aria-pressed', String(option === button));
      renderCollection();return;
    }
    const id = button.dataset.detail ?? button.dataset.exhibit;
    if (id) {showDetail(id);return;}
    if (button.id === 'fusion-close') {closeDrawer();return;}
    if (button.id === 'fusion-upgrades' || button.dataset.drawer === 'upgrades') {openUpgrades();return;}
    if (button.id === 'fusion-map') {openMap();return;}
    if (button.id === 'fusion-scene-retry') {location.reload();return;}
    if (button.id === 'fusion-return-chip') {openReturn();return;}
    if (button.id === 'fusion-damage' || button.dataset.drawer === 'station') {openStation();return;}
    if (button.dataset.drawer === 'build') {openBuild();return;}
    if (button.dataset.drawer === 'research') {openResearch();return;}
    if (button.dataset.upgrade) {
      const result = await act({type: 'upgrade', id: button.dataset.upgrade as UpgradeId, expected: Number(button.dataset.expected)}, '设备升级啦');
      if (result.ok) openUpgrades();return;
    }
    if (button.dataset.growth) {
      const id = button.dataset.growth;
      const before = Number(button.dataset.expected);
      const price = growthCatalog.find(entry => entry.id === id)!.costs[before];
      const result = await act({type: 'growth', id, expected: before}, '基地有了新变化');
      if (result.ok) {
        if (id.startsWith('case-')) await openCasePreview(id, before, price);
        else drawer === 'station' ? openStation() : openBuild();
      }
      return;
    }
    if (button.dataset.casePreview !== undefined) {
      casePreviewLevel = Number(button.dataset.casePreview);
      casePreviewDirty = true;
      for (const option of body.querySelectorAll<HTMLElement>('[data-case-preview]')) option.setAttribute('aria-pressed', String(option === button));
      return;
    }
    if (button.id === 'fusion-return-build') {openBuild();return;}
    if (button.dataset.project) {
      const result = await act({type: 'project', id: button.dataset.project}, '工程已建成');
      if (result.ok) openProject(button.dataset.project);return;
    }
    if (button.dataset.openProject) {openProject(button.dataset.openProject);return;}
    if (button.dataset.task) {
      const result = await act({type: 'task', target: button.dataset.task as 'marker' | 'residents' | 'night'}, '调查已安排');
      if (result.ok) openResearch();return;
    }
    if (button.dataset.cancelTask) {
      await act({type: 'cancel-task', id: button.dataset.cancelTask});openResearch();return;
    }
    if (button.id === 'fusion-claim') {await act({type: 'claim'}, '成果已入库');closeDrawer();return;}
    if (button.id === 'fusion-manual-repair') {await act({type: 'repair', expected: controller.state.game.station.integrity});openStation();return;}
    if (button.id === 'fusion-paper-primary') {
      const main = receiptRestorationMainAction(controller.state.receipt);
      if (main.kind === 'visit-field') {closeDrawer();selectTab('explore');toast('留意管道旁的箱标');return;}
      await act({type: 'paper', kind: main.kind});return;
    }
    if (button.id === 'fusion-curio-primary') {
      await act({type: 'curio', id: detailId, kind: button.dataset.kind as 'clean' | 'repair'});return;
    }
    if (button.id === 'fusion-try') {
      if (detailId === 'receipt') await act({type: 'paper', kind: 'try'});
      else {
        interactions.show(detailId, lastPointer);
        requestAnimationFrame(() => query('#interaction-feedback').scrollIntoView({block: 'nearest'}));
      }
      return;
    }
    if (button.id === 'fusion-hide-interaction') {interactions.hide();return;}
    if (button.dataset.light) {
      sideLight = button.dataset.light === 'side';
      for (const option of body.querySelectorAll<HTMLElement>('[data-light]')) option.setAttribute('aria-pressed', String(option === button));
      return;
    }
    if (button.id === 'fusion-replay-night') {
      const root = query('#fusion-archive-replay');
      archiveReplay ??= new ArchiveNightReplay(root);
      archiveReplay.mount(root);
      if (!archiveSource) return;
      archiveReplay.start(archiveSource);
      requestAnimationFrame(() => root.scrollIntoView({block: 'start'}));
      button.textContent = '重新回放';
      return;
    }
    if (button.id === 'fusion-watch-world') {closeDrawer();selectTab('explore');}
  });
  app.addEventListener('change', event => {
    const target = event.target as HTMLInputElement;
    if (target.dataset.slot !== undefined) void act({type: 'slot', slot: Number(target.dataset.slot) as 0 | 1, enabled: target.checked});
    if ((event.target as HTMLElement).id === 'fusion-auto-repair') void act({type: 'auto-repair', enabled: (event.target as HTMLInputElement).checked});
  });
  dialog.addEventListener('click', event => {if (event.target === dialog) closeDrawer();});
  dialog.addEventListener('cancel', () => {interactions.hide();clearProjectHabitats();scene?.setActive(tab === 'explore');museum.setActive(tab !== 'explore');for (const habitat of habitats) habitat.setActive(tab === 'base');});
  controller.subscribe(update);
  update();

  function paintFocus(now: number) {
    if (dialog.open && now - lastFocusPaint >= (matchMedia('(prefers-reduced-motion: reduce)').matches ? 100 : 50)) {
      lastFocusPaint = now;
      if (drawer === 'case-preview' && casePreviewDirty && casePreview && museum.canvas.dataset.ready === 'true' && (casePreview.id !== 'case-0' || paperReady)) {
        const canvas = query<HTMLCanvasElement>('#fusion-case-preview');
        const index = Number(casePreview.id.slice(5));
        const id = ['receipt', 'tape', 'nested', 'stamp', 'cosmic-parcel', 'bell'][index];
        museum.renderExhibit(canvas, id, casePreviewLevel);
        canvas.dataset.before = String(casePreview.before);
        canvas.dataset.after = String(casePreview.after);
        canvas.dataset.price = String(casePreview.price);
        canvas.dataset.level = String(casePreviewLevel);
        casePreviewDirty = false;
      }
      const canvas = query<HTMLCanvasElement>('#fusion-paper-focus');
      if (canvas && focusReady) {
        lastFocusPaint = now;
        const state = controller.state;
        const frame = receiptRestorationFrame(state.receipt, Date.now() / 1000);
        museum.renderFocused(canvas, 'receipt', growthLevel(state.game, 'case-0'), (state.game.world.elapsedMs + Math.min(250, Math.max(0, Date.now() - state.game.lastAt))) / 1000, 1, 'specimen', undefined, frame);
        if (sideLight && drawer === 'project' && projectId === 'evidence-bench') {
          const context = canvas.getContext('2d')!;
          context.save();context.globalCompositeOperation = 'soft-light';
          const beam = context.createLinearGradient(0, 0, canvas.width, 0);
          beam.addColorStop(0, '#e5d6b6');beam.addColorStop(.44, '#aaa18e');beam.addColorStop(.64, '#495871');beam.addColorStop(1, '#25384d');
          context.fillStyle = beam;context.fillRect(0, 0, canvas.width, canvas.height);context.restore();
        }
      }
      if (drawer === 'detail' && curioPrices[detailId]) {
        const canvas = query<HTMLCanvasElement>('#fusion-exhibit-focus');
        const state = controller.state;
        if (canvas && museum.canvas.dataset.ready === 'true' && state.curios[detailId]) {
          const index = ['receipt', 'tape', 'nested', 'stamp', 'cosmic-parcel', 'bell'].indexOf(detailId);
          museum.renderExhibit(canvas, detailId, growthLevel(state.game, `case-${index}`));
        }
      }
    }
    if (dialog.open && drawer === 'project' && projectId === 'archive' && archiveReplay) {
      query('#fusion-replay-status').textContent = `第${archiveReplay.number}夜 · ${Math.floor(archiveReplay.seconds)}／60秒 · 处置回放`;
    }
    if (scene?.ready && focus && tab === 'explore' && !dialog.open && !query('#fusion-inspection-panel').hidden && now - lastInspectionPaint >= 50) {
      lastInspectionPaint = now;
      const target = focus();
      inspectionCenter.x += (target.x - inspectionCenter.x) * .18;
      inspectionCenter.y += (target.y - inspectionCenter.y) * .18;
      const canvas = query<HTMLCanvasElement>('#fusion-inspection');
      const context = canvas.getContext('2d')!;
      const width = 430;
      const height = width * canvas.height / canvas.width;
      const left = Math.max(0, Math.min(scene.canvas.width - width, inspectionCenter.x - width / 2));
      const top = Math.max(0, Math.min(scene.canvas.height - height, inspectionCenter.y - height / 2));
      context.imageSmoothingEnabled = false;
      context.drawImage(scene.canvas, Math.round(left), Math.round(top), width, height, 0, 0, canvas.width, canvas.height);
      canvas.dataset.source = 'fusion-world';
      canvas.dataset.width = String(width);
    }
    requestAnimationFrame(paintFocus);
  }
  requestAnimationFrame(paintFocus);

  return {
    worldRoot,
    setScene(next: ExpeditionScene, onPulse: () => void, getFocus?: () => {x: number; y: number}) {
      scene = next;pulse = onPulse;focus = getFocus;scene.setActive(tab === 'explore' && !dialog.open);
    },
  };
}
