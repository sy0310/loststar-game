import { describe, it, expect } from 'vitest';
import { newGame, advance, publicRadar, upgrade, claimReturn, tuning, restore } from '../src/game/engine';

const START = 1_800_000_000_000;
describe('未知探索与持久化规则', () => {
  it('开局只知道退货箱星，雷达不含目标、方位和总数', () => {
    const s = newGame(START);
    expect(s.planets).toEqual(['parcel']);
    expect(publicRadar(s)).toEqual({ stage: 'searching', progress: 0 });
    expect(JSON.stringify(publicRadar(s))).not.toMatch(/echo|回声|target|total|position/);
  });
  it('真实探测按搜索→异常→锁定→揭晓推进，仅揭晓时暴露名字', () => {
    let s = advance(newGame(START), START + 61_000);
    expect(publicRadar(s).stage).toBe('anomaly');
    expect(publicRadar(s)).not.toHaveProperty('planet');
    s = advance(s, START + 95_000);
    expect(publicRadar(s).stage).toBe('locking');
    s = advance(s, START + 121_000);
    expect(publicRadar(s).stage).toBe('revealed');
    expect(publicRadar(s)).toHaveProperty('planet.name', '回声菌星');
    expect(s.planets).toEqual(['parcel', 'echo']);
    expect(restore(JSON.stringify(s), START + 121_000).planets).toEqual(s.planets);
  });
  it('无人操作的探索解锁奇物、生物、事件，里程碑保证新发现', () => {
    const s = advance(newGame(START), START + 100_000);
    expect(s.cycles).toBeGreaterThanOrEqual(8);
    expect(s.collection).toEqual(expect.arrayContaining(['receipt', 'tape', 'nested', 'mouse', 'return-request']));
    expect(s.collection.length).toBe(new Set(s.collection).size);
    expect(s.resources).toBeGreaterThan(120);
  });
  it('离线结算有上限，保存后重复恢复及重复领取不增加收益', () => {
    const s = advance(newGame(START), START + 24 * 3600_000, true);
    expect(s.pendingReturn?.seconds).toBe(7200);
    expect(s.resources).toBe(120);
    const loaded = restore(JSON.stringify(s), s.lastAt);
    expect(loaded.pendingReturn).toEqual(s.pendingReturn);
    const claimed = claimReturn(loaded);
    expect(claimed.resources).toBeGreaterThan(120);
    expect(claimReturn(claimed)).toEqual(claimed);
    expect(restore(JSON.stringify(claimed), claimed.lastAt).resources).toBe(claimed.resources);
  });
  it('升级实际改变扫描周期、雷达速度、回收量和离线时长', () => {
    const s = newGame(START); s.resources = 10000;
    for (const id of ['scanner','radar','recycler','cargo'] as const) {
      const u = upgrade(s, id); expect(u.resources).toBeLessThan(s.resources);
      expect(u.upgrades[id]).toBe(1);
      expect(tuning(u)[id]).not.toBe(tuning(s)[id]);
    }
    const faster = upgrade(s, 'scanner');
    expect(advance(faster, START + 60_000).cycles).toBeGreaterThan(advance(s, START + 60_000).cycles);
    expect(advance(upgrade(s, 'radar'), START + 100_000).planets).toContain('echo');
    expect(advance(upgrade(s, 'recycler'), START + 60_000).resources - upgrade(s, 'recycler').resources).toBeGreaterThan(advance(s, START + 60_000).resources-s.resources);
  });
  it('费用不足、满级、倒拨时间和损坏存档安全处理', () => {
    const s = newGame(START); s.resources = 0;
    expect(upgrade(s,'scanner')).toEqual(s);
    s.resources = 10000; s.upgrades.scanner = 5;
    expect(upgrade(s,'scanner')).toEqual(s);
    expect(advance(s, START-1000)).toEqual(s);
    expect(restore('{broken', START).resources).toBe(120);
    expect(restore('{"version":999}', START).version).toBe(1);
    expect(restore(JSON.stringify({...s, resources:-100}), START).resources).toBe(120);
  });
  it('多次离线恢复合并未领取的包裹，无发现重复奖励', () => {
    const a = advance(newGame(START), START + 60_000, true);
    const b = advance(a, START + 120_000, true);
    expect(b.pendingReturn!.resources).toBe(a.pendingReturn!.resources * 2);
    expect(new Set(b.pendingReturn!.discoveries).size).toBe(b.pendingReturn!.discoveries.length);
    expect(claimReturn(b).pendingReturn).toBeNull();
  });
  it('刷新正常恢复、无离线不生成包裹；旧时间戳不能回滚进度', () => {
    const s = advance(newGame(START), START + 12_000);
    const r = restore(JSON.stringify(s), START + 13_000);
    expect(r.collection).toEqual(s.collection);
    expect(r.pendingReturn).toBeNull();
    expect(restore(null, START).lastAt).toBe(START);
    expect(restore(JSON.stringify(s), START-5000).lastAt).toBe(s.lastAt);
  });
});
