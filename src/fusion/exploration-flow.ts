import type {FusionAction, FusionSave} from './contracts';
import {refinementView} from './progression';
import {receiptRestorationMainAction} from '../review/receipt-restoration';
import {worldView} from '../game/world';
import {fusionNightSnapshot} from './runtime-night';

export const aCurioIds = ['receipt', 'tape', 'nested', 'stamp', 'cosmic-parcel', 'bell'] as const;
export interface ExplorationClue {id: string; text: string}
export interface ExplorationStep {id: 'day' | 'dusk' | 'night' | 'dawn'; label: string; current: boolean; reached: boolean}
export interface ExplorationFlowAction {label: string; detail?: string; command?: FusionAction; price: number; enabled: boolean; reason?: string}

/** Presentation only: project durable facts; never grant a discovery or change a ledger. */
export function explorationFlowView(state: FusionSave) {
  const game = state.game;
  const world = worldView(game);
  const sorting = refinementView(state);
  const clues: ExplorationClue[] = [];
  if (state.receipt.evidenceIds.includes('field-pipe-scan')) clues.push({id: 'pipe', text: '管道边的箱标是P03。'});
  if (state.receipt.evidenceIds.includes('field-warehouse-arrival')) clues.push({id: 'warehouse', text: '夜里，同号纸影走进了收件站。'});
  for (const fact of sorting.sorting.sourceFacts) clues.push({id: fact.id, text: fact.detail});
  const condition = (id: string) => id === 'receipt' ? state.receipt.condition : state.curios[id]?.condition;
  const foundCurios = aCurioIds.filter(id => game.collection.includes(id));
  const waitingCurio = foundCurios.find(id => condition(id) !== 'stabilized' || id === 'receipt' && state.receipt.stage === 'buried');
  const settledCurios = foundCurios.filter(id => condition(id) === 'stabilized' && (id !== 'receipt' || state.receipt.stage === 'displayed')).length;
  const night = fusionNightSnapshot(game);
  const report = game.world.lastReport;
  const previousNight = report ? {number: report.number, visitors: report.result?.actors.length ?? (typeof report.arrived === 'number' ? report.intercepted + report.arrived : null),
    returned: report.result?.safeReturned ?? null, clues: report.clues,
    maintenance: game.station.lastNight?.number === report.number ? game.station.lastNight.spent : 0,
    visitorIds: report.result?.actors.map(actor => actor.id) ?? [], detail: report.summary} : null;
  const nightLines: Record<string, string> = {patrol: '箱堆传来动静', appear: '灯下出现纸影', track: '纸影正在找路', identify: '咔哒看清了纸上的字', contain: '把迷路的纸影安顿好', result: '灯下留下了新记录', return: '咔哒带着发现回来了'};
  const nightLabel = nightLines[night.phase] ?? '灯下有了新动静';
  const nightGuest = world.period !== 'night' || night.sourceModelMs < 4200 ? null : night.sourceModelMs < 22200 ? 0 : night.sourceModelMs < 40200 ? 1 : 2;
  const periodLabels = {day: '白天探索', dusk: '黄昏来信', night: '夜间发现', dawn: '清晨回看'};
  const kind = world.period === 'night' ? 'night' : world.period === 'dusk' ? 'dusk' : game.pendingReturn ? 'return'
    : world.period === 'dawn' ? 'dawn' : waitingCurio ? 'curio' : 'day';
  const eventTitle = kind === 'return' ? '飞船带回了发现' : kind === 'dusk' ? '灯亮了，听听夜里的动静'
    : kind === 'night' ? nightLabel : kind === 'dawn' ? '昨夜的发现，留给你看'
      : kind === 'curio' ? '有件失物，等你安顿' : '咔哒又听见一点回声';
  let action: ExplorationFlowAction | null = null;
  if (game.pendingReturn) action = {label: '收下发现', command: {type: 'claim'}, price: 0, enabled: true};
  else if (world.phase !== 'night') {
    if (waitingCurio) action = {label: '整理一下', detail: waitingCurio, price: 0, enabled: true};
    else if (sorting.compareAction.enabled) action = {...sorting.compareAction, command: sorting.compareAction.action, label: '用收据核对箱标'};
    else if (['observed', 'surveyed', 'ready'].includes(sorting.sorting.phase)) action = {...sorting.mainAction, command: sorting.mainAction.action, label: sorting.sorting.phase === 'observed' ? '听清纸路的回声' : sorting.sorting.phase === 'surveyed' ? '接通这段纸路' : '帮咔哒挪开箱堆'};
    else if (game.collection.includes('receipt') && receiptRestorationMainAction(state.receipt).kind === 'identify' && state.receipt.evidenceIds.some(id=>!state.receipt.verifiedEvidenceIds.includes(id))) action = {label: '核对已有线索', command: {type: 'paper', kind: 'identify'}, price: 0, enabled: !state.receipt.activeAction};
  }
  const activeWork = ['surveying', 'building', 'working'].includes(sorting.sorting.phase) || !!sorting.sorting.researchActive;
  const currentNote = kind === 'return' ? '你不在的时候，咔哒也好好探索了。' : kind === 'night' ? '咔哒、飞船和灯架正在一起辨认访客。'
    : kind === 'dusk' ? '天色慢慢暗下来，收件站给迷路的东西留一盏灯。' : kind === 'dawn'
      ? previousNight ? previousNight.visitors===null ? '昨夜的发现，已经收进手记。' : `昨夜遇见${previousNight.visitors}位访客，记录已经收好。` : '天亮了，咔哒继续找新的失物。'
      : kind === 'curio' ? '先看一眼，再清理好，放进自己的收藏。' : activeWork ? '咔哒正在沿着实际纸路继续调查。' : '自动探索还在继续，不必一直点。';
  const periodIndex = ['day', 'dusk', 'night', 'dawn'].indexOf(world.period);
  return {kind, nightGuest, period: world.period, eventTitle, currentNote, action, clues, previousNight, waitingCurio,
    foundCurios: foundCurios.length, settledCurios, activeWork,
    objective: sorting.sorting.phase === 'cleared' && sorting.sorting.researchCompleted === 3 ? '留意：今晚灯下会来谁？' : '调查：旧分拣站为什么夜里会自己开工？',
    objectiveNote: clues.length ? `已留存${clues.length}条现场线索` : '先听听箱堆里的回声',
    expectation: foundCurios.length < aCurioIds.length ? '下一件失物，还藏在星球的某个角落。'
      : settledCurios < foundCurios.length ? '发现都到了，慢慢把它们安顿好。' : '失物都有了位置，今晚灯下还会有小动静。',
    steps: (['day', 'dusk', 'night', 'dawn'] as const).map((id, index): ExplorationStep => ({id, label: periodLabels[id], current: id === world.period,
      reached: index <= periodIndex})),
  };
}
