import {discoveries} from '../content/catalog';
import {type SaveData} from '../game/engine';
import {planCatalog, startPlan} from '../game/station';

/** Candidate prices for the isolated week-one forecast, pending user review. */
export const restorationPrices = {
  receipt: {clean: 40, stabilize: 120},
  tape: {clean: 20, stabilize: 80},
  nested: {clean: 50, stabilize: 180},
  stamp: {clean: 60, stabilize: 160},
  'cosmic-parcel': {clean: 40, stabilize: 220},
  bell: {clean: 30, stabilize: 140},
} as const;
export type RestorationId = keyof typeof restorationPrices;
export type ArtifactCondition = 'found' | 'clean' | 'stabilized';
export interface RestorationLedger {
  conditions: Partial<Record<RestorationId, ArtifactCondition>>;
  cleaning: number;
  stabilization: number;
  transactions: string[];
}

/** Existing owned artifacts retain their settled condition and paid display rights. */
export function legacyRestorationLedger(owned: readonly string[]): RestorationLedger {
  return {
    conditions: Object.fromEntries(Object.keys(restorationPrices)
      .filter(id => owned.includes(id)).map(id => [id, 'stabilized'])),
    cleaning: 0,
    stabilization: 0,
    transactions: [],
  };
}

export function purchaseRestoration(
  save: SaveData,
  ledger: RestorationLedger,
  id: RestorationId,
  expected: ArtifactCondition,
) {
  const unchanged = {save, ledger};
  if (!Object.hasOwn(restorationPrices, id) || !save.collection.includes(id)) return unchanged;
  const condition = ledger.conditions[id] ?? 'found';
  if (condition !== expected || condition === 'stabilized') return unchanged;
  const action = condition === 'found' ? 'clean' : 'stabilize';
  const transaction = `${id}/${action}`;
  const price = restorationPrices[id][action];
  if (ledger.transactions.includes(transaction) || save.resources < price) return unchanged;
  return {
    save: {...save, resources: save.resources - price},
    ledger: {
      conditions: {...ledger.conditions, [id]: action === 'clean' ? 'clean' : 'stabilized'},
      cleaning: ledger.cleaning + (action === 'clean' ? price : 0),
      stabilization: ledger.stabilization + (action === 'stabilize' ? price : 0),
      transactions: [...ledger.transactions, transaction],
    } as RestorationLedger,
  };
}

export const studyCandidates = [
  {id: 'field', title: '退件平原现场复核', price: 180, minutes: 5, boost: .10,
    result: '任务期间探索与地表采样加快10%，记录实际采样次数。'},
  {id: 'study', title: '奇物折层对照', price: 900, minutes: 15, boost: .25,
    result: '已有奇物提供观察对象，任务期间探索与采样加快25%。'},
  {id: 'deep', title: '平原联合测绘', price: 2400, minutes: 30, boost: .40,
    result: '任务期间探索与采样加快40%，保留复核记录和实际进度。'},
] as const;
export type CandidateStudyId = typeof studyCandidates[number]['id'];

/** Reprice an existing real-engine task only inside the isolated economic forecast. */
export function startCandidateStudy(save: SaveData, id: CandidateStudyId, expected: string | null) {
  const candidate = studyCandidates.find(project => project.id === id);
  const original = planCatalog.find(project => project.id === id);
  if (!candidate || !original || save.resources < candidate.price ||
    (save.research.active?.id ?? null) !== expected || save.research.active) return save;
  const funding = {...save, resources: save.resources - candidate.price + original.cost};
  const started = startPlan(funding, id, 'artifact', expected);
  if (started === funding) return save;
  return {...started, research: {...started.research, spent: save.research.spent + candidate.price}};
}

export function researchAvailability(save: SaveData) {
  const owned = new Set([...save.collection, ...(save.pendingReturn?.discoveries ?? [])]);
  const records = discoveries.filter(record => owned.has(record.id));
  return {
    observedRecords: records.length,
    undiscoveredRecords: discoveries.length - records.length,
    mode: records.length === discoveries.length ? '复核与增效' : '本地调查与复核',
    output: records.length === discoveries.length
      ? '首星已收齐，任务提供采样增效和观察记录。'
      : '调查推进首星实际探索，发现仍按真实里程碑产生。',
  };
}
