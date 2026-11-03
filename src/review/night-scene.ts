import invaderUrl from '../../assets/runtime/invader-v02.webp';
import type {SceneExtension,SceneFrame} from '../render/scene';
import {nightStage,nightCamera,nightDoor,reviewEnvironment,type NightStage} from './d1-motion';
import {lightNightWorld} from './night-lighting';
import {createNightRobot} from './night-robot';
import {createNightCarrier} from './night-carrier';

/** One globe and one existing creature, assembled under one set of world lights. */
export function createNightStudy(timelineAt=(time:number)=>reviewEnvironment(time)):SceneExtension {
  const paper=new Image();
  paper.src=invaderUrl;
  const carrier=createNightCarrier();
  const robot=createNightRobot();
  const ready=Promise.all([paper.decode(),carrier.ready]).then(()=>{});
  void ready.catch(()=>{});
  let foldShade:HTMLCanvasElement|undefined;
  let robotAtlas:HTMLImageElement|undefined;

  function paperPanel(context:CanvasRenderingContext2D,rect:{x:number;y:number;w:number;h:number},hinge:{x:number;y:number},sx:number,sy:number,shade:number){
    context.save();
    context.translate(hinge.x-96,hinge.y-106);
    context.scale(sx,sy);
    context.drawImage(paper,rect.x,rect.y,rect.w,rect.h,rect.x-hinge.x,rect.y-hinge.y,rect.w,rect.h);
    if(shade>0){
      context.globalAlpha=shade;
      context.drawImage(foldShade!,rect.x,rect.y,rect.w,rect.h,rect.x-hinge.x,rect.y-hinge.y,rect.w,rect.h);
    }
    context.restore();
  }

  function drawPaper(context:CanvasRenderingContext2D,stage:NightStage){
    if(stage.phase==='done')return;
    if(!foldShade){
      foldShade=document.createElement('canvas');foldShade.width=192;foldShade.height=192;
      const shade=foldShade.getContext('2d')!;
      shade.drawImage(paper,0,0,192,192,0,0,192,192);
      shade.globalCompositeOperation='source-in';shade.fillStyle='#21253f';shade.fillRect(0,0,192,192);
    }
    const fold=stage.paper.fold;
    const position=carrier.paperPivot(stage);
    context.save();
    context.globalAlpha=stage.paper.alpha;
    context.translate(position.x,position.y);
    const intake=stage.paper.intake;
    context.rotate(stage.cargo.angle*intake);
    context.transform(1+(stage.cargo.yaw-1)*intake,-(1-stage.cargo.yaw)*.12*intake,(1-stage.cargo.pitch)*.18*intake,1+(stage.cargo.pitch-1)*intake,0,0);
    context.scale(stage.paper.sourceScale,stage.paper.sourceScale);
    const side=Math.cos(fold*Math.PI*.46),bottom=Math.cos(fold*Math.PI*.45);
    paperPanel(context,{x:14,y:65,w:29,h:81},{x:43,y:106},side,1,fold*.26);
    paperPanel(context,{x:128,y:58,w:48,h:88},{x:128,y:106},side,1,fold*.32);
    paperPanel(context,{x:43,y:64,w:85,h:42},{x:96,y:106},1,1,0);
    paperPanel(context,{x:43,y:106,w:85,h:40},{x:96,y:106},1,bottom,fold*.35);
    paperPanel(context,{x:30,y:146,w:117,h:17},{x:96,y:106},1,bottom,fold*.42);
    paperPanel(context,{x:23,y:29,w:140,h:35},{x:96,y:64},1,Math.cos(fold*Math.PI*.46),fold*.22);
    context.fillStyle='#d9edc2';
    context.fillRect(77-96,74-106,4,5);
    context.fillRect(90-96,74-106,4,5);
    context.restore();
  }

  function paperShadow(context:CanvasRenderingContext2D,stage:NightStage){
    const alpha=stage.emerge*(1-stage.paper.intake)*Math.max(.08,.25-stage.paper.height*.003);
    if(alpha<=0)return;
    context.save();context.globalAlpha=alpha;context.fillStyle='#202039';
    context.beginPath();context.ellipse(stage.paper.ground.x,stage.paper.ground.y+2,14+stage.paper.height*.14,4+stage.paper.height*.03,0,0,Math.PI*2);context.fill();context.restore();
  }

  function beacon(context:CanvasRenderingContext2D,stage:NightStage){
    const alarm=stage.phase==='signal'||stage.phase==='travel';
    context.save();
    context.fillStyle=alarm?'#f8dbaa':'#96c8bd';context.fillRect(554,206,10,4);
    if(alarm){
      const wave=(stage.seconds*.5)%1;
      context.globalAlpha=(1-wave)*.35;
      context.strokeStyle='#e8c28f';context.lineWidth=2;
      context.beginPath();context.ellipse(559,208,10+wave*21,4+wave*8,0,0,Math.PI*2);context.stroke();
    }
    context.restore();
  }

  function gate(context:CanvasRenderingContext2D,stage:NightStage){
    context.save();
    context.beginPath();context.moveTo(nightDoor.opening[0].x,nightDoor.opening[0].y);
    for(const point of nightDoor.opening.slice(1))context.lineTo(point.x,point.y);
    context.closePath();context.clip();
    const glow=context.createLinearGradient(283,365,283,407);
    glow.addColorStop(0,'#e8c48708');glow.addColorStop(1,'#edbd7040');
    context.fillStyle=glow;context.fillRect(255,360,56,50);
    const shutter=Math.round(43*(1-stage.gate));
    context.fillStyle='#584b66';context.fillRect(256,364,54,shutter);
    for(let y=366;y<364+shutter;y+=5){
      context.fillStyle='#86738b';context.fillRect(256,y,54,2);
      context.fillStyle='#443d58';context.fillRect(256,y+3,54,1);
    }
    context.restore();
  }

  function registrationMarks(context:CanvasRenderingContext2D,stage:NightStage){
    if(stage.phase!=='identify')return;
    const position=stage.paper.freePivot;
    context.save();context.lineWidth=1.5;context.strokeStyle='#9ac5bb';
    context.fillStyle='#a4dbc21c';
    context.beginPath();
    context.moveTo(stage.robot.x-48,stage.robot.y-66);
    context.lineTo(position.x-14,stage.paper.ground.y);
    context.lineTo(position.x+14,stage.paper.ground.y);
    context.closePath();context.fill();
    for(const sign of [-1,1]){
      context.beginPath();context.moveTo(position.x+sign*20,position.y-21);context.lineTo(position.x+sign*26,position.y-21);context.lineTo(position.x+sign*26,position.y-15);context.stroke();
    }
    context.fillStyle='#34464b';context.fillRect(position.x-20,stage.paper.ground.y+10,40,2);
    context.fillStyle='#a8cfbc';context.fillRect(position.x-20,stage.paper.ground.y+10,40*stage.progress,2);
    context.restore();
  }

  function searchlight(context:CanvasRenderingContext2D,frame:SceneFrame,stage:NightStage){
    if(!stage.beamVisible(frame.ship.back))return;
    const ship=frame.ship,from={x:ship.x,y:ship.y-ship.width*.20};
    const target=stage.target;
    const angle=Math.atan2(target.y-from.y,target.x-from.x);
    const edge={x:-Math.sin(angle)*23,y:Math.cos(angle)*23};
    context.save();
    context.globalCompositeOperation='screen';
    const light=context.createLinearGradient(from.x,from.y,target.x,target.y);
    light.addColorStop(0,'#e2d3ab2b');light.addColorStop(1,'#e2d3ab18');context.fillStyle=light;
    context.beginPath();context.moveTo(from.x-edge.x*.10,from.y-edge.y*.10);context.lineTo(target.x-edge.x,target.y-edge.y);context.lineTo(target.x+edge.x,target.y+edge.y);context.lineTo(from.x+edge.x*.10,from.y+edge.y*.10);context.closePath();context.fill();
    context.restore();
  }

  return {
    ready,
    camera:nightCamera,
    environment:time=>timelineAt(time).environment,
    cycleFraction:(_base,time)=>timelineAt(time).fraction,
    robotPose:(_base,time)=>{
      const seconds=timelineAt(time).nightSeconds;
      return seconds===null?undefined:nightStage(seconds).robot;
    },
    drawRobot(context,frame,atlas){
      const seconds=timelineAt(frame.t).nightSeconds;
      if(seconds===null)return false;
      robotAtlas=atlas;
      const stage=nightStage(seconds);
      robot.drawBody(context,frame,stage,atlas);
    },
    worldEntities(context,frame){
      const seconds=timelineAt(frame.t).nightSeconds;
      if(seconds===null)return [];
      const stage=nightStage(seconds);
      const handling=stage.phase==='contain'||stage.phase==='escort'||stage.phase==='dock';
      return [
        {depth:stage.robot.y-.3,draw:()=>{paperShadow(context,stage);carrier.groundShadow(context,stage);}},
        {depth:handling?stage.robot.y+.1:stage.robot.y-.1,draw:()=>carrier.draw(context,stage,()=>{if(handling)drawPaper(context,stage);})},
        {depth:417.1,draw:()=>carrier.draw(context,stage,()=>{if(handling)drawPaper(context,stage);},true)},
        {depth:stage.paper.ground.y,draw:()=>{if(!handling)drawPaper(context,stage);}},
        {depth:stage.robot.y+.2,draw:()=>{if(robotAtlas)robot.drawClaws(context,stage,robotAtlas,carrier.handles(stage));}},
        {depth:295,draw:()=>beacon(context,stage)},
        {depth:417.2,draw:()=>gate(context,stage)},
      ];
    },
    afterWorld(context,frame){
      const timeline=timelineAt(frame.t),stage=nightStage(timeline.nightSeconds??0);
      lightNightWorld(context,frame,stage,timeline.environment.light);
      if(timeline.nightSeconds!==null){
        registrationMarks(context,stage);
        searchlight(context,frame,stage);
      }
      const canvas=frame.output;
      canvas.dataset.studyPhase=stage.phase;
      canvas.dataset.studySeconds=stage.seconds.toFixed(2);
      canvas.dataset.robotX=stage.robot.x.toFixed(2);canvas.dataset.robotY=stage.robot.y.toFixed(2);
      canvas.dataset.targetX=stage.target.x.toFixed(2);canvas.dataset.targetY=stage.target.y.toFixed(2);
      canvas.dataset.beam=String(timeline.nightSeconds!==null&&stage.beamVisible(frame.ship.back));
      canvas.dataset.carrierOpen=stage.cargo.open.toFixed(3);
      canvas.dataset.carrierReceiving=stage.cargo.receiving.toFixed(3);
      canvas.dataset.paperFold=stage.paper.fold.toFixed(3);
    },
  };
}
