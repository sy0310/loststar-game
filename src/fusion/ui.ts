import './style.css';
import {icon, renewalChapter, renewalArtUrl} from './renewal-ui';
import {readPreferences, savePreferences} from '../ui/preferences';
import {SoundDesk} from '../ui/audio';
import {soundCue} from '../ui/discovery';
import {discoveries, discoveryById, planetById} from '../content/catalog';
import {curioPrices, projectAvailable, latestNightHistory} from './domain';
import {drawCurioSpecimen, prepareCurioMaterial, prepareCurioTools, prepareCurioWorkbench, curioConditionPresentation, curioTreatmentLabels, renderCurioTreatment, exportCurioMaterial, renderRenewalReceipt, exportRenewalReceiptMaterial, renewalReceiptCurioState} from './curio-condition';
import {drawCurioAbilityRig,curioAbilityReady,type CurioAbilityRigResult,type AbilityRigRecord} from './curio-ability-rig';
import {curioImageStages,curioStateImageUrl,savedCurioCondition} from './curio-state-images';
import {isRenewalCurio,type RenewalCurioId} from './curio-renewal-model';
import {mechanismTrialMs} from './curio-mechanism-model';
import {cost, MAX_LEVEL, publicRadar, tuning, type UpgradeId, type SaveData} from '../game/engine';
import {growthCatalog, growthChange, growthLevel} from '../game/growth';
import {repairPrice,explorationFactor,planBoost} from '../game/station';
import {worldView} from '../game/world';
import {MuseumScene, residentIds} from '../render/museum';
import {FusionHabitatScene} from './habitat';
import {ArchiveNightReplay} from './archive-replay';
import {drawCaseEngineering} from './case-engineering';
import {PlanetTapGesture, type TapPointer} from './tap-gesture';
import {FrameCadence} from '../render/frame-cadence';
import type {FusionFeedbackEvent} from './world-feedback';
import {refinementView, sortingRules, sortingStudies, type RefinementActionView} from './progression';
import {surfaceView} from './surface';
import {fusionCycleFraction, fusionRenderElapsed} from './render-clock';
import {assistStatus, availableAssistWork} from '../game/assist';
import {parcelFlavor} from '../content/parcel-flavor';
import {RadarScene} from '../render/radar-scene';
import {StarMapScene} from '../render/star-map';
import type {ExpeditionScene} from '../render/scene';
import {receiptRestorationFrame, receiptRestorationMainAction} from '../review/receipt-restoration';
import {InteractionDirector} from '../ui/interaction';
import {fusionProjects, fusionTargets, type FusionAction, type FusionController, type FusionSave} from './contracts';

type Tab = 'explore' | 'collection' | 'base';
type Drawer = 'upgrades' | 'station' | 'build' | 'research' | 'map' | 'return' | 'project' | 'detail' | 'case-preview' | 'wallet' | 'sorting' | 'settings';
type Filter = 'artifact' | 'creature' | 'event';
type SceneFeedback=FusionFeedbackEvent;
interface CasePreview {
  id: string;
  name: string;
  before: number;
  after: number;
  price: number;
  at: number;
  receipt: FusionSave['receipt'];
  curios: FusionSave['curios'];
  abilities:FusionSave['progression']['abilities'];
  records:AbilityRigRecord[];
}

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]!));
const format = (value: number) => Math.floor(value).toLocaleString('zh-CN');
const minutes = (milliseconds: number) => `${Math.max(1, Math.ceil(milliseconds / 60000))}分钟`;
const conditionLabels = {found: '刚获得', clean: '清理后', stabilized: '升级完成'};
const recordOrigins: Record<string, string> = {marker: '管道箱标', residents: '生态观察窗', night: '收件站夜班'};
const upgradeNames: Record<UpgradeId, string> = {scanner: '机器人', recycler: '飞船', radar: '雷达', cargo: '货舱'};
const trialLines:Record<string,string>={receipt:'订单没下，退货先到。',tape:'对不起，又粘人了。',nested:'拆到最后，还是第一层。',stamp:'今天的事，昨天再办。','cosmic-parcel':'远处回敲了两下。',bell:'响了。还是没人签收。'};
const exhibitActionLabels:Record<string,string>={receipt:'读出票面',tape:'拉出一截',nested:'打开一层',stamp:'盖个邮戳','cosmic-parcel':'敲敲箱盖',bell:'轻按铃铛'};

