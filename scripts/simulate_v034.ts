import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {advance, claimReturn, newGame, restore, tuning, type SaveData} from '../src/game/engine';
import {buyGrowth, growthCatalog} from '../src/game/growth';
import {explorationFactor} from '../src/game/station';
import {setWorldSlot} from '../src/game/world';
import {discoveries} from '../src/content/catalog';
import {
  legacyRestorationLedger, purchaseRestoration, researchAvailability, restorationPrices,
  startCandidateStudy, studyCandidates, type RestorationLedger, type RestorationId,
} from '../src/review/v034-budget';

const epoch = 1800000000000;
const output = process.env.OUTPUT_DIR ?? 'artifacts/v034-refine';
const minutes = [0, 15, 30, 60, 120];
const balances = [120, 5000, 27049, 50000];
const policies = ['accumulate', 'restoration', 'security', 'research'] as const;
type Policy = typeof policies[number];
type Damage = 'low' | 'medium' | 'high';
interface Profile {
  opening: number;
  holdings: 'new' | 'legacy-complete';
  damage: Damage;
  autoRepair: boolean;
  policy: Policy;
}
interface Trial {
  save: SaveData;
  restoration: RestorationLedger;
  construction: number;
  insufficient: number;
  duplicateCharges: number;
}

function initial(profile: Profile): Trial {
  let save = newGame(epoch);
  save.resources = profile.opening;
  if (profile.holdings === 'legacy-complete') {
    save.collection = discoveries.map(record => record.id);
    save.seenDiscoveries = [...save.collection];
    save.discoveryAt = Object.fromEntries(save.collection.map(id => [id, epoch]));
    save.upgrades = {radar: 5, scanner: 5, recycler: 5, cargo: 5};
    save.growth = Object.fromEntries(growthCatalog.map(entry => [entry.id, entry.costs.length]));
  } else if (profile.damage === 'low') {
    // This profile begins with already-owned strong security. Its purchase is not invented income.
    save.growth = {'guard-0': 3, 'guard-1': 3};
  }
  save = restore(JSON.stringify(save), epoch);
  if (profile.damage === 'medium') save = setWorldSlot(save, 1, null);
  if (profile.damage === 'high') save = setWorldSlot(setWorldSlot(save, 0, null), 1, null);
  save.station.autoRepair = profile.autoRepair;
  return {save, restoration: legacyRestorationLedger(save.collection), construction: 0, insufficient: 0, duplicateCharges: 0};
}

function decide(trial: Trial, profile: Profile) {
  const save = trial.save;
  const reserve = profile.holdings === 'legacy-complete' ? 500 : 120;
  if (profile.policy === 'restoration') {
    const id = (Object.keys(restorationPrices) as RestorationId[]).find(id =>
      save.collection.includes(id) && trial.restoration.conditions[id] !== 'stabilized');
    if (!id) return;
    const condition = trial.restoration.conditions[id] ?? 'found';
    const price = restorationPrices[id][condition === 'found' ? 'clean' : 'stabilize'];
    if (save.resources - price < reserve) {trial.insufficient++; return;}
    const next = purchaseRestoration(save, trial.restoration, id, condition);
    const duplicate = purchaseRestoration(next.save, next.ledger, id, condition);
    if (duplicate.save.resources !== next.save.resources) trial.duplicateCharges++;
    trial.save = next.save;
    trial.restoration = next.ledger;
  }
  if (profile.policy === 'security') {
    const entry = ['guard-0', 'guard-1', 'repair-bay', 'dock', 'drive', 'light', 'receiver']
      .map(id => growthCatalog.find(entry => entry.id === id)!)
      .find(entry => (save.growth[entry.id] ?? 0) < entry.costs.length);
    if (!entry) return;
    const level = save.growth[entry.id] ?? 0;
    if (save.resources - entry.costs[level] < reserve) {trial.insufficient++; return;}
    let next = buyGrowth(save, entry.id, level);
    if (buyGrowth(next, entry.id, level).resources !== next.resources) trial.duplicateCharges++;
    trial.construction += save.resources - next.resources;
    // The simulated player enables the purchased devices at the next legal daytime decision.
    next = setWorldSlot(setWorldSlot(next, 0, 'beacon'), 1, 'gate');
    trial.save = next;
  }
  if (profile.policy === 'research' && !save.research.active) {
    const hasArtifact = save.collection.some(id => Object.hasOwn(restorationPrices, id));
    const id = hasArtifact && save.resources >= 20000 ? 'deep'
      : hasArtifact && save.resources >= 5000 ? 'study' : 'field';
    const project = studyCandidates.find(project => project.id === id)!;
    if (save.resources - project.price < reserve) {trial.insufficient++; return;}
    const next = startCandidateStudy(save, id, null);
    if (startCandidateStudy(next, id, null).resources !== next.resources) trial.duplicateCharges++;
    trial.save = next;
  }
}

