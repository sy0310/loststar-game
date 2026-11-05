import type {SceneEntity, SceneFrame} from '../render/scene';
import type {createSurfaceFogRenderer, SurfaceFogSite} from '../render/surface-fog';
import type {FusionSave} from './contracts';
import {surfaceView, type SurfaceSiteId, type SurfaceSiteView} from './surface';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
export type FusionFogScale = 'legacy' | 'regional';
/** Review-only presentation choices. They do not touch durable anchors or work. */
export const fusionFogScales = {
  legacy: {receipt: 94, residents: 122, sorting: 220},
  regional: {receipt: 156, residents: 196, sorting: 274},
} as const;
export const defaultFusionFogScale: FusionFogScale = 'regional';
export function readFusionFogScale(search = globalThis.location?.search ?? ''): FusionFogScale {
  const value = new URLSearchParams(search).get('fog-scale');
  return value === 'legacy' || value === 'regional' ? value : defaultFusionFogScale;
}
// The last sorting part is at 315.2. Fog must stay in front even when the
// robot is further back; pinning every cloud behind the robot leaked this part.
const landmarkDepth: Record<SurfaceSiteId, number> = {receipt: 294.6, residents: 294.6, sorting: 315.3};
interface RevealMotion {value: number; updatedAt: number}

/** Drawing follows the durable journey. It never advances work or grants discoveries. */
export function createFusionSurfaceFog(getFusion?: () => FusionSave, options: {scale?: FusionFogScale} = {}) {
  const scale = options.scale ?? readFusionFogScale();
  const widths = fusionFogScales[scale];
  let renderer: ReturnType<typeof createSurfaceFogRenderer> | undefined;
  const ready = getFusion?.().journey ? import('../render/surface-fog').then(async module => {
    const loaded = module.createSurfaceFogRenderer({appearance: scale === 'regional' ? 'regional' : 'sample'});
    await loaded.ready;
    renderer = loaded;
  }) : Promise.resolve();
  const motions = new Map<SurfaceSiteId, RevealMotion>();
  let sites: SurfaceSiteView[] = [];
  let frameAt = 0;
  let night = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const geometry = (site: SurfaceSiteView): SurfaceFogSite => ({...site, width: widths[site.id]});
  function update(site: SurfaceSiteView, now: number) {
    const target = site.revealed ? 1 : clamp((site.progress - .65) / .35);
    let motion = motions.get(site.id);
    if (!motion) {
      // A reveal earned during background settlement gets a brief dissolve on
      // return. An older discovered location is immediately kept clear.
      const fresh = site.revealedAt !== null && getFusion && getFusion().game.lastAt - site.revealedAt < 1000;
      const value = fresh ? 0 : target;
      motion = {value, updatedAt: now};motions.set(site.id, motion);
    }
    const delta = Math.min(80, Math.max(0, now - motion.updatedAt));
    motion.updatedAt = now;
    motion.value += (target - motion.value) * (1 - Math.exp(-delta / 150));
    if (target === 1 && 1 - motion.value < .002) motion.value = 1;
    return motion.value;
  }
  return {
    ready,
    active: () => !!getFusion?.().journey,
    entities(context: CanvasRenderingContext2D, frame: SceneFrame): SceneEntity[] {
      const activeRenderer = renderer;
      if (!activeRenderer) return [];
      sites = getFusion ? surfaceView(getFusion()) : [];
      frameAt = performance.now();night = frame.environment.light;
      const entities: SceneEntity[] = [];
      for (const site of sites) {
        const shape = geometry(site), reveal = update(site, frameAt);
        if (reveal >= 1) continue;
        const depth = Math.max(landmarkDepth[site.id],
          Math.min(site.id === 'sorting' ? 340 : site.anchor.y + 2, frame.robot.y - .1));
        entities.push({depth: 292, draw: () => activeRenderer.groundResponse(context, frame, shape, reveal)});
        entities.push({depth, hitTarget: {kind: 'site', id: 'surface-fog'}, draw: () => activeRenderer.cloud(context, shape,
          {elapsedMs: frame.t * 1000, reveal, reducedMotion: reduced.matches})});
      }
      return entities;
    },
    metrics() {
      return {active: !!getFusion?.().journey, scale, sites: sites.map(site => ({...site, anchor: {...site.anchor},
        width: widths[site.id], landmarkDepth: landmarkDepth[site.id], visualReveal: motions.get(site.id)?.value ?? 0})), frameAt, night,
        ...(renderer?.metrics() ?? {fogDecodedTextureBytes: 0, groundRelightDecodedTextureBytes: 0, maskTextureBytes: 0}), rewardsFromPaint: 0};
    },
  };
}
