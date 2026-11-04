import {expect, it} from 'vitest';
import {
  RECEIPT_ORIGINAL,
  RESTORATION_DURATIONS,
  advanceReceiptRestoration,
  beginReceiptRestoration,
  createReceiptRestorationState,
  observeReceiptEvidence,
  receiptRestorationFrame,
  receiptRestorationMainAction,
  receiptRestorationReading,
  type ReceiptRestorationState,
  type ReceiptSceneObservation,
} from '../src/review/receipt-restoration';

const sourceScan: ReceiptSceneObservation = {
  actionId: 'night-0/actor-2/pipe-marker-scan',
  evidenceId: 'field-pipe-scan',
  observedAtSeconds: 12.5,
  source: 'parcel/returns-plain/night-review',
  metadata: {
    artifactCode: 'RET-031',
    boxCode: 'P03',
    nodeId: 'pipe-marker-p03',
    eventKind: 'marker-scan',
  },
};

function complete(
  state: ReceiptRestorationState,
  kind: 'excavate' | 'clean' | 'repair' | 'identify' | 'try',
  at: number,
) {
  const result = beginReceiptRestoration(state, kind, `${kind}/${at}`, at);
  expect(result.accepted).toBe(true);
  return advanceReceiptRestoration(result.state, at + RESTORATION_DURATIONS[kind]);
}

function stabilized(parts = 360) {
  let state = createReceiptRestorationState(parts, 0);
  state = complete(state, 'excavate', 0);
  state = complete(state, 'clean', 5);
  return complete(state, 'repair', 10);
}

it('发掘免费运行4.5秒，真实泥层保留在已找到的原件上', () => {
  const original = createReceiptRestorationState(360, 3);
  const started = beginReceiptRestoration(original, 'excavate', 'dig-1', 10);
  expect(original.stage).toBe('buried');
  expect(started.accepted).toBe(true);
  expect(started.state.parts).toBe(360);
  expect(receiptRestorationFrame(started.state, 10).phase).toBe('excavating');
  const middle = receiptRestorationFrame(started.state, 12.2);
  expect(middle.excavation).toBeGreaterThan(0);
  expect(middle.excavation).toBeLessThan(1);
  expect(middle.mudRemaining).toBe(1);
  const found = advanceReceiptRestoration(started.state, 14.5);
  expect(found.stage).toBe('displayed');
  expect(found.condition).toBe('found');
  expect(found.caseTier).toBe(3);
  expect(found.parts).toBe(360);
  expect(receiptRestorationFrame(found, 14.5).mudRemaining).toBe(1);
});

it('清洁40和修补120各支付一次，重试和后台补算不重复扣款', () => {
  const state = stabilized(360);
  expect(state.parts).toBe(200);
  expect(state.condition).toBe('stabilized');
  expect(state.transactions.map(item => item.amount)).toEqual([40, 120]);
  for (const kind of ['clean', 'repair'] as const) {
    const duplicate = beginReceiptRestoration(state, kind, `new-${kind}`, 50);
    expect(duplicate.accepted).toBe(false);
    expect(duplicate.state.parts).toBe(200);
  }
  expect(advanceReceiptRestoration(state, 36000)).toEqual(state);
  expect(state.evidenceIds).toEqual([]);
  expect(receiptRestorationReading(state).missingCount).toBe(2);
});

it('重复actionId、忙碌和不足余额均不再次扣费，免费试验仍可进行', () => {
  let state = complete(createReceiptRestorationState(40), 'excavate', 0);
  const cleaning = beginReceiptRestoration(state, 'clean', 'clean-unique', 5);
  expect(cleaning.state.parts).toBe(0);
  expect(beginReceiptRestoration(cleaning.state, 'clean', 'clean-unique', 5.2).reason).toBe('duplicate');
  expect(beginReceiptRestoration(cleaning.state, 'try', 'try-busy', 5.2).reason).toBe('busy');
  state = advanceReceiptRestoration(cleaning.state, 9);
  const cannotRepair = beginReceiptRestoration(state, 'repair', 'repair-low', 10);
  expect(cannotRepair.reason).toBe('insufficient-parts');
  expect(cannotRepair.state.parts).toBe(0);
  const tried = complete(state, 'try', 11);
  expect(tried.parts).toBe(0);
  expect(tried.condition).toBe('clean');
  expect(tried.evidenceIds).toEqual([]);
});

