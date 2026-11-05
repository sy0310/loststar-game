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
export function renewalMuseumPose(seconds:number,level:(id:string)=>number){
 const p=baseRobotPose(seconds,renewalExhibits),e=renewalExhibits.find(e=>e.id===p.target)!,physical=renewalDisplaySpecimen(e,level(`case-${exhibitIds.indexOf(e.id)}`));
 const next=itemCenter(physical),previous=itemCenter(e),dx=next.x-previous.x,dy=next.y-previous.y;
 const direction=e.x<p.x?-1:1;
 return {...p,width:136,shoulder:{x:p.x+direction*20.4,y:p.y-58.65},item:{x:p.item.x+dx*(1-p.lift),y:p.item.y+dy*(1-p.lift)-21*p.lift},hand:{x:p.hand.x+dx*(1-p.lift)*p.contact,y:p.hand.y+dy*(1-p.lift)*p.contact-21*p.lift*p.contact}};
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
  if(e.id==='receipt'){
   for(const side of [-1,1]){c.fillStyle='#8464aa';c.fillRect(x+side*35-3,floor-76,6,65);c.fillStyle='#f2c47c';c.fillRect(x+side*35-5,floor-78,10,5);}
  }else if(e.id==='tape'){
   c.fillStyle='#5a3572';c.fillRect(x-31,floor-43,8,31);c.fillRect(x+23,floor-43,8,31);c.fillStyle='#e6aa62';c.fillRect(x-31,floor-45,62,5);
  }else if(e.id==='stamp'){
   c.fillStyle='#bf9764';c.fillRect(x-23,floor-20,46,6);c.fillStyle='#ecd2a0';c.fillRect(x-18,floor-24,36,4);
  }else if(e.id==='cosmic-parcel'){
   c.fillStyle='#c98c4f';for(const side of [-1,1])c.fillRect(x+side*36-4,floor-24,8,12);
  }else if(e.id==='bell'){
   c.fillStyle='#9c667b';c.fillRect(x-42,floor-18,84,5);c.fillStyle='#edc883';c.fillRect(x-39,floor-19,78,2);
  }else{
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
  const plaque=known?labels[exhibitIds.indexOf(e.id)]:'等待下一次发现';
  c.fillStyle='#1e1238';c.fillRect(e.x-92,e.y+8,184,30);c.strokeStyle=known?'#dca456':'#795d8c';c.lineWidth=1.5;c.strokeRect(e.x-92,e.y+8,184,30);
  c.fillStyle=known?'#ffe0a2':'#b9a6ca';c.font='20px "PingFang SC", sans-serif';c.textAlign='center';c.textBaseline='alphabetic';c.fillText(plaque,e.x,e.y+30,176);
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
