import {describe, expect, it} from 'vitest';
import {robotPose, robotScannerPoint, robotScannerSource} from '../src/render/motion';
import {nightStage} from '../src/review/d1-motion';
import {nightRobotSourcePoint} from '../src/review/night-robot';

describe('original robot scanner registration', () => {
  it('registers native atlas point 29,82 at the actual 144px scan pose', () => {
    expect(robotScannerSource).toEqual({x: 29, y: 82});
    const point = robotScannerPoint(robotPose(.34));
    expect(point.x).toBeCloseTo(422.34, 8);
    expect(point.y).toBeCloseTo(290.12, 8);
    const relocated = robotScannerPoint({...robotPose(.34), x: 440, y: 337});
    expect(relocated.x).toBeCloseTo(388.34, 8);
    expect(relocated.y).toBeCloseTo(271.12, 8);
  });

  it('mirrors and bobs the received work light with the body during movement', () => {
    const pose = {...robotPose(.34), action: 'walk' as const, facing: 'right' as const, x: 400.3, y: 390.3};
    const point = robotScannerPoint(pose, .1);
    expect(point.x).toBeCloseTo(451.66, 8);
    expect(point.y).toBeCloseTo(325.12, 8);
    expect(robotScannerPoint({...pose, action: 'return'}, .1).x).toBeCloseTo(348.34, 8);
  });

  it('keeps the night P03 emitter on the same material point through tilt and bob', () => {
    const stage = nightStage(12);
    stage.robot = {...stage.robot, x: 474, y: 356};
    stage.rig = {...stage.rig, tilt: .2, bob: 1.75};
    const point = nightRobotSourcePoint(robotScannerSource, false, stage);
    const local = {x: -51.66, y: -65.88};
    expect(point.x).toBeCloseTo(474 + local.x * Math.cos(.2) - local.y * Math.sin(.2), 8);
    expect(point.y).toBeCloseTo(356 + local.x * Math.sin(.2) + local.y * Math.cos(.2) + 1.75, 8);
    expect(Math.hypot(point.x - (474 - 48), point.y - (356 - 66))).toBeGreaterThan(10);
  });
});
