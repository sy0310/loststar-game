import {describe,expect,it,vi} from 'vitest';
import {advance,newGame,upgrade} from '../src/game/engine';
import {createAssist,tapAssist} from '../src/game/assist';
import {fusionCycleFraction,fusionRobotWork} from '../src/fusion/render-clock';
import {createRobotPerformance,robotReceivedDurationMs,robotAssistVisualEnvelope,robotAssistVisualRules} from '../src/fusion/robot-performance';
import {animatedRobotStage,createAnimatedRobotPainter,robotAnimationPose} from '../src/render/robot-animation';
import {robotPose,robotScannerPoint,robotScannerJoint,robotScannerSource} from '../src/render/motion';

const epoch=1800000000000;

describe('one actual robot work clock',()=>{
  it('registers route, feet and scanner to consumed work, including projection and task wrap',()=>{
    let state=advance(newGame(epoch),epoch+11800);
    state=tapAssist(state,state.lastAt);
    const before=structuredClone(state);
    const first=fusionRobotWork(state,state.lastAt);
    const projected=fusionRobotWork(state,state.lastAt+200);
    expect(projected.workSeconds-first.workSeconds).toBeCloseTo(.26,8);
    expect(projected.appliedWorkMs).toBeCloseTo(60,8);
    const settled=advance(state,state.lastAt+200);
    expect(settled.cycles).toBe(1);
    expect(fusionRobotWork(settled,settled.lastAt)).toEqual(projected);
    expect(state).toEqual(before);
    expect(fusionCycleFraction(state,state.lastAt+200)).toBeCloseTo(projected.cycles%1,10);
    const animation={...projected,received:0};
    const motion=robotAnimationPose(robotPose(projected.cycles%1),projected.cycles%1,animation);
    expect(motion.walkFrame).toBe(Math.floor(projected.workSeconds*8)%4);
    expect(motion.bob).toBe(Math.round(Math.sin(projected.workSeconds*16)));
  });

  it('preserves the work phase on scanner upgrade and restores automatic cadence at exhaustion',()=>{
    let state=advance(newGame(epoch),epoch+4300);
    const original=fusionRobotWork(state,state.lastAt);
    state=upgrade(state,'scanner');
    expect(fusionRobotWork(state,state.lastAt).workSeconds).toBeCloseTo(original.workSeconds,9);
    state=tapAssist(state,state.lastAt);
    const consuming=advance(state,state.lastAt+400);
    expect(fusionRobotWork(consuming,consuming.lastAt).assistRate).toBeCloseTo(.6);
    const exhausted=advance(state,state.lastAt+1500);
    expect(exhausted.assist!.pendingWorkMs).toBe(0);
    const restored=fusionRobotWork(exhausted,exhausted.lastAt);
    expect(restored.assistRate).toBe(0);
    expect(fusionRobotWork(exhausted,exhausted.lastAt+100).workSeconds-restored.workSeconds).toBeCloseTo(.122,8);
  });

  it('gives accepted input a transient eye/grip acknowledgement without restarting the task',()=>{
    let state=advance(newGame(epoch),epoch+3700);
    const performance=createRobotPerformance(()=>state);
    state=tapAssist(state,state.lastAt);
    const event={token:1,kind:'accepted',at:100};
    performance.receive(event);
    const animation=performance.frame(state.lastAt,100+robotReceivedDurationMs/2);
    expect(animation.received).toBeCloseTo(1);
    expect(animation.workSeconds).toBeCloseTo(3.7);
    expect(animation.appliedWorkMs).toBe(0);
    performance.receive({...event,at:250});
    expect(performance.frame(state.lastAt,100+robotReceivedDurationMs).received).toBeCloseTo(0);
    expect(performance.frame(state.lastAt,100+robotReceivedDurationMs+1).received).toBe(0);
  });

  it('rejects a replay, refused/full queue and night acknowledgements and adds no work',()=>{
    let state=newGame(epoch);
    const performance=createRobotPerformance(()=>state);
    const before=structuredClone(state);
    performance.receive({token:1,kind:'accepted',at:0});
    performance.receive({token:2,kind:'rejected',at:0});
    expect(performance.frame(epoch,100).received).toBe(0);
    expect(state).toEqual(before);
    state={...state,assist:{...createAssist(),actionSeq:5,pendingWorkMs:3000,enqueuedWorkMs:3000}};
    performance.receive({token:3,kind:'rejected',at:0});
    expect(performance.frame(epoch,100).received).toBe(0);
    state={...state,world:{...state.world,elapsedMs:240000}};
    performance.receive({token:4,kind:'accepted',at:0});
    const night=performance.frame(epoch+100,100);
    expect(night.received).toBe(0);expect(night.assistRate).toBe(0);
    expect(night.appliedWorkMs).toBe(0);
  });
});

