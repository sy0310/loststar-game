import {renewalCurioMuseumHandling} from '../fusion/curio-museum-handling';
import {renewalCurioRegistration,type RenewalCurioId} from '../fusion/curio-renewal-model';
import type {baseRobotPose} from './base-motion';
import {itemCenter,type Exhibit} from './museum-layout';
import {museumCaseGeometry,museumSpace,physicalMuseumExhibits,translatedRect,museumSupportBounds,type MuseumPoint,type MuseumRect} from './museum-space';

const visits=[3,1,5,0,4,2] as const;
export function museumVisit(seconds:number){const token=Math.floor(Math.max(0,seconds)/14),index=visits[token%6];return {token,index,id:physicalMuseumExhibits[index].id};}
/** Visual-only latch. Loading/treatment completion cannot start a lift mid-visit. */
export class MuseumVisitEligibility {
 private value?:{token:number;allowed:boolean};
 resolve(seconds:number,canHandle:(id:string)=>boolean){const visit=museumVisit(seconds);if(this.value?.token!==visit.token)this.value={token:visit.token,allowed:Math.max(0,seconds)%14<4&&canHandle(visit.id)};return this.value.allowed;}
 // Hiding the view never erases a decision made earlier in this same visit.
 // A first frame in the middle of a new visit observes until the next full one.
 reset(){}
}
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const ease=(n:number)=>{const p=clamp(n);return p*p*(3-2*p);};
const mix=(a:MuseumPoint,b:MuseumPoint,f:number)=>({x:a.x+(b.x-a.x)*f,y:a.y+(b.y-a.y)*f});
const window=(t:number,a:number,b:number)=>ease((t-a)/(b-a));
export type MuseumServicePhase='walk'|'observe'|'open'|'raise-tray'|'extend-tray'|'grip'|'lift-clear'|'inspect'|'place'|'release'|'retract-tray'|'lower-tray'|'close'|'return';
export type MuseumServicePose=ReturnType<typeof baseRobotPose>&{
 servicePhase:MuseumServicePhase;caseLevel:number;trayExtension:number;trayLift:number;trayDepth:number;itemDepth:number;
 hands:readonly[MuseumPoint,MuseumPoint];shoulders:readonly[MuseumPoint,MuseumPoint];
 actorBounds:MuseumRect;bodyGroundBounds:MuseumRect;feetBounds:MuseumRect;itemBounds:MuseumRect;trayBounds:MuseumRect;
 apertureOpen:boolean;stowed:boolean;armDeployment:number;handReach:number;bodyClearance:number;
};
export function museumDisplaySpecimen(exhibit:Exhibit,level:number):Exhibit{
 const {floor}=museumCaseGeometry(exhibit,level),support=renewalCurioRegistration[exhibit.id as RenewalCurioId].support,size=exhibit.item.size;
 return {...exhibit,item:{...exhibit.item,x:-(support.x-96)*size/192,y:floor-exhibit.y-13-(support.y-96)*size/192}};
}
export function museumRoute(exhibit:Exhibit,fraction:number):MuseumPoint{
 const corridor=exhibit.x<300?museumSpace.corridors[0]:museumSpace.corridors[1],side=Math.sign(corridor-exhibit.x)||1;
 const service={x:exhibit.x+side*108,y:exhibit.y+36};
 const knots=[museumSpace.hub,{x:corridor,y:museumSpace.hub.y},{x:corridor,y:exhibit.y+70},{x:service.x,y:exhibit.y+70},service];
 const lengths=[0];for(let i=1;i<knots.length;i++)lengths.push(lengths[i-1]+Math.hypot(knots[i].x-knots[i-1].x,knots[i].y-knots[i-1].y));
 const at=ease(fraction)*lengths.at(-1)!;let next=1;while(next<knots.length-1&&lengths[next]<at)next++;
 return mix(knots[next-1],knots[next],(at-lengths[next-1])/Math.max(.001,lengths[next]-lengths[next-1]));
}
export function museumServicePose(seconds:number,level:(id:string)=>number,canHandle:(id:string)=>boolean=()=>true):MuseumServicePose{
 const time=Math.max(0,seconds),index=visits[Math.floor(time/14)%6],e=physicalMuseumExhibits[index],t=time%14;
 const caseLevel=Math.max(0,Math.min(3,Math.floor(level(`case-${index}`)))),g=museumCaseGeometry(e,caseLevel),specimen=museumDisplaySpecimen(e,caseLevel),id=e.id as RenewalCurioId;
 let servicePhase:MuseumServicePhase,action:ReturnType<typeof baseRobotPose>['action'];
 if(t<4){servicePhase='walk';action='walk';}else if(t<4.8){servicePhase='observe';action='observe';}
 else if(t<5.5){servicePhase='open';action='open';}else if(t<6){servicePhase='raise-tray';action='open';}
 else if(t<6.8){servicePhase='extend-tray';action='open';}else if(t<7.2){servicePhase='grip';action='lift';}
 else if(t<7.8){servicePhase='lift-clear';action='lift';}else if(t<8.5){servicePhase='inspect';action='inspect';}
 else if(t<9.1){servicePhase='place';action='place';}else if(t<9.4){servicePhase='release';action='place';}
 else if(t<10.1){servicePhase='retract-tray';action='wipe';}else if(t<10.5){servicePhase='lower-tray';action='wipe';}
 else if(t<11){servicePhase='close';action='wipe';}else{servicePhase='return';action='return';}
 const enabled=canHandle(id),workTime=enabled?t:4.3;if(!enabled&&action!=='walk'&&action!=='return'){action='observe';servicePhase='observe';}
 const progress=t<4?t/4:t>=11?1-(t-11)/3:1,position=museumRoute(e,progress),towardBay=Math.sign(e.x-position.x)||-1;
 const before=museumRoute(e,Math.max(0,progress-.0001)),after=museumRoute(e,Math.min(1,progress+.0001));
 const direction=(action==='return'?-1:1)*Math.sign(after.x-before.x),facing=(action==='walk'||action==='return')&&Math.abs(after.x-before.x)>.001?direction:towardBay;
 const opening=window(workTime,4.8,5.5)*(1-window(workTime,10.5,11));
 const trayLift=10*window(workTime,5.5,6)*(1-window(workTime,10.1,10.5));
 const trayExtension=70*window(workTime,6,6.8)*(1-window(workTime,9.4,10.1));
 const center=itemCenter(specimen),trayItem={x:center.x,y:center.y-trayLift+trayExtension};
 const lift=window(workTime,7.2,7.8)*(1-window(workTime,8.5,9.1));
 // First rise clear of the support, then move outward and lower at the robot.
 // The complete item/holder moves together. No straight descent through the plinth.
 const pickup=window(workTime,7.2,7.8),put=window(workTime,8.5,9.1),travel=pickup*(1-put);
 const held={x:position.x+towardBay*49,y:position.y-84};
 const clear={x:trayItem.x,y:trayItem.y-8},out={x:held.x,y:clear.y};
 const item=travel<.25?mix(trayItem,clear,ease(travel/.25)):travel<.7?mix(clear,out,ease((travel-.25)/.45)):mix(out,held,ease((travel-.7)/.3));
 const handling=renewalCurioMuseumHandling[id],anchors=towardBay<0?handling.right:handling.left;
 const size=specimen.item.size/192,grips=anchors.map(p=>({x:item.x+(p.x-96)*size,y:item.y+(p.y-96)*size})) as [MuseumPoint,MuseumPoint];
 const contact=window(workTime,6.45,7.05)*(1-window(workTime,9.1,9.4));
 const armDeployment=window(workTime,5.5,6.4)*(1-window(workTime,9.4,10.2));
 const foldedHands=[{x:position.x+towardBay*20.19,y:position.y-35.87},{x:position.x-towardBay*22.31,y:position.y-40.12}] as const;
 const workingHands=[{x:position.x+towardBay*24,y:position.y-49},{x:position.x+towardBay*19,y:position.y-43}] as const;
 const restHands=foldedHands.map((p,i)=>mix(p,workingHands[i],armDeployment));
 const hands=grips.map((p,i)=>mix(restHands[i],p,contact)) as [MuseumPoint,MuseumPoint];
 // Same actual work-side shoulder points used by renewal-robot's museum option.
 const shoulders=[mix({x:position.x+towardBay*27.84,y:position.y-58.82},{x:position.x+towardBay*29.54,y:position.y-58.82},armDeployment),mix({x:position.x-towardBay*12.96,y:position.y-56.27},{x:position.x+towardBay*29.54,y:position.y-46.92},armDeployment)] as const;
 const bounds=handling.bounds,itemBounds={left:item.x+(bounds.left-96)*size,top:item.y+(bounds.top-96)*size,right:item.x+(bounds.right-96)*size,bottom:item.y+(bounds.bottom-96)*size};
 const actorBounds=translatedRect(museumSpace.transit,position),feetBounds=translatedRect(museumSpace.feet,position),bodyGroundBounds=translatedRect({...museumSpace.feet,left:museumSpace.transit.left,right:museumSpace.transit.right},position);
 const trayBounds=translatedRect(museumSupportBounds(id,caseLevel),{x:e.x,y:g.floor-trayLift+trayExtension});
 const bodyClearance=Math.min(...physicalMuseumExhibits.map(b=>{const r=museumCaseGeometry(b,level(`case-${physicalMuseumExhibits.indexOf(b)}`)).solid;return Math.max(bodyGroundBounds.left-r.right,r.left-bodyGroundBounds.right,bodyGroundBounds.top-r.bottom,r.top-bodyGroundBounds.bottom);}));
 return {...position,action,target:id,lift,opening,facing,hand:mix(hands[0],hands[1],.5),hands,shoulder:shoulders[0],shoulders,item,contact,turn:0,width:136,
  specimenEnvelope:enabled?1-window(t,4,4.8)+window(t,10.5,11):1,servicePhase,caseLevel,trayExtension,trayLift,
  trayDepth:e.y+trayExtension,itemDepth:e.y+trayExtension+travel*4+.1,actorBounds,bodyGroundBounds,feetBounds,itemBounds,trayBounds,
  apertureOpen:opening>.995,stowed:action==='walk'||action==='return',armDeployment,handReach:Math.max(...hands.map((p,i)=>Math.hypot(p.x-shoulders[i].x,p.y-shoulders[i].y))),bodyClearance,
 };
}
