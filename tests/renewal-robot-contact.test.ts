import {afterEach,describe,it,expect,vi} from 'vitest';
import {drawRenewalRobot,prepareRenewalRobot} from '../src/render/renewal-robot';
import {robotPose} from '../src/render/motion';

type Matrix=[number,number,number,number,number,number];
/** Minimal independent Canvas affine recorder. It observes the actual painted
 * glove origins after every renderer transform, not a copy of the inverse. */
function recorder(){
 let matrix:Matrix=[1,0,0,1,0,0];const stack:Matrix[]=[],hands:{x:number;y:number;basis:number[]}[]=[],images:string[]=[];
 const multiply=(right:Matrix)=>{const[a,b,c,d,e,f]=matrix,[g,h,i,j,k,l]=right;matrix=[a*g+c*h,b*g+d*h,a*i+c*j,b*i+d*j,a*k+c*l+e,b*k+d*l+f];};
 const noop=()=>{};
 const context={
  save(){stack.push([...matrix]);},restore(){matrix=stack.pop()!;},
  translate(x:number,y:number){multiply([1,0,0,1,x,y]);},
  rotate(angle:number){multiply([Math.cos(angle),Math.sin(angle),-Math.sin(angle),Math.cos(angle),0,0]);},
  scale(x:number,y:number){multiply([x,0,0,y,0,0]);},
  transform(...next:Matrix){multiply(next);},
  drawImage(image:HTMLImageElement){images.push(image.src);if(image.src.includes('robot-grip-hand'))hands.push({x:matrix[4],y:matrix[5],basis:matrix.slice(0,4)});},
  beginPath:noop,moveTo:noop,lineTo:noop,stroke:noop,arc:noop,fill:noop,fillRect:noop,
 } as unknown as CanvasRenderingContext2D;
 return {context,hands,images};
}
afterEach(()=>vi.unstubAllGlobals());
describe('renewed night hand contact',()=>{
 for(const {tilt,flip,bob} of [{tilt:.17,flip:false,bob:2.4},{tilt:-.17,flip:false,bob:-1.25},{tilt:.17,flip:true,bob:1.75},{tilt:0,flip:false,bob:.6}]){
  it(`keeps both rendered wrist endpoints on world handles with tilt ${tilt}, mirror ${flip} and bob ${bob}`,async()=>{
   vi.stubGlobal('Image',class{src='';decode(){return Promise.resolve();}});
   await prepareRenewalRobot();
   const base=robotPose(.94),pose={...base,x:316.37,y:429.46,parcel:{...base.parcel,visible:false}};
   const handles=[{x:286.381,y:383.99},{x:310.27,y:389.85}] as const;
   const paint=recorder();
   expect(drawRenewalRobot(paint.context,pose,.94,{workSeconds:27,received:0,assistRate:0,appliedWorkMs:0},{hands:handles,tilt,flip,bob})).toBe(true);
   expect(paint.hands).toHaveLength(2);
   paint.hands.forEach((hand,index)=>{
    expect(hand.x).toBeCloseTo(handles[index].x,8);
    expect(hand.y).toBeCloseTo(handles[index].y,8);
   });
  });
 }
});

describe('empty-handed night patrol',()=>{
 for(const action of ['return','unload'] as const){
  it(`keeps ${action} hands on the body when the hidden parcel is a distant anomaly target`,async()=>{
   vi.stubGlobal('Image',class{src='';decode(){return Promise.resolve();}});
   await prepareRenewalRobot();
   const base=robotPose(action==='return'?.8:.95);
   const pose={...base,action,x:420.4,y:470.3,carrying:false,parcel:{...base.parcel,x:780,y:180,visible:false,held:false}};
   const paint=recorder();
   drawRenewalRobot(paint.context,pose,.95,{workSeconds:27,received:0,assistRate:0,appliedWorkMs:0},{tilt:.13,bob:.6});
   // One relaxed painted glove and the independent scanner arm replace the two
   // handling wrists. Neither reaches toward the hidden anomaly coordinates.
   expect(paint.hands).toHaveLength(1);
   expect(Math.hypot(paint.hands[0].x-pose.x,paint.hands[0].y-pose.y)).toBeLessThan(75);
   expect(Math.hypot(paint.hands[0].x-pose.parcel.x,paint.hands[0].y-pose.parcel.y)).toBeGreaterThan(300);
  });
 }
});

it('uses exactly the same wrist transform and cuff angle in body and foreground glass passes',async()=>{
 vi.stubGlobal('Image',class{src='';decode(){return Promise.resolve();}});await prepareRenewalRobot();
 const base=robotPose(.94),pose={...base,x:316.37,y:429.46};
 const hands=[{x:286.381,y:383.99},{x:310.27,y:389.85}] as const;
 const animation={workSeconds:27,received:0,assistRate:0,appliedWorkMs:0};
 const options={hands,tilt:.17,flip:true,bob:1.75};
 const whole=recorder(),rear=recorder(),front=recorder();
 drawRenewalRobot(whole.context,pose,.94,animation,options);
 drawRenewalRobot(rear.context,pose,.94,animation,{...options,hideGloves:true});
 drawRenewalRobot(front.context,pose,.94,animation,{...options,glovesOnly:true});
 expect(rear.hands).toHaveLength(0);expect(front.hands).toEqual(whole.hands);expect(front.hands).toHaveLength(2);
 expect(front.images.every(src=>src.includes('robot-grip-hand'))).toBe(true);
});
