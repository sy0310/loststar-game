import {it,expect} from 'vitest';
import {newGame,advance,restore,claimReturn} from '../src/game/engine';
import {setWorldSlot} from '../src/game/world';
import {repairStation,setAutoRepair,startPlan,explorationFactor,repairPrice,planCatalog} from '../src/game/station';
import {buyGrowth} from '../src/game/growth';
const T=1800000000000;
it('设施是默认基础设备，不装备奇物，永久收藏不出柜',()=>{
 let s=newGame(T);expect(s.world.slots).toEqual(['beacon','gate']);expect(s.station.integrity).toBe(100);expect(s.station.autoRepair).toBe(true);s.collection=['tape','bell'];expect(setWorldSlot(s,0,'tape')).toBe(s);expect(setWorldSlot(s,0,'beacon').collection).toEqual(['tape','bell']);
});
it('真正抵站才受损，夜间不维修，清晨按实修点扣18零件且只扣一次',()=>{
 let s=newGame(T);s=advance(s,T+250000);expect(s.station.integrity).toBe(100);s=advance(s,T+294000);expect(s.station.integrity).toBe(94);expect(s.station.repairSpent).toBe(0);s=advance(s,T+300000);expect(s.station.integrity).toBe(100);expect(s.station.repairSpent).toBe(18);expect(s.station.lastNight).toMatchObject({damage:6,repaired:6,spent:18,intercepted:2,arrived:1});expect(restore(JSON.stringify(s),s.lastAt)).toEqual(s);expect(advance(s,s.lastAt)).toBe(s);
});
it('不维修也永不软锁，余额7只修2点，过期手动请求不重复扣款',()=>{
 let s=setAutoRepair(newGame(T),false);s=setWorldSlot(setWorldSlot(s,0,null),1,null);s=advance(s,T+300000);expect(s.station.integrity).toBe(82);expect(s.station.repairSpent).toBe(0);s.resources=7;const done=repairStation(s,82);expect(done.station.integrity).toBe(84);expect(done.resources).toBe(1);expect(repairStation(done,82)).toBe(done);s.station.integrity=0;expect(explorationFactor(s)).toBe(.8);expect(advance(s,T+3600000).cycles).toBeGreaterThan(s.cycles);expect(s.collection.every(id=>advance(s,T+3600000).collection.includes(id))).toBe(true);
});
it('新玩家首小时正收益，维修总支出受真实收入30%约束，无固定扣税',()=>{
 const s=advance(newGame(T),T+3600000);expect(s.resources).toBeGreaterThan(120);expect(s.station.repairSpent).toBeLessThanOrEqual(s.station.grossIncome*.3);expect(s.station.integrity).toBe(100);let full=newGame(T);full.growth={'guard-0':3,'guard-1':3};full=advance(full,T+3600000);expect(full.station.damageTotal).toBe(0);expect(full.station.repairSpent).toBe(0);
});
it('原27049与已购守护等级原值迁移，无补购收费或奇物虚构',()=>{
 const old:any=newGame(T);delete old.station;delete old.research;old.resources=27049;old.collection=['tape','bell'];old.seenDiscoveries=[...old.collection];old.growth={'guard-0':2,'guard-1':3,'case-0':1};old.world.owned=['tape','bell'];old.world.slots=['tape','bell'];const s=restore(JSON.stringify(old),T);expect(s.resources).toBe(27049);expect(s.growth).toEqual(old.growth);expect(s.world.slots).toEqual(['beacon','gate']);expect(s.world.strengths).toEqual([2,3]);expect(s.collection).toEqual(old.collection);expect(s.station.migrated).toBe(true);expect(restore(JSON.stringify(s),T)).toEqual(s);
});
it('在线逐秒与多夜离线共用现金流、损伤与维修结果，领取不重复',()=>{
 let online=newGame(T);for(let ms=1000;ms<=3600000;ms+=1000)online=advance(online,T+ms);const offline=advance(newGame(T),T+3600000,true),done=claimReturn(offline);expect(done.resources).toBe(online.resources);expect(done.cycles).toBe(online.cycles);expect(done.station).toEqual(online.station);expect(done.world).toEqual(online.world);expect(claimReturn(done)).toBe(done);
});
it('8小时与24小时离线在货舱2小时封顶后不再累积维修费或损伤',()=>{
 for(const balance of [120,5000,27049,50000]){const s=newGame(T);s.resources=balance;const h8=advance(s,T+8*3600000,true),h24=advance(s,T+24*3600000,true);expect(h24.pendingReturn?.resources).toBe(h8.pendingReturn?.resources);expect(h24.station.repairSpent).toBe(h8.station.repairSpent);expect(h24.station.integrity).toBe(h8.station.integrity);expect(h24.pendingReturn!.resources).toBeGreaterThan(0);expect(restore(JSON.stringify(h24),h24.lastAt)).toEqual(h24);expect(h24.world.elapsedMs).toBe(86400000);}
});
it('安保升级确实减少碰撞，修复工位降低实际单点价格',()=>{
 let s=newGame(T);s.resources=5000;expect(repairPrice(s)).toBe(3);s=buyGrowth(s,'repair-bay',0);expect(repairPrice(s)).toBe(2);s=buyGrowth(s,'repair-bay',1);expect(repairPrice(s)).toBe(1);s=setAutoRepair(s,false);s=advance(s,T+300000);const before=s.resources,done=repairStation(s);expect(before-done.resources).toBe(6);
});
it('科研固定预算不自动续费，实际加快探索并带回本地观察，收藏不消耗',()=>{
 let s=newGame(T);s.resources=27049;s.collection=['tape'];s.seenDiscoveries=['tape'];const baseline=advance(s,T+1800000);s=startPlan(s,'deep','artifact',null);expect(s.resources).toBe(27049-planCatalog.find(p=>p.id==='deep')!.cost);expect(s.collection).toEqual(['tape']);expect(startPlan(s,'deep','artifact',null)).toBe(s);s=advance(s,T+1800000);expect(s.cycles).toBeGreaterThan(baseline.cycles);expect(s.research.completed).toBe(1);expect(s.research.active).toBeNull();expect(s.research.notes).toHaveLength(1);const once=restore(JSON.stringify(s),s.lastAt);expect(once.research).toEqual(s.research);expect(advance(s,T+3600000).research.completed).toBe(1);
});
it('零余额/夜间不能手动维修，高预算科研需已发现奇物；损坏新字段只重置新系统',()=>{
 let s=newGame(T);expect(startPlan(s,'deep','artifact',null)).toBe(s);s.resources=0;s.station.integrity=80;expect(repairStation(s)).toBe(s);const night=advance(setAutoRepair(s,false),T+241000);expect(repairStation(night)).toBe(night);const raw:any={...s,resources:27049,station:{integrity:-1},research:{active:'invalid'}};const restored=restore(JSON.stringify(raw),T);expect(restored.resources).toBe(27049);expect(restored.station.integrity).toBe(100);expect(restored.research.active).toBeNull();
});
it('零完整度自动部分修复时，小步在线与离线仍产生相同效率和费用',()=>{
 const s=newGame(T);s.resources=0;s.station.integrity=0;let online=s;for(let ms=500;ms<=600000;ms+=500)online=advance(online,T+ms);const done=claimReturn(advance(s,T+600000,true));expect(done.resources).toBe(online.resources);expect(done.cycles).toBe(online.cycles);expect(done.station.integrity).toBe(online.station.integrity);expect(done.station.repairSpent).toBe(online.station.repairSpent);
});
it('损坏旧world可选字段不会把27049存档清空',()=>{
 const s:any=newGame(T);s.resources=27049;s.world.slots='invalid';expect(restore(JSON.stringify(s),T).resources).toBe(27049);
});
it('调换两个设备位时，永久设备等级跟随设备而不借用另一个槽的等级',()=>{
 let s=newGame(T);s.growth={'guard-0':3,'guard-1':1};s=setWorldSlot(s,0,'gate');s=setWorldSlot(s,1,'beacon');s=advance(s,T+1);expect(s.world.strengths).toEqual([1,3]);
});
it('低于6点的残余完整度只受真实剩余损伤，不显示虚构的6点扣除',()=>{
 let s=setAutoRepair(newGame(T),false);s.station.integrity=2;s=advance(s,T+294000);expect(s.station.integrity).toBe(0);expect(s.station.damageTotal).toBe(2);expect(s.station.lastHitPoints).toBe(2);
});
import {commitSave} from '../src/game/persistence';
it('两个旧标签用相同损伤版本提交维修，只从真实存档扣一次',()=>{
 const s=newGame(T);s.resources=50;s.station.integrity=94;s.station.autoRepair=false;let raw=JSON.stringify(s);const storage={getItem:()=>raw,setItem:(_k:string,v:string)=>{raw=v;}};const a=commitSave(storage,s,x=>repairStation(x,94),T),b=commitSave(storage,s,x=>repairStation(x,94),T);expect(a.state.resources).toBe(32);expect(b.state.resources).toBe(32);expect(b.state.station.repairSpent).toBe(18);
});
it('存储写入失败不会在一次事务内重试维修，恢复写入也不累计重复扣款',()=>{
 const s=newGame(T);s.resources=50;s.station.integrity=94;s.station.autoRepair=false;let raw=JSON.stringify(s),fail=true,calls=0;const storage={getItem:()=>raw,setItem:(_k:string,v:string)=>{if(fail)throw Error('quota');raw=v;}};const fn=(x:typeof s)=>{calls++;return repairStation(x,94);};const a=commitSave(storage,s,fn,T);expect(calls).toBe(1);expect(a.persisted).toBe(false);expect(a.state.resources).toBe(32);fail=false;const b=commitSave(storage,a.state,fn,T);expect(b.state.resources).toBe(32);expect(b.state.station.repairSpent).toBe(18);expect(b.persisted).toBe(true);
});
it('科研观察与参考奇物身份一致，收据不能写成道歉胶带',()=>{
 let s=newGame(T);s.collection=['receipt'];s.seenDiscoveries=['receipt'];s.resources=5000;s=startPlan(s,'study','artifact',null);s=advance(s,T+900000);expect(s.research.notes[0].source).toBe('receipt');expect(s.research.notes[0].text).not.toContain('道歉');
});
