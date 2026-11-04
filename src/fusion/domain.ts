import {advance, newGame, restore, upgrade, claimReturn, tuning, type SaveData} from '../game/engine';
import {tapAssist} from '../game/assist';
import {buyGrowth, growthLevel} from '../game/growth';
import {repairStation, setAutoRepair} from '../game/station';
import {setWorldSlot, worldView} from '../game/world';
import {discoveries} from '../content/catalog';
import {nightAt, nightResult, nightRules, type NightConfig} from '../prototype/night-model';
import {residentEnvironment, residentIds} from '../render/resident-motion';
import {residentDailyPose} from '../review/resident-daily';
import {
  advanceReceiptRestoration, beginReceiptRestoration, createReceiptRestorationState,
  observeReceiptEvidence, RECEIPT_EVIDENCE_SOURCE, RESTORATION_DURATIONS,
  type ReceiptRestorationState,
} from '../review/receipt-restoration';
import {fusionProjects, fusionTargets, type FusionSave, type FusionAction, type FusionResult, type FieldRecord} from './contracts';

export const curioPrices: Record<string, {clean: number; repair: number}> = {
  tape: {clean: 30, repair: 100}, nested: {clean: 50, repair: 140},
  stamp: {clean: 45, repair: 180}, 'cosmic-parcel': {clean: 60, repair: 220},
  bell: {clean: 35, repair: 120},
};
const epochOf = (game: SaveData) => game.lastAt - game.world.elapsedMs;
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

function nightHistoryFrom(record: FieldRecord, game: SaveData): FieldRecord['night'] {
  const history = record.night;
  if (!history || record.target !== 'night' || !history.configuration || !history.receipt) return undefined;
  const configuration = history.configuration;
  if (!Array.isArray(configuration.slots) || configuration.slots.length !== 2 ||
    !configuration.slots.every(slot => slot === null || ['beacon', 'gate', 'tape', 'bell'].includes(slot)) ||
    (configuration.slots[0] !== null && configuration.slots[0] === configuration.slots[1]) ||
    !Array.isArray(configuration.strengths) || configuration.strengths.length !== 2 ||
    !configuration.strengths.every(level => Number.isInteger(level) && level >= 0 && level <= 3)) return undefined;
  const receipt = history.receipt;
  const bounded = (value: unknown, maximum: number) => finite(value) && Number.isInteger(value) && value <= maximum;
  if (!bounded(receipt.number, 1e9) || receipt.number < 1 || record.id !== `night/${receipt.number}` ||
    record.at !== epochOf(game) + receipt.number * 300000 ||
    !bounded(receipt.damage, 18) || !bounded(receipt.required, 300) || !bounded(receipt.repaired, 100) ||
    !bounded(receipt.spent, 300) || !bounded(receipt.unrepaired, 100) || !bounded(receipt.intercepted, 3) ||
    !bounded(receipt.arrived, 3) || !finite(receipt.balance) || receipt.balance > 1e12) return undefined;
  const result = nightResult(configuration);
  if (result.intercepted !== receipt.intercepted || result.arrived !== receipt.arrived ||
    receipt.damage > receipt.arrived * 6 || receipt.spent > receipt.required) return undefined;
  return structuredClone({configuration, receipt});
}

export function createFusion(now: number, legacyRaw: string | null = null): FusionSave {
  let game = newGame(now);
  let importedLegacy = false;
  if (legacyRaw) {
    try {
      const original = JSON.parse(legacyRaw) as SaveData;
      if (original && [1, 2].includes(original.version) && finite(original.lastAt) && original.lastAt <= 1e15) {
        // Decode the original state first so funded offline nights pass through the fusion recorder.
        const decoded = restore(legacyRaw, now, {advance: false});
        if (decoded.lastAt === original.lastAt && decoded.resources === original.resources) {
          game = decoded;
          importedLegacy = true;
        }
      }
    } catch { /* The original legacy value remains untouched. */ }
  }
  const receipt = createReceiptRestorationState(game.resources, growthLevel(game, 'case-0'));
  if (importedLegacy && game.collection.includes('receipt')) {
    receipt.stage = 'displayed';
    receipt.condition = 'stabilized';
  }
  const state: FusionSave = {
    version: 1, game, receipt, projects: [], records: [], task: null, taskSeq: 0,
    importedLegacy,
    curios: Object.fromEntries(Object.keys(curioPrices).filter(id => game.collection.includes(id))
      .map(id => [id, {condition: importedLegacy ? 'stabilized' as const : 'found' as const}])),
  };
  return importedLegacy ? advanceFusion(state, now, now - game.lastAt >= 30000) : state;
}

