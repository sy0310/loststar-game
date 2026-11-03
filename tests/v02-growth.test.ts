import {describe,it,expect} from 'vitest';
import {newGame,restore,tuning,advance,upgrade} from '../src/game/engine';
import {growthCatalog,buyGrowth,growthLevel,growthEffects} from '../src/game/growth';
const at=1800000000000;
describe('V0.2 finite growth and old save preservation',()=>{
 it('migrates absent growth with balances, old upgrades, collection and pending cargo intact',()=>{
  const s=advance(newGame(at),at+120000);s.resources=20000;s.upgrades={radar:5,scanner:5,recycler:5,cargo:5};const raw=JSON.parse(JSON.stringify(s));delete raw.growth;
  const next=restore(JSON.stringify(raw),s.lastAt);expect(next.resources).toBe(20000);expect(next.collection).toEqual(s.collection);expect(next.upgrades).toEqual(s.upgrades);expect(growthLevel(next,'case-0')).toBe(0);
 });
 it('all new basic displays are free; every purchase is finite, needs ownership, and stale expected level cannot spend twice',()=>{
  let s=newGame(at);s.resources=50000;
  expect(buyGrowth(s,'case-0',0)).toBe(s);s.collection=['receipt','tape','bell','mouse'];
  const before=s.resources;s=buyGrowth(s,'case-0',0);expect(s.resources).toBe(before-160);expect(growthLevel(s,'case-0')).toBe(1);expect(buyGrowth(s,'case-0',0)).toBe(s);
  expect(buyGrowth(s,'unknown',0)).toBe(s);expect(growthCatalog.every(x=>x.costs.length<=3&&x.effect.length>0)).toBe(true);
  for(const entry of growthCatalog){if(entry.requires&&!s.collection.includes(entry.requires))s.collection.push(entry.requires);for(let n=0;n<entry.costs.length;n++)s=buyGrowth(s,entry.id,n);expect(buyGrowth(s,entry.id,entry.costs.length)).toBe(s);}
  expect(s.resources).toBe(50000-growthCatalog.reduce((n,x)=>n+x.costs.reduce((a,b)=>a+b,0),0));
 });
 it('research changes real scan speed/cargo; guard and habitats expose real levels; no income multiplier inflation',()=>{
  let s=newGame(at);s.resources=20000;s.collection=['tape','bell','mouse'];const base=tuning(s);
  for(const id of ['receiver','drive','dock','guard-0','guard-1','habitat-0'])s=buyGrowth(s,id,0);
  expect(growthEffects(s).interstellarSpeed).toBeGreaterThan(1);expect(tuning(s).cargo).toBeGreaterThan(base.cargo);expect(tuning(s).recycler).toBe(base.recycler);expect(growthEffects(s).guard).toEqual([1,1]);
  expect(restore(JSON.stringify(s),at)).toEqual(s);const poor={...s,resources:0};expect(buyGrowth(poor,'drive',1)).toBe(poor);
  const stale=upgrade(s,'scanner',0);expect(upgrade(stale,'scanner',0)).toBe(stale);
 });
 it('invalid optional growth never destroys old savings',()=>{
  const s=newGame(at);s.resources=12345;const corrupt={...s,growth:{'case-0':-1,receiver:99,alien:2}};const fixed=restore(JSON.stringify(corrupt),at);expect(fixed.resources).toBe(12345);expect(growthLevel(fixed,'case-0')).toBe(0);expect(growthLevel(fixed,'receiver')).toBe(0);
 });
});
