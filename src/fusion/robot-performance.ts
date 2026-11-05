import type {SaveData} from '../game/engine';
import type {RobotAnimationState} from '../render/robot-animation';
import {fusionRobotWork} from './render-clock';

export const robotReceivedDurationMs = 420;
export const robotAssistVisualRules = {attackMs:120,holdMs:800,releaseMs:2400,tapsToFull:3} as const;
interface ReceivedEvent {token:number;kind:string;at:number}

const smooth=(value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};

/** A wall-clock visual envelope; it never enters the saved work queue. */
export function robotAssistVisualEnvelope(ageMs:number){
  if(ageMs<0||!Number.isFinite(ageMs))return 0;
  if(ageMs<robotAssistVisualRules.attackMs)return smooth(ageMs/robotAssistVisualRules.attackMs);
  return 1-smooth((ageMs-robotAssistVisualRules.holdMs)/robotAssistVisualRules.releaseMs);
}
export function robotAssistVisualTier(intensity:number):0|1|2|3{
  return intensity<=0?0:intensity<.45?1:intensity<.78?2:3;
}

/** Accepted commands layer a visual response. The existing work integral alone drives travel and feet. */
export function createRobotPerformance(getState:()=>SaveData) {
  let receivedSequence = getState().assist?.actionSeq ?? 0;
  const receipts:{token:number;at:number}[]=[];
  const tokens = new Set<number>();
  return {
    receive(event:ReceivedEvent) {
      const state=getState(),sequence=state.assist?.actionSeq??0;
      if(event.kind!=='accepted'||!Number.isFinite(event.at)||tokens.has(event.token)
        ||state.world.elapsedMs%300000>=240000||sequence<=receivedSequence)return;
      receivedSequence=sequence;tokens.add(event.token);receipts.push({token:event.token,at:event.at});
      if(tokens.size>32)tokens.delete(tokens.values().next().value!);
      if(receipts.length>6)receipts.shift();
    },
    frame(now=Date.now(),visualNow=performance.now()):RobotAnimationState {
      const state=getState(),work=fusionRobotWork(state,now);
      let received=0,intensity=0;
      // Night patrol has its own clock and rig. Daytime enthusiasm cannot leak into it.
      if(state.world.elapsedMs%300000>=240000)receipts.length=0;
      for(let i=receipts.length-1;i>=0;i--){
        const age=visualNow-receipts[i].at;
        if(age>robotAssistVisualRules.holdMs+robotAssistVisualRules.releaseMs){receipts.splice(i,1);continue;}
        if(age>=0&&age<robotReceivedDurationMs)received=Math.max(received,Math.sin(age/robotReceivedDurationMs*Math.PI));
        intensity+=robotAssistVisualEnvelope(age)/robotAssistVisualRules.tapsToFull;
      }
      intensity=Math.min(1,intensity);
      return {...work,received,assistVisualIntensity:intensity,assistVisualTier:robotAssistVisualTier(intensity)};
    },
  };
}