function paperFrom(raw: unknown, game: SaveData): ReceiptRestorationState {
  const value = raw as ReceiptRestorationState;
  const fallback = createReceiptRestorationState(game.resources, growthLevel(game, 'case-0'));
  if (!value || value.specimenId !== fallback.specimenId || !['buried', 'displayed'].includes(value.stage)
    || !['found', 'clean', 'stabilized'].includes(value.condition)
    || !Array.isArray(value.completedActionIds) || value.completedActionIds.length > 128
    || !value.completedActionIds.every(id => typeof id === 'string' && id.length < 160)
    || !Array.isArray(value.verifiedEvidenceIds) || !Array.isArray(value.observations)
    || !Array.isArray(value.transactions) || value.transactions.length > 2) return fallback;
  let result: ReceiptRestorationState = {...fallback, stage: value.stage, condition: value.condition,
    completedActionIds: value.completedActionIds,
    transactions: value.transactions.filter(t => t && typeof t.actionId === 'string'
      && (t.kind === 'clean' || t.kind === 'repair') && finite(t.amount)),
  };
  for (const event of value.observations.slice(-64)) {
    if (event && typeof event.actionId === 'string' && event.actionId.startsWith('fusion/') && event.metadata
      && finite(event.observedAtSeconds) && event.observedAtSeconds <= game.lastAt / 1000
      && typeof event.metadata.actualSource === 'string'
      && validObservationSource(event.evidenceId, event.metadata.actualSource)) result = observeReceiptEvidence(result, event);
  }
  result.verifiedEvidenceIds = value.verifiedEvidenceIds.filter(id => result.evidenceIds.includes(id));
  const action = value.activeAction;
  if (action && Object.hasOwn(RESTORATION_DURATIONS, action.kind) && typeof action.id === 'string'
    && action.id.length < 160 && finite(action.startedAtSeconds) && action.startedAtSeconds <= game.lastAt / 1000
    && Array.isArray(action.evidenceSnapshot) && !result.completedActionIds.includes(action.id)
    && ((action.kind === 'excavate' && result.stage === 'buried') ||
      (result.stage === 'displayed' && ((action.kind === 'clean' && result.condition === 'found') ||
        (action.kind === 'repair' && result.condition === 'clean') ||
        (action.kind === 'identify' && result.condition === 'stabilized') || action.kind === 'try')))
    && (!['clean', 'repair'].includes(action.kind) || result.transactions.some(transaction =>
      transaction.actionId === action.id && transaction.kind === action.kind && transaction.amount === (action.kind === 'clean' ? 40 : 120)))) {
    result.activeAction = {...action, durationSeconds: RESTORATION_DURATIONS[action.kind],
      evidenceSnapshot: action.evidenceSnapshot.filter(id => result.evidenceIds.includes(id))};
  }
  return result;
}

