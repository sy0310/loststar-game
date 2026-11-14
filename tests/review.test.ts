import {describe,it,expect} from 'vitest';
import {newGame,advance,restore,claimReturn,publicRadar} from '../src/game/engine';
import {robotPose,shipPose} from '../src/render/motion';
import {wallForDayTime} from '../src/game/world';
const wall=(ms:number)=>wallForDayTime(0,ms,ms*1.3+60000);
const START=1800000000000;
const json=(value:unknown)=>JSON.parse(JSON.stringify(value));
describe('PR #2 Phase 1.5 回归',()=>{
  it('15/30/60 分钟有效白天探索有居民联动日记，重复恢复不增加条目或发奖',()=>{
    const a=advance(newGame(START),START+wall(900000)),b=advance(a,START+wall(1800000)),c=advance(b,START+wall(3600000));
    expect(json(a).journal.entries).toHaveLength(1);expect(json(b).journal.entries).toHaveLength(3);expect(json(c).journal.entries).toHaveLength(5);
    expect(c.collection).toHaveLength(12);expect(c.planets).toEqual(['parcel']);
    expect(c.resources).toBe(120+300*8+c.surveyCount*6-c.station.repairSpent); // Notes add stories, never another reward stream.
    expect(restore(JSON.stringify(c),c.lastAt)).toEqual(c);
    const later=advance(c,START+wall(6000000));expect(json(later).journal.entries).toHaveLength(8);expect(json(later).journal.shift).toBe(9);
    expect(restore(JSON.stringify(later),later.lastAt)).toEqual(later);
  });
  it('旧 v2 进度保留，离线日记随归航可读且领取不重置',()=>{
    const legacy=json(newGame(START));delete legacy.journal;
    const migrated=restore(JSON.stringify(legacy),START);expect(json(migrated).journal).toEqual({entries:[],shift:0});
    migrated.interstellar={elapsed:90000,resolved:{id:'parcel',name:'退货箱星'}};migrated.chart.scan=migrated.interstellar;
    expect(restore(JSON.stringify(migrated),START)).toEqual(migrated);expect(publicRadar(migrated,'interstellar').stage).toBe('resolved');
    const offline=advance(migrated,START+wall(3600000),true),claimed=claimReturn(offline);
    expect(json(claimed).journal.entries).toHaveLength(5);expect(claimReturn(claimed)).toEqual(claimed);
    const invalid=json(claimed);invalid.journal.entries=['unknown'];expect(restore(JSON.stringify(invalid),START+wall(3600000))).toEqual(newGame(START+wall(3600000)));
  });
  it('星际频道有独立状态且持续探测时不泄露目标',()=>{
    const s=newGame(START);
    expect(json(publicRadar(s,'interstellar'))).toEqual({mode:'interstellar',stage:'searching',progress:0});
    expect(JSON.stringify(publicRadar(advance(s,START+7200000),'interstellar'))).not.toMatch(/echo|planet|target|回声|数量|position/);
  });
  it('飞船可视姿态不倒置；包裹有连续的地面→手部→卸货台轨迹',()=>{
    for(let t=0;t<28;t+=.02){const p=json(shipPose(t));expect(Math.abs(p.bank)).toBeLessThan(.36);expect(['port','bow','starboard','stern']).toContain(p.view);}
    for(let i=0;i<1000;i++){const a=json(robotPose(i/1000)).parcel,b=json(robotPose((i+1)/1000)).parcel;if(a.visible&&b.visible)expect(Math.hypot(a.x-b.x,a.y-b.y)).toBeLessThan(9);}
    expect(json(robotPose(.48)).parcel.held).toBe(false);expect(json(robotPose(.63)).parcel.held).toBe(true);expect(json(robotPose(.975)).parcel.delivered).toBe(true);
  });
});

// The later interstellar content provider is deliberately not connected in this build.
// Exercise its real scanning contract with a synthetic identity, never a production world.
import {advanceInterstellar,emptyInterstellar,interstellarView} from '../src/game/radar';
it('独立星际扫描只有成功定位后才公开身份，冻结时不调用定位器',()=>{
  let calls=0;const locate=()=>{calls++;return {id:'test-only',name:'测试信号'};};
  let s=emptyInterstellar();expect(advanceInterstellar(s,90000,false,locate)).toBe(s);expect(calls).toBe(0);
  s=advanceInterstellar(s,46000,true,locate);expect(interstellarView(s,true).stage).toBe('anomaly');expect(interstellarView(s,true)).not.toHaveProperty('discovery');
  s=advanceInterstellar(s,27000,true,locate);expect(interstellarView(s,true).stage).toBe('locating');expect(calls).toBe(0);
  s=advanceInterstellar(s,18000,true,locate);expect(interstellarView(s,true)).toHaveProperty('discovery.name','测试信号');expect(calls).toBe(1);
  expect(advanceInterstellar(s,90000,true,locate)).toBe(s);expect(calls).toBe(1);
});
