import {newGame} from '../src/game/engine';
import {discoveries} from '../src/content/catalog';
import {createFusion, advanceFusion} from '../src/fusion/domain';

/** Explicit configured review states, separate from the fresh-player recording. */
export function captureFixture(kind: 'paper' | 'base' | 'night-basic' | 'night-strong', now: number) {
  if (kind === 'paper') return advanceFusion(createFusion(now - 960000), now);
  const night = kind.startsWith('night');
  const start = now - (night ? 238000 : 960000);
  const seed = newGame(start);
  seed.resources = 27049;
  seed.collection = discoveries.map(item => item.id);
  seed.seenDiscoveries = [...seed.collection];
  seed.upgrades = {radar: 5, scanner: 5, recycler: 5, cargo: 5};
  seed.growth = {'guard-0': kind === 'night-basic' ? 0 : 3, 'guard-1': kind === 'night-basic' ? 0 : 3};
  return advanceFusion(createFusion(start, JSON.stringify(seed)), now);
}
