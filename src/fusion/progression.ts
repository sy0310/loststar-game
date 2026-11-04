import {advance, tuning, type SaveData} from '../game/engine';
import type {FusionAction, FusionResult, FusionSave} from './contracts';

export type AbilityId = 'receipt' | 'tape';
export type AbilityLevel = 0 | 1 | 2;
export type SortingPhase = 'unknown' | 'observed' | 'surveying' | 'surveyed' | 'building' | 'ready' | 'working' | 'cleared';
export type SortingStage = 'hauling' | 'verify' | 'clear-paper';
export type SortingStudyId = 'belt-direction' | 'label-orientation' | 'paper-fibres';
export type SortingActionKind = 'survey' | 'build' | 'work' | 'compare' | 'research' | 'cancel-research' | 'review';
export interface SortingFact {
  id: string;
  kind: 'label' | 'comparison' | 'study';
  nodeId: string;
  at: number;
  detail: string;
  code?: 'P03' | 'P30';
  orientation?: 'upright' | 'inverted';
}
interface ProgressionPayment {id: string; amount: number; at: number}
export interface ProgressionState {
  version: 1;
  abilities: Record<AbilityId, AbilityLevel>;
  payments: ProgressionPayment[];
  workCursor: number;
  sorting: {
    phase: SortingPhase;
    stage: SortingStage | null;
    stageStartedAt: number;
    workDone: number;
    paidCost: number;
    buildTapeLevel: AbilityLevel;
    compared: boolean;
    facts: SortingFact[];
    clearedAt: number | null;
    studySeq: number;
    researchPaid: number;
    researchRefunded: number;
    activeStudy: {id: SortingStudyId; seq: number; startedAt: number; workDone: number} | null;
  };
}

export const abilityPrices = {receipt: [300, 600], tape: [240, 720]} as const;
export const sortingRules = {baseCost: 2400, surveyWork: 2, buildWork: 1, haulingWork: 5,
  verificationWork: 6, assistedVerificationWork: 3, paperWork: 7, assistedPaperWork: 5,
  researchPrice: 90, researchWork: 2} as const;
export const sortingStudies = [
  {id: 'belt-direction', name: '传送方向', detail: '纸路已经接通，箱子沿传送带朝原收件站移动。'},
  {id: 'label-orientation', name: '箱标朝向', detail: '支线标牌P03与倒置箱签P30并列，字码顺序确有差异。'},
  {id: 'paper-fibres', name: '纸层纹理', detail: '留存纸样保留纵向折痕，断口的两片纸边可以对照。'},
] as const;

export function explorationWorkPosition(game: SaveData) {
  return game.cycles + game.cycleMs / tuning(game).scanner;
}

export function createProgression(game: SaveData): ProgressionState {
  return {version: 1, abilities: {receipt: 0, tape: 0}, payments: [], workCursor: explorationWorkPosition(game),
    sorting: {phase: 'unknown', stage: null, stageStartedAt: game.lastAt, workDone: 0,
      paidCost: 0, buildTapeLevel: 0, compared: false, facts: [], clearedAt: null,
      studySeq: 0, researchPaid: 0, researchRefunded: 0, activeStudy: null}};
}

const finite = (value: unknown, maximum = 1e15): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= maximum;
const level = (value: unknown): value is AbilityLevel => value === 0 || value === 1 || value === 2;
const phases: SortingPhase[] = ['unknown', 'observed', 'surveying', 'surveyed', 'building', 'ready', 'working', 'cleared'];
const stages: SortingStage[] = ['hauling', 'verify', 'clear-paper'];
const studyIds = sortingStudies.map(study => study.id);
const paymentAmounts: Record<string, number> = {
  'ability/receipt/1': 300, 'ability/receipt/2': 600,
  'ability/tape/1': 240, 'ability/tape/2': 720,
};

function validFact(value: SortingFact, at: number) {
  if (!value || !finite(value.at, at) || typeof value.detail !== 'string' || value.detail.length >= 240) return false;
  if (value.id === 'label/P03') return value.kind === 'label' && value.nodeId === 'parcel/old-sorting/belt-sign'
    && value.code === 'P03' && value.orientation === 'upright';
  if (value.id === 'label/P30') return value.kind === 'label' && value.nodeId === 'parcel/old-sorting/returned-box'
    && value.code === 'P30' && value.orientation === 'inverted';
  if (value.id === 'comparison/P03-P30') return value.kind === 'comparison' && value.nodeId === 'parcel/old-sorting/label-table';
  return sortingStudies.some(study => value.id === `study/${study.id}` && value.kind === 'study'
    && value.nodeId === `parcel/old-sorting/${study.id}`);
}

