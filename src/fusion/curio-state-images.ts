import type {CurioCondition, CurioState} from './curio-material';
import {renewalCurioIds, type RenewalCurioId} from './curio-renewal-model';
import type {FusionSave} from './contracts';

export const curioImageStages = ['found', 'clean', 'stabilized'] as const;
const urls = import.meta.glob('../../assets/runtime/visual-renewal/whole-states-v043/*.webp', {eager: true, query: '?url', import: 'default'}) as Record<string, string>;
const images = new Map<string, HTMLImageElement>();
let preparation: Promise<void> | undefined;

/** A running timer, preview or research level cannot grant a different picture. */
export function curioStateImageKey(id: RenewalCurioId, state: Pick<CurioState, 'condition'>) {
  return `${id}-${state.condition}`;
}

export function curioStateImageUrl(id: RenewalCurioId, condition: CurioCondition) {
  return urls[`../../assets/runtime/visual-renewal/whole-states-v043/${id}-${condition}.webp`];
}

/** Cards, discovery and return manifests read the same durable condition. */
export function savedCurioCondition(save: Pick<FusionSave,'receipt'|'curios'>, id: RenewalCurioId): CurioCondition {
  return id==='receipt'?save.receipt.condition:save.curios[id]?.condition??'found';
}

/** Trace only an actual rendered material, separately from read-only previews. */
export function recordCurioStateUse(context: CanvasRenderingContext2D, material: CanvasImageSource) {
  const actual=wholeCurioMaterial(material),canvas=context.canvas;
  if(!actual||!canvas?.dataset)return;
  const states=JSON.parse(canvas.dataset.curioStates??'{}') as Record<string,string>;
  const key=curioStateImageKey(actual.id,actual);
  if(states[actual.id]!==key){states[actual.id]=key;canvas.dataset.curioStates=JSON.stringify(states);}
}

/** Decode authored complete images. A failed instance is discarded for explicit retry. */
export function prepareCurioStateImages(): Promise<void> {
  if (!preparation) preparation = Promise.all(renewalCurioIds.flatMap(id => curioImageStages.map(async condition => {
    const key = curioStateImageKey(id, {condition}), url = curioStateImageUrl(id, condition);
    if (!url) throw new Error(`Missing complete curio state: ${key}`);
    let image = images.get(key);
    if (!image) { image = new Image(); image.src = url; images.set(key, image); }
    try { await image.decode(); }
    catch (error) { if (images.get(key) === image) images.delete(key); throw error; }
  }))).then(() => undefined).catch(error => {preparation = undefined; throw error;});
  return preparation;
}

export function curioStateImage(id: RenewalCurioId, state: Pick<CurioState, 'condition'>) {
  return images.get(curioStateImageKey(id, state));
}

const materials = new WeakMap<CanvasImageSource, {id: RenewalCurioId; condition: CurioCondition}>();
export function registerWholeCurioMaterial(image: CanvasImageSource, id: RenewalCurioId, condition: CurioCondition) {
  materials.set(image, {id, condition});
}
export function wholeCurioMaterial(image: CanvasImageSource) { return materials.get(image); }

/** One uncropped full image. No mask, slice, pixel write, joint or dirt overlay. */
export function drawWholeCurioState(context: CanvasRenderingContext2D, id: RenewalCurioId, state: Pick<CurioState, 'condition'>, size = 192) {
  const image = curioStateImage(id, state);
  if (!image?.naturalWidth) return false;
  context.drawImage(image, 0, 0, size, size);
  return true;
}