export function mountFusion(controller: FusionController) {
  const app = document.querySelector<HTMLElement>('#app')!;
  const preferences = readPreferences();
  document.documentElement.dataset.textSize = preferences.textSize;
  const sounds = new SoundDesk(preferences.muted);
  function itemArt(id:string){const condition=isRenewalCurio(id)?savedCurioCondition(controller.state,id):'found';return `<img class="pixel-art" ${isRenewalCurio(id)?`data-curio-id="${id}" data-curio-condition="${condition}"`:''} src="${renewalArtUrl(id,condition)}" alt="" decoding="async">`;}
  function refreshCurioImages(){
    for(const image of app.querySelectorAll<HTMLImageElement>('img[data-curio-id]')){
      const id=image.dataset.curioId;if(!id||!isRenewalCurio(id))continue;
      const condition=savedCurioCondition(controller.state,id);
      if(image.dataset.curioCondition!==condition){image.src=curioStateImageUrl(id,condition);image.dataset.curioCondition=condition;}
    }
  }

  app.innerHTML = `
    <div id="fusion-app">
      <header class="fu-header">
        <button id="fusion-map" class="fu-location" aria-label="打开星图"><span class="fu-location-emblem" aria-hidden="true">${icon('planet')}</span><span>退货箱星</span><small>退件平原 ${icon('arrow')}</small></button>
        <button id="fusion-wallet" class="fu-wallet" aria-label="零件余额，查看推荐用途">${icon('cube')}<b id="fusion-parts">120</b><small>零件</small></button>
        <button id="fusion-settings" class="fu-settings" aria-label="打开设置">${icon('gear')}</button>
      </header>
      <main id="fusion-scroll">
        <section id="fusion-explore" class="fu-view">
          <aside id="fusion-journey-intro" class="fu-journey-intro" hidden><div><strong>收件站已接通</strong><span>自动探索进行中，点一下帮咔哒搭把手。</span><small id="fusion-backup-status"></small></div><button id="fusion-dismiss-intro" aria-label="收起探索提示">×</button></aside>
          <div class="fu-world-shell">
            <div id="fusion-tap" role="button" tabindex="0" aria-label="点星球，协助探索"><div id="fusion-world"></div><span id="fusion-tap-hint">星球接通中…</span><span id="fusion-pick-reticle" class="fu-pick-reticle" aria-hidden="true" hidden></span></div><button id="fusion-scene-retry" class="fu-scene-retry" hidden>重新接通信号</button>
            <span id="fusion-period" class="fu-period">白天</span><span id="fusion-surface-status" class="fu-surface-status" hidden></span>
          </div>
          <section id="fusion-field-drawer" class="fu-field-drawer" aria-label="现场信息" hidden>
            <header><strong id="fusion-field-title">现场观察</strong><span id="fusion-field-context"></span><button id="fusion-field-close" aria-label="收起现场信息">${icon('close')}</button></header>
            <div id="fusion-inspection-panel" class="fu-inspection" hidden><canvas id="fusion-inspection" width="780" height="220" aria-label="同一球面的事件近景"></canvas></div>
            <p id="fusion-field-summary"></p>
          </section>
          <section class="fu-explore-controls">
            <div class="fu-action-line"><strong id="fusion-action">搜索箱堆</strong><span id="fusion-percent">0%</span></div>
            <div class="fu-progress" role="progressbar" aria-label="探索进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="fusion-assist-progress"></i><i id="fusion-progress"></i></div>
            <div class="fu-action-bottom"><span id="fusion-auto">自动探索中</span><button id="fusion-observe" class="fu-field-toggle" aria-controls="fusion-field-drawer" aria-expanded="false">观察</button><button id="fusion-upgrades" class="fu-primary">${icon('bolt')}升级</button></div>
            <button id="fusion-damage" class="fu-damage" hidden></button>
          </section>
          <button id="fusion-found" class="fu-found" hidden><span id="fusion-found-art"></span><span><small>新发现</small><strong id="fusion-found-name"></strong></span>${icon('arrow')}</button>
        </section>
        <section id="fusion-collection" class="fu-view" hidden>
          <div class="fu-page-heading"><div><small>失物档案 · 陈列与观察</small><h1>失物收藏室</h1></div><span id="fusion-collection-count"></span></div>
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
      <div id="fusion-toast" role="status" aria-live="polite" hidden></div><div id="fusion-revenue-effects" aria-hidden="true"></div>
      <div id="fusion-museum-source" hidden><div id="fusion-museum"></div></div>
    </div>
    <dialog id="fusion-drawer" aria-labelledby="fusion-drawer-title"><header class="fu-drawer-heading"><h2 id="fusion-drawer-title"></h2><button id="fusion-close" aria-label="关闭详情">${icon('close')}</button></header><div id="fusion-drawer-body"></div></dialog>`;

  const query = <T extends HTMLElement = HTMLElement>(selector: string) => app.querySelector<T>(selector)!;
  const dialog = query<HTMLDialogElement>('#fusion-drawer');
  const body = query('#fusion-drawer-body');
  const worldRoot = query('#fusion-world');
  const museumRoot = query('#fusion-museum');
  const abilityResults=new Map<string,CurioAbilityRigResult>();
  let abilityReady=false;
  let materialLoadFailed=false;
  async function prepareExhibitAssets(workbench=false){
    await(workbench?prepareCurioWorkbench():prepareCurioTools());
    await curioAbilityReady();
    abilityReady=true;materialLoadFailed=false;
  }
  void prepareExhibitAssets().then(() => {collectionSignature = '';museum.refresh();}).catch(() => {materialLoadFailed=true;museumRetry.hidden=false;});
  function abilityRecords(receiptLevel=controller.state.progression.abilities.receipt):AbilityRigRecord[]{
    const state=controller.state;
    const facts:AbilityRigRecord[]=state.progression.sorting.facts.map(fact=>({id:fact.id,at:fact.at,detail:fact.detail,source:fact.nodeId,code:fact.code,orientation:fact.orientation}));
    for(const observation of state.receipt.observations){
      if(!facts.some(fact=>fact.id===observation.actionId))facts.push({id:observation.actionId,at:observation.observedAtSeconds*1000,detail:'现场核对的箱标',source:observation.source,code:typeof observation.metadata.boxCode==='string'?observation.metadata.boxCode:undefined});
    }
    if(receiptLevel===1)facts.sort((a,b)=>Number(b.code==='P30')-Number(a.code==='P30'));
    return facts;
  }
  let paperLoading: Promise<void> | undefined;
  const museum = new MuseumScene(museumRoot, () => controller.state.game, id => growthLevel(controller.state.game, id), () => fusionRenderElapsed(controller.state.game, Date.now()) / 1000, {
    renewal: true,
    specimenHandlingReady: id => !materialLoadFailed && abilityReady && (id === 'receipt'
      ? controller.state.receipt.stage === 'displayed' && controller.state.receipt.condition === 'stabilized'
      : controller.state.curios[id]?.condition === 'stabilized'),
    receiptFrame: () => controller.state.game.collection.includes('receipt') ? receiptRestorationFrame((drawer==='case-preview'?casePreview?.receipt:undefined)??controller.state.receipt,Date.now()/1000) : undefined,
    receiptPaperPending: () => materialLoadFailed,
    drawSpecimen: (context, exhibit, time, image, service) => {
      const preview = drawer === 'case-preview' ? casePreview : undefined;
      const condition = exhibit.id === 'receipt' ? renewalReceiptCurioState(preview?.receipt ?? controller.state.receipt) : (preview?.curios ?? controller.state.curios)[exhibit.id];
      if (!condition) return false;
      const paper=exhibit.id==='receipt'?receiptRestorationFrame(preview?.receipt??controller.state.receipt,(preview?.at??Date.now())/1000):undefined;
      const trial=paper?.phase==='trying'?paper.trying:!preview&&drawer==='detail'&&detailId===exhibit.id?Math.min(1,Math.max(0,(performance.now()-curioTrialAt)/mechanismTrialMs)):0;
      drawCurioSpecimen(context, exhibit, image, condition, preview?.at ?? Date.now(),{buried:paper?.stage==='buried',excavation:paper?.excavation,seconds:preview?0:time,trial,reducedMotion:reducedMotion.matches,serviceEnvelope:service?.specimenEnvelope??1,drawAbility:(exhibit.id==='tape'||exhibit.id==='receipt')&&abilityReady&&(preview?.abilities??controller.state.progression.abilities)[exhibit.id]>0?(canvas,material)=>{
        const result=drawCurioAbilityRig(canvas,{id:exhibit.id as 'receipt'|'tape',image:material,seconds:preview?0:time,abilityLevel:(preview?.abilities??controller.state.progression.abilities)[exhibit.id as 'receipt'|'tape'],experimentProgress:trial||undefined,serviceEnvelope:service?.specimenEnvelope??1,records:preview?.records??abilityRecords(),materialRevision:`${condition.condition}/${condition.action?.kind??''}/${condition.action?Math.round((Date.now()-condition.action.startedAt)/33):0}`,reducedMotion:reducedMotion.matches});abilityResults.set(exhibit.id,result);return true;
      }:undefined});
      return true;
    },
    specimenOpening: id => {
      const preview = drawer === 'case-preview' ? casePreview : undefined;
      const action = (preview?.curios ?? controller.state.curios)[id]?.action;
      return action ? Math.sin(Math.min(1, Math.max(0, ((preview?.at ?? Date.now()) - action.startedAt) / (action.endsAt - action.startedAt))) * Math.PI) : 0;
    },
  });
  const habitats: FusionHabitatScene[] = [];
  const museumRetry = document.createElement('button');
  museumRetry.id='fusion-museum-retry';museumRetry.className='fu-museum-retry';museumRetry.textContent='重新接通收藏室';museumRetry.hidden=true;museumRoot.append(museumRetry);
  const projectHabitats: FusionHabitatScene[] = [];
  let detailHabitat: FusionHabitatScene | undefined;
  const visibleHabitats=new WeakSet<FusionHabitatScene>();
  const habitatObservers=new Map<FusionHabitatScene,IntersectionObserver>();
  function setHabitatsActive(active:boolean){for(const habitat of habitats)habitat.setActive(active&&visibleHabitats.has(habitat));}
  const interactions = new InteractionDirector(body, renewalArtUrl);
  let scene: ExpeditionScene | undefined;
  let pulse: ((event?:SceneFeedback) => void) | undefined;
  let getUnloadPoint: (() => {x:number;y:number}) | undefined;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const focusCadence = new FrameCadence();
  const inspectionCadence = new FrameCadence();
  const feedbackMetrics = {contactDispatchMs:[] as number[],acceptedDispatchMs:[] as number[],transactionMs:[] as number[]};
  const focusMetrics = {intervalsMs:[] as number[],costsMs:[] as number[]};
  let lastFocusAt = 0;
  const focusVisible=new WeakMap<Element,boolean>();
  const focusVisibility=new IntersectionObserver(entries=>{for(const entry of entries)focusVisible.set(entry.target,entry.isIntersecting);});
  document.addEventListener('visibilitychange',()=>{focusCadence.reset();inspectionCadence.reset();lastFocusAt=0;if(document.hidden)bellSoundReplay=curioTrialReplay;});
  let feedbackToken = 0;
  let curioTrialAt = -Infinity;
  let curioTrialReplay=0;
  let responseReveal:{id:string;at:number}|undefined;
  let responseClearAt=0;
  let detailDisplayedCondition:string|undefined;
  let treatmentResult:{condition:string;at:number}|undefined;
  let bellSoundReplay=0;
  let previousGross = controller.state.game.station.grossIncome;
  let previousIncomeAt = controller.state.game.lastAt;
  let previousRecycler = tuning(controller.state.game).recycler;
  let previousCycles = controller.state.game.cycles;
  let focus: (() => {x: number; y: number}) | undefined;
  let inspectionCenter = {x: 416, y: 350};
  let lastInspectionPaint = 0;
  let manualInspectionUntil = 0;
  let manualInspectionPoint = {x: 416, y: 350};
  let followLiveInspection=false;
  let fieldOpen = false;
  let reticleTimer: ReturnType<typeof setTimeout>;
  let tab: Tab = 'explore';
  let filter: Filter = 'artifact';
  let drawer: Drawer = 'upgrades';
  let detailId = '';
  let projectId = '';
  let collectionSignature = '';
  const introKey = 'loststar.ui.firstplanet.v037.intro';
  let introDismissed = false;
  try {introDismissed = localStorage.getItem(introKey) === String(controller.state.journey?.seed);} catch {}
  let baseSignature = '';
  let habitatSignature = '';
  let previousCollection = new Set(controller.state.game.collection);
  let wasMigrationBlocked=Boolean((controller as FusionController&{migrationBlocked?:boolean}).migrationBlocked);
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
  let casePreviewStartedAt = 0;

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
    setFieldOpen(false);
    tab = next;
    for (const id of ['explore', 'collection', 'base'] as const) query(`#fusion-${id}`).hidden = id !== next;
    for (const button of app.querySelectorAll<HTMLElement>('[data-tab]')) button.setAttribute('aria-current', button.dataset.tab === next ? 'page' : 'false');
    scene?.setActive(next === 'explore' && !dialog.open);
    museum.setActive(next !== 'explore' && !dialog.open);
    if (next !== 'explore') museum.mount(query(next === 'collection' ? '#fusion-collection-dock' : '#fusion-base-dock'));
    setHabitatsActive(next==='base'&&!dialog.open);
    if (next === 'collection') query('#fusion-unread').hidden = true;
    query('#fusion-scroll').scrollTo(0, 0);
    update();
  }

  function clearProjectHabitats() {
    archiveReplay?.stop();
    for (const habitat of projectHabitats){habitatObservers.get(habitat)?.disconnect();habitatObservers.delete(habitat);habitat.dispose();}
    projectHabitats.length = 0;detailHabitat=undefined;
  }

  function closeDrawer() {
    interactions.hide();
    clearProjectHabitats();
    radar?.setActive(false);
    starMap?.setActive(false);
    dialog.close();
    scene?.setActive(tab === 'explore');
    museum.setActive(tab !== 'explore');
    setHabitatsActive(tab==='base');
  }

  function showDrawer(kind: Drawer, title: string, content: string) {
    delete body.dataset.imagePreview;
    responseReveal=undefined;
    responseClearAt=0;
    setFieldOpen(false);
    interactions.hide();
    clearProjectHabitats();
    radar?.setActive(false);
    starMap?.setActive(false);
    focusCadence.reset();lastFocusAt=0;
    drawer = kind;
    dialog.dataset.mode = kind === 'detail' && ['receipt', 'tape', 'nested', 'stamp', 'cosmic-parcel', 'bell'].includes(detailId) ? 'treatment' : 'drawer';
    query('#fusion-drawer-title').textContent = title;
    focusVisibility.disconnect();
    body.innerHTML = content;
    focusReady = false;
    sideLight = false;
    if (!dialog.open) dialog.showModal();
    for(const canvas of body.querySelectorAll('canvas'))focusVisibility.observe(canvas);
    body.scrollTop = 0;
    dialog.scrollTop = 0;
    scene?.setActive(false);
    museum.setActive(false);
    setHabitatsActive(false);
    updateLiveDrawer();
  }

  function setFieldOpen(open: boolean) {
    fieldOpen = open;
    query('#fusion-field-drawer').hidden = !open;
    query('#fusion-inspection-panel').hidden = !open;
    query('#fusion-observe').setAttribute('aria-expanded', String(open));
    query('#fusion-explore').dataset.fieldOpen = String(open);
    inspectionCadence.reset();
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
    return `<article class="fu-upgrade"><span class="fu-equipment-glyph" aria-hidden="true">${icon(({scanner:"gear",recycler:"rocket",radar:"radar",cargo:"cube"})[id])}</span><div><header><h3>${upgradeNames[id]}</h3><small>Lv${level}</small></header><p>${hint}</p><strong>${level < MAX_LEVEL ? effect : '已完成本阶段升级'}</strong></div><button data-upgrade="${id}" data-expected="${level}" ${level >= MAX_LEVEL || state.resources < cost(state, id) ? 'disabled' : ''}>${level >= MAX_LEVEL ? '已完成' : `升级 ${cost(state, id)}`}</button></article>`;
  }

  function commandButton(view:RefinementActionView, name:string, extra='') {
    return `<button data-refinement="${name}" data-command="${escape(JSON.stringify(view.action))}" data-price="${view.price}" class="${extra}" ${view.enabled?'':'disabled'}>${escape(view.enabled?`${view.label}${view.price?` ${view.price}`:''}`:view.reason??view.label)}</button>`;
  }

  function sortingSummary() {
    const view=refinementView(controller.state);
    if(view.sorting.phase==='unknown')return '';
    const status=sortingStatus();
    return `<section class="fu-next-goal"><small>当前阻碍</small><strong id="fusion-sorting-blocker">${status.blocker}</strong><p id="fusion-sorting-improvement">${status.improvement}</p><button id="fusion-open-sorting">旧分拣区 ${icon('arrow')}</button></section>`;
  }

  function sortingStatus() {
    const view=refinementView(controller.state);
    const phase=view.sorting.phase;
    const blocker={unknown:'先听清管道回声',observed:'传送带被纸层卡住',surveying:'咔哒正在勘测纸路',surveyed:'纸路裂开，等待接通',building:'正在接通传送带',ready:'纸路接通，箱子还堵着',working:view.sorting.stage==='hauling'?'先把箱堆搬开':view.sorting.stage==='verify'?'两份箱标对不上':'清开卷入的纸层',cleared:'纸路畅通了'}[phase];
    const improvement=phase==='cleared'?(view.sorting.researchCompleted<3?'纸路已接通，可观察现场样本':'已有记录可免费复核'):view.sorting.stage==='verify'?'收据对照后，核验6轮→3轮':view.sorting.stage==='clear-paper'?'胶带Ⅱ让清纸7轮→5轮':view.abilities.tape.level===0&&!view.sorting.paidCost?'胶带Ⅰ可节省10%工程材料':'工程与能力让咔哒走得更深';
    return {blocker,improvement};
  }

  function openUpgrades() {
    showDrawer('upgrades', '设备升级', `${renewalChapter("gear","给咔哒搭把手","升级永久生效，探索照常继续。")}${sortingSummary()}<div class="fu-upgrade-list">${upgradeCard('scanner')}${upgradeCard('recycler')}</div><details class="fu-details"><summary>其他设备</summary>${upgradeCard('radar')}${upgradeCard('cargo')}</details><div class="fu-drawer-links"><button data-drawer="build">基地工程</button><button data-drawer="research">定向调查</button></div>`);
  }

  function openSettings() {
    showDrawer('settings', '收件站设置', `${renewalChapter('gear', '按你的习惯亮灯', '只调整本机显示与声音。')}
      <section class="fu-settings-section"><h3>无线电声音</h3><p class="fu-muted">轻量原创短音 · 默认静音</p><button class="fu-wide" data-preference="sound" aria-pressed="${!preferences.muted}">${preferences.muted ? '接通声音' : '静音'}</button></section>
      <section class="fu-settings-section"><h3>文字大小</h3><div class="fu-mode-buttons">${[['normal','标准'],['large','大字']].map(([value,label]) => `<button data-preference="text" data-value="${value}" aria-pressed="${preferences.textSize===value}">${label}</button>`).join('')}</div></section>
      <div class="fu-result"><strong>进度一直留在这里</strong><p>本次翻新沿用原存档与已购权益。</p><p>减少动态：${reducedMotion.matches ? '已跟随系统开启' : '跟随系统'}</p></div><p class="fu-muted">开发自测 ${__BUILD_INFO__.version} · ${__BUILD_INFO__.commit}${__BUILD_INFO__.dirty ? ' · 本地修改' : ''}</p>`);
  }

  function openWallet() {
    if((controller as FusionController&{migrationBlocked?:boolean}).migrationBlocked){showDrawer('wallet','零件档案','<div class="fu-wallet-total"><b>—</b></div><p class="fu-empty">旧档暂未接通，正在重试</p>');return;}
    const state=controller.state;
    const view=refinementView(state);
    const recommendations:string[]=[];
    if(view.sorting.phase!=='unknown')recommendations.push(`<article class="fu-spend-goal"><div><small>同星支线</small><h3>旧分拣区</h3><p>${sortingStatus().blocker}</p></div><button id="fusion-open-sorting">查看纸路</button></article>`);
    for(const id of ['tape','receipt'] as const){
      const ability=view.abilities[id];
      if(state.game.collection.includes(id)&&ability.level<2&&ability.hasTarget)recommendations.push(`<article class="fu-spend-goal"><div><small>本体研究</small><h3>${discoveryById(id)!.name} ${ability.level?'Ⅱ':'Ⅰ'}</h3><p>${ability.nextEffect}</p></div><button data-detail="${id}">${ability.nextPrice}零件</button></article>`);
    }
    if(!recommendations.length||view.sorting.phase==='unknown'){
      const id=state.game.upgrades.scanner<MAX_LEVEL?'scanner':state.game.upgrades.recycler<MAX_LEVEL?'recycler':undefined;
      if(id)recommendations.unshift(`<article class="fu-spend-goal"><div><small>设备工程</small><h3>${upgradeNames[id]}</h3><p>${id==='scanner'?'每轮探索更快':'每轮带回更多零件'}</p></div><button data-drawer="upgrades">升级 ${cost(state.game,id)}</button></article>`);
      else if(view.sorting.phase==='unknown')recommendations.unshift('<article class="fu-spend-goal"><div><small>下一步</small><h3>核对管道箱标</h3><p>让已找到的线索带路</p></div><button id="fusion-go-field">去探索</button></article>');
    }
    if(view.sorting.phase==='cleared'&&recommendations.length<3)recommendations.push(`<article class="fu-spend-goal"><div><small>定向作业</small><h3>${view.researchAction.label}</h3><p>观察实际纸路与箱标</p></div><button id="fusion-open-sorting-study">查看样本</button></article>`);
    if(recommendations.length<3){
      const project=fusionProjects.find(project=>!state.projects.includes(project.id)&&projectAvailable(state,project.id).available);
      const growth=growthCatalog.find(entry=>growthLevel(state.game,entry.id)<entry.costs.length&&(!entry.requires||state.game.collection.includes(entry.requires)));
      if(project)recommendations.push(`<article class="fu-spend-goal"><div><small>永久工程</small><h3>${project.name}</h3><p>${project.effect}</p></div><button data-drawer="build">${project.price}零件</button></article>`);
      else if(growth)recommendations.push(`<article class="fu-spend-goal"><div><small>永久工程</small><h3>${growth.name}</h3><p>${growthChange(state.game,growth.id).after}</p></div><button data-drawer="build">${growth.costs[growthLevel(state.game,growth.id)]}零件</button></article>`);
    }
    showDrawer('wallet','零件用在哪',`<div class="fu-wallet-total">${icon('cube')}<b>${format(state.game.resources)}</b><span>零件</span></div>${recommendations.slice(0,3).join('')}`);
  }

  function openSorting() {
    const view=refinementView(controller.state);
    if(view.sorting.phase==='unknown'){closeDrawer();selectTab('explore');toast('留意管道旁的箱标');return;}
    showDrawer('sorting','旧分拣区 · 卡纸支线',`<div class="fu-sorting-place"><span>退货箱星</span><strong>拆不完台</strong><small>路堵了，包邮也过不去。</small></div><div class="fu-current-work"><strong id="fusion-sorting-blocker"></strong><p id="fusion-sorting-improvement"></p><div class="fu-progress"><i id="fusion-sorting-progress"></i></div><small id="fusion-sorting-work"></small></div><div id="fusion-sorting-actions">${commandButton(view.mainAction,'main','fu-primary')}${commandButton(view.compareAction,'compare')}${commandButton(view.researchAction,'study')}</div><p id="fusion-sorting-cost" class="fu-muted"></p><div class="fu-ability-shortcuts"><button data-detail="receipt">收据研究 ${['·','Ⅰ','Ⅱ'][view.abilities.receipt.level]}</button><button data-detail="tape">胶带研究 ${['·','Ⅰ','Ⅱ'][view.abilities.tape.level]}</button></div><button id="fusion-watch-world" class="fu-wide">看咔哒作业</button><div id="fusion-sorting-study"></div><details class="fu-details"><summary>现场记录</summary><div id="fusion-sorting-records"></div></details>`);
    updateLiveDrawer();
  }

  function openStation() {
    const state = controller.state.game;
    const night = worldView(state).phase === 'night';
    const report = state.station.lastNight;
    showDrawer('station', '收件站', `
      ${renewalChapter("base","灯亮着，就有人回家","安保自动值守，清晨按实际损伤维修。")}<div class="fu-integrity"><b id="fusion-station-value">${state.station.integrity}<small>/100</small></b><span>基地完整度</span></div>
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
    const caseNames = ['基础玻璃罩', '灯座与铭牌', '专属微景装置', '独立典藏舱'];
    const change = id.startsWith('case-') ? {before:caseNames[level],after:caseNames[Math.min(3,level+1)]} : growthChange(state, id);
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
    showDrawer('build', '基地建设', `${renewalChapter("base","把失物安顿好","永久建设 · 已购权益直接保留")}${fusionProjects.map(project => {
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
      at: state.game.lastAt, receipt: structuredClone(state.receipt), curios: structuredClone(state.curios),abilities:structuredClone(state.progression.abilities),records:abilityRecords(state.progression.abilities.receipt),
    };
    casePreviewLevel = casePreview.after;
    casePreviewDirty = true;
    casePreviewStartedAt = performance.now();
    showDrawer('case-preview', `${entry.name}已升级`, `
      <canvas id="fusion-case-preview" width="400" height="430" role="img" aria-label="同一展柜升级前后近景"></canvas>
      <div class="fu-mode-buttons"><button data-case-preview="${before}" aria-pressed="false">升级前 Lv${before}</button><button data-case-preview="${casePreview.after}" aria-pressed="true">升级后 Lv${casePreview.after}</button></div>
      <p class="fu-muted">本次花费${price}零件</p><button id="fusion-return-build" class="fu-wide">返回建设</button>`);
    await museum.ready;
    casePreviewDirty = true;
  }

  function openResearch() {
    const state = controller.state;
    showDrawer('research', '定向调查', `
      ${renewalChapter("radar","让线索带路","投入补给，观察真实发生的事。")}<div id="fusion-active-task"></div>
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
    showDrawer('map', '星域雷达', `${renewalChapter("radar","听一听，宇宙有回音","扫描继续进行，确认后才留下坐标。")}<div id="fusion-local-radar" class="fu-radar"></div><div class="fu-map-status"><strong id="fusion-radar-stage"></strong><span id="fusion-radar-percent"></span></div><p id="fusion-radar-note" class="fu-muted"></p><details class="fu-details"><summary>已确认航路</summary><div id="fusion-star-map"></div><div id="fusion-routes"></div></details>`);
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

  function syncReceiptLoading(canvas:HTMLCanvasElement) {
    if (drawer !== 'detail' || detailId !== 'receipt') return;
    const loading=body.querySelector<HTMLElement>('#fusion-treatment-loading');
    if (!loading) return;
    const fallback=canvas.dataset.receiptGlassFallback==='true';
    loading.hidden=!fallback;
    if (fallback) {
      loading.querySelector('span')!.textContent=canvas.dataset.receiptGlassStatus==='error'?'展柜暂未接通，先在整理台查看':'展柜接通中，先在整理台查看';
      const retry=loading.querySelector<HTMLButtonElement>('#fusion-treatment-retry')!;
      retry.hidden=false;retry.disabled=museumRoot.dataset.loading==='true';retry.textContent='重试展柜';
    }
  }

  /** The physical C state uses the already-owned cabinet; the durable receipt
   * action/fact model remains the only source of condition and trial progress. */
  function paintReceiptFocus(canvas:HTMLCanvasElement,wallAt=Date.now()) {
    const state=controller.state,seconds=fusionRenderElapsed(state.game,wallAt)/1000;
    const frame=receiptRestorationFrame(state.receipt,wallAt/1000);
    const display=drawer==='detail'&&detailId==='receipt'&&state.receipt.stage==='displayed'&&state.receipt.condition==='stabilized';
    let painted=false,view:'glass-case'|'workbench'='workbench';
    if (display&&museum.canvas.dataset.ready==='true'&&!materialLoadFailed) {
      // Bench and museum have independent frame counters. Use the renderer's
      // actual successful time write, avoiding equal-counter false fallbacks.
      delete canvas.dataset.seconds;
      museum.renderExhibit(canvas,'receipt',growthLevel(state.game,'case-0'),seconds);
      painted=canvas.dataset.ready==='true'&&canvas.dataset.seconds===String(seconds);
      if(painted){
        view='glass-case';
        canvas.dataset.condition=frame.condition;canvas.dataset.materialStage=frame.condition;
        canvas.dataset.restorationPhase=frame.phase;canvas.dataset.restorationCondition=frame.condition;
        canvas.dataset.restorationCleaning=String(frame.cleaning);canvas.dataset.restorationRepairing=String(frame.repairing);canvas.dataset.restorationExcavation=String(frame.excavation);
        canvas.dataset.restorationOriginalCode=frame.original.artifactCode;canvas.dataset.restorationMissing=String(frame.reading.missingCount);canvas.dataset.phase=frame.phase;
        canvas.dataset.cleanCoverage=String(frame.cleaning);canvas.dataset.cleanProgress=String(frame.cleaning);canvas.dataset.repairProgress=String(frame.repairing);
        canvas.dataset.structureAligned=String(frame.repairing);canvas.dataset.structurePressed=String(frame.repairing);
        // A display has no active cleaning tool; don't retain an old bench contact.
        for(const key of ['toolContact','contact','contactX','contactY'])canvas.dataset[key]='';
        delete canvas.dataset.lampAvailable;
      }
    }
    if (!painted) {
      painted=Boolean(renderRenewalReceipt(canvas,state.receipt,wallAt,{
        seconds,reducedMotion:reducedMotion.matches,
        drawAbility:abilityReady&&state.progression.abilities.receipt>0?(context,image)=>{
          const result=drawCurioAbilityRig(context,{id:'receipt',image,seconds,
            abilityLevel:state.progression.abilities.receipt,experimentProgress:frame.phase==='trying'?frame.trying:undefined,
            records:abilityRecords(state.progression.abilities.receipt),reducedMotion:reducedMotion.matches,
            materialRevision:`${state.receipt.condition}/${state.receipt.activeAction?.id??''}`});
          abilityResults.set('receipt',result);return true;
        }:undefined,
      }));
    }
    if(painted){
      canvas.dataset.stateRenderer='whole-image-v043';canvas.dataset.stateImage=`receipt-${state.receipt.condition}.webp`;
      canvas.dataset.focus=view;canvas.dataset.receiptView=view;
      canvas.dataset.receiptGlassFallback=String(display&&view!=='glass-case');
      canvas.dataset.receiptGlassStatus=museum.canvas.dataset.ready??'pending';
      if(view==='glass-case')canvas.dataset.receiptCaseLevel=String(growthLevel(state.game,'case-0'));
      else{for(const key of ['receiptCaseLevel','level','installProgress','seconds'])delete canvas.dataset[key];}
      canvas.setAttribute('aria-label',view==='glass-case'?'收据展示完成态与已购玻璃柜近景':'收据物理状态与修补近景');
      decorateAbilityCanvas(canvas,'receipt');syncReceiptLoading(canvas);
    }
    return painted;
  }

  async function prepareFocus() {
    if (!paperReady) {
      paperLoading ??= prepareExhibitAssets(true).then(() => {
        paperReady = true;materialLoadFailed=false;
      }).catch(error => {throw error;}).finally(() => {paperLoading=undefined;});
      await paperLoading;
    }
    focusReady = true;
    const canvas=body.querySelector<HTMLCanvasElement>('#fusion-paper-focus');
    if(canvas&&dialog.open){
      if(!paintReceiptFocus(canvas))focusReady=false;
    }
    updateLiveDrawer();
  }

  function exhibitInteractionState(id: string) {
    if (!exhibitActionLabels[id]) return undefined;
    const state = controller.state;
    const receipt = id === 'receipt';
    const condition = receipt ? state.receipt.condition : state.curios[id]?.condition;
    const completed = condition === 'stabilized' && (!receipt || state.receipt.stage === 'displayed');
    const canvas = body.querySelector<HTMLCanvasElement>(receipt ? '#fusion-paper-focus' : '#fusion-exhibit-focus');
    const renderedCondition = canvas?.dataset.condition ?? canvas?.dataset.restorationCondition ?? canvas?.dataset.materialStage;
    const ready = canvas?.dataset.ready === 'true' && renderedCondition === condition && (!receipt || focusReady);
    const mechanismPlaying=(id==='tape'||id==='bell')&&performance.now()>=curioTrialAt&&performance.now()-curioTrialAt<mechanismTrialMs;
    const busy = receipt ? !!state.receipt.activeAction : !!state.curios[id]?.action||mechanismPlaying;
    return {condition, completed, ready, busy, canvas, renderedCondition};
  }

  function updateExhibitInteraction() {
    if (drawer !== 'detail') return;
    const panel = body.querySelector<HTMLElement>('#fusion-exhibit-interaction');
    const button = body.querySelector<HTMLButtonElement>('#fusion-try');
    const view = exhibitInteractionState(detailId);
    if (!panel || !button || !view) return;
    panel.hidden = !view.completed || !view.ready;
    panel.dataset.focus = view.canvas?.dataset.focus ?? view.canvas?.id ?? '';
    panel.dataset.condition = view.condition ?? '';
    panel.dataset.renderedCondition = view.renderedCondition ?? '';
    button.hidden = panel.hidden;
    button.disabled = panel.hidden || view.busy;
    button.setAttribute('aria-busy',String(view.busy));
    button.textContent = exhibitActionLabels[detailId];
  }

  function showDetail(id: string) {
    const state = controller.state;
    if (!state.game.collection.includes(id)) return;
    const discovery = discoveryById(id)!;
    const ability=id==='receipt'||id==='tape'?refinementView(state).abilities[id]:undefined;
    const flavor=parcelFlavor(id,{abilityLevel:ability?.level??0,sortingKnown:state.progression.sorting.phase!=='unknown'});
    const exhibit = Boolean(exhibitActionLabels[id]);
    curioTrialAt=-Infinity;
    detailId = id;
    detailDisplayedCondition=isRenewalCurio(id)?savedCurioCondition(state,id):undefined;
    treatmentResult=undefined;
    showDrawer('detail', discovery.name, `
      ${id === 'receipt' || curioPrices[id] ? '<div id="fusion-treatment-loading" class="fu-treatment-loading" role="status"><span>整理台准备中…</span><button id="fusion-treatment-retry" hidden>重新接通</button></div>' : ''}
      ${id === 'receipt' || curioPrices[id] ? `<ol class="fu-treatment-stages" aria-label="物品三态外观，图片仅供对照">${curioImageStages.map((condition,index)=>`<li data-condition="${condition}"><button type="button" class="fu-state-thumb" data-image-preview-condition="${condition}" aria-label="放大${['刚获得','清理后','零件升级后'][index]}外观对照"><img src="${curioStateImageUrl(id as RenewalCurioId,condition)}" alt="${escape(discovery.name)} · ${['刚获得','清理后','零件升级后'][index]}" width="56" height="56"><span>${['刚获得','清理后','零件升级'][index]}</span></button></li>`).join('')}</ol>` : ''}
      ${id === 'receipt' || curioPrices[id] ? '<section id="fusion-state-preview" class="fu-state-preview" aria-label="只读外观对照" hidden><img id="fusion-state-preview-image" width="384" height="384" alt=""><p id="fusion-state-preview-caption"></p><button id="fusion-state-preview-close">返回当前物品</button></section>' : ''}
      ${id === 'receipt' ? '<canvas id="fusion-paper-focus" width="640" height="700" role="img" aria-label="收据物理状态与修补近景"></canvas><div class="fu-paper-status"><span id="fusion-paper-condition"></span><span id="fusion-paper-missing"></span></div><div class="fu-progress"><i id="fusion-paper-progress"></i></div>' : `<canvas id="fusion-exhibit-focus" width="${curioPrices[id] ? 640 : 400}" height="${curioPrices[id] ? 700 : 370}" role="img" aria-label="${escape(discovery.name)}${curioPrices[id] ? '独立整理台' : '玻璃容器近景'}"></canvas>`}
      ${id === 'receipt' || curioPrices[id] ? '<p id="fusion-treatment-result" class="fu-treatment-result" role="status" aria-live="polite"></p>' : ''}
      ${id==='receipt'||curioPrices[id]?'<p id="fusion-curio-response" class="fu-curio-response" role="status" hidden></p>':''}
      <div id="fusion-treatment-actions" class="fu-detail-actions">${id === 'receipt' ? '<button id="fusion-paper-primary" class="fu-primary"></button><button id="fusion-compare-label" hidden>对照箱标</button>' : ''}${curioPrices[id] ? '<button id="fusion-curio-primary" class="fu-primary"></button>' : ''}${exhibit ? '' : '<button id="fusion-try">试一试</button>'}</div>
      ${exhibit ? `<section id="fusion-exhibit-interaction" class="fu-exhibit-interaction" aria-labelledby="fusion-exhibit-title" hidden><header><strong id="fusion-exhibit-title">展品互动</strong><small id="fusion-exhibit-note">不耗零件</small></header><button id="fusion-try" aria-describedby="fusion-exhibit-note" disabled hidden>${exhibitActionLabels[id]}</button></section>` : ''}
      <div id="interaction-feedback" class="fu-interaction" hidden><canvas width="320" height="180" aria-label="奇物互动演出"></canvas><p id="interaction"></p><button id="fusion-hide-interaction">收起</button></div>
      ${curioPrices[id] ? '<p id="fusion-curio-condition" class="fu-muted"></p>' : ''}${ability?`<section class="fu-ability-panel"><small>本体研究</small><div><strong id="fusion-ability-level"></strong><span id="fusion-ability-effect"></span></div><button id="fusion-ability-upgrade" class="fu-primary"></button><small id="fusion-ability-next" class="fu-ability-next" hidden></small></section>`:''}${['receipt','tape','nested','stamp','cosmic-parcel','bell'].includes(id)?'<button id="fusion-exhibit-engineering" class="fu-wide">展柜工程</button>':''}${flavor?`<div class="fu-curio-message"><small>${flavor.landmark} · 奇物留言</small><p>${flavor.line}</p></div>`:''}<details class="fu-details"><summary>它的来历</summary><p>${escape(discovery.description)}</p><p>${escape(discovery.fieldNote)}</p>${id === 'receipt' ? '<p id="fusion-paper-evidence"></p>' : ''}</details>`);
    const loadFailed = () => {
      if (!dialog.open || drawer !== 'detail' || detailId !== id) return;
      const loading = body.querySelector<HTMLElement>('#fusion-treatment-loading');
      if (loading) {loading.hidden = false;loading.querySelector('span')!.textContent = '整理台暂未接通';query('#fusion-treatment-retry').hidden = false;}
    };
    if (residentIds.includes(id as typeof residentIds[number])) {
      const canvas=body.querySelector('#fusion-exhibit-focus');
      const root=document.createElement('div');root.id='fusion-detail-habitat';root.className='fu-habitat-window';canvas?.replaceWith(root);
      detailHabitat=new FusionHabitatScene(root,id as typeof residentIds[number],()=>controller.state.game,()=>growthLevel(controller.state.game,`habitat-${residentIds.indexOf(id as typeof residentIds[number])}`));
      projectHabitats.push(detailHabitat);detailHabitat.setActive(true);
    } else if (id === 'receipt') void prepareFocus().catch(loadFailed);
    else {
      void prepareExhibitAssets(true).then(() => {
        materialLoadFailed=false;
        if (!dialog.open || drawer !== 'detail' || detailId !== id) return;
        const canvas = query<HTMLCanvasElement>('#fusion-exhibit-focus');
        const index = ['receipt', 'tape', 'nested', 'stamp', 'cosmic-parcel', 'bell'].indexOf(id);
        if (canvas && index >= 0) {
          if (curioPrices[id]) {
            // Decode completion paints its first usable frame immediately. Button
            // readiness must not depend on a later simulation timer or rAF tick.
            const current = controller.state;
            if (renderCurioTreatment(canvas,id,current.curios[id],Date.now(),{seconds:fusionRenderElapsed(current.game,Date.now())/1000,reducedMotion:reducedMotion.matches})) {
              query('#fusion-treatment-loading').hidden = true;updateLiveDrawer();
            }
          } else museum.renderExhibit(canvas, id, growthLevel(controller.state.game, `case-${index}`));
        }
        else if (canvas) {
          canvas.replaceWith(document.createElement('div'));
          body.insertAdjacentHTML('afterbegin', `<div class="fu-detail-art">${itemArt(id)}</div>`);
        }
      }).catch(loadFailed);
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
      const isProject=root.id==='fusion-project-habitats';
      const observer=new IntersectionObserver(entries=>{
        const visible=entries.some(entry=>entry.isIntersecting);
        if(visible)visibleHabitats.add(habitat);else visibleHabitats.delete(habitat);
        const allowed=isProject?dialog.open&&drawer==='project'&&projectId==='habitat-window':tab==='base'&&!dialog.open;
        habitat.setActive(visible&&allowed);
      });
      habitatObservers.set(habitat,observer);observer.observe(card);
      habitat.setActive(active&&visibleHabitats.has(habitat));
      (root.id === 'fusion-project-habitats' ? projectHabitats : habitats).push(habitat);
    }
  }


  function renderCollection() {
    const state = controller.state.game;
    const known = discoveries.filter(item => state.collection.includes(item.id) && item.kind === filter);
    query('#fusion-collection-count').textContent = `${state.collection.length}份记录`;
    query('#fusion-collection-list').innerHTML = known.length ? known.map(item => `<button class="fu-collection-item" data-detail="${item.id}">${itemArt(item.id)}<span><strong>${escape(item.name)}</strong><small>${item.rarity}${item.id === 'receipt' ? ` · ${controller.state.receipt.stage === 'buried' ? '土样中' : conditionLabels[controller.state.receipt.condition]}` : controller.state.curios[item.id] ? ` · ${conditionLabels[controller.state.curios[item.id].condition]}` : ''}</small></span>${icon('arrow')}</button>`).join('') : '<p class="fu-empty">咔哒正在找，下一次会带回什么？</p>';
  }

  function updateLiveDrawer() {
    if (!dialog.open) return;
    const state = controller.state;
    if(drawer==='detail'&&(detailId==='receipt'||detailId==='tape')){
      const ability=refinementView(state).abilities[detailId];
      query('#fusion-ability-level').textContent=`${discoveryById(detailId)!.name} ${['未研究','Ⅰ','Ⅱ'][ability.level]}`;
      query('#fusion-ability-effect').textContent=ability.level===0?ability.nextEffect:ability.currentEffect;
      const next=query('#fusion-ability-next');next.hidden=ability.level!==1||!ability.hasTarget;next.textContent=`下档 · ${ability.nextEffect}`;
      const button=query<HTMLButtonElement>('#fusion-ability-upgrade');
      button.dataset.command=JSON.stringify(ability.action);button.disabled=!ability.enabled;
      button.textContent=ability.nextPrice===null?'研究完成':ability.enabled?`研究${ability.level?'Ⅱ':'Ⅰ'} ${ability.nextPrice}`:ability.reason??'等待线索';
    }
    if(drawer==='sorting'||drawer==='upgrades'){
      const view=refinementView(state),status=sortingStatus();
      const blocker=body.querySelector('#fusion-sorting-blocker');if(blocker)blocker.textContent=status.blocker;
      const improvement=body.querySelector('#fusion-sorting-improvement');if(improvement)improvement.textContent=status.improvement;
      if(drawer==='sorting'){
        query('#fusion-sorting-progress').style.width=`${view.sorting.progress*100}%`;
        query('#fusion-sorting-work').textContent=['surveying','building','working'].includes(view.sorting.phase)?`${view.sorting.workDone.toFixed(1)}／${view.sorting.workRequired}轮 · 自动进行` : view.sorting.phase==='cleared'?'已永久接通':'白天随探索作业推进';
        for(const [name,action] of [['main',view.mainAction],['compare',view.compareAction],['study',view.researchAction]] as const){
          const button=query<HTMLButtonElement>(`[data-refinement="${name}"]`);button.dataset.command=JSON.stringify(action.action);button.dataset.price=String(action.price);button.disabled=!action.enabled;
          button.hidden=name==='compare'?!action.enabled:name==='study'?view.sorting.phase!=='cleared'||action.price===0:!['observed','surveyed','ready','cleared'].includes(view.sorting.phase);
          button.textContent=action.enabled?`${action.label}${action.price?` ${action.price}`:''}`:action.reason??action.label;
        }
        query('#fusion-sorting-cost').textContent=view.sorting.paidCost?`工程实付${view.sorting.paidCost}${view.sorting.savedParts?` · 胶带节省${view.sorting.savedParts}`:''}`:view.sorting.phase==='surveyed'?`接通材料${view.mainAction.price}零件 · 完工永久保留`:'';
        const records=query('#fusion-sorting-records');const signature=view.sorting.sourceFacts.map(fact=>fact.id).join(',');
        if(records.dataset.signature!==signature){records.dataset.signature=signature;records.innerHTML=view.sorting.sourceFacts.length?view.sorting.sourceFacts.map(fact=>`<p class="fu-record"><small>${new Date(fact.at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</small>${escape(fact.detail)}</p>`).join(''):'<p class="fu-muted">等咔哒走到现场。</p>';}
        const study=view.sorting.researchActive,studyRoot=query('#fusion-sorting-study');
        const key=study?String(study.seq):'';
        if(studyRoot.dataset.study!==key){studyRoot.dataset.study=key;studyRoot.innerHTML=study?`<div class="fu-active-task"><span>实地观察中</span><strong id="fusion-sorting-study-progress"></strong><button data-cancel-sorting-study="${study.seq}">取消，退还未用补给</button></div>`:'';}
        if(study)query('#fusion-sorting-study-progress').textContent=`${study.workDone.toFixed(1)}／2轮`;
      }
    }
    if (drawer === 'detail' && detailId === 'receipt') {
      const frame = receiptRestorationFrame(state.receipt, Date.now() / 1000);
      const main = receiptRestorationMainAction({...state.receipt, parts: state.game.resources});
      const primary = query<HTMLButtonElement>('#fusion-paper-primary');
      const labels = {excavate: '取出', clean: '清理纸面 40', repair: '零件升级 120', identify: '对照线索', 'visit-field': '去找线索'};
      const active = state.receipt.activeAction?.kind;
      primary.textContent = active && active !== 'try' ? ({excavate:'正在取出…',clean:'正在清理…',repair:'正在升级…',identify:'正在对照…'} as const)[active] : labels[main.kind as keyof typeof labels];
      primary.dataset.kind = main.kind;
      primary.disabled = !focusReady || main.disabled;
      const compare = refinementView(state).compareAction;
      const compareButton = query<HTMLButtonElement>('#fusion-compare-label');
      compareButton.hidden = Boolean(state.journey) || state.receipt.condition !== 'stabilized' || !compare.enabled;
      compareButton.disabled = !exhibitInteractionState('receipt')?.ready || !!state.receipt.activeAction || !compare.enabled;
      query('#fusion-paper-condition').textContent = state.receipt.stage === 'buried' ? '土样中 · 发现态' : curioConditionPresentation('receipt', state.receipt.condition).label;
      query('#fusion-paper-missing').textContent = `原件待证${frame.reading.missingCount}项`;
      query('#fusion-paper-missing').dataset.count = String(frame.reading.missingCount);
      query('#fusion-paper-progress').style.width = `${state.receipt.activeAction ? frame.progress * 100 : 0}%`;
      query('#fusion-paper-evidence').textContent = `原件RET-031。${state.receipt.verifiedEvidenceIds.length ? '来源已核对。' : '来源待现场核对。'}签收记录仍待证。`;
    }
    if (drawer === 'detail' && curioPrices[detailId]) {
      const curio = state.curios[detailId];
      const primary = query<HTMLButtonElement>('#fusion-curio-primary');
      if (curio) {
        const next = curio.condition === 'found' ? 'clean' : 'repair';
        const labels = curioTreatmentLabels(detailId);
        primary.textContent = curio.action ? (curio.action.kind === 'clean' ? labels.cleaning : labels.repairing) : curio.condition === 'stabilized' ? '升级完成' : `${labels[next]} ${curioPrices[detailId][next]}`;
        primary.dataset.kind = next;
        const ready = body.querySelector<HTMLCanvasElement>('#fusion-exhibit-focus')?.dataset.ready === 'true';
        primary.disabled = !ready || !!curio.action || curio.condition === 'stabilized' || state.game.resources < curioPrices[detailId][next];
        primary.hidden = curio.condition === 'stabilized' && !curio.action;
        query('#fusion-treatment-actions').hidden = primary.hidden;
        const presentation = curioConditionPresentation(detailId, curio.condition);
        query('#fusion-curio-condition').textContent = curio.action ? `${curio.action.kind === 'clean' ? labels.cleaning : labels.repairing} · ${Math.min(100, Math.floor((Date.now() - curio.action.startedAt) / (curio.action.endsAt - curio.action.startedAt) * 100))}%` : `${presentation.label} · ${presentation.detail}`;
      }
    }
    if (drawer === 'detail') {
      const condition = detailId === 'receipt' ? state.receipt.condition : state.curios[detailId]?.condition;
      if(condition&&detailDisplayedCondition&&condition!==detailDisplayedCondition)treatmentResult={condition,at:performance.now()};
      detailDisplayedCondition=condition;
      const result=body.querySelector<HTMLElement>('#fusion-treatment-result');
      if(result){
        const active=!!treatmentResult&&performance.now()-treatmentResult.at<2200;
        result.dataset.active=String(active);result.textContent=active?(treatmentResult!.condition==='clean'?'清理完成 · 结构待整理':'零件升级完成'):'';
      }
      for (const step of body.querySelectorAll<HTMLElement>('.fu-treatment-stages [data-condition]')) {
        step.setAttribute('aria-current', step.dataset.condition === condition ? 'step' : 'false');
      }
      updateExhibitInteraction();
    }
    if (drawer === 'research') {
      const task = state.task;
      const active = query('#fusion-active-task');
      const legacyTask = task ? null : state.game.research.active;
      if (active.dataset.taskKey !== (task?.id ?? legacyTask?.id ?? '')) {
        active.dataset.taskKey = task?.id ?? legacyTask?.id ?? '';
        active.innerHTML = task ? `<div class="fu-active-task"><span>${fusionTargets.find(target => target.id === task.target)!.name}</span><strong id="fusion-task-remaining"></strong><button data-cancel-task="${task.id}">取消，退还未用零件</button></div>` : legacyTask ? '<p id="fusion-legacy-task" class="fu-muted"></p>' : '';
      }
      if (legacyTask) query('#fusion-legacy-task').textContent = `已有调查进行中 · 余${minutes(Math.max(0, legacyTask.end - state.game.world.elapsedMs))}`;
      if (task) query('#fusion-task-remaining').textContent = task.endsAt > state.game.lastAt ? minutes(task.endsAt - state.game.lastAt) : '等待现场发生';
      for (const button of body.querySelectorAll<HTMLButtonElement>('button[data-task]')) {
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
    if((controller as FusionController&{migrationBlocked?:boolean}).migrationBlocked){for(const button of body.querySelectorAll<HTMLButtonElement>('button[data-upgrade],button[data-growth],button[data-project],button[data-command],#fusion-manual-repair,#fusion-paper-primary,#fusion-curio-primary'))button.disabled=true;}
  }

  function explorationProgress(){
    const state=controller.state,game=state.game;
    const sorting=refinementView(state).sorting;
    const fraction=fusionCycleFraction(game,Date.now());
    const pending=Math.max(0,(game.assist?.pendingWorkMs??0)-availableAssistWork(game.assist,Math.max(0,Math.min(250,Date.now()-game.lastAt))));
    const bonus=pending/tuning(game).scanner*explorationFactor(game)*(1+planBoost(game));
    const delta=fraction-game.cycleMs/tuning(game).scanner;
    const extra=delta<-.5?delta+1:Math.max(0,delta);
    if(sorting.researchActive){
      const required=sortingRules.researchWork;
      const work=Math.min(required-.001,sorting.researchActive.workDone+extra);
      return {progress:work/required*100,queued:Math.min(100,(work+bonus)/required*100),branch:true};
    }
    if(['surveying','building','working'].includes(sorting.phase)){
      const work=Math.min(sorting.workRequired-.001,sorting.workDone+extra);
      return {progress:Math.max(0,work/sorting.workRequired*100),queued:Math.min(100,(work+bonus)/sorting.workRequired*100),branch:true};
    }
    return {progress:fraction*100,queued:Math.min(100,(fraction+bonus)*100),branch:false};
  }

  function update() {
    const state = controller.state;
    const game = state.game;
    museumRetry.hidden = museum.canvas.dataset.ready !== 'error' && !materialLoadFailed;
    const blocked=Boolean((controller as FusionController&{migrationBlocked?:boolean}).migrationBlocked);
    if(wasMigrationBlocked&&!blocked){previousGross=game.station.grossIncome;previousIncomeAt=game.lastAt;previousCycles=game.cycles;previousCollection=new Set(game.collection);}
    wasMigrationBlocked=blocked;
    const world = worldView(game);
    query('#fusion-journey-intro').hidden = !state.journey || introDismissed;
    const backup = controller.backupStatus;
    query('#fusion-backup-status').textContent = !backup ? '' : backup.status === 'pending' ? '正在归档可访问旧档' : backup.accessibleSources > 0 ? `已归档${backup.accessibleSources}处旧档来源${backup.failedSources ? ` · ${backup.failedSources}处来源暂未接通` : ''}` : backup.failedSources ? '旧档来源暂未接通' : '当前来源内未找到旧档';
    const income=Math.max(0,game.station.grossIncome-previousGross);
    if(!blocked&&income>0&&game.lastAt>previousIncomeAt&&game.lastAt-previousIncomeAt<30000){
      const unloaded=Math.min(income,Math.max(0,game.cycles-previousCycles)*previousRecycler);
      if(unloaded>0)showIncome(unloaded,'unload');
      if(income>unloaded)showIncome(income-unloaded,'wallet');
    }
    previousGross=game.station.grossIncome;previousIncomeAt=game.lastAt;previousRecycler=tuning(game).recycler;previousCycles=game.cycles;
    const night = world.phase === 'night';
    query('#fusion-parts').textContent = blocked?'—':format(game.resources);
    query('#fusion-save-warning').textContent=blocked?'旧档暂未接通，正在重试':'本次进度暂存中，存储恢复后会自动保存。';
    query('#fusion-save-warning').hidden = !blocked&&controller.persisted;
    query('#fusion-period').textContent = {day: '白天', dusk: '黄昏', night: '夜间', dawn: '清晨'}[world.period];
    query('#fusion-period').dataset.period = world.period;
    const sites = surfaceView(state);
    const surveying = sites.filter(site => !site.revealed && site.progress > 0).sort((a, b) => b.progress - a.progress)[0];
    const latestSite = sites.filter(site => site.revealed).sort((a, b) => (b.revealedAt ?? 0) - (a.revealedAt ?? 0))[0];
    const surfaceStatus = query('#fusion-surface-status');surfaceStatus.hidden = !sites.length;
    surfaceStatus.textContent = night ? '夜间值守 · 地表进度已保存' : surveying ? `局部勘测 ${Math.floor(surveying.progress * 100)}%` : latestSite ? `${latestSite.name} · 已揭露` : '局部星雾 · 自动勘测';
    query('#fusion-tap').setAttribute('aria-label', night ? '查看夜间行动' : '点星球，协助探索');
    const worldFailed = worldRoot.dataset.error === 'true';
    const worldReady = scene?.ready === true && !worldFailed&&!blocked;
    query('#fusion-tap').setAttribute('aria-disabled', String(!worldReady));
    query('#fusion-scene-retry').hidden = !worldFailed;
    const projected=explorationProgress();
    const progress = night ? Math.min(100, world.nightBase / 60 * 100) : projected.progress;
    const pending = (game as typeof game & {assist?: {pendingWorkMs: number}}).assist?.pendingWorkMs ?? 0;
    query('#fusion-progress').style.width = `${progress}%`;
    query('#fusion-assist-progress').style.width = `${night ? progress : projected.queued}%`;
    query('.fu-explore-controls [role="progressbar"]').setAttribute('aria-valuenow', String(Math.floor(progress)));
    query('#fusion-percent').textContent = night ? `${Math.ceil(world.untilNextMs / 1000)}秒` : `${Math.floor(progress)}%`;
    query('.fu-explore-controls [role="progressbar"]').setAttribute('aria-label', night ? '夜班进度' : '探索进度');
    const phase = scene?.canvas.dataset.fusionPhase;
    const repair = game.station.lastRepair;
    const sorting=refinementView(state).sorting;
    const branchCloseup=!!sorting.researchActive||sorting.phase==='surveying'||sorting.phase==='building'||sorting.phase==='working'&&['verify','clear-paper'].includes(sorting.stage??'');
    const repairing = !!repair && game.lastAt - repair.at < 4000;
    query('#fusion-field-title').textContent = night ? '夜间巡逻' : repairing ? '晨间修复' : '现场观察';
    query('#fusion-field-context').textContent = night ? '自动值守' : branchCloseup ? '实地作业' : '退件平原';
    query('#fusion-observe').textContent = night ? '巡逻' : '观察';
    query('#fusion-field-summary').textContent = night ? `探照灯${game.world.slots[0] ? '工作中' : '停用'} · 隔离门${game.world.slots[1] ? '待命' : '停用'}` : repairing ? `已修复${repair!.points}点 · 实付${repair!.cost}零件` : surfaceStatus.textContent;
    const study=sorting.researchActive?sortingStudies.find(study=>study.id===sorting.researchActive!.id):undefined;
    const branchActions:Record<string,string>={surveying:'沿纸路勘测',building:'接通传送带',working:sorting.stage==='hauling'?'搬开分拣箱堆':sorting.stage==='verify'?'核验错位箱标':'清理卡纸层'};
    query('#fusion-action').textContent = night ? ({appear: '箱堆传来动静', track: '咔哒正在追踪', identify: '核对访客标记', contain: '引导访客入站', result: '正在归档结果', return: '咔哒正在回站'}[phase ?? ''] ?? '咔哒正在巡守') : projected.branch?(study?`观察${study.name}`:branchActions[sorting.phase]??'咔哒正在作业'):world.period === 'dawn' ? '清晨，继续探索' : '搜索箱堆';
    query('#fusion-auto').textContent = night ? '夜间自动守护' : pending > 0 ? '助力探索中' : sorting.researchActive?'实地观察中':projected.branch?'支线自动作业':'自动探索中';
    query('#fusion-tap-hint').textContent = blocked?'等待旧档接通':worldFailed ? '信号中断，请重新接通' : !worldReady ? '星球接通中…' : night ? '点一下，关注夜间行动' : pending > 0 ? '咔哒收到啦' : '点一下，帮咔哒探索';
    query('#fusion-damage').hidden = game.station.integrity >= 100;
    query('#fusion-damage').textContent = `完整度${game.station.integrity} · 查看维修`;
    query('#fusion-base-integrity').textContent = `完整度${game.station.integrity}`;
    query('#fusion-return-chip').hidden = !game.pendingReturn;
    const fresh = game.collection.find(id => !previousCollection.has(id));
    previousCollection = new Set(game.collection);
    if (fresh) {
      query('#fusion-found-art').innerHTML = itemArt(fresh);
      query('#fusion-found-name').textContent = discoveryById(fresh)!.name;
      const flavor = parcelFlavor(fresh,{abilityLevel:fresh==='receipt'||fresh==='tape'?state.progression.abilities[fresh]:0,sortingKnown:state.progression.sorting.phase!=='unknown'});
      if (flavor) query('#fusion-found small').textContent = flavor.line;
      query('#fusion-found').dataset.detail = fresh;
      query('#fusion-found').hidden = false;
      query('#fusion-unread').hidden = tab === 'collection';
      scene?.celebrate(discoveryById(fresh)!.presentation.cue);
      clearTimeout(foundTimer);
      foundTimer = setTimeout(() => {query('#fusion-found').hidden = true;}, 5000);
    }
    refreshCurioImages();
    const signature = `${game.collection.join(',')}/${filter}/${state.receipt.condition}/${state.receipt.stage}/${Object.entries(state.curios).map(([id, curio]) => `${id}:${curio.condition}:${curio.action?.kind ?? ''}`).join(',')}`;
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

  const gesture = new PlanetTapGesture();
  let sceneClick: {x: number; y: number; at: number} | null = null;
  const hero = query('#fusion-tap');
  function scrollPosition() {
    return [query('#fusion-scroll').scrollTop, window.scrollX, window.scrollY,
      window.visualViewport?.offsetLeft ?? 0, window.visualViewport?.offsetTop ?? 0].join('/');
  }
  function pointerSample(event: PointerEvent): TapPointer {
    return {id: event.pointerId, primary: event.isPrimary, button: event.button,
      x: event.clientX, y: event.clientY, at: performance.now(), scroll: scrollPosition()};
  }
  function heroReady() {
    return !(controller as FusionController&{migrationBlocked?:boolean}).migrationBlocked&&scene?.ready === true && worldRoot.dataset.error !== 'true' && !dialog.open && tab === 'explore';
  }
  function highlightPicked(x: number, y: number) {
    const canvas = scene!.canvas.getBoundingClientRect();
    const bounds = hero.getBoundingClientRect();
    const reticle = query('#fusion-pick-reticle');
    const scale = Math.min(canvas.width / scene!.canvas.width, canvas.height / scene!.canvas.height);
    reticle.style.left = `${canvas.left - bounds.left + (canvas.width - scene!.canvas.width * scale) / 2 + x * scale}px`;
    reticle.style.top = `${canvas.top - bounds.top + (canvas.height - scene!.canvas.height * scale) / 2 + y * scale}px`;
    reticle.hidden = false;
    clearTimeout(reticleTimer);
    reticleTimer = setTimeout(() => {reticle.hidden = true;}, 1200);
  }
  function inspectPicked(x: number, y: number) {
    followLiveInspection=false;
    manualInspectionPoint = {x, y};
    manualInspectionUntil = performance.now() + 2200;
    inspectionCenter = {x, y};
    setFieldOpen(true);
    highlightPicked(x, y);
    pulse?.({token:++feedbackToken,kind:'inspect',x,y,at:performance.now()});
  }
  function dispatchFeedback(event:SceneFeedback, measuredFrom:number) {
    requestAnimationFrame(() => {
      pulse?.(event);
      const samples=event.kind==='contact'?feedbackMetrics.contactDispatchMs:event.kind==='accepted'?feedbackMetrics.acceptedDispatchMs:undefined;
      if(samples){samples.push(performance.now()-measuredFrom);if(samples.length>240)samples.shift();}
    });
  }
  async function assist(point?:{x:number;y:number},contact?:SceneFeedback) {
    if (!heroReady()) return;
    if (worldView(controller.state.game).phase === 'night') {
      const point = focus?.() ?? inspectionCenter;
      inspectPicked(point.x, point.y);
      return;
    }
    const started=performance.now();
    const target=contact?{x:contact.x,y:contact.y}:point??focus?.()??inspectionCenter;
    const token=contact?.token??++feedbackToken;
    if(!contact)dispatchFeedback({token,kind:'contact',...target,at:started},started);
    const result = await act({type: 'tap'});
    const completed=performance.now();
    feedbackMetrics.transactionMs.push(completed-started);if(feedbackMetrics.transactionMs.length>240)feedbackMetrics.transactionMs.shift();
    dispatchFeedback({token,kind:result.ok?'accepted':'rejected',...target,at:completed,reason:result.ok?undefined:assistStatus(controller.state.game).reason??result.message},completed);
    if(result.ok){
      soundCue('scan');
      query('.fu-explore-controls .fu-progress').animate([{boxShadow:'0 0 0 1px #bfe8cd',filter:'brightness(1.7)'},{boxShadow:'0 0 0 0px transparent',filter:'brightness(1)'}],{duration:reducedMotion.matches?160:520});
    }
  }
  async function routeScenePointer(event: PointerEvent,contact?:SceneFeedback) {
    if (!heroReady()) return;
    const hit = scene!.pickAtClient(event.clientX, event.clientY);
    if (hit.kind === 'space') return;
    if(hit.id==='sorting'){openSorting();return;}
    if (worldView(controller.state.game).phase === 'night') {inspectPicked(hit.x, hit.y);return;}
    if (hit.kind === 'robot' || hit.kind === 'ship') {openUpgrades();return;}
    if (hit.kind === 'resident') {if (hit.id) showDetail(hit.id);return;}
    await assist({x:hit.x,y:hit.y},contact);
  }
  const contactPointers=new Map<number,SceneFeedback>();
  document.addEventListener('pointerdown', event => {
    sceneClick = null;
    const eligible=heroReady()&&hero.contains(event.target as Node);
    gesture.down(pointerSample(event), eligible);
    if(eligible&&event.isPrimary&&event.button===0){
      const hit=scene!.pickAtClient(event.clientX,event.clientY);
      if(hit.kind==='planet'||hit.kind==='site'&&hit.id==='surface-fog'){const at=performance.now();const contact:SceneFeedback={token:++feedbackToken,kind:'contact',x:hit.x,y:hit.y,at};contactPointers.set(event.pointerId,contact);dispatchFeedback(contact,at);}
    }
  }, {capture: true, passive: true});
  document.addEventListener('pointermove', event => {gesture.move(pointerSample(event));}, {capture: true, passive: true});
  document.addEventListener('pointerup', event => {
    const contact=contactPointers.get(event.pointerId);contactPointers.delete(event.pointerId);
    const accepted = gesture.up(pointerSample(event));
    if (accepted && hero.contains(event.target as Node)) {
      sceneClick = {x: event.clientX, y: event.clientY, at: performance.now()};
      void routeScenePointer(event,contact);
    }
  }, {capture: true, passive: true});
  document.addEventListener('pointercancel', event => {contactPointers.delete(event.pointerId);gesture.pointerCancel(event.pointerId);}, {capture: true, passive: true});
  document.addEventListener('scroll', () => gesture.cancel(), {capture: true, passive: true});
  window.addEventListener('scroll', () => gesture.cancel(), {passive: true});
  window.visualViewport?.addEventListener('scroll', () => gesture.cancel(), {passive: true});
  window.addEventListener('blur', () => {contactPointers.clear();gesture.reset();});
  document.addEventListener('visibilitychange', () => {if (document.hidden){contactPointers.clear();gesture.reset();}});
  hero.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    if (!event.repeat) void assist();
  });
  app.addEventListener('pointerup', event => {lastPointer = (event as PointerEvent).pointerType || 'mouse';}, {passive: true});
  // A compatibility click can be retargeted to a newly opened modal backdrop.
  document.addEventListener('click', event => {
    if (sceneClick && event.detail > 0 && performance.now() - sceneClick.at < 700
      && Math.hypot(event.clientX - sceneClick.x, event.clientY - sceneClick.y) <= 12) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, {capture: true});
  app.addEventListener('click', async event => {
    const button = (event.target as Element).closest<HTMLButtonElement>('button');
    if (!button || button.disabled) return;
    if (button.id === 'fusion-dismiss-intro') {introDismissed = true;query('#fusion-journey-intro').hidden = true;try {localStorage.setItem(introKey, String(controller.state.journey?.seed));} catch {}return;}
    if (button.id === 'fusion-observe') {followLiveInspection = true;setFieldOpen(!fieldOpen);return;}
    if (button.id === 'fusion-field-close') {setFieldOpen(false);return;}
    if (button.id === 'fusion-treatment-retry') {
      const canvas=body.querySelector<HTMLCanvasElement>('#fusion-paper-focus');
      if(detailId==='receipt'&&canvas?.dataset.receiptGlassFallback==='true'){
        button.disabled=true;
        try{await museum.retry();}
        catch{/* The independent bench remains usable if glass recovery fails. */}
        finally{button.disabled=false;}
        if(dialog.open&&drawer==='detail'&&detailId==='receipt'){
          paintReceiptFocus(canvas);updateLiveDrawer();
        }
        return;
      }
      showDetail(detailId);return;
    }
    if (button.dataset.imagePreviewCondition && (detailId==='receipt'||curioPrices[detailId])) {
      const condition=button.dataset.imagePreviewCondition as typeof curioImageStages[number];
      if(!curioImageStages.includes(condition))return;
      const image=query<HTMLImageElement>('#fusion-state-preview-image');
      image.src=curioStateImageUrl(detailId as RenewalCurioId,condition);image.alt=`${discoveryById(detailId)?.name??''} · ${curioConditionPresentation(detailId,condition).label}`;
      query('#fusion-state-preview-caption').textContent=`${({found:'刚获得时',clean:'清理后',stabilized:'零件升级后'} as const)[condition]} · 外观对照，不改变进度`;
      query('#fusion-state-preview').hidden=false;body.dataset.imagePreview='true';return;
    }
    if (button.id==='fusion-state-preview-close') {delete body.dataset.imagePreview;query('#fusion-state-preview').hidden=true;return;}
    if (body.dataset.imagePreview==='true'&&['fusion-paper-primary','fusion-curio-primary','fusion-try','fusion-ability-upgrade'].includes(button.id))return;
    if (button.dataset.tab) {selectTab(button.dataset.tab as Tab);return;}
    if (button.dataset.filter) {
      filter = button.dataset.filter as Filter;
      for (const option of app.querySelectorAll<HTMLElement>('[data-filter]')) option.setAttribute('aria-pressed', String(option === button));
      renderCollection();return;
    }
    const id = button.dataset.detail ?? button.dataset.exhibit;
    if (id) {showDetail(id);return;}
    if (button.id === 'fusion-close') {closeDrawer();return;}
    if (button.id === 'fusion-settings') {openSettings();return;}
    if (button.id === 'fusion-museum-retry') {
      button.disabled=true;
      try {await Promise.all([prepareExhibitAssets(),museum.retry()]);museum.refresh();museum.setActive(tab!=='explore'&&!dialog.open);}
      catch {toast('信号还未接通，请再试一次');}
      finally {button.disabled=false;museumRetry.hidden=museum.canvas.dataset.ready!=='error'&&!materialLoadFailed;}
      return;
    }
    if (button.dataset.preference) {
      if (button.dataset.preference === 'sound') {preferences.muted=!preferences.muted;await sounds.setMuted(preferences.muted);if(!preferences.muted)soundCue('interaction');}
      if (button.dataset.preference === 'text') preferences.textSize=button.dataset.value==='large'?'large':'normal';
      if (!savePreferences(preferences)) toast('设置暂存中，本次仍然生效');
      openSettings();return;
    }
    if (button.id === 'fusion-wallet') {openWallet();return;}
    if (button.id === 'fusion-open-sorting'||button.id==='fusion-open-sorting-study') {openSorting();return;}
    if (button.id === 'fusion-go-field') {closeDrawer();selectTab('explore');return;}
    if (button.id === 'fusion-exhibit-engineering') {openBuild();return;}
    if (button.id === 'fusion-ability-upgrade') {
      const result=await act(JSON.parse(button.dataset.command!) as FusionAction);
      if(result.ok)showDetail(detailId);return;
    }
    if (button.dataset.refinement) {
      const command=JSON.parse(button.dataset.command!) as FusionAction;
      const price=Number(button.dataset.price??0);
      const result=await act(command);
      if(result.ok){
        const startsWork=command.type==='sorting'&&(['survey','build','work'].includes(command.kind)||command.kind==='research'&&price>0);
        if(startsWork){closeDrawer();selectTab('explore');}
        else{
          updateLiveDrawer();
          if(command.type==='sorting'&&(command.kind==='review'||command.kind==='research'&&price===0)){
            const records=body.querySelector<HTMLElement>('#fusion-sorting-records');
            const details=records?.closest('details');
            if(records&&details){details.open=true;requestAnimationFrame(()=>records.scrollIntoView({block:'nearest'}));}
          }
        }
      }
      return;
    }
    if (button.dataset.cancelSortingStudy) {
      await act({type:'sorting',kind:'cancel-research',expected:Number(button.dataset.cancelSortingStudy)});updateLiveDrawer();return;
    }
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
      casePreviewStartedAt = performance.now();
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
    if (button.id === 'fusion-claim') {const amount=controller.state.game.pendingReturn?.resources??0;const result=await act({type: 'claim'}, '成果已入库');if(result.ok&&amount>0)showIncome(amount,'return');closeDrawer();return;}
    if (button.id === 'fusion-manual-repair') {await act({type: 'repair', expected: controller.state.game.station.integrity});openStation();return;}
    if (button.id === 'fusion-paper-primary') {
      const main = receiptRestorationMainAction(controller.state.receipt);
      if (main.kind === 'visit-field') {closeDrawer();selectTab('explore');toast('留意管道旁的箱标');return;}
      await act({type: 'paper', kind: main.kind});return;
    }
    if (button.id === 'fusion-curio-primary') {
      await act({type: 'curio', id: detailId, kind: button.dataset.kind as 'clean' | 'repair'});return;
    }
    if (button.id === 'fusion-compare-label') {
      if (detailId !== 'receipt' || controller.state.journey) return;
      const view = exhibitInteractionState('receipt');
      const compare = refinementView(controller.state).compareAction;
      if (!view?.completed || !view.ready || view.busy || !compare.enabled) return;
      const result = await act(compare.action);
      if (result.ok) {
        // Preserve the old real-label comparison and its paper-reading animation;
        // the separate exhibit action below never performs a factual comparison.
        await act({type: 'paper', kind: 'try'});
        view.canvas?.scrollIntoView({block:'nearest'});
      }
      return;
    }
    if (button.id === 'fusion-try') {
      const interactionId = detailId;
      const exhibit = exhibitInteractionState(interactionId);
      if (exhibit) {
        // A stale click or a loading frame cannot start a text-only performance.
        if (!exhibit.completed || !exhibit.ready || exhibit.busy) return;
        if (interactionId === 'receipt') {
          const result = await act({type: 'paper', kind: 'try'});
          if (!result.ok || !dialog.open || drawer !== 'detail' || detailId !== interactionId) return;
        } else {
          curioTrialAt=performance.now();curioTrialReplay++;
        }
        // The bell rings from its painted bottom-of-stroke frame, not from input.
        if(interactionId!=='bell')soundCue('interaction',interactionId);
        const response=body.querySelector<HTMLElement>('#fusion-curio-response');
        if(response&&trialLines[interactionId]){
          response.hidden=false;response.textContent='咔哒正在试验…';
          responseReveal={id:interactionId,at:performance.now()+(interactionId==='bell'?650:1400)};
          responseClearAt=performance.now()+mechanismTrialMs+500;
        }
        exhibit.canvas?.scrollIntoView({block:'nearest'});
        updateExhibitInteraction();
        return;
      }
      soundCue('interaction',detailId);
      if(detailHabitat){detailHabitat.interact();const feedback=query('#interaction-feedback');feedback.hidden=false;feedback.querySelector('canvas')!.hidden=true;query('#interaction').textContent=discoveryById(detailId)!.interaction;return;}
      interactions.show(detailId, lastPointer);
      requestAnimationFrame(() => query('#interaction-feedback').scrollIntoView({block: 'nearest'}));
      return;
    }
    if (button.id === 'fusion-hide-interaction') {interactions.hide();query('#interaction-feedback').hidden=true;return;}
    if (button.dataset.light) {
      sideLight = button.dataset.light === 'side';
      for (const option of body.querySelectorAll<HTMLElement>('[data-light]')) option.setAttribute('aria-pressed', String(option === button));
      return;
    }
    if (button.id === 'fusion-replay-night') {
      const root = query('#fusion-archive-replay');
      archiveReplay ??= new ArchiveNightReplay(root, () => controller.state);
      archiveReplay.mount(root);
      if (!archiveSource) return;
      archiveReplay.start(archiveSource);
      requestAnimationFrame(() => root.scrollIntoView({block: 'start'}));
      button.textContent = '重新回放';
      return;
    }
    if (button.id === 'fusion-watch-world') {followLiveInspection=true;manualInspectionUntil=performance.now()+5000;closeDrawer();selectTab('explore');setFieldOpen(true);}
  });
  app.addEventListener('change', event => {
    const target = event.target as HTMLInputElement;
    if (target.dataset.slot !== undefined) void act({type: 'slot', slot: Number(target.dataset.slot) as 0 | 1, enabled: target.checked});
    if ((event.target as HTMLElement).id === 'fusion-auto-repair') void act({type: 'auto-repair', enabled: (event.target as HTMLInputElement).checked});
  });
  dialog.addEventListener('click', event => {if (event.target === dialog) closeDrawer();});
  dialog.addEventListener('cancel', () => {interactions.hide();clearProjectHabitats();scene?.setActive(tab === 'explore');museum.setActive(tab !== 'explore');setHabitatsActive(tab==='base');});
  controller.subscribe(update);
  update();

  function showIncome(amount:number,kind:'unload'|'wallet'|'return') {
    const wallet=query('#fusion-wallet');
    wallet.animate([{filter:'brightness(1.6)'},{filter:'brightness(1)'}],{duration:420});
    if(!scene?.ready)return;
    const effect=query('#fusion-revenue-effects');
    while(effect.children.length>=6)effect.firstElementChild?.remove();
    const parent=app.getBoundingClientRect();
    const bounds=scene.canvas.getBoundingClientRect();
    const target=wallet.getBoundingClientRect();
    const endX=target.left-parent.left+target.width/2,endY=target.top-parent.top+target.height/2;
    const scale=Math.min(bounds.width/scene.canvas.width,bounds.height/scene.canvas.height);
    const source=getUnloadPoint?.();
    const claim=kind==='return'?body.querySelector('#fusion-claim')?.getBoundingClientRect():undefined;
    const fromPlanet=kind==='unload'&&source&&tab==='explore'&&!dialog.open;
    const x=fromPlanet?bounds.left-parent.left+(bounds.width-scene.canvas.width*scale)/2+source.x*scale:claim?claim.left-parent.left+claim.width/2:endX-24;
    const y=fromPlanet?bounds.top-parent.top+(bounds.height-scene.canvas.height*scale)/2+source.y*scale:claim?claim.top-parent.top:endY+26;
    const chip=document.createElement('span');chip.className='fu-income-token';chip.textContent=`+${Math.floor(amount)}`;effect.append(chip);
    chip.animate([{transform:`translate(${x}px,${y}px) scale(.7)`,opacity:0},{offset:.16,transform:`translate(${x}px,${y-16}px) scale(1)`,opacity:1},{offset:.75,transform:`translate(${endX-18}px,${endY+10}px) scale(.8)`,opacity:1},{transform:`translate(${endX}px,${endY}px) scale(.4)`,opacity:0}],{duration:reducedMotion.matches?220:780,easing:'cubic-bezier(.3,.1,.4,1)'}).finished.then(()=>chip.remove()).catch(()=>chip.remove());
  }
  function decorateAbilityCanvas(canvas:HTMLCanvasElement,id:string){
    if(id!=='receipt'&&id!=='tape')return;
    const result=abilityResults.get(id);canvas.dataset.abilityLevel=String(controller.state.progression.abilities[id]);
    if(result){canvas.dataset.abilityBounds=JSON.stringify(result.bounds);canvas.dataset.abilityExtension=String(result.extension);canvas.dataset.usedRecordIds=result.usedRecordIds.join(',');}
  }
  function paintFocus(now: number) {
    if(document.hidden){requestAnimationFrame(paintFocus);return;}
    if(responseReveal&&dialog.open&&drawer==='detail'&&detailId===responseReveal.id&&now>=responseReveal.at){
      const response=body.querySelector<HTMLElement>('#fusion-curio-response');
      if(response)response.textContent=trialLines[responseReveal.id];responseReveal=undefined;
    }
    if(responseClearAt&&now>=responseClearAt){const response=body.querySelector<HTMLElement>('#fusion-curio-response');if(response)response.hidden=true;responseClearAt=0;}
    if(tab==='explore'&&!dialog.open&&worldView(controller.state.game).phase!=='night'){
      const projected=explorationProgress();
      query('#fusion-progress').style.width=`${projected.progress}%`;
      query('#fusion-assist-progress').style.width=`${projected.queued}%`;
      query('#fusion-percent').textContent=`${Math.floor(projected.progress)}%`;
    }
    if (dialog.open && body.dataset.imagePreview!=='true' && focusCadence.draw(now, reducedMotion.matches ? 1000/30 : 1000/60)) {
      const began=performance.now();
      let painted=false;
      lastFocusPaint = now;
      if (drawer === 'case-preview' && (casePreviewDirty || now-casePreviewStartedAt<2200) && casePreview && museum.canvas.dataset.ready === 'true') {
        const canvas = query<HTMLCanvasElement>('#fusion-case-preview');
        const index = Number(casePreview.id.slice(5));
        const id = ['receipt', 'tape', 'nested', 'stamp', 'cosmic-parcel', 'bell'][index];
        const install=Math.max(0,Math.min(1,(now-casePreviewStartedAt)/1800));
        museum.renderExhibit(canvas, id, casePreviewLevel, Math.max(0,now-casePreviewStartedAt)/1000,install*install*(3-2*install));painted=true;
        canvas.dataset.before = String(casePreview.before);
        canvas.dataset.after = String(casePreview.after);
        canvas.dataset.price = String(casePreview.price);
        canvas.dataset.level = String(casePreviewLevel);
        casePreviewDirty = false;
      }
      const canvas = query<HTMLCanvasElement>('#fusion-paper-focus');
      if (canvas && focusReady && focusVisible.get(canvas)!==false) {
        lastFocusPaint = now;
        painted=paintReceiptFocus(canvas);
        if(!painted){focusReady=false;}
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
        if (canvas && state.curios[detailId] && focusVisible.get(canvas)!==false) {
          const seconds = fusionRenderElapsed(state.game,Date.now()) / 1000;
          const trial = Math.min(1, Math.max(0, (now-curioTrialAt)/mechanismTrialMs));
          const rendered = renderCurioTreatment(canvas, detailId, state.curios[detailId], Date.now(), {seconds, trial, reducedMotion: reducedMotion.matches,
            drawAbility: detailId === 'tape' && abilityReady && state.progression.abilities.tape > 0 ? (context, image) => {
              const result = drawCurioAbilityRig(context, {id:'tape', image, seconds, abilityLevel:state.progression.abilities.tape,
                experimentProgress:trial || undefined, records:abilityRecords(), reducedMotion:reducedMotion.matches,
                materialRevision:`${state.curios.tape.condition}/${state.curios.tape.action?.kind ?? ''}/${state.curios.tape.action ? Math.round(Date.now()/33) : 0}`});
              abilityResults.set('tape',result);return true;
            } : undefined});
          canvas.dataset.experimentPlaying=String(now-curioTrialAt>=0&&now-curioTrialAt<mechanismTrialMs);canvas.dataset.item=detailId;canvas.dataset.lastInput=lastPointer;canvas.dataset.replay=String(curioTrialReplay);canvas.dataset.experimentStartedAt=String(curioTrialAt);decorateAbilityCanvas(canvas,detailId);painted=rendered;
          if(rendered&&detailId==='bell'&&bellSoundReplay!==curioTrialReplay&&canvas.dataset.bellTriggered==='true'&&canvas.dataset.toolContact==='true'&&!document.hidden){
            bellSoundReplay=curioTrialReplay;soundCue('curio-bell','bell');
          }
        }
      }
      if(painted){
        if (drawer === 'detail') {
          const loading = body.querySelector<HTMLElement>('#fusion-treatment-loading');
          if(detailId==='receipt'&&canvas)syncReceiptLoading(canvas);else if(loading)loading.hidden=true;
          updateExhibitInteraction();
        }
        if(lastFocusAt)focusMetrics.intervalsMs.push(now-lastFocusAt);lastFocusAt=now;focusMetrics.costsMs.push(performance.now()-began);focusMetrics.intervalsMs=focusMetrics.intervalsMs.slice(-1200);focusMetrics.costsMs=focusMetrics.costsMs.slice(-1200);
      }
    }
    if (dialog.open && drawer === 'project' && projectId === 'archive' && archiveReplay) {
      query('#fusion-replay-status').textContent = `第${archiveReplay.number}夜 · ${Math.floor(archiveReplay.seconds)}／60秒 · 处置回放`;
    }
    if (scene?.ready && focus && tab === 'explore' && !dialog.open && !query('#fusion-inspection-panel').hidden && inspectionCadence.draw(now,1000/30)) {
      lastInspectionPaint = now;
      const target = now < manualInspectionUntil && !followLiveInspection ? manualInspectionPoint : focus();
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
    materialSnapshot:(id:string)=>{
      const state=controller.state;
      if(!state.game.collection.includes(id))return undefined;
      const canvas=id==='receipt'?exportRenewalReceiptMaterial(state.receipt,Date.now())
        :state.curios[id]?exportCurioMaterial(id,state.curios[id],Date.now()):undefined;
      return canvas?.toDataURL('image/png');
    },
    resetDiagnostics:()=>{museum.resetMetrics();focusMetrics.intervalsMs.length=0;focusMetrics.costsMs.length=0;lastFocusAt=0;feedbackMetrics.contactDispatchMs.length=0;feedbackMetrics.acceptedDispatchMs.length=0;feedbackMetrics.transactionMs.length=0;},
    diagnostics:()=>({view:tab,drawer:dialog.open?drawer:null,museum:museum.metrics(),focus:{clockMode:drawer==='case-preview'?'frozen':'realtime',sampleWindowMs:focusMetrics.intervalsMs.reduce((sum,value)=>sum+value,0),intervalsMs:[...focusMetrics.intervalsMs],costsMs:[...focusMetrics.costsMs]},input:{contactDispatchMs:[...feedbackMetrics.contactDispatchMs],acceptedDispatchMs:[...feedbackMetrics.acceptedDispatchMs],transactionMs:[...feedbackMetrics.transactionMs]}}),
    setScene(next: ExpeditionScene, onPulse: (event?:SceneFeedback) => void, getFocus?: () => {x: number; y: number}, unloadPoint?:()=>{x:number;y:number}) {
      scene = next;pulse = onPulse;focus = getFocus;getUnloadPoint=unloadPoint;scene.setActive(tab === 'explore' && !dialog.open);
    },
  };
}