it('操作顺序与展示等级独立，不允许泥上修补或地下清洁', () => {
  const buried = createReceiptRestorationState(360, 2);
  expect(beginReceiptRestoration(buried, 'clean', 'clean', 0).reason).toBe('unavailable');
  const found = complete(buried, 'excavate', 0);
  expect(beginReceiptRestoration(found, 'repair', 'repair', 5).reason).toBe('unavailable');
  expect(beginReceiptRestoration(found, 'identify', 'identify', 5).reason).toBe('unavailable');
  const state = complete(complete(found, 'clean', 5), 'repair', 10);
  expect(state.caseTier).toBe(2);
  expect(state.condition).toBe('stabilized');
});

it('原始字码在出土前就存在，清洁和修补不会创建新字码或补齐签收', () => {
  const initial = createReceiptRestorationState(360);
  const final = stabilized(360);
  for (const state of [initial, final]) {
    const frame = receiptRestorationFrame(state, 20);
    expect(frame.original).toBe(RECEIPT_ORIGINAL);
    expect(frame.original.artifactCode).toBe('RET-031');
    expect(frame.original.boxCode).toBe('P03');
    expect(frame.original.signature).toBeNull();
  }
  expect(receiptRestorationFrame(initial, 0).cleaning).toBe(0);
  expect(receiptRestorationFrame(final, 20).cleaning).toBe(1);
  expect(receiptRestorationFrame(final, 20).repairing).toBe(1);
  expect(final.verifiedEvidenceIds).toEqual([]);
});

it('真实P03现场扫描先收录来源，免费辨识后缺失两项变一项', () => {
  const state = stabilized();
  const observed = observeReceiptEvidence(state, sourceScan);
  expect(observed.evidenceIds).toEqual(['field-pipe-scan']);
  expect(observed.observations[0]).toEqual(sourceScan);
  expect(receiptRestorationReading(observed).missingCount).toBe(2);
  const identified = complete(observed, 'identify', 20);
  const reading = receiptRestorationReading(identified);
  expect(reading.missingCount).toBe(1);
  expect(reading.items.find(item => item.id === 'box-origin')?.status).toBe('confirmed');
  expect(reading.items.find(item => item.id === 'signature')?.status).toBe('missing');
  expect(identified.parts).toBe(200);
});

it('现场事件按actionId去重，重复扫描不会增加确认项或奖励', () => {
  const observed = observeReceiptEvidence(stabilized(), sourceScan);
  const duplicate = observeReceiptEvidence(observed, sourceScan);
  expect(duplicate).toBe(observed);
  const secondScan = observeReceiptEvidence(observed, {...sourceScan, actionId: 'night-1/pipe-scan'});
  expect(secondScan.evidenceIds).toHaveLength(1);
  expect(secondScan.observations).toHaveLength(2);
  const identified = complete(secondScan, 'identify', 20);
  const repeated = complete(identified, 'identify', 24);
  expect(receiptRestorationReading(repeated).missingCount).toBe(1);
  expect(repeated.parts).toBe(identified.parts);
  expect(repeated.transactions).toEqual(identified.transactions);
});

it('错误P03、无关现场和伪造签收事件不能成为原件证据', () => {
  const state = stabilized();
  const invalid = [
    {...sourceScan, source: 'unrelated/source'},
    {...sourceScan, metadata: {...sourceScan.metadata, boxCode: 'P04'}},
    {...sourceScan, metadata: {...sourceScan.metadata, artifactCode: 'RET-999'}},
    {...sourceScan, evidenceId: 'receipt-signed'},
    {...sourceScan, actionId: ''},
    {...sourceScan, observedAtSeconds: Infinity},
  ];
  for (const event of invalid) {
    expect(observeReceiptEvidence(state, event)).toBe(state);
  }
});

it('真实抵站记录只证明运输，不冒充签收或来源标记扫描', () => {
  const arrival: ReceiptSceneObservation = {
    ...sourceScan,
    evidenceId: 'field-warehouse-arrival',
    actionId: 'night-0/actor-2/warehouse-arrival',
    metadata: {...sourceScan.metadata, nodeId: 'receiving-warehouse', eventKind: 'warehouse-arrival'},
  };
  const observed = observeReceiptEvidence(stabilized(), arrival);
  expect(observed.observations).toHaveLength(1);
  const final = complete(observed, 'identify', 20);
  expect(receiptRestorationReading(final).missingCount).toBe(2);
});

it('辨识只核验本次开始前的证据，扫描中新到的线索需再次核验', () => {
  const started = beginReceiptRestoration(stabilized(), 'identify', 'identify-1', 20);
  const arrived = observeReceiptEvidence(started.state, sourceScan);
  const first = advanceReceiptRestoration(arrived, 22.6);
  expect(receiptRestorationReading(first).missingCount).toBe(2);
  const second = complete(first, 'identify', 23);
  expect(receiptRestorationReading(second).missingCount).toBe(1);
});

