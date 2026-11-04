import type {SceneFrame} from '../render/scene';
import {nightRobotRegistration,smoothInstall,type NightStage} from './d1-motion';

export interface NightPoint {x:number;y:number}
type HandPair=readonly [NightPoint,NightPoint];
const cell=nightRobotRegistration.sourceCell;
const size=nightRobotRegistration.width;
const scale=size/cell;
const origin={x:-size*.54,y:-size*.97};

interface Pose {frame:number;flip:boolean}
function poseAt(stage:NightStage,time:number):Pose{
  if(stage.phase==='travel')return {frame:Math.floor(time*8)%4,flip:stage.robot.facing==='right'};
  if(stage.phase==='signal'||stage.phase==='done')return {frame:1,flip:false};
  if(stage.phase==='identify')return {frame:4,flip:false};
  if(stage.phase==='contain'){
    if(time<15.25)return {frame:4,flip:false};
    return stage.handling.raise<.85?{frame:5,flip:false}:{frame:6,flip:false};
  }
  return {frame:stage.rig.unload>.5?7:6,flip:false};
}

/** Native cell coordinates registered with the same origin, tilt and bob as the body. */
export function nightRobotSourcePoint(point:NightPoint,flip:boolean,stage:NightStage){
  const x=(origin.x+point.x*scale)*(flip?-1:1),y=origin.y+point.y*scale;
  const angle=stage.rig.tilt;
  return {x:stage.robot.x+x*Math.cos(angle)-y*Math.sin(angle),
    y:stage.robot.y+x*Math.sin(angle)+y*Math.cos(angle)+stage.rig.bob};
}

/** Complete original poses keep the rounded upper arms and body identity. */
export function createNightRobot(){
  function drawBody(context:CanvasRenderingContext2D,frame:SceneFrame,stage:NightStage,atlas:HTMLImageElement){
    context.save();context.fillStyle='#201b3378';context.beginPath();
    context.ellipse(stage.robot.x,stage.robot.y-5,27,6,0,0,Math.PI*2);context.fill();
    context.translate(Math.round(stage.robot.x),Math.round(stage.robot.y+stage.rig.bob));
    context.rotate(stage.rig.tilt);
    const pose=poseAt(stage,stage.seconds);
    context.save();
    if(pose.flip)context.scale(-1,1);
    if(stage.phase==='escort'){
      context.drawImage(atlas,320,160,160,128,origin.x,origin.y,size,size*.8);
      const walk=Math.floor(frame.t*8)%4;
      context.drawImage(atlas,walk*160,128,160,32,origin.x,origin.y+size*.8,size,size*.2);
    }else context.drawImage(atlas,pose.frame%4*cell,Math.floor(pose.frame/4)*cell,cell,cell,origin.x,origin.y,size,size);
    context.restore();
    context.restore();
  }

  function drawClaws(context:CanvasRenderingContext2D,stage:NightStage,atlas:HTMLImageElement,handles:HandPair){
    if(!['contain','escort','dock'].includes(stage.phase))return;
    const pose=poseAt(stage,stage.seconds);
    if(pose.frame<5)return;
    const sourceHands=pose.frame===5?nightRobotRegistration.pickupHands:pose.frame===7?nightRobotRegistration.unloadHands:nightRobotRegistration.carryHands;
    for(let index=0;index<2;index++){
      const grip=sourceHands[index];
      const actual=nightRobotSourcePoint(grip,pose.flip,stage);
      // Pickup cradles the sides. Carry/unload close over the registered top
      // handle; the original upper arms remain intact behind the case.
      let target=actual;
      if(pose.frame===6||pose.frame===7){
        const release=smoothInstall((stage.seconds-27.15)/.55);
        target={x:handles[index].x+(actual.x-handles[index].x)*release,
          y:handles[index].y+(actual.y-handles[index].y)*release};
      }
      const crop={x:grip.x-11,y:grip.y-10,w:23,h:pose.frame===5&&index===1?17:21};
      context.save();
      context.translate(Math.round(target.x),Math.round(target.y));
      context.rotate(stage.rig.tilt);
      if(pose.flip)context.scale(-1,1);
      context.drawImage(atlas,pose.frame%4*cell+crop.x,Math.floor(pose.frame/4)*cell+crop.y,crop.w,crop.h,(crop.x-grip.x)*scale,(crop.y-grip.y)*scale,crop.w*scale,crop.h*scale);
      context.restore();
    }
  }
  return {drawBody,drawClaws};
}