describe('layered limbs and actual contact',()=>{
  it('registers the moving scan emitter to the exact same arm pivot and rotation',()=>{
    const pose=robotPose(.4),legacy=robotScannerPoint(pose,0);
    const animation={workSeconds:1,received:.7,appliedWorkMs:20,assistRate:.6};
    const motion=robotAnimationPose(pose,.4,animation);
    const source=robotScannerPoint(pose,0,animation),dx=robotScannerSource.x-robotScannerJoint.x,dy=robotScannerSource.y-robotScannerJoint.y;
    expect(source.x).toBeCloseTo(pose.x-144*.54+(robotScannerJoint.x+dx*Math.cos(motion.scanAngle)-dy*Math.sin(motion.scanAngle))*.9,9);
    expect(source.y).toBeCloseTo(pose.y-144*.97+(robotScannerJoint.y+dx*Math.sin(motion.scanAngle)+dy*Math.cos(motion.scanAngle))*.9,9);
    expect(source).not.toEqual(legacy);
    expect(robotScannerPoint(pose,0,{...animation,workSeconds:0,received:0})).toEqual(legacy);
  });

  it('keeps feet on their real work phase in every visual tier, with stronger upper-body and scanner effort',()=>{
    const fraction=.17,pose=robotPose(fraction),workSeconds=fraction*12;
    const variants=[0,1/3,2/3,1].map(assistVisualIntensity=>robotAnimationPose(pose,fraction,
      {workSeconds,received:.5,appliedWorkMs:300,assistRate:.6,assistVisualIntensity}));
    expect(new Set(variants.map(frame=>frame.walkFrame)).size).toBe(1);
    expect(new Set(variants.map(frame=>frame.bob)).size).toBe(1);
    expect(variants[1].eyeLight).toBeGreaterThan(0);
    expect(variants[2].lean).toBeGreaterThan(variants[1].lean);
    expect(variants[3].lean).toBeGreaterThan(variants[2].lean);
    expect(variants[3].scanAmplitude).toBeGreaterThan(variants[2].scanAmplitude);
    expect(variants[3].scanAmplitude).toBeCloseTo(.42);
    expect(variants[3].hands).toEqual(variants[0].hands);
  });

  it('registers the high-tier scanner to the leaned torso without shifting the feet or parcel',()=>{
    const pose=robotPose(.4),animation={workSeconds:4.8,received:.3,appliedWorkMs:600,assistRate:.6,assistVisualIntensity:1};
    const motion=robotAnimationPose(pose,.4,animation),source=robotScannerPoint(pose,0,animation);
    const dx=robotScannerSource.x-robotScannerJoint.x,dy=robotScannerSource.y-robotScannerJoint.y;
    const x=robotScannerJoint.x+dx*Math.cos(motion.scanAngle)-dy*Math.sin(motion.scanAngle);
    const y=robotScannerJoint.y+dx*Math.sin(motion.scanAngle)+dy*Math.cos(motion.scanAngle);
    expect(source.x).toBeCloseTo(pose.x-144*.54+(x+motion.lean*(y-125))*.9,9);
    expect(source.y).toBeCloseTo(pose.y-144*.97+y*.9,9);
    expect(motion.bob).toBe(0);
  });

  it('retains ground contact, lift, carry, handoff and release at the fastest existing scanner/assist rate',()=>{
    const rate=2.1*1.6,duration=12000/rate,frames=[];
    let prior:ReturnType<typeof robotAnimationPose>|undefined,priorAction='';
    for(let elapsed=0;elapsed<duration;elapsed+=1000/60){
      const f=elapsed/duration,pose=robotPose(f);
      const animation={workSeconds:f*12,received:0,appliedWorkMs:elapsed*.6,assistRate:.6,assistVisualIntensity:1};
      const motion=robotAnimationPose(pose,f,animation);
      frames.push({f,pose,motion});
      if(pose.action==='pickup'&&f>=.52||pose.action==='return'||pose.action==='unload'&&f<=.975){
        expect(motion.hands.back.x).toBeCloseTo(pose.parcel.x-9,7);
        expect(motion.hands.front.y).toBeCloseTo(pose.parcel.y-10,7);
      }
      if(prior&&pose.action==='pickup'&&priorAction==='pickup')expect(Math.hypot(motion.hands.front.x-prior.hands.front.x,motion.hands.front.y-prior.hands.front.y)).toBeLessThan(9);
      prior=motion;priorAction=pose.action;
    }
    expect(frames.filter(({pose})=>pose.action==='pickup').length).toBeGreaterThanOrEqual(30);
    expect(frames.filter(({pose})=>pose.action==='unload').length).toBeGreaterThan(18);
    expect(frames.some(({pose})=>pose.action==='pickup'&&pose.lift===0)).toBe(true);
    expect(frames.some(({pose})=>pose.action==='pickup'&&pose.lift===1)).toBe(true);
    expect(frames.some(({pose})=>pose.action==='unload'&&pose.parcel.delivered&&pose.parcel.visible)).toBe(true);
  });
});