it('主操作随实物状态推进，缺少来源时要求回到真实现场', () => {
  let state = createReceiptRestorationState(360);
  expect(receiptRestorationMainAction(state).kind).toBe('excavate');
  state = complete(state, 'excavate', 0);
  expect(receiptRestorationMainAction(state)).toMatchObject({kind: 'clean', cost: 40});
  state = complete(state, 'clean', 5);
  expect(receiptRestorationMainAction(state)).toMatchObject({kind: 'repair', cost: 120});
  state = complete(state, 'repair', 10);
  expect(receiptRestorationMainAction(state)).toMatchObject({kind: 'visit-field', cost: 0});
  expect(receiptRestorationMainAction(observeReceiptEvidence(state, sourceScan)).kind).toBe('identify');
});

it('有限时间归一化且状态单调，重复试验不改变钱、实物或证据', () => {
  const original = stabilized();
  const before = JSON.stringify(original);
  const started = beginReceiptRestoration(original, 'try', 'try-1', 20);
  expect(receiptRestorationFrame(started.state, -20).progress).toBe(0);
  expect(receiptRestorationFrame(started.state, NaN).progress).toBe(0);
  const after = advanceReceiptRestoration(started.state, 100);
  expect(after.condition).toBe(original.condition);
  expect(after.parts).toBe(original.parts);
  expect(after.evidenceIds).toEqual(original.evidenceIds);
  expect(JSON.stringify(original)).toBe(before);
  for (const parts of [NaN, Infinity, -10]) {
    expect(createReceiptRestorationState(parts).parts).toBe(0);
  }
  expect(createReceiptRestorationState(27_049, Infinity).caseTier).toBe(0);
});

import {receiptRestorationGeometry, restorationBrushPasses, restorationPaperRig, restorationRepairStages} from '../src/render/receipt-restoration';

it('出土沿托盘抬升到原展品中心，前土遮挡随同一进度退去', () => {
  const center = {x: 175, y: 445.926829};
  const frame = 66.926829;
  const state = createReceiptRestorationState(360);
  const action = beginReceiptRestoration(state, 'excavate', 'excavation', 0).state;
  const buried = receiptRestorationGeometry(receiptRestorationFrame(state, 0), center, frame, 505);
  const middle = receiptRestorationGeometry(receiptRestorationFrame(action, 2), center, frame, 505);
  const found = receiptRestorationGeometry(receiptRestorationFrame(action, 4.5), center, frame, 505);
  expect(buried.paperCenter.y).toBeGreaterThan(middle.paperCenter.y);
  expect(middle.paperCenter.y).toBeGreaterThan(found.paperCenter.y);
  expect(found.paperCenter).toEqual(center);
  expect(found.paperBounds.height).toBeCloseTo(frame);
  expect(middle.soilOpacity).toBeGreaterThanOrEqual(found.soilOpacity);
  expect(found.soilOpacity).toBe(0);
});

it('刷尘路径覆盖既有泥层，进度单调且路径不会跨越纸面外框', () => {
  const first = restorationBrushPasses(0);
  const middle = restorationBrushPasses(.5);
  const final = restorationBrushPasses(1);
  expect(first.every(pass => pass.progress === 0)).toBe(true);
  expect(final.every(pass => pass.progress === 1)).toBe(true);
  expect(middle.reduce((sum, pass) => sum + pass.progress, 0)).toBeGreaterThan(0);
  for (const pass of final) {
    expect(pass.start.x).toBeGreaterThanOrEqual(0);
    expect(pass.end.x).toBeLessThanOrEqual(256);
    expect(pass.y).toBeGreaterThan(0);
    expect(pass.y).toBeLessThan(256);
  }
});


it('免费舒卷只弯动铰点以下的共享纸带边界，不产生断开的分段', () => {
  const options = {frame: 66.926829, paperWidth: 52.36, hingeV: 39 / 239, curlV: 181 / 239, reveal: 1};
  const idle = restorationPaperRig(2, options, 0);
  const trying = restorationPaperRig(2, options, .8);
  expect(trying.nodes).toHaveLength(10);
  expect(trying.nodes[0]).toEqual(idle.nodes[0]);
  expect(trying.nodes[1]).toEqual(idle.nodes[1]);
  expect(trying.nodes[2]).toEqual(idle.nodes[2]);
  expect(trying.nodes[7].x).not.toBe(idle.nodes[7].x);
  expect(trying.nodes[9].y - trying.nodes[0].y).toBeCloseTo(options.frame);
  expect(trying.nodes.every(node => Number.isFinite(node.x + node.y))).toBe(true);
});