function report(trial: Trial, profile: Profile, minute: number) {
  const save = trial.save;
  const balance = save.resources + (save.pendingReturn?.resources ?? 0);
  const research = researchAvailability(save);
  const net = save.station.grossIncome - save.station.repairSpent - trial.restoration.cleaning -
    trial.restoration.stabilization - trial.construction - save.research.spent;
  return {
    minute, opening: profile.opening, grossIncome: save.station.grossIncome,
    maintenance: save.station.repairSpent, repairs: save.station.repairCount,
    cleaning: trial.restoration.cleaning, stabilization: trial.restoration.stabilization,
    construction: trial.construction, research: save.research.spent, net, balance,
    integrity: save.station.integrity, efficiency: explorationFactor(save),
    actualDamage: save.station.damageTotal, actualInterceptions: save.world.lastReport?.intercepted ?? 0,
    observedRecords: research.observedRecords, undiscoveredRecords: research.undiscoveredRecords,
    researchMode: research.mode, completedTasks: save.research.completed,
    cycles: save.cycles, localSurveys: save.surveyCount, insufficient: trial.insufficient,
    duplicateCharges: trial.duplicateCharges,
    accountingDifference: balance - profile.opening - net,
    cargoCapMinutes: tuning(save).cargo / 60,
  };
}

const results = [];
for (const opening of balances) for (const holdings of ['new', 'legacy-complete'] as const)
  for (const damage of ['low', 'medium', 'high'] as const) for (const autoRepair of [true, false])
    for (const policy of policies) {
      const profile = {opening, holdings, damage, autoRepair, policy};
      const trial = initial(profile);
      const rows = [];
      for (let second = 0; second <= 7200; second += 15) {
        if (second > 0) trial.save = advance(trial.save, epoch + second * 1000);
        if (minutes.includes(second / 60)) rows.push(report(trial, profile, second / 60));
        if (second < 7200) decide(trial, profile);
      }
      const offline = [8, 24].map(hours => {
        const trial = initial(profile);
        // One voluntary pre-departure decision. Offline jobs never automatically renew.
        decide(trial, profile);
        const capMinutes = tuning(trial.save).cargo / 60;
        trial.save = advance(trial.save, epoch + hours * 3600000, true);
        const before = trial.save.station.repairSpent;
        const replay = restore(JSON.stringify(trial.save), trial.save.lastAt);
        const claimed = claimReturn(trial.save);
        const duplicate = claimReturn(claimed);
        if (replay.station.repairSpent !== before || duplicate.resources !== claimed.resources) trial.duplicateCharges++;
        return {...report(trial, profile, hours * 60), hours,
          effectiveMinutes: Math.min(hours * 60, capMinutes),
          protectedNights: trial.save.station.protectedNights,
          pendingNet: trial.save.pendingReturn?.resources ?? 0};
      });
      results.push({profile, rows, offline});
    }