/** Normalize optional review data without changing the underlying wallet or old ownership. */
export function cleanProgression(raw: unknown, game: SaveData): ProgressionState {
  const result = createProgression(game);
  const value = raw as ProgressionState | undefined;
  if (!value || value.version !== 1) return result;
  for (const id of ['receipt', 'tape'] as const) {
    if (level(value.abilities?.[id])) result.abilities[id] = value.abilities[id];
  }
  result.payments = Array.isArray(value.payments) ? value.payments.filter((payment, index, payments) =>
    payment && ((payment.id === 'sorting/build' && [1920, 2160, 2400].includes(payment.amount))
      || (Object.hasOwn(paymentAmounts, payment.id) && payment.amount === paymentAmounts[payment.id]))
    && finite(payment.at, game.lastAt)
    && payments.findIndex(other => other?.id === payment.id) === index).slice(-5) : [];
  for (const id of ['receipt', 'tape'] as const) {
    if (result.payments.some(payment => payment.id === `ability/${id}/2`)) result.abilities[id] = 2;
    else if (result.payments.some(payment => payment.id === `ability/${id}/1`)) result.abilities[id] = Math.max(1, result.abilities[id]) as AbilityLevel;
  }
  const sorting = value.sorting;
  if (!sorting) return result;
  const output = result.sorting;
  if (phases.includes(sorting.phase)) output.phase = sorting.phase;
  if (stages.includes(sorting.stage!)) output.stage = sorting.stage;
  if (finite(sorting.stageStartedAt, game.lastAt)) output.stageStartedAt = sorting.stageStartedAt;
  if (finite(sorting.workDone, 7)) output.workDone = sorting.workDone;
  if ([0, 1920, 2160, 2400].includes(sorting.paidCost)) output.paidCost = sorting.paidCost;
  if (level(sorting.buildTapeLevel)) output.buildTapeLevel = sorting.buildTapeLevel;
  output.compared = sorting.compared === true;
  if (finite(sorting.clearedAt, game.lastAt)) output.clearedAt = sorting.clearedAt;
  if (Array.isArray(sorting.facts)) output.facts = sorting.facts.filter((fact, index, facts) =>
    validFact(fact, game.lastAt) && facts.findIndex(other => other?.id === fact.id) === index).slice(-6);
  if (Number.isSafeInteger(sorting.studySeq) && sorting.studySeq >= 0) output.studySeq = sorting.studySeq;
  if (finite(sorting.researchPaid, 1e9) && Number.isInteger(sorting.researchPaid)) output.researchPaid = sorting.researchPaid;
  if (finite(sorting.researchRefunded, output.researchPaid) && Number.isInteger(sorting.researchRefunded)) output.researchRefunded = sorting.researchRefunded;
  const active = sorting.activeStudy;
  const completedStudies = output.facts.filter(entry => entry.kind === 'study').length;
  if (active && studyIds.includes(active.id) && Number.isSafeInteger(active.seq) && active.seq > 0
    && active.seq <= output.studySeq && finite(active.startedAt, game.lastAt)
    && finite(active.workDone, sortingRules.researchWork) && !output.facts.some(fact => fact.id === `study/${active.id}`)
    && output.researchPaid === output.studySeq * sortingRules.researchPrice
    && output.researchPaid - output.researchRefunded >= (completedStudies + 1) * sortingRules.researchPrice) {
    output.activeStudy = {...active};
  }
  // A saved payment keeps already-built rights even if an optional phase field was damaged.
  const build = result.payments.find(payment => payment.id === 'sorting/build');
  if (build && [1920, 2160, 2400].includes(build.amount)) output.paidCost = build.amount;
  if (output.paidCost) output.buildTapeLevel = ((2400 - output.paidCost) / 240) as AbilityLevel;
  if (['building', 'ready', 'working', 'cleared'].includes(output.phase) && output.paidCost === 0) {
    output.phase = 'surveyed'; output.stage = null; output.workDone = 0;
  }
  if (output.phase === 'working' && !output.stage) output.stage = 'hauling';
  if (output.phase !== 'working') output.stage = null;
  if (output.compared && !hasLabels(result)) output.compared = false;
  if (!hasLabels(result)) output.facts = output.facts.filter(entry => entry.kind !== 'comparison');
  if (output.phase !== 'cleared') output.activeStudy = null;
  return result;
}

function hasLabels(state: ProgressionState) {
  return state.sorting.facts.some(fact => fact.id === 'label/P03' && fact.code === 'P03')
    && state.sorting.facts.some(fact => fact.id === 'label/P30' && fact.code === 'P30');
}

