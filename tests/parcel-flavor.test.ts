import {describe, expect, it} from 'vitest';
import {parcelFlavor} from '../src/content/parcel-flavor';

describe('首星短留言', () => {
  it('只为已配置奇物提供留言，隐藏尚未知晓的分拣地点', () => {
    expect(parcelFlavor('unrevealed-planet')).toBeUndefined();
    expect(parcelFlavor('nested')?.landmark).toBe('退件平原 · 分拣台');
    expect(parcelFlavor('nested', {sortingKnown:true})?.landmark).toBe('旧分拣区 · 拆不完台');
  });
  it('收据与胶带留言随真实能力档变化，异常等级回到基础文案', () => {
    for (const id of ['receipt', 'tape']) {
      const lines = [0,1,2].map(abilityLevel => parcelFlavor(id, {abilityLevel})!.line);
      expect(new Set(lines).size).toBe(3);
      expect(parcelFlavor(id, {abilityLevel:NaN})?.line).toBe(lines[0]);
    }
  });
});
