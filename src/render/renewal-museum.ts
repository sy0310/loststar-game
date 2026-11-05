import roomUrl from '../../assets/runtime/visual-renewal/museum/room.webp';
import shipUrl from '../../assets/runtime/visual-renewal/world/ship-atlas.webp';
import {exhibitIds,itemCenter,type Exhibit} from './museum-layout';
import {baseRobotPose} from './base-motion';
import type {MuseumOptions} from './museum';
import {renewalCurioRegistration,type RenewalCurioId} from '../fusion/curio-renewal-model';
const urls=import.meta.glob('../../assets/runtime/visual-renewal/museum/case-*.webp',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const furnishingUrls=import.meta.glob('../../assets/runtime/visual-renewal/museum/{string-lights,paper-garden,memorial-plaque,armillary}.webp',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const cavities=[{top:59,floor:300},{top:72,floor:270},{top:77,floor:248},{top:80,floor:232}];
const levelBase=[44,54,62,72],levelCap=[36,46,48,50];
/** Fit the complete owned case, including its separate plaque and floor shadow. */
export function renewalExhibitViewport(level:number,width:number,height:number){
 const index=Math.max(0,Math.min(3,Math.floor(level))),top=-levelBase[index]-156-levelCap[index]-4,bottom=48;
 const scale=Math.min((width-40)/210,(height-40)/(bottom-top));
 return {scale,top,bottom,originY:(height-(bottom-top)*scale)/2-top*scale};
}
const labels=['未购买收据','道歉胶带','套娃包裹','昨日邮戳','收件人：宇宙','无人签收铃'];
/** New room registration. The display cavity and walking aisles belong to the same camera. */
export const renewalExhibits:Exhibit[]=exhibitIds.map((id,index)=>({
 id,x:[160,384,608][index%3],y:index<3?500:825,width:184,
 base:{x:0,y:0,w:184},crop:{x:-101,y:-280,w:202,h:280},
 cavity:{x:-64,y:-220,w:128,h:155},front:{x:-64,y:-220,w:128,h:155},
 item:{x:0,y:-123,size:id==='receipt'?136:id==='cosmic-parcel'?128:132},scale:1,
}));
/** Align the authored specimen's true sole with its cradle, not its transparent cell centre. */
export function renewalDisplaySpecimen(exhibit:Exhibit,level:number):Exhibit{
 const base=levelBase[Math.max(0,Math.min(3,level))],support=renewalCurioRegistration[exhibit.id as RenewalCurioId].support,size=exhibit.item.size;
 return {...exhibit,item:{...exhibit.item,x:-(support.x-96)*size/192,y:-base-13-(support.y-96)*size/192}};
}
type RoomPoint={x:number;y:number};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const ease=(n:number)=>{const p=clamp(n);return p*p*(3-2*p);};
/** Rounded measured aisle -> row-front -> short approach. Never crosses a cabinet footprint. */
function approachRoute(exhibit:Exhibit,fraction:number):RoomPoint{
 const corridor=exhibit.x<300?270:500,side=Math.sign(corridor-exhibit.x)||1;
 const service={x:exhibit.x+side*35,y:exhibit.y+5};
 const knots=[{x:384,y:918},{x:corridor,y:918},{x:corridor,y:service.y+54},{x:service.x,y:service.y+54},service];
 const points:RoomPoint[]=[knots[0]],radius=10;
 for(let i=1;i<knots.length-1;i++){
  const before=knots[i-1],corner=knots[i],after=knots[i+1];
  const l1=Math.hypot(corner.x-before.x,corner.y-before.y),l2=Math.hypot(after.x-corner.x,after.y-corner.y),r=Math.min(radius,l1/3,l2/3);
  const start={x:corner.x+(before.x-corner.x)*r/l1,y:corner.y+(before.y-corner.y)*r/l1};
  const end={x:corner.x+(after.x-corner.x)*r/l2,y:corner.y+(after.y-corner.y)*r/l2};points.push(start);
  for(let step=1;step<=8;step++){const t=step/8;points.push({x:(1-t)**2*start.x+2*(1-t)*t*corner.x+t*t*end.x,y:(1-t)**2*start.y+2*(1-t)*t*corner.y+t*t*end.y});}
 }
 points.push(service);let length=0;const distances=[0];for(let i=1;i<points.length;i++){length+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);distances.push(length);}
 const distance=ease(fraction)*length;let next=1;while(next<points.length-1&&distances[next]<distance)next++;
 const a=points[next-1],b=points[next],blend=(distance-distances[next-1])/Math.max(.001,distances[next]-distances[next-1]);return{x:a.x+(b.x-a.x)*blend,y:a.y+(b.y-a.y)*blend};
}
export function renewalMuseumPose(seconds:number,level:(id:string)=>number){
 const p=baseRobotPose(seconds,renewalExhibits),e=renewalExhibits.find(e=>e.id===p.target)!,physical=renewalDisplaySpecimen(e,level(`case-${exhibitIds.indexOf(e.id)}`));
 const t=Math.max(0,seconds)%14,moving=p.action==='walk'||p.action==='return';
 const progress=p.action==='walk'?t/4:p.action==='return'?1-(t-10)/4:1;
 const position=approachRoute(e,progress),towardBay=e.x<position.x?-1:1;
 const ahead=approachRoute(e,Math.min(1,progress+.003)),behind=approachRoute(e,Math.max(0,progress-.003));
 const walking=Math.sign(ahead.x-behind.x)*(p.action==='return'?-1:1);
 const facing=moving&&Math.abs(ahead.x-behind.x)>.01?walking:towardBay;
 const center=itemCenter(physical),inspect=ease((t-7.2)/.35)*(1-ease((t-7.85)/.35));
 const held={x:position.x+towardBay*24,y:position.y-82-inspect*4};
 const item={x:center.x+(held.x-center.x)*p.lift,y:center.y+(held.y-center.y)*p.lift};
 // Handle the modern receipt by its nearer bottom brass retainer (134/40,165
 // in the 192-unit material), following the same mount through the whole lift.
 const receipt=e.id==='receipt',gripX=receipt?-towardBay*38*physical.item.size/192:towardBay*7;
 const gripY=receipt?69*physical.item.size/192:13;
 const hand={x:position.x+towardBay*27+(item.x+gripX-position.x-towardBay*27)*p.contact,y:position.y-48+(item.y+gripY-position.y+48)*p.contact};
 return {...p,...position,turn:0,width:136,facing,shoulder:{x:position.x+towardBay*20.4,y:position.y-58.65},item,hand};
}

const image=(url:string)=>{const img=new Image();img.src=url;return img;};
const smooth=(raw:number)=>{const t=Math.max(0,Math.min(1,raw));return t*t*(3-2*t);};
export class RenewalMuseum {
 readonly room=image(roomUrl);
 readonly glass=Array.from({length:4},(_,level)=>(['back','front'] as const).map(layer=>image(urls[`../../assets/runtime/visual-renewal/museum/case-${level}-${layer}.webp`])));
 readonly furnishings=Object.fromEntries(Object.entries(furnishingUrls).map(([path,url])=>[path.split('/').at(-1)!.replace('.webp',''),image(url)]));
 private dockShip?:HTMLImageElement;
 private observed=new Map<string,number>();
 private installations=new Map<string,{level:number;at:number}>();
 ready=Promise.all([this.room,...this.glass.flat(),...Object.values(this.furnishings)].map(img=>img.decode())).then(()=>undefined);
 retry(){for(const img of [this.room,...this.glass.flat(),...Object.values(this.furnishings)]){const url=new URL(img.src);url.searchParams.set('retry',String(Date.now()));img.src=url.href;}this.ready=Promise.all([this.room,...this.glass.flat(),...Object.values(this.furnishings)].map(img=>img.decode())).then(()=>undefined);return this.ready;}
 /** Fixed bottom/top material slices keep the display cavity readable at every purchased level. */
 private registeredCase(c:CanvasRenderingContext2D,image:HTMLImageElement,level:number,x:number,y:number,width:number,opening=0,front=false,assembly=1){
  const sx=width/320,{top,floor}=cavities[level],base=levelBase[level],cap=levelCap[level],inside=156;
  const left=x-width/2,ceiling=y-base-inside,head=ceiling-cap;
  c.save();if(front){c.globalAlpha=.55*(1-opening*.75);c.translate(opening*width*.38,0);}
  c.save();if(!front){c.translate(0,-18*(1-assembly));c.globalAlpha*=.45+.55*assembly;}c.drawImage(image,0,0,320,top,left,head,width,cap);c.restore();
  c.drawImage(image,0,top,320,floor-top,left,ceiling,width,inside);
  c.drawImage(image,0,floor,320,400-floor,left,y-base,width,base);
  c.restore();
  return {left,top:ceiling,width,height:inside,floor:y-base,head,scale:sx};
 }
 private support(c:CanvasRenderingContext2D,e:Exhibit,level:number,floor:number,t:number){
  // Every basic specimen has a real fitted cradle; higher levels add its own archive instrument.
  const x=e.x,w=e.id==='receipt'?79:e.id==='stamp'?62:94;
  c.fillStyle='#100b2480';c.beginPath();c.ellipse(x,floor-4,w*.50,7,0,0,Math.PI*2);c.fill();
  c.fillStyle='#2f1a4c';c.fillRect(x-w/2,floor-12,w,9);c.fillStyle='#e3a454';c.fillRect(x-w/2,floor-13,w,2);c.fillStyle='#8a514b';c.fillRect(x-w/2+3,floor-4,w-6,3);
  // The receipt owns its registered archive backboard and retaining lip. A
  // second pair of generic columns would cut through that single-paper mount.
  if(e.id==='tape'){
   c.fillStyle='#5a3572';c.fillRect(x-31,floor-43,8,31);c.fillRect(x+23,floor-43,8,31);c.fillStyle='#e6aa62';c.fillRect(x-31,floor-45,62,5);
  }else if(e.id==='stamp'){
   c.fillStyle='#bf9764';c.fillRect(x-23,floor-20,46,6);c.fillStyle='#ecd2a0';c.fillRect(x-18,floor-24,36,4);
  }else if(e.id==='cosmic-parcel'){
   c.fillStyle='#c98c4f';for(const side of [-1,1])c.fillRect(x+side*36-4,floor-24,8,12);
  }else if(e.id==='bell'){
   c.fillStyle='#9c667b';c.fillRect(x-42,floor-18,84,5);c.fillStyle='#edc883';c.fillRect(x-39,floor-19,78,2);
  }else if(e.id!=='receipt'){
   c.strokeStyle='#dda35a';c.lineWidth=3;c.strokeRect(x-38,floor-21,76,9);
  }
  if(level<2)return;
  c.save();c.translate(x,floor-2);
  if(e.id==='receipt'){c.fillStyle='#ba8fe3';c.fillRect(-39,-87,5,4);c.fillRect(34,-87,5,4);c.strokeStyle='#9775b7';c.lineWidth=2;c.beginPath();c.moveTo(-35,-75);c.lineTo(-50,-49);c.lineTo(-50,-10);c.stroke();}
  else if(e.id==='tape'){c.strokeStyle='#f2bd70';c.lineWidth=3;c.beginPath();c.arc(0,-32,31,0,Math.PI*2);c.stroke();c.fillStyle='#68dafa';c.fillRect(-3,-10,6,3);}
  else if(e.id==='nested'){for(let i=0;i<3;i++){c.strokeStyle=['#cd9252','#efc27c','#9571c2'][i];c.lineWidth=2;c.strokeRect(-42+i*5,-28+i*4,84-i*10,8);}}
  else if(e.id==='stamp'){c.fillStyle='#e8c894';c.fillRect(-31,-26,62,8);c.fillStyle='#815fa7';c.fillRect(-26,-23,29,2);c.fillRect(-26,-19,20,1);}
  else if(e.id==='cosmic-parcel'){c.strokeStyle='#9c80c9';c.lineWidth=2;c.beginPath();c.ellipse(0,-28,43,9,-.12,0,Math.PI*2);c.stroke();c.fillStyle='#d6c5e9';for(let i=0;i<4;i++)c.fillRect(-37+i*24,-20-Math.sin(t*.25+i)*2,2,2);}
  else{c.strokeStyle='#b79ccb';c.lineWidth=2;for(let i=0;i<3;i++){c.beginPath();c.ellipse(0,-23,30+i*5,4+i*2,0,0,Math.PI*2);c.stroke();}}
  c.restore();
 }
 drawExhibit(c:CanvasRenderingContext2D,e:Exhibit,t:number,known:boolean,level:number,itemImage:HTMLImageElement,options:MuseumOptions,service?:ReturnType<typeof baseRobotPose>,forcedInstall?:number){
  level=Math.max(0,Math.min(3,Math.floor(level)));
  const previous=this.observed.get(e.id);if(forcedInstall===undefined){if(previous!==undefined&&previous!==level)this.installations.set(e.id,{level,at:t});this.observed.set(e.id,level);}
  const install=this.installations.get(e.id);const progress=forcedInstall??(install?smooth((t-install.at)/1.8):1);
  const base=levelBase[level],center=itemCenter(e),physical=renewalDisplaySpecimen(e,level);
  const opening=Math.max(service?.opening??0,options.specimenOpening?.(e.id)??0);
  c.save();c.fillStyle='#120b306b';c.beginPath();c.ellipse(e.x+3,e.y+3,e.width*.53,13,0,0,Math.PI*2);c.fill();
  c.save();
  const geometry=this.registeredCase(c,this.glass[level][0],level,e.x,e.y,200,0,false,progress);
  const top=geometry.top+8,bottom=geometry.floor-3;
  c.save();c.beginPath();c.rect(e.x-64,top,128,bottom-top);c.clip();
  c.fillStyle=level?'#f7c97010':'#8c8fc50a';c.fillRect(e.x-64,top,128,bottom-top);
  this.support(c,e,level,geometry.floor,t);
  if(known&&!(service&&service.lift>0)){
   const actual={...physical,item:{...physical.item,size:Math.min(physical.item.size,bottom-top-5)}};
   if(!options.drawSpecimen?.(c,actual,t,itemImage,service)){
    const p=itemCenter(actual),size=actual.item.size;c.drawImage(itemImage,p.x-size/2,p.y-size/2,size,size);
   }
  }
  c.restore();
  this.registeredCase(c,this.glass[level][1],level,e.x,e.y,200,opening,true);
  c.restore();
  if(progress<1){
   c.strokeStyle='#c88b54';c.lineWidth=3;c.globalAlpha=1-progress*.6;
   for(const side of [-1,1]){const x=e.x+side*106,grip=geometry.head-18*(1-progress)+8;c.beginPath();c.moveTo(x,e.y-4);c.lineTo(x,grip);c.lineTo(e.x+side*84,grip);c.stroke();c.fillStyle='#f6cc86';c.fillRect(e.x+side*84-3,grip-3,6,6);}
   c.globalAlpha=1;
   c.fillStyle='#f6d39a';for(let i=0;i<3;i++)c.fillRect(e.x-28+i*28,e.y-8-Math.sin(progress*Math.PI)*9,3,3);
  }
  // One independently registered, real-rendered nameplate. No baked text or double pedestal.
  const plaque=known?labels[exhibitIds.indexOf(e.id)]:'等待发现';
  c.fillStyle='#1e1238';c.fillRect(e.x-92,e.y+8,184,36);c.strokeStyle=known?'#dca456':'#795d8c';c.lineWidth=1.5;c.strokeRect(e.x-92,e.y+8,184,36);
  c.fillStyle=known?'#ffe0a2':'#b9a6ca';c.font='30px "PingFang SC", sans-serif';c.textAlign='center';c.textBaseline='alphabetic';c.fillText(plaque,e.x,e.y+36,176);
  c.restore();return {physical,center,geometry};
 }
 drawRoom(c:CanvasRenderingContext2D,t:number,reduced=false,level:(id:string)=>number=()=>0){
  c.imageSmoothingEnabled=false;c.drawImage(this.room,0,0,768,960);
  const lighting=Math.max(0,Math.min(3,level('light')));
  if(lighting){c.fillStyle=`rgba(249,199,112,${lighting*.018})`;c.fillRect(0,0,768,960);c.fillStyle='#e9ae59';for(let i=0;i<lighting;i++)c.fillRect(208+i*121,354,104,3);c.fillStyle='#ffdf9a';for(let i=0;i<lighting;i++)c.fillRect(208+i*121,355,104,1);if(lighting===3){c.fillStyle='#c58f48';c.fillRect(31,930,706,2);c.fillStyle='#ffe2a2';c.fillRect(32,929,704,1);}}
  if(level('deco-0'))c.drawImage(this.furnishings['string-lights'],187,91,394,123);
  if(level('deco-1'))c.drawImage(this.furnishings['paper-garden'],19,849,102,102);
  if(level('deco-2')){c.drawImage(this.furnishings['memorial-plaque'],563,163,152,61);c.fillStyle='#f9d692';c.textAlign='center';c.font='20px monospace';c.fillText('LR–01',639,201);}
  if(level('deco-3')){c.save();c.translate(95,180);c.rotate(reduced?0:Math.sin(t*.17)*.026);c.drawImage(this.furnishings.armillary,-38,-50,76,98);c.restore();}
  // Restrained pixel dust follows the room lamp, never slides the room plate.
  for(let i=0;i<(reduced?0:7);i++){const x=55+(i*137)%660+Math.sin(t*.2+i)*4,y=220+(i*71+t*2)%620;c.fillStyle=`rgba(255,218,148,${.08+.08*Math.sin(t+i)})`;c.fillRect(Math.round(x),Math.round(y),2,2);}
 }
 drawForegroundFacilities(c:CanvasRenderingContext2D,t:number,level:(id:string)=>number,reduced=false){
  const dock=Math.max(0,Math.min(3,level('dock')));if(!dock)return;
  this.dockShip??=image(shipUrl);
  c.save();c.fillStyle='#100b2866';c.beginPath();c.ellipse(654,942,84,12,0,0,Math.PI*2);c.fill();
  c.fillStyle='#311d4c';c.beginPath();c.ellipse(654,935,80,15,0,0,Math.PI*2);c.fill();c.strokeStyle='#bb864d';c.lineWidth=4;c.stroke();
  c.strokeStyle='#d4ad70';c.lineWidth=2;c.beginPath();c.ellipse(654,932,63,9,0,0,Math.PI*2);c.stroke();
  for(let i=0;i<dock*2;i++){c.fillStyle='#ffdc89';c.fillRect(586+i*25,933+(i%2)*3,7,4);}
  if(dock>=2){for(const side of [-1,1]){const x=654+side*62;c.fillStyle='#7b4b68';c.fillRect(x-4,905,8,25);c.fillStyle='#e3a454';c.fillRect(x-6,904,12,4);c.strokeStyle='#d6a36e';c.lineWidth=3;c.beginPath();c.moveTo(x,912);c.lineTo(x-side*15,919);c.stroke();}}
  if(this.dockShip.complete&&this.dockShip.naturalWidth){const hover=reduced?0:Math.sin(t*.8)*1.2;c.drawImage(this.dockShip,0,0,256,256,595,841+hover,118,118);}
  if(dock>=3){c.fillStyle='#80527b';c.fillRect(580,926,8,12);c.fillRect(721,926,8,12);c.fillStyle='#68dafa';c.fillRect(581,923,6,4);c.fillRect(722,923,6,4);}
  c.restore();
 }
 pose(seconds:number,level:(id:string)=>number){
  return renewalMuseumPose(seconds,level);
 }
}
