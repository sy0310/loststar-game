import {describe,it,expect} from 'vitest';
import {createGuard,advanceGuard,setGuardEnabled,equipGuard,guardView,restoreGuard,previewNight,GUARD_KEY} from '../src/prototype/guard-engine';
const START=1800000000000;
describe('独立、默认关闭的首星夜间实验',()=>{
  it('默认关闭，时间流逝不暗中激活或产生结算',()=>{
    const s=createGuard(START,['tape','bell']);expect(s.enabled).toBe(false);expect(GUARD_KEY).not.toBe('loststar.save.v1');
    const a=advanceGuard(s,START+86400000);expect(a.elapsedMs).toBe(0);expect(a.reports.nights).toBe(0);expect(guardView(a).phase).toBe('day');
  });
  it('只装备已发现的两件候选，不复制一件奇物占两槽',()=>{
    const s=createGuard(START,['tape']);expect(equipGuard(s,0,'bell')).toEqual(s);
    const a=equipGuard(s,0,'tape'),b=equipGuard(a,1,'tape');expect(b.slots).toEqual([null,'tape']);expect(s.slots).toEqual([null,null]);
  });
  it('240秒白天含黄昏、60秒夜晚；夜间配置变化延至下一夜',()=>{
    let s=setGuardEnabled(equipGuard(createGuard(START,['tape','bell']),0,'tape'),true,START);
    s=advanceGuard(s,START+230000);expect(guardView(s).phase).toBe('dusk');
    s=advanceGuard(s,START+245000);expect(guardView(s).phase).toBe('night');expect(s.activeNight?.slots).toEqual(['tape',null]);
    s=equipGuard(s,1,'bell');expect(s.activeNight?.slots).toEqual(['tape',null]);
    s=advanceGuard(s,START+300000);expect(guardView(s).phase).toBe('day');expect(s.reports.nights).toBe(1);expect(s.reports.clues).toBe(2);
    s=advanceGuard(s,START+545000);expect(s.activeNight?.slots).toEqual(['tape','bell']);
  });
  it('离线与逐秒在线结果一致，刷新不重结算，不会损失收藏',()=>{
    let s=equipGuard(equipGuard(createGuard(START,['tape','bell']),0,'tape'),1,'bell');s=setGuardEnabled(s,true,START);
    const owned=[...s.owned],offline=advanceGuard(s,START+3600000);let online=s;
    for(let i=1;i<=3600;i++)online=advanceGuard(online,START+i*1000);
    expect(offline).toEqual(online);expect(offline.reports).toEqual({nights:12,clues:36,intercepted:36});expect(offline.owned).toEqual(owned);
    expect(restoreGuard(JSON.stringify(offline),offline.lastAt,owned)).toEqual(offline);expect(advanceGuard(offline,offline.lastAt)).toEqual(offline);
  });
  it('守护效果能改变可见入侵者，数量有界、空槽也不受惩罚',()=>{
    const base=setGuardEnabled(createGuard(START,['tape','bell']),true,START);
    const equipped=equipGuard(equipGuard(base,0,'tape'),1,'bell');
    const a=guardView(advanceGuard(base,START+250000)),b=guardView(advanceGuard(equipped,START+250000));
    expect(a.intruders[0].progress).toBeGreaterThan(b.intruders[0].progress);
    for(let t=240000;t<300000;t+=100){const v=guardView(advanceGuard(equipped,START+t));expect(v.intruders.length).toBeLessThanOrEqual(3);}
    const finish=advanceGuard(base,START+300000);expect(finish.owned).toEqual(base.owned);expect(finish.reports.clues).toBe(1);
  });
  it('错误实验存档单独回退；预演不增加结算，不倒拨时间',()=>{
    const s=createGuard(START,['tape']);expect(restoreGuard('{bad',START,['tape'])).toEqual(s);
    expect(restoreGuard(JSON.stringify({...s,slots:['bell',null]}),START,['tape'])).toEqual(s);
    expect(advanceGuard(s,START-1)).toEqual(s);const preview=previewNight(s,START);expect(guardView(preview).phase).toBe('night');expect(preview.reports.nights).toBe(0);
  });
});