describe('three accepted-command visual tiers',()=>{
  it('layers three real accepted inputs, then smoothly returns to idle without writing to the economy',()=>{
    let state=newGame(epoch);
    const performance=createRobotPerformance(()=>state),tiers:number[]=[];
    for(let index=0;index<3;index++){
      state=tapAssist(state,epoch+index*300);
      performance.receive({token:index+1,kind:'accepted',at:index*300});
      const frame=performance.frame(state.lastAt,index*300+robotAssistVisualRules.attackMs);
      tiers.push(frame.assistVisualTier!);
      expect(frame.assistVisualIntensity).toBeCloseTo((index+1)/3,8);
      expect(frame.workSeconds).toBe(fusionRobotWork(state,state.lastAt).workSeconds);
    }
    expect(tiers).toEqual([1,2,3]);
    const original=structuredClone(state),intensities:number[]=[];
    let previous=performance.frame(state.lastAt,720).assistVisualIntensity!;
    for(let visualNow=736;visualNow<=3840;visualNow+=16){
      const frame=performance.frame(state.lastAt,visualNow),intensity=frame.assistVisualIntensity!;
      expect(intensity).toBeLessThanOrEqual(previous+1e-12);
      expect(previous-intensity).toBeLessThan(.011);
      expect(frame.workSeconds).toBe(fusionRobotWork(state,state.lastAt).workSeconds);
      intensities.push(intensity);previous=intensity;
    }
    expect(intensities[intensities.length-1]).toBe(0);
    expect(performance.frame(state.lastAt,4000).assistVisualTier).toBe(0);
    expect(state).toEqual(original);
  });

  it('does not raise the tier on refused input, a full queue, replay, or night attention',()=>{
    let state=newGame(epoch);
    const performance=createRobotPerformance(()=>state);
    state=tapAssist(state,epoch);
    performance.receive({token:1,kind:'accepted',at:0});
    expect(performance.frame(epoch,120).assistVisualTier).toBe(1);
    performance.receive({token:1,kind:'accepted',at:120});
    performance.receive({token:2,kind:'rejected',at:120});
    performance.receive({token:3,kind:'contact',at:120});
    expect(performance.frame(epoch,240).assistVisualIntensity).toBeCloseTo(1/3);
    state={...state,assist:{...state.assist!,pendingWorkMs:3000}};
    performance.receive({token:4,kind:'rejected',at:240});
    expect(performance.frame(epoch,360).assistVisualTier).toBe(1);
    state={...state,world:{...state.world,elapsedMs:240000},assist:{...state.assist!,actionSeq:2}};
    performance.receive({token:5,kind:'accepted',at:360});
    expect(performance.frame(epoch,480).assistVisualIntensity).toBe(0);
    expect(performance.frame(epoch,480).assistVisualTier).toBe(0);
  });

  it('uses a continuous attack and release with no residual pose after the envelope ends',()=>{
    const {attackMs,holdMs,releaseMs}=robotAssistVisualRules;
    for(const boundary of [0,attackMs,holdMs,holdMs+releaseMs]){
      expect(Math.abs(robotAssistVisualEnvelope(boundary+.01)-robotAssistVisualEnvelope(boundary-.01))).toBeLessThan(1e-6);
    }
    expect(robotAssistVisualEnvelope(-1)).toBe(0);
    expect(robotAssistVisualEnvelope(NaN)).toBe(0);
    expect(robotAssistVisualEnvelope(holdMs+releaseMs)).toBe(0);
  });
});

