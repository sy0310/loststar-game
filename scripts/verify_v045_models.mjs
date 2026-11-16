#!/usr/bin/env node
/** Generate V045 business evidence from current frozen bytes and a fresh real-model simulation. */
import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual as equal} from 'node:util';
import {collectRuntimeBinding, RUNTIME_ROOTS} from './execution_acceptance.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseline = '7074cff043a239771acae1f0b7133db1225f797a';
const batch = path.join(root, 'artifacts/v045-a-exploration');
const output = path.resolve(root, process.env.RENEWAL_OUTPUT ?? batch);
const staticOnly = process.argv.includes('--check-schema');
if (process.argv.slice(2).some(arg => arg !== '--check-schema')) throw Error('Expected no arguments or --check-schema');
if (output !== batch && !output.startsWith(`${batch}${path.sep}`)) throw Error('Write only the V045 evidence batch');
const files = [
  'src/game/star-chart.ts', 'src/game/engine.ts', 'src/game/station.ts',
  'src/game/growth.ts', 'src/game/assist.ts', 'src/game/radar.ts',
  'src/game/guard-tuning.ts', 'src/game/persistence.ts', 'src/game/world.ts',
  'src/fusion/domain.ts', 'src/fusion/store.ts', 'src/fusion/contracts.ts',
  'src/fusion/progression.ts', 'src/fusion/surface.ts', 'src/fusion/render-clock.ts',
];
const checkNames = ['negative', 'accounting', 'quotedPrice', 'categoryTotal', 'duplicateCharge', 'falseSignature',
  'shuffledFog', 'duplicateClaim', 'archiveRights', 'directTapIncome', 'offlineCap', 'completedStudies'];
