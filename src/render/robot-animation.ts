import {robotScanAngle,robotScannerJoint,robotVisualEffort,type robotPose} from './motion';

export interface RobotAnimationState {
  workSeconds:number;
  received:number;
  appliedWorkMs:number;
  assistRate:number;
  assistVisualIntensity?:number;
  assistVisualTier?:0|1|2|3;
}
type Pose=ReturnType<typeof robotPose>;
type Point={x:number;y:number};
type Outline=readonly (readonly [number,number])[];
const cell=160,scale=144/160,origin={x:-144*.54,y:-144*.97};
const clamp=(value:number)=>Math.max(0,Math.min(1,value));
const smooth=(value:number)=>{const t=clamp(value);return t*t*(3-2*t);};
const blend=(a:Point,b:Point,t:number)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});

// Measured on the actual 640×320 robot-empty-v3 atlas. These contours isolate
// the original painted scanner/forearms; they never rotate the complete robot.
const scanArm:Outline=[[17,73],[46,73],[51,77],[51,87],[60,88],[65,87],[66,103],[61,108],[47,109],[31,109],[28,96],[18,94]];
const scanFrontArm:Outline=[[98,84],[144,84],[144,132],[105,132],[107,118],[103,112],[99,107],[96,104],[96,92]];
const backForearm:Outline=[[35,95],[43,91],[51,92],[60,95],[62,105],[52,115],[40,118],[35,111]];
const frontForearm:Outline=[[62,105],[70,100],[80,99],[89,100],[98,103],[97,112],[86,122],[73,127],[62,123]];
const walkFrontArm:Outline=[[98,93],[114,92],[126,105],[129,122],[118,131],[105,128],[98,116]];

function path(c:CanvasRenderingContext2D,outline:Outline){
  c.moveTo(outline[0][0],outline[0][1]);for(const [x,y] of outline.slice(1))c.lineTo(x,y);c.closePath();
}
function atlas(c:CanvasRenderingContext2D,image:HTMLImageElement,frame:number){
  c.drawImage(image,frame%4*cell,Math.floor(frame/4)*cell,cell,cell,0,0,cell,cell);
}
function part(c:CanvasRenderingContext2D,image:HTMLImageElement,frame:number,outline:Outline){
  c.save();c.beginPath();path(c,outline);c.clip();atlas(c,image,frame);c.restore();
}
function body(c:CanvasRenderingContext2D,image:HTMLImageElement,frame:number,holes:Outline[]){
  c.save();c.beginPath();c.rect(0,0,160,160);for(const hole of holes)path(c,hole);c.clip('evenodd');atlas(c,image,frame);c.restore();
}

/** The contact points remain attached to the same independent parcel throughout grasp/release. */
export function robotAnimationPose(pose:Pose,fraction:number,animation:RobotAnimationState){
  const f=((fraction%1)+1)%1,moving=pose.action==='walk'||pose.action==='return';
  const received=clamp(animation.received),workSeconds=animation.workSeconds;
  const effort=robotVisualEffort(animation.assistVisualIntensity);
  const approach=pose.action==='pickup'?smooth((f-.49)/.03):1;
  const bend=pose.action==='pickup'?approach*(1-pose.lift):0;
  const retract=pose.action==='unload'?smooth((f-.975)/.02):0;
  const held={x:pose.x-22,y:pose.y-28};
  const contact=blend(blend(held,pose.parcel,approach),held,retract);
  return {workSeconds,received,walkFrame:Math.floor(workSeconds*8)%4,
    bob:moving?Math.round(Math.sin(workSeconds*16)):0,
    scanAngle:robotScanAngle(workSeconds,received,effort.intensity),bend,
    lean:effort.lean,scanAmplitude:effort.scanAmplitude,
    eyeLight:Math.max(received,effort.intensity*.72),
    handResponse:received*.12+effort.intensity*Math.sin(workSeconds*8)*.035,
    crouch:bend*(15+effort.intensity*5),
    hands:{back:{x:contact.x-9,y:contact.y-12},front:{x:contact.x+10,y:contact.y-10}}};
}

function elbow(shoulder:Point,wrist:Point,upper:number,lower:number,side:number):Point {
  const dx=wrist.x-shoulder.x,dy=wrist.y-shoulder.y,distance=Math.max(.001,Math.hypot(dx,dy));
  const d=Math.min(upper+lower-.001,Math.max(Math.abs(upper-lower)+.001,distance));
  const along=(upper*upper-lower*lower+d*d)/(2*d),height=Math.sqrt(Math.max(0,upper*upper-along*along));
  return {x:shoulder.x+dx/distance*along-dy/distance*height*side,
    y:shoulder.y+dy/distance*along+dx/distance*height*side};
}
function arm(c:CanvasRenderingContext2D,image:HTMLImageElement,shoulder:Point,wrist:Point,front:boolean){
  const sourceElbow=front?{x:94,y:104}:{x:59,y:96};
  const sourceGrip=front?{x:77,y:115}:{x:45,y:105};
  const lower=Math.hypot(sourceGrip.x-sourceElbow.x,sourceGrip.y-sourceElbow.y);
  const joint=elbow(shoulder,wrist,27,lower,front?-1:1);
  // The narrow upper link uses the painted plum/cream arm, with a round shoulder
  // sampled from that same atlas. The original detailed glove is a separate limb.
  c.save();c.translate(shoulder.x,shoulder.y);c.rotate(Math.atan2(joint.y-shoulder.y,joint.x-shoulder.x)-Math.PI/2);
  const length=Math.hypot(joint.x-shoulder.x,joint.y-shoulder.y);
  c.drawImage(image,101,cell+90,8,10,-5,-3,10,length+6);c.restore();
  c.save();c.translate(joint.x,joint.y);
  c.rotate(Math.atan2(wrist.y-joint.y,wrist.x-joint.x)-Math.atan2(sourceGrip.y-sourceElbow.y,sourceGrip.x-sourceElbow.x));
  c.translate(-sourceElbow.x,-sourceElbow.y);part(c,image,6,front?frontForearm:backForearm);c.restore();
}

