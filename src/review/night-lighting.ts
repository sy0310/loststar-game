import type {SceneFrame} from '../render/scene';
import {nightDoor,type NightStage} from './d1-motion';

const ambientMasks=new WeakMap<HTMLImageElement,HTMLCanvasElement>();

/** Canvas blend modes retain the source pixels and work without Canvas.filter. */
export function lightNightWorld(context:CanvasRenderingContext2D,frame:SceneFrame,stage:NightStage){
  context.save();
  let mask=ambientMasks.get(frame.globe);
  if(!mask){
    mask=document.createElement('canvas');
    mask.width=frame.globe.width;mask.height=frame.globe.height;
    const source=mask.getContext('2d')!;
    source.drawImage(frame.globe,0,0);
    source.globalCompositeOperation='source-in';source.fillStyle='#a1a9ce';
    source.fillRect(0,0,mask.width,mask.height);
    ambientMasks.set(frame.globe,mask);
  }
  // Apply the actual irregular surface alpha after all world entities. They
  // share its light, while transparent space at the carton rim stays intact.
  context.globalCompositeOperation='multiply';
  context.drawImage(mask,52,70,664,664);
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
