import {nightRobotRegistration,type NightStage} from './d1-motion';
export interface NightPoint{x:number;y:number}
const size=nightRobotRegistration.width,scale=size/nightRobotRegistration.sourceCell;
const origin={x:-size*.54,y:-size*.97};
export function nightRobotSourcePoint(point:NightPoint,flip:boolean,stage:NightStage){
  const x=(origin.x+point.x*scale)*(flip?-1:1),y=origin.y+point.y*scale;
  const angle=stage.rig.tilt;
  return {x:stage.robot.x+x*Math.cos(angle)-y*Math.sin(angle),
    y:stage.robot.y+x*Math.sin(angle)+y*Math.cos(angle)+stage.rig.bob};
}
