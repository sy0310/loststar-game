import receipt from '../../assets/runtime/receipt.webp';
import tape from '../../assets/runtime/tape.webp';
import nested from '../../assets/runtime/nested.webp';
import mouse from '../../assets/runtime/mouse.webp';
import signal from '../../assets/runtime/signal.webp';
import hermit from '../../assets/runtime/hermit.webp';
import tagbird from '../../assets/runtime/tagbird.webp';
import cosmicParcel from '../../assets/runtime/cosmic-parcel.webp';
import stamp from '../../assets/runtime/stamp.webp';
import bell from '../../assets/runtime/bell.webp';
import nightClock from '../../assets/runtime/night-clock.webp';
import blankLetter from '../../assets/runtime/blank-letter.webp';
import radar from '../../assets/runtime/equipment-radar.webp';
import scanner from '../../assets/runtime/equipment-scanner.webp';
import recycler from '../../assets/runtime/equipment-recycler.webp';
import cargo from '../../assets/runtime/equipment-cargo.webp';
import { discoveryById } from '../content/catalog';
import type { ArtId } from '../content/types';
export const textures: Record<ArtId,string> = {receipt,tape,nested,mouse,signal,hermit,tagbird,'cosmic-parcel':cosmicParcel,stamp,bell,'night-clock':nightClock,'blank-letter':blankLetter};
export const equipment = {radar,scanner,recycler,cargo};
export function itemArt(id:string,className='') {
  const d=discoveryById(id);
  return d?`<img class="pixel-art ${className}" src="${textures[d.icon]}" alt="" decoding="async">`:'';
}
