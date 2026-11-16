import type {shipPose} from '../render/motion';
import {nightCamera} from './d1-motion';
import {v034NightCamera} from './v034-night-stage';

/** Keep the verified hull/nozzle/trail framing while the review globe grows. */
export function v034ShipPose(base: ReturnType<typeof shipPose>): ReturnType<typeof shipPose> {
  const ratio = nightCamera.scale / v034NightCamera.scale;
  const point = (value: {x: number; y: number}) => ({
    x: v034NightCamera.x + (value.x - nightCamera.x) * ratio +
      ((nightCamera.offsetX ?? 0) - v034NightCamera.offsetX) / v034NightCamera.scale,
    y: v034NightCamera.y + (value.y - nightCamera.y) * ratio +
      ((nightCamera.offsetY ?? 0) - v034NightCamera.offsetY) / v034NightCamera.scale,
  });
  return {
    ...base,
    ...point(base),
    width: base.width * ratio,
    scale: base.scale * ratio,
    speed: base.speed * ratio,
    flameLength: base.flameLength * ratio,
    nozzle: point(base.nozzle),
    layers: base.layers.map(layer => ({
      ...layer,
      ...point(layer),
      offset: {x: layer.offset.x * ratio, y: layer.offset.y * ratio},
    })),
    trail: base.trail.map(dot => ({...dot, ...point(dot)})),
  };
}
