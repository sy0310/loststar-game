import {afterEach, expect, it, vi} from 'vitest';
import {guardLayer, type GuardLayerOptions} from '../src/render/guard-scene';
import {worldView} from '../src/game/world';
import {robotPose, shipPose} from '../src/render/motion';
import type {SceneFrame} from '../src/render/scene';
import {createV034NightModel} from '../src/review/v034-night-model';

afterEach(() => vi.unstubAllGlobals());

function recordGuardPaint(options?: GuardLayerOptions) {
  vi.stubGlobal('Image', class {
    complete = false;
    naturalWidth = 0;
    src = '';
  });
  const rectangles: number[][] = [];
  const paths: number[][] = [];
  const context = {
    save() {},
    restore() {},
    beginPath() {},
    closePath() {},
    fill() {},
    stroke() {},
    ellipse() {},
    setLineDash() {},
    lineTo() {},
    moveTo(...coordinates: number[]) {paths.push(coordinates);},
    fillRect(...rectangle: number[]) {rectangles.push(rectangle);},
  } as unknown as CanvasRenderingContext2D;
  const model = createV034NightModel('basic', {mode: 'cycle'});
  const state = model.getState(250);
  const layer = guardLayer(() => ({...worldView(state), light: 0, intruders: []}), options);
  const frame: SceneFrame = {
    t: 3,
    robot: robotPose(0),
    ship: shipPose(3),
    globe: {} as HTMLImageElement,
    environment: {period: 'night', light: 1, rest: 1, seconds: 250},
    output: {} as HTMLCanvasElement,
  };
  layer.afterWorld(context, frame);
  return {
    equipment: rectangles.some(rectangle => rectangle.join() === '415,487,46,11'),
    searchLine: paths.some(point => point[0] === frame.ship.x && point[1] === frame.ship.y + 15),
  };
}

it('preserves both original guard render paths when review options are omitted', () => {
  expect(recordGuardPaint()).toEqual({equipment: true, searchLine: true});
});

it('only suppresses the explicitly disabled review overlays', () => {
  expect(recordGuardPaint({showEquipment: false})).toEqual({equipment: false, searchLine: true});
  expect(recordGuardPaint({showSearchLine: false})).toEqual({equipment: true, searchLine: false});
  expect(recordGuardPaint({showEquipment: false, showSearchLine: false}))
    .toEqual({equipment: false, searchLine: false});
});
