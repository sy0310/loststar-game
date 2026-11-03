import {receiptGeometry} from '../review/d1-motion';
import {itemCenter,layerPoint,type Exhibit} from './museum-layout';
import registrationJson from '../../assets/runtime/d1/registration.json';

/** D1 deliberately keeps the room camera and actual specimen registration at every tier. */
export const receiptFocusCamera={left:65,top:290,width:220,height:310} as const;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(from:number,to:number,p:number)=>{const f=clamp((p-from)/(to-from));return f*f*(3-2*f);};
export function receiptAssembly(level:number,progress:number){
 const p=clamp(progress),base=smooth(0,.52,p),machine=smooth(.15,.75,p),shell=smooth(.24,.90,p);
 return {baseOffsetY:level?36*(1-base):0,mechanismOffsetY:level>=2?32*(1-machine):0,shellSplit:level>=3?46*(1-shell):0,crownOffsetY:level>=3?-40*(1-shell):0,nameplateOffsetY:level?18*(1-smooth(.45,.92,p)):0,lamp:level?smooth(.65,1,p):0,itemOffset:{x:0,y:0}};
}
export type ReceiptStudyAssets={base:HTMLImageElement;mechanism:HTMLImageElement;vault:HTMLImageElement};
type SourceRect={x:number;y:number;width:number;height:number};
type RegisteredImage={world:{draw:{left:number;top:number;width:number;height:number}};outputSize:{width:number;height:number};parts:Record<string,SourceRect>};
const registrations=(registrationJson as unknown as {files:Record<string,RegisteredImage>}).files;
function registeredRect(name:string,e:Exhibit,fallback:{left:number;top:number;width:number;height:number}){
 const measured=registrations[name]?.world.draw??fallback,scale=e.scale/(98/164);
 return {left:e.x+(measured.left-175)*scale,top:e.y+(measured.top-526)*scale,width:measured.width*scale,height:measured.height*scale};
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
 return {base:load('receipt-base-l1'),mechanism:load('receipt-mechanism-l2'),vault:load('receipt-vault-l3')};
}
type ReceiptDraw={e:Exhibit;t:number;level:number;install:number;known:boolean;back:HTMLImageElement;front:HTMLImageElement;item:HTMLImageElement;assets:ReceiptStudyAssets};
function sprite(c:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number){if(img.complete&&img.naturalWidth)c.drawImage(img,Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function vaultParts(c:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number,assembly:ReturnType<typeof receiptAssembly>){
 const iw=img.naturalWidth,ih=img.naturalHeight;if(!iw||!ih)return;
 const parts=registrations['receipt-vault-l3']?.parts,crown=Math.round(parts?.centralFrame?.y??ih*.20),base=ih-Math.round(parts?.base?.y??ih*.85),middle=ih-crown-base,scaleY=h/ih;
 // Actual source slices assemble independently; all source registration matches at progress=1.
 const strip=(sx:number,sy:number,sw:number,sh:number,dx:number,dy:number,dw:number,dh:number)=>c.drawImage(img,sx,sy,sw,sh,Math.round(dx),Math.round(dy),Math.round(dw),Math.round(dh));
 strip(0,0,iw,crown,x,y+assembly.crownOffsetY,w,crown*scaleY);
 strip(0,crown,iw/2,middle,x-assembly.shellSplit,y+crown*scaleY,w/2,middle*scaleY);
 strip(iw/2,crown,iw/2,middle,x+w/2+assembly.shellSplit,y+crown*scaleY,w/2,middle*scaleY);
 strip(0,ih-base,iw,base,x,y+(ih-base)*scaleY+assembly.baseOffsetY,w,base*scaleY);
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
 for(const [i,key]of ['leftGear','rightGear'].entries()){const part=entry.parts[key];if(!part)continue;const r=registeredPart(part);c.save();c.translate(r.x+r.w/2,r.y+r.h/2);c.rotate(t*(i?-.9:.9));c.drawImage(img,part.x,part.y,part.width,part.height,-r.w/2,-r.h/2,r.w,r.h);c.restore();}
 const outlet=entry.parts.ticketOutlet;if(outlet){const r=registeredPart(outlet),feed=(t*7)%Math.max(4,r.h);c.save();c.beginPath();c.rect(r.x,r.y,r.w,r.h);c.clip();c.fillStyle='#f6dfac';c.fillRect(r.x+r.w*.18,r.y-r.h+feed,r.w*.64,r.h);for(let line=0;line<4;line++)pixelLine(c,r.x+r.w*.30,r.y-r.h+feed+line*3,r.w*.4,'#8a6a59');c.restore();}
 const x=e.x,y=machine.top+machine.height+offset,elbow={x:x-34,y:y-17},hand={x:x-28+Math.sin(t*1.8)*2,y:y-22-Math.sin(t*1.8)*2};c.strokeStyle='#d6ad62';c.lineWidth=2;c.beginPath();c.moveTo(x-35,y-3);c.lineTo(elbow.x,elbow.y);c.lineTo(hand.x,hand.y-12*(1-installation));c.stroke();c.fillStyle='#aee6da';c.fillRect(hand.x-2,hand.y-2,4,4);
}
/** Same room-case renderer as the live museum. Structural parts move; the actual receipt does not. */
export function drawReceiptStudy(c:CanvasRenderingContext2D,a:ReceiptDraw){
 const {e,t,known,back,front,item,assets}=a,level=Math.max(0,Math.min(3,Math.round(a.level))),g=receiptGeometry(level),assembly=receiptAssembly(level,a.install),s=e.scale,p=layerPoint(e,e.crop.x,e.crop.y),b=layerPoint(e,e.cavity.x,e.cavity.y),center=itemCenter(e),cavityW=e.cavity.w*s,cavityH=e.cavity.h*s,iw=e.item.size*s;
 c.save();c.imageSmoothingEnabled=false;c.fillStyle='#120d2860';c.beginPath();c.ellipse(e.x,e.y-2,g.baseWidth*.45,6,0,0,Math.PI*2);c.fill();
 if(level<3){
  // Cut away the old physical base. A new base must never sit on a second pedestal sprite.
  const sourceBottom=252,bodyHeight=(sourceBottom-e.crop.y)*s;c.drawImage(back,e.crop.x,e.crop.y,e.crop.w,sourceBottom-e.crop.y,p.x,p.y,e.crop.w*s,bodyHeight);
 }else{
  // The premium vault is empty artwork; a transparent glass rear sits behind the independent receipt.
  const left=e.x-47,top=e.y-189;c.fillStyle='#73bfc214';c.beginPath();c.moveTo(left,top+158);c.lineTo(left,top+22);c.quadraticCurveTo(left,top,left+22,top);c.lineTo(left+72,top);c.quadraticCurveTo(left+94,top,left+94,top+22);c.lineTo(left+94,top+158);c.closePath();c.fill();
 }
 if(level>=2){
  const machine=registeredRect('receipt-mechanism-l2',e,{left:b.x,top:b.y,width:cavityW,height:cavityH});
  c.save();c.beginPath();c.rect(b.x,b.y,cavityW,cavityH);c.clip();sprite(c,assets.mechanism,machine.left,machine.top+assembly.mechanismOffsetY,machine.width,machine.height);paperMechanism(c,assets.mechanism,e,t,assembly.mechanismOffsetY,1-assembly.mechanismOffsetY/32);c.restore();
 }
 if(level>=3){
  // An orbital scanner passes behind the specimen before its foreground half is drawn.
  c.save();c.strokeStyle=`rgba(173,229,208,${.46*assembly.lamp})`;c.lineWidth=2;c.beginPath();c.ellipse(center.x,center.y,44,14,-.25,Math.PI,Math.PI*2);c.stroke();c.restore();
 }
 c.save();c.beginPath();c.rect(b.x,b.y,cavityW,cavityH);c.clip();
 if(known){c.save();c.translate(center.x,center.y+Math.sin(t*1.4)*2);c.rotate(Math.sin(t*.8)*.035);sprite(c,item,-iw/2,-iw/2,iw,iw);c.restore();c.fillStyle='#ffeab9';for(let i=0;i<3;i++)c.fillRect(center.x-9+i*8,center.y+iw*.25+(t*4+i*5)%12,2,2);}
 if(level<3){c.save();c.globalAlpha=.9;c.drawImage(front,e.front.x,e.front.y,e.front.w,e.front.h,b.x,b.y,cavityW,cavityH);c.restore();}c.restore();
 if(level===3){c.fillStyle='#d4f8ee35';c.fillRect(e.x-38,e.y-160,2,110);c.fillRect(e.x-33,e.y-158,3,32);c.fillStyle='#fff7cd38';c.fillRect(e.x+37,e.y-132,2,79);}
 if(level===3){
  // Split outer shell parts close around an existing glass/receipt chamber, no rescaling specimen.
  const vault=registeredRect('receipt-vault-l3',e,{left:175-g.baseWidth/2,top:526-g.frameHeight,width:g.baseWidth,height:g.frameHeight});vaultParts(c,assets.vault,vault.left,vault.top,vault.width,vault.height,assembly);
  c.save();c.strokeStyle=`rgba(160,237,216,${.55*assembly.lamp})`;c.lineWidth=2;c.beginPath();c.ellipse(center.x,center.y,44,14,-.25,0,Math.PI);c.stroke();
  const angle=t*.65;c.globalAlpha=assembly.lamp;c.fillStyle='#b7a277';for(const side of [-1,1])c.fillRect(center.x+side*44-2,center.y-2,4,4);c.fillStyle='#e2ffe6';c.fillRect(center.x+Math.cos(angle)*44-2,center.y+Math.sin(angle)*14-2,4,4);c.restore();
 }else{
  const base=registeredRect('receipt-base-l1',e,{left:175-g.baseWidth/2,top:492,width:g.baseWidth,height:34});sprite(c,assets.base,base.left,base.top+assembly.baseOffsetY,base.width,base.height);baseLighting(c,e,assembly.baseOffsetY,assembly.lamp,t);
 }
 // Only the lamps brighten, preserving the engraved physical plaque in the artwork.
 // Readable plaque is separate from AI image text and anchored to the same physical plinth.
 independentPlaque(c,assets.base,e.x,e.y+12+assembly.nameplateOffsetY,level,known);
 c.restore();
}
