/** Read-only D1 research. A batch contains local specimen records, independent of the player save. */
export type ReceiptResearchLevel = 0 | 1 | 2 | 3;
export type ReceiptStep = 'arrived' | 'checked' | 'signed';
export const RECEIPT_EXPERIMENT_SECONDS = 3.8;

export const RECEIPT_RESEARCH_LEVELS = [
  {level: 0, name: '回应好奇心', action: '请收据回应', description: '展开卷边，打印这次收到的好奇心。'},
  {level: 1, name: '折读第一层', action: '读第一折', description: '读出藏在第一道折痕中的一件事项。'},
  {level: 2, name: '展开内夹层', action: '展开内页', description: '读出三件事项及其本地地址。'},
  {level: 3, name: '核对未发生', action: '核对这叠回执', description: '核对到站、核验和签收记录，留下真正缺失的下一步。'},
] as const;

export const RECEIPT_STEP_LABELS: Record<ReceiptStep, string> = {
  arrived: '待到站', checked: '待核验', signed: '待签收',
};
const STEPS: ReceiptStep[] = ['arrived', 'checked', 'signed'];
export type ReceiptSlip = {id: string; title: string; address: string; paperTitle?:string};
export type ReceiptRecord = {id: string; slipId: string; step: ReceiptStep};
export type ReceiptBatch = {
  id: string;
  label: string;
  slips: readonly ReceiptSlip[];
  records: readonly ReceiptRecord[];
};

const slips: ReceiptSlip[] = [
  {id: 'silent-bell', title: '未响的门铃', paperTitle:'未响门铃', address: '收件站·东柜03'},
  {id: 'yesterday-apology', title: '寄给昨天的道歉', paperTitle:'昨日道歉', address: '管道口·转运箱02'},
  {id: 'late-signature', title: '迟到的签收', paperTitle:'迟到签收', address: '收件站·回执槽01'},
];
const recordsA: ReceiptRecord[] = [
  {id: 'bell-arrived', slipId: 'silent-bell', step: 'arrived'},
  {id: 'bell-checked', slipId: 'silent-bell', step: 'checked'},
  {id: 'apology-arrived', slipId: 'yesterday-apology', step: 'arrived'},
  {id: 'late-arrived', slipId: 'late-signature', step: 'arrived'},
  {id: 'late-checked', slipId: 'late-signature', step: 'checked'},
  {id: 'late-signed', slipId: 'late-signature', step: 'signed'},
];
export const RECEIPT_SAMPLE_BATCHES: Record<'A' | 'B', ReceiptBatch> = {
  A: {id: 'A', label: '样例A · 两件仍有缺失步骤', slips, records: recordsA},
  B: {
    id: 'B', label: '样例B · 补入一笔门铃签收', slips,
    records: [...recordsA, {id: 'bell-signed', slipId: 'silent-bell', step: 'signed'}],
  },
};

export type ReceiptReadLine = {
  id: string;
  title: string;
  paperTitle:string;
  address?: string;
  status: 'unverified' | 'pending' | 'complete';
  nextStep?: ReceiptStep;
  nextStepLabel?: string;
};
export type ReceiptTrace = {
  slipId: string;
  recordIds: string[];
  completedSteps: ReceiptStep[];
  nextStep: ReceiptStep | null;
};
export type ReceiptReading = {
  researchLevel: ReceiptResearchLevel;
  capability: string;
  description: string;
  batchId: string;
  lines: ReceiptReadLine[];
  resultLines: ReceiptReadLine[];
  pendingCount: number | null;
  completedCount: number | null;
  ticketLines: string[];
  trace: ReceiptTrace[];
};