function fact(state: ProgressionState, value: SortingFact) {
  if (!state.sorting.facts.some(existing => existing.id === value.id)) state.sorting.facts.push(value);
}

function requiredWork(state: ProgressionState) {
  const sorting = state.sorting;
  if (sorting.phase === 'observed' || sorting.phase === 'surveying') return sortingRules.surveyWork;
  if (sorting.phase === 'surveyed' || sorting.phase === 'building') return sortingRules.buildWork;
  if (sorting.phase === 'ready') return sortingRules.haulingWork;
  if (sorting.stage === 'hauling') return sortingRules.haulingWork;
  if (sorting.stage === 'verify') return sorting.compared ? sortingRules.assistedVerificationWork : sortingRules.verificationWork;
  return state.abilities.tape === 2 ? sortingRules.assistedPaperWork : sortingRules.paperWork;
}

function compareLabels(state: ProgressionState, at: number) {
  if (!hasLabels(state) || state.sorting.compared) return false;
  state.sorting.compared = true;
  fact(state, {id: 'comparison/P03-P30', kind: 'comparison', nodeId: 'parcel/old-sorting/label-table', at,
    detail: '收据展开对照两份实际箱标，P03与倒置P30的字码次序不同。'});
  return true;
}

function workTime(before: SaveData, after: SaveData, target: number) {
  let lower = 0;
  let upper = Math.ceil(after.lastAt - before.lastAt);
  while (lower < upper) {
    const middle = Math.floor((lower + upper) / 2);
    const at = Math.min(after.lastAt, before.lastAt + middle);
    if (explorationWorkPosition(advance(before, at)) + 1e-8 >= target) upper = middle;
    else lower = middle + 1;
  }
  return Math.min(after.lastAt, before.lastAt + lower);
}

/** Consume only the already-earned ordinary exploration work. Income remains in the core engine. */
export function advanceProgression(state: FusionSave, before: SaveData) {
  const progression = state.progression;
  const sorting = progression.sorting;
  const endWork = explorationWorkPosition(state.game);
  let cursor = progression.workCursor;
  const startWork = cursor;
  const earned = Math.max(0, endWork - cursor);
  let available = earned;
  progression.workCursor = endWork;
  if (sorting.phase === 'unknown' && state.receipt.evidenceIds.includes('field-pipe-scan')) {
    sorting.phase = 'observed'; sorting.stageStartedAt = state.game.lastAt;
  }
  if (sorting.phase === 'working' && sorting.stage === 'verify' && progression.abilities.receipt === 2) {
    compareLabels(progression, state.game.lastAt);
  }
  while (['surveying', 'building', 'working'].includes(sorting.phase)) {
    const required = requiredWork(progression);
    const applied = Math.min(available, Math.max(0, required - sorting.workDone));
    sorting.workDone += applied; available -= applied; cursor += applied;
    if (sorting.workDone + 1e-8 < required) break;
    const at = workTime(before, state.game, cursor);
    sorting.workDone = 0; sorting.stageStartedAt = at;
    if (sorting.phase === 'surveying') {
      fact(progression, {id: 'label/P03', kind: 'label', nodeId: 'parcel/old-sorting/belt-sign', at,
        code: 'P03', orientation: 'upright', detail: '咔哒完成两轮勘测，传送带边的实际标牌为P03。'});
      sorting.phase = 'surveyed'; break;
    }
    if (sorting.phase === 'building') {sorting.phase = 'ready'; break;}
    if (sorting.stage === 'hauling') {
      fact(progression, {id: 'label/P30', kind: 'label', nodeId: 'parcel/old-sorting/returned-box', at,
        code: 'P30', orientation: 'inverted', detail: '搬开卡住的箱堆后，箱底露出倒置的P30纸签。'});
      sorting.stage = 'verify';
      if (progression.abilities.receipt === 2) compareLabels(progression, at);
    } else if (sorting.stage === 'verify') sorting.stage = 'clear-paper';
    else {sorting.phase = 'cleared'; sorting.stage = null; sorting.clearedAt = at; break;}
  }
  const active = sorting.activeStudy;
  if (active) {
    const needed = Math.max(0, sortingRules.researchWork - active.workDone);
    active.workDone = Math.min(sortingRules.researchWork, active.workDone + earned);
    if (active.workDone + 1e-8 >= sortingRules.researchWork) {
      const study = sortingStudies.find(study => study.id === active.id)!;
      fact(progression, {id: `study/${study.id}`, kind: 'study', nodeId: `parcel/old-sorting/${study.id}`,
        at: workTime(before, state.game, startWork + needed), detail: study.detail});
      sorting.activeStudy = null;
    }
  }
}