function eyes(c:CanvasRenderingContext2D,image:HTMLImageElement,frame:number,received:number){
  if(received<=0)return;
  c.save();c.globalCompositeOperation='screen';c.globalAlpha=received*.85;
  const eyesY=frame===5?73:57;
  c.drawImage(image,frame%4*cell+58,Math.floor(frame/4)*cell+eyesY,35,20,58,eyesY- received*1.5,35,20+received*2);
  c.fillStyle='#fff0b9';c.globalAlpha=received*.9;c.fillRect(63,eyesY+3,3,4);c.fillRect(83,eyesY+6,2,4);c.restore();
}

function upperBody(c:CanvasRenderingContext2D,lean:number,draw:()=>void){
  c.save();c.beginPath();c.rect(0,0,160,125);c.rect(0,125,45,35);c.rect(115,125,45,35);c.clip();
  c.transform(1,0,lean,1,-lean*125,0);draw();c.restore();
}
function legs(c:CanvasRenderingContext2D,image:HTMLImageElement,frame:number){
  c.drawImage(image,frame%4*cell+45,Math.floor(frame/4)*cell+125,70,35,45,125,70,35);
}

export function drawAnimatedRobot(c:CanvasRenderingContext2D,image:HTMLImageElement,pose:Pose,fraction:number,animation:RobotAnimationState){
  const motion=robotAnimationPose(pose,fraction,animation),moving=pose.action==='walk'||pose.action==='return';
  c.save();c.translate(Math.round(pose.x),Math.round(pose.y+motion.bob));
  if(pose.action==='walk'&&pose.facing==='right')c.scale(-1,1);
  c.translate(origin.x,origin.y);c.scale(scale,scale);
  if(pose.action==='scan'){
    legs(c,image,4);
    upperBody(c,motion.lean,()=>{
      body(c,image,4,[scanArm]);
      c.save();c.translate(robotScannerJoint.x,robotScannerJoint.y);c.rotate(motion.scanAngle);
      c.translate(-robotScannerJoint.x,-robotScannerJoint.y);part(c,image,4,scanArm);c.restore();
      eyes(c,image,4,motion.eyeLight);
    });
  }else if(pose.action==='walk'){
    legs(c,image,motion.walkFrame);
    upperBody(c,motion.lean,()=>{
      body(c,image,motion.walkFrame,[walkFrontArm]);
      c.save();c.translate(105,96);c.rotate(-motion.handResponse);
      c.translate(-105,-96);part(c,image,motion.walkFrame,walkFrontArm);c.restore();
      eyes(c,image,motion.walkFrame,motion.eyeLight);
    });
  }else{
    // The torso/legs and both hands remain separate. A continuous crouch and
    // articulated wrists replace the old hard switch from pickup cell 5 to 6.
    legs(c,image,moving?motion.walkFrame:4);
    const torsoDrop=motion.crouch;
    c.save();c.translate(motion.bend*4,torsoDrop);
    upperBody(c,motion.lean,()=>{body(c,image,4,[scanArm,scanFrontArm]);eyes(c,image,4,motion.eyeLight);});c.restore();
    const local=(p:Point)=>({x:(p.x-Math.round(pose.x)-origin.x)/scale,
      y:(p.y-Math.round(pose.y+motion.bob)-origin.y)/scale});
    const handBob=moving?motion.bob:0;
    arm(c,image,{x:61+motion.bend*4+motion.lean*(89-125),y:89+torsoDrop},local({...motion.hands.back,y:motion.hands.back.y+handBob}),false);
    arm(c,image,{x:99+motion.bend*4+motion.lean*(92-125),y:92+torsoDrop},local({...motion.hands.front,y:motion.hands.front.y+handBob}),true);
  }
  c.restore();
}

export const animatedRobotStage={width:256,height:224,anchor:{x:128,y:184}} as const;

/** Rasterize clipped limbs before scene picking sees them, so every hit uses
 * the visible robot's composed alpha rather than a transformed full atlas cell. */
export function createAnimatedRobotPainter(createStage:()=>HTMLCanvasElement=()=>document.createElement('canvas')){
  const stage=createStage();stage.width=animatedRobotStage.width;stage.height=animatedRobotStage.height;
  const painter=stage.getContext('2d')!;
  let revision=0;
  return {
    draw(context:CanvasRenderingContext2D,image:HTMLImageElement,pose:Pose,fraction:number,animation:RobotAnimationState){
      // The integer offset preserves the renderer's original pixel rounding.
      // Only translation changes; all parcel/shoulder/wrist offsets stay intact.
      const x=Math.round(pose.x)-animatedRobotStage.anchor.x,y=Math.round(pose.y)-animatedRobotStage.anchor.y;
      const local={...pose,x:pose.x-x,y:pose.y-y,parcel:{...pose.parcel,x:pose.parcel.x-x,y:pose.parcel.y-y}};
      painter.setTransform(1,0,0,1,0,0);painter.clearRect(0,0,stage.width,stage.height);
      painter.imageSmoothingEnabled=false;painter.beginPath();
      drawAnimatedRobot(painter,image,local,fraction,animation);
      painter.beginPath();stage.dataset.hitRevision=String(++revision);
      context.drawImage(stage,x,y);
    },
  };
}
