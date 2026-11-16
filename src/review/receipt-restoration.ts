import {restorationPrices} from './v034-budget';

/** All state here belongs to the isolated V0.3.4 review session. */
export const RECEIPT_ORIGINAL = Object.freeze({
  artifactCode: 'RET-031',
  boxCode: 'P03',
  signature: null,
  printedLines: ['RET-031', '箱标 P03', '签收 __________'] as readonly string[],
});

export const RECEIPT_EVIDENCE_SOURCE = 'parcel/returns-plain/night-review';
export const RESTORATION_DURATIONS = {
  excavate: 6.2,
  clean: 3.8,
  repair: 3.9,
  identify: 2.6,
  try: 2.4,
} as const;

export type ReceiptRestorationKind = keyof typeof RESTORATION_DURATIONS;
export type ReceiptCondition = 'found' | 'clean' | 'stabilized';
export type ReceiptSceneObservation = {
  actionId: string;
  evidenceId: string;
  observedAtSeconds: number;
  source: string;
  metadata: {
    artifactCode?: string;
    boxCode?: string;
    nodeId?: string;
    eventKind?: string;
    [key: string]: unknown;
  };
};

export type ReceiptRestorationAction = {
  id: string;
  kind: ReceiptRestorationKind;
  startedAtSeconds: number;
  durationSeconds: number;
  evidenceSnapshot: readonly string[];
};

export type ReceiptRestorationState = {
  specimenId: 'receipt/RET-031';
  stage: 'buried' | 'displayed';
  condition: ReceiptCondition;
  parts: number;
  caseTier: number;
  evidenceIds: readonly string[];
  observations: readonly ReceiptSceneObservation[];
  verifiedEvidenceIds: readonly string[];
  completedActionIds: readonly string[];
  transactions: readonly {actionId: string; kind: 'clean' | 'repair'; amount: number}[];
  activeAction?: ReceiptRestorationAction;
};

const SOURCE_EVIDENCE_IDS = ['field-pipe-scan', 'field-box-stack-scan'];
const EVIDENCE_SITES: Readonly<Record<string, {nodeId: string; eventKind: string}>> = {
  'field-pipe-scan': {nodeId: 'pipe-marker-p03', eventKind: 'marker-scan'},
  'field-box-stack-scan': {nodeId: 'box-stack-marker-p03', eventKind: 'marker-scan'},
  'field-warehouse-arrival': {nodeId: 'receiving-warehouse', eventKind: 'warehouse-arrival'},
};
const clamp = (value: number) => Math.max(0, Math.min(1, value));

function finiteNonnegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function smooth(value: number) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

function actionCost(kind: ReceiptRestorationKind) {
  if (kind === 'clean') return restorationPrices.receipt.clean;
  if (kind === 'repair') return restorationPrices.receipt.stabilize;
  return 0;
}

export function createReceiptRestorationState(parts = 120, caseTier = 0): ReceiptRestorationState {
  return {
    specimenId: 'receipt/RET-031',
    stage: 'buried',
    condition: 'found',
    parts: Math.floor(finiteNonnegative(parts)),
    caseTier: Math.min(3, Math.floor(finiteNonnegative(caseTier))),
    evidenceIds: [],
    observations: [],
    verifiedEvidenceIds: [],
    completedActionIds: [],
    transactions: [],
  };
}

function available(state: ReceiptRestorationState, kind: ReceiptRestorationKind) {
  if (kind === 'excavate') return state.stage === 'buried';
  if (state.stage !== 'displayed') return false;
  if (kind === 'clean') return state.condition === 'found';
  if (kind === 'repair') return state.condition === 'clean';
  if (kind === 'identify') return state.condition === 'stabilized';
  return true;
}

export type ReceiptRestorationStart = {
  state: ReceiptRestorationState;
  accepted: boolean;
  reason?: 'duplicate' | 'busy' | 'unavailable' | 'insufficient-parts' | 'invalid-action';
};

export function beginReceiptRestoration(
  previous: ReceiptRestorationState,
  kind: ReceiptRestorationKind,
  actionId: string,
  seconds: number,
): ReceiptRestorationStart {
  const state = advanceReceiptRestoration(previous, seconds);
  if (!Object.hasOwn(RESTORATION_DURATIONS, kind) || !actionId.trim()) {
    return {state, accepted: false, reason: 'invalid-action'};
  }
  if (state.completedActionIds.includes(actionId) || state.activeAction?.id === actionId) {
    return {state, accepted: false, reason: 'duplicate'};
  }
  if (state.activeAction) return {state, accepted: false, reason: 'busy'};
  if (!available(state, kind)) return {state, accepted: false, reason: 'unavailable'};
  const cost = actionCost(kind);
  if (state.parts < cost) return {state, accepted: false, reason: 'insufficient-parts'};
  const transactions = kind === 'clean' || kind === 'repair'
    ? [...state.transactions, {actionId, kind, amount: cost}]
    : state.transactions;
  return {
    accepted: true,
    state: {
      ...state,
      parts: state.parts - cost,
      transactions,
      activeAction: {
        id: actionId,
        kind,
        startedAtSeconds: finiteNonnegative(seconds),
        durationSeconds: RESTORATION_DURATIONS[kind],
        evidenceSnapshot: kind === 'identify' ? [...state.evidenceIds] : [],
      },
    },
  };
}

