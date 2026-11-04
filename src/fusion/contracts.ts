import type {SaveData, UpgradeId} from '../game/engine';
import type {ReceiptRestorationKind, ReceiptRestorationState} from '../review/receipt-restoration';
import type {NightConfig} from '../prototype/night-model';
import type {StationReceipt} from '../game/station';

export interface FieldRecord {
  id: string;
  target: string;
  at: number;
  source: string;
  detail: string;
  night?: {configuration: NightConfig; receipt: StationReceipt};
}
export interface FusionTask {
  id: string;
  target: 'marker' | 'residents' | 'night';
  startedAt: number;
  endsAt: number;
  price: number;
}
export interface FusionSave {
  version: 1;
  game: SaveData;
  receipt: ReceiptRestorationState;
  projects: string[];
  records: FieldRecord[];
  task: FusionTask | null;
  taskSeq: number;
  importedLegacy: boolean;
  curios: Record<string, {condition: 'found' | 'clean' | 'stabilized'; action?: {kind: 'clean' | 'repair'; startedAt: number; endsAt: number}}>;
}
export type FusionAction =
  | {type: 'tap'}
  | {type: 'upgrade'; id: UpgradeId; expected: number}
  | {type: 'growth'; id: string; expected: number}
  | {type: 'paper'; kind: ReceiptRestorationKind}
  | {type: 'project'; id: string}
  | {type: 'task'; target: FusionTask['target']}
  | {type: 'cancel-task'; id: string}
  | {type: 'auto-repair'; enabled: boolean}
  | {type: 'repair'; expected: number}
  | {type: 'claim'}
  | {type: 'observe'; id: string; at: number; source: string}
  | {type: 'slot'; slot: 0 | 1; enabled: boolean}
  | {type: 'curio'; id: string; kind: 'clean' | 'repair'};
export interface FusionResult {ok: boolean; message?: string}
export interface FusionController {
  state: FusionSave;
  persisted: boolean;
  act(action: FusionAction): Promise<FusionResult>;
  subscribe(listener: () => void): () => void;
}
export const fusionProjects = [
  {id: 'evidence-bench', name: '取证工作台', price: 1800, requires: 'receipt', effect: '切换纸面侧光，对照真实现场'},
  {id: 'habitat-window', name: '居民观察窗', price: 4200, requires: 'mouse', effect: '三处栖台与昼夜观察记录'},
  {id: 'archive', name: '异常归档廊', price: 6000, requires: 'night-shift', effect: '回看真实夜班与设施结果'},
] as const;
export const fusionTargets = [
  {id: 'marker', name: '箱标取证', price: 180, duration: 60000, effect: '勘探加快10%，核对P03现场来源'},
  {id: 'residents', name: '居民观察', price: 240, duration: 90000, effect: '勘探加快10%，观察已发现居民作息'},
  {id: 'night', name: '夜班核对', price: 300, duration: 120000, effect: '勘探加快10%，归档真实夜班与损伤'},
] as const;
