import type { Discovery } from '../content/types';
import { itemArt } from './art';
import { icon } from '../icons';

export type SoundCue = 'discovery-parcel' | 'discovery-resident' | 'discovery-glitch' | 'upgrade' | 'return' | 'interaction';
// Audio remains opt-in and unconnected. Consumers can listen without owning rewards.
export function soundCue(cue:SoundCue,id?:string) {
  window.dispatchEvent(new CustomEvent('loststar:sound-cue',{detail:{cue,id}}));
}
export class DiscoveryDirector {
  active=false;
  private timeout:ReturnType<typeof setTimeout>|undefined;
  constructor(private element:HTMLElement,private onEnd:()=>void){}
  show(d:Discovery,additional=0) {
    this.active=true;
    this.element.hidden=false;this.element.dataset.presentation=d.id;this.element.dataset.cue=d.presentation.cue;
    this.element.innerHTML=`<div class="discovery-sparks" aria-hidden="true">✦ · ✧ · ✦</div><span class="discovery-portrait">${itemArt(d.id)}</span><div class="discovery-copy"><span class="micro-label">${d.kind==='creature'?'遇见新邻居':d.kind==='event'?'异常现场记录':'发现宇宙奇物'}</span><strong>${d.presentation.headline}</strong><p>${d.presentation.line}${additional?` · 另有 ${additional} 份记录已入档`:''}</p><button class="discovery-inspect" data-detail="${d.id}">查看档案 ${icon('arrow')}</button></div><button class="discovery-dismiss" data-action="dismiss-discovery" aria-label="收起发现提示">${icon('close')}</button>`;
    soundCue(`discovery-${d.presentation.cue}`,d.id);
    this.timeout=setTimeout(()=>this.hide(),6000);
  }
  hide() {
    if(this.timeout)clearTimeout(this.timeout);
    this.element.hidden=true;this.element.removeAttribute('data-presentation');this.element.innerHTML='';
    const wasActive=this.active;this.active=false;if(wasActive)this.onEnd();
  }
}
