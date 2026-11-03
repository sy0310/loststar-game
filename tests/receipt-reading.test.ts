import {expect,it} from 'vitest';
import {
  RECEIPT_SAMPLE_BATCHES,
  RECEIPT_EXPERIMENT_SECONDS,
  resolveReceiptReading,
  receiptExperimentFrame,
} from '../src/review/receipt-reading';

it('本体研究逐级获得可读信息与核对能力，研究等级独立于柜体',()=>{
  const all=[0,1,2,3].map(level=>resolveReceiptReading(level,RECEIPT_SAMPLE_BATCHES.A));
  expect(all[0].lines).toHaveLength(0);
  expect(all[0].ticketLines).toContain('已收到好奇心');
  expect(all[1].lines).toHaveLength(1);
  expect(all[1].lines[0].address).toBeUndefined();
  expect(all[2].lines).toHaveLength(3);
  expect(all[2].lines.every(line=>Boolean(line.address))).toBe(true);
  expect(all[2].pendingCount).toBeNull();
  expect(all[3].pendingCount).toBe(2);
  expect(all[3].completedCount).toBe(1);
  expect(all[3].resultLines.map(line=>line.nextStep)).toEqual(['signed','checked']);
});

it('A到B的2→1结果取决于实际记录，重复和乱序记录不制造额外事项',()=>{
  const a=RECEIPT_SAMPLE_BATCHES.A,b=RECEIPT_SAMPLE_BATCHES.B;
  expect(resolveReceiptReading(3,b).pendingCount).toBe(1);
  const duplicate={...a,records:[...a.records,...a.records].reverse(),slips:[...a.slips,a.slips[0]]};
  expect(resolveReceiptReading(3,duplicate).resultLines).toEqual(resolveReceiptReading(3,a).resultLines);
  const futureStep={...a,records:[...a.records,{id:'late-signature',slipId:a.slips[1].id,step:'signed' as const}]};
  expect(resolveReceiptReading(3,futureStep).resultLines.find(line=>line.id===a.slips[1].id)?.nextStep).toBe('checked');
  expect(resolveReceiptReading(3,{...a,records:[]}).pendingCount).toBe(3);
  const before=JSON.stringify(a);
  expect(resolveReceiptReading(3,a)).toEqual(resolveReceiptReading(3,a));
  expect(JSON.stringify(a)).toBe(before);
});

it('真实四秒内按开卷、读出、核对、打印、收卷推进，已发生行由动画折回',()=>{
  const reading=resolveReceiptReading(3,RECEIPT_SAMPLE_BATCHES.A);
  const start=receiptExperimentFrame(reading,0);
  expect(start.phase).toBe('opening');expect(start.open).toBe(0);
  expect(receiptExperimentFrame(reading,1).visibleLines.length).toBeGreaterThan(0);
  const checked=receiptExperimentFrame(reading,2.35);
  expect(checked.foldedLineIds).toHaveLength(1);
  expect(checked.visibleLines).toHaveLength(2);
  expect(receiptExperimentFrame(reading,2.7).ticket).toBeGreaterThan(0);
  const done=receiptExperimentFrame(reading,RECEIPT_EXPERIMENT_SECONDS+.1);
  expect(done.complete).toBe(true);expect(done.open).toBe(0);
  expect(done.visibleLines).toEqual(reading.resultLines);
  expect(receiptExperimentFrame(reading,-20)).toEqual(start);
});
