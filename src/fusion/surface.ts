import type {SaveData} from '../game/engine';
import type {FusionSave} from './contracts';
import {explorationWorkPosition} from './progression';

export type SurfaceSiteId = 'receipt' | 'residents' | 'sorting';
export type SurfacePhase = 'unknown' | 'scanning' | 'revealing' | 'revealed';
export interface JourneySite {
  id: SurfaceSiteId;
  anchor: {x: number; y: number};
  variant: number;
  progress: number;
  revealedAt: number | null;
}
export interface FirstPlanetJourney {
  version: 1;
  seed: number;
  sites: JourneySite[];
}
export interface SurfaceSiteView extends JourneySite {
  phase: SurfacePhase;
  revealed: boolean;
  name?: string;
  source: string;
}

// These are the existing pickup, mouse home and sorter feet in the shared globe.
const sites = [
  {id: 'receipt', anchor: {x: 465, y: 357}, name: '退件土样', source: 'parcel/returns-plain/pickup'},
  {id: 'residents', anchor: {x: 565, y: 447}, name: '拆封鼠栖台', source: 'parcel/returns-plain/resident-observation'},
  {id: 'sorting', anchor: {x: 410, y: 315}, name: '旧分拣区', source: 'parcel/old-sorting'},
] as const;

export function createJourney(seed: number): FirstPlanetJourney {
  const stableSeed = Math.abs(Math.floor(seed)) >>> 0;
  return {version: 1, seed: stableSeed, sites: sites.map((site, index) => ({
    id: site.id, anchor: {...site.anchor}, variant: ((stableSeed >>> (index * 5)) + index) % 3,
    progress: 0, revealedAt: null,
  }))};
}

/** Missing journeys belong to the earlier clear-terrain campaigns. */
export function cleanJourney(raw: unknown, game: SaveData): FirstPlanetJourney | undefined {
  if (raw === undefined) return undefined;
  const value = raw as FirstPlanetJourney;
  if (!value || value.version !== 1 || !Number.isInteger(value.seed) || value.seed < 0 || value.seed > 0xffffffff
    || !Array.isArray(value.sites) || value.sites.length !== sites.length) throw new Error('首星勘测档案无法读取');
  const output = createJourney(value.seed);
  for (const site of output.sites) {
    const saved = value.sites.find(candidate => candidate?.id === site.id);
    if (!saved || saved.anchor?.x !== site.anchor.x || saved.anchor?.y !== site.anchor.y
      || saved.variant !== site.variant || !Number.isFinite(saved.progress) || saved.progress < 0 || saved.progress > 1
      || !(saved.revealedAt === null || (Number.isFinite(saved.revealedAt) && saved.revealedAt >= 0 && saved.revealedAt <= game.lastAt))
      || (saved.progress === 1) !== (saved.revealedAt !== null)) throw new Error('首星地表记录校验失败');
    site.progress = saved.progress;
    site.revealedAt = saved.revealedAt;
  }
  return output;
}

/** Only earned exploration work and observations can uncover the existing locations. */
export function advanceJourney(state: FusionSave): void {
  if (!state.journey) return;
  const work = explorationWorkPosition(state.game);
  const owned = [...state.game.collection, ...(state.game.pendingReturn?.discoveries ?? [])];
  const marker = state.receipt.evidenceIds.includes('field-pipe-scan');
  const sorting = state.progression.sorting.phase !== 'unknown';
  const progress = [
    owned.includes('receipt') ? 1 : Math.min(.96, work),
    owned.includes('mouse') ? 1 : Math.min(.96, Math.max(0, work - 2)),
    sorting && marker ? Math.min(1, Math.max(0, (work - 1.4) / 1.6)) : 0,
  ];
  state.journey.sites.forEach((site, index) => {
    site.progress = Math.max(site.progress, progress[index]);
    if (site.progress >= 1 && site.revealedAt === null) site.revealedAt = state.game.lastAt;
  });
}

export function surfaceView(state: FusionSave): SurfaceSiteView[] {
  if (!state.journey) return [];
  return state.journey.sites.map(site => {
    const definition = sites.find(candidate => candidate.id === site.id)!;
    const revealed = site.revealedAt !== null;
    const phase: SurfacePhase = revealed ? 'revealed' : site.progress >= .65 ? 'revealing'
      : site.progress > 0 ? 'scanning' : 'unknown';
    return {...site, anchor: {...site.anchor}, phase, revealed, source: definition.source,
      ...(revealed ? {name: definition.name} : {})};
  });
}
