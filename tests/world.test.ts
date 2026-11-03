import {it,expect} from 'vitest';
import {newGame,advance,restore,claimReturn} from '../src/game/engine';
import {worldView,setWorldSlot,dayTimeBetween} from '../src/game/world';
import {baseRobotPose} from '../src/render/base-motion';
const T=1800000000000;
it('原远征默认推进白天/黄昏/夜/晨，夜间暂停探索，同源结算只有一次',()=>{
 let s=newGame(T);expect(worldView(s).period).toBe('day');s=advance(s,T+230000);expect(worldView(s).period).toBe('dusk');s=advance(s,T+245000);expect(worldView(s).period).toBe('night');const cycles=s.cycles;s=advance(s,T+290000);expect(s.cycles).toBe(cycles);s=advance(s,T+301000);expect(worldView(s).period).toBe('dawn');expect(s.world.reports.nights).toBe(1);expect(restore(JSON.stringify(s),s.lastAt)).toEqual(s);
});
it('同一存档驱动切页/在线/多夜离线，已有资金/升级/图鉴完整保留',()=>{
 let s=newGame(T);s.collection=['tape','bell'];s.seenDiscoveries=[...s.collection];s.resources=5000;s.growth={'guard-0':3,'guard-1':3};s=setWorldSlot(setWorldSlot(s,0,'tape'),1,'bell');let online=s;for(let t=137;t<3600000;t+=137)online=advance(online,T+t);online=advance(online,T+3600000);const offline=advance(s,T+3600000,true),claimed=claimReturn(offline);expect(claimed.world).toEqual(online.world);expect(claimed.cycles).toBe(online.cycles);expect(claimed.resources).toBe(online.resources);expect(claimReturn(claimed)).toEqual(claimed);expect(claimed.world.lastReport?.intercepted).toBe(3);expect(claimed.growth).toEqual(s.growth);
});
it('旧存档启用自己的昼夜，不导入实验示例；未发现奇物与夜间改槽拒绝',()=>{
 const s=newGame(T);s.resources=12345;const old=JSON.parse(JSON.stringify(s));delete old.world;const migrated=restore(JSON.stringify(old),T);expect(migrated.resources).toBe(12345);expect(migrated.world.slots).toEqual([null,null]);expect(setWorldSlot(migrated,0,'tape')).toBe(migrated);migrated.collection=['tape'];const night=advance(migrated,T+241000);expect(setWorldSlot(night,0,'tape')).toBe(night);
 const bad={...old,world:{slots:['tape','bell'],enabled:true}};expect(restore(JSON.stringify(bad),T).resources).toBe(12345);
});
it('大幅时间跳变为常量复杂度，资源仍有离线上限，时间倒拨不回滚世界',()=>{
 const s=advance(newGame(T),T+86400000*365,true);expect(s.world.elapsedMs).toBe(86400000*365);expect(s.world.reports.nights).toBe(Math.floor(86400000*365/300000));expect(s.pendingReturn?.seconds).toBe(7200);expect(restore(JSON.stringify(s),s.lastAt)).toEqual(s);expect(advance(s,T)).toBe(s);expect(dayTimeBetween(0,300000)).toBe(240000);
});
it('基地28秒完成两次不同展柜的观察、取放、归位，步位与手持物连续',()=>{
 const targets=new Set<string>(),actions=new Set<string>();let last=baseRobotPose(0);let min=last.x,max=last.x;
 for(let t=.02;t<28;t+=.02){const p=baseRobotPose(t);expect(Math.hypot(p.x-last.x,p.y-last.y)).toBeLessThan(7);if(p.lift>0||last.lift>0)expect(Math.hypot(p.item.x-last.item.x,p.item.y-last.item.y)).toBeLessThan(8);min=Math.min(min,p.x);max=Math.max(max,p.x);targets.add(p.target);actions.add(p.action);last=p;}
 expect(targets.size).toBeGreaterThanOrEqual(2);expect(max-min).toBeGreaterThan(180);expect(actions).toEqual(new Set(['walk','observe','open','lift','inspect','place','wipe','return']));
});