const cohorts = ['fresh', 'restart-27049', 'legacy-27049', 'legacy-50000'];
const minutes = [0, 5, 15, 30, 60, 120];
const simulator = 'scripts/simulate_visual_renewal.ts';
const compiler = 'scripts/build_v045_verification.mjs';
const frozenPaths = [...RUNTIME_ROOTS, 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', ':(top,glob)vite*.ts'];
const git = args => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => fs.readFile(path.resolve(root, name));
const relative = name => path.relative(root, name).split(path.sep).join('/');
const requireThat = (value, message) => {if (!value) throw Error(message);};
const json = bytes => JSON.parse(bytes.toString());

function validateEconomy(report) {
  requireThat(report && /^[0-9a-f]{40}$/.test(report.sourceCommit), 'Actual economy checkout SHA missing');
  requireThat(Array.isArray(report.rows) && report.rows.length === 48 && Array.isArray(report.offline) && report.offline.length === 12, 'Actual economy matrix must contain 48 online and 12 offline rows');
  requireThat(typeof report.policy === 'string' && typeof report.archiveScope === 'string', 'Actual simulation policy/scope missing');
  for (const key of checkNames) requireThat(report.checks?.[key] === 0, `Simulation anomaly or missing check: ${key}`);
  const online = new Set();
  for (const row of report.rows) {
    requireThat(cohorts.includes(row.cohort) && ['idle', 'assist'].includes(row.strategy) && minutes.includes(row.minute), 'Unexpected online cohort/strategy/time');
    const key = `${row.cohort}/${row.strategy}/${row.minute}`;
    requireThat(!online.has(key), `Duplicate online row: ${key}`);online.add(key);
    for (const name of ['initial', 'gross', 'maintenance', 'spent', 'balance', 'held']) requireThat(Number.isFinite(row[name]) && row[name] >= 0, `Invalid ${key}/${name}`);
    requireThat(row.initial + row.gross - row.maintenance - row.spent === row.balance + row.held, `Online ledger mismatch: ${key}`);
  }
  const offline = new Set();
  for (const row of report.offline) {
    const key = `${row.cohort}/${row.hours}`;
    requireThat(cohorts.includes(row.cohort) && [8, 24, 72].includes(row.hours) && !offline.has(key), `Unexpected/duplicate offline row: ${key}`);offline.add(key);
    requireThat(row.duplicateClaimRejected === true && Number.isFinite(row.settledHours) && row.settledHours >= 0
      && Number.isFinite(row.offlineCapHours) && row.settledHours <= row.offlineCapHours, `Offline cap/duplicate claim failed: ${key}`);
    requireThat(row.initial + row.gross - row.maintenance === row.claimed, `Offline ledger mismatch: ${key}`);
  }
}
function validateParity(report) {
  requireThat(report && /^[0-9a-f]{40}$/.test(report.sourceCommit) && /^[0-9a-f]{40}$/.test(report.baselineRuntime), 'Parity source/baseline SHA missing');
  requireThat(report.database === 'loststar.fusion.firstplanet.v037' && report.files?.length === files.length, 'Parity database or 15-file set missing');
  requireThat(equal([...report.files.map(item => item.path)].sort(), [...files].sort()), 'Unexpected/duplicate parity paths');
  for (const item of report.files) requireThat(/^[0-9a-f]{64}$/.test(item.sha256) && item.identicalToBaseline === true, `Parity failed: ${item.path}`);
}
async function currentParity() {
  const records = [];
  for (const name of files) {
    const current = await read(name), original = execFileSync('git', ['show', `${baseline}:${name}`], {cwd: root});
    records.push({path: name, sha256: sha(current), baselineSha256: sha(original), identicalToBaseline: current.equals(original)});
  }
  requireThat(records.every(item => item.identicalToBaseline), `Business bytes changed: ${records.filter(item => !item.identicalToBaseline).map(item => item.path).join(', ')}`);
  return records;
}

if (staticOnly) {
  // These old reports are read only as schema examples, never copied or relabeled.
  validateEconomy(json(await read('artifacts/v044-execution-art/economy.json')));
  validateParity(json(await read('artifacts/v044-execution-art/model-invariants.json')));
  const contract = (await read(compiler)).toString();
  for (const name of ['model-invariants.json', 'economy.json', ...checkNames]) requireThat(contract.includes(name), `V045 compiler no longer consumes expected contract: ${name}`);
  const records = await currentParity();
  console.log(JSON.stringify({mode: 'static-schema-check', outputsWritten: false, baselineRuntime: baseline,
    businessFilesRead: records.length, identicalBusinessFiles: records.filter(item => item.identicalToBaseline).length,
    historicalSchemaExamples: ['artifacts/v044-execution-art/economy.json', 'artifacts/v044-execution-art/model-invariants.json'],
    currentEconomySimulated: false, performanceMeasured: false}));
} else {
  const metadataRaw = await read('releases/taptap/package-info-fusion.json'), metadata = json(metadataRaw);
  requireThat(metadata.version === '0.4.5' && /^[0-9a-f]{40}$/.test(metadata.sourceCommit), 'Freeze the actual V045 runtime/package first');
  const source = metadata.sourceCommit, checkout = git(['rev-parse', 'HEAD']);
  const watchedTools = [relative(fileURLToPath(import.meta.url)), simulator, compiler];
  const toolHashes = Object.fromEntries(await Promise.all(watchedTools.map(async name => [name, sha(await read(name))])));
  const initialFiles = await currentParity();
  async function guard() {
    requireThat(git(['rev-parse', 'HEAD']) === checkout, 'Evidence checkout changed during model verification');
    requireThat(!git(['status', '--porcelain', '--', ...frozenPaths]) && !git(['diff', '--name-only', source, checkout, '--', ...frozenPaths]), 'Working runtime differs from the frozen package source');
    execFileSync('git', ['merge-base', '--is-ancestor', source, checkout], {cwd: root});
    requireThat((await read('releases/taptap/package-info-fusion.json')).equals(metadataRaw), 'Package metadata changed during verification');
    const zip = await read(metadata.archive);requireThat(zip.length === metadata.bytes && sha(zip) === metadata.sha256, 'Actual ZIP hash/bytes differ');
    for (const name of watchedTools) requireThat(sha(await read(name)) === toolHashes[name], `Verification input changed: ${name}`);
    return collectRuntimeBinding(root, source);
  }
  const initial = await guard();
  for (const name of ['economy.json', 'economy.csv', 'offline.csv', 'model-parity.json', 'model-invariants.json', 'model-economy-raw.json', 'model-run.json', 'model-run.log']) {
    try {await fs.access(path.join(output, name));throw Error(`Refuse to overwrite existing evidence: ${name}`);} catch (error) {if (error.code !== 'ENOENT') throw error;}
  }
  const workspace = await fs.mkdtemp(path.join(root, 'releases/v045-models-'));
  const buildDir = path.join(workspace, 'bundle'), rawDir = path.join(workspace, 'raw');
  const commands = [
    {file: process.execPath, args: [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--ssr', simulator, '--outDir', relative(buildDir)]},
    {file: process.execPath, args: [path.join(buildDir, 'simulate_visual_renewal.js')]},
  ];
  const startedAt = new Date().toISOString(), log = [];
  for (const command of commands) {
    const result = execFileSync(command.file, command.args, {cwd: root, env: {...process.env, RENEWAL_OUTPUT: rawDir}, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024});
    log.push(`$ ${[command.file, ...command.args].join(' ')}\n${result}`);
  }
  const rawEconomy = await fs.readFile(path.join(rawDir, 'economy.json')), result = json(rawEconomy);
  validateEconomy(result);requireThat(result.sourceCommit === checkout, 'Fresh simulator reported another checkout');
  const final = await guard(), finalFiles = await currentParity();
  requireThat(equal(initial, final) && equal(initialFiles, finalFiles), 'Runtime/business input changed while simulating');
  const generatedAt = new Date().toISOString(), bundle = await fs.readFile(path.join(buildDir, 'simulate_visual_renewal.js'));
  const provenance = {simulator, simulatorSha256: toolHashes[simulator], bundleSha256: sha(bundle), commands,
    rawReport: relative(path.join(output, 'model-economy-raw.json')), rawReportSha256: sha(rawEconomy),
    evidenceCheckoutCommit: checkout, sourceCommit: source, startedAt, finishedAt: generatedAt, exitCode: 0};
  const economy = {...result, sourceCommit: source, runtimeSourceSha: source, evidenceCheckoutCommit: checkout,
    zipSha256: metadata.sha256, runtimeTreeHash: initial.runtimeTreeHash,
    sourceState: 'Fresh ordinary-model simulation of runtime bytes verified against this frozen package source; raw checkout report retained in provenance.', provenance};
  const parity = {schema: 1, sourceCommit: source, baselineRuntime: baseline, database: 'loststar.fusion.firstplanet.v037',
    evidenceCheckoutCommit: checkout, zipSha256: metadata.sha256, runtimeTreeHash: initial.runtimeTreeHash, generatedAt,
    result: 'Fifteen current business modules are byte-identical to the V044 baseline. No save is opened. Runtime archive, payment and concurrent-tab tests remain separate.', files: finalFiles};
  validateEconomy(economy);validateParity(parity);
  await fs.mkdir(output, {recursive: true});
  const serializedParity = JSON.stringify(parity, null, 2) + '\n';
  await fs.writeFile(path.join(output, 'economy.json'), JSON.stringify(economy, null, 2) + '\n', {flag: 'wx'});
  for (const name of ['economy.csv', 'offline.csv']) await fs.copyFile(path.join(rawDir, name), path.join(output, name), constants.COPYFILE_EXCL);
  for (const name of ['model-parity.json', 'model-invariants.json']) await fs.writeFile(path.join(output, name), serializedParity, {flag: 'wx'});
  await fs.writeFile(path.join(output, 'model-economy-raw.json'), rawEconomy, {flag: 'wx'});
  await fs.writeFile(path.join(output, 'model-run.json'), JSON.stringify(provenance, null, 2) + '\n', {flag: 'wx'});
  await fs.writeFile(path.join(output, 'model-run.log'), log.join('\n'), {flag: 'wx'});
  console.log(JSON.stringify({sourceCommit: source, evidenceCheckoutCommit: checkout, baselineRuntime: baseline,
    businessFiles: finalFiles.length, economyRows: economy.rows.length, offlineCases: economy.offline.length, checks: economy.checks,
    outputs: ['economy.json', 'economy.csv', 'offline.csv', 'model-parity.json', 'model-invariants.json', 'model-economy-raw.json', 'model-run.json', 'model-run.log']}));
}
