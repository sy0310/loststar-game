import {receiptGeometry} from '../review/d1-motion';
import {itemCenter,layerPoint,type Exhibit} from './museum-layout';

/** D1 deliberately keeps the room camera and actual specimen registration at every tier. */
export const receiptFocusCamera={left:65,top:290,width:220,height:310} as const;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(from:number,to:number,p:number)=>{const f=clamp((p-from)/(to-from));return f*f*(3-2*f);};
export function receiptAssembly(level:number,progress:number){
 const p=clamp(progress),base=smooth(0,.52,p),machine=smooth(.15,.75,p),shell=smooth(.24,.90,p);
 return {baseOffsetY:level?36*(1-base):0,mechanismOffsetY:level>=2?32*(1-machine):0,shellSplit:level>=3?46*(1-shell):0,crownOffsetY:level>=3?-40*(1-shell):0,nameplateOffsetY:level?18*(1-smooth(.45,.92,p)):0,lamp:level?smooth(.65,1,p):0,itemOffset:{x:0,y:0}};
}
export type ReceiptStudyAssets={base:HTMLImageElement;mechanism:HTMLImageElement;vault:HTMLImageElement};
const urls=import.meta.glob('../../assets/runtime/d1/*.webp',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
/** Only called by opt-in D1 MuseumScene instances; regular home never requests these textures. */
export function createReceiptStudyAssets():ReceiptStudyAssets{
 const load=(name:string)=>{const url=urls[`../../assets/runtime/d1/${name}.webp`];if(!url)throw new Error(`Missing D1 receipt part: ${name}`);const image=new Image();image.src=url;return image;};
 return {base:load('receipt-base-l1'),mechanism:load('receipt-mechanism-l2'),vault:load('receipt-vault-l3')};
}
type ReceiptDraw={e:Exhibit;t:number;level:number;install:number;known:boolean;back:HTMLImageElement;front:HTMLImageElement;item:HTMLImageElement;assets:ReceiptStudyAssets};
function sprite(c:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number){if(img.complete&&img.naturalWidth)c.drawImage(img,Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function splitSprite(c:CanvasRenderingContext2D,img:HTMLImageElement,x:number,y:number,w:number,h:number,split:number){
 const half=img.naturalWidth/2;if(!half)return;c.drawImage(img,0,0,half,img.naturalHeight,Math.round(x-split),Math.round(y),Math.round(w/2),Math.round(h));c.drawImage(img,half,0,half,img.naturalHeight,Math.round(x+w/2+split),Math.round(y),Math.round(w/2),Math.round(h));
}
function pixelLine(c:CanvasRenderingContext2D,x:number,y:number,w:number,color:string){c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),2);}
function paperMechanism(c:CanvasRenderingContext2D,x:number,y:number,t:number,installation:number){
 // Functional mechanism stays separate from the source: rollers rotate and the ticket feeds.
 const spin=t*2,rollY=y-11;c.fillStyle='#30253e';c.fillRect(x-37,y-15,74,15);c.strokeStyle='#e7b55d';c.lineWidth=2;
 for(const side of [-1,1]){const cx=x+side*25;c.fillStyle='#b47a39';c.beginPath();c.arc(cx,rollY,6,0,Math.PI*2);c.fill();for(let a=0;a<4;a++){c.beginPath();c.moveTo(cx+Math.cos(spin+a*Math.PI/2)*2,rollY+Math.sin(spin+a*Math.PI/2)*2);c.lineTo(cx+Math.cos(spin+a*Math.PI/2)*6,rollY+Math.sin(spin+a*Math.PI/2)*6);c.stroke();}}
 const feed=(t*9)%26;c.save();c.beginPath();c.rect(x-20,y-29,40,29);c.clip();c.fillStyle='#f6dfac';c.fillRect(x-10,y-30+feed,20,26);for(let line=0;line<4;line++)pixelLine(c,x-6,y-25+feed+line*5,11-line%2*4,'#8a6a59');c.restore();
 const elbow={x:x-39,y:y-25},hand={x:x-23+Math.sin(t*1.8)*3,y:y-34-Math.sin(t*1.8)*3};c.strokeStyle='#d6ad62';c.lineWidth=4;c.beginPath();c.moveTo(x-43,y-4);c.lineTo(elbow.x,elbow.y);c.lineTo(hand.x,hand.y-16*(1-installation));c.stroke();c.fillStyle='#aee6da';c.fillRect(hand.x-3,hand.y-3,6,6);
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
  c.fillStyle='#73bfc214';c.beginPath();c.roundRect(e.x-47,e.y-189,94,158,22);c.fill();
 }
 if(level>=2){
  const machineY=e.y-27+assembly.mechanismOffsetY;
  sprite(c,assets.mechanism,e.x-47,machineY-53,94,53);
  paperMechanism(c,e.x,machineY,t,1-assembly.mechanismOffsetY/32);
 }
 if(level>=3){
  // An orbital scanner passes behind the specimen before its foreground half is drawn.
  c.save();c.strokeStyle=`rgba(173,229,208,${.18+.28*assembly.lamp})`;c.lineWidth=2;c.beginPath();c.ellipse(center.x,center.y,44,14,-.25,Math.PI,Math.PI*2);c.stroke();c.restore();
 }
 c.save();c.beginPath();c.rect(b.x,b.y,cavityW,cavityH);c.clip();
 if(known){c.save();c.translate(center.x,center.y+Math.sin(t*1.4)*2);c.rotate(Math.sin(t*.8)*.035);sprite(c,item,-iw/2,-iw/2,iw,iw);c.restore();c.fillStyle='#ffeab9';for(let i=0;i<3;i++)c.fillRect(center.x-9+i*8,center.y+iw*.25+(t*4+i*5)%12,2,2);}
 c.save();c.globalAlpha=.9;c.drawImage(front,e.front.x,e.front.y,e.front.w,e.front.h,b.x,b.y,cavityW,cavityH);c.restore();c.restore();
 if(level===3){
  // Split outer shell parts close around an existing glass/receipt chamber, no rescaling specimen.
  splitSprite(c,assets.vault,e.x-g.baseWidth/2,e.y-g.frameHeight+assembly.crownOffsetY,g.baseWidth,g.frameHeight,assembly.shellSplit);
  c.save();c.strokeStyle=`rgba(160,237,216,${.55*assembly.lamp})`;c.lineWidth=2;c.beginPath();c.ellipse(center.x,center.y,44,14,-.25,0,Math.PI);c.stroke();
  const angle=t*.65;c.fillStyle='#e2ffe6';c.fillRect(center.x+Math.cos(angle)*44-2,center.y+Math.sin(angle)*14-2,4,4);c.restore();
 }else{
  const baseY=e.y+assembly.baseOffsetY;sprite(c,assets.base,e.x-g.baseWidth/2,baseY-34,g.baseWidth,34);
 }
 // Lamp strip is mounted on the new base and brightens after mechanical registration.
 if(assembly.lamp>0){c.save();c.globalAlpha=assembly.lamp;c.fillStyle='#ffcc70';c.fillRect(e.x-g.baseWidth*.32,e.y-16,g.baseWidth*.64,3);c.fillStyle='#ffe6a855';c.fillRect(e.x-g.baseWidth*.28,e.y-20,g.baseWidth*.56,3);c.restore();}
 // Readable plaque is separate from AI image text and anchored to the same physical plinth.
 const plaqueY=e.y+12+assembly.nameplateOffsetY,plaqueW=level===3?132:120;c.fillStyle='#271e30';c.fillRect(e.x-plaqueW/2,plaqueY,plaqueW,28);c.strokeStyle=level===3?'#b4e2d3':'#e8bc77';c.lineWidth=2;c.strokeRect(e.x-plaqueW/2,plaqueY,plaqueW,28);c.fillStyle='#f9e4b5';c.fillRect(e.x-plaqueW/2+4,plaqueY+5,2,2);c.fillRect(e.x+plaqueW/2-6,plaqueY+5,2,2);c.font='19px monospace';c.textAlign='center';c.fillText(known?'未购买收据':'等待好奇心',e.x,plaqueY+21,plaqueW-13);
 c.restore();
}