describe('composed robot hit alpha',()=>{
  function stageFixture(){
    const calls:{name:PropertyKey;args:unknown[]}[]=[];
    const context=new Proxy({} as CanvasRenderingContext2D,{
      get(target,name){
        if(name in target)return Reflect.get(target,name);
        const method=(...args:unknown[])=>calls.push({name,args});Reflect.set(target,name,method);return method;
      },
      set:(target,name,value)=>Reflect.set(target,name,value),
    });
    const stage={width:0,height:0,dataset:{},getContext:()=>context} as unknown as HTMLCanvasElement;
    const main={drawImage:vi.fn()} as unknown as CanvasRenderingContext2D;
    const createStage=vi.fn(()=>stage);
    return {calls,stage,main,createStage,painter:createAnimatedRobotPainter(createStage)};
  }

  it('records one composed-alpha command, reusing and versioning the same canvas rather than leaking clipped atlas bodies',()=>{
    const fixture=stageFixture(),atlas={} as HTMLImageElement;
    const animation={workSeconds:9.6,received:0,appliedWorkMs:600,assistRate:0};
    fixture.painter.draw(fixture.main,atlas,robotPose(.8),.8,animation);
    expect(fixture.stage.width).toBe(animatedRobotStage.width);
    expect(fixture.stage.height).toBe(animatedRobotStage.height);
    expect(fixture.calls.filter(({name})=>name==='drawImage').length).toBeGreaterThan(4);
    expect(fixture.main.drawImage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fixture.main.drawImage).mock.calls[0][0]).toBe(fixture.stage);
    expect(fixture.stage.dataset.hitRevision).toBe('1');
    fixture.painter.draw(fixture.main,atlas,robotPose(.95),.95,{...animation,workSeconds:11.4});
    expect(fixture.createStage).toHaveBeenCalledTimes(1);
    expect(fixture.main.drawImage).toHaveBeenCalledTimes(2);
    expect(vi.mocked(fixture.main.drawImage).mock.calls[1][0]).toBe(fixture.stage);
    expect(fixture.stage.dataset.hitRevision).toBe('2');
  });

  it('keeps limb/parcel registration invariant when the composed stage follows the robot along the route',()=>{
    const fixture=stageFixture(),atlas={} as HTMLImageElement;
    const animation={workSeconds:9.6,received:0,appliedWorkMs:600,assistRate:0};
    const pose={...robotPose(.8),x:411.25,y:430.75,parcel:{...robotPose(.8).parcel,x:389.25,y:402.75}};
    fixture.painter.draw(fixture.main,atlas,pose,.8,animation);
    const original=fixture.calls.slice();fixture.calls.length=0;
    fixture.painter.draw(fixture.main,atlas,{...pose,x:pose.x+17,y:pose.y-31,
      parcel:{...pose.parcel,x:pose.parcel.x+17,y:pose.parcel.y-31}},.8,animation);
    expect(fixture.calls).toEqual(original);
    const first=vi.mocked(fixture.main.drawImage).mock.calls[0],second=vi.mocked(fixture.main.drawImage).mock.calls[1];
    expect(second[1]).toBe(Number(first[1])+17);
    expect(second[2]).toBe(Number(first[2])-31);
  });
});
