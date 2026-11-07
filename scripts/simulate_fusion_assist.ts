import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {advance, claimReturn, cost, newGame, restore, tuning, upgrade, type SaveData} from '../src/game/engine';
import {assistRules, assistStatus, tapAssist} from '../src/game/assist';
import {discoveries} from '../src/content/catalog';
import {growthCatalog} from '../src/game/growth';

const epoch = 1800000000000;
const output = process.env.OUTPUT_DIR ?? 'artifacts/fusion';
const checkpoints = [0, 5, 15, 30, 60, 120];
const cadences = ['idle', 'sparse', 'burst', '0.5/s', '2/s', '4/s', '8/s'] as const;
type Cadence = typeof cadences[number];
type Policy = 'accumulate' | 'equipment';
interface Profile {
  opening: number;
  holdings: 'new' | 'partial' | 'legacy-complete';
  autoRepair: boolean;
  cadence: Cadence;
  policy: Policy;
}
interface Trial {
  state: SaveData;
  equipmentSpent: number;
  duplicateCharges: number;
}

function initial(profile: Profile): Trial {
  let state = newGame(epoch);
  state.resources = profile.opening;
  state.station.autoRepair = profile.autoRepair;
  if (profile.holdings === 'partial') {
    state.upgrades = {radar: 2, scanner: 2, recycler: 2, cargo: 2};
    state.growth = {'guard-0': 1, 'guard-1': 1};
  }
  if (profile.holdings === 'legacy-complete') {
    state.upgrades = {radar: 5, scanner: 5, recycler: 5, cargo: 5};
    state.growth = Object.fromEntries(growthCatalog.map(entry => [entry.id, entry.costs.length]));
    state.collection = discoveries.map(entry => entry.id);
    state.seenDiscoveries = [...state.collection];
    state.discoveryAt = Object.fromEntries(state.collection.map(id => [id, epoch]));
  }
  state = restore(JSON.stringify(state), epoch);
  return {state, equipmentSpent: 0, duplicateCharges: 0};
}

function decide(trial: Trial, profile: Profile) {
  if (profile.policy !== 'equipment') return;
  const state = trial.state;
  const entry = (['scanner', 'recycler', 'radar', 'cargo'] as const)
    .find(id => state.upgrades[id] < 5 && cost(state, id) <= state.resources);
  if (!entry) return;
  const level = state.upgrades[entry];
  const next = upgrade(state, entry, level);
  if (upgrade(next, entry, level).resources !== next.resources) trial.duplicateCharges++;
  trial.equipmentSpent += state.resources - next.resources;
  trial.state = next;
}

function row(trial: Trial, profile: Profile, elapsedMs: number) {
  const state = trial.state;
  const balance = state.resources + (state.pendingReturn?.resources ?? 0);
  const assist = assistStatus(state);
  return {
    minutes: elapsedMs / 60000,
    opening: profile.opening,
    grossIncome: state.station.grossIncome,
    maintenance: state.station.repairSpent,
    equipment: trial.equipmentSpent,
    balance,
    integrity: state.station.integrity,
    cycles: state.cycles,
    discoveries: state.collection.length + (state.pendingReturn?.discoveries.length ?? 0),
    acceptedTaps: assist.accepted,
    enqueuedWorkMs: assist.enqueuedWorkMs,
    appliedWorkMs: assist.appliedWorkMs,
    pendingWorkMs: assist.pendingWorkMs,
    accountingDifference: balance - profile.opening - state.station.grossIncome +
      state.station.repairSpent + trial.equipmentSpent,
    workDifference: assist.enqueuedWorkMs - assist.appliedWorkMs - assist.pendingWorkMs,
    duplicateCharges: trial.duplicateCharges,
  };
}

function cadenceInterval(cadence: Cadence) {
  if (cadence === 'idle') return Infinity;
  if (cadence === 'sparse') return 10000;
  if (cadence === 'burst') return 300;
  return 1000 / Number(cadence.split('/')[0]);
}

function nextInput(cadence: Cadence, current: number, state: SaveData) {
  if (cadence === 'idle') return Infinity;
  const interval = cadenceInterval(cadence);
  const status = assistStatus(state);
  let next = current + interval;
  if (cadence === 'burst') {
    const offset = current % 30000;
    next = offset >= 1200 ? current - offset + 30000 : current + 300;
  }
  if (status.reason === 'night') {
    next = Math.max(next, current + 300000 - state.world.elapsedMs % 300000);
  }
  if (status.reason === 'limited') {
    next = Math.max(next, state.assist!.acceptedAt[0] - epoch + assistRules.windowMs);
  }
  if (status.reason === 'cooldown') {
    next = Math.max(next, state.assist!.acceptedAt.at(-1)! - epoch + assistRules.intervalMs);
  }
  if (cadence === 'burst') {
    const offset = next % 30000;
    return offset > 1200 ? next - offset + 30000 : next;
  }
  return Math.ceil(next / interval) * interval;
}