export function resolveReceiptReading(level: number, batch: ReceiptBatch): ReceiptReading {
  const researchLevel = (Number.isFinite(level) ? Math.max(0, Math.min(3, Math.floor(level))) : 0) as ReceiptResearchLevel;
  const capability = RECEIPT_RESEARCH_LEVELS[researchLevel];
  const uniqueSlips = [...new Map(batch.slips.map(slip => [slip.id, slip])).values()];
  const uniqueRecords = [...new Map(batch.records.map(record => [`${record.slipId}/${record.step}`, record])).values()];
  const trace: ReceiptTrace[] = researchLevel === 3 ? uniqueSlips.map(slip => {
    const matches = uniqueRecords.filter(record => record.slipId === slip.id);
    const recorded = new Set(matches.map(record => record.step));
    return {
      slipId: slip.id,
      recordIds: matches.map(record => record.id).sort(),
      completedSteps: STEPS.filter(step => recorded.has(step)),
      nextStep: STEPS.find(step => !recorded.has(step)) ?? null,
    };
  }) : [];
  const readable = researchLevel === 0 ? [] : researchLevel === 1 ? uniqueSlips.slice(0, 1) : uniqueSlips;
  const lines: ReceiptReadLine[] = readable.map(slip => {
    const checked = trace.find(item => item.slipId === slip.id);
    const nextStep = checked?.nextStep ?? undefined;
    return {
      id: slip.id,
      title: slip.title,
      paperTitle:slip.paperTitle??slip.title,
      ...(researchLevel >= 2 ? {address: slip.address} : {}),
      status: checked ? checked.nextStep ? 'pending' : 'complete' : 'unverified',
      ...(nextStep ? {nextStep, nextStepLabel: RECEIPT_STEP_LABELS[nextStep]} : {}),
    };
  });
  const resultLines = researchLevel === 3 ? lines.filter(line => line.status === 'pending') : lines;
  const pendingCount = researchLevel === 3 ? resultLines.length : null;
  const completedCount = researchLevel === 3 ? lines.length - resultLines.length : null;
  const ticketLines = researchLevel === 0 ? ['已收到好奇心', '欢迎再次光临']
    : researchLevel === 3 ? [`未发生 ${pendingCount} 项`, `已核对 ${lines.length} 项`]
    : [`已读出 ${lines.length} 项`, researchLevel === 1 ? '第一折已展开' : '本地地址已显影'];
  return {
    researchLevel, capability: capability.name, description: capability.description,
    batchId: batch.id, lines, resultLines, pendingCount, completedCount, ticketLines, trace,
  };
}

export type ReceiptExperimentPhase = 'opening' | 'reading' | 'checking' | 'printing' | 'closing' | 'done';
export type ReceiptExperimentFrame = {
  reading: ReceiptReading;
  seconds: number;
  phase: ReceiptExperimentPhase;
  open: number;
  reveal: number;
  check: number;
  stamp: number;
  ticket: number;
  visibleLines: ReceiptReadLine[];
  foldedLineIds: string[];
  complete: boolean;
};
const clamp = (value: number) => Math.max(0, Math.min(1, value));
function smooth(value: number) {
  const p = clamp(value);
  return p * p * (3 - 2 * p);
}

export function receiptExperimentFrame(reading: ReceiptReading, elapsedSeconds: number): ReceiptExperimentFrame {
  const seconds = Math.max(0, Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0);
  const phase: ReceiptExperimentPhase = seconds < .65 ? 'opening'
    : seconds < 1.65 ? 'reading' : seconds < 2.4 ? 'checking'
    : seconds < 3.05 ? 'printing' : seconds < RECEIPT_EXPERIMENT_SECONDS ? 'closing' : 'done';
  const opening = smooth(seconds / .65);
  const closing = smooth((RECEIPT_EXPERIMENT_SECONDS - seconds) / .75);
  const maximumOpen = [.30, .55, 1, 1][reading.researchLevel];
  const open = maximumOpen * Math.min(opening, closing);
  const reveal = smooth((seconds - .65) / 1);
  const check = smooth((seconds - 1.65) / .75);
  const foldedLineIds = reading.researchLevel === 3 && check >= .6
    ? reading.lines.filter(line => line.status === 'complete').map(line => line.id) : [];
  const visibleLines = check >= .6 ? reading.resultLines : reading.lines.slice(0, Math.ceil(reveal * reading.lines.length));
  return {
    reading, seconds, phase, open, reveal, check,
    stamp: smooth((seconds - 2.05) / .3), ticket: smooth((seconds - 2.4) / .55),
    visibleLines, foldedLineIds, complete: phase === 'done',
  };
}