export function restoreFusion(raw: string, now: number): FusionSave {
  const input = JSON.parse(raw) as FusionSave;
  if (input?.version !== 1 || !input.game || !finite(input.game.lastAt)
    || !Array.isArray(input.projects) || !Array.isArray(input.records)) throw new Error('融合存档无法读取');
  // First restore without advancing so scene observations have their original time interval.
  const game = restore(JSON.stringify(input.game), input.game.lastAt);
  if (game.lastAt !== input.game.lastAt || game.resources !== input.game.resources) throw new Error('融合存档校验失败');
  const state = createFusion(game.lastAt);
  state.game = game;
  state.receipt = paperFrom(input.receipt, game);
  state.projects = [...new Set(input.projects.filter(id => fusionProjects.some(p => p.id === id)))];
  state.records = input.records.filter((r, index, records) => r && typeof r.id === 'string' && r.id.length < 180
    && ['marker', 'residents', 'night'].includes(r.target) && typeof r.source === 'string'
    && r.source.startsWith('parcel/returns-plain/') && r.source.length < 180
    && typeof r.detail === 'string' && r.detail.length < 500 && finite(r.at) && r.at <= game.lastAt
    && records.findIndex(other => other?.id === r.id) === index).slice(-96).map(record => {
      const {night: _unvalidated, ...base} = record;
      const history = nightHistoryFrom(record, game);
      return history ? {...base, night: history} : base;
    });
  state.taskSeq = Number.isSafeInteger(input.taskSeq) && input.taskSeq >= 0 ? input.taskSeq : 0;
  state.importedLegacy = input.importedLegacy === true;
  state.curios = {};
  for (const id of Object.keys(curioPrices)) {
    const curio = input.curios?.[id];
    if (!curio || !['found', 'clean', 'stabilized'].includes(curio.condition)) continue;
    state.curios[id] = {condition: curio.condition};
    if (curio.action && ['clean', 'repair'].includes(curio.action.kind)
      && finite(curio.action.startedAt) && curio.action.startedAt <= game.lastAt && finite(curio.action.endsAt)
      && curio.action.endsAt - curio.action.startedAt === 3000
      && (curio.action.kind === 'clean' ? curio.condition === 'found' : curio.condition === 'clean')) state.curios[id].action = curio.action;
  }
  const task = input.task;
  if (task && fusionTargets.some(t => t.id === task.target && t.price === task.price && task.endsAt - task.startedAt === t.duration)
    && typeof task.id === 'string' && /^task\/\d+$/.test(task.id) && Number(task.id.slice(5)) <= state.taskSeq
    && finite(task.startedAt) && task.startedAt <= game.lastAt
    && finite(task.endsAt)) state.task = task;
  return advanceFusion(state, now, now - game.lastAt >= 30000);
}

function record(state: FusionSave, id: string, target: string, at: number, source: string, detail: string, history?: FieldRecord['night']) {
  if (state.records.some(r => r.id === id)) return;
  state.records.push({id, target, at, source, detail, ...(history ? {night: structuredClone(history)} : {})});
  state.records = state.records.slice(-96);
}

function refreshNightReceipt(state: FusionSave) {
  const receipt = state.game.station.lastNight;
  if (!receipt) return;
  const recorded = state.records.find(record => record.id === `night/${receipt.number}` && record.night);
  if (!recorded?.night) return;
  recorded.night.receipt = structuredClone(receipt);
  recorded.detail = `核验${receipt.intercepted}位 · 抵站${receipt.arrived}位 · 受损${receipt.damage}点 · 维修${receipt.spent}零件`;
}

function validObservationSource(id: string, source: string) {
  const site = id === 'field-pipe-scan' ? 'pipe-marker-p03' : id === 'field-warehouse-arrival' ? 'receiving-warehouse' : null;
  return Boolean(site && (source === `parcel/returns-plain/${site}` || source === RECEIPT_EVIDENCE_SOURCE));
}

function addObservation(state: FusionSave, id: string, at: number, source: string) {
  const owned = state.game.collection.includes('receipt') || state.game.pendingReturn?.discoveries.includes('receipt');
  if (!owned || !finite(at) || at > state.game.lastAt || !validObservationSource(id, source)) return false;
  const site = id === 'field-pipe-scan' ? 'pipe-marker-p03' : id === 'field-warehouse-arrival' ? 'receiving-warehouse' : null;
  if (!site) return false;
  const elapsed = Math.max(0, at - epochOf(state.game));
  const number = Math.floor(elapsed / 300000);
  const visit = elapsed % 300000 < 240000 ? `day-${state.game.cycles}` : `night-${number + 1}`;
  const actionId = `fusion/${visit}/${id}`;
  state.receipt = observeReceiptEvidence(state.receipt, {
    actionId, evidenceId: id, observedAtSeconds: at / 1000, source: RECEIPT_EVIDENCE_SOURCE,
    metadata: {artifactCode: 'RET-031', boxCode: 'P03', nodeId: site,
      eventKind: id === 'field-pipe-scan' ? 'marker-scan' : 'warehouse-arrival', actualSource: source},
  });
  record(state, actionId, 'marker', at, source, id === 'field-pipe-scan' ? '现场箱标P03与原件RET-031相符' : '收容匣已送入原收件站');
  return true;
}

