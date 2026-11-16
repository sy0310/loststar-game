/** Prototype-only renderer adapter for remaining research/cabinet preview entrypoints.
 * Reuses original materials and accepted free rigs, omits the retired workbench/tools.
 * The normal Fusion build imports the original module unchanged. */
export * from '../../src/fusion/curio-condition';
import {prepareCurioMaterial,drawRenewalCurioRig,type CurioPoseOptions} from '../../src/fusion/curio-condition';
import type {CurioState} from '../../src/fusion/curio-material';
import {isRenewalCurio,type RenewalCurioId} from '../../src/fusion/curio-renewal-model';
import type {ReceiptRestorationState} from '../../src/review/receipt-restoration';
import {receiptRestorationFrame} from '../../src/review/receipt-restoration';
import {recordCurioStateUse} from '../../src/fusion/curio-state-images';
function paint(canvas:HTMLCanvasElement,id:RenewalCurioId,state:CurioState,now:number,options:CurioPoseOptions){
 const material=prepareCurioMaterial(undefined,{condition:state.condition},now,id);if(!material.revision)return false;
 const c=canvas.getContext('2d')!;c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,canvas.width,canvas.height);c.fillStyle=getComputedStyle(document.body).getPropertyValue('--ui-bg').trim()||'#1c1730';c.fillRect(0,0,canvas.width,canvas.height);
 const size=Math.min(canvas.width,canvas.height)-40;c.save();c.translate((canvas.width-size)/2,(canvas.height-size)/2);c.scale(size/192,size/192);c.imageSmoothingEnabled=false;
 if(state.condition==='stabilized'&&options.drawAbility)options.drawAbility(c,material.image);else drawRenewalCurioRig(c,id,material,options.seconds??now/1000,state.condition==='stabilized'?options.trial??0:0,options.reducedMotion);
 c.restore();recordCurioStateUse(c,material.image);canvas.dataset.ready='true';canvas.dataset.simpleMaterial='true';canvas.dataset.condition=state.condition;canvas.dataset.materialStage=state.condition;canvas.dataset.stateImage=`${id}-${state.condition}.webp`;canvas.dataset.frame=String(Number(canvas.dataset.frame??0)+1);canvas.dataset.toolContact='';return{cleanCoverage:state.condition==='found'?0:1};
}
export function renderCurioTreatment(canvas:HTMLCanvasElement,id:string,state:CurioState,now:number,options:CurioPoseOptions={}){return isRenewalCurio(id)?!!paint(canvas,id,state,now,options):false;}
export function renderRenewalReceipt(canvas:HTMLCanvasElement,state:ReceiptRestorationState,now:number,options:CurioPoseOptions={}){const trial=state.activeAction?.kind==='try'?receiptRestorationFrame(state,now/1000).trying:0;const result=paint(canvas,'receipt',{condition:state.condition},now,{...options,trial});canvas.dataset.restorationCondition=state.condition;return result;}
