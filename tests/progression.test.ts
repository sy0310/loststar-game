import {describe, expect, test} from 'vitest';
import {advance, newGame, tuning} from '../src/game/engine';
import {discoveries} from '../src/content/catalog';
import {growthCatalog} from '../src/game/growth';
import {advanceFusion, createFusion, reduceFusion, restoreFusion} from '../src/fusion/domain';
import {abilityPrices, explorationWorkPosition, refinementView, sortingRules, sortingStudies} from '../src/fusion/progression';
import type {FusionSave} from '../src/fusion/contracts';
import {reviewFixture, type ReviewFixture} from '../scripts/refinement_fixtures';

const epoch = 1800000000000;
function prepared(max = true): FusionSave {
  const game = newGame(epoch);
  game.resources = 27049;
  game.collection = discoveries.map(discovery => discovery.id);
  game.seenDiscoveries = [...game.collection];
  game.discoveryAt = Object.fromEntries(game.collection.map(id => [id, epoch]));
  if (max) {
    game.upgrades = {scanner: 5, recycler: 5, radar: 5, cargo: 5};
    game.growth = Object.fromEntries(growthCatalog.map(entry => [entry.id, entry.costs.length]));
  }
  let state = createFusion(epoch, JSON.stringify(game));
  const at = epoch + tuning(game).scanner * .44;
  state = reduceFusion(state, {type: 'observe', id: 'field-pipe-scan', at,
    source: 'parcel/returns-plain/pipe-marker-p03'}, at).state;
  return advanceFusion(state, at);
}
function act(state: FusionSave, kind: 'survey' | 'build' | 'work' | 'compare') {
  return reduceFusion(state, {type: 'sorting', kind}, state.game.lastAt);
}
function work(state: FusionSave, rounds: number) {
  return advanceFusion(state, state.game.lastAt + tuning(state.game).scanner * rounds + 1);
}
function beginWorking(state: FusionSave) {
  state = act(state, 'survey').state;
  state = work(state, 2);
  state = act(state, 'build').state;
  state = work(state, 1);
  return act(state, 'work').state;
}