function observeWorld(state: FusionSave, before: SaveData) {
  const game = state.game;
  const phase = game.world.elapsedMs % 300000;
  const night = Math.floor(game.world.elapsedMs / 300000);
  const station = game.station.lastNight;
  if (station && station.number > before.world.settledNights) {
    const at = epochOf(game) + station.number * 300000;
    const report = game.world.lastReport;
    const frozen = before.world.activeNight?.index === station.number ? before.world.activeNight : before.world;
    const configuration: NightConfig = report?.number === station.number && report.result
      ? report.result.configuration : {slots: frozen.slots, strengths: frozen.strengths ?? [0, 0]};
    const result = nightResult(configuration);
    record(state, `night/${station.number}`, 'night', at, 'parcel/returns-plain/receiving-warehouse',
      `核验${station.intercepted}位 · 抵站${station.arrived}位 · 受损${station.damage}点 · 维修${station.spent}零件`,
      {configuration, receipt: station});
    // A completed real timeline provides the same source observation even offscreen.
    if (result?.actors.some(a => a.id === 2 && a.verificationMs >= 3000)) {
      addObservation(state, 'field-pipe-scan', at - 1000, 'parcel/returns-plain/pipe-marker-p03');
    }
  }
  const fundedEnd = before.world.elapsedMs + Math.min(game.lastAt - before.lastAt, tuning(before).cargo * 1000);
  if (phase >= 240000 && game.world.elapsedMs <= fundedEnd) {
    const config = game.world.activeNight ?? game.world;
    const actor = nightAt({slots: config.slots, strengths: config.strengths ?? [0, 0]}, (phase - 240000) / 1000).actors.find(a => a.id === 2);
    if (actor && actor.verification * nightRules.verificationMs >= 3000) {
      addObservation(state, 'field-pipe-scan', epochOf(game) + night * 300000 + phase,
        'parcel/returns-plain/pipe-marker-p03');
    }
  }
}

/** Historical configuration and billing are copied for replay, never committed to the player. */
export function latestNightHistory(state: FusionSave): SaveData | null {
  const latest = state.records.filter(record => record.target === 'night' && record.night)
    .sort((a, b) => b.at - a.at).find(record => nightHistoryFrom(record, state.game));
  const live = state.game.world.lastReport;
  const liveReceipt = state.game.station.lastNight;
  if (live?.result && liveReceipt && live.number === liveReceipt.number &&
    (!latest?.night || live.number >= latest.night.receipt.number)) return structuredClone(state.game);
  if (!latest?.night) return null;
  const source = structuredClone(state.game);
  const history = nightHistoryFrom(latest, state.game)!;
  const result = nightResult(history.configuration);
  // Manual and later automatic repairs can update the still-current funded receipt.
  source.station.lastNight = liveReceipt?.number === history.receipt.number
    ? structuredClone(liveReceipt) : history.receipt;
  source.world.lastReport = {number: history.receipt.number, clues: result.clues,
    intercepted: result.intercepted, arrived: result.arrived, summary: latest.detail, result};
  return source;
}

export function projectAvailable(state: FusionSave, id: string): {available: boolean; reason?: string} {
  const project = fusionProjects.find(project => project.id === id);
  if (!project || state.projects.includes(id)) return {available: false, reason: '已经建成'};
  if (id === 'evidence-bench' && (!state.game.collection.includes('receipt') || !state.records.some(record => record.target === 'marker'))) {
    return {available: false, reason: '先核对箱标'};
  }
  if (id === 'habitat-window' && !residentIds.every(id => state.game.collection.includes(id))) {
    return {available: false, reason: '发现三位居民'};
  }
  if (id === 'archive' && !state.records.some(record => record.target === 'night')) return {available: false, reason: '等一次夜班'};
  if (state.game.resources < project.price) return {available: false, reason: '零件不足'};
  return {available: true};
}