const allRows = results.flatMap(result => [...result.rows, ...result.offline]);
const checks = {
  profiles: results.length,
  rows: allRows.length,
  negativeBalances: allRows.filter(row => row.balance < 0).length,
  accountingErrors: allRows.filter(row => Math.abs(row.accountingDifference) > .00001).length,
  duplicateCharges: allRows.reduce((sum, row) => sum + row.duplicateCharges, 0),
  maintenanceOverIncomeBudget: allRows.filter(row => row.maintenance > row.grossIncome * .3).length,
  firstHourAccumulationDeficits: results.filter(result => result.profile.policy === 'accumulate' &&
    result.rows.find(row => row.minute === 60)!.net < 0).length,
  legacyRestorationCharges: results.filter(result => result.profile.holdings === 'legacy-complete')
    .flatMap(result => [...result.rows, ...result.offline])
    .filter(row => row.cleaning + row.stabilization > 0).length,
  floorEfficiency: Math.min(...allRows.map(row => row.efficiency)),
};
const method = '192组隔离候选使用未改动的正式引擎，在线15秒步进。低/中/高为初始安保暴露，偏安保策略后续会主动启用已买设备。完整旧档保留全部升级和已稳定藏品。清理修补价格、科研调价仅在预测中生效，科研时长和增效调用现有任务。输出真实探索、地表采样和已发现首星记录，不生成签收事实。离线各从初始档开始，允许一次出发前自愿决策，不自动续费，按真实货舱截断。余额含未领取净归航，额外核验重复恢复与领取。';
const candidateHash = createHash('sha256');
for (const path of ['src/review/v034-budget.ts', 'scripts/simulate_v034.ts']) candidateHash.update(readFileSync(path));
mkdirSync(output, {recursive: true});
writeFileSync(`${output}/economy.json`, JSON.stringify({
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {encoding: 'utf8'}).trim(),
  sourceScope: 'Unchanged formal game engine baseline. Candidate source content is recorded separately.',
  candidateSourceSha256: candidateHash.digest('hex'),
  status: 'Candidate prices and design simulation, pending user approval', method, checks,
  prices: {restoration: restorationPrices, research: studyCandidates}, results,
}, null, 2) + '\n');
const flattened = results.flatMap(result => [...result.rows, ...result.offline].map(row => ({...result.profile, ...row})));
const columns = ['opening', 'holdings', 'damage', 'autoRepair', 'policy', 'minute', 'grossIncome', 'maintenance', 'cleaning', 'stabilization', 'construction', 'research', 'net', 'balance', 'integrity', 'efficiency', 'actualDamage', 'observedRecords', 'undiscoveredRecords', 'completedTasks', 'cycles', 'localSurveys', 'insufficient', 'duplicateCharges', 'cargoCapMinutes'];
writeFileSync(`${output}/economy.csv`, columns.join(',') + '\n' + flattened.map(row =>
  columns.map(column => String(row[column as keyof typeof row] ?? '')).join(',')).join('\n') + '\n');
const policyNames = {accumulate: '保留积累', restoration: '偏奇物整理', security: '偏基地安保', research: '偏现场科研'};
let markdown = '# V0.3.4 零件经济候选验证\n\n' + method + '\n\n';
markdown += '## 自动核对\n\n```json\n' + JSON.stringify(checks, null, 2) + '\n```\n\n';
markdown += '候选清洁20–60、修补80–220。收据40＋120，一次完成。既有收藏视为已稳定且保留展示等级。研究180/900/2400，维持真实5/15/30分钟和10/25/40%任务期间探索采样增效。首星收齐后明确为复核与增效，记录真实采样量，不承诺新奇物。维修沿用实际3→2→1零件/点与收入30%预算，工程沿用既有有限价目与真实效果。所有主动消费为模拟玩家选择。\n\n';
for (const result of results.filter(result => [120, 27049].includes(result.profile.opening) &&
  result.profile.damage === 'medium' && result.profile.autoRepair &&
  (result.profile.opening === 120 && result.profile.holdings === 'new' ||
    result.profile.opening === 27049 && result.profile.holdings === 'legacy-complete'))) {
  markdown += `## ${result.profile.opening}零件 · ${result.profile.holdings === 'new' ? '新档' : '完整旧权益'} · ${policyNames[result.profile.policy]}\n\n`;
  markdown += '| 分钟 | 毛收入 | 维修 | 清洁/修补 | 工程 | 科研 | 余额 | 完整度 | 真记录/未发现 | 不足/重扣 |\n| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n';
  for (const row of [...result.rows, ...result.offline]) markdown += `| ${row.minute} | ${row.grossIncome} | ${row.maintenance} | ${row.cleaning}/${row.stabilization} | ${row.construction} | ${row.research} | ${row.balance} | ${row.integrity} | ${row.observedRecords}/${row.undiscoveredRecords} | ${row.insufficient}/${row.duplicateCharges} |\n`;
  markdown += '\n';
}
markdown += '## 冻结门槛\n\n数值仍为候选。新手保留120零件、旧档保留500零件是模拟策略的自愿预算，游戏不强制花费。完整旧档货舱可达570分钟，因此8小时和24小时收益可不同，24小时仍只按真实570分钟结算。高余额允许继续保留。其余五件修复仅定义费用和个性差异，未制作正式存档消费。\n';
writeFileSync(`${output}/economy.md`, markdown);
console.log(JSON.stringify(checks));
if (checks.negativeBalances || checks.accountingErrors || checks.duplicateCharges ||
  checks.maintenanceOverIncomeBudget || checks.firstHourAccumulationDeficits || checks.legacyRestorationCharges) process.exitCode = 1;
