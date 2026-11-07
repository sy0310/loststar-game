import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createSurfaceFogRenderer, surfaceFogGroundBounds, surfaceFogLayout, type SurfaceFogSite} from '../src/render/surface-fog';
import {robotPose, shipPose} from '../src/render/motion';
import type {SceneFrame} from '../src/render/scene';

const site: SurfaceFogSite = {id: 'sorting', anchor: {x: 410, y: 315}, width: 270, variant: 0};
const motion = {elapsedMs: 0, reveal: 0, reducedMotion: true};
let canvases: HTMLCanvasElement[];
let painters: Map<HTMLCanvasElement, ReturnType<typeof painter>>;
function painter() {
  return {drawImage: vi.fn(), save: vi.fn(), restore: vi.fn(), translate: vi.fn(), scale: vi.fn(), rotate: vi.fn(),
    clearRect: vi.fn(), fillRect: vi.fn(),
    getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => ({data: new Uint8ClampedArray(width * height * 4).fill(255)})),
    putImageData: vi.fn(), imageSmoothingEnabled: true, globalAlpha: 1, globalCompositeOperation: 'source-over'};
}
beforeEach(() => {
  canvases = [];painters = new Map();
  vi.stubGlobal('Image', class {
    naturalWidth = 256;naturalHeight = 192;onload?: () => void;
    set src(_url: string) {queueMicrotask(() => this.onload?.());}
  });
  vi.stubGlobal('document', {createElement: () => {
    const context = painter();
    const canvas = {width: 0, height: 0, dataset: {}, getContext: () => context} as unknown as HTMLCanvasElement;
    canvases.push(canvas);painters.set(canvas, context);return canvas;
  }});
});
afterEach(() => {vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('surface fog presentation and mutable hit masks', () => {
  it('preserves the approved V036 sample registration by default', () => {
    expect(surfaceFogLayout(site, motion)).toEqual([
      {x: 408, y: 283, width: 270, rotation: 0, mirror: 1, opening: 0},
      {x: 413, y: 315, width: 270, rotation: 0, mirror: 1, opening: 0},
      {x: 407, y: 325, width: 270, rotation: 0, mirror: 1, opening: 0},
    ]);
    expect(surfaceFogGroundBounds(site)).toEqual({x: 250, y: 225, width: 320, height: 176});
  });

  it('keeps a broader ground footprint registered to enlarged, separately displaced layers', () => {
    const enlarged = {...site, width: 274};
    const region = surfaceFogLayout(enlarged, {...motion, reveal: .5}, 'regional');
    const ground = surfaceFogGroundBounds(enlarged, 'regional');
    expect(ground.width).toBeGreaterThan(274);
    expect(ground.x + ground.width / 2).toBe(enlarged.anchor.x);
    expect(region[0].x).toBeLessThan(region[1].x);
    expect(region[2].x).toBeGreaterThan(region[1].x);
    expect(region.every(layer => layer.width === enlarged.width)).toBe(true);
    expect(region[0].opening).toBeGreaterThan(region[2].opening);
    expect(region[0].y).toBeLessThan(enlarged.anchor.y);
    expect(region[2].y).toBeLessThan(enlarged.anchor.y + 10);
  });

  it('reuses the three art canvases while invalidating their hit alpha only when holes change', async () => {
    const renderer = createSurfaceFogRenderer();await renderer.ready;
    const context = painter() as unknown as CanvasRenderingContext2D;
    renderer.cloud(context, site, motion);
    const layers = canvases.filter(canvas => canvas.height === 192);
    expect(layers).toHaveLength(3);
    expect(layers.map(layer => layer.dataset.hitRevision)).toEqual(['0', '0', '0']);
    const allocations = canvases.length;
    renderer.cloud(context, site, {...motion, elapsedMs: 16});
    expect(layers.every(layer => painters.get(layer)!.clearRect.mock.calls.length === 1)).toBe(true);
    renderer.cloud(context, site, {...motion, reveal: .5});
    expect(canvases.length).toBe(allocations);
    expect(layers[0].dataset.hitRevision).not.toBe('0');
    expect(layers.every(layer => painters.get(layer)!.clearRect.mock.calls.length === 2)).toBe(true);
    renderer.cloud(context, site, {...motion, reveal: 1});
    expect(layers.every(layer => painters.get(layer)!.clearRect.mock.calls.length === 2)).toBe(true);
  });

  it('softens the actual globe silhouette inward and projects it into the same enlarged hit canvases', async () => {
    const renderer = createSurfaceFogRenderer({appearance: 'regional'});await renderer.ready;
    const context = painter() as unknown as CanvasRenderingContext2D;
    const frame: SceneFrame = {t: 0, robot: robotPose(0), ship: shipPose(0), globe: {} as HTMLImageElement,
      output: {} as HTMLCanvasElement, environment: {period: 'day', seconds: 0, light: 0, rest: 0}};
    renderer.groundResponse(context, frame, site, 0);
    renderer.cloud(context, site, motion);
    const terrain = canvases.find(canvas => canvas.height === 256)!;
    const pixels = painters.get(terrain)!.putImageData.mock.calls[0][0].data as Uint8ClampedArray;
    const alpha = (x: number, y: number) => pixels[(y * 256 + x) * 4 + 3];
    expect(alpha(0, 128)).toBe(0);
    expect(alpha(2, 128)).toBe(0);
    expect(alpha(4, 128)).toBeGreaterThan(0);
    expect(alpha(4, 128)).toBeLessThan(255);
    expect(alpha(16, 128)).toBe(255);
    const layers = canvases.filter(canvas => canvas.height === 192);
    expect(layers.every(layer => painters.get(layer)!.drawImage.mock.calls.some(call => call[0] === terrain))).toBe(true);
    expect(renderer.metrics().terrainMaskTextureBytes).toBe(256 * 256 * 4);
  });
});