function simulate(profile: Profile) {
  const trial = initial(profile);
  const rows = [row(trial, profile, 0)];
  decide(trial, profile);
  let inputAt = profile.cadence === 'idle' ? Infinity : 0;
  let cursor = 0;
  for (const minute of checkpoints.slice(1)) {
    const target = minute * 60000;
    while (inputAt < target) {
      trial.state = tapAssist(trial.state, epoch + inputAt, trial.state.assist?.actionSeq ?? 0);
      cursor = inputAt;
      inputAt = nextInput(profile.cadence, cursor, trial.state);
    }
    trial.state = advance(trial.state, epoch + target);
    rows.push(row(trial, profile, target));
    decide(trial, profile);
  }
  const offline = [8, 24, 72].map(hours => {
    const trial = initial(profile);
    decide(trial, profile);
    let departure = 0;
    if (profile.cadence !== 'idle') {
      for (let index = 0; index < 5; index++) {
        departure = index * 300;
        trial.state = tapAssist(trial.state, epoch + departure, index);
      }
    }
    const capMinutes = tuning(trial.state).cargo / 60;
    trial.state = advance(trial.state, epoch + departure + hours * 3600000, true);
    const restored = restore(JSON.stringify(trial.state), trial.state.lastAt);
    if (restored.station.repairSpent !== trial.state.station.repairSpent ||
      restored.assist?.appliedWorkMs !== trial.state.assist?.appliedWorkMs) trial.duplicateCharges++;
    const claimed = claimReturn(trial.state);
    if (claimReturn(claimed).resources !== claimed.resources) trial.duplicateCharges++;
    return {...row(trial, profile, hours * 3600000), hours,
      effectiveMinutes: Math.min(hours * 60, capMinutes),
      protectedNights: trial.state.station.protectedNights,
      pendingReturn: trial.state.pendingReturn?.resources ?? 0};
  });
  return {profile, rows, offline};
}

const results = [];
for (const opening of [120, 5000, 27049, 50000]) {
  const holdings = opening >= 27049 ? 'legacy-complete' : opening >= 5000 ? 'partial' : 'new';
  for (const autoRepair of [true, false]) for (const cadence of cadences)
    for (const policy of ['accumulate', 'equipment'] as const) {
      results.push(simulate({opening, holdings, autoRepair, cadence, policy}));
    }
}

const rows = results.flatMap(result => [...result.rows, ...result.offline]);
const checks = {
  profiles: results.length,
  rows: rows.length,
  negativeBalances: rows.filter(row => row.balance < 0).length,
  accountingErrors: rows.filter(row => Math.abs(row.accountingDifference) > .00001).length,
  workErrors: rows.filter(row => Math.abs(row.workDifference) > .00001 ||
    row.appliedWorkMs > row.enqueuedWorkMs + .00001 || row.pendingWorkMs > assistRules.capacityMs).length,
  repeatedFeesOrWork: rows.reduce((sum, row) => sum + row.duplicateCharges, 0),
  maintenanceOverBudget: rows.filter(row => row.maintenance > row.grossIncome * .3 + .00001).length,
  rollingWorkEnvelopeErrors: results.flatMap(result => result.rows)
    .filter(row => row.enqueuedWorkMs > (row.minutes * 60000 / assistRules.windowMs + 1) * 3000).length,
};
if (Object.entries(checks).some(([name, value]) => !['profiles', 'rows'].includes(name) && value !== 0)) {
  throw new Error(JSON.stringify(checks));
}
const commit = execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim();
const dirty = Boolean(execFileSync('git', ['status', '--porcelain', '--', 'src', 'scripts/simulate_fusion_assist.ts'], {encoding: 'utf8'}).trim());
const sourceFiles = Object.fromEntries(['src/game/engine.ts', 'src/game/station.ts', 'src/game/assist.ts',
  'scripts/simulate_fusion_assist.ts'].map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
const report = {
  at: new Date().toISOString(), commit, dirty, sourceFiles, rules: assistRules, checks,
  scope: 'Actual common engine income, finite tap work, equipment and maintenance. Artifact restoration and project content are evaluated separately.',
  method: 'Event-driven input cadence. Known-rejected intervening cooldown/window/night inputs are skipped. Literal rapid-input unit tests cover rejection; all accepted inputs use tapAssist and all income uses chronological advance. Offline cases queue one actual five-tap departure burst for every active policy, then accept no further input.',
  checkpoints, results,
};
mkdirSync(output, {recursive: true});
writeFileSync(`${output}/assist-economy.json`, JSON.stringify(report, null, 2) + '\n');
const columns = ['opening', 'holdings', 'autoRepair', 'cadence', 'policy', 'minutes', 'grossIncome',
  'maintenance', 'equipment', 'balance', 'integrity', 'cycles', 'acceptedTaps', 'enqueuedWorkMs',
  'appliedWorkMs', 'pendingWorkMs', 'accountingDifference'];
const csv = results.flatMap(result => [...result.rows, ...result.offline].map(row => {
  const values = {...result.profile, ...row};
  return columns.map(column => String(values[column as keyof typeof values] ?? '')).join(',');
}));
writeFileSync(`${output}/assist-economy.csv`, columns.join(',') + '\n' + csv.join('\n') + '\n');
const examples = results.filter(result => result.profile.autoRepair && result.profile.policy === 'accumulate' &&
  [120, 27049].includes(result.profile.opening) && ['idle', 'burst', '8/s'].includes(result.profile.cadence));
const lines = ['# 点击助力与真实收入验证', '',
  `运行源码 ${commit}。${checks.profiles}组、${checks.rows}行。`, '',
  '范围为自动／点击的实际工作、设备支出、维修和离线归航。奇物整理、工程内容与长期吸引力另行验证。', '',
  '| 开局 | 操作 | 分钟 | 毛收入 | 维修 | 余额 | 已应用助力ms |',
  '| --- | --- | --- | --- | --- | --- | --- |'];
for (const example of examples) for (const row of example.rows) {
  lines.push(`| ${example.profile.opening} | ${example.profile.cadence} | ${row.minutes} | ${row.grossIncome} | ${row.maintenance} | ${row.balance} | ${Math.round(row.appliedWorkMs)} |`);
}
lines.push('', '检查结果', '', '```json', JSON.stringify(checks, null, 2), '```', '');
writeFileSync(`${output}/assist-economy.md`, lines.join('\n'));
process.stdout.write(JSON.stringify({output, checks}) + '\n');