export function advanceReceiptRestoration(
  state: ReceiptRestorationState,
  seconds: number,
): ReceiptRestorationState {
  const action = state.activeAction;
  if (!action || finiteNonnegative(seconds) < action.startedAtSeconds + action.durationSeconds) return state;
  let stage = state.stage;
  let condition = state.condition;
  let verifiedEvidenceIds = state.verifiedEvidenceIds;
  if (action.kind === 'excavate') stage = 'displayed';
  if (action.kind === 'clean') condition = 'clean';
  if (action.kind === 'repair') condition = 'stabilized';
  if (action.kind === 'identify') {
    verifiedEvidenceIds = [...new Set([...verifiedEvidenceIds, ...action.evidenceSnapshot])];
  }
  return {
    ...state,
    stage,
    condition,
    verifiedEvidenceIds,
    completedActionIds: [...state.completedActionIds, action.id],
    activeAction: undefined,
  };
}

function matchesOriginal(event: ReceiptSceneObservation) {
  return Boolean(event.actionId.trim())
    && Number.isFinite(event.observedAtSeconds)
    && event.observedAtSeconds >= 0
    && event.source === RECEIPT_EVIDENCE_SOURCE
    && event.metadata.artifactCode === RECEIPT_ORIGINAL.artifactCode
    && event.metadata.boxCode === RECEIPT_ORIGINAL.boxCode;
}

export function observeReceiptEvidence(
  state: ReceiptRestorationState,
  event: ReceiptSceneObservation,
): ReceiptRestorationState {
  if (state.observations.some(observation => observation.actionId === event.actionId)) return state;
  if (!matchesOriginal(event)) return state;
  if (!Object.hasOwn(EVIDENCE_SITES, event.evidenceId)) return state;
  const site = EVIDENCE_SITES[event.evidenceId];
  if (event.metadata.nodeId !== site.nodeId || event.metadata.eventKind !== site.eventKind) return state;
  return {
    ...state,
    evidenceIds: [...new Set([...state.evidenceIds, event.evidenceId])],
    observations: [...state.observations, {...event, metadata: {...event.metadata}}],
  };
}

export function receiptRestorationReading(state: ReceiptRestorationState) {
  const origin = state.verifiedEvidenceIds.some(id => SOURCE_EVIDENCE_IDS.includes(id));
  const items = [
    {
      id: 'box-origin' as const,
      title: '箱堆来源',
      status: origin ? 'confirmed' as const : 'missing' as const,
      detail: origin ? '现场标记 P03 与原件字码相符' : '前往现场核对 P03',
    },
    {
      id: 'signature' as const,
      title: '签收记录',
      status: 'missing' as const,
      detail: '原件签收栏为空，尚未取得签收证据',
    },
  ];
  return {items, missingCount: items.filter(item => item.status === 'missing').length};
}

export type ReceiptRestorationMainAction = {
  kind: ReceiptRestorationKind | 'visit-field';
  label: string;
  cost: number;
  disabled: boolean;
  reason?: string;
};

export function receiptRestorationMainAction(state: ReceiptRestorationState): ReceiptRestorationMainAction {
  let kind: ReceiptRestorationMainAction['kind'];
  let label: string;
  if (state.stage === 'buried') {
    kind = 'excavate';
    label = '发掘收据';
  } else if (state.condition === 'found') {
    kind = 'clean';
    label = `清洁 ${restorationPrices.receipt.clean} 零件`;
  } else if (state.condition === 'clean') {
    kind = 'repair';
    label = `修补 ${restorationPrices.receipt.stabilize} 零件`;
  } else if (!state.evidenceIds.some(id => SOURCE_EVIDENCE_IDS.includes(id))) {
    kind = 'visit-field';
    label = '前往现场核对 P03';
  } else {
    kind = 'identify';
    label = '辨识现有线索';
  }
  const cost = kind === 'visit-field' ? 0 : actionCost(kind);
  const disabled = Boolean(state.activeAction) || state.parts < cost;
  const reason = state.activeAction ? '操作进行中' : state.parts < cost ? '零件不足，可继续免费查看和试验' : undefined;
  return {kind, label, cost, disabled, reason};
}

export type ReceiptRestorationPhase = 'buried' | 'excavating' | 'found' | 'cleaning'
  | 'clean' | 'repairing' | 'stabilized' | 'identifying' | 'trying';

export function receiptRestorationFrame(state: ReceiptRestorationState, seconds: number) {
  const action = state.activeAction;
  const now = finiteNonnegative(seconds);
  const progress = action ? clamp((now - action.startedAtSeconds) / action.durationSeconds) : 1;
  const current = advanceReceiptRestoration(state, now);
  let phase: ReceiptRestorationPhase = current.stage === 'buried' ? 'buried' : current.condition;
  const running = Boolean(current.activeAction);
  if (running && action) {
    const phases: Record<ReceiptRestorationKind, ReceiptRestorationPhase> = {
      excavate: 'excavating', clean: 'cleaning', repair: 'repairing', identify: 'identifying', try: 'trying',
    };
    phase = phases[action.kind];
  }
  const excavation = current.stage === 'displayed' ? 1
    : action?.kind === 'excavate' ? smooth(progress) : 0;
  const cleaning = current.condition !== 'found' ? 1
    : action?.kind === 'clean' ? smooth(progress) : 0;
  const repairing = current.condition === 'stabilized' ? 1
    : action?.kind === 'repair' ? smooth(progress) : 0;
  return {
    phase,
    seconds: now,
    progress,
    actionId: action?.id,
    excavation,
    cleaning,
    repairing,
    identifying: action?.kind === 'identify' ? progress : 0,
    trying: action?.kind === 'try' ? progress : 0,
    mudRemaining: 1 - cleaning,
    original: RECEIPT_ORIGINAL,
    caseTier: current.caseTier,
    condition: current.condition,
    stage: current.stage,
    reading: receiptRestorationReading(current),
    evidenceIds: current.evidenceIds,
    complete: !running,
  };
}

export type ReceiptRestorationFrame = ReturnType<typeof receiptRestorationFrame>;
