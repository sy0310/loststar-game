import {describe, expect, it, vi} from 'vitest';
import {pickSceneCommands, sceneAlphaHit, sceneClientPoint, sceneImagePoint, type SceneAlphaMask, type SceneImageCommand} from '../src/render/scene-picking';

const image = {} as HTMLImageElement;
const full: SceneAlphaMask = {width: 2, height: 2, alpha: new Uint8Array([255, 255, 255, 255])};
const globe: SceneAlphaMask = {width: 2, height: 2, alpha: new Uint8Array([0, 0, 0, 255])};
const command = (kind: SceneImageCommand['target']['kind']): SceneImageCommand => ({
  target: {kind}, image, source: {x: 0, y: 0, width: 2, height: 2},
  destination: {x: 0, y: 0, width: 2, height: 2}, transform: {a: 1, b: 0, c: 0, d: 1, e: 0, f: 0}, opacity: 1,
});

describe('actual scene picking', () => {
  it('maps CSS coordinates into native canvas pixels on mobile and rejects hidden canvases', () => {
    expect(sceneClientPoint(245, 305, {left: 50, top: 120, width: 390, height: 370}, 832, 740)).toEqual({x: 416, y: 370});
    expect(sceneClientPoint(10, 20, {left: 0, top: 0, width: 0, height: 0}, 832, 740)).toBeNull();
    expect(sceneClientPoint(NaN, 20, {left: 0, top: 0, width: 390, height: 370}, 832, 740)).toBeNull();
  });

  it('inverts the exact camera registration, atlas crop and sprite scaling', () => {
    const draw = command('planet');
    draw.source = {x: 8, y: 10, width: 16, height: 20};
    draw.destination = {x: 52, y: 70, width: 664, height: 664};
    draw.transform = {a: 1.085, b: 0, c: 0, d: 1.085, e: 32 + 384 * (1 - 1.085), f: 402 * (1 - 1.085) - 29};
    const world = {x: 52 + 664 / 2, y: 70 + 664 / 2};
    const point = {x: world.x * draw.transform.a + draw.transform.e, y: world.y * draw.transform.d + draw.transform.f};
    expect(sceneImagePoint(point, draw)).toEqual({x: 16, y: 20});
  });

  it('inverts rotated and mirrored hull frames and excludes transparent sprite pixels', () => {
    const draw = command('ship');
    draw.transform = {a: 0, b: 2, c: 2, d: 0, e: 100, f: 200};
    expect(sceneImagePoint({x: 103, y: 203}, draw)).toEqual({x: 1, y: 1});
    expect(sceneAlphaHit({x: 103, y: 203}, draw, globe)).toBe(true);
    expect(sceneAlphaHit({x: 101, y: 201}, draw, globe)).toBe(false);
  });

  it('allows only visible back ship pixels outside the opaque planet and prioritizes front ship', () => {
    const hullImage = {} as HTMLImageElement;
    const back = {...command('ship'), image: hullImage};
    const planet = command('planet');
    const mask = (source: HTMLImageElement | HTMLCanvasElement) => source === hullImage ? full : globe;
    expect(pickSceneCommands({x: .5, y: .5}, [back, planet], mask).kind).toBe('ship');
    expect(pickSceneCommands({x: 1.5, y: 1.5}, [back, planet], mask).kind).toBe('planet');
    expect(pickSceneCommands({x: 1.5, y: 1.5}, [planet, back], mask).kind).toBe('ship');
  });

  it('uses paint order so a foreground warehouse shields a robot while alpha holes stay selectable', () => {
    const warehouseImage = {} as HTMLImageElement;
    const robot = command('robot');
    const warehouse = {...command('planet'), image: warehouseImage};
    const mask = (source: HTMLImageElement | HTMLCanvasElement) => source === warehouseImage ? globe : full;
    expect(pickSceneCommands({x: 1.5, y: 1.5}, [robot, warehouse], mask).kind).toBe('planet');
    expect(pickSceneCommands({x: .5, y: .5}, [robot, warehouse], mask).kind).toBe('robot');
  });

  it('uses the registered procedural belt alpha and lets the robot cover a discovered work site', () => {
    const beltImage = {} as HTMLCanvasElement;
    const site = {...command('site'), target:{kind:'site' as const,id:'sorting'}, image:beltImage};
    const robot = command('robot');
    const mask = (source: HTMLImageElement | HTMLCanvasElement) => source === beltImage ? globe : full;
    expect(pickSceneCommands({x:1.5,y:1.5},[site],mask)).toMatchObject({kind:'site',id:'sorting'});
    expect(pickSceneCommands({x:.5,y:.5},[site],mask).kind).toBe('space');
    expect(pickSceneCommands({x:1.5,y:1.5},[site,robot],mask).kind).toBe('robot');
  });

  it('leaves blank space inert and avoids reading image masks for out-of-bounds targets', () => {
    const mask = vi.fn(() => full);
    expect(pickSceneCommands({x: 20, y: 20}, [command('resident')], mask).kind).toBe('space');
    expect(mask).not.toHaveBeenCalled();
    const hidden = {...command('resident'), opacity: .01};
    expect(pickSceneCommands({x: .5, y: .5}, [hidden], () => full).kind).toBe('space');
  });
});
