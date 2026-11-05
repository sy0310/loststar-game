import {controlIcon} from './control-icons';

/** Same UI contract and dimensions; artwork now uses the authored 48-unit controls. */
export const icon=controlIcon;

export const renewalChapter=(mark:string,title:string,line:string)=>`<div class="fu-chapter"><span aria-hidden="true">${icon(mark)}</span><div><small>失物号 · 退件平原</small><strong>${title}</strong><p>${line}</p></div></div>`;

const curioArt=import.meta.glob('../../assets/runtime/visual-renewal/curios/*-{found,clean,stabilized}.webp',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const residentArt=import.meta.glob('../../assets/runtime/visual-renewal/museum/*-0.webp',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
/** Full renewed specimen bytes, never an old thumbnail while material decoding catches up. */
export function renewalArtUrl(id:string,condition='found'){
 const curio=curioArt[`../../assets/runtime/visual-renewal/curios/${id}-${condition}.webp`];if(curio)return curio;
 const resident=residentArt[`../../assets/runtime/visual-renewal/museum/${id}-0.webp`];if(resident)return resident;
 const glyph=id==='night-shift'?'gear':id==='last-recipient'?'receipt':'radar';
 const svg=icon(glyph).replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" ').replace('currentColor','#efc57f');
 return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}
