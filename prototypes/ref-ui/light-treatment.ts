import type {FusionController,FusionAction} from '../../src/fusion/contracts';
import {curioPrices} from '../../src/fusion/domain';
import {curioStateImageUrl,savedCurioCondition,curioImageStages} from '../../src/fusion/curio-state-images';
import {renewalCurioIds,type RenewalCurioId} from '../../src/fusion/curio-renewal-model';
import {prepareCurioTools,prepareCurioMaterial,drawRenewalCurioRig} from '../../src/fusion/curio-condition';
import {drawCurioAbilityRig} from '../../src/fusion/curio-ability-rig';
import {receiptRestorationMainAction} from '../../src/review/receipt-restoration';
import {refinementView} from '../../src/fusion/progression';
import {discoveryById} from '../../src/content/catalog';
import {icon} from '../../src/fusion/renewal-ui';
import {mechanismFrame} from '../../src/fusion/curio-mechanism-model';
import {mechanismMaterialMeta,drawMechanismActuator} from '../../src/fusion/curio-mechanism-renderer';
import {soundCue} from '../../src/ui/discovery';
import {existingAbilityRecords} from './ability-records';
const labels={found:'刚获得',clean:'清理后',stabilized:'升级完成'};
const actions:Record<string,string>={receipt:'读出票面',tape:'拉出一截',nested:'打开一层',stamp:'盖个邮戳','cosmic-parcel':'敲敲箱盖',bell:'轻按铃铛'};
const lines:Record<string,[string,string,string]>={
 receipt:['已被咔哒野蛮清理。缺签还是缺签。','纸终于平了，订单还是没下。','订单没下，退货先到。'],
 tape:['粘住的灰，终于松口了。','断头接上了，道歉没断。','对不起。刚才那句也是。'],
 nested:['箱缝清空，里面还有箱缝。','套层归正，套话照旧。','拆到最后，还是第一层。'],
 stamp:['清理完毕，日期依然是昨天。','轴回正了，时间没有。','今天的事，昨天再办。'],
 'cosmic-parcel':['地址露出来了：宇宙。范围很具体。','封带紧了，收件人仍然很大。','宇宙在敲门。也可能是箱盖。'],
 bell:['擦干净了，还是没人签收。','机构好了，收件人还没到。','响了。还是没人签收。']};
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
interface Callbacks{close:()=>void;preview:()=>void;collection:()=>void}
export function mountLightTreatment(controller:FusionController,callbacks:Callbacks){
 const host=document.querySelector('#app')!;
 host.insertAdjacentHTML('beforeend',`<dialog id="refui-treatment" class="lt-dialog" aria-labelledby="lt-title"><header class="ui-dialog-heading"><div><small>把发现安顿好</small><h2 id="lt-title"></h2></div><button id="lt-close" class="ui-icon-button" aria-label="关闭，返回现场">${icon('close')}</button></header><div class="lt-body"><ol id="lt-stages" class="ui-stages" aria-label="只读三态对照"></ol><section id="lt-preview" hidden><img id="lt-preview-image" alt=""><p>外观对照 · 不改变进度</p><button id="lt-preview-close">返回当前物品</button></section><section id="lt-current"><div class="lt-picture"><img id="lt-image" alt=""><canvas id="lt-trial" width="384" height="384" aria-label="奇物主动互动" hidden></canvas></div><p id="lt-condition"></p><p id="lt-result" class="ui-result" role="status" aria-live="polite"></p><div id="lt-progress" class="ui-progress" role="progressbar" aria-label="整理进度"><i></i></div><p id="lt-status" class="ui-muted" role="status"></p><button id="lt-main" class="ui-primary ui-wide"></button><button id="lt-retry" class="ui-wide" hidden>重新接通图片与互动</button><button id="lt-free" class="ui-wide" hidden></button><p id="lt-trial-line" class="ui-result" role="status" hidden></p><details id="lt-research" class="ui-records"><summary>已有线索与小本领</summary><div></div></details><button id="lt-collection" class="ui-wide">放回收藏室</button><details class="ui-records"><summary>它的来历</summary><p id="lt-origin"></p></details></section></div></dialog>`);
 const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.querySelector<T>('#'+id)!;
 const dialog=$<HTMLDialogElement>('refui-treatment'),image=$<HTMLImageElement>('lt-image'),canvas=$<HTMLCanvasElement>('lt-trial');
 let id:RenewalCurioId='receipt',rendered='',loading='',ready=false,failed=false,rigReady=false,rigFailed=false,requesting=false,preview=false,token=0;
 let trialAt=-Infinity,trialId='',bellPlayed=false,arrival:{id:string;key:string;text:string}|null=null;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)'),seen=new Set<string>(),arrivals:{id:string;key:string;at:number}[]=[],trials:{id:string;at:number}[]=[];
 const silent=new Map<string,number>();
 const actionView=(item:RenewalCurioId)=>{
  if(item==='receipt'){const a=controller.state.receipt.activeAction;return a?{key:a.id,kind:a.kind,start:a.startedAtSeconds*1000,end:(a.startedAtSeconds+a.durationSeconds)*1000}:null;}
  const a=controller.state.curios[item]?.action;return a?{key:`${item}/${a.kind}/${a.startedAt}`,kind:a.kind,start:a.startedAt,end:a.endsAt}:null;
 };
 document.addEventListener('visibilitychange',()=>{if(document.hidden){for(const item of renewalCurioIds){const a=actionView(item);if(a)silent.set(a.key,a.end);}}else{for(const [key,end] of silent)if(Date.now()<end)silent.delete(key);}});
 let previous=renewalCurioIds.map(item=>({id:item,condition:savedCurioCondition(controller.state,item),action:actionView(item)}));
 async function prepareRig(){rigFailed=false;try{await prepareCurioTools();rigReady=true;}catch{rigReady=false;rigFailed=true;}render();}
 async function load(condition:typeof curioImageStages[number]){
  const key=`${id}/${condition}`,current=++token,item=id;loading=key;ready=false;failed=false;
  try{const candidate=new Image();candidate.src=curioStateImageUrl(item,condition);await candidate.decode();
   if(token!==current||!dialog.open||id!==item||savedCurioCondition(controller.state,item)!==condition)return;
   image.src=candidate.src;image.alt=`${discoveryById(item)!.name} · ${labels[condition]}`;rendered=key;loading='';ready=true;
   image.dataset.stateImage=`${item}-${condition}.webp`;image.dataset.ready='true';
   if(arrival?.id===item&&dialog.open&&!preview&&!document.hidden){$('lt-result').textContent=arrival.text;arrivals.push({id:item,key:arrival.key,at:Date.now()});dialog.dataset.arrivalCount=String(arrivals.length);if(!reduced.matches)image.animate([{transform:'translateY(-4px)'},{transform:'translateY(2px)'},{transform:'translateY(0)'}],{duration:550,easing:'ease-out'});}
   arrival=null;render();
  }catch{if(current!==token)return;loading='';ready=false;failed=true;arrival=null;image.dataset.ready='false';render();}
 }
 function render(){
  if(!dialog.open)return;
  const state=controller.state,condition=savedCurioCondition(state,id),a=actionView(id),busy=!!a,paid=condition!=='stabilized';
  if(rendered!==`${id}/${condition}`&&loading!==`${id}/${condition}`&&!failed)void load(condition);
  $('lt-condition').textContent=labels[condition];$('lt-condition').dataset.condition=condition;
  for(const el of $('lt-stages').querySelectorAll<HTMLElement>('[data-lt-condition]'))el.setAttribute('aria-current',el.dataset.ltCondition===condition?'step':'false');
  const price=id==='receipt'?(condition==='found'?40:120):curioPrices[id][condition==='found'?'clean':'repair'];
  // The receipt quote comes from the existing rule, never from a new currency or fee.
  const quote=id==='receipt'&&paid?receiptRestorationMainAction({...state.receipt,parts:state.game.resources}).cost:price;
  const main=$<HTMLButtonElement>('lt-main');main.hidden=!paid;main.textContent=busy?'咔哒正在处理…':`${condition==='found'?'清理':'零件升级'} · ${quote}零件`;
  main.disabled=preview||requesting||busy||!ready||state.game.resources<quote;
  $('lt-progress').hidden=!busy||a?.kind==='try';const progress=a?Math.max(0,Math.min(1,(Date.now()-a.start)/(a.end-a.start))):0;
  $('lt-progress').querySelector<HTMLElement>('i')!.style.width=`${progress*100}%`;$('lt-progress').setAttribute('aria-valuenow',String(Math.round(progress*100)));
  $('lt-status').textContent=failed?'图片暂未接通，进度已保留。':!ready?'正在接通原图…':busy&&a.kind!=='try'?'咔哒正在处理，离开也会继续。':paid&&state.game.resources<quote?'零件不足，自动探索还在继续。':paid?'原图保留到处理完成。':'可以展示，也可以逗它一下。';
  $('lt-retry').hidden=!failed&&!rigFailed;const free=$<HTMLButtonElement>('lt-free');free.hidden=paid;free.textContent=`${actions[id]} · 不耗零件`;free.disabled=preview||!ready||!rigReady||requesting||busy||performance.now()-trialAt<2600;
  const ability=id==='receipt'||id==='tape'?refinementView(state).abilities[id]:null;
  const records=state.progression.sorting.facts.map(f=>`<p>${esc(f.detail)}</p>`).join('');
  const research=ability?`<p>${esc(ability.currentEffect)}</p>${ability.nextPrice!==null?`<button id="lt-ability" ${!ability.enabled||!ready||preview||busy?'disabled':''}>研究 · ${ability.nextPrice}零件</button><p>${esc(ability.nextEffect)}</p>`:''}`:'';
  const identify=id==='receipt'&&condition==='stabilized'&&state.receipt.evidenceIds.some(key=>!state.receipt.verifiedEvidenceIds.includes(key));
  const researchHTML=research+(identify?`<button id="lt-identify" ${busy||preview?'disabled':''}>核对已有线索</button>`:'')+records;
  const researchRoot=$('lt-research').querySelector('div')!;if(researchRoot.innerHTML!==researchHTML)researchRoot.innerHTML=researchHTML;$('lt-research').hidden=!researchHTML;
  dialog.dataset.savedCondition=condition;dialog.dataset.preview=String(preview);dialog.dataset.busy=String(busy);dialog.dataset.materialReady=String(ready);
 }
 async function paidAction(action:FusionAction){
  if(requesting||preview||!ready||actionView(id))return;for(const animation of image.getAnimations())animation.cancel();arrival=null;requesting=true;$('lt-result').textContent='';render();
  try{const r=await controller.act(action);if(!r.ok)$('lt-result').textContent=r.message??'暂时不能处理，进度保留。';}finally{requesting=false;render();}
 }
 function show(item:RenewalCurioId){
  if(!controller.state.game.collection.includes(item))return false;
  for(const animation of image.getAnimations())animation.cancel();id=item;rendered='';loading='';ready=false;failed=false;preview=false;arrival=null;trialAt=-Infinity;trialId='';++token;
  $('lt-title').textContent=discoveryById(id)!.name;$('lt-origin').textContent=discoveryById(id)!.description;$('lt-result').textContent='';$('lt-trial-line').hidden=true;
  $('lt-stages').innerHTML=curioImageStages.map(c=>`<li><button data-lt-preview="${c}" data-lt-condition="${c}" aria-label="放大${labels[c]}外观对照"><img src="${curioStateImageUrl(id,c)}" alt=""><span>${labels[c]}</span></button></li>`).join('');
  $('lt-preview').hidden=true;$('lt-current').hidden=false;dialog.showModal();render();void prepareRig();return true;
 }
 function hide(){for(const animation of image.getAnimations())animation.cancel();++token;dialog.close();arrival=null;trialAt=-Infinity;preview=false;}
 function closePreview(){preview=false;$('lt-preview').hidden=true;$('lt-current').hidden=false;render();}
 dialog.addEventListener('click',event=>{
  const button=(event.target as Element).closest<HTMLButtonElement>('button');if(!button)return;event.stopPropagation();
  if(button.id==='lt-close'||button.id==='lt-preview-close'){callbacks.close();return;}
  if(button.id==='lt-collection'){callbacks.collection();return;}
  if(button.dataset.ltPreview){preview=true;arrival=null;const c=button.dataset.ltPreview as typeof curioImageStages[number];$<HTMLImageElement>('lt-preview-image').src=curioStateImageUrl(id,c);$<HTMLImageElement>('lt-preview-image').alt=labels[c]+' · 只读外观';$('lt-preview').hidden=false;$('lt-current').hidden=true;callbacks.preview();render();return;}
  if(button.id==='lt-main'){const condition=savedCurioCondition(controller.state,id);void paidAction(id==='receipt'?{type:'paper',kind:condition==='found'?'clean':'repair'}:{type:'curio',id,kind:condition==='found'?'clean':'repair'});return;}
  if(button.id==='lt-retry'){failed=false;loading='';rendered='';void prepareRig();document.querySelector<HTMLButtonElement>('#fusion-museum-retry')?.click();render();return;}
  if(button.id==='lt-ability'&&(id==='receipt'||id==='tape')){void paidAction(refinementView(controller.state).abilities[id].action);return;}
  if(button.id==='lt-identify'){void paidAction({type:'paper',kind:'identify'});return;}
  if(button.id==='lt-free'&&!button.disabled){
   const item=id;requesting=true;render();void(async()=>{try{if(item==='receipt'){const r=await controller.act({type:'paper',kind:'try'});if(!r.ok)return;}if(!dialog.open||id!==item)return;trialAt=performance.now();trialId=item;bellPlayed=false;if(item!=='bell')soundCue('interaction',item);trials.push({id:item,at:Date.now()});$('lt-trial-line').hidden=false;$('lt-trial-line').textContent='咔哒正在试验…';$('lt-current').querySelector('.lt-picture')?.scrollIntoView({block:'nearest'});}finally{requesting=false;render();}})();
  }
 });
 dialog.addEventListener('cancel',e=>{e.preventDefault();callbacks.close();});
 controller.subscribe(()=>{
  const next=renewalCurioIds.map(item=>({id:item,condition:savedCurioCondition(controller.state,item),action:actionView(item)}));
  for(const before of previous){const current=next.find(row=>row.id===before.id)!;if(before.action&&['clean','repair'].includes(before.action.kind)&&!current.action&&current.condition!==before.condition&&!seen.has(before.action.key)){seen.add(before.action.key);if(dialog.open&&id===current.id&&!preview&&!document.hidden&&!silent.has(before.action.key))arrival={id:current.id,key:before.action.key,text:lines[current.id][before.action.kind==='clean'?0:1]};}}
  previous=next;render();
 });
 function paint(){
  const elapsed=performance.now()-trialAt,active=dialog.open&&!preview&&!document.hidden&&trialId===id&&elapsed<2600&&rigReady&&ready;
  canvas.hidden=!active;image.hidden=active;
  if(active){const c=canvas.getContext('2d')!;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,384,384);c.scale(2,2);c.imageSmoothingEnabled=false;const material=prepareCurioMaterial(undefined,{condition:'stabilized'},Date.now(),id),trial=Math.max(.0001,elapsed/2600);
   if(id==='receipt'||id==='tape'){
    const level=controller.state.progression.abilities[id],result=drawCurioAbilityRig(c,{id,image:material.image,seconds:Date.now()/1000,abilityLevel:level,experimentProgress:trial,size:192,reducedMotion:reduced.matches,records:existingAbilityRecords(controller.state)});
    canvas.dataset.abilityLevel=String(level);canvas.dataset.usedRecordIds=JSON.stringify(result.usedRecordIds);
   }
   else drawRenewalCurioRig(c,id,material,Date.now()/1000,trial,reduced.matches);
   if(id==='bell'||id==='tape'){
    const mechanical=mechanismFrame(id,{...mechanismMaterialMeta(material.image),seconds:Date.now()/1000,trial,reducedMotion:reduced.matches});
    drawMechanismActuator(c,id,mechanical);
    canvas.dataset.mechanismPhase=mechanical.phase;canvas.dataset.toolContact=String(mechanical.tool.contact);
    canvas.dataset.bellTriggered=String(mechanical.bell?.triggered??false);canvas.dataset.bellStroke=String(mechanical.bell?.stroke??0);
    canvas.dataset.tapeLength=String(mechanical.tape?.length??0);
    if(id==='bell'&&mechanical.bell?.triggered&&mechanical.tool.contact&&!bellPlayed){bellPlayed=true;soundCue('curio-bell','bell');}
   }
   if(elapsed>(id==='bell'?650:1400))$('lt-trial-line').textContent=lines[id][2];
  }
  if(dialog.open&&elapsed>=2600&&elapsed<2900)render();requestAnimationFrame(paint);
 }
 requestAnimationFrame(paint);
 return{show,hide,closePreview,isOpen:()=>dialog.open,diagnostics:()=>({id,rendered,ready,preview,arrivals:[...arrivals],trials:[...trials]})};
}
