import {test,expect} from 'vitest';
import {createFusion,reduceFusion} from '../src/fusion/domain';
import {firstPlanetFixture} from '../scripts/firstplanet_fixtures';
import {settleRetiredFreeWait} from '../prototypes/ref-ui/receipt-compat';
const at=1800000000000;
test('only a truly discovered receipt can use the retired free-wait compatibility path',()=>{const input=createFusion(at,null,{journey:true,seed:317});expect(settleRetiredFreeWait(input,at)).toEqual({state:input});});
test('discovered A legally completes the old free action once without changing money, clock, evidence or rights',()=>{
 const {state}=firstPlanetFixture(at,0,'buried',{receiptAbility:0,tapeAbility:0});const before=structuredClone(state),r=settleRetiredFreeWait(state,at);
 expect(state).toEqual(before);expect(r.state.receipt.stage).toBe('displayed');expect(r.state.receipt.condition).toBe('found');expect(r.receipt?.partsBefore).toBe(r.receipt?.partsAfter);expect(r.state.game).toEqual(state.game);expect(r.state.progression).toEqual(state.progression);expect(r.state.projects).toEqual(state.projects);expect(r.state.receipt.evidenceIds).toEqual(state.receipt.evidenceIds);expect(r.state.receipt.verifiedEvidenceIds).toEqual(state.receipt.verifiedEvidenceIds);expect(r.state.receipt.completedActionIds).toContain(r.receipt!.actionId);expect(settleRetiredFreeWait(r.state,at)).toEqual({state:r.state});
});
test('an old ongoing free task completes its original action ID rather than starting or charging again',()=>{const {state}=firstPlanetFixture(at,0,'buried',{receiptAbility:0,tapeAbility:0});const next=reduceFusion(state,{type:'paper',kind:'excavate'},at);expect(next.result.ok).toBe(true);const id=next.state.receipt.activeAction!.id,r=settleRetiredFreeWait(next.state,at);expect(r.receipt?.mode).toBe('finish-existing');expect(r.receipt?.actionId).toBe(id);expect(r.state.taskSeq).toBe(next.state.taskSeq);expect(r.state.game).toEqual(next.state.game);});
for(const kind of ['clean','repair'] as const)test(`old paid ${kind} retains its original clock, debit and pending state`,()=>{const {state}=firstPlanetFixture(at,3,kind==='clean'?'found':'clean',{receiptAbility:0,tapeAbility:0});const next=reduceFusion(state,{type:'paper',kind},at);expect(next.result.ok).toBe(true);expect(settleRetiredFreeWait(next.state,at)).toEqual({state:next.state});});
test('completed C and purchased cabinets are never downgraded or charged by the compatibility adapter',()=>{const {state}=firstPlanetFixture(at,3,'stabilized');expect(settleRetiredFreeWait(state,at)).toEqual({state});});
