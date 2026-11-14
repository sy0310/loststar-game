import {describe,it,expect} from 'vitest';
import {simulateNight,nightAt,nightResult,type NightConfig} from '../src/prototype/night-model';
import {createGuard,equipGuard,previewNight,advanceGuard,restoreGuard,setGuardEnabled,guardView} from '../src/prototype/guard-engine';
const at=1800000000000;
const schemes:Record<string,NightConfig>={empty:{slots:[null,null],strengths:[0,0]},tape:{slots:['tape',null],strengths:[0,0]},bell:{slots:[null,'bell'],strengths:[0,0]},both:{slots:['tape','bell'],strengths:[0,0]},max:{slots:['tape','bell'],strengths:[3,3]}};
function setup(c:NightConfig){let s=createGuard(at,['tape','bell'],c.strengths);s=equipGuard(equipGuard(s,0,c.slots[0]),1,c.slots[1]);return previewNight(s,at);}
describe('one deterministic timeline powers visible defense and morning/offline outcomes',()=>{
 it('choices and levels change actual interception, arrival and experimental record quality',()=>{
  const results=Object.fromEntries(Object.entries(schemes).map(([key,c])=>[key,nightResult(c)]));
  expect(results.empty.intercepted).toBe(0);expect(results.empty.arrived).toBe(3);
  expect(results.tape.intercepted).toBeGreaterThan(0);expect(results.bell.intercepted).toBeGreaterThan(0);
  expect(results.both.intercepted).toBeGreaterThan(results.tape.intercepted);expect(results.both.intercepted).toBeGreaterThan(results.bell.intercepted);
  expect(results.max.intercepted).toBeGreaterThan(results.both.intercepted);expect(results.max.intercepted).toBe(3);expect(results.max.clues).toBeGreaterThan(results.both.clues);
  for(const r of Object.values(results)){expect(r.intercepted+r.arrived+r.escorted).toBe(3);expect(r.safeReturned).toBe(3);}
 });
 it.each(Object.entries(schemes))('%s visible actor terminal events exactly match morning numbers, no slot-count shortcut',(name,c)=>{
  const timeline=simulateNight(c),s=setup(c);let intercepted=0,arrived=0;
  for(let ms=0;ms<=60000;ms+=100){const v=guardView({...s,elapsedMs:s.dayMs+ms});intercepted=Math.max(intercepted,v.nightStatus.intercepted);arrived=Math.max(arrived,v.nightStatus.arrived);for(const actor of v.intruders){expect(actor.progress).toBeGreaterThanOrEqual(0);expect(actor.progress).toBeLessThanOrEqual(1);}}
  const settled=advanceGuard(s,at+60000);expect(settled.lastReport?.result).toEqual(timeline.result);expect(settled.lastReport?.intercepted).toBe(intercepted);expect(settled.lastReport?.arrived).toBe(arrived);
  expect(timeline.events.filter(e=>e.kind==='intercept').length).toBe(timeline.result.intercepted);expect(timeline.events.filter(e=>e.kind==='arrival').length).toBe(timeline.result.arrived);
 });
 it.each(Object.entries(schemes))('%s early exit, irregular online steps, multi-night offline and refresh give identical results',(name,c)=>{
  const original=setup(c);let online=original;
  for(let t=137;t<1260000;t+=137)online=advanceGuard(online,at+t);online=advanceGuard(online,at+1260000);
  const offline=advanceGuard(original,at+1260000);expect(offline).toEqual(online);
  const exit=advanceGuard(original,at+18271),restored=restoreGuard(JSON.stringify(exit),at+1260000,['tape','bell']);expect(restored).toEqual(offline);
  expect(restoreGuard(JSON.stringify(restored),at+1260000,['tape','bell'])).toEqual(restored);expect(restored.owned).toEqual(original.owned);
 });
 it('midnight slot/level edits are deferred to next night; pausing cannot create reports',()=>{
  const s=setup(schemes.tape),mid=advanceGuard(s,at+12000),edited=equipGuard({...mid,strengths:[3,3]},1,'bell');
  expect(advanceGuard(edited,at+60000).lastReport?.result).toEqual(nightResult(schemes.tape));
  const later=advanceGuard(edited,at+360000);expect(later.lastReport?.result).toEqual(nightResult(schemes.max));
  const paused=setGuardEnabled(edited,false,at+13000),resumed=setGuardEnabled(advanceGuard(paused,at+999999),true,at+999999);expect(resumed.reports.nights).toBe(0);expect(resumed.elapsedMs).toBe(253000);
 });
 it('old demo totals survive migration and are labelled historical, new nights use detailed results',()=>{
  const s=setup(schemes.both),old=JSON.parse(JSON.stringify(advanceGuard(s,at+60000)));delete old.reports.verifiedNights;delete old.reports.arrived;delete old.lastReport.result;
  const migrated=restoreGuard(JSON.stringify(old),at+60000,['tape','bell']);expect(migrated.reports.clues).toBe(old.reports.clues);expect(migrated.reports.verifiedNights).toBe(0);
  const next=advanceGuard(migrated,at+360000);expect(next.reports.verifiedNights).toBe(1);expect(next.lastReport?.result).toEqual(nightResult(schemes.both));
 });
 it('sampling is bounded, repeatable, and does not let callers mutate the cached result',()=>{
  const c=schemes.both;expect(nightAt(c,-1)).toEqual(nightAt(c,0));expect(nightAt(c,NaN)).toEqual(nightAt(c,0));expect(nightAt(c,900)).toEqual(nightAt(c,60));
  const before=nightResult(c),copy=nightResult(c);copy.actors[0].atMs=999;expect(nightResult(c)).toEqual(before);
 });
});
