import {modernReceiptCleanPaths,modernReceiptSupport,modernReceiptRepairContact,modernReceiptPose,modernReceiptPoint} from './receipt-paper-model';
import {curioRigContact} from './curio-rig-motion';
import {curioActionProgress,type CurioState} from './curio-material';
import type {ReceiptRestorationState} from '../review/receipt-restoration';
export const renewalCurioIds=['receipt','tape','nested','stamp','cosmic-parcel','bell'] as const;
export type RenewalCurioId=typeof renewalCurioIds[number];
export type RenewalPoint={x:number;y:number};
export type RenewalTool='brush'|'tweezers'|'spatula'|'screwdriver';
const clamp=(n:number)=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;
const smooth=(n:number)=>{const p=clamp(n);return p*p*(3-2*p);};
/** Measured in the shared 192 logical specimen plane; never changes persisted facts. */
export const renewalCurioRegistration:Record<RenewalCurioId,{
 material:string;support:RenewalPoint;cleanPaths:readonly (readonly [RenewalPoint,RenewalPoint])[];
 repairs:readonly {contact:RenewalPoint;tool:RenewalTool;zone:readonly RenewalPoint[];from:RenewalPoint;angle:number}[];
}>={
 receipt:{material:'thermal-receipt-paper',support:modernReceiptSupport,cleanPaths:modernReceiptCleanPaths,repairs:[{contact:{x:109,y:59},tool:'spatula',zone:[{x:37,y:37},{x:158,y:37},{x:158,y:81},{x:37,y:81}],from:{x:0,y:3},angle:0},{contact:{x:67,y:126},tool:'spatula',zone:[{x:28,y:105},{x:153,y:105},{x:153,y:150},{x:28,y:150}],from:{x:0,y:-3},angle:0}]},
 tape:{material:'adhesive-roll',support:{x:109,y:161},cleanPaths:[[{"x":76,"y":40},{"x":139,"y":40}],[{"x":165,"y":57},{"x":69,"y":57}],[{"x":52,"y":73},{"x":166,"y":73}],[{"x":167,"y":90},{"x":50,"y":90}],[{"x":28,"y":107},{"x":167,"y":107}],[{"x":167,"y":124},{"x":19,"y":124}],[{"x":15,"y":140},{"x":167,"y":140}],[{"x":149,"y":157},{"x":15,"y":157}]],repairs:[{contact:{x:113,y:64},tool:'tweezers',zone:[{x:61,y:13},{x:171,y:13},{x:180,y:90},{x:70,y:93}],from:{x:-4,y:4},angle:-.08},{contact:{x:46,y:121},tool:'spatula',zone:[{x:0,y:95},{x:92,y:92},{x:93,y:174},{x:0,y:174}],from:{x:-3,y:10},angle:.12}]},
 nested:{material:'corrugated-cardboard',support:{x:96,y:168},cleanPaths:[[{"x":67,"y":38},{"x":164,"y":38}],[{"x":170,"y":56},{"x":42,"y":56}],[{"x":27,"y":75},{"x":170,"y":75}],[{"x":170,"y":93},{"x":27,"y":93}],[{"x":35,"y":111},{"x":171,"y":111}],[{"x":171,"y":129},{"x":36,"y":129}],[{"x":38,"y":148},{"x":157,"y":148}],[{"x":144,"y":166},{"x":42,"y":166}]],repairs:[{contact:{x:139,y:63},tool:'tweezers',zone:[{x:30,y:8},{x:183,y:18},{x:188,y:110},{x:26,y:105}],from:{x:-4,y:-9},angle:-.05},{contact:{x:38,y:137},tool:'spatula',zone:[{x:0,y:100},{x:99,y:100},{x:107,y:192},{x:0,y:192}],from:{x:-4,y:4},angle:-.03}]},
 stamp:{material:'inked-copper-mechanism',support:{x:106,y:179},cleanPaths:[[{"x":41,"y":16},{"x":98,"y":16}],[{"x":99,"y":39},{"x":36,"y":39}],[{"x":37,"y":62},{"x":97,"y":62}],[{"x":111,"y":85},{"x":60,"y":85}],[{"x":57,"y":108},{"x":167,"y":108}],[{"x":169,"y":131},{"x":48,"y":131}],[{"x":46,"y":154},{"x":169,"y":154}],[{"x":158,"y":177},{"x":47,"y":177}]],repairs:[{contact:{x:97,y:89},tool:'tweezers',zone:[{x:20,y:0},{x:149,y:0},{x:153,y:119},{x:29,y:115}],from:{x:-11,y:3},angle:-.14},{contact:{x:108,y:113},tool:'screwdriver',zone:[{x:49,y:96},{x:163,y:95},{x:175,y:160},{x:43,y:154}],from:{x:-4,y:-5},angle:-.10}]},
 'cosmic-parcel':{material:'bound-cardboard',support:{x:98,y:176},cleanPaths:[[{"x":42,"y":25},{"x":162,"y":25}],[{"x":173,"y":45},{"x":29,"y":45}],[{"x":20,"y":66},{"x":172,"y":66}],[{"x":171,"y":86},{"x":20,"y":86}],[{"x":21,"y":107},{"x":170,"y":107}],[{"x":169,"y":127},{"x":21,"y":127}],[{"x":21,"y":148},{"x":163,"y":148}],[{"x":137,"y":168},{"x":38,"y":168}]],repairs:[{contact:{x:103,y:64},tool:'tweezers',zone:[{x:0,y:0},{x:192,y:0},{x:192,y:95},{x:0,y:101}],from:{x:-5,y:-7},angle:.04},{contact:{x:86,y:133},tool:'spatula',zone:[{x:0,y:88},{x:128,y:86},{x:133,y:192},{x:0,y:192}],from:{x:-3,y:6},angle:-.04}]},
 bell:{material:'oxidized-copper',support:{x:97,y:165},cleanPaths:[[{"x":73,"y":46},{"x":122,"y":46}],[{"x":140,"y":62},{"x":55,"y":62}],[{"x":48,"y":79},{"x":147,"y":79}],[{"x":157,"y":95},{"x":38,"y":95}],[{"x":31,"y":112},{"x":164,"y":112}],[{"x":165,"y":128},{"x":30,"y":128}],[{"x":30,"y":145},{"x":165,"y":145}],[{"x":161,"y":161},{"x":35,"y":161}]],repairs:[{contact:{x:155,y:140},tool:'screwdriver',zone:[{x:116,y:113},{x:192,y:109},{x:192,y:184},{x:113,y:184}],from:{x:-5,y:-6},angle:.10},{contact:{x:100,y:43},tool:'spatula',zone:[{x:67,y:0},{x:131,y:0},{x:134,y:74},{x:65,y:74}],from:{x:0,y:21},angle:0}]},
};
export function isRenewalCurio(id:string):id is RenewalCurioId{return renewalCurioIds.includes(id as RenewalCurioId);}
export function renewalReceiptCurioState(state:ReceiptRestorationState):CurioState{
 const action=state.activeAction;
 return {condition:state.condition,...(action&&(action.kind==='clean'||action.kind==='repair')?{action:{kind:action.kind,startedAt:action.startedAtSeconds*1000,endsAt:(action.startedAtSeconds+action.durationSeconds)*1000}}:{})};
}
/** One source of truth for tool contact and structure, with correction only during pressure. */
export function renewalTreatmentFrame(id:RenewalCurioId,state:CurioState,now:number){
 const progress=curioActionProgress(state,now),registration=renewalCurioRegistration[id];
 const cleaning=state.condition!=='found'?1:state.action?.kind==='clean'?progress:0;
 const repairing=state.condition==='stabilized'?1:state.action?.kind==='repair'?progress:0;
 const pass=Math.min(7,Math.floor(cleaning*8)),local=cleaning===1?1:cleaning*8-pass;
 const [start,end]=registration.cleanPaths[pass],sweep=clamp(local/.72);
 let contact={x:start.x+(end.x-start.x)*sweep,y:start.y+(end.y-start.y)*sweep};
 const cleaningContact=local<.72;
 if(local>.72&&pass<7){const next=registration.cleanPaths[pass+1][0],p=smooth((local-.72)/.28);contact={x:contact.x+(next.x-contact.x)*p,y:contact.y+(next.y-contact.y)*p};}
 const step=Math.min(1,Math.floor(repairing*2)),repairLocal=repairing===1?1:repairing*2-step;
 const corrections=[smooth((repairing*2-.23)/.44),smooth((repairing*2-1.23)/.44)];
 const repair=registration.repairs[step],remain=1-corrections[step];
 const repairContact=id==='receipt'?modernReceiptRepairContact(step,corrections):curioRigContact(id,step,corrections);
 if(id==='receipt')contact=modernReceiptPoint(contact,modernReceiptPose(cleaning,corrections));
 const pressure=clamp(repairLocal/.23)*(1-clamp((repairLocal-.72)/.28));
 return{progress,cleaning,repairing,pass,local,contact,cleaningContact,step,repairLocal,corrections,repairContact,pressure,tool:state.action?.kind==='clean'?(id==='tape'&&pass<4||id==='nested'&&pass<3?'tweezers':'brush'):repair.tool,complete:state.condition==='stabilized'||repairing===1};
}

/** Both the workbench and a glass case project the same paper edge out of its sample bank. */
export function renewalBuriedReceiptPose(progress:number){
 const p=clamp(progress),loosen=smooth(p/.38),tilt=smooth((p-.32)/.5),settle=smooth((p-.84)/.16);
 const angle=tilt===1?0:-.20*(1-tilt),scaleY=.20+.80*tilt,pivot={x:96,y:161};
 const edge={x:144,y:44},dx=edge.x-pivot.x,dy=(edge.y-pivot.y)*scaleY;
 const edgeContact={x:pivot.x+dx*Math.cos(angle)-dy*Math.sin(angle),y:pivot.y+dx*Math.sin(angle)+dy*Math.cos(angle)};
 return {progress:p,loosen,tilt,settle,angle,scaleY,pivot,edgeContact};
}
