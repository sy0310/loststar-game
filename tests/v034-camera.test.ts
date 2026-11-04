import {describe, expect, it} from 'vitest';
import {shipPose} from '../src/render/motion';
import {nightCamera} from '../src/review/d1-motion';
import {v034NightCamera} from '../src/review/v034-night-stage';
import {v034ShipPose} from '../src/review/v034-camera';

const project = (point: {x: number; y: number}, camera: typeof nightCamera) => ({
  x: 32 + camera.x + (point.x - camera.x) * camera.scale + camera.offsetX,
  y: camera.y + (point.y - camera.y) * camera.scale + camera.offsetY,
});

describe('V034完整球体放大后的飞船注册', () => {
  it('完整绕轨中保留原已验机身、喷口、尾迹屏幕位置与朝向', () => {
    for (let seconds = 0; seconds < 28; seconds += .05) {
      const base = shipPose(seconds);
      const adjusted = v034ShipPose(base);
      const pairs = [[base, adjusted], [base.nozzle, adjusted.nozzle],
        ...base.trail.map((dot, index) => [dot, adjusted.trail[index]]),
        ...base.layers.map((layer, index) => [layer, adjusted.layers[index]])];
      for (const [original, current] of pairs) {
        const before = project(original, nightCamera);
        const after = project(current, v034NightCamera);
        expect(after.x).toBeCloseTo(before.x, 8);
        expect(after.y).toBeCloseTo(before.y, 8);
      }
      expect(adjusted.width * v034NightCamera.scale).toBeCloseTo(base.width * nightCamera.scale);
      expect(adjusted.heading).toBe(base.heading);
      expect(adjusted.exhaustHeading).toBe(base.exhaustHeading);
      expect(adjusted.back).toBe(base.back);
      for (const layer of adjusted.layers) {
        const x = (layer.anchor.x - 128) * adjusted.width / 256;
        const y = (layer.anchor.y - 128) * adjusted.width / 256;
        expect(layer.x + x * Math.cos(layer.rotation) - y * Math.sin(layer.rotation)).toBeCloseTo(adjusted.nozzle.x);
        expect(layer.y + x * Math.sin(layer.rotation) + y * Math.cos(layer.rotation)).toBeCloseTo(adjusted.nozzle.y);
      }
    }
  });
});
