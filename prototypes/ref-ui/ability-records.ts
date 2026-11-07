import type {FusionSave} from '../../src/fusion/contracts';
import type {AbilityRigRecord} from '../../src/fusion/curio-ability-rig';
/** Same read-only selection as the existing UI. Never generates an observation. */
export function existingAbilityRecords(state:FusionSave){
 const facts:AbilityRigRecord[]=state.progression.sorting.facts.map(f=>({id:f.id,at:f.at,detail:f.detail,source:f.nodeId,code:f.code,orientation:f.orientation}));
 for(const o of state.receipt.observations)if(!facts.some(f=>f.id===o.actionId))facts.push({id:o.actionId,at:o.observedAtSeconds*1000,detail:'现场核对的箱标',source:o.source,code:typeof o.metadata.boxCode==='string'?o.metadata.boxCode:undefined});
 if(state.progression.abilities.receipt===1)facts.sort((a,b)=>Number(b.code==='P30')-Number(a.code==='P30'));
 return facts;
}
