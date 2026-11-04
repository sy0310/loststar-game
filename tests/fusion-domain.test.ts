import {describe, expect, test} from 'vitest';
import {newGame, MAX_LEVEL, tuning, restore} from '../src/game/engine';
import {discoveries} from '../src/content/catalog';
import {growthCatalog} from '../src/game/growth';
import {advanceFusion, createFusion, reduceFusion, restoreFusion, curioPrices, projectAvailable, latestNightHistory} from '../src/fusion/domain';

const epoch = 1800000000000;
function legacy() {
  const game = newGame(epoch);
  game.resources = 27049;
  game.collection = discoveries.map(d => d.id);
  game.seenDiscoveries = [...game.collection];
  game.upgrades = {radar: MAX_LEVEL, scanner: MAX_LEVEL, recycler: MAX_LEVEL, cargo: MAX_LEVEL};
  game.growth = Object.fromEntries(growthCatalog.map(g => [g.id, g.costs.length]));
  return game;
}

describe('融合版统一账本与旧权益', () => {
  test('27049旧档导入免费承接收藏与设备，不伪造证据', () => {
    const old = legacy();
    const state = createFusion(epoch, JSON.stringify(old));
    expect(state.game.resources).toBe(27049);
    expect(state.game.upgrades).toEqual(old.upgrades);
    expect(state.game.growth).toEqual(old.growth);
    expect(state.receipt.condition).toBe('stabilized');
    expect(state.receipt.evidenceIds).toEqual([]);
    expect(Object.values(state.curios).every(c => c.condition === 'stabilized')).toBe(true);
    const restored = restoreFusion(JSON.stringify(state), epoch);
    expect(restored.game.resources).toBe(27049);
    expect(restored.receipt.condition).toBe('stabilized');
  });

  test('新手自然发现土样，清理修补从同一余额各扣一次', () => {
    let state = advanceFusion(createFusion(epoch), epoch + 12000);
    expect(state.game.collection).toContain('receipt');
    expect(state.game.resources).toBe(128);
    state = reduceFusion(state, {type: 'paper', kind: 'excavate'}, epoch + 12000).state;
    state = advanceFusion(state, epoch + 19000);
    state = reduceFusion(state, {type: 'paper', kind: 'clean'}, epoch + 19000).state;
    const balance = state.game.resources;
    const duplicate = reduceFusion(state, {type: 'paper', kind: 'clean'}, epoch + 19000);
    expect(duplicate.result.ok).toBe(false);
    expect(duplicate.state.game.resources).toBe(balance);
    state = advanceFusion(state, epoch + 23000);
    state.game.resources += 120;
    state = reduceFusion(state, {type: 'paper', kind: 'repair'}, epoch + 23000).state;
    state = advanceFusion(state, epoch + 28000);
    expect(state.receipt.condition).toBe('stabilized');
    expect(state.receipt.transactions.map(t => t.amount)).toEqual([40, 120]);
    expect(state.receipt.parts).toBe(state.game.resources);
    expect(state.receipt.verifiedEvidenceIds).toEqual([]);
  });

  test('实际扫描窗口外的观察不产生来源，真实窗口可核验且刷新保留', () => {
    let state = createFusion(epoch, JSON.stringify(legacy()));
    let result = reduceFusion(state, {type: 'observe', id: 'field-pipe-scan', at: epoch,
      source: 'parcel/returns-plain/pipe-marker-p03'}, epoch);
    expect(result.result.ok).toBe(false);
    state = advanceFusion(state, epoch + 2400);
    // Lv5 scan interval is 5714ms, so 2400ms lies in the actual scan window.
    result = reduceFusion(state, {type: 'observe', id: 'field-pipe-scan', at: epoch + 2400,
      source: 'parcel/returns-plain/pipe-marker-p03'}, epoch + 2400);
    expect(result.result.ok).toBe(true);
    state = reduceFusion(result.state, {type: 'paper', kind: 'identify'}, epoch + 2400).state;
    state = restoreFusion(JSON.stringify(state), epoch + 5200);
    expect(state.receipt.verifiedEvidenceIds).toContain('field-pipe-scan');
    expect(state.records).toHaveLength(1);
    expect(state.receipt.verifiedEvidenceIds).not.toContain('signature');
  });

  test('永久工程各买一次，余额不足时保留原权益', () => {
    let state = createFusion(epoch, JSON.stringify(legacy()));
    expect(projectAvailable(state, 'evidence-bench').reason).toBe('先核对箱标');
    state = reduceFusion(state, {type: 'observe', id: 'field-pipe-scan', at: epoch + 2400,
      source: 'parcel/returns-plain/pipe-marker-p03'}, epoch + 2400).state;
    state = reduceFusion(state, {type: 'project', id: 'evidence-bench'}, epoch + 2400).state;
    expect(state.game.resources).toBe(25249);
    const duplicate = reduceFusion(state, {type: 'project', id: 'evidence-bench'}, epoch + 2400);
    expect(duplicate.result.ok).toBe(false);
    expect(duplicate.state.game.resources).toBe(25249);
    state.game.resources = 10;
    const denied = reduceFusion(state, {type: 'project', id: 'archive'}, epoch + 2400);
    expect(denied.result.ok).toBe(false);
    expect(denied.state.projects).toEqual(['evidence-bench']);
  });

  test('取消调研只退未使用时段一次，调研增效不凭空产生P03记录', () => {
    let state = createFusion(epoch, JSON.stringify(legacy()));
    state = reduceFusion(state, {type: 'task', target: 'marker'}, epoch).state;
    expect(state.game.resources).toBe(26869);
    const automatic = advanceFusion(createFusion(epoch, JSON.stringify(legacy())), epoch + 30000);
    state = advanceFusion(state, epoch + 30000);
    expect(state.task?.target).toBe('marker');
    expect(state.receipt.evidenceIds).toEqual([]);
    const work = (game: typeof state.game) => game.cycles * tuning(game).scanner + game.cycleMs;
    expect(work(state.game)).toBeGreaterThan(work(automatic.game));
    expect(state.game.research.active?.observationOnly).toBe(true);
    const id = state.task!.id;
    const cancelled = reduceFusion(state, {type: 'cancel-task', id}, epoch + 30000).state;
    const duplicate = reduceFusion(cancelled, {type: 'cancel-task', id}, epoch + 30000);
    expect(duplicate.result.ok).toBe(false);
    expect(duplicate.state.game.resources).toBe(cancelled.game.resources);
    expect(cancelled.game.resources - state.game.resources).toBe(90);
    expect(cancelled.game.research.spent).toBe(90);
    expect(cancelled.game.research.active).toBeNull();
  });

  test('五件奇物按自身价格一次整理，原永久收藏保持可用', () => {
    let state = createFusion(epoch, JSON.stringify(legacy()));
    for (const [id, prices] of Object.entries(curioPrices)) {
      state.curios[id] = {condition: 'found'};
      const at = state.game.lastAt;
      const before = state.game.resources;
      state = reduceFusion(state, {type: 'curio', id, kind: 'clean'}, at).state;
      expect(state.game.resources).toBe(before - prices.clean);
      expect(reduceFusion(state, {type: 'curio', id, kind: 'clean'}, at).result.ok).toBe(false);
      state = advanceFusion(state, at + 3000);
      expect(state.curios[id].condition).toBe('clean');
      state = reduceFusion(state, {type: 'curio', id, kind: 'repair'}, at + 3000).state;
      state = advanceFusion(state, at + 6000);
      expect(state.curios[id].condition).toBe('stabilized');
      expect(state.game.collection).toContain(id);
    }
  });

  test('离线归航与自动维修都能重复打开而不重复领取', () => {
    let state = createFusion(epoch, JSON.stringify(legacy()));
    state = advanceFusion(state, epoch + 86400000, true);
    const due = state.game.pendingReturn!.resources;
    state = reduceFusion(state, {type: 'claim'}, epoch + 86400000).state;
    const after = state.game.resources;
    state = reduceFusion(state, {type: 'claim'}, epoch + 86400000).state;
    expect(state.game.resources).toBe(after);
    expect(due).toBeGreaterThan(0);
    expect(restoreFusion(JSON.stringify(state), epoch + 86400000).game.resources).toBe(after);
  });

  test('大量免费试验后仍能恢复物理状态', () => {
    let state = createFusion(epoch, JSON.stringify(legacy()));
    for (let index = 0; index < 140; index++) {
      const at = epoch + index * 2500;
      state = reduceFusion(state, {type: 'paper', kind: 'try'}, at).state;
      state = advanceFusion(state, at + 2400);
    }
    const restored = restoreFusion(JSON.stringify(state), state.game.lastAt);
    expect(restored.receipt.condition).toBe('stabilized');
    expect(restored.receipt.completedActionIds.length).toBeLessThanOrEqual(128);
    expect(restored.receipt.transactions).toEqual([]);
  });

  test('回拨时间拒绝命令且原状态引用与权益保持完整', () => {
    let state = createFusion(epoch, JSON.stringify(legacy()));
    state = advanceFusion(state, epoch + 2400);
    state = reduceFusion(state, {type: 'observe', id: 'field-pipe-scan', at: epoch + 2400,
      source: 'parcel/returns-plain/pipe-marker-p03'}, epoch + 2400).state;
    const before = JSON.stringify(state);
    const denied = reduceFusion(state, {type: 'project', id: 'evidence-bench'}, epoch);
    expect(denied.result.ok).toBe(false);
    expect(denied.state).toBe(state);
    expect(JSON.stringify(state)).toBe(before);
    expect(reduceFusion(state, {type: 'tap'}, NaN).result.ok).toBe(false);
  });

  test('离线保护期的夜班号与实际收费夜班分别核对，记录不串账', () => {
    const state = advanceFusion(createFusion(epoch, JSON.stringify(legacy())), epoch + 72 * 3600000, true);
    expect(state.game.world.lastReport!.number).toBeGreaterThan(state.game.station.lastNight!.number);
    const night = state.records.find(record => record.target === 'night')!;
    expect(night.id).toBe(`night/${state.game.station.lastNight!.number}`);
    expect(night.at).toBe(epoch + state.game.station.lastNight!.number * 300000);
    expect(night.detail).toContain(`受损${state.game.station.lastNight!.damage}点`);
    expect(night.at).toBeLessThanOrEqual(epoch + tuning(state.game).cargo * 1000);
    expect(restoreFusion(JSON.stringify(state), state.game.lastAt).records).toEqual(state.records);
  });

  test('同一天不同实际扫描可形成新观察，付费任务等待实际来源后归档', () => {
    let state = createFusion(epoch, JSON.stringify(legacy()));
    state = reduceFusion(state, {type: 'observe', id: 'field-pipe-scan', at: epoch + 2400,
      source: 'parcel/returns-plain/pipe-marker-p03'}, epoch + 2400).state;
    state = reduceFusion(state, {type: 'task', target: 'marker'}, epoch + 3000).state;
    state = advanceFusion(state, epoch + 8100);
    expect(state.task).not.toBeNull();
    state = reduceFusion(state, {type: 'observe', id: 'field-pipe-scan', at: epoch + 8100,
      source: 'parcel/returns-plain/pipe-marker-p03'}, epoch + 8100).state;
    expect(state.records.filter(record => record.target === 'marker')).toHaveLength(2);
    state = advanceFusion(state, epoch + 64000);
    expect(state.task).toBeNull();
    expect(state.game.research.active).toBeNull();
    expect(state.records.filter(record => record.id.startsWith('task/'))).toHaveLength(1);
  });

  test('已付观察增效夜间到期不直接解锁奇物，任务可跨整理序号恢复', () => {
    let state = advanceFusion(createFusion(epoch), epoch + 240000);
    const collection = [...state.game.collection];
    state = reduceFusion(state, {type: 'task', target: 'marker'}, epoch + 240000).state;
    expect(state.game.research.active?.observationOnly).toBe(true);
    const taskId = state.task!.id;
    state = reduceFusion(state, {type: 'paper', kind: 'excavate'}, epoch + 240000).state;
    const restored = restoreFusion(JSON.stringify(state), epoch + 241000);
    expect(restored.task!.id).toBe(taskId);
    expect(restored.game.research.active?.observationOnly).toBe(true);
    const finished = advanceFusion(restored, epoch + 300000);
    expect(finished.game.collection).toEqual(collection);
    expect(finished.game.research.active).toBeNull();
  });

  test('未来整理动作和D1示例证据不成为正式融合证据', () => {
    const state = createFusion(epoch, JSON.stringify(legacy()));
    const sample = JSON.parse(JSON.stringify(state));
    sample.receipt.activeAction = {id: 'future', kind: 'identify', startedAtSeconds: epoch / 1000 + 100,
      durationSeconds: 0, evidenceSnapshot: ['field-pipe-scan']};
    sample.receipt.observations = [{actionId: 'v034/example', evidenceId: 'field-pipe-scan', observedAtSeconds: epoch / 1000,
      source: 'parcel/returns-plain/night-review', metadata: {artifactCode: 'RET-031', boxCode: 'P03',
        nodeId: 'pipe-marker-p03', eventKind: 'marker-scan'}}];
    sample.receipt.verifiedEvidenceIds = ['field-pipe-scan'];
    const restored = restoreFusion(JSON.stringify(sample), epoch);
    expect(restored.receipt.activeAction).toBeUndefined();
    expect(restored.receipt.evidenceIds).toEqual([]);
    expect(restored.receipt.verifiedEvidenceIds).toEqual([]);
  });

  test('工程必须有可用现场与居民，空内容保持明确门槛', () => {
    const state = createFusion(epoch);
    state.game.resources = 27049;
    state.game.collection = ['receipt', 'mouse'];
    expect(projectAvailable(state, 'evidence-bench').reason).toBe('先核对箱标');
    expect(projectAvailable(state, 'habitat-window').reason).toBe('发现三位居民');
    expect(projectAvailable(state, 'archive').reason).toBe('等一次夜班');
    expect(reduceFusion(state, {type: 'project', id: 'archive'}, epoch).state.game.resources).toBe(27049);
  });

  test('长离线后用已付夜班快照回看，保护夜班号与当前资金保持原样', () => {
    const state = advanceFusion(createFusion(epoch, JSON.stringify(legacy())), epoch + 72 * 3600000, true);
    const original = JSON.stringify(state);
    const source = latestNightHistory(state)!;
    const receipt = state.game.station.lastNight!;
    expect(source.world.lastReport!.number).toBe(receipt.number);
    expect(source.station.lastNight).toEqual(receipt);
    expect(source.world.lastReport!.result!.intercepted).toBe(receipt.intercepted);
    expect(source.world.lastReport!.result!.arrived).toBe(receipt.arrived);
    expect(state.game.world.lastReport!.number).toBeGreaterThan(source.world.lastReport!.number);
    expect(JSON.stringify(state)).toBe(original);
    source.resources = 0;
    expect(state.game.resources).toBe(27049);
    const restored = restoreFusion(JSON.stringify(state), state.game.lastAt);
    expect(latestNightHistory(restored)!.world.lastReport).toEqual(latestNightHistory(state)!.world.lastReport);
  });

  test('归档采用夜班实际冻结配置，随后升级和下一次离线各自保留正确配置', () => {
    let state = advanceFusion(createFusion(epoch), epoch + 250000);
    state.game.growth = {'guard-0': 3, 'guard-1': 3};
    state.game.world.strengths = [3, 3];
    expect(state.game.world.activeNight!.strengths).toEqual([0, 0]);
    state = advanceFusion(state, epoch + 300000);
    expect(state.records.find(record => record.id === 'night/1')!.night!.configuration.strengths).toEqual([0, 0]);
    state = advanceFusion(state, epoch + 86400000, true);
    expect(state.game.world.lastReport!.number).toBeGreaterThan(state.game.station.lastNight!.number);
    const history = latestNightHistory(state)!;
    expect(history.world.lastReport!.result!.configuration.strengths).toEqual([3, 3]);
    expect(history.station.lastNight!.intercepted).toBe(history.world.lastReport!.result!.intercepted);
  });

  test('坏夜班快照被舍弃，旧记录只在实时夜班回执一致时回看', () => {
    const long = advanceFusion(createFusion(epoch, JSON.stringify(legacy())), epoch + 86400000, true);
    const raw = JSON.parse(JSON.stringify(long));
    raw.records.find((record: {target: string}) => record.target === 'night').night.configuration.strengths = [30, 30];
    const restored = restoreFusion(JSON.stringify(raw), raw.game.lastAt);
    expect(restored.records.find(record => record.target === 'night')!.night).toBeUndefined();
    expect(latestNightHistory(restored)).toBeNull();
    const recent = advanceFusion(createFusion(epoch), epoch + 300000);
    recent.records = recent.records.map(({night: _oldFormat, ...record}) => record);
    expect(latestNightHistory(recent)!.world.lastReport!.number).toBe(1);
    expect(latestNightHistory(createFusion(epoch))).toBeNull();
  });

  test('首次导入24小时旧档记录实际付费夜班，资金和旧权益与原恢复一致', () => {
    const game = legacy();
    const raw = JSON.stringify(game);
    const now = epoch + 86400000;
    const expected = restore(raw, now);
    const state = createFusion(now, raw);
    expect(state.importedLegacy).toBe(true);
    expect(state.game).toEqual(expected);
    expect(state.game.resources).toBe(27049);
    expect(state.game.upgrades).toEqual(game.upgrades);
    expect(state.game.growth).toEqual(game.growth);
    expect(state.receipt.condition).toBe('stabilized');
    expect(Object.values(state.curios).every(curio => curio.condition === 'stabilized')).toBe(true);
    expect(state.game.world.lastReport!.number).toBeGreaterThan(state.game.station.lastNight!.number);
    const history = latestNightHistory(state)!;
    expect(history.station.lastNight).toEqual(state.game.station.lastNight);
    expect(history.world.lastReport!.number).toBe(history.station.lastNight!.number);
    expect(state.records.some(record => record.target === 'night' && record.night)).toBe(true);
    expect(raw).toBe(JSON.stringify(game));
  });

  test('首次导入前尚未发现的离线奇物待归航后按新获得状态初始化', () => {
    const game = newGame(epoch);
    game.resources = 27049;
    const state = createFusion(epoch + 86400000, JSON.stringify(game));
    expect(state.game.collection).not.toContain('receipt');
    expect(state.game.pendingReturn!.discoveries).toContain('receipt');
    expect(state.receipt.stage).toBe('buried');
    expect(state.receipt.condition).toBe('found');
    expect(state.curios.tape).toBeUndefined();
    const claimed = reduceFusion(state, {type: 'claim'}, state.game.lastAt).state;
    const initialized = advanceFusion(claimed, claimed.game.lastAt);
    expect(initialized.game.collection).toContain('tape');
    expect(initialized.curios.tape.condition).toBe('found');
    expect(initialized.receipt.condition).toBe('found');
    expect(createFusion(epoch + 86400000, '{bad old data').importedLegacy).toBe(false);
  });
});
