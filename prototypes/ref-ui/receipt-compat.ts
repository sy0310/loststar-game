import type {FusionSave} from '../../src/fusion/contracts';
import {reduceFusion} from '../../src/fusion/domain';
import {advanceReceiptRestoration} from '../../src/review/receipt-restoration';
export interface FreeReceiptReceipt {actionId:string;mode:'start-and-settle'|'finish-existing';waivedSeconds:number;partsBefore:number;partsAfter:number;at:number}
/** Explicit sample-only transition: the retired FREE 6.2s extraction wait is waived.
 * Original start/completion reducers supply the action ID and completion receipt.
 * Paid tasks, discovery, evidence, rewards, game clock and installed rights are untouched.
 * Already displayed receipts are a no-op, including C and all old paid tasks. */
export function settleRetiredFreeWait(input:FusionSave,at:number):{state:FusionSave;receipt?:FreeReceiptReceipt}{
 if(!input.game.collection.includes('receipt')||input.receipt.stage!=='buried')return{state:input};
 const existing=input.receipt.activeAction;if(existing&&existing.kind!=='excavate')return{state:input};
 let state=input;
 if(!existing){const next=reduceFusion(input,{type:'paper',kind:'excavate'},at);if(!next.result.ok)return{state:input};state=next.state;}
 const action=state.receipt.activeAction;if(!action||action.kind!=='excavate')return{state:input};
 const end=action.startedAtSeconds+action.durationSeconds;
 const receipt=advanceReceiptRestoration(state.receipt,Math.max(at/1000,end));
 return{state:{...state,receipt},receipt:{actionId:action.id,mode:existing?'finish-existing':'start-and-settle',waivedSeconds:Math.max(0,end-at/1000),partsBefore:input.game.resources,partsAfter:state.game.resources,at}};
}
