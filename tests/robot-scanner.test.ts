import {describe, expect, it} from 'vitest';
import {robotPose, robotScannerPoint, robotScannerSource} from '../src/render/motion';
import {nightStage} from '../src/review/d1-motion';
import {nightRobotSourcePoint} from '../src/review/night-robot';

describe('renewed robot scanner registration', () => {
  it('registers native lens point 23,83 at the actual 144px scan pose', () => {
    expect(robotScannerSource).toEqual({x: 23, y: 83});
    const point = robotScannerPoint(robotPose(.34));
    expect(point.x).toBeCloseTo(416.94, 8);
    expect(point.y).toBeCloseTo(291.02, 8);
    const relocated = robotScannerPoint({...robotPose(.34), x: 440, y: 337});
    expect(relocated.x).toBeCloseTo(382.94, 8);
    expect(relocated.y).toBeCloseTo(272.02, 8);
  });

  it('mirrors and bobs the received work light with the body during movement', () => {
    const pose = {...robotPose(.34), action: 'walk' as const, facing: 'right' as const, x: 400.3, y: 390.3};
    const point = robotScannerPoint(pose, .1);
    expect(point.x).toBeCloseTo(457.06, 8);
    expect(point.y).toBeCloseTo(326.02, 8);
    expect(robotScannerPoint({...pose, action: 'return'}, .1).x).toBeCloseTo(342.94, 8);
  });

  it('keeps the night P03 emitter on the same material point through tilt and bob', () => {
    const stage = nightStage(12);
    stage.robot = {...stage.robot, x: 474, y: 356};
    stage.rig = {...stage.rig, tilt: .2, bob: 1.75};
    const point = nightRobotSourcePoint(robotScannerSource, false, stage);
    const local = {x: -57.06, y: -64.98};
    expect(point.x).toBeCloseTo(474 + local.x * Math.cos(.2) - local.y * Math.sin(.2), 8);
    expect(point.y).toBeCloseTo(356 + local.x * Math.sin(.2) + local.y * Math.cos(.2) + 1.75, 8);
    expect(Math.hypot(point.x - (474 - 57.06), point.y - (356 - 64.98))).toBeGreaterThan(10);
  });
});
