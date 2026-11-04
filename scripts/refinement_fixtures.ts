import {discoveries} from '../src/content/catalog';
import {growthCatalog} from '../src/game/growth';
import {newGame, tuning} from '../src/game/engine';
import {advanceFusion, createFusion, reduceFusion} from '../src/fusion/domain';
import type {FusionAction, FusionSave} from '../src/fusion/contracts';
import {refinementView, type AbilityLevel} from '../src/fusion/progression';

export type ReviewFixture = 'full' | 'surveyed' | 'hauling' | 'verify' | 'clear-paper' | 'cleared' | 'night-sorting';

export function freshReviewFixture(now: number): FusionSave {
  return createFusion(now);
}

/** Build review captures through actual paid actions and core work, with the final clock aligned to now. */
export function reviewFixture(mode: ReviewFixture, now: number, receiptLevel: AbilityLevel = 2, tapeLevel: AbilityLevel = 2): FusionSave {
  function build(start: number) {
    const game = newGame(start);
    game.resources = 27049;
    game.collection = discoveries.map(entry => entry.id);
    game.seenDiscoveries = [...game.collection];
    game.discoveryAt = Object.fromEntries(game.collection.map(id => [id, start]));
    game.upgrades = {scanner: 5, recycler: 5, radar: 5, cargo: 5};
    game.growth = Object.fromEntries(growthCatalog.map(entry => [entry.id, entry.costs.length]));
    let state = createFusion(start, JSON.stringify(game));
    function act(action: FusionAction) {
      const result = reduceFusion(state, action, state.game.lastAt);
      if (!result.result.ok) throw new Error(`Invalid fixture action ${JSON.stringify(action)}`);
      state = result.state;
    }
    function work(rounds: number) {
      state = advanceFusion(state, state.game.lastAt + tuning(state.game).scanner * rounds + 1);
    }
    state = advanceFusion(state, start + tuning(game).scanner * .44);
    act({type: 'observe', id: 'field-pipe-scan', at: state.game.lastAt,
      source: 'parcel/returns-plain/pipe-marker-p03'});
    state = advanceFusion(state, state.game.lastAt);
    for (const [id, level] of [['receipt', receiptLevel], ['tape', tapeLevel]] as const) {
      for (let expected = 0; expected < level; expected++) act({type: 'ability', id, expected});
    }
    if (mode === 'full') return state;
    act({type: 'sorting', kind: 'survey'});
    work(2);
    if (mode === 'surveyed') return state;
    act({type: 'sorting', kind: 'build'});
    work(1);
    if (mode === 'night-sorting') state = advanceFusion(state, start + 238000);
    act({type: 'sorting', kind: 'work'});
    if (mode === 'night-sorting') return advanceFusion(state, start + 250000);
    if (mode === 'hauling') return state;
    work(5);
    if (mode === 'verify') return state;
    if (refinementView(state).compareAction.enabled) act(refinementView(state).compareAction.action);
    work(refinementView(state).sorting.workRequired);
    if (mode === 'clear-paper') return state;
    work(refinementView(state).sorting.workRequired);
    return state;
  }
  const offset = build(1800000000000).game.lastAt - 1800000000000;
  return build(now - offset);
}
