import {describe,it,expect} from 'vitest';
import {openSave,commitSave} from '../src/game/persistence';
import {newGame,upgrade,SAVE_KEY,advance,claimReturn} from '../src/game/engine';
const NOW=1800000000000;
describe('真实存储故障不重复消费或清空有效进度',()=>{
 it('写满仍保留读到的存档，升级只执行一次',()=>{
  const original=newGame(NOW);original.resources=300;
  const storage={getItem:()=>JSON.stringify(original),setItem:()=>{throw new Error('quota');}};
  expect(openSave(storage,NOW)).toEqual({state:original,persisted:false});
  let calls=0;
  const result=commitSave(storage,original,s=>{calls++;return upgrade(s,'scanner');},NOW);
  expect(calls).toBe(1);expect(result.state.upgrades.scanner).toBe(1);expect(result.state.resources).toBe(255);expect(result.persisted).toBe(false);
 });
 it('读权限异常时使用现有内存进度，不从头开始',()=>{
  const storage={getItem:()=>{throw new Error('blocked');},setItem:()=>{throw new Error('blocked');}};
  const s=newGame(NOW);s.resources=500;
  expect(openSave(storage,NOW).persisted).toBe(false);
  expect(commitSave(storage,s,a=>upgrade(a,'recycler'),NOW).state.resources).toBe(455);
 });
 it('正常读取最新存档再原子保存，旧页面不会重复领取',()=>{
  let raw=JSON.stringify(advance(newGame(NOW),NOW+60000,true));
  const storage={getItem:(key:string)=>{expect(key).toBe(SAVE_KEY);return raw;},setItem:(key:string,value:string)=>{expect(key).toBe(SAVE_KEY);raw=value;}};
  const initial=openSave(storage,NOW+60000);expect(initial.persisted).toBe(true);
  const a=commitSave(storage,initial.state,claimReturn,NOW+60000),b=commitSave(storage,initial.state,claimReturn,NOW+60000);
  expect(a.state.resources).toBe(b.state.resources);expect(b.state.pendingReturn).toBeNull();expect(b.persisted).toBe(true);
 });
 it('没有持久数据时继续本次内存游戏，损坏数据走引擎恢复路径',()=>{
  const memory={getItem:()=>null,setItem:()=>{}};
  const s=newGame(NOW);s.resources=200;
  expect(commitSave(memory,s,a=>upgrade(a,'cargo'),NOW).state.resources).toBe(155);
  const bad={getItem:()=>'{broken',setItem:()=>{}};
  expect(openSave(bad,NOW).state.resources).toBe(120);
 });
});
