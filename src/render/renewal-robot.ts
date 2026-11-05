import headUrl from '../../assets/runtime/visual-renewal/world/robot-head.webp';
import torsoUrl from '../../assets/runtime/visual-renewal/world/robot-torso.webp';
import scannerUrl from '../../assets/runtime/visual-renewal/world/robot-scanner-hand.webp';
import handUrl from '../../assets/runtime/visual-renewal/world/robot-grip-hand.webp';
import leftLegUrl from '../../assets/runtime/visual-renewal/world/robot-leg-left.webp';
import rightLegUrl from '../../assets/runtime/visual-renewal/world/robot-leg-right.webp';
import type {robotPose} from './motion';
import type {RobotAnimationState} from './robot-animation';

type Point={x:number;y:number};
type Pose=ReturnType<typeof robotPose>;
type Art=Record<'head'|'torso'|'scanner'|'hand'|'leftLeg'|'rightLeg',HTMLImageElement>;
const urls={head:headUrl,torso:torsoUrl,scanner:scannerUrl,hand:handUrl,leftLeg:leftLegUrl,rightLeg:rightLegUrl};
let art:Art|undefined;
let pending:Promise<void>|undefined;
const origin={x:-144*.54,y:-144*.97},scale=.9;
export const isRenewalRobot=(image:HTMLImageElement)=>Boolean(image.src?.includes('robot-atlas'));
export function prepareRenewalRobot(){
  if(pending)return pending;
  pending=Promise.all(Object.entries(urls).map(async([key,url])=>{
    const image=new Image();image.src=url;await image.decode();return [key,image] as const;
  })).then(entries=>{art=Object.fromEntries(entries) as Art;}).catch(error=>{pending=undefined;throw error;});
  return pending;
}
const clamp=(value:number)=>Math.max(0,Math.min(1,value));
const smooth=(value:number)=>{const t=clamp(value);return t*t*(3-2*t);};
function link(context:CanvasRenderingContext2D,from:Point,to:Point){
  context.lineCap='round';context.beginPath();context.moveTo(from.x,from.y);context.lineTo(to.x,to.y);
  context.strokeStyle='#342140';context.lineWidth=10;context.stroke();
  context.strokeStyle='#906598';context.lineWidth=7;context.stroke();
  context.strokeStyle='#e8c39b';context.lineWidth=3;context.stroke();
  context.fillStyle='#5a375f';context.beginPath();context.arc(from.x,from.y,6,0,Math.PI*2);context.fill();
  context.fillStyle='#c39359';context.beginPath();context.arc(from.x-1,from.y-1,4,0,Math.PI*2);context.fill();
  context.fillStyle='#ffe1a0';context.fillRect(from.x-2,from.y-3,3,2);
}
function elbow(shoulder:Point,wrist:Point,side:number){
  const dx=wrist.x-shoulder.x,dy=wrist.y-shoulder.y,distance=Math.max(.001,Math.hypot(dx,dy));
  const upper=Math.max(25,distance-21.5),lower=22,d=Math.min(upper+lower-.01,Math.max(Math.abs(upper-lower)+.01,distance));
  const along=(upper*upper-lower*lower+d*d)/(2*d),height=Math.sqrt(Math.max(0,upper*upper-along*along));
  return {x:shoulder.x+dx/distance*along-dy/distance*height*side,y:shoulder.y+dy/distance*along+dx/distance*height*side};
}
function grip(context:CanvasRenderingContext2D,shoulder:Point,wrist:Point,front:boolean,hideGlove=false,glovesOnly=false){
  const joint=elbow(shoulder,wrist,front?-1:1);if(!glovesOnly)link(context,shoulder,joint);
  // The painted cuff terminates at the articulated elbow. Fingers share the
  // actual parcel/case grip coordinates, rather than a static atlas position.
  if(!hideGlove){context.save();context.translate(wrist.x,wrist.y);context.rotate(Math.atan2(joint.y-wrist.y,joint.x-wrist.x));context.drawImage(art!.hand,-8,-14,35,26);context.restore();}
}
export interface RenewalRobotOptions {
  hands?:readonly [Point,Point];
  hideGloves?:boolean;
  glovesOnly?:boolean;
  tilt?:number;
  bob?:number;
  flip?:boolean;
}
/** Original layers share the old foot/parcel coordinates, but have independent
 * head, torso, hips, painted forearms and actual contact-constrained wrists. */
