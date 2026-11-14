import {advanceFusion, createFusion, reduceFusion} from '../src/fusion/domain';
import {refinementView} from '../src/fusion/progression';
import {firstPlanetFixture} from './firstplanet_fixtures';
import type {FusionAction, FusionSave} from '../src/fusion/contracts';

export type FeedbackFixture = 'unrevealed' | 'partial' | 'revealed' | 'night' | 'jammed' | 'building' | 'cleared';

/** Review contexts only. Progress is generated through the existing model. */
export function feedbackFixture(kind: FeedbackFixture, now: number) {
  const elapsed = {unrevealed: 0, partial: 10500, revealed: 40000, night: 246000};
  if (kind in elapsed) {
    const duration = elapsed[kind as keyof typeof elapsed];
    let state = createFusion(now - duration, null, {journey: true, seed: 3801});
    const startedAt = state.game.lastAt;
    while (state.game.lastAt < now) state = advanceFusion(state, Math.min(now, state.game.lastAt + 1000));
    return {state, audit: {kind, method: 'real-model-review-fixture', startedAt, endedAt: now,
      worldMs: state.game.world.elapsedMs, initialParts: 120, balance: state.game.resources,
      sourceWork: state.game.cycles, actions: [] as {action: FusionAction; at: number; paid: number}[]}};
  }
  function build(end: number) {
    const initial = firstPlanetFixture(end, 0);
    let state: FusionSave = initial.state;
    const startedAt = state.game.lastAt;
    const actions: {action: FusionAction; at: number; paid: number}[] = [];
    function advance(seconds: number) {
      const until = state.game.lastAt + seconds * 1000;
      while (state.game.lastAt < until) state = advanceFusion(state, Math.min(until, state.game.lastAt + 1000));
    }
    function act(action: FusionAction) {
      const before = state.game.resources;
      const next = reduceFusion(state, action, state.game.lastAt);
      if (!next.result.ok) throw new Error(`Review fixture action failed ${JSON.stringify(action)}`);
      state = next.state;actions.push({action, at: state.game.lastAt, paid: before - state.game.resources});
    }
    if (kind !== 'jammed') {
      act({type: 'sorting', kind: 'survey'});
      for (let step = 0; state.progression.sorting.phase !== 'surveyed'; step++) {
        if (step > 400) throw new Error('Survey did not settle');
        advance(1);
      }
      const price = refinementView(state).mainAction.price;
      for (let step = 0; state.game.resources < price; step++) {
        if (step > 3600) throw new Error('Construction funds did not accrue');
        advance(1);
      }
      act({type: 'sorting', kind: 'build'});
      if (kind === 'cleared') {
        for (let step = 0; refinementView(state).sorting.phase !== 'ready'; step++) {
          if (step > 400) throw new Error('Construction did not settle');
          advance(1);
        }
        act({type: 'sorting', kind: 'work'});
        for (let step = 0; refinementView(state).sorting.phase !== 'cleared'; step++) {
          if (step > 1200) throw new Error('Sorting did not complete');
          const compare = refinementView(state).compareAction;
          if (compare.enabled) act(compare.action);
          advance(1);
        }
      }
    }
    return {state, audit: {kind, method: 'real-model-review-fixture', startedAt, endedAt: state.game.lastAt,
      worldMs: state.game.world.elapsedMs, initialParts: initial.audit.initialParts,
      initialFixture: initial.audit, balance: state.game.resources, sourceWork: state.game.cycles, actions}};
  }
  const reference = 1800000000000;
  const duration = build(reference).state.game.lastAt - reference;
  return build(now - duration);
}