export interface RefinementActionView {action: FusionAction; label: string; price: number; enabled: boolean; reason?: string}

export function refinementView(state: FusionSave) {
  const progression = state.progression;
  const sorting = progression.sorting;
  const known = sorting.phase !== 'unknown';
  const constructionTarget = known && !sorting.paidCost && sorting.phase !== 'cleared';
  const verificationTarget = known && !sorting.compared && sorting.phase !== 'cleared' && sorting.stage !== 'clear-paper';
  const paperTarget = known && sorting.phase !== 'cleared';
  const abilities = Object.fromEntries((['receipt', 'tape'] as const).map(id => {
    const current = progression.abilities[id];
    const nextPrice: number | null = current === 2 ? null : abilityPrices[id][current === 0 ? 0 : 1];
    const tidy = id === 'receipt' ? state.receipt.condition === 'stabilized' : state.curios.tape?.condition === 'stabilized';
    const hasTarget = id === 'receipt' ? verificationTarget : constructionTarget || paperTarget;
    const noTarget = !known ? '等待现场线索' : sorting.phase === 'cleared' ? '本段已完成，等待新作业' : '本段已核对，等待新样本';
    const reason = !state.game.collection.includes(id) ? '等待发现' : !tidy ? '先整理奇物'
      : sorting.phase === 'unknown' ? '先核对P03' : nextPrice === null ? '已完成研究'
        : !hasTarget ? noTarget : state.game.resources < nextPrice ? '零件不足' : undefined;
    const nextEffect = !hasTarget ? noTarget : id === 'receipt'
      ? current === 0 ? '主动对照，核验6轮→3轮' : '自动核验实际箱标'
      : current === 0 ? constructionTarget ? '工程材料减少10%' : `解锁Ⅱ档清纸研究，另需${abilityPrices.tape[1]}`
        : constructionTarget ? '工程材料减少20%，清纸7轮→5轮' : '本段清纸7轮→5轮';
    const currentEffect = current === 0 ? '尚未研究' : !known ? '已保留能力，等待现场线索' : id === 'receipt'
      ? !verificationTarget ? `本段已核对，保留${current === 1 ? 'Ⅰ' : 'Ⅱ'}档能力`
        : current === 1 ? '主动对照，核验6轮→3轮' : '自动核验实际箱标'
      : !paperTarget ? `本段已完成，保留${current === 1 ? 'Ⅰ' : 'Ⅱ'}档能力`
        : current === 1 ? constructionTarget ? '工程材料减少10%' : 'Ⅰ档已研究，本段工程款锁定'
          : constructionTarget ? '工程材料减少20%，清纸5轮' : '本段清纸7轮→5轮';
    return [id, {level: current, nextPrice, enabled: !reason, reason, hasTarget, currentEffect, nextEffect,
      action: {type: 'ability', id, expected: current} as FusionAction}];
  })) as Record<AbilityId, {level: AbilityLevel; nextPrice: number | null; enabled: boolean; reason?: string;
    hasTarget: boolean; currentEffect: string; nextEffect: string; action: FusionAction}>;
  const cost = Math.round(sortingRules.baseCost * (1 - progression.abilities.tape * .1));
  const kind = sorting.phase === 'observed' ? 'survey' : sorting.phase === 'surveyed' ? 'build'
    : sorting.phase === 'ready' ? 'work' : sorting.phase === 'cleared' ? 'review' : 'survey';
  const actionable = ['observed', 'surveyed', 'ready', 'cleared'].includes(sorting.phase);
  const price = kind === 'build' && !sorting.paidCost ? cost : 0;
  const required = requiredWork(progression);
  const mainAction: RefinementActionView = {action: {type: 'sorting', kind}, label: {survey: '勘测支线', build: '开工', work: '开始作业', review: '免费复核'}[kind],
    price, enabled: actionable && state.game.resources >= price,
    reason: !actionable ? sorting.phase === 'unknown' ? '先核对P03' : '咔哒作业中' : state.game.resources < price ? '零件不足' : undefined};
  const compareAction: RefinementActionView = {action: {type: 'sorting', kind: 'compare'}, label: '对照箱标', price: 0,
    enabled: sorting.phase === 'working' && sorting.stage === 'verify' && progression.abilities.receipt >= 1 && !sorting.compared && hasLabels(progression)};
  const nextStudy = sortingStudies.find(study => !sorting.facts.some(fact => fact.id === `study/${study.id}`));
  const researchAction: RefinementActionView = {action: {type: 'sorting', kind: 'research', target: nextStudy?.id},
    label: nextStudy?.name ?? '免费复核', price: nextStudy ? 90 : 0,
    enabled: sorting.phase === 'cleared' && !sorting.activeStudy && (!nextStudy || state.game.resources >= 90),
    reason: sorting.phase !== 'cleared' ? '先清开支线' : sorting.activeStudy ? '正在观察' : state.game.resources < 90 && nextStudy ? '零件不足' : undefined};
  return {abilities, mainAction, compareAction, researchAction, sorting: {
    phase: sorting.phase, stage: sorting.stage, progress: sorting.phase === 'cleared' ? 1 : Math.min(1, sorting.workDone / required),
    stageProgress: sorting.phase === 'cleared' ? 1 : Math.min(1, sorting.workDone / required), workDone: sorting.workDone, workRequired: required,
    stageStartedAt: sorting.stageStartedAt, paidCost: sorting.paidCost, savedParts: sorting.paidCost ? 2400 - sorting.paidCost : 0,
    sourceFacts: sorting.facts, compared: sorting.compared,
    researchCompleted: sorting.facts.filter(fact => fact.kind === 'study').length, researchActive: sorting.activeStudy,
  }};
}

