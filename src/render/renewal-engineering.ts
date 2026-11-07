import dockUrl from '../../assets/runtime/visual-renewal/world/engineering-dock.webp';
import receiverUrl from '../../assets/runtime/visual-renewal/world/engineering-receiver.webp';
import repairUrl from '../../assets/runtime/visual-renewal/world/engineering-repair-bay.webp';
import driveUrl from '../../assets/runtime/visual-renewal/world/engineering-drive.webp';
import {growthLevel} from '../game/growth';
import type {SaveData} from '../game/engine';
import type {SceneEntity,SceneFrame} from './scene';

/** Visual realization of existing bought rights only; no new purchase or state. */
export const renewalEngineeringPlacements=[
  {id:'dock',anchor:{x:373,y:449},width:60},
  {id:'receiver',anchor:{x:611,y:318},width:47},
  {id:'repair-bay',anchor:{x:417,y:434},width:47},
  {id:'drive',anchor:{x:612,y:411},width:45},
] as const;
const urls={dock:dockUrl,receiver:receiverUrl,'repair-bay':repairUrl,drive:driveUrl};
export function createRenewalEngineering(getState:()=>SaveData){
  let art:Record<string,HTMLImageElement>={};
  const ready=Promise.all(Object.entries(urls).map(async([id,url])=>{const image=new Image();image.src=url;await image.decode();return [id,image] as const;})).then(entries=>{art=Object.fromEntries(entries);});
  return {ready,entities(context:CanvasRenderingContext2D,frame:SceneFrame):SceneEntity[]{
    return renewalEngineeringPlacements.filter(item=>growthLevel(getState(),item.id)>0).map(item=>({depth:item.anchor.y,hitTarget:{kind:'planet' as const,id:'parcel'},draw(){
      const level=growthLevel(getState(),item.id),scale=item.width/192,{x,y}=item.anchor;
      context.save();context.fillStyle='#2b183e65';context.beginPath();context.ellipse(x,y+1,item.width*.4,4,0,0,Math.PI*2);context.fill();
      context.drawImage(art[item.id],x-96*scale,y-180*scale,item.width,item.width);
      // The purchased tier is embodied in additional installed brass braces
      // and warm contact lamps rather than another charge or a reward multiplier.
      for(let index=0;index<level;index++){
        const lx=x-item.width*.3+index*7,ly=y-3-index*.65;
        context.fillStyle='#4b2d59';context.fillRect(lx-1,ly-2,6,6);
        context.fillStyle='#d9a15d';context.fillRect(lx,ly-2,4,2);
        context.fillStyle=frame.environment.light>0?'#ffdfa1':'#f5c981';context.fillRect(lx+1,ly,2,2);
      }
      if(level>=2){context.strokeStyle='#4b2e58';context.lineWidth=3;context.beginPath();context.moveTo(x+item.width*.35,y-2);context.lineTo(x+item.width*.42,y-13);context.lineTo(x+item.width*.3,y-17);context.stroke();context.strokeStyle='#d4a26a';context.lineWidth=1.2;context.stroke();}
      if(level>=3){context.fillStyle='#71438e';context.fillRect(x-item.width*.42,y-8,7,8);context.fillStyle='#ffce83';context.fillRect(x-item.width*.42,y-8,7,2);}
      context.restore();
    }}));
  }};
}
