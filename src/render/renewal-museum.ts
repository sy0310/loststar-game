import roomUrl from '../../assets/runtime/visual-renewal/museum/room.webp';
import shipUrl from '../../assets/runtime/visual-renewal/world/ship-atlas.webp';
import paneUrl from '../../assets/runtime/visual-renewal/museum/pane-reflections.webp';
import {exhibitIds,itemCenter,type Exhibit} from './museum-layout';
import {baseRobotPose} from './base-motion';
import type {MuseumOptions} from './museum';
import {physicalMuseumExhibits,museumCaseGeometry,museumBaseHeights,museumCapHeights,museumSpace,museumDoorPanels} from './museum-space';
import {museumServicePose,museumDisplaySpecimen,MuseumVisitEligibility,type MuseumServicePose} from './museum-service';
const urls=import.meta.glob('../../assets/runtime/visual-renewal/museum/case-*.webp',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const furnishingUrls=import.meta.glob('../../assets/runtime/visual-renewal/museum/{string-lights,paper-garden,memorial-plaque,armillary}.webp',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const levelBase=museumBaseHeights,levelCap=museumCapHeights;
/** Fit the complete owned case, including its separate plaque and floor shadow. */
export function renewalExhibitViewport(level:number,width:number,height:number){
 const index=Math.max(0,Math.min(3,Math.floor(level))),top=-levelBase[index]-museumSpace.innerHeight-levelCap[index]-4,bottom=48;
 const scale=Math.min((width-40)/210,(height-40)/(bottom-top));
 return {scale,top,bottom,originY:(height-(bottom-top)*scale)/2-top*scale};
}
const labels=['未购买收据','道歉胶带','套娃包裹','昨日邮戳','收件人：宇宙','无人签收铃'];
/** New room registration. The display cavity and walking aisles belong to the same camera. */
export const renewalExhibits:Exhibit[]=physicalMuseumExhibits;
/** Align the authored specimen's true sole with its cradle, not its transparent cell centre. */
export function renewalDisplaySpecimen(exhibit:Exhibit,level:number):Exhibit{
 return museumDisplaySpecimen(exhibit,level);
}
export function renewalMuseumPose(seconds:number,level:(id:string)=>number,canHandle?:(id:string)=>boolean){
 return museumServicePose(seconds,level,canHandle);
}

const image=(url:string)=>{const img=new Image();img.src=url;return img;};
const smooth=(raw:number)=>{const t=Math.max(0,Math.min(1,raw));return t*t*(3-2*t);};
export class RenewalMuseum {
 readonly room=image(roomUrl);
 readonly pane=image(paneUrl);
 readonly glass=Array.from({length:4},(_,level)=>(['back','front'] as const).map(layer=>image(urls[`../../assets/runtime/visual-renewal/museum/case-${level}-${layer}.webp`])));
 readonly furnishings=Object.fromEntries(Object.entries(furnishingUrls).map(([path,url])=>[path.split('/').at(-1)!.replace('.webp',''),image(url)]));
 private dockShip?:HTMLImageElement;
 private observed=new Map<string,number>();
 private installations=new Map<string,{level:number;at:number}>();
 private visitEligibility=new MuseumVisitEligibility();
 ready=Promise.all([this.room,this.pane,...this.glass.flat(),...Object.values(this.furnishings)].map(img=>img.decode())).then(()=>undefined);
 retry(){for(const img of [this.room,this.pane,...this.glass.flat(),...Object.values(this.furnishings)]){const url=new URL(img.src);url.searchParams.set('retry',String(Date.now()));img.src=url.href;}this.ready=Promise.all([this.room,this.pane,...this.glass.flat(),...Object.values(this.furnishings)].map(img=>img.decode())).then(()=>undefined);return this.ready;}
 /** Fixed bottom/top material slices keep the display cavity readable at every purchased level. */
 private registeredCase(c:CanvasRenderingContext2D,image:HTMLImageElement,level:number,x:number,y:number,_width:number,opening=0,front=false,assembly=1){
  const g=museumCaseGeometry({x,y},level),{source,base,cap}=g,inside=museumSpace.innerHeight;
  const sx=[0,source.left,source.right,320],dx=[g.bounds.left,x-64,x+64,g.bounds.right];
  const sy=[0,source.top,source.floor,400],dy=[g.ceiling-cap,g.ceiling,g.floor,y];
  c.save();
  if(front){
   // Five registered panes telescope into a <=34px stack under the existing
   // 36px+ hood. A full-height rigid pane cannot fit inside that hood.
   c.beginPath();c.rect(x-64,g.ceiling,128,inside);c.clip();
   for(const {bounds,sourceOffset,height} of museumDoorPanels(g,opening)){
    c.globalAlpha=.30;c.drawImage(this.pane,0,sourceOffset,128,height,bounds.left,bounds.top,128,height);
    // An actual fine lower edge on each moving glass leaf makes the telescoping
    // mechanism readable; the side rails and outer structural posts stay fixed.
    c.globalAlpha=.50;c.strokeStyle='#c5deed';c.lineWidth=1;c.beginPath();c.moveTo(bounds.left+2,bounds.bottom-.5);c.lineTo(bounds.right-2,bounds.bottom-.5);c.stroke();
   }
   c.restore();return {left:g.bounds.left,top:g.ceiling,width:g.width,height:inside,floor:g.floor,head:g.ceiling-cap,scale:g.width/320};
  }
  for(let row=0;row<3;row++)for(let column=0;column<3;column++){
   c.save();if(!front&&row===0){c.translate(0,-18*(1-assembly));c.globalAlpha*=.45+.55*assembly;}
   c.drawImage(image,sx[column],sy[row],sx[column+1]-sx[column],sy[row+1]-sy[row],dx[column],dy[row],dx[column+1]-dx[column],dy[row+1]-dy[row]);c.restore();
  }
  c.restore();
  return {left:g.bounds.left,top:g.ceiling,width:g.width,height:inside,floor:g.floor,head:g.ceiling-cap,scale:g.width/320};
 }
 drawSupport(c:CanvasRenderingContext2D,e:Exhibit,level:number,floor:number,t:number){
  // Every basic specimen has a real fitted cradle; higher levels add its own archive instrument.
  const x=e.x,w=e.id==='receipt'?79:e.id==='stamp'?62:94;
  c.fillStyle='#100b2480';c.beginPath();c.ellipse(x,floor-4,w*.50,7,0,0,Math.PI*2);c.fill();
  c.fillStyle='#2f1a4c';c.fillRect(x-w/2,floor-12,w,9);c.fillStyle='#e3a454';c.fillRect(x-w/2,floor-13,w,2);c.fillStyle='#8a514b';c.fillRect(x-w/2+3,floor-4,w-6,3);
  // The receipt owns its registered archive backboard and retaining lip. A
  // second pair of generic columns would cut through that single-paper mount.
  if(e.id==='stamp'){
   c.fillStyle='#bf9764';c.fillRect(x-23,floor-20,46,6);c.fillStyle='#ecd2a0';c.fillRect(x-18,floor-24,36,4);
  }else if(e.id==='cosmic-parcel'){
   c.fillStyle='#c98c4f';for(const side of [-1,1])c.fillRect(x+side*36-4,floor-24,8,12);
  }else if(e.id==='bell'){
   c.fillStyle='#9c667b';c.fillRect(x-42,floor-18,84,5);c.fillStyle='#edc883';c.fillRect(x-39,floor-19,78,2);
  }else if(e.id!=='receipt'&&e.id!=='tape'){
   c.strokeStyle='#dda35a';c.lineWidth=3;c.strokeRect(x-38,floor-21,76,9);
  }
  if(level<2||e.id==='tape')return;
  c.save();c.translate(x,floor-2);
  if(e.id==='receipt'){c.fillStyle='#ba8fe3';c.fillRect(-39,-87,5,4);c.fillRect(34,-87,5,4);c.strokeStyle='#9775b7';c.lineWidth=2;c.beginPath();c.moveTo(-35,-75);c.lineTo(-50,-49);c.lineTo(-50,-10);c.stroke();}
  else if(e.id==='nested'){for(let i=0;i<3;i++){c.strokeStyle=['#cd9252','#efc27c','#9571c2'][i];c.lineWidth=2;c.strokeRect(-42+i*5,-28+i*4,84-i*10,8);}}
  else if(e.id==='stamp'){c.fillStyle='#e8c894';c.fillRect(-31,-26,62,8);c.fillStyle='#815fa7';c.fillRect(-26,-23,29,2);c.fillRect(-26,-19,20,1);}
  else if(e.id==='cosmic-parcel'){c.strokeStyle='#9c80c9';c.lineWidth=2;c.beginPath();c.ellipse(0,-28,43,9,-.12,0,Math.PI*2);c.stroke();c.fillStyle='#d6c5e9';for(let i=0;i<4;i++)c.fillRect(-37+i*24,-20-Math.sin(t*.25+i)*2,2,2);}
  else{c.strokeStyle='#b79ccb';c.lineWidth=2;for(let i=0;i<3;i++){c.beginPath();c.ellipse(0,-23,30+i*5,4+i*2,0,0,Math.PI*2);c.stroke();}}
  c.restore();
 }
 private installation(e:Exhibit,t:number,level:number,forced?:number){
  const previous=this.observed.get(e.id);if(forced===undefined){if(previous!==undefined&&previous!==level)this.installations.set(e.id,{level,at:t});this.observed.set(e.id,level);}
  const install=this.installations.get(e.id);return forced??(install?smooth((t-install.at)/1.8):1);
 }
 /** Rear hood/interior and near structural faces have separate physical depth keys. */
 drawCaseRear(c:CanvasRenderingContext2D,e:Exhibit,t:number,level:number,forcedInstall?:number){
  const g=museumCaseGeometry(e,level),progress=this.installation(e,t,g.level,forcedInstall);
  c.save();c.fillStyle='#120b306b';c.beginPath();c.ellipse(e.x+3,e.y+3,e.width*.53,13,0,0,Math.PI*2);c.fill();
  c.beginPath();c.rect(g.bounds.left,g.bounds.top-18,e.width,g.ceiling-g.bounds.top+18);c.rect(e.x-64,g.ceiling,128,g.floor-g.ceiling-5);c.clip();
  this.registeredCase(c,this.glass[g.level][0],g.level,e.x,e.y,e.width,0,false,progress);c.restore();
 }
 drawCaseContents(c:CanvasRenderingContext2D,e:Exhibit,t:number,known:boolean,level:number,itemImage:HTMLImageElement,options:MuseumOptions,service?:MuseumServicePose){
  const g=museumCaseGeometry(e,level),extension=service?.trayExtension??0,raise=service?.trayLift??0,physical=renewalDisplaySpecimen(e,g.level);
  c.save();
  // Before crossing the actual front plane the complete silhouette fits the portal.
  // Once outside, perspective permits the elevated tray to cover the base face.
  if(extension<=4){c.beginPath();c.rect(g.aperture.left,g.aperture.top,g.aperture.right-g.aperture.left,g.floor-g.aperture.top-3);c.clip();}
  c.save();c.translate(0,extension-raise);this.drawSupport(c,e,g.level,g.floor,t);c.restore();
  if(known){
   const center=service?.item??{...itemCenter(physical),y:itemCenter(physical).y+extension-raise};
   const current=itemCenter(physical),actual={...physical,x:physical.x+center.x-current.x,y:physical.y+center.y-current.y};
   if(!options.drawSpecimen?.(c,actual,t,itemImage,service)){const size=actual.item.size;c.drawImage(itemImage,center.x-size/2,center.y-size/2,size,size);}
  }
  c.restore();
 }
 drawCaseNear(c:CanvasRenderingContext2D,e:Exhibit,t:number,known:boolean,level:number,options:MuseumOptions,service?:MuseumServicePose,forcedInstall?:number){
  const g=museumCaseGeometry(e,level),progress=this.installation(e,t,g.level,forcedInstall),opening=Math.max(service?.opening??0,options.specimenOpening?.(e.id)??0);
  c.save();c.beginPath();c.rect(g.bounds.left,g.ceiling,22,g.floor-g.ceiling);c.rect(e.x+64,g.ceiling,22,g.floor-g.ceiling);c.rect(g.bounds.left,g.floor-5,e.width,e.y-g.floor+5);c.clip();
  this.registeredCase(c,this.glass[g.level][0],g.level,e.x,e.y,e.width,0,false,progress);c.restore();
  this.registeredCase(c,this.glass[g.level][1],g.level,e.x,e.y,e.width,opening,true);
  c.save();c.globalAlpha=.65;c.strokeStyle='#9d86a3';c.lineWidth=2;
  for(const side of [-1,1]){c.beginPath();c.moveTo(e.x+side*63,g.ceiling+3);c.lineTo(e.x+side*63,g.floor-3);c.stroke();c.fillStyle='#e3a454';for(const pane of museumDoorPanels(g,0))c.fillRect(e.x+side*65-1,pane.bounds.top+1,2,3);}
  c.restore();
  if(progress<1){
   c.strokeStyle='#c88b54';c.lineWidth=3;c.globalAlpha=1-progress*.6;
   for(const side of [-1,1]){const x=e.x+side*80,grip=g.bounds.top-18*(1-progress)+8;c.beginPath();c.moveTo(x,e.y-4);c.lineTo(x,grip);c.lineTo(e.x+side*64,grip);c.stroke();c.fillStyle='#f6cc86';c.fillRect(e.x+side*64-3,grip-3,6,6);}
   c.globalAlpha=1;
  }
  const plaque=known?labels[exhibitIds.indexOf(e.id)]:'等待发现',label=g.plaque;
  c.fillStyle='#1e1238';c.fillRect(label.left,label.top,label.right-label.left,label.bottom-label.top);c.strokeStyle=known?'#dca456':'#795d8c';c.lineWidth=1.5;c.strokeRect(label.left,label.top,label.right-label.left,label.bottom-label.top);
  c.fillStyle=known?'#ffe0a2':'#b9a6ca';c.font='21px "PingFang SC", sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(plaque,e.x,(label.top+label.bottom)/2,124);
 }
 drawExhibit(c:CanvasRenderingContext2D,e:Exhibit,t:number,known:boolean,level:number,itemImage:HTMLImageElement,options:MuseumOptions,service?:ReturnType<typeof baseRobotPose>,forcedInstall?:number){
  const g=museumCaseGeometry(e,level);
  this.drawCaseRear(c,e,t,g.level,forcedInstall);
  this.drawCaseContents(c,e,t,known,g.level,itemImage,options,service as MuseumServicePose|undefined);
  this.drawCaseNear(c,e,t,known,g.level,options,service as MuseumServicePose|undefined,forcedInstall);
  return {physical:renewalDisplaySpecimen(e,g.level),center:itemCenter(e),geometry:g};
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
  c.save();c.translate(12,0);c.fillStyle='#100b2866';c.beginPath();c.ellipse(654,942,84,12,0,0,Math.PI*2);c.fill();
  c.fillStyle='#311d4c';c.beginPath();c.ellipse(654,935,80,15,0,0,Math.PI*2);c.fill();c.strokeStyle='#bb864d';c.lineWidth=4;c.stroke();
  c.strokeStyle='#d4ad70';c.lineWidth=2;c.beginPath();c.ellipse(654,932,63,9,0,0,Math.PI*2);c.stroke();
  for(let i=0;i<dock*2;i++){c.fillStyle='#ffdc89';c.fillRect(586+i*25,933+(i%2)*3,7,4);}
  if(dock>=2){for(const side of [-1,1]){const x=654+side*62;c.fillStyle='#7b4b68';c.fillRect(x-4,905,8,25);c.fillStyle='#e3a454';c.fillRect(x-6,904,12,4);c.strokeStyle='#d6a36e';c.lineWidth=3;c.beginPath();c.moveTo(x,912);c.lineTo(x-side*15,919);c.stroke();}}
  if(this.dockShip.complete&&this.dockShip.naturalWidth){const hover=reduced?0:Math.sin(t*.8)*1.2;c.drawImage(this.dockShip,0,0,256,256,595,841+hover,118,118);}
  if(dock>=3){c.fillStyle='#80527b';c.fillRect(580,926,8,12);c.fillRect(721,926,8,12);c.fillStyle='#68dafa';c.fillRect(581,923,6,4);c.fillRect(722,923,6,4);}
  c.restore();
 }
 pose(seconds:number,level:(id:string)=>number,canHandle?:(id:string)=>boolean){
  const allowed=this.visitEligibility.resolve(seconds,canHandle??(()=>true));
  return renewalMuseumPose(seconds,level,()=>allowed);
 }
 resetVisit(){this.visitEligibility.reset();}
}
