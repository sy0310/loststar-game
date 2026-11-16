import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createFusion} from '../src/fusion/domain';
import {createFusionSurfaceFog, defaultFusionFogScale, fusionFogScales, readFusionFogScale} from '../src/fusion/surface-fog';
import {robotPose, shipPose} from '../src/render/motion';
import type {SceneFrame} from '../src/render/scene';

let now = 0;
let images = 0;
const context = {} as CanvasRenderingContext2D;
const frame = (): SceneFrame => ({t: now / 1000, robot: robotPose(.2), ship: shipPose(now / 1000),
  globe: {} as HTMLImageElement, output: {} as HTMLCanvasElement,
  environment: {period: 'day', seconds: now / 1000, light: 0, rest: 0}});

beforeEach(() => {
  now = 0;images = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('matchMedia', () => ({matches: false}));
  vi.stubGlobal('Image', class {
    naturalWidth = 256;
    naturalHeight = 192;
    onload?: () => void;
    constructor() {images++;}
    set src(_url: string) {queueMicrotask(() => this.onload?.());}
  });
});
afterEach(() => {vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('durable surface fog rendering', () => {
  it('limits the comparison to two presentation scales without accepting arbitrary persisted geometry', () => {
    expect(readFusionFogScale('?fog-scale=regional')).toBe('regional');
    expect(readFusionFogScale('?fog-scale=legacy')).toBe('legacy');
    for (const query of ['', '?fog-scale=900', '?fog-scale=other', '?receipt=999']) {
      expect(readFusionFogScale(query)).toBe(defaultFusionFogScale);
    }
    expect(fusionFogScales.regional).toEqual({receipt: 156, residents: 196, sorting: 274});
  });

  it('keeps legacy campaigns clear without requesting fog textures', async () => {
    const state = createFusion(5000);
    const fog = createFusionSurfaceFog(() => state);
    await fog.ready;
    expect(images).toBe(0);
    expect(fog.entities(context, frame())).toEqual([]);
    expect(fog.metrics()).toMatchObject({active: false, sites: [], fogDecodedTextureBytes: 0});
  });

  it('registers three real sites and keeps their clouds behind the robot', async () => {
    const state = createFusion(5000, null, {journey: true, seed: 317});
    const before = JSON.stringify(state);
    const fog = createFusionSurfaceFog(() => state, {scale: 'legacy'});
    expect(fog.entities(context, frame())).toEqual([]);
    expect(fog.metrics()).toMatchObject({active: true, fogDecodedTextureBytes: 0});
    expect(images).toBe(0);
    await fog.ready;
    const entities = fog.entities(context, frame());
    expect(images).toBe(3);
    expect(entities.filter(entity => entity.hitTarget).every(entity => entity.depth < frame().robot.y)).toBe(true);
    expect(entities.filter(entity => entity.hitTarget).map(entity => entity.hitTarget)).toEqual([
      {kind: 'site', id: 'surface-fog'}, {kind: 'site', id: 'surface-fog'}, {kind: 'site', id: 'surface-fog'},
    ]);
    expect(fog.metrics().sites.map(site => [site.id, site.anchor, site.width])).toEqual([
      ['receipt', {x: 465, y: 357}, 94], ['residents', {x: 565, y: 447}, 122], ['sorting', {x: 410, y: 315}, 220],
    ]);
    expect(fog.metrics().sites.every(site => !Object.hasOwn(site, 'name'))).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('dissolves a background-earned reveal without granting work or changing the archive', async () => {
    const state = createFusion(5000, null, {journey: true, seed: 317});
    const fog = createFusionSurfaceFog(() => state);
    await fog.ready;
    fog.entities(context, frame());
    const site = state.journey!.sites[0];
    site.progress = 1;site.revealedAt = state.game.lastAt;
    const before = JSON.stringify(state);
    now = 100000;
    fog.entities(context, frame());
    expect(fog.metrics().sites[0].visualReveal).toBeGreaterThan(0);
    expect(fog.metrics().sites[0].visualReveal).toBeLessThan(.5);
    for (let index = 0; index < 75; index++) {now += 16;fog.entities(context, frame());}
    expect(fog.metrics().sites[0].visualReveal).toBe(1);
    expect(fog.metrics().rewardsFromPaint).toBe(0);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('compares the same durable anchors, seed, work and archive at regional scale', async () => {
    const state = createFusion(5000, null, {journey: true, seed: 317});
    state.journey!.sites[1].progress = .8;
    const before = JSON.stringify(state);
    const legacy = createFusionSurfaceFog(() => state, {scale: 'legacy'});
    const regional = createFusionSurfaceFog(() => state, {scale: 'regional'});
    await Promise.all([legacy.ready, regional.ready]);
    legacy.entities(context, frame());regional.entities(context, frame());
    expect(regional.metrics().scale).toBe('regional');
    expect(regional.metrics().sites.map(site => site.width)).toEqual([156, 196, 274]);
    expect(regional.metrics().sites.map(({width: _width, ...site}) => site))
      .toEqual(legacy.metrics().sites.map(({width: _width, ...site}) => site));
    expect(JSON.stringify(state)).toBe(before);
  });

  it('keeps an unknown sorting shell behind its cloud even if the robot walks further back', async () => {
    const state = createFusion(5000, null, {journey: true, seed: 317});
    const fog = createFusionSurfaceFog(() => state, {scale: 'regional'});
    await fog.ready;
    const behind = frame();behind.robot = {...behind.robot, x: 340, y: 300};
    const clouds = fog.entities(context, behind).filter(entity => entity.hitTarget);
    expect(clouds[2].depth).toBeGreaterThan(315.2);
    expect(clouds[2].depth).toBeLessThan(340);
    expect(fog.metrics().sites[2].name).toBeUndefined();
  });

  it('keeps established discoveries clear on reload and follows the world night light', async () => {
    const state = createFusion(5000, null, {journey: true, seed: 317});
    state.journey!.sites[0].progress = 1;state.journey!.sites[0].revealedAt = 1000;
    const fog = createFusionSurfaceFog(() => state);
    await fog.ready;
    const night = frame();night.environment = {period: 'night', seconds: 250, light: 1, rest: 1};
    fog.entities(context, night);
    expect(fog.metrics().sites[0].visualReveal).toBe(1);
    expect(fog.metrics().night).toBe(1);
  });
});
