import {writeFileSync, mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {newGame, cost, MAX_LEVEL, type UpgradeId} from '../src/game/engine';
import {growthCatalog, growthLevel} from '../src/game/growth';
import {discoveries} from '../src/content/catalog';
import {createFusion, advanceFusion, reduceFusion, projectAvailable} from '../src/fusion/domain';
import {fusionProjects, type FusionSave, type FusionAction} from '../src/fusion/contracts';
const epoch = 1800000000000;
const rows: any[] = [];
const checks = {negative: 0, accounting: 0, duplicateFees: 0, oldRestorationFees: 0};
for (const initial of [120, 5000, 27049, 50000]) for (const active of [false, true]) for (const policy of ['save', 'build', 'research']) for (const auto of [false, true]) {
  const old = newGame(epoch);
  old.resources = initial;
  const legacy = initial >= 27049;
  if (legacy) {
    old.collection = discoveries.map(d => d.id);old.seenDiscoveries = [...old.collection];
    old.upgrades = {radar: 5, scanner: 5, recycler: 5, cargo: 5};
    old.growth = Object.fromEntries(growthCatalog.map(g => [g.id, g.costs.length]));
  }
  let state = legacy ? createFusion(epoch, JSON.stringify(old)) : createFusion(epoch);
  state.game.resources = initial;state.game.station.autoRepair = auto;
  const seed = structuredClone(state);
  let invested = 0;
  let refunded = 0;
  function act(action: FusionAction, at: number) {
    const before = state.game.resources;
    const next = reduceFusion(state, action, at);
    if (next.result.ok && ['upgrade', 'growth', 'project', 'task', 'paper', 'curio'].includes(action.type)) invested += before - next.state.game.resources;
    if (next.result.ok && action.type === 'cancel-task') refunded += next.state.game.resources - before;
    state = next.state;
  }
  function snapshot(minutes: number, offline = false) {
    const game = state.game;
    const held = game.pendingReturn?.resources ?? 0;
    const expected = initial + game.station.grossIncome - game.station.repairSpent - invested + refunded;
    if (game.resources < 0 || held < 0) checks.negative++;
    if (Math.abs(game.resources + held - expected) > .01) checks.accounting++;
    if (legacy && state.receipt.transactions.length) checks.oldRestorationFees++;
    const copy = state;
    for (const project of state.projects) {
      const next = reduceFusion(state, {type: 'project', id: project}, state.game.lastAt);
      if (next.result.ok || next.state.game.resources !== state.game.resources) checks.duplicateFees++;
    }
    state = copy;
    rows.push({initial, legacy, active, policy, auto, minutes, offline, gross: game.station.grossIncome,
      maintenance: game.station.repairSpent, invested, refunded, balance: game.resources, held,
      integrity: game.station.integrity, found: game.collection.length, observations: state.records.length,
      projects: state.projects.join(','), assistWork: game.assist?.appliedWorkMs ?? 0});
  }
  snapshot(0);
  for (let second = 1; second <= 7200; second++) {
    const at = epoch + second * 1000;
    state = advanceFusion(state, at);
    if (active) act({type: 'tap'}, at);
    if (second % 10 === 0 && policy === 'build') {
      for (const id of ['scanner', 'recycler', 'radar', 'cargo'] as UpgradeId[]) {
        if (state.game.upgrades[id] < MAX_LEVEL && state.game.resources >= cost(state.game, id)) {
          act({type: 'upgrade', id, expected: state.game.upgrades[id]}, at);break;
        }
      }
      for (const project of fusionProjects) if (projectAvailable(state, project.id).available) act({type: 'project', id: project.id}, at);
      const guard = growthCatalog.find(g => ['guard-0', 'guard-1', 'repair-bay'].includes(g.id) && growthLevel(state.game, g.id) < g.costs.length && state.game.resources >= g.costs[growthLevel(state.game, g.id)]);
      if (guard) act({type: 'growth', id: guard.id, expected: growthLevel(state.game, guard.id)}, at);
    }
    if (second % 10 === 0 && policy === 'research' && !state.task) {
      const target = state.game.collection.includes('receipt') ? 'marker' : 'residents';
      act({type: 'task', target}, at);
    }
    if ([300, 900, 1800, 3600, 7200].includes(second)) snapshot(second / 60);
  }
  for (const hours of [8, 24, 72]) {
    state = advanceFusion(seed, epoch + hours * 3600000, true);
    invested = 0;refunded = 0;
    snapshot(hours * 60, true);
  }
}
mkdirSync('artifacts/fusion', {recursive: true});
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
const report = {at: new Date().toISOString(), sourceCommit, checks, profiles: 48, rows,
  scope: 'Actual unified domain, same ledger and paid observation boosts. Active policy taps once/second within rolling cap. Offline cases are independent departure states. Real scene-only daytime scans are not injected; source records follow actual night models. Full-content desirability requires user review.'};
writeFileSync('artifacts/fusion/economy.json', JSON.stringify(report, null, 2)+'\n');
const headers = Object.keys(rows[0]);
writeFileSync('artifacts/fusion/economy.csv', [headers.join(','), ...rows.map(row => headers.map(k => JSON.stringify(row[k])).join(','))].join('\n')+'\n');
writeFileSync('artifacts/fusion/economy.md', '# 融合版实际经济模拟\n\n48组配置覆盖新手与旧权益、点击与挂机、建设与调查、自动维修开关。离线各项为独立出发状态。\n\n'+
  '| 初始 | 主动 | 策略 | 自动修 | 分钟 | 收入 | 维修 | 投入 | 余额 | 待领 | 完整度 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n'+
  rows.map(r => `| ${r.initial} | ${r.active} | ${r.policy} | ${r.auto} | ${r.minutes} | ${r.gross} | ${r.maintenance} | ${r.invested} | ${r.balance} | ${r.held} | ${r.integrity} |`).join('\n')+'\n\n'+
  `账目检查结果 ${JSON.stringify(checks)}。长期消费吸引力等待真实游玩评审。\n`);
console.log(JSON.stringify({checks, rows: rows.length, profiles:48}));
if (Object.values(checks).some(Boolean)) process.exitCode = 1;