export function advanceFusion(previous: FusionSave, now: number, offline = false): FusionSave {
  if (!Number.isFinite(now) || now < previous.game.lastAt) return previous;
  const state = structuredClone(previous);
  state.game = advance(state.game, now, offline);
  state.receipt = advanceReceiptRestoration(state.receipt, now / 1000);
  state.receipt.completedActionIds = state.receipt.completedActionIds.slice(-128);
  state.receipt.observations = state.receipt.observations.slice(-64);
  state.receipt.parts = state.game.resources;
  state.receipt.caseTier = growthLevel(state.game, 'case-0');
  for (const id of Object.keys(curioPrices)) {
    if (!state.game.collection.includes(id)) continue;
    const curio = state.curios[id] ??= {condition: 'found'};
    if (curio.action && now >= curio.action.endsAt) {
      curio.condition = curio.action.kind === 'clean' ? 'clean' : 'stabilized';
      delete curio.action;
    }
  }
  observeWorld(state, previous.game);
  refreshNightReceipt(state);
  const task = state.task;
  if (task && now >= task.endsAt) {
    const event = state.records.find(r => r.target === task.target && r.at > task.startedAt);
    if (task.target === 'residents' && state.game.collection.some(id => ['mouse', 'hermit', 'tagbird'].includes(id))) {
      const observed = task.endsAt >= previous.game.lastAt ? advance(previous.game, task.endsAt) : state.game;
      const environment = residentEnvironment(worldView(observed), observed.world.elapsedMs / 1000);
      const labels: Record<string, string> = {foraging: '觅食', walking: '走动', sniffing: '嗅纸', eating: '啃纸',
        carrying: '搬运', 'ear-twitch': '抖耳', shaking: '抖动', peeking: '探头', 'dragging-paper': '搬纸',
        resting: '休息', flying: '飞行', landing: '落杆', preening: '梳羽', returning: '归巢',
        sleeping: '抱纸睡', sheltering: '缩壳', roosting: '收翼夜栖', waking: '苏醒'};
      const activities = residentIds.filter(id => observed.collection.includes(id)).map(id => {
        const name = discoveries.find(d => d.id === id)!.name;
        const action = residentDailyPose(id, environment).action;
        return `${name} ${labels[action] ?? '休息'}`;
      });
      record(state, task.id, task.target, observed.lastAt, 'parcel/returns-plain/resident-observation', activities.join(' · '));
      state.task = null;
    } else if (event) {
      record(state, task.id, task.target, now, event.source, `定向核对完成 · ${event.detail}`);
      state.task = null;
    }
  }
  return state;
}

