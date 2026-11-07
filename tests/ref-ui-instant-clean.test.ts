import {afterEach,test,expect,vi} from 'vitest';
import {firstPlanetFixture} from '../scripts/firstplanet_fixtures';
import {reduceFusion,advanceFusion,createFusion,curioPrices} from '../src/fusion/domain';
import {settleInstantCleaning} from '../prototypes/ref-ui/instant-clean';
import {createMemoryController} from '../prototypes/ref-ui/model';
const at=1800000000000,ids=['receipt','tape','nested','stamp','cosmic-parcel','bell'];
afterEach(()=>vi.useRealTimers());
for(const id of ids)test(`instant ${id} cleaning keeps the original single fee and changes only its legitimate material completion`,()=>{
 const fixture=firstPlanetFixture(at,0,'found',{receiptAbility:0,tapeAbility:0}).state;
 const action=id==='receipt'?{type:'paper' as const,kind:'clean' as const}:{type:'curio' as const,id,kind:'clean' as const};
 const paid=reduceFusion(fixture,action,at);expect(paid.result.ok).toBe(true);const before=structuredClone(paid.state),r=settleInstantCleaning(paid.state,at);
 expect(paid.state).toEqual(before);expect(r.state.game).toEqual(before.game);expect(r.state.progression).toEqual(before.progression);expect(r.state.records).toEqual(before.records);expect(r.state.projects).toEqual(before.projects);expect(r.state.task).toEqual(before.task);expect(r.state.taskSeq).toBe(before.taskSeq);
 expect(fixture.game.resources-r.state.game.resources).toBe(id==='receipt'?40:curioPrices[id].clean);
 expect((id==='receipt'?r.state.receipt:r.state.curios[id]).condition).toBe('clean');expect(id==='receipt'?r.state.receipt.activeAction:r.state.curios[id].action).toBeUndefined();
 expect(r.state.receipt.evidenceIds).toEqual(before.receipt.evidenceIds);expect(r.state.receipt.verifiedEvidenceIds).toEqual(before.receipt.verifiedEvidenceIds);expect(r.receipts).toHaveLength(1);expect(r.receipts[0].waivedMs).toBeGreaterThan(0);expect(settleInstantCleaning(r.state,at)).toEqual({state:r.state,receipts:[]});
});
test('waiving a cleaning wait never completes an unrelated paid upgrade or advances its clock',()=>{
 let state=firstPlanetFixture(at,0,'found',{receiptAbility:0,tapeAbility:0}).state;state=reduceFusion(state,{type:'paper',kind:'clean'},at).state;state=settleInstantCleaning(state,at).state;state=reduceFusion(state,{type:'paper',kind:'repair'},at).state;state=advanceFusion(state,at+1000);state=reduceFusion(state,{type:'curio',id:'tape',kind:'clean'},at+1000).state;const before=structuredClone(state),after=settleInstantCleaning(state,at+1000).state;
 expect(after.receipt).toEqual(before.receipt);expect(after.receipt.activeAction?.kind).toBe('repair');expect(after.game).toEqual(before.game);expect(after.curios.tape.condition).toBe('clean');
});
test('unowned or unknown material is not granted by the compatibility adapter',()=>{const state=createFusion(at,null,{journey:true,seed:317});state.curios.tape={condition:'found',action:{kind:'clean',startedAt:at,endsAt:at+3000}};expect(settleInstantCleaning(state,at)).toEqual({state,receipts:[]});});
test('memory controller commits paid cleaning synchronously once and emits the real completion without a clock tick',async()=>{
 vi.useFakeTimers();vi.setSystemTime(at);const fixture=firstPlanetFixture(at,0,'found',{receiptAbility:0,tapeAbility:0}).state,m=createMemoryController(fixture),events:string[]=[];m.controller.subscribe(()=>events.push(m.controller.state.receipt.condition+'/'+(m.controller.state.receipt.activeAction?.kind??'idle')));
 try{const result=await m.controller.act({type:'paper',kind:'clean'});expect(result.ok).toBe(true);expect(events).toEqual(['found/clean','clean/idle']);expect(m.controller.state.receipt.condition).toBe('clean');expect(m.controller.state.receipt.activeAction).toBeUndefined();expect(m.controller.state.game.lastAt).toBe(at);expect(m.instantCleaning).toHaveLength(1);expect(m.trace.map(t=>t.before-t.after)).toEqual([40]);await m.controller.act({type:'paper',kind:'clean'});expect(m.instantCleaning).toHaveLength(1);expect(m.trace[1].before).toBe(m.trace[1].after);}finally{m.stop();}
});

test('receipt cleaning completes at every millisecond phase without rounding below its seconds threshold',()=>{
 const fixture=firstPlanetFixture(at,0,'found',{receiptAbility:0,tapeAbility:0}).state;
 for(let ms=0;ms<1000;ms++){
  const time=at+ms,paid=reduceFusion(fixture,{type:'paper',kind:'clean'},time).state,result=settleInstantCleaning(paid,time);
  expect(result.state.receipt.condition,`millisecond ${ms}`).toBe('clean');expect(result.state.receipt.activeAction).toBeUndefined();expect(result.receipts).toHaveLength(1);expect(result.state.game).toEqual(paid.game);
 }
});
