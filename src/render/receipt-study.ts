import {receiptGeometry} from '../review/d1-motion';
import {itemCenter,layerPoint,type Exhibit} from './museum-layout';
import registrationJson from '../../assets/runtime/d1/registration.json';
import {
 createReceiptSpecimenAssets,
 drawReceiptSpecimen,
 receiptSpecimenRegistration,
 type ReceiptLight,
 type ReceiptSpecimenAssets,
} from './receipt-specimen';

/** D1 deliberately keeps the room camera and actual specimen registration at every tier. */
export const receiptFocusCamera={left:65,top:290,width:220,height:310} as const;
export const receiptSpecimenCamera={left:128,top:392,width:94,height:108} as const;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(from:number,to:number,p:number)=>{const f=clamp((p-from)/(to-from));return f*f*(3-2*f);};
export function receiptAssembly(level:number,progress:number){
 const p=clamp(progress),base=smooth(0,.52,p),machine=smooth(.15,.75,p),shell=smooth(.24,.90,p);
 return {baseOffsetY:level?36*(1-base):0,mechanismOffsetY:level>=2?32*(1-machine):0,shellSplit:level>=3?46*(1-shell):0,crownOffsetY:level>=3?-40*(1-shell):0,nameplateOffsetY:level?18*(1-smooth(.45,.92,p)):0,lamp:level?smooth(.65,1,p):0,itemOffset:{x:0,y:0}};
}
export type ReceiptStudyAssets={base:HTMLImageElement;mechanism:HTMLImageElement;vault:HTMLImageElement}&ReceiptSpecimenAssets;
type SourceRect={x:number;y:number;width:number;height:number};
type WorldRect={left:number;top:number;width:number;height:number};
type RegisteredImage={world:{draw:WorldRect;cavity?:WorldRect|null};outputSize:{width:number;height:number};parts:Record<string,SourceRect>};
const registrations=(registrationJson as unknown as {files:Record<string,RegisteredImage>}).files;
function registeredRect(name:string,e:Exhibit,fallback:{left:number;top:number;width:number;height:number}){
 const measured=registrations[name]?.world.draw??fallback,scale=e.scale/(98/164);
 return {left:e.x+(measured.left-175)*scale,top:e.y+(measured.top-526)*scale,width:measured.width*scale,height:measured.height*scale};
}
export function receiptVaultWindow(e:Exhibit){
 const cavity=registrations['receipt-vault-l3']?.world.cavity;if(!cavity)throw new Error('D1 vault aperture registration is missing');
 const s=e.scale/(98/164);return {left:e.x+(cavity.left-175)*s,top:e.y+(cavity.top-526)*s,width:cavity.width*s,height:cavity.height*s,archRise:28*s};
}
type VaultWindow=ReturnType<typeof receiptVaultWindow>;
function glassArch(c:CanvasRenderingContext2D,w:VaultWindow){
 const left=w.left,right=left+w.width,cx=left+w.width/2,top=w.top,rise=w.archRise;c.moveTo(left,top);c.bezierCurveTo(left,top-rise*.60,cx-w.width*.23,top-rise,cx,top-rise);c.bezierCurveTo(cx+w.width*.23,top-rise,right,top-rise*.60,right,top);
}
function glassPane(c:CanvasRenderingContext2D,w:VaultWindow){
 const bottom=w.top+w.height;c.beginPath();glassArch(c,w);c.lineTo(w.left+w.width,bottom-3);c.quadraticCurveTo(w.left+w.width/2,bottom+2,w.left,bottom-3);c.closePath();
}
function vaultGlassBack(c:CanvasRenderingContext2D,w:VaultWindow){
 c.save();glassPane(c,w);const color=c.createLinearGradient(w.left,w.top-w.archRise,w.left+w.width,w.top+w.height);color.addColorStop(0,'rgba(126,216,207,.09)');color.addColorStop(.5,'rgba(80,172,182,.035)');color.addColorStop(1,'rgba(127,218,210,.075)');c.fillStyle=color;c.fill();c.strokeStyle='rgba(153,219,213,.17)';c.lineWidth=1;c.stroke();c.restore();
}
function vaultGlassFront(c:CanvasRenderingContext2D,w:VaultWindow,progress:number){
 const right=w.left+w.width,bottom=w.top+w.height;c.save();c.globalAlpha=.35+.65*smooth(.45,.95,progress);glassPane(c,w);c.clip();
 // Narrow diagonal reflections let the room and original receipt stay visible through the pane.
 c.fillStyle='rgba(225,255,242,.14)';c.beginPath();c.moveTo(w.left+6,w.top+12);c.lineTo(right-10,w.top+51);c.lineTo(right-10,w.top+53);c.lineTo(w.left+6,w.top+14);c.closePath();c.fill();
 c.fillStyle='rgba(224,255,244,.10)';c.beginPath();c.moveTo(w.left+9,w.top+29);c.lineTo(w.left+29,w.top+43);c.lineTo(w.left+29,w.top+44);c.lineTo(w.left+9,w.top+30);c.closePath();c.fill();
 c.strokeStyle='rgba(220,251,238,.48)';c.lineWidth=1;c.beginPath();glassArch(c,w);c.stroke();
 c.fillStyle='rgba(222,255,242,.34)';c.fillRect(w.left+2,w.top+9,1,bottom-w.top-22);c.fillRect(right-3,w.top+19,1,34);c.fillStyle='rgba(242,255,234,.17)';c.fillRect(w.left+5,w.top+12,1,23);
 c.strokeStyle='rgba(192,243,224,.28)';c.beginPath();c.moveTo(w.left,bottom-3);c.quadraticCurveTo(w.left+w.width/2,bottom+2,right,bottom-3);c.stroke();c.restore();
}
function baseLighting(c:CanvasRenderingContext2D,e:Exhibit,offset:number,light:number,t:number){
 const entry=registrations['receipt-base-l1'];if(!entry)return;const base=registeredRect('receipt-base-l1',e,entry.world.draw);
 for(const key of ['leftLamp','rightLamp']){const p=entry.parts[key];if(!p)continue;const x=base.left+p.x/entry.outputSize.width*base.width,y=base.top+p.y/entry.outputSize.height*base.height+offset,w=p.width/entry.outputSize.width*base.width,h=p.height/entry.outputSize.height*base.height;
  c.save();c.globalAlpha=.85*(1-light);c.fillStyle='#20192b';c.fillRect(x,y,w,h);c.globalAlpha=light*(.16+.06*Math.sin(t*2));c.fillStyle='#ffdf8b';c.fillRect(x-2,y-2,w+4,h+4);c.globalAlpha=light*.8;c.fillStyle='#ffe6a8';c.fillRect(x+2,y+h/2,w-4,1);c.restore();
 }
}
const urls=import.meta.glob('../../assets/runtime/d1/*.webp',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
/** Only called by opt-in D1 MuseumScene instances; regular home never requests these textures. */
export function createReceiptStudyAssets():ReceiptStudyAssets{
 const load=(name:string)=>{const url=urls[`../../assets/runtime/d1/${name}.webp`];if(!url)throw new Error(`Missing D1 receipt part: ${name}`);const image=new Image();image.src=url;return image;};
 return {base:load('receipt-base-l1'),mechanism:load('receipt-mechanism-l2'),vault:load('receipt-vault-l3'),...createReceiptSpecimenAssets()};
}
function receiptStudyLights(
 e:Exhibit,
 level:number,
 install:number,
){
 const assembly=receiptAssembly(level,install);
 const base=registrations['receipt-base-l1'];
 const baseRect=registeredRect('receipt-base-l1',e,base.world.draw);
 const lights:ReceiptLight[]=[];
 if(level===3){
  for(const emitter of receiptSpecimenRegistration().common.vaultEmitters??[]){
   const light=emitter.world;
   lights.push({x:light.x+light.width/2,y:light.y+light.height/2,strength:assembly.lamp*.7});
  }
 }else if(level>0){
  for(const key of ['leftLamp','rightLamp']){
   const lamp=base.parts[key];
   lights.push({
    x:baseRect.left+(lamp.x+lamp.width/2)/base.outputSize.width*baseRect.width,
    y:baseRect.top+(lamp.y+lamp.height/2)/base.outputSize.height*baseRect.height+assembly.baseOffsetY,
    strength:assembly.lamp*.8,
   });
  }
 }
 // The existing wall lantern is the ambient key. Mounted cabinet emitters supply local warm fill.
 lights.push({x:e.x+107,y:e.y-211,strength:.28});
 return lights;
}
export function drawStudyReceiptSpecimen(
 c:CanvasRenderingContext2D,
 e:Exhibit,
 t:number,
 level:number,
 install:number,
 assets:ReceiptStudyAssets,
){
 return drawReceiptSpecimen(c,assets,{
  center:itemCenter(e),frame:e.item.size*e.scale,
  seconds:t,level,installation:install,lights:receiptStudyLights(e,level,install),glass:level===3?.85:.5,
 });
}
export function receiptFloorGeometry(e:Exhibit,level:number){
 const key=level===0?'basic':level===3?'vault':'brass';
 const floor=receiptSpecimenRegistration().common.floorReceivers[key];
 const scale=e.scale/(98/164);
 const world=floor.worldRect;
 let frontY=layerPoint(e,e.base.x,floor.sourceFrontLipY).y;
 if(level>0){
  const name=level===3?'receipt-vault-l3':'receipt-base-l1';
  const entry=registrations[name],image=registeredRect(name,e,entry.world.draw);
  frontY=image.top+floor.frontLipY!/entry.outputSize.height*image.height;
 }
 return {
  x:e.x+(world.x-175)*scale,
  y:e.y+(world.y-526)*scale,
  width:world.width*scale,
  height:world.height*scale,
  frontY,
  hasBakedFloorFill:floor.hasBakedFloorFill,
 };
}
export function drawStudyReceiptFloor(
 c:CanvasRenderingContext2D,
 e:Exhibit,
 level:number,
 install:number,
 assets:ReceiptStudyAssets,
 layer:'surface'|'shadow'='shadow',
){
 const measured=receiptFloorGeometry(e,level);
 const assembly=receiptAssembly(level,install);
 const receiver={...measured,y:measured.y+assembly.baseOffsetY};
 const cx=receiver.x+receiver.width/2,cy=receiver.y+receiver.height/2;
 c.save();
 c.beginPath();
 c.ellipse(cx,cy,receiver.width/2,receiver.height/2,0,0,Math.PI*2);
 c.clip();
 if(layer==='surface'){
  if(!receiver.hasBakedFloorFill){
   // The open vault frame has no baked floor. Its measured inner rim receives the same
   // purple material as the brass socket, under the original foreground metal lip.
   const material=receiptSpecimenRegistration().common.floorReceivers.brass.outputRect!;
   c.drawImage(
    assets.base,material.x,material.y,material.width,material.height,
    receiver.x,receiver.y,receiver.width,receiver.height,
   );
   const shade=c.createLinearGradient(0,receiver.y,0,receiver.y+receiver.height);
   shade.addColorStop(0,'rgba(230,182,120,.08)');
   shade.addColorStop(1,'rgba(22,13,34,.14)');
   c.fillStyle=shade;
   c.fillRect(receiver.x,receiver.y,receiver.width,receiver.height);
  }
  c.restore();
  return;
 }
 const center=itemCenter(e),distance=Math.max(0,cy-center.y);
 const lights=receiptStudyLights(e,level,install);
 const total=lights.reduce((sum,light)=>sum+light.strength,0);
 const keyX=lights.reduce((sum,light)=>sum+light.x*light.strength,0)/total;
 const shift=Math.max(-3,Math.min(3,(center.x-keyX)*.025));
 const alpha=(level===0?1:assembly.lamp)*Math.max(.07,.18-distance*.0013);
 c.fillStyle=`rgba(12,7,22,${alpha*.4})`;
 c.beginPath();
 c.ellipse(center.x+shift,cy,14,1.8,0,0,Math.PI*2);
 c.fill();
 c.fillStyle=`rgba(12,7,22,${alpha})`;
 c.beginPath();
 c.ellipse(center.x+shift,cy,11,1.1,0,0,Math.PI*2);
 c.fill();
 c.restore();
}
type ReceiptDraw={e:Exhibit;t:number;level:number;install:number;known:boolean;back:HTMLImageElement;front:HTMLImageElement;item:HTMLImageElement;assets:ReceiptStudyAssets};
function sprite(c:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number){if(img.complete&&img.naturalWidth)c.drawImage(img,Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function vaultParts(c:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number,assembly:ReturnType<typeof receiptAssembly>,layer:'rear'|'front'){
 const iw=img.naturalWidth,ih=img.naturalHeight;if(!iw||!ih)return;
 const parts=registrations['receipt-vault-l3']?.parts,crown=Math.round(parts?.centralFrame?.y??ih*.20),base=ih-Math.round(parts?.base?.y??ih*.85),middle=ih-crown-base,scaleY=h/ih;
 const frontStart=receiptSpecimenRegistration().common.floorReceivers.vault.frontLipY!;
 // Actual source slices assemble independently; all source registration matches at progress=1.
 const strip=(sx:number,sy:number,sw:number,sh:number,dx:number,dy:number,dw:number,dh:number)=>c.drawImage(img,sx,sy,sw,sh,Math.round(dx),Math.round(dy),Math.round(dx+dw)-Math.round(dx),Math.round(dy+dh)-Math.round(dy));
 if(layer==='rear'){
  strip(0,ih-base,iw,frontStart-(ih-base),x,y+(ih-base)*scaleY+assembly.baseOffsetY,w,(frontStart-(ih-base))*scaleY);
  return;
 }
 strip(0,0,iw,crown,x,y+assembly.crownOffsetY,w,crown*scaleY);
 strip(0,crown,iw/2,middle,x-assembly.shellSplit,y+crown*scaleY,w/2,middle*scaleY);
 strip(iw/2,crown,iw/2,middle,x+w/2+assembly.shellSplit,y+crown*scaleY,w/2,middle*scaleY);
 strip(0,frontStart,iw,ih-frontStart,x,y+frontStart*scaleY+assembly.baseOffsetY,w,(ih-frontStart)*scaleY);
}
function brassBaseLayer(c:CanvasRenderingContext2D,e:Exhibit,img:HTMLImageElement,offset:number,layer:'rear'|'front'){
 const entry=registrations['receipt-base-l1'];
 const rect=registeredRect('receipt-base-l1',e,entry.world.draw);
 const cut=receiptSpecimenRegistration().common.floorReceivers.brass.frontLipY!;
 const start=layer==='rear'?0:cut,end=layer==='rear'?cut:img.naturalHeight;
 const top=rect.top+offset+start/img.naturalHeight*rect.height;
 const bottom=rect.top+offset+end/img.naturalHeight*rect.height;
 c.drawImage(img,0,start,img.naturalWidth,end-start,Math.round(rect.left),Math.round(top),Math.round(rect.width),Math.round(bottom)-Math.round(top));
}
function pixelLine(c:CanvasRenderingContext2D,x:number,y:number,w:number,color:string){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),2);}
function independentPlaque(c:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,level:number,known:boolean){
 const plate=registrations['receipt-base-l1']?.parts.nameplate,w=118,h=plate?w*plate.height/plate.width:25;
 c.fillStyle='#22182b';c.fillRect(x-w/2-2,y-2,w+4,h+4);
 if(plate)c.drawImage(img,plate.x,plate.y,plate.width,plate.height,x-w/2,y,w,h);else{c.fillStyle='#c9a065';c.fillRect(x-w/2,y,w,h);}
 c.strokeStyle=level===3?'#a7d4c4':'#e4bd79';c.lineWidth=1;c.strokeRect(x-w/2,y,w,h);c.fillStyle='#38212d';c.font='bold 17px monospace';c.textAlign='center';c.fillText(known?'未购买收据':'等待好奇心',x,y+h*.76,w-15);
}
function paperMechanism(c:CanvasRenderingContext2D,img:HTMLImageElement,e:Exhibit,t:number,offset:number,installation:number){
 const entry=registrations['receipt-mechanism-l2'];if(!entry)return;const machine=registeredRect('receipt-mechanism-l2',e,entry.world.draw);
 const registeredPart=(part:SourceRect)=>({x:machine.left+part.x/entry.outputSize.width*machine.width,y:machine.top+part.y/entry.outputSize.height*machine.height+offset,w:part.width/entry.outputSize.width*machine.width,h:part.height/entry.outputSize.height*machine.height});
 // Reuse the actual illustrated gears instead of covering fine artwork with a flat mechanical icon.
 for(const [i,key]of ['leftGear','rightGear'].entries()){const part=entry.parts[key];if(!part)continue;const r=registeredPart(part);c.save();c.translate(r.x+r.w/2,r.y+r.h/2);c.beginPath();c.arc(0,0,Math.min(r.w,r.h)*.48,0,Math.PI*2);c.clip();c.rotate(t*(i?-.9:.9));c.drawImage(img,part.x,part.y,part.width,part.height,-r.w/2,-r.h/2,r.w,r.h);c.restore();}
 const outlet=entry.parts.ticketOutlet;if(outlet){const r=registeredPart(outlet),feed=(t*7)%Math.max(4,r.h);c.save();c.beginPath();c.rect(r.x,r.y,r.w,r.h);c.clip();c.fillStyle='#f6dfac';c.fillRect(r.x+r.w*.18,r.y-r.h+feed,r.w*.64,r.h);for(let line=0;line<4;line++)pixelLine(c,r.x+r.w*.30,r.y-r.h+feed+line*3,r.w*.4,'#8a6a59');c.restore();}
 const x=e.x,y=machine.top+machine.height+offset,elbow={x:x-34,y:y-17},hand={x:x-28+Math.sin(t*1.8)*2,y:y-22-Math.sin(t*1.8)*2};c.strokeStyle='#d6ad62';c.lineWidth=2;c.beginPath();c.moveTo(x-35,y-3);c.lineTo(elbow.x,elbow.y);c.lineTo(hand.x,hand.y-12*(1-installation));c.stroke();c.fillStyle='#aee6da';c.fillRect(hand.x-2,hand.y-2,4,4);
}
/** Cabinet parts and the flexible specimen share the original museum registration. */
export function drawReceiptStudy(c:CanvasRenderingContext2D,a:ReceiptDraw){
 const {e,t,known,back,front,assets}=a,level=Math.max(0,Math.min(3,Math.round(a.level))),g=receiptGeometry(level),assembly=receiptAssembly(level,a.install),s=e.scale,p=layerPoint(e,e.crop.x,e.crop.y),b=layerPoint(e,e.cavity.x,e.cavity.y),center=itemCenter(e),cavityW=e.cavity.w*s,cavityH=e.cavity.h*s;
 c.save();c.imageSmoothingEnabled=false;c.fillStyle='#120d2860';c.beginPath();c.ellipse(e.x,e.y-2,g.baseWidth*.45,6,0,0,Math.PI*2);c.fill();
 if(level<3){
  // Cut away the old physical base. A new base must never sit on a second pedestal sprite.
  const sourceBottom=252,bodyHeight=(sourceBottom-e.crop.y)*s;c.drawImage(back,e.crop.x,e.crop.y,e.crop.w,sourceBottom-e.crop.y,p.x,p.y,e.crop.w*s,bodyHeight);
 }else{
  // A real registered pane closes the arch: rear glass → machinery → original specimen.
  vaultGlassBack(c,receiptVaultWindow(e));
 }
 if(level===3){
  const vault=registeredRect('receipt-vault-l3',e,{left:175-g.baseWidth/2,top:526-g.frameHeight,width:g.baseWidth,height:g.frameHeight});
  vaultParts(c,assets.vault,vault.left,vault.top,vault.width,vault.height,assembly,'rear');
  drawStudyReceiptFloor(c,e,level,a.install,assets,'surface');
 }else brassBaseLayer(c,e,assets.base,assembly.baseOffsetY,'rear');
 if(level>=2){
  const machine=registeredRect('receipt-mechanism-l2',e,{left:b.x,top:b.y,width:cavityW,height:cavityH});
  c.save();c.beginPath();c.rect(b.x,b.y,cavityW,cavityH);c.clip();sprite(c,assets.mechanism,machine.left,machine.top+assembly.mechanismOffsetY,machine.width,machine.height);paperMechanism(c,assets.mechanism,e,t,assembly.mechanismOffsetY,1-assembly.mechanismOffsetY/32);c.restore();
 }
 if(level>=3){
  // An orbital scanner passes behind the specimen before its foreground half is drawn.
  c.save();c.strokeStyle=`rgba(173,229,208,${.34*assembly.lamp})`;c.lineWidth=1;c.beginPath();c.ellipse(center.x,center.y,44,14,-.25,Math.PI,Math.PI*2);c.stroke();c.restore();
 }
 if(known)drawStudyReceiptFloor(c,e,level,a.install,assets);
 c.save();c.beginPath();c.rect(b.x,b.y,cavityW,cavityH);c.clip();
 const specimen=known?drawStudyReceiptSpecimen(c,e,t,level,a.install,assets):undefined;
 if(level<3){c.save();c.globalAlpha=.9;c.drawImage(front,e.front.x,e.front.y,e.front.w,e.front.h,b.x,b.y,cavityW,cavityH);c.restore();}c.restore();
 if(level===3)vaultGlassFront(c,receiptVaultWindow(e),a.install);
 if(level===3){
  // Split outer shell parts close around an existing glass/receipt chamber, no rescaling specimen.
  const vault=registeredRect('receipt-vault-l3',e,{left:175-g.baseWidth/2,top:526-g.frameHeight,width:g.baseWidth,height:g.frameHeight});vaultParts(c,assets.vault,vault.left,vault.top,vault.width,vault.height,assembly,'front');
  c.save();c.strokeStyle=`rgba(160,237,216,${.38*assembly.lamp})`;c.lineWidth=1;c.beginPath();c.ellipse(center.x,center.y,44,14,-.25,0,Math.PI);c.stroke();
  const angle=t*.65;c.globalAlpha=assembly.lamp;c.fillStyle='#b7a277';for(const side of [-1,1])c.fillRect(center.x+side*44-2,center.y-2,4,4);c.globalAlpha=assembly.lamp*.65;c.fillStyle='#e2ffe6';c.fillRect(center.x+Math.cos(angle)*44-.75,center.y+Math.sin(angle)*14-.75,1.5,1.5);c.restore();
 }else{
  brassBaseLayer(c,e,assets.base,assembly.baseOffsetY,'front');baseLighting(c,e,assembly.baseOffsetY,assembly.lamp,t);
 }
 // Only the lamps brighten, preserving the engraved physical plaque in the artwork.
 // Readable plaque is separate from AI image text and anchored to the same physical plinth.
 independentPlaque(c,assets.base,e.x,e.y+12+assembly.nameplateOffsetY,level,known);
 c.restore();
 return specimen;
}
