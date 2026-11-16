import mastUrl from '../../assets/runtime/visual-renewal/world/security-mast.webp';
import {firstPlanetFacilities} from '../fusion/facilities';
import type {SceneEntity, SceneFrame} from './scene';

const registration=firstPlanetFacilities.securityMast;
const native={foot:{x:32,y:228},lens:{x:6,y:19},scale:86/209};
/** Dedicated original lamp, not an old sorting-machine crop. Its actual lens,
 * rendered light and night-model search beam share this one registration. */
export function createSecurityMast(){
  let image:HTMLImageElement|undefined;
  const ready=new Promise<void>((resolve,reject)=>{const next=new Image();next.onload=()=>{image=next;resolve();};next.onerror=reject;next.src=mastUrl;});
  const source=():{x:number;y:number}=>({...registration.emitter});
  const diagnostics=()=>({...registration,anchor:{...registration.anchor},emitter:source(),materials:['visual-renewal/world/security-mast.webp'],native});
  function draw(context:CanvasRenderingContext2D,frame:SceneFrame,power:number){
    const {x,y}=registration.anchor,emitter=source();
    context.save();context.imageSmoothingEnabled=false;
    context.fillStyle='#2e1b4680';context.beginPath();context.ellipse(x,y+1,14,3.8,-.1,0,Math.PI*2);context.fill();
    context.drawImage(image!,x-native.foot.x*native.scale,y-native.foot.y*native.scale,image!.naturalWidth*native.scale,image!.naturalHeight*native.scale);
    const strength=frame.environment.light*(.55+Math.max(0,Math.min(1,power))*.3);
    if(strength>0){context.globalCompositeOperation='screen';const glow=context.createRadialGradient(emitter.x,emitter.y,1,emitter.x,emitter.y,22);glow.addColorStop(0,'#bcefd075');glow.addColorStop(1,'#bcefd000');context.globalAlpha=strength;context.fillStyle=glow;context.fillRect(emitter.x-22,emitter.y-22,44,44);context.fillStyle='#d2f9dc';context.fillRect(emitter.x-2,emitter.y-2,4,4);}
    context.restore();
  }
  return {ready,source,diagnostics,entities(context:CanvasRenderingContext2D,frame:SceneFrame,power=1):SceneEntity[]{
    if(!image)return [];
    Object.assign(frame.output.dataset,{securityEntityId:registration.id,securityRenderer:registration.renderer,securityAnchor:JSON.stringify(registration.anchor),securityEmitter:JSON.stringify(source())});
    return [{depth:registration.anchor.y,hitTarget:{kind:'planet',id:'parcel'},draw:()=>draw(context,frame,power)}];
  }};
}
