import type {SoundCue} from './discovery';
type Tone={at:number;hz:number;to?:number;duration:number;gain:number;wave:OscillatorType};
// Original short postal-radio motifs; no downloads, samples or third-party music.
export const motifs:Record<SoundCue,Tone[]>={
  scan:[{at:0,hz:620,to:1240,duration:.14,gain:.055,wave:'triangle'}],
  pickup:[{at:0,hz:330,duration:.06,gain:.065,wave:'square'},{at:.075,hz:495,duration:.12,gain:.05,wave:'triangle'}],
  'discovery-parcel':[523,659,784].map((hz,i)=>({at:i*.085,hz,duration:.17,gain:.055,wave:'triangle'})),
  'discovery-resident':[392,523,494,659].map((hz,i)=>({at:i*.09,hz,duration:.16,gain:.05,wave:'triangle'})),
  'discovery-glitch':[440,415,880,1046].map((hz,i)=>({at:i*.08,hz,duration:.12,gain:.04,wave:i===1?'square':'triangle'})),
  return:[392,494,587,784].map((hz,i)=>({at:i*.09,hz,duration:.27,gain:.045,wave:'triangle'})),
  upgrade:[{at:0,hz:294,to:588,duration:.17,gain:.055,wave:'triangle'},{at:.18,hz:784,duration:.2,gain:.05,wave:'triangle'}],
  interaction:[{at:0,hz:440,to:400,duration:.09,gain:.04,wave:'triangle'}],
};
export function scheduleMotif(context:BaseAudioContext,destination:AudioNode,cue:SoundCue,at=context.currentTime) {
  const nodes:OscillatorNode[]=[];
  for(const tone of motifs[cue]){
    const oscillator=context.createOscillator(),gain=context.createGain(),t=at+tone.at;
    oscillator.type=tone.wave;oscillator.frequency.setValueAtTime(tone.hz,t);
    if(tone.to)oscillator.frequency.exponentialRampToValueAtTime(tone.to,t+tone.duration);
    gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(tone.gain,t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+tone.duration);
    oscillator.connect(gain);gain.connect(destination);oscillator.start(t);oscillator.stop(t+tone.duration+.01);
    oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};nodes.push(oscillator);
  }
  return nodes;
}
export class SoundDesk {
  private context:AudioContext|null=null;
  private master:GainNode|null=null;
  private active:OscillatorNode[]=[];
  constructor(private muted:boolean){
    this.status();
    window.addEventListener('loststar:sound-cue',e=>this.play((e as CustomEvent<{cue:SoundCue}>).detail.cue));
    document.addEventListener('pointerdown',()=>{if(!this.muted)void this.unlock();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop();});
  }
  private status(){document.documentElement.dataset.audioState=this.muted?'muted':this.context?.state==='running'?'running':'awaiting-gesture';}
  async unlock(){
    if(this.muted)return;
    try {
      if(!this.context){this.context=new AudioContext();this.master=this.context.createGain();this.master.connect(this.context.destination);}
      this.master!.gain.value=.65;await this.context.resume();
    }catch{/* Restricted or unavailable audio never blocks gameplay. */}
    this.status();
  }
  async setMuted(muted:boolean){this.muted=muted;if(muted){this.stop();if(this.master)this.master.gain.value=0;}else await this.unlock();this.status();}
  private stop(){for(const node of this.active){try{node.stop();}catch{/* Already ended. */}}this.active=[];}
  play(cue:SoundCue){
    if(this.muted||document.hidden||this.context?.state!=='running'||!this.master)return;
    this.active=this.active.filter(node=>node.onended!==null);
    const nodes=scheduleMotif(this.context,this.master,cue);
    for(const node of nodes){const end=node.onended;node.onended=event=>{if(typeof end==='function')end.call(node,event);this.active=this.active.filter(n=>n!==node);};}
    this.active.push(...nodes);
  }
}
