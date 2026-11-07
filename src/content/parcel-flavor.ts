export interface ParcelFlavorContext {
  abilityLevel?: number;
  sortingKnown?: boolean;
}

interface CurioFlavor {
  landmark: string;
  lines: readonly [string, string, string];
}

const curioFlavors: Record<string, CurioFlavor> = {
  receipt: {
    landmark: '退件平原 · 收件站外',
    lines: ['没买过，也有售后。', '这次有凭有据，上次只有据。', '它记住了。你可以忘一会儿。'],
  },
  tape: {
    landmark: '退件平原 · P03管道',
    lines: ['修好了，道歉还没说完。', '对不起，打扰裂缝了。', '三截一起道歉，裂缝插不上嘴。'],
  },
  nested: {
    landmark: '退件平原 · 分拣台',
    lines: ['包邮，内层另算。', '恭喜拆完。恭喜说早了。', '包装是赠品，赠品也有包装。'],
  },
  stamp: {
    landmark: '退件平原 · 夜班台',
    lines: ['今天寄，昨天到。', '昨天的事，今天终于有据了。', '它已经盖好了你明天的迟到。'],
  },
  'cosmic-parcel': {
    landmark: '退件平原 · 退件箱堆',
    lines: ['地址太大，先放门口。', '请轻放，里面有人在许愿。', '寄的是宇宙，包的是今天。'],
  },
  bell: {
    landmark: '退件平原 · 收件站',
    lines: ['已送达，收件人未参与。', '叮。你的缺席已签收。', '铃很负责，只是不爱当面说。'],
  },
};

/** Fictional item remarks are kept separate from evidence and operation records. */
export function parcelFlavor(id: string, context: ParcelFlavorContext = {}) {
  if (!Object.hasOwn(curioFlavors, id)) return undefined;
  const flavor = curioFlavors[id];
  const requestedLevel = context.abilityLevel ?? 0;
  const level = Number.isFinite(requestedLevel) ? Math.min(2, Math.max(0, Math.floor(requestedLevel))) : 0;
  const landmark = id === 'nested' && context.sortingKnown
    ? '旧分拣区 · 拆不完台' : flavor.landmark;
  return {landmark, line: flavor.lines[level]};
}