describe('首星卡纸支线与本体能力', () => {
  test('只有真实P03来源揭示支线，免费勘测必须完成两轮工作', () => {
    const fresh = createFusion(epoch);
    expect(refinementView(fresh).sorting.phase).toBe('unknown');
    expect(act(fresh, 'survey').result.ok).toBe(false);
    let state = prepared();
    expect(refinementView(state).sorting.phase).toBe('observed');
    const before = state.game.resources;
    state = act(state, 'survey').state;
    expect(state.game.resources).toBe(before);
    state = work(state, 1);
    expect(state.progression.sorting.phase).toBe('surveying');
    state = work(state, 1);
    expect(state.progression.sorting.phase).toBe('surveyed');
    expect(state.progression.sorting.facts.map(fact => fact.code)).toEqual(['P03']);
    expect(state.progression.sorting.facts[0].nodeId).toBe('parcel/old-sorting/belt-sign');
  });

  test('能力等级与开工费用一次扣款，胶带后升不追退已付工程', () => {
    let state = prepared();
    const oldGrowth = structuredClone(state.game.growth);
    const opening = state.game.resources;
    const level0 = reduceFusion(state, {type: 'ability', id: 'tape', expected: 0}, state.game.lastAt);
    expect(level0.result.ok).toBe(true);
    state = level0.state;
    expect(state.game.resources).toBe(opening - abilityPrices.tape[0]);
    expect(reduceFusion(state, {type: 'ability', id: 'tape', expected: 0}, state.game.lastAt).result.ok).toBe(false);
    state = work(act(state, 'survey').state, 2);
    const beforeBuild = state.game.resources;
    state = act(state, 'build').state;
    expect(state.game.resources).toBe(beforeBuild - 2160);
    expect(state.progression.sorting.buildTapeLevel).toBe(1);
    expect(act(state, 'build').result.ok).toBe(false);
    const beforeUpgrade = state.game.resources;
    state = reduceFusion(state, {type: 'ability', id: 'tape', expected: 1}, state.game.lastAt).state;
    expect(state.game.resources).toBe(beforeUpgrade - 720);
    expect(state.progression.sorting.paidCost).toBe(2160);
    expect(state.game.growth).toEqual(oldGrowth);
  });

  test('本体Ⅱ档降低真实工序轮数，实际P30与P03核对不改变签收事实', () => {
    let state = prepared();
    for (const id of ['receipt', 'tape'] as const) for (const expected of [0, 1]) {
      state = reduceFusion(state, {type: 'ability', id, expected}, state.game.lastAt).state;
    }
    state = beginWorking(state);
    expect(state.progression.sorting.paidCost).toBe(1920);
    expect(state.progression.sorting.facts).toHaveLength(1);
    state = work(state, 5);
    const view = refinementView(state);
    expect(view.sorting.stage).toBe('verify');
    expect(view.sorting.workRequired).toBe(3);
    expect(view.sorting.compared).toBe(true);
    expect(view.sorting.sourceFacts.some(fact => fact.code === 'P30' && fact.orientation === 'inverted')).toBe(true);
    state = work(state, 3);
    expect(refinementView(state).sorting.stage).toBe('clear-paper');
    expect(refinementView(state).sorting.workRequired).toBe(5);
    state = work(state, 5);
    expect(state.progression.sorting.phase).toBe('cleared');
    expect(state.receipt.verifiedEvidenceIds).not.toContain('signature');
    expect(state.progression.sorting.facts.find(fact => fact.kind === 'comparison')!.detail).toContain('次序不同');
  });

  test('Ⅰ档收据主动对照真实标签才减核验，缺少标签时不给比较结果', () => {
    let state = prepared();
    state = reduceFusion(state, {type: 'ability', id: 'receipt', expected: 0}, state.game.lastAt).state;
    expect(act(state, 'compare').result.ok).toBe(false);
    state = beginWorking(state);
    expect(act(state, 'compare').result.ok).toBe(false);
    state = work(state, 5);
    expect(refinementView(state).sorting.workRequired).toBe(6);
    state = act(state, 'compare').state;
    expect(refinementView(state).sorting.workRequired).toBe(3);
    expect(act(state, 'compare').result.ok).toBe(false);
  });

  test('区域作业复用普通收入，升级保持工作比例，夜间暂停', () => {
    let state = beginWorking(prepared(false));
    const before = structuredClone(state);
    const result = work(state, 3);
    const ordinary = advance(before.game, result.game.lastAt);
    expect(result.game).toEqual(ordinary);
    expect(result.progression.sorting.workDone).toBeCloseTo(3, 2);
    state = advanceFusion(result, epoch + 240000);
    const position = state.progression.sorting.workDone;
    const phase = state.progression.sorting.phase;
    state = advanceFusion(state, epoch + 299000);
    expect(state.progression.sorting.phase).toBe(phase);
    expect(state.progression.sorting.workDone).toBeCloseTo(position);
  });

  test('离线72小时只完成已开始工作，刷新和复核不重复收钱或发奖', () => {
    let state = beginWorking(prepared());
    state = advanceFusion(state, state.game.lastAt + 72 * 3600000, true);
    expect(state.progression.sorting.phase).toBe('cleared');
    const restored = restoreFusion(JSON.stringify(state), state.game.lastAt);
    expect(restored.game.resources).toBe(state.game.resources);
    expect(restored.progression.sorting).toEqual(state.progression.sorting);
    const reviewed = reduceFusion(restored, {type: 'sorting', kind: 'review'}, state.game.lastAt).state;
    expect(reviewed.game.resources).toBe(state.game.resources);
    expect(reviewed.game.pendingReturn).toEqual(state.game.pendingReturn);
    expect(state.progression.sorting.facts.every(fact => fact.at <= state.progression.sorting.clearedAt!)).toBe(true);
  });

  test('三份定向研究各自付90并消耗实际工作，完成后只读免费', () => {
    let state = work(beginWorking(prepared()), 18);
    expect(state.progression.sorting.phase).toBe('cleared');
    for (const study of sortingStudies) {
      const at = state.game.lastAt;
      const before = state.game.resources;
      state = reduceFusion(state, {type: 'sorting', kind: 'research', target: study.id}, at).state;
      expect(state.game.resources).toBe(before - 90);
      expect(reduceFusion(state, {type: 'sorting', kind: 'research', target: study.id}, at).result.ok).toBe(false);
      state = work(state, sortingRules.researchWork);
      expect(state.progression.sorting.facts.some(fact => fact.id === `study/${study.id}`)).toBe(true);
      if (study.id !== 'paper-fibres') {
        const stale = reduceFusion(state, {type: 'sorting', kind: 'research', target: study.id}, state.game.lastAt);
        expect(stale.result.ok).toBe(false);
        expect(stale.state.game.resources).toBe(state.game.resources);
      }
    }
    const before = state.game.resources;
    const collection = [...state.game.collection];
    state = reduceFusion(state, refinementView(state).researchAction.action, state.game.lastAt).state;
    expect(state.game.resources).toBe(before);
    expect(state.game.collection).toEqual(collection);
    expect(state.progression.sorting.facts.filter(fact => fact.kind === 'study')).toHaveLength(3);
  });

  test('定向观察按实际进度部分退款，同一序号只退款一次', () => {
    let state = work(beginWorking(prepared()), 18);
    state = reduceFusion(state, refinementView(state).researchAction.action, state.game.lastAt).state;
    const seq = state.progression.sorting.activeStudy!.seq;
    state = work(state, .75);
    const balance = state.game.resources;
    const progress = state.progression.sorting.activeStudy!.workDone;
    const refund = Math.floor(90 * (1 - progress / 2));
    const cancel = {type: 'sorting', kind: 'cancel-research', expected: seq} as const;
    state = reduceFusion(state, cancel, state.game.lastAt).state;
    expect(refund).toBeGreaterThan(0);
    expect(refund).toBeLessThan(90);
    expect(state.game.resources).toBe(balance + refund);
    expect(state.progression.sorting.researchRefunded).toBe(refund);
    expect(state.progression.sorting.facts.some(fact => fact.kind === 'study')).toBe(false);
    const duplicate = reduceFusion(state, cancel, state.game.lastAt);
    expect(duplicate.result.ok).toBe(false);
    expect(duplicate.state.game.resources).toBe(state.game.resources);
    state = reduceFusion(state, refinementView(state).researchAction.action, state.game.lastAt).state;
    expect(state.progression.sorting.activeStudy!.seq).toBe(seq + 1);
    expect(reduceFusion(state, cancel, state.game.lastAt).result.ok).toBe(false);
  });

  test('扫描升级和刷新保留工序比例，收入只有原核心一份', () => {
    let state = work(beginWorking(prepared(false)), 1.25);
    const workDone = state.progression.sorting.workDone;
    const position = explorationWorkPosition(state.game);
    const upgraded = reduceFusion(state, {type: 'upgrade', id: 'scanner', expected: 0}, state.game.lastAt);
    expect(upgraded.result.ok).toBe(true);
    state = upgraded.state;
    expect(explorationWorkPosition(state.game)).toBeCloseTo(position, 10);
    state = restoreFusion(JSON.stringify(state), state.game.lastAt);
    expect(state.progression.sorting.workDone).toBeCloseTo(workDone, 10);
    const before = state.game;
    state = work(state, 1);
    expect(state.progression.sorting.workDone).toBeCloseTo(workDone + 1, 2);
    expect(state.game).toEqual(advance(before, state.game.lastAt));
  });

  test('已有普通作业不会追赠区域进度，回拨和资金不足不重复扣费', () => {
    let state = work(prepared(), 12);
    const saved = structuredClone(state);
    state = act(state, 'survey').state;
    expect(state.progression.sorting.workDone).toBe(0);
    expect(advanceFusion(state, state.game.lastAt - 1)).toBe(state);
    const ability = {type: 'ability', id: 'receipt', expected: 0} as const;
    state.game.resources = 299;
    expect(reduceFusion(state, ability, state.game.lastAt).result.ok).toBe(false);
    expect(state.game.resources).toBe(299);
    expect(saved.game.resources).toBeGreaterThan(27049);
  });

  test('恢复校验清除错误来源，保留已支付建设和全部旧权益', () => {
    let state = beginWorking(prepared());
    const rights = {growth: state.game.growth, upgrades: state.game.upgrades, collection: state.game.collection};
    const balance = state.game.resources;
    state.progression.abilities.receipt = Number.NaN as never;
    state.progression.sorting.phase = 'surveyed';
    state.progression.sorting.paidCost = 0;
    state.progression.sorting.facts.push({id: 'study/fabricated', kind: 'study', at: state.game.lastAt,
      nodeId: 'parcel/old-sorting/fabricated', detail: '无实际来源'});
    state.progression.sorting.facts.push({id: 'label/P30', kind: 'label', at: state.game.lastAt,
      nodeId: 'parcel/old-sorting/wrong-source', detail: '错误位置', code: 'P30', orientation: 'inverted'});
    state.progression.sorting.compared = true;
    state = restoreFusion(JSON.stringify(state), state.game.lastAt);
    expect(state.progression.abilities.receipt).toBe(0);
    expect(state.progression.sorting.facts.map(fact => fact.id)).toEqual(['label/P03']);
    expect(state.progression.sorting.compared).toBe(false);
    expect(refinementView(state).mainAction.price).toBe(0);
    state = act(state, 'build').state;
    expect(state.game.resources).toBe(balance);
    expect(state.progression.payments.filter(payment => payment.id === 'sorting/build')).toHaveLength(1);
    expect({growth: state.game.growth, upgrades: state.game.upgrades, collection: state.game.collection}).toEqual(rights);
  });

  test('分批和整段离线只记录实际完成来源，时间有界且免费复核不改账本', () => {
    const initial = beginWorking(prepared());
    let stepped = initial;
    const end = initial.game.lastAt + 130000;
    while (stepped.game.lastAt < end) stepped = advanceFusion(stepped, Math.min(end, stepped.game.lastAt + 250));
    const batched = advanceFusion(initial, end);
    expect(stepped.progression.sorting.phase).toBe(batched.progression.sorting.phase);
    expect(stepped.progression.sorting.facts.map(fact => fact.id)).toEqual(batched.progression.sorting.facts.map(fact => fact.id));
    for (const event of batched.progression.sorting.facts) {
      const actual = stepped.progression.sorting.facts.find(fact => fact.id === event.id)!;
      expect(Math.abs(actual.at - event.at)).toBeLessThanOrEqual(1);
      expect(event.at).toBeGreaterThanOrEqual(initial.game.lastAt - 20000);
      expect(event.at).toBeLessThanOrEqual(end);
    }
    const balance = batched.game.resources;
    const checked = reduceFusion(batched, {type: 'sorting', kind: 'review'}, end).state;
    expect(checked.game.resources).toBe(balance);
  });

  test('错误在途研究不能凭空退款，真实付费研究刷新后可以继续', () => {
    let state = work(beginWorking(prepared()), 18);
    state = reduceFusion(state, refinementView(state).researchAction.action, state.game.lastAt).state;
    const original = restoreFusion(JSON.stringify(state), state.game.lastAt);
    expect(original.progression.sorting.activeStudy).toEqual(state.progression.sorting.activeStudy);
    state.progression.sorting.researchPaid = 0;
    const balance = state.game.resources;
    state = restoreFusion(JSON.stringify(state), state.game.lastAt);
    expect(state.progression.sorting.activeStudy).toBeNull();
    expect(reduceFusion(state, {type: 'sorting', kind: 'cancel-research', expected: 1}, state.game.lastAt).result.ok).toBe(false);
    expect(state.game.resources).toBe(balance);
  });

  test('审核截图种子由真实指令生成且对齐时钟，各档可恢复', () => {
    const modes: ReviewFixture[] = ['full', 'surveyed', 'hauling', 'verify', 'clear-paper', 'cleared', 'night-sorting'];
    for (const level of [0, 1, 2] as const) for (const mode of modes) {
      const state = reviewFixture(mode, epoch, level, level);
      expect(state.game.lastAt).toBe(epoch);
      expect(state.progression.abilities).toEqual({receipt: level, tape: level});
      expect(state.progression.sorting.facts.every(entry => entry.at <= epoch)).toBe(true);
      const restored = restoreFusion(JSON.stringify(state), epoch);
      expect(restored.progression.sorting).toEqual(state.progression.sorting);
      expect(restored.game.resources).toBe(state.game.resources);
      if (mode === 'night-sorting') {
        expect(state.game.world.elapsedMs % 300000).toBe(250000);
        expect(state.progression.sorting.phase).toBe('working');
      }
    }
  });

  test('无能力完成支线后不再出售无现存目标的能力，付费旧能力保持', () => {
    let state = work(beginWorking(prepared()), 18);
    const balance = state.game.resources;
    for (const id of ['receipt', 'tape'] as const) {
      const view = refinementView(state).abilities[id];
      expect(view.hasTarget).toBe(false);
      expect(view.enabled).toBe(false);
      expect(view.reason).toBe('本段已完成，等待新作业');
      const rejected = reduceFusion(state, view.action, state.game.lastAt);
      expect(rejected.result.ok).toBe(false);
      expect(rejected.state.game.resources).toBe(balance);
    }
    state = reduceFusion(state, refinementView(state).researchAction.action, state.game.lastAt).state;
    expect(state.progression.sorting.activeStudy).not.toBeNull();
    expect(refinementView(state).abilities.receipt.hasTarget).toBe(false);
    const owned = reviewFixture('cleared', epoch, 2, 2);
    expect(restoreFusion(JSON.stringify(owned), epoch).progression.abilities).toEqual({receipt: 2, tape: 2});
  });

  test('本段已核对后不售收据自动核验，普通核验完成也等待新样本', () => {
    let state = prepared();
    state = reduceFusion(state, {type: 'ability', id: 'receipt', expected: 0}, state.game.lastAt).state;
    state = work(beginWorking(state), 5);
    state = act(state, 'compare').state;
    const view = refinementView(state).abilities.receipt;
    const balance = state.game.resources;
    expect(state.progression.sorting.stage).toBe('verify');
    expect(view.hasTarget).toBe(false);
    expect(view.reason).toBe('本段已核对，等待新样本');
    expect(reduceFusion(state, view.action, state.game.lastAt).result.ok).toBe(false);
    expect(state.game.resources).toBe(balance);
    state = work(beginWorking(prepared()), 11);
    expect(state.progression.sorting.stage).toBe('clear-paper');
    expect(refinementView(state).abilities.receipt.enabled).toBe(false);
    expect(refinementView(state).abilities.tape.enabled).toBe(true);
  });

  test('已付工程后胶带Ⅰ只解锁Ⅱ档清纸，材料费不追退且效果真实', () => {
    let state = beginWorking(prepared());
    const before = state.game.resources;
    let view = refinementView(state).abilities.tape;
    expect(view.nextEffect).toBe('解锁Ⅱ档清纸研究，另需720');
    state = reduceFusion(state, view.action, state.game.lastAt).state;
    view = refinementView(state).abilities.tape;
    expect(view.currentEffect).toContain('工程款锁定');
    expect(view.nextEffect).toBe('本段清纸7轮→5轮');
    state = reduceFusion(state, view.action, state.game.lastAt).state;
    expect(state.game.resources).toBe(before - 960);
    expect(state.progression.sorting.paidCost).toBe(2400);
    state = work(state, 11);
    expect(refinementView(state).sorting.workRequired).toBe(5);
    state = work(state, 5);
    expect(state.progression.sorting.phase).toBe('cleared');
  });
});
