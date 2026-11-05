import beaconArtUrl from '../../assets/runtime/sorter.webp';
import postArtUrl from '../../assets/runtime/refinement/sorting-machine-back.webp';
import {firstPlanetFacilities} from '../fusion/facilities';
import type {SceneEntity, SceneFrame} from './scene';

const registration = firstPlanetFacilities.securityMast;
const load = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();image.onload = () => resolve(image);image.onerror = reject;image.src = url;
});

/** A narrow, open braced mast assembled from existing original material art.
 * Only the old sorter's isolated beacon cap is reused: its arch, belt and boxes
 * are never drawn. Textured post/foot crops come from the original new machine.
 */
export function createSecurityMast() {
  let art: HTMLImageElement[] = [];
  const ready = Promise.all([beaconArtUrl, postArtUrl].map(load)).then(images => {art = images;});
  const source = (): {x: number; y: number} => ({...registration.emitter});
  const diagnostics = () => ({...registration, anchor: {...registration.anchor}, emitter: source(),
    materials: ['sorter.webp:beacon-cap-only', 'refinement/sorting-machine-back.webp:post-and-foot-only']});
  function draw(context: CanvasRenderingContext2D, frame: SceneFrame, power: number) {
    const {x, y} = registration.anchor;
    const emitter = source();
    context.save();context.imageSmoothingEnabled = false;
    context.fillStyle = '#33283c92';context.beginPath();
    context.ellipse(x + 1, y + 1, 17, 4, -.1, 0, Math.PI * 2);context.fill();
    // The open diagonal brace makes this silhouette distinct from either sorter.
    context.strokeStyle = '#3a2b45';context.lineWidth = 5;context.beginPath();
    context.moveTo(x - 11, y - 3);context.lineTo(x, y - 43);context.lineTo(x + 10, y - 3);context.stroke();
    context.strokeStyle = '#99705d';context.lineWidth = 2;context.stroke();
    context.strokeStyle = '#d5aa75';context.lineWidth = .8;context.stroke();
    // A jointed copper feed cable follows the post rather than hanging in space.
    context.strokeStyle = '#49324d';context.lineWidth = 4;context.beginPath();
    context.moveTo(x + 5, y - 8);context.lineTo(x + 5, emitter.y + 22);
    context.lineTo(emitter.x + 4, emitter.y + 13);context.stroke();
    context.strokeStyle = '#bb885c';context.lineWidth = 1.8;context.stroke();
    // Repeated native shaft material keeps the crisp purple metal grain. Seams
    // are hidden beneath the mounting collars, without stretching a whole prop.
    for (let index = 0; index < 4; index++) {
      context.drawImage(art[1], 187, 215, 11, 23, x - 4, y - 24 - index * 14, 7, 14.6);
    }
    context.drawImage(art[1], 181, 233, 28, 22, x - 12, y - 18, 24, 18.8);
    for (const top of [y - 59, y - 39, y - 20]) {
      context.fillStyle = '#3f3049';context.fillRect(x - 5, top, 11, 4);
      context.fillStyle = '#ad805f';context.fillRect(x - 5, top, 10, 1);
      context.fillStyle = '#e0b37e';context.fillRect(x - 4, top + 1, 2, 1);
      context.fillStyle = '#6f5260';context.fillRect(x + 3, top + 2, 2, 2);
    }
    // The lamp is registered by its actual cyan lens pixel, not by crop centre.
    context.strokeStyle = '#392d45';context.lineWidth = 7;context.beginPath();
    context.moveTo(x - 1, y - 72);context.lineTo(emitter.x + 2, emitter.y + 12);context.stroke();
    context.strokeStyle = '#b48c68';context.lineWidth = 3;context.stroke();
    context.drawImage(art[0], 128, 0, 48, 45, emitter.x - 11.5, emitter.y - 10, 24, 22.5);
    const night = frame.environment.light;
    const strength = night * (.55 + Math.max(0, Math.min(1, power)) * .3);
    if (strength > 0) {
      context.globalCompositeOperation = 'screen';
      const glow = context.createRadialGradient(emitter.x, emitter.y, 1, emitter.x, emitter.y, 22);
      glow.addColorStop(0, '#bcefd075');glow.addColorStop(1, '#bcefd000');
      context.globalAlpha = strength;context.fillStyle = glow;
      context.fillRect(emitter.x - 22, emitter.y - 22, 44, 44);
      context.fillStyle = '#d2f9dc';context.fillRect(emitter.x - 2, emitter.y - 2, 4, 4);
    }
    context.restore();
  }
  return {
    ready, source, diagnostics,
    entities(context: CanvasRenderingContext2D, frame: SceneFrame, power = 1): SceneEntity[] {
      if (!art.length) return [];
      Object.assign(frame.output.dataset, {
        securityEntityId: registration.id, securityRenderer: registration.renderer,
        securityAnchor: JSON.stringify(registration.anchor), securityEmitter: JSON.stringify(source()),
      });
      return [{depth: registration.anchor.y, hitTarget: {kind: 'planet', id: 'parcel'}, draw: () => draw(context, frame, power)}];
    },
  };
}