export function reduceFusion(previous: FusionSave, action: FusionAction, now: number): {state: FusionSave; result: FusionResult} {
  if (!finite(now) || now < previous.game.lastAt) return {state: previous, result: {ok: false, message: '正在同步时间'}};
  const state = advanceFusion(previous, now, now - previous.game.lastAt >= 30000);
  const game = state.game;
  let ok = false;
  let message: string | undefined;
  if (action.type === 'tap') {
    state.game = tapAssist(game, now, game.assist?.actionSeq ?? 0);
    ok = state.game.assist?.actionSeq !== game.assist?.actionSeq;
    if (!ok) message = game.world.elapsedMs % 300000 >= 240000 ? '夜班自动处理' : '交给咔哒吧';
  } else if (action.type === 'upgrade') {
    state.game = upgrade(game, action.id, action.expected);
    ok = state.game !== game;
  } else if (action.type === 'growth') {
    state.game = buyGrowth(game, action.id, action.expected);
    ok = state.game !== game;
  } else if (action.type === 'paper') {
    if (game.collection.includes('receipt')) {
      const next = beginReceiptRestoration({...state.receipt, parts: game.resources}, action.kind,
        `fusion/paper/${state.taskSeq + 1}`, now / 1000);
      state.receipt = next.state;
      ok = next.accepted;
      if (ok) {state.taskSeq++; state.game = {...game, resources: next.state.parts};}
      else message = next.reason === 'insufficient-parts' ? '零件不足' : '正在整理';
    }
  } else if (action.type === 'project') {
    const project = fusionProjects.find(p => p.id === action.id);
    const availability = projectAvailable(state, action.id);
    if (project && availability.available) {
      state.projects.push(project.id);
      state.game = {...game, resources: game.resources - project.price};
      ok = true;
    } else message = availability.reason;
  } else if (action.type === 'task') {
    const target = fusionTargets.find(t => t.id === action.target);
    const eligible = action.target === 'marker' ? game.collection.includes('receipt')
      : action.target === 'night' ? game.world.settledNights > 0
        : game.collection.some(id => ['mouse', 'hermit', 'tagbird'].includes(id));
    if (target && eligible && !state.task && !game.research.active && game.resources >= target.price) {
      state.taskSeq++;
      state.task = {id: `task/${state.taskSeq}`, target: action.target, startedAt: now, endsAt: now + target.duration, price: target.price};
      state.game = {...game, resources: game.resources - target.price};
      state.game.research.started++;
      state.game.research.spent += target.price;
      state.game.research.active = {id: state.task.id, plan: 'field',
        kind: action.target === 'marker' ? 'artifact' : action.target === 'residents' ? 'creature' : 'event',
        source: game.collection.find(id => discoveries.some(d => d.id === id && d.kind === 'artifact')) ?? null,
        end: game.world.elapsedMs + target.duration, observationOnly: true};
      ok = true;
    }
  } else if (action.type === 'cancel-task') {
    if (state.task?.id === action.id) {
      const target = fusionTargets.find(target => target.id === state.task!.target)!;
      const remaining = Math.max(0, Math.min(target.duration, state.task.endsAt - now));
      const refund = Math.floor(state.task.price * remaining / target.duration);
      state.game = {...game, resources: game.resources + refund};
      state.game.research.spent = Math.max(0, state.game.research.spent - refund);
      if (state.game.research.active?.id === state.task.id) state.game.research.active = null;
      state.task = null;
      ok = true;
      message = `已取消，退回${refund}零件`;
    }
  } else if (action.type === 'auto-repair') {
    state.game = setAutoRepair(game, action.enabled);
    ok = true;
  } else if (action.type === 'repair') {
    state.game = repairStation(game, action.expected);
    ok = state.game !== game;
  } else if (action.type === 'claim') {
    state.game = claimReturn(game);
    ok = state.game !== game;
  } else if (action.type === 'observe') {
    const observed = finite(action.at) && action.at >= previous.game.lastAt && action.at <= now
      ? advance(previous.game, action.at) : null;
    const fraction = observed ? observed.cycleMs / tuning(observed).scanner : 0;
    const phase = observed ? observed.world.elapsedMs % 300000 : 0;
    const daytimeScan = phase < 240000 && fraction >= .40 && fraction < .52;
    const config = observed?.world.activeNight ?? observed?.world ?? game.world;
    const actor = phase >= 240000 ? nightAt({slots: config.slots, strengths: config.strengths ?? [0, 0]},
      (phase - 240000) / 1000).actors.find(actor => actor.id === 2) : undefined;
    const nightScan = Boolean(actor && actor.verification * nightRules.verificationMs >= 3000);
    const resolution = nightResult({slots: config.slots, strengths: config.strengths ?? [0, 0]}).actors.find(actor => actor.id === 2);
    const warehouse = phase >= 240000 && Boolean(resolution && phase - 240000 >=
      (resolution.outcome === 'arrived' ? resolution.atMs : 59010));
    const actualEvent = action.id === 'field-pipe-scan' ? daytimeScan || nightScan
      : action.id === 'field-warehouse-arrival' && warehouse;
    if (observed && now - action.at < 5000 && actualEvent) {
      ok = addObservation(state, action.id, action.at, action.source);
    }
  } else if (action.type === 'slot') {
    state.game = setWorldSlot(game, action.slot, action.enabled ? (action.slot === 0 ? 'beacon' : 'gate') : null);
    ok = state.game !== game;
  } else if (action.type === 'curio') {
    const prices = curioPrices[action.id];
    const curio = state.curios[action.id];
    if (prices && curio && !curio.action && game.collection.includes(action.id)
      && (action.kind === 'clean' ? curio.condition === 'found' : curio.condition === 'clean')
      && game.resources >= prices[action.kind]) {
      state.game = {...game, resources: game.resources - prices[action.kind]};
      curio.action = {kind: action.kind, startedAt: now, endsAt: now + 3000};
      ok = true;
    }
  }
  state.receipt.parts = state.game.resources;
  refreshNightReceipt(state);
  return {state, result: {ok, message: message ?? (!ok ? '暂时无法操作' : undefined)}};
}