export function drawRenewalRobot(context:CanvasRenderingContext2D,pose:Pose,fraction:number,animation:RobotAnimationState,options:RenewalRobotOptions={}){
  if(!art)return false;
  const moving=pose.action==='walk'||pose.action==='return',time=animation.workSeconds;
  const intensity=clamp(animation.assistVisualIntensity??0),effort=smooth((intensity-.25)/.75),received=clamp(animation.received);
  const lean=effort*.105,phase=time*8,bob=options.bob??(moving?Math.sin(time*16):0);
  const flip=options.flip??(pose.action==='walk'&&pose.facing==='right');
  // Night patrol also uses return/unload action names for empty-handed travel.
  // A hidden parcel may instead be an anomaly/beam target, never a hand target.
  const handling=Boolean(options.hands)||(['pickup','return','unload'].includes(pose.action)&&pose.parcel.visible);
  const approach=handling&&pose.action==='pickup'?smooth((fraction-.49)/.03):1;
  const bend=handling&&pose.action==='pickup'?approach*(1-pose.lift):0,crouch=bend*(15+intensity*5);
  const retract=handling&&pose.action==='unload'?smooth((fraction-.975)/.02):0;
  const held={x:pose.x-22,y:pose.y-28};
  const contact={x:(held.x+(pose.parcel.x-held.x)*approach)*(1-retract)+held.x*retract,y:(held.y+(pose.parcel.y-held.y)*approach)*(1-retract)+held.y*retract};
  const worldHands=options.hands??[{x:contact.x-9,y:contact.y-12},{x:contact.x+10,y:contact.y-10}];
  const root={x:Math.round(pose.x),y:Math.round(pose.y+bob)},tilt=options.tilt??0;
  const cosine=Math.cos(tilt),sine=Math.sin(tilt);
  // Case handles arrive in world coordinates. Invert the exact rounded root,
  // body rotation, optional mirror, atlas origin and scale before constraining
  // the wrist; otherwise the drawing transform rotates that target a second time.
  const local=(point:Point)=>{
    const dx=point.x-root.x,dy=point.y-root.y;
    const x=dx*cosine+dy*sine,y=dy*cosine-dx*sine;
    return {x:((flip?-x:x)-origin.x)/scale,y:(y-origin.y)/scale};
  };
  context.save();context.translate(root.x,root.y);context.rotate(tilt);if(flip)context.scale(-1,1);context.translate(origin.x,origin.y);context.scale(scale,scale);
  const torsoX=48+bend*4-lean*45;
  const backShoulder={x:56+bend*4+lean*(86-125),y:86+crouch};
  const frontShoulder={x:104+bend*4+lean*(89-125),y:89+crouch};
  if(options.glovesOnly){
    if(handling){grip(context,backShoulder,local(worldHands[0]),false,false,true);grip(context,frontShoulder,local(worldHands[1]),true,false,true);}
    context.restore();return true;
  }
  const leg=(image:HTMLImageElement,x:number,sign:number)=>{context.save();context.translate(x,119+crouch*.25);const stride=moving?Math.sin(phase+sign*Math.PI*.5):0;context.rotate(stride*(.14+effort*.08));context.drawImage(image,-13,-2,26,40-crouch*.22);context.restore();};
  leg(art.leftLeg,62,-1);leg(art.rightLeg,97,1);
  if(handling)grip(context,backShoulder,local(worldHands[0]),false,options.hideGloves);
  context.drawImage(art.torso,torsoX,73+crouch,64,50);
  context.save();context.translate(78+bend*4-lean*85,77+crouch-received*4);context.rotate(-received*.035);context.drawImage(art.head,-43,-63,86,65);context.restore();
  if(!handling){
    const joint={x:65+lean*(94-125),y:94+crouch};
    link(context,backShoulder,joint);
    const scanAngle=pose.action==='scan'?Math.sin(time*4.2)*(.18+effort*.24)-received*.16:Math.sin(phase)*.06-received*.11;
    context.save();context.transform(1,0,lean,1,-lean*125,0);context.translate(65,94+crouch);context.rotate(scanAngle);context.drawImage(art.scanner,-48,-20,49,38);context.restore();
    const hand={x:115+lean*(107-125),y:108+crouch+Math.sin(phase)*2};
    grip(context,frontShoulder,hand,true,options.hideGloves);
  }else grip(context,frontShoulder,local(worldHands[1]),true,options.hideGloves);
  if(received>0||intensity>0){
    // Short eye glints and a raised head form the low-tier acknowledgement.
    context.globalAlpha=Math.max(received,intensity*.65);context.fillStyle='#e4ffff';
    context.fillRect(55+bend*4-lean*85,43+crouch-received*4,2,4);context.fillRect(75+bend*4-lean*85,44+crouch-received*4,2,3);
  }
  context.restore();return true;
}
/** Foreground gloves can be painted after glass case handles for correct depth. */
export function drawRenewalGlove(context:CanvasRenderingContext2D,point:Point,rotation=0,flip=false){
  if(!art)return false;
  context.save();context.translate(point.x,point.y);context.rotate(rotation);if(flip)context.scale(-1,1);context.drawImage(art.hand,-8*.9,-14*.9,35*.9,26*.9);context.restore();return true;
}
