import type {SaveData} from '../game/engine';
import type {RobotAnimationState} from '../render/robot-animation';
import {fusionRobotWork} from './render-clock';

export const robotReceivedDurationMs = 420;
interface ReceivedEvent {token:number;kind:string;at:number}

/** Input acknowledgement is transient. Only the existing work integral drives effort. */
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
      const work=fusionRobotWork(getState(),now);
      let received=0;
      for(let i=receipts.length-1;i>=0;i--){
        const age=visualNow-receipts[i].at;
        if(age>robotReceivedDurationMs){receipts.splice(i,1);continue;}
        if(age>=0)received=Math.max(received,Math.sin(age/robotReceivedDurationMs*Math.PI));
      }
      return {...work,received};
    },
  };
}