it('大额内存预算在长时间补算后只支付160，余额与展柜权益独立保留', () => {
  const initial = createReceiptRestorationState(27_049, 3);
  let state = complete(initial, 'excavate', 0);
  state = complete(state, 'clean', 5);
  state = complete(state, 'repair', 10);
  state = advanceReceiptRestoration(state, 24 * 60 * 60);
  expect(state.parts).toBe(26_889);
  expect(state.transactions).toHaveLength(2);
  expect(state.caseTier).toBe(3);
  expect(initial.parts).toBe(27_049);
});

it('非法动作与不足余额提示保持免费查看能力，中间动作帧真实推进', () => {
  const found = complete(createReceiptRestorationState(7), 'excavate', 0);
  expect(receiptRestorationMainAction(found)).toMatchObject({disabled: true, cost: 40});
  expect(beginReceiptRestoration(found, 'clean', '   ', 5).reason).toBe('invalid-action');
  expect(beginReceiptRestoration(found, 'unknown' as never, 'unknown', 5).reason).toBe('invalid-action');
  const funded = {...found, parts: 360};
  const cleaning = beginReceiptRestoration(funded, 'clean', 'cleaning', 5).state;
  expect(receiptRestorationMainAction(cleaning).reason).toBe('操作进行中');
  const middle = receiptRestorationFrame(cleaning, 6.7);
  expect(middle.phase).toBe('cleaning');
  expect(middle.cleaning).toBeCloseTo(.5);
  expect(middle.mudRemaining).toBeCloseTo(.5);
  const clean = advanceReceiptRestoration(cleaning, 8.4);
  const repairing = beginReceiptRestoration(clean, 'repair', 'repairing', 9).state;
  expect(receiptRestorationFrame(repairing, 10.8).repairing).toBeCloseTo(.5);
});

it('浮点完成边界的绘制阶段与已完成状态一致，不残留刷子或修补夹头', () => {
  let state = complete(createReceiptRestorationState(360), 'excavate', 0);
  state = complete(state, 'clean', 5);
  const repairing = beginReceiptRestoration(state, 'repair', 'repair-boundary', 9).state;
  const frame = receiptRestorationFrame(repairing, 12.6);
  expect(frame.condition).toBe('stabilized');
  expect(frame.phase).toBe('stabilized');
  expect(frame.complete).toBe(true);
});


it('两处补带分段落位，夹头先压上破口再连续移向下破口并收回', () => {
  const start = restorationRepairStages(0);
  const upper = restorationRepairStages(.40);
  const travelling = restorationRepairStages(.53);
  const lower = restorationRepairStages(.88);
  const done = restorationRepairStages(1);
  expect(start.upper).toBe(0);
  expect(start.lower).toBe(0);
  expect(upper.upper).toBe(1);
  expect(upper.lower).toBe(0);
  expect(travelling.toolBetween).toBeGreaterThan(0);
  expect(travelling.toolBetween).toBeLessThan(1);
  expect(lower.lower).toBe(1);
  expect(done.retract).toBe(1);
  expect(restorationRepairStages(-5)).toEqual(start);
  expect(restorationRepairStages(5)).toEqual(done);
});


it('每种现场事件只接受对应固定节点，未知和错配节点不能解锁来源', () => {
  const sites = [
    {evidenceId: 'field-pipe-scan', nodeId: 'pipe-marker-p03', eventKind: 'marker-scan', missingCount: 1},
    {evidenceId: 'field-box-stack-scan', nodeId: 'box-stack-marker-p03', eventKind: 'marker-scan', missingCount: 1},
    {evidenceId: 'field-warehouse-arrival', nodeId: 'receiving-warehouse', eventKind: 'warehouse-arrival', missingCount: 2},
  ];
  for (const site of sites) {
    const state = stabilized();
    const event: ReceiptSceneObservation = {
      ...sourceScan,
      evidenceId: site.evidenceId,
      actionId: `canonical/${site.evidenceId}`,
      metadata: {...sourceScan.metadata, nodeId: site.nodeId, eventKind: site.eventKind},
    };
    const accepted = observeReceiptEvidence(state, event);
    expect(accepted.observations).toHaveLength(1);
    expect(receiptRestorationReading(complete(accepted, 'identify', 20)).missingCount).toBe(site.missingCount);
    const wrongNodes = ['unknown-node', '', undefined, ...sites.filter(other => other.nodeId !== site.nodeId).map(other => other.nodeId)];
    for (const nodeId of wrongNodes) {
      const rejected = observeReceiptEvidence(state, {...event, metadata: {...event.metadata, nodeId}});
      expect(rejected).toBe(state);
      expect(receiptRestorationReading(rejected).missingCount).toBe(2);
    }
  }
});
