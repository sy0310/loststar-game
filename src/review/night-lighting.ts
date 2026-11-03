import type {SceneFrame} from '../render/scene';
import {nightDoor,type NightStage} from './d1-motion';
import {tintWorld} from '../render/world-lighting';

/** Canvas blend modes retain the source pixels and work without Canvas.filter. */
export function lightNightWorld(context:CanvasRenderingContext2D,frame:SceneFrame,stage:NightStage,strength=1){
  if(strength<=0)return;
  tintWorld(context,'#737da9',strength);
  context.save();
  context.globalAlpha=strength;
  context.globalCompositeOperation='screen';
  for(const light of [
    {x:nightDoor.light.x,y:nightDoor.light.y,radius:103,power:stage.phase==='dock'?.40:.23},
    {x:557,y:211,radius:67,power:stage.phase==='signal'?.19:.11},
    {x:346,y:632,radius:36,power:.10},
  ]){
    const gradient=context.createRadialGradient(light.x,light.y,2,light.x,light.y,light.radius);
    gradient.addColorStop(0,`rgba(218,151,82,${light.power})`);
    gradient.addColorStop(1,'rgba(218,151,82,0)');
    context.fillStyle=gradient;
    context.fillRect(light.x-light.radius,light.y-light.radius,light.radius*2,light.radius*2);
  }
  if(stage.beamVisible(frame.ship.back)){
    const spot=stage.target;
    const gradient=context.createRadialGradient(spot.x,spot.y,2,spot.x,spot.y,46);
    gradient.addColorStop(0,'#ead6a62e');
    gradient.addColorStop(1,'#ead6a600');
    context.fillStyle=gradient;
    context.fillRect(spot.x-46,spot.y-46,92,92);
  }
  context.restore();
}
