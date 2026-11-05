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
 material:string;support:RenewalPoint;cleanPaths:readonly [RenewalPoint,RenewalPoint][];
 repairs:readonly {contact:RenewalPoint;tool:RenewalTool;zone:readonly RenewalPoint[];from:RenewalPoint;angle:number}[];
}>={
 receipt:{material:'aged-paper',support:{x:96,y:169},cleanPaths:[[{"x":65,"y":30},{"x":163,"y":30}],[{"x":163,"y":49},{"x":61,"y":49}],[{"x":54,"y":68},{"x":161,"y":68}],[{"x":149,"y":87},{"x":48,"y":87}],[{"x":40,"y":107},{"x":144,"y":107}],[{"x":137,"y":126},{"x":32,"y":126}],[{"x":32,"y":145},{"x":131,"y":145}],[{"x":123,"y":164},{"x":35,"y":164}]],repairs:[{contact:{x:145,y:35},tool:'spatula',zone:[{x:118,y:0},{x:192,y:0},{x:192,y:68},{x:116,y:68}],from:{x:0,y:9},angle:.10},{contact:{x:45,y:152},tool:'spatula',zone:[{x:0,y:122},{x:111,y:122},{x:112,y:192},{x:0,y:192}],from:{x:8,y:-6},angle:-.10}]},
 tape:{material:'adhesive-roll',support:{x:109,y:161},cleanPaths:[[{"x":86,"y":34},{"x":148,"y":34}],[{"x":161,"y":51},{"x":59,"y":51}],[{"x":55,"y":68},{"x":164,"y":68}],[{"x":164,"y":85},{"x":55,"y":85}],[{"x":31,"y":103},{"x":164,"y":103}],[{"x":164,"y":120},{"x":29,"y":120}],[{"x":32,"y":137},{"x":163,"y":137}],[{"x":121,"y":154},{"x":32,"y":154}]],repairs:[{contact:{x:113,y:64},tool:'tweezers',zone:[{x:61,y:13},{x:171,y:13},{x:180,y:90},{x:70,y:93}],from:{x:-4,y:4},angle:-.08},{contact:{x:46,y:121},tool:'spatula',zone:[{x:0,y:95},{x:92,y:92},{x:93,y:174},{x:0,y:174}],from:{x:-3,y:10},angle:.12}]},
 nested:{material:'corrugated-cardboard',support:{x:96,y:168},cleanPaths:[[{"x":64,"y":32},{"x":145,"y":32}],[{"x":156,"y":50},{"x":49,"y":50}],[{"x":49,"y":69},{"x":156,"y":69}],[{"x":152,"y":87},{"x":38,"y":87}],[{"x":37,"y":105},{"x":149,"y":105}],[{"x":149,"y":123},{"x":36,"y":123}],[{"x":36,"y":142},{"x":142,"y":142}],[{"x":127,"y":160},{"x":39,"y":160}]],repairs:[{contact:{x:139,y:63},tool:'tweezers',zone:[{x:30,y:8},{x:183,y:18},{x:188,y:110},{x:26,y:105}],from:{x:-4,y:-9},angle:-.05},{contact:{x:38,y:137},tool:'spatula',zone:[{x:0,y:100},{x:99,y:100},{x:107,y:192},{x:0,y:192}],from:{x:-4,y:4},angle:-.03}]},
 stamp:{material:'inked-copper-mechanism',support:{x:106,y:179},cleanPaths:[[{"x":45,"y":15},{"x":99,"y":15}],[{"x":99,"y":38},{"x":40,"y":38}],[{"x":40,"y":62},{"x":99,"y":62}],[{"x":122,"y":85},{"x":65,"y":85}],[{"x":57,"y":109},{"x":152,"y":109}],[{"x":154,"y":132},{"x":45,"y":132}],[{"x":44,"y":156},{"x":153,"y":156}],[{"x":142,"y":179},{"x":44,"y":179}]],repairs:[{contact:{x:97,y:89},tool:'tweezers',zone:[{x:20,y:0},{x:149,y:0},{x:153,y:119},{x:29,y:115}],from:{x:-11,y:3},angle:-.14},{contact:{x:108,y:113},tool:'screwdriver',zone:[{x:49,y:96},{x:163,y:95},{x:175,y:160},{x:43,y:154}],from:{x:-4,y:-5},angle:-.10}]},
 'cosmic-parcel':{material:'bound-cardboard',support:{x:98,y:176},cleanPaths:[[{"x":35,"y":25},{"x":170,"y":25}],[{"x":172,"y":45},{"x":26,"y":45}],[{"x":18,"y":65},{"x":172,"y":65}],[{"x":171,"y":85},{"x":28,"y":85}],[{"x":28,"y":106},{"x":170,"y":106}],[{"x":170,"y":126},{"x":28,"y":126}],[{"x":28,"y":146},{"x":168,"y":146}],[{"x":139,"y":166},{"x":37,"y":166}]],repairs:[{contact:{x:103,y:64},tool:'tweezers',zone:[{x:0,y:0},{x:192,y:0},{x:192,y:95},{x:0,y:101}],from:{x:-5,y:-7},angle:.04},{contact:{x:86,y:133},tool:'spatula',zone:[{x:0,y:88},{x:128,y:86},{x:133,y:192},{x:0,y:192}],from:{x:-3,y:6},angle:-.04}]},
 bell:{material:'oxidized-copper',support:{x:97,y:165},cleanPaths:[[{"x":64,"y":54},{"x":128,"y":54}],[{"x":138,"y":69},{"x":54,"y":69}],[{"x":49,"y":84},{"x":142,"y":84}],[{"x":152,"y":99},{"x":40,"y":99}],[{"x":35,"y":113},{"x":157,"y":113}],[{"x":157,"y":128},{"x":34,"y":128}],[{"x":34,"y":143},{"x":157,"y":143}],[{"x":154,"y":158},{"x":37,"y":158}]],repairs:[{contact:{x:155,y:140},tool:'screwdriver',zone:[{x:116,y:113},{x:192,y:109},{x:192,y:184},{x:113,y:184}],from:{x:-5,y:-6},angle:.10},{contact:{x:100,y:43},tool:'spatula',zone:[{x:67,y:0},{x:131,y:0},{x:134,y:74},{x:65,y:74}],from:{x:0,y:21},angle:0}]},
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
 const repairContact={x:repair.contact.x+repair.from.x*remain,y:repair.contact.y+repair.from.y*remain};
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
