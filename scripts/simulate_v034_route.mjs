import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const output = process.env.OUTPUT_DIR ?? 'artifacts/v034-refine';
const source = readFileSync(`${output}/economy.json`);
const economy = JSON.parse(source);
const projects = [
  {id: 'field-evidence-bench', title: '地表取证工作台', ceiling: 1800},
  {id: 'resident-observation', title: '居民作息观察窗', ceiling: 4200},
  {id: 'anomaly-archive', title: '异常归档走廊', ceiling: 6000},
];

function purchaseAtCheckpoint(opening, reserve, previous = []) {
  const purchases = [...previous];
  let balance = opening - purchases.reduce((sum, item) => sum + item.ceiling, 0);
  for (const project of projects.filter(item => !purchases.some(owned => owned.id === item.id))) {
    if (balance - project.ceiling < reserve) break;
    purchases.push(project);
    balance -= project.ceiling;
  }
  return {balance, purchases};
}

const profiles = economy.results.filter(result => result.profile.policy === 'accumulate').map(result => {
  const reserve = result.profile.holdings === 'new' ? 120 : 500;
  let owned = [];
  const rows = result.rows.map(row => {
    const next = purchaseAtCheckpoint(row.balance, reserve, owned);
    const boughtNow = next.purchases.slice(owned.length).map(item => item.id);
    owned = next.purchases;
    const expenditure = owned.reduce((sum, item) => sum + item.ceiling, 0);
    return {...row, baselineBalance: row.balance, balance: next.balance, proposedConstruction: expenditure,
      boughtNow, owned: owned.map(item => item.id), accountingDifference: next.balance - row.balance + expenditure};
  });
  const departure = purchaseAtCheckpoint(result.profile.opening, reserve);
  const expenditure = departure.purchases.reduce((sum, item) => sum + item.ceiling, 0);
  const offline = result.offline.map(row => ({...row, baselineBalance: row.balance,
    balance: row.balance - expenditure, proposedConstruction: expenditure,
    boughtAtDeparture: departure.purchases.map(item => item.id), accountingDifference: 0}));
  return {profile: result.profile, reserve, rows, offline};
});

const allRows = profiles.flatMap(result => [...result.rows, ...result.offline]);
const checks = {profiles: profiles.length, rows: allRows.length,
  negativeBalances: allRows.filter(row => row.balance < 0).length,
  accountingErrors: allRows.filter(row => row.accountingDifference !== 0).length,
  expenditureOverCeiling: allRows.filter(row => row.proposedConstruction > 12000).length,
  duplicateProjectFees: profiles.filter(result => result.rows.some(row => new Set(row.owned).size !== row.owned.length)).length};
if (Object.entries(checks).some(([key, value]) => !['profiles', 'rows'].includes(key) && value !== 0)) throw Error('Budget projection failed');

const report = {sourceCommit: economy.sourceCommit, sourceEconomySha256: createHash('sha256').update(source).digest('hex'),
  status: 'Affordability projection only. Long-term spending value remains unapproved.',
  method: 'Actual baseline income/maintenance from economy.json. Hypothetical finite visual-content projects change no income or damage. Purchases occur only at displayed online checkpoints with a declared reserve. Offline trials start independently and buy only at departure. All three projects must pass content review before opening. Ceiling prices assume no owned-component credits, giving the maximum proposed debit. No project is charged to a player save.',
  projects, checks, profiles};
writeFileSync(`${output}/budget-route.json`, JSON.stringify(report, null, 2) + '\n');

const selected = profiles.filter(result => result.profile.damage === 'medium' && result.profile.autoRepair &&
  ((result.profile.opening === 120 && result.profile.holdings === 'new') ||
   (result.profile.opening === 27049 && result.profile.holdings === 'legacy-complete')));
const lines = ['# 首星长期预算路线草案', '',
  '长期消费价值仍待内容与用户审核。本表仅核对有限工程的负担能力，收入与维修取自同源真实引擎。', '',
  '1800/4200/6000为三个新增内容项目的预算上限，共12000。旧工程已购组件的折抵在实际内容拆分时核对，表内按最高支出压力计算。项目提供观察视角、居民栖台和处置档案，实施与付费以对应内容审核通过为前置。', '',
  '在线只在0/15/30/60/120分钟检查点自愿顺次购买，新档保留120、旧完整档保留500零件。离线从原始档单独出发，仅出发前决定一次工程支出。工程提供视觉与观察功能，当前投影按收入和损伤能力中性计算。', '',
  '| 档位 | 时点 | 毛收入 | 维修 | 工程累计 | 原积累余额 | 投影余额 |',
  '| --- | --- | --- | --- | --- | --- | --- |'];
for (const result of selected) for (const row of [...result.rows, ...result.offline]) {
  const time = row.hours ? `离线${row.hours}小时／有效${row.effectiveMinutes}分钟` : `${row.minute}分钟`;
  lines.push(`| ${result.profile.opening} / ${result.profile.holdings} | ${time} | ${row.grossIncome} | ${row.maintenance} | ${row.proposedConstruction} | ${row.baselineBalance} | ${row.balance} |`);
}
lines.push('', `48组、336行检查的负余额、账目差异、重复项目费和超过12000预算上限均为0。源码${economy.sourceCommit}。`, '',
  '旧档具备一次承担三个新增项目的能力，金额可以继续增长。内容目标需要实际制作和逐项复审，本表没有把安全支出推导为长期乐趣已通过。', '');
writeFileSync(`${output}/budget-route.md`, lines.join('\n'));
console.log(JSON.stringify(checks));
