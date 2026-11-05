import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createFusion} from '../src/fusion/domain';
import {firstPlanetFacilities, sortingMachinePoint} from '../src/fusion/facilities';
import {createSortingScene} from '../src/fusion/sorting-scene';
import {createSecurityMast} from '../src/render/security-mast';
import {robotPose, shipPose} from '../src/render/motion';
import type {SceneFrame} from '../src/render/scene';
import {drawV034BeaconGuidance} from '../src/review/v034-night-scene';
import {createV034NightModel} from '../src/review/v034-night-model';

const epoch = 1800000000000;
type Paint = {image: {src?: string}; coordinates: number[]};
function paintRecorder() {
  const images: Paint[] = [];
  const points: number[][] = [];
  const rectangles: number[][] = [];
  const gradients: number[][] = [];
  const noop = () => {};
  const context = {
    save: noop, restore: noop, beginPath: noop, closePath: noop, fill: noop, stroke: noop,
    ellipse: noop, translate: noop, scale: noop, transform: noop, rotate: noop, clearRect: noop,
    fillText: noop, strokeRect: noop,
    moveTo(...point: number[]) {points.push(point);},
    lineTo(...point: number[]) {points.push(point);},
    fillRect(...rect: number[]) {rectangles.push(rect);},
    drawImage(image: Paint['image'], ...coordinates: number[]) {images.push({image, coordinates});},
    createLinearGradient(...coordinates: number[]) {gradients.push(coordinates);return {addColorStop: noop};},
    createRadialGradient(...coordinates: number[]) {gradients.push(coordinates);return {addColorStop: noop};},
  } as unknown as CanvasRenderingContext2D;
  return {context, images, points, rectangles, gradients};
}
function frame(): SceneFrame {
  return {t: 1, robot: robotPose(.1), ship: shipPose(1), globe: {} as HTMLImageElement,
    output: {dataset: {}} as HTMLCanvasElement,
    environment: {period: 'day', seconds: 1, light: 0, rest: 0}};
}

beforeEach(() => {
  vi.spyOn(Date, 'now').mockReturnValue(epoch);
  vi.stubGlobal('Image', class {
    onload?: () => void;
    private url = '';
    set src(value: string) {this.url = value;queueMicrotask(() => this.onload?.());}
    get src() {return this.url;}
  });
  vi.stubGlobal('document', {createElement: () => ({width: 0, height: 0, getContext: () => paintRecorder().context})});
});
afterEach(() => {vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('single first-planet sorting facility', () => {
  it('retains the same layered machine, hit target and archive in every task state', async () => {
    const state = createFusion(epoch, null, {journey: true, seed: 317});
    const scene = createSortingScene(() => state);
    await scene.ready;
    for (const phase of ['unknown', 'observed', 'surveying', 'surveyed', 'building', 'ready', 'working', 'cleared'] as const) {
      state.progression.sorting.phase = phase;
      const before = JSON.stringify(state);
      const paint = paintRecorder(), current = frame();
      const entities = scene.entities(paint.context, current);
      expect(entities.map(entity => entity.hitTarget)).toEqual(Array(3).fill({kind: 'site', id: 'sorting'}));
      entities.forEach(entity => entity.draw());
      scene.afterWorld(paint.context, current);
      expect(paint.images.filter(paint => paint.image.src?.includes('sorting-machine-back.webp'))).toHaveLength(1);
      expect(paint.images.filter(paint => paint.image.src?.includes('sorting-machine-front.webp'))).toHaveLength(1);
      expect(paint.images.some(paint => paint.image.src?.endsWith('/sorter.webp'))).toBe(false);
      expect(scene.diagnostics()).toMatchObject({id: 'parcel/old-sorting', phase, anchor: {x: 410, y: 315}});
      expect(current.output.dataset).toMatchObject({sortingEntityId: 'parcel/old-sorting', sortingPhase: phase});
      expect(JSON.stringify(state)).toBe(before);
    }
    expect(sortingMachinePoint(116, 279)).toEqual({x: 410, y: 315});
    expect(scene.diagnostics().labels).toEqual({P03: {x: 396.5875, y: 262.7375}, P30: {x: 454.8625, y: 240.5375}});
  });

  it('preserves the legacy unknown-node visibility rule outside the journey', async () => {
    const state = createFusion(epoch);
    const scene = createSortingScene(() => state);
    await scene.ready;
    expect(scene.entities(paintRecorder().context, frame())).toEqual([]);
  });

  it('draws only a cropped beacon cap at the old contact, with its actual registered light source', async () => {
    const mast = createSecurityMast(), current = frame(), paint = paintRecorder();
    current.environment = {period: 'night', seconds: 250, light: 1, rest: 1};
    await mast.ready;
    const entities = mast.entities(paint.context, current);
    expect(entities).toHaveLength(1);
    entities[0].draw();
    const cap = paint.images.filter(paint => paint.image.src?.endsWith('/sorter.webp'));
    expect(cap).toHaveLength(1);
    expect(cap[0].coordinates.slice(0, 4)).toEqual([128, 0, 48, 45]);
    expect(paint.gradients).toContainEqual([559, 208, 1, 559, 208, 22]);
    expect(current.output.dataset).toMatchObject({securityEntityId: 'parcel/security-mast', securityEmitter: '{"x":559,"y":208}'});
    expect(mast.diagnostics().anchor).toEqual({x: 568, y: 294});
    const copiedSource = mast.source();copiedSource.x = 0;
    expect(mast.source()).toEqual(firstPlanetFacilities.securityMast.emitter);
  });

  it('moves the complete guidance cone and lens highlight with the supplied beacon source', () => {
    const base = createV034NightModel('basic').snapshot(20);
    const view = {...base, facilities: {...base.facilities, beacon: {...base.facilities.beacon, guiding: true}}};
    const shifted = paintRecorder();
    drawV034BeaconGuidance(shifted.context, view, {x: 93, y: 127});
    expect(shifted.gradients[0].slice(0, 2)).toEqual([93, 127]);
    expect(shifted.points[0]).toEqual([90, 127]);
    expect(shifted.points.at(-1)).toEqual([96, 127]);
    expect(shifted.rectangles).toEqual([[89, 126, 9, 3]]);
    const original = paintRecorder();
    drawV034BeaconGuidance(original.context, view);
    expect(original.gradients[0].slice(0, 2)).toEqual([559, 208]);
    expect(original.points[0]).toEqual([556, 208]);
    const inactive = paintRecorder();
    drawV034BeaconGuidance(inactive.context, base);
    if (!base.facilities.beacon.guiding) expect(inactive.gradients).toEqual([]);
  });
});
