import stationUrl from '../../assets/runtime/station.webp';

export class BaseArrival {
  private loading=false;
  constructor(private root:HTMLElement,private image:HTMLImageElement){}
  async load() {
    if(this.loading||this.root.dataset.backgroundState==='ready')return;
    this.loading=true;this.root.dataset.backgroundState='loading';
    this.root.setAttribute('aria-busy','true');
    this.root.querySelector('.loading-message')!.textContent='收件站正在接通';
    this.root.querySelector('.base-loading p')!.textContent='正在展开收藏室，请稍候片刻。';
    try {
      this.image.src=stationUrl;
      // decode includes the actual background image, unlike CSS background + <img> queries.
      await this.image.decode();
      if(!this.image.naturalWidth)throw new Error('empty station');
      this.root.dataset.backgroundState='ready';
    } catch {
      this.image.removeAttribute('src');this.root.dataset.backgroundState='error';
      this.root.querySelector('.loading-message')!.textContent='收件站暂未接通';
      this.root.querySelector('.base-loading p')!.textContent='信号有些不稳，收藏与探索进度仍在。可以重新接通。';
    }
    finally {this.loading=false;this.root.setAttribute('aria-busy','false');}
  }
}
