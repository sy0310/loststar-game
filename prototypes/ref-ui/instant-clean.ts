import type {FusionSave} from '../../src/fusion/contracts';
import {advanceFusion,curioPrices} from '../../src/fusion/domain';
import {advanceReceiptRestoration} from '../../src/review/receipt-restoration';
export interface InstantCleanReceipt{item:string;actionId:string;waivedMs:number;at:number}
/** Approved after the 448481 phone review: cleaning keeps its price but no wait.
 * Apply only the original item's completion; never advance the world/income,
 * research, repair/upgrade tasks or evidence as a side effect of the waived wait.
 * Prototype only; the formal persistence entry remains untouched until approval.
 */
export function settleInstantCleaning(input:FusionSave,at:number){
 let state=input;const receipts:InstantCleanReceipt[]=[];
 const paper=state.receipt.activeAction;
 if(state.game.collection.includes('receipt')&&paper?.kind==='clean'){
  const end=(paper.startedAtSeconds+paper.durationSeconds)*1000;
  state={...state,receipt:advanceReceiptRestoration(state.receipt,Math.max(at,end)/1000)};
  receipts.push({item:'receipt',actionId:paper.id,waivedMs:Math.max(0,end-at),at});
 }
 for(const [id,curio] of Object.entries(state.curios)){
  if(!curioPrices[id]||curio.action?.kind!=='clean'||!state.game.collection.includes(id))continue;
  const action=curio.action;
  // The original model has one inline completion rule. Select its item result
  // and discard every other projected field; the model is pure, no I/O occurs.
  const completed=advanceFusion(state,Math.max(at,action.endsAt)).curios[id];
  state={...state,curios:{...state.curios,[id]:completed}};
  receipts.push({item:id,actionId:`${id}/clean/${action.startedAt}`,waivedMs:Math.max(0,action.endsAt-at),at});
 }
 return{state,receipts};
}