/** Called only after the domain cloned and advanced the common game state. */
export function reduceProgression(state: FusionSave, action: Extract<FusionAction, {type: 'ability' | 'sorting'}>, now: number): FusionResult {
  const view = refinementView(state);
  const progression = state.progression;
  const sorting = progression.sorting;
  if (action.type === 'ability') {
    const entry = view.abilities[action.id];
    if (!entry.enabled || entry.level !== action.expected || entry.nextPrice === null) return {ok: false, message: entry.reason ?? '研究状态已更新'};
    progression.abilities[action.id] = (entry.level + 1) as AbilityLevel;
    state.game.resources -= entry.nextPrice;
    progression.payments.push({id: `ability/${action.id}/${entry.level + 1}`, amount: entry.nextPrice, at: now});
    advanceProgression(state, state.game);
    return {ok: true, message: '本体有了新能力'};
  }
  if (action.kind === 'compare') {
    if (!view.compareAction.enabled || !compareLabels(progression, now)) return {ok: false, message: '等待实际箱标'};
    advanceProgression(state, state.game);
    return {ok: true, message: 'P03和P30已实际对照'};
  }
  if (action.kind === 'research') {
    if (!view.researchAction.enabled) return {ok: false, message: view.researchAction.reason};
    const next = sortingStudies.find(study => !sorting.facts.some(fact => fact.id === `study/${study.id}`));
    if (!next) return {ok: true, message: '记录已齐，免费复核'};
    if (action.target !== next.id) return {ok: false, message: '观察目标已更新'};
    sorting.studySeq++;
    sorting.activeStudy = {id: next.id, seq: sorting.studySeq, startedAt: now, workDone: 0};
    sorting.researchPaid += 90; state.game.resources -= 90;
    return {ok: true, message: '定向观察已开始'};
  }
  if (action.kind === 'cancel-research') {
    const active = sorting.activeStudy;
    if (!active || action.expected !== active.seq) return {ok: false, message: '观察状态已更新'};
    const refund = Math.floor(90 * Math.max(0, 1 - active.workDone / sortingRules.researchWork));
    state.game.resources += refund; sorting.researchRefunded += refund; sorting.activeStudy = null;
    return {ok: true, message: `已取消，退回${refund}零件`};
  }
  if (action.kind === 'review') return {ok: sorting.phase === 'cleared', message: '读取已完成的实际记录'};
  if (!view.mainAction.enabled || action.kind !== (view.mainAction.action as Extract<FusionAction, {type: 'sorting'}>).kind) {
    return {ok: false, message: view.mainAction.reason ?? '作业状态已更新'};
  }
  sorting.workDone = 0; sorting.stageStartedAt = now;
  if (action.kind === 'survey') sorting.phase = 'surveying';
  if (action.kind === 'build') {
    if (!sorting.paidCost) {
      sorting.paidCost = view.mainAction.price; sorting.buildTapeLevel = progression.abilities.tape;
      state.game.resources -= sorting.paidCost;
      progression.payments.push({id: 'sorting/build', amount: sorting.paidCost, at: now});
    }
    sorting.phase = 'building';
  }
  if (action.kind === 'work') {sorting.phase = 'working'; sorting.stage = 'hauling';}
  return {ok: true};
}
