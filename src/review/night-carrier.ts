import {nightDoor,type NightStage} from './d1-motion';
import type {NightPoint} from './night-robot';

interface SourceRect {x:number;y:number;w:number;h:number;width?:number;height?:number}
interface CarrierRegistration {
  canvas:{width:number;height:number};
  gripMidpoint:NightPoint;
  handles:readonly [NightPoint,NightPoint];
  physicalBounds:SourceRect;
  cavity:SourceRect;
  hinge:NightPoint;
  handleBounds?:SourceRect;
  handleHinge?:NightPoint;
  displayScale?:number;
}
type CarrierLayers=Record<'back'|'front'|'lid',HTMLImageElement>;
const imagePaths=import.meta.glob('../../assets/runtime/visual-renewal/world/field-case-*.webp',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const registrations=import.meta.glob('../../assets/runtime/visual-renewal/world/field-case-registration.json',{eager:true,import:'default'}) as Record<string,CarrierRegistration>;

function loadImage(url:string){
  const image=new Image();image.src=url;
  return image.decode().then(()=>image);
}

export function createNightCarrier(){
  let registration:CarrierRegistration;
  let images:CarrierLayers;
  let lidBody:HTMLCanvasElement|undefined;
  let handle:HTMLCanvasElement|undefined;
  let scale=1;
  const ready=Promise.resolve().then(async()=>{
    registration=Object.values(registrations)[0];
    if(!registration)throw Error('Missing registered night carrier');
    for(const rect of [registration.physicalBounds,registration.cavity]){
      rect.w=rect.w??rect.width!;
      rect.h=rect.h??rect.height!;
    }
    const pairs=await Promise.all(['back','front','lid'].map(async layer=>{
      const url=imagePaths[`../../assets/runtime/visual-renewal/world/field-case-${layer}.webp`];
      if(!url)throw Error(`Missing carrier ${layer}`);
      return [layer,await loadImage(url)] as const;
    }));
    images=Object.fromEntries(pairs) as CarrierLayers;
    scale=registration.displayScale??Math.min(54/registration.physicalBounds.w,40/registration.physicalBounds.h);
    if(registration.handleBounds){
      const bounds=registration.handleBounds;
      lidBody=document.createElement('canvas');lidBody.width=registration.canvas.width;lidBody.height=registration.canvas.height;
      const bodyContext=lidBody.getContext('2d')!;bodyContext.drawImage(images.lid,0,0);
      bodyContext.clearRect(bounds.x,bounds.y,bounds.w,bounds.h);
      handle=document.createElement('canvas');handle.width=lidBody.width;handle.height=lidBody.height;
      handle.getContext('2d')!.drawImage(images.lid,bounds.x,bounds.y,bounds.w,bounds.h,bounds.x,bounds.y,bounds.w,bounds.h);
    }
  });
  // The scene awaits this same promise and presents its loading error. Attaching
  // a handler now avoids an unhandled rejection while the original art decodes.
  void ready.catch(()=>{});

  function project(point:NightPoint,stage:NightStage):NightPoint{
    const x=(point.x-registration.gripMidpoint.x)*scale;
    const y=(point.y-registration.gripMidpoint.y)*scale;
    const px=x*stage.cargo.yaw+y*(1-stage.cargo.pitch)*.18;
    const py=y*stage.cargo.pitch-x*(1-stage.cargo.yaw)*.12;
    return {x:stage.cargo.grip.x+px*Math.cos(stage.cargo.angle)-py*Math.sin(stage.cargo.angle),
      y:stage.cargo.grip.y+px*Math.sin(stage.cargo.angle)+py*Math.cos(stage.cargo.angle)};
  }

  function lidPoint(point:NightPoint,stage:NightStage){
    const angle=-stage.cargo.open*1.22;
    const x=point.x-registration.hinge.x,y=point.y-registration.hinge.y;
    return {x:registration.hinge.x+x*Math.cos(angle)-y*Math.sin(angle),
      y:registration.hinge.y+x*Math.sin(angle)+y*Math.cos(angle)};
  }

  function handles(stage:NightStage):readonly [NightPoint,NightPoint]{
    if(!registration)return [{x:stage.cargo.grip.x-12,y:stage.cargo.grip.y-3},{x:stage.cargo.grip.x+12,y:stage.cargo.grip.y+3}];
    return registration.handles.map(point=>{
      const hinge=registration.handleHinge??registration.hinge;
      const lowered={x:point.x,y:hinge.y+(point.y-hinge.y)*(1-stage.cargo.handleDown*.88)};
      return project(lidPoint(lowered,stage),stage);
    }) as unknown as readonly [NightPoint,NightPoint];
  }

  function paperPivot(stage:NightStage):NightPoint{
    if(!registration)return stage.paper.pivot;
    const window=registration.cavity;
    const centre=project({x:window.x+window.w/2,y:window.y+window.h/2},stage);
    const dx=3.7*stage.cargo.yaw,dy=6.9*stage.cargo.pitch;
    const inside={x:centre.x+dx*Math.cos(stage.cargo.angle)-dy*Math.sin(stage.cargo.angle),
      y:centre.y+dx*Math.sin(stage.cargo.angle)+dy*Math.cos(stage.cargo.angle)};
    return {x:stage.paper.freePivot.x+(inside.x-stage.paper.freePivot.x)*stage.paper.intake,
      y:stage.paper.freePivot.y+(inside.y-stage.paper.freePivot.y)*stage.paper.intake};
  }

  function transform(context:CanvasRenderingContext2D,stage:NightStage){
    context.translate(stage.cargo.grip.x,stage.cargo.grip.y);
    context.rotate(stage.cargo.angle);
    context.transform(stage.cargo.yaw,-(1-stage.cargo.yaw)*.12,(1-stage.cargo.pitch)*.18,stage.cargo.pitch,0,0);
    context.scale(scale,scale);
    context.translate(-registration.gripMidpoint.x,-registration.gripMidpoint.y);
  }

  function layer(context:CanvasRenderingContext2D,image:CanvasImageSource){
    context.drawImage(image,0,0,registration.canvas.width,registration.canvas.height);
  }

  function drawLid(context:CanvasRenderingContext2D,stage:NightStage){
    context.save();
    context.translate(registration.hinge.x,registration.hinge.y);
    context.rotate(-stage.cargo.open*1.22);
    context.translate(-registration.hinge.x,-registration.hinge.y);
    layer(context,lidBody??images.lid);
    if(handle){
      const hinge=registration.handleHinge??registration.hinge;
      context.translate(hinge.x,hinge.y);
      context.scale(1,1-stage.cargo.handleDown*.88);
      context.translate(-hinge.x,-hinge.y);
      layer(context,handle);
    }
    context.restore();
  }

  function receptionClip(context:CanvasRenderingContext2D,stage:NightStage,inside:boolean,draw:()=>void){
    if(stage.cargo.receiving===0){if(!inside)draw();return;}
    if(!inside&&stage.cargo.receiving===1)return;
    const bounds=registration.physicalBounds;
    const left=project({x:bounds.x,y:bounds.y},stage).x;
    const width=bounds.w*scale*stage.cargo.yaw;
    const plane=left+width*stage.cargo.receiving;
    // The leading side has crossed the wall plane and is visible only through
    // the real receiving aperture. The trailing side is still in front of it.
    if(!inside){
      context.save();context.beginPath();context.rect(plane,300,160,170);context.clip();draw();context.restore();return;
    }
    context.save();context.beginPath();
    context.moveTo(nightDoor.opening[0].x,nightDoor.opening[0].y);
    for(const point of nightDoor.opening.slice(1))context.lineTo(point.x,point.y);
    context.closePath();context.clip();
    context.beginPath();context.rect(250,340,Math.max(0,plane-250),100);context.clip();draw();context.restore();
  }

  function draw(context:CanvasRenderingContext2D,stage:NightStage,drawPaper:()=>void,inside=false){
    if(!registration||!images||!stage.cargo.visible)return;
    receptionClip(context,stage,inside,()=>{
      context.save();transform(context,stage);layer(context,images.back);context.restore();
      drawPaper();
      context.save();transform(context,stage);layer(context,images.front);drawLid(context,stage);context.restore();
    });
  }

  function groundShadow(context:CanvasRenderingContext2D,stage:NightStage){
    if(!registration||!stage.cargo.visible||stage.cargo.receiving===1)return;
    const bounds=registration.physicalBounds;
    const bottom=project({x:registration.gripMidpoint.x,y:bounds.y+bounds.h},stage);
    const ground=stage.robot.y-5.5;
    const height=Math.max(0,ground-bottom.y);
    const opacity=(1-stage.cargo.receiving)*Math.max(0,.25-height*.004);
    if(opacity===0)return;
    context.save();
    context.globalAlpha=opacity;
    context.fillStyle='#242039';context.beginPath();
    context.ellipse(stage.cargo.grip.x,ground,22+height*.09,5+height*.035,0,0,Math.PI*2);context.fill();
    context.restore();
  }

  return {ready,handles,paperPivot,draw,groundShadow};
}
