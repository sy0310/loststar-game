import { describe, it, expect } from 'vitest';
import {newGame, advance, publicRadar, upgrade, claimReturn, tuning, restore, dismissSurvey, pendingPresentations, markPresented, publicPlanets} from '../src/game/engine';
import {discoveries} from '../src/content/catalog';
const START=1_800_000_000_000;

describe('首星成熟化：节奏、真实反馈与兼容存档',()=>{
  it('新手只知道退货箱星，界面投影无后续世界或未知总数',()=>{
    const s=newGame(START);
    expect(s.version).toBe(2);expect(s.planets).toEqual(['parcel']);
    expect(publicPlanets(s).map(p=>p.id)).toEqual(['parcel']);
    expect(publicRadar(s)).toEqual({stage:'searching',progress:0});
    expect(JSON.stringify(publicRadar(s))).not.toMatch(/echo|回声|target|total|position/);
  });
  it('即使长期挂机也不把玩家导向不能远征的世界',()=>{
    const s=advance(newGame(START),START+30*86400000,true);
    expect(s.planets).toEqual(['parcel']);expect(s.surveyCount).toBeGreaterThan(0);
    expect(JSON.stringify(publicRadar(s))).not.toMatch(/回声|等待勘测|planet/);
  });
  it('雷达真实搜索→本地异常→核对→首星现场记录，不提前暴露现场身份',()=>{
    let s=advance(newGame(START),START+46000);
    expect(publicRadar(s).stage).toBe('anomaly');expect(publicRadar(s)).not.toHaveProperty('signal');
    s=advance(s,START+72000);expect(publicRadar(s).stage).toBe('locking');
    s=advance(s,START+91000);expect(publicRadar(s).stage).toBe('surveyed');
    expect(publicRadar(s)).toHaveProperty('signal.name','反向分拣回波');
    expect(publicRadar(dismissSurvey(s)).stage).toBe('searching');
    expect(restore(JSON.stringify(s),s.lastAt).surveyCount).toBe(1);
  });
  it('首星有适量完整生态，短时间不耗尽内容，里程碑保证新发现',()=>{
    expect(discoveries.filter(d=>d.kind==='artifact')).toHaveLength(6);
    expect(discoveries.filter(d=>d.kind==='creature')).toHaveLength(3);
    expect(discoveries.filter(d=>d.kind==='event')).toHaveLength(3);
    const early=advance(newGame(START),START+100000);
    expect(early.collection).toEqual(['receipt','mouse','tape','hermit']);
    expect(early.collection).not.toContain('last-recipient');
    const mature=advance(newGame(START),START+924000);
    expect(mature.collection).toHaveLength(12);expect(new Set(mature.collection).size).toBe(12);
  });
  it('发现演出仅对应真实新发现，记录已播放后刷新不重放，不加奖励',()=>{
    let s=advance(newGame(START),START+12000);
    expect(pendingPresentations(s)).toEqual(['receipt']);
    const balance=s.resources;s=markPresented(s,'receipt');
    expect(s.resources).toBe(balance);expect(pendingPresentations(s)).toEqual([]);
    expect(markPresented(s,'unknown')).toEqual(s);
    expect(markPresented(s,'receipt')).toEqual(s);
    expect(pendingPresentations(restore(JSON.stringify(s),s.lastAt))).toEqual([]);
    expect(s.discoveryAt.receipt).toBe(START+12000);
  });
  it('离线批量发现随归航展示，领取一次，不排队轰炸多个演出',()=>{
    const s=advance(newGame(START),START+24*3600000,true);
    expect(s.pendingReturn?.seconds).toBe(7200);expect(s.resources).toBe(120);
    expect(s.pendingReturn?.discoveries).toHaveLength(12);
    expect(pendingPresentations(s)).toEqual([]);
    const claimed=claimReturn(restore(JSON.stringify(s),s.lastAt));
    expect(claimed.resources).toBeGreaterThan(120);expect(claimed.collection).toHaveLength(12);
    expect(pendingPresentations(claimed)).toEqual([]);expect(claimReturn(claimed)).toEqual(claimed);
    expect(restore(JSON.stringify(claimed),s.lastAt).resources).toBe(claimed.resources);
  });
  it('升级改变四个实际指标，速度升级保留当前周期比例',()=>{
    const s=newGame(START);s.resources=10000;s.cycleMs=6000;
    for(const id of ['scanner','radar','recycler','cargo'] as const){
      const u=upgrade(s,id);expect(u.upgrades[id]).toBe(1);expect(u.resources).toBeLessThan(s.resources);expect(tuning(u)[id]).not.toBe(tuning(s)[id]);
    }
    const u=upgrade(s,'scanner');expect(u.cycleMs/tuning(u).scanner).toBeCloseTo(.5);
    expect(advance(u,START+60000).cycles).toBeGreaterThan(advance(s,START+60000).cycles);
    expect(advance(upgrade(s,'radar'),START+360000).surveyCount).toBeGreaterThan(advance(s,START+360000).surveyCount);
    expect(advance(upgrade(s,'recycler'),START+60000).resources-upgrade(s,'recycler').resources).toBeGreaterThan(advance(s,START+60000).resources-s.resources);
  });
  it('费用不足、满级与负时间都不增加收益',()=>{
    const s=newGame(START);s.resources=0;expect(upgrade(s,'scanner')).toEqual(s);
    s.resources=10000;s.upgrades.scanner=5;expect(upgrade(s,'scanner')).toEqual(s);
    expect(advance(s,START-1)).toEqual(s);expect(advance(s,Number.NaN)).toEqual(s);
  });
  it('未领取包裹继续累积，现场记录奖励进入同一个离线结算',()=>{
    const a=advance(newGame(START),START+60000,true),b=advance(a,START+120000,true);
    expect(b.pendingReturn!.id).toBe(a.pendingReturn!.id);
    expect(b.pendingReturn!.resources).toBe(10*8+6);
    expect(b.pendingReturn!.seconds).toBe(120);
    expect(new Set(b.pendingReturn!.discoveries).size).toBe(b.pendingReturn!.discoveries.length);
  });
  it('旧切片 v1 存档保留资金、升级、收藏和曾经记录的坐标，停止推送不可玩目的地',()=>{
    const old={version:1,lastAt:START,resources:357,cycles:20,cycleMs:4000,radarMs:120000,reveal:'echo',planets:['parcel','echo'],collection:['receipt','tape','mouse'],upgrades:{radar:1,scanner:2,recycler:1,cargo:0},pendingReturn:null};
    const s=restore(JSON.stringify(old),START);
    expect(s.version).toBe(2);expect(s.resources).toBe(357);expect(s.collection).toEqual(old.collection);expect(s.upgrades).toEqual(old.upgrades);expect(s.planets).toEqual(old.planets);
    expect(publicPlanets(s).map(p=>p.id)).toEqual(['parcel','echo']);expect(publicRadar(s).stage).toBe('searching');expect(pendingPresentations(s)).toEqual([]);
  });
  it('损坏存档、无效字段和非法离线包裹回退，版本不可猜测',()=>{
    expect(restore(null,START).lastAt).toBe(START);expect(restore('{broken',START).resources).toBe(120);
    expect(restore('{"version":999}',START).version).toBe(2);
    const s=newGame(START);
    for(const bad of [{resources:-1},{surveyCount:-2},{seenDiscoveries:['unknown']},{discoveryAt:{receipt:-1}},{pendingReturn:{resources:NaN}},{upgrades:{radar:99}},{planets:[]},{surveyNotice:'echo'}]){
      expect(restore(JSON.stringify({...s,...bad}),START)).toEqual(newGame(START));
    }
  });
  it('正常恢复不造离线奖励，时间倒拨不回滚计数',()=>{
    const s=advance(newGame(START),START+12000);expect(restore(JSON.stringify(s),START+13000).collection).toEqual(s.collection);
    expect(restore(JSON.stringify(s),START+13000).pendingReturn).toBeNull();expect(restore(JSON.stringify(s),START-5000).lastAt).toBe(s.lastAt);
  });
});
