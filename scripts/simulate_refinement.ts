import {mkdirSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {newGame, tuning, cost, type UpgradeId} from '../src/game/engine';
import {discoveries} from '../src/content/catalog';
import {growthCatalog, growthLevel} from '../src/game/growth';
import {advanceFusion, createFusion, reduceFusion, restoreFusion} from '../src/fusion/domain';
import {refinementView, sortingRules} from '../src/fusion/progression';
import type {FusionAction, FusionSave} from '../src/fusion/contracts';

const epoch = 1800000000000;
const horizons = [0, 5, 15, 30, 60, 120];
const checks = {negative: 0, accounting: 0, duplicateFee: 0, legacyRights: 0, falseSignature: 0, offlineCap: 0, emptyTargetFee: 0};
type Budget = {equipment: number; security: number; restoration: number; abilities: number; region: number; studies: number; refunded: number};
const rows: Record<string, unknown>[] = [];
const offlineRows: Record<string, unknown>[] = [];
const comparisons: Record<string, unknown>[] = [];

function opening(initial: number, scanner?: number) {
  const legacy = initial >= 27049 || scanner !== undefined;
  const game = newGame(epoch);
  game.resources = initial;
  if (legacy) {
    game.collection = discoveries.map(entry => entry.id);
    game.seenDiscoveries = [...game.collection];
    game.discoveryAt = Object.fromEntries(game.collection.map(id => [id, epoch]));
    game.upgrades = {radar: 5, scanner: scanner ?? 5, recycler: 5, cargo: 5};
    game.growth = Object.fromEntries(growthCatalog.map(entry => [entry.id, entry.costs.length]));
  }
  const state = legacy ? createFusion(epoch, JSON.stringify(game)) : createFusion(epoch);
  state.game.resources = initial;
  return state;
}

function observeMarker(state: FusionSave) {
  if (state.receipt.evidenceIds.includes('field-pipe-scan')) return state;
  const phase = state.game.world.elapsedMs % 300000;
  const fraction = state.game.cycleMs / tuning(state.game).scanner;
  if (phase < 240000 && fraction >= .4 && fraction < .52) {
    state = reduceFusion(state, {type: 'observe', id: 'field-pipe-scan', at: state.game.lastAt,
      source: 'parcel/returns-plain/pipe-marker-p03'}, state.game.lastAt).state;
    state = advanceFusion(state, state.game.lastAt);
  }
  return state;
}

function verify(state: FusionSave, initial: number, budget: Budget) {
  const held = state.game.pendingReturn?.resources ?? 0;
  const spent = budget.equipment + budget.security + budget.restoration + budget.abilities + budget.region + budget.studies;
  const expected = initial + state.game.station.grossIncome - state.game.station.repairSpent - spent + budget.refunded;
  if (state.game.resources < 0 || held < 0) checks.negative++;
  if (Math.abs(state.game.resources + held - expected) > 1e-6) checks.accounting++;
  if (state.receipt.verifiedEvidenceIds.includes('signature')) checks.falseSignature++;
  for (const payment of state.progression.payments) {
    if (state.progression.payments.filter(candidate => candidate.id === payment.id).length !== 1) checks.duplicateFee++;
  }
  for (const entry of Object.values(refinementView(state).abilities)) {
    if (!entry.hasTarget && entry.level < 2) {
      const rejected = reduceFusion(state, entry.action, state.game.lastAt);
      if (rejected.result.ok || rejected.state.game.resources !== state.game.resources) checks.emptyTargetFee++;
    }
  }
}

for (const initial of [120, 5000, 27049, 50000]) for (const active of [false, true]) {
  let state = opening(initial);
  const legacy = initial >= 27049;
  const oldGrowth = structuredClone(state.game.growth);
  const budget: Budget = {equipment: 0, security: 0, restoration: 0, abilities: 0, region: 0, studies: 0, refunded: 0};
  let departure: FusionSave | undefined;
  let departureBudget: Budget | undefined;
  function act(action: FusionAction, category?: keyof Budget) {
    const before = state.game.resources;
    const reduced = reduceFusion(state, action, state.game.lastAt);
    state = reduced.state;
    if (reduced.result.ok && category) budget[category] += before - state.game.resources;
    return reduced.result.ok;
  }
  function snapshot(minutes: number) {
    verify(state, initial, budget);
    if (legacy && (state.receipt.transactions.length || JSON.stringify(state.game.growth) !== JSON.stringify(oldGrowth))) checks.legacyRights++;
    rows.push({initial, legacy, active, minutes, gross: state.game.station.grossIncome,
      maintenance: state.game.station.repairSpent, ...budget, balance: state.game.resources,
      held: state.game.pendingReturn?.resources ?? 0, integrity: state.game.station.integrity,
      scanner: state.game.upgrades.scanner, recycler: state.game.upgrades.recycler,
      receipt: state.progression.abilities.receipt, tape: state.progression.abilities.tape,
      phase: state.progression.sorting.phase, stage: state.progression.sorting.stage,
      work: Number(state.progression.sorting.workDone.toFixed(3)),
      clearedAtMinutes: state.progression.sorting.clearedAt === null ? null
        : Number(((state.progression.sorting.clearedAt - epoch) / 60000).toFixed(3)),
      studiesCompleted: refinementView(state).sorting.researchCompleted,
      facts: state.progression.sorting.facts.map(fact => fact.id).join('|'),
      assistAppliedMs: Math.round(state.game.assist?.appliedWorkMs ?? 0)});
  }
  snapshot(0);
  for (let second = 1; second <= 7200; second++) {
    state = advanceFusion(state, epoch + second * 1000);
    if (active) act({type: 'tap'});
    state = observeMarker(state);
    if (!legacy && second <= 900 && second % 10 === 0) {
      const next = (['scanner', 'recycler', 'radar', 'cargo'] as UpgradeId[]).find(id =>
        state.game.upgrades[id] < 5 && state.game.resources >= cost(state.game, id) + 120);
      if (next) act({type: 'upgrade', id: next, expected: state.game.upgrades[next]}, 'equipment');
      const guard = ['guard-0', 'guard-1', 'repair-bay'].find(id =>
        growthLevel(state.game, id) < 1 && state.game.resources >= growthCatalog.find(entry => entry.id === id)!.costs[0] + 120);
      if (guard) act({type: 'growth', id: guard, expected: 0}, 'security');
    }
    if (legacy || second > 900) {
      const receipt = state.receipt;
      if (state.game.collection.includes('receipt') && !receipt.activeAction) {
        const kind = receipt.stage === 'buried' ? 'excavate' : receipt.condition === 'found' ? 'clean'
          : receipt.condition === 'clean' ? 'repair' : null;
        if (kind && state.game.resources >= (kind === 'clean' ? 40 : kind === 'repair' ? 120 : 0) + 120) {
          act({type: 'paper', kind}, 'restoration');
        }
      }
      const tape = state.curios.tape;
      if (tape && !tape.action && tape.condition !== 'stabilized') {
        const kind = tape.condition === 'found' ? 'clean' : 'repair';
        if (state.game.resources >= (kind === 'clean' ? 30 : 100) + 120) act({type: 'curio', id: 'tape', kind}, 'restoration');
      }
      // Buy first abilities before construction. The second tier is bought after the frozen build quote.
      for (const id of ['tape', 'receipt'] as const) {
        const view = refinementView(state).abilities[id];
        if (view.enabled && view.nextPrice !== null && (view.level === 0 || state.progression.sorting.paidCost > 0)
          && state.game.resources >= view.nextPrice + 120) act(view.action, 'abilities');
      }
      let view = refinementView(state);
      if (view.mainAction.enabled && view.sorting.phase !== 'cleared' && state.game.resources >= view.mainAction.price + 120) {
        // The node remains available without abilities. This policy chooses both inexpensive first tiers.
        const readyToBuild = view.sorting.phase !== 'surveyed'
          || (state.progression.abilities.receipt >= 1 && state.progression.abilities.tape >= 1);
        if (readyToBuild) act(view.mainAction.action, view.mainAction.price ? 'region' : undefined);
      }
      view = refinementView(state);
      if (view.compareAction.enabled) act(view.compareAction.action);
      if (view.researchAction.enabled && view.researchAction.price > 0 && state.game.resources >= view.researchAction.price + 120) {
        act(view.researchAction.action, 'studies');
      }
      if (!departure && state.progression.sorting.phase === 'working' && state.progression.sorting.stage === 'hauling') {
        departure = structuredClone(state); departureBudget = {...budget};
      }
    }
    if (horizons.includes(second / 60)) snapshot(second / 60);
  }
  if (!departure || !departureBudget) throw new Error(`No funded departure for ${initial}/${active}`);
  for (const hours of [8, 24, 72]) {
    const arrivedAt = departure.game.lastAt + hours * 3600000;
    const offline = advanceFusion(departure, arrivedAt, true);
    verify(offline, initial, departureBudget);
    const restored = restoreFusion(JSON.stringify(offline), arrivedAt);
    const claimed = reduceFusion(restored, {type: 'claim'}, arrivedAt).state;
    const duplicate = reduceFusion(claimed, {type: 'claim'}, arrivedAt);
    if (duplicate.result.ok || duplicate.state.game.resources !== claimed.game.resources) checks.duplicateFee++;
    const fundedEnd = departure.game.lastAt + Math.min(hours * 3600000, tuning(departure.game).cargo * 1000);
    if (offline.progression.sorting.facts.some(fact => fact.at > fundedEnd)) checks.offlineCap++;
    offlineRows.push({initial, legacy, active, hours, departureAtMinutes: (departure.game.lastAt - epoch) / 60000,
      fundedHours: Math.min(hours, tuning(departure.game).cargo / 3600),
      gross: offline.game.station.grossIncome - departure.game.station.grossIncome,
      maintenance: offline.game.station.repairSpent - departure.game.station.repairSpent,
      protectedNights: offline.game.station.protectedNights - departure.game.station.protectedNights,
      balance: offline.game.resources, held: offline.game.pendingReturn?.resources ?? 0,
      afterClaim: claimed.game.resources, integrity: offline.game.station.integrity,
      phase: offline.progression.sorting.phase, facts: offline.progression.sorting.facts.length,
      duplicateClaimRejected: !duplicate.result.ok});
  }
}

for (const scanner of [0, 5]) for (const receipt of [0, 1, 2] as const) {
  const tape = receipt;
  let state = opening(27049, scanner);
  state.game.cycleMs = tuning(state.game).scanner * .44;
  state = observeMarker(state);
  for (const id of ['receipt', 'tape'] as const) for (let expected = 0; expected < receipt; expected++) {
    state = reduceFusion(state, {type: 'ability', id, expected}, state.game.lastAt).state;
  }
  const started = state.game.lastAt;
  for (let elapsed = 0; elapsed <= 400000; elapsed += 250) {
    state = advanceFusion(state, started + elapsed);
    const view = refinementView(state);
    if (view.mainAction.enabled && view.sorting.phase !== 'cleared') {
      state = reduceFusion(state, view.mainAction.action, state.game.lastAt).state;
    }
    if (refinementView(state).compareAction.enabled) {
      state = reduceFusion(state, refinementView(state).compareAction.action, state.game.lastAt).state;
    }
    if (state.progression.sorting.phase === 'cleared') break;
  }
  comparisons.push({scanner, receipt, tape, input: 'manual comparison immediately when available',
    workRounds: sortingRules.surveyWork + sortingRules.buildWork + sortingRules.haulingWork
      + (receipt ? 3 : 6) + (tape === 2 ? 5 : 7),
    completionSeconds: (state.progression.sorting.clearedAt! - started) / 1000,
    buildCost: state.progression.sorting.paidCost,
    abilityCost: state.progression.payments.filter(payment => payment.id.startsWith('ability/')).reduce((sum, payment) => sum + payment.amount, 0),
    ordinaryGross: state.game.station.grossIncome, completed: state.progression.sorting.phase === 'cleared'});
}

const report = {
  at: new Date().toISOString(), sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(),
  sourceState: 'working tree, rerun after source freeze for final SHA', checks,
  assumptions: [
    'Actual unified domain actions and original income/maintenance engine. Regional work creates no additional ordinary currency.',
    'Profiles120/5000 start without permanent rights. Profiles27049/50000 retain all old collection/equipment/growth and free physical restoration rights.',
    'New players invest in equipment and one tier of both guards/repair bay for15minutes, retaining120parts. Equipment is frozen after15minutes for comparison.',
    'Active profiles submit one assist per second. Existing5per12s cap applies. Passive profiles submit no assists.',
    'P03 is observed only during an actual daytime scan. Physical cleaning/repair uses original prices/durations.',
    'After15minutes, cheap receiptI/tapeI precede construction. TierII follows construction only while its real obstacle remains. Finished verification and cleared nodes stop new ability charges. Frozen build cost is2160. Three actual study records cost90each and require2ordinary rounds.',
    'Offline scenarios depart independently from the first actual hauling stage. No paid commands are invented offline. One claim and a duplicate claim are tested.',
    'Comparison rows use both abilities at matching levels before construction. ReceiptI is actively compared, whereasII performs the same evidence comparison automatically.',
    'Model scope covers receipt/tape abilities, one sorting node and three bounded observation studies. Long-term content and entertainment value remain for subsequent review.',
  ],
  finiteCosts: {unassistedBranch: 2400, abilityTotal: 1860, buildAfterTapeI: 2160, buildAfterTapeII: 1920,
    studyTotal: 270, practicalTotal: 4290, maximumDiscountTotal: 4050, noDiscountTotal: 4530},
  limits: [
    '老档5分钟检查点已完成本批两件能力、首节点与三份研究，新增有限可消费余额为0。此内容量只覆盖首节点样板。',
    '27,049旧档按先Ⅰ档施工策略合计支付4,290，保留22,759初始余额，收入继续正常增加。资金无需清零。',
    '本批能力不增加普通零件产量。价值来自工程实耗降低、21→18→16轮的实际清障工作及真实来源记录。',
    '新手按此预算完成节点时保留Ⅰ档，两项尚无目标的Ⅱ档研究暂停收费，少支出1320。已有付费能力全部保留。',
    '中长期区域成长需要后续经审核的新机关、行动与内容。本批没有为尚未制作的深仓收取费用。',
  ],
  rows, comparisons, offlineRows,
};
const folder = 'artifacts/refinement';
mkdirSync(folder, {recursive: true});
writeFileSync(`${folder}/economy.json`, JSON.stringify(report, null, 2) + '\n');
function csv(name: string, data: Record<string, unknown>[]) {
  const fields = Object.keys(data[0]);
  writeFileSync(`${folder}/${name}.csv`, [fields.join(','), ...data.map(row => fields.map(field => JSON.stringify(row[field])).join(','))].join('\n') + '\n');
}
csv('economy', rows);
csv('ability-comparison', comparisons);
csv('offline', offlineRows);
writeFileSync(`${folder}/economy.md`, '# 首星本体能力与卡纸支线实际模型\n\n'
  + report.assumptions.map(line => `- ${line}`).join('\n') + '\n\n'
  + '| 初始 | 点击 | 分钟 | 毛收入 | 原设备与安保 | 整理 | 本体 | 区域 | 研究 | 维修 | 余额 | 状态 |\n'
  + '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n'
  + rows.map(row => `| ${row.initial} | ${row.active} | ${row.minutes} | ${row.gross} | ${Number(row.equipment) + Number(row.security)} | ${row.restoration} | ${row.abilities} | ${row.region} | ${row.studies} | ${row.maintenance} | ${row.balance} | ${row.phase} |`).join('\n')
  + '\n\n费用方案以开工时胶带等级快照计算。先Ⅰ档开工再升Ⅱ档为4290，开工前完成Ⅱ档为4050，均包含三份真实研究270。docs29原4020样板未包含这三份后续研究。无能力也能支付2400进入支线，基础工作共21轮。\n\n'
  + report.limits.map(line => `- ${line}`).join('\n') + '\n\n'
  + `账目与存档检查 ${JSON.stringify(checks)}。本报告为模型模拟，手机动画与可玩价值另行审核。\n`);
console.log(JSON.stringify({checks, rows: rows.length, offlineRows: offlineRows.length, comparisons}));
if (Object.values(checks).some(Boolean) || comparisons.some(row => !row.completed)) process.exitCode = 1;
