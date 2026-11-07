#!/usr/bin/env node
/** Compile objective current-package evidence; never change acceptance statuses. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual as equal} from 'node:util';
import {collectRuntimeBinding, createReader, gitEvidenceContext, isRepoPath, readZipEntries,
  sha256, validateAssets, validateRuntimeContracts, validateProof, REGISTRATION_PATH, REGISTRY_PATH,
  RUNTIME_ROOTS, CURIOS, STAGES} from './execution_acceptance.mjs';

const args = process.argv.slice(2);
if (args.length > 1 || args.some(arg => !['--verification', '--proof'].includes(arg))) throw Error('Expected --verification (default) or --proof');
const makeProof = args.includes('--proof');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, process.env.RENEWAL_OUTPUT ?? 'artifacts/v044-execution-art');
if (!output.startsWith(`${root}/artifacts/`)) throw Error('RENEWAL_OUTPUT must remain in this repository artifacts directory');
const relative = absolute => path.relative(root, absolute).split(path.sep).join('/');
const outPath = name => relative(path.join(output, name));
const reader = createReader(root), inputs = new Map(), issues = [], reports = new Map(), media = new Map();
const requireThat = (condition, message) => {if (!condition) throw Error(message);};
const array = (value, label) => {requireThat(Array.isArray(value), `${label} must be an actual array`);return value;};
const finite = (value, label) => {requireThat(typeof value === 'number' && Number.isFinite(value), `${label} must be numeric`);return value;};
const noErrors = (value, label) => requireThat(array(value, label).length === 0, `${label} is not empty`);
const git = argv => execFileSync('git', argv, {cwd: root, encoding: 'utf8'}).trim();
function actualCharge(before, after) {
  const fields = state => state.game ? [state.game.resources, state.game.station.grossIncome, state.game.station.repairSpent]
    : [state.balance, state.grossIncome, state.maintenancePaid];
  const a = fields(before), b = fields(after);[...a, ...b].forEach(value => finite(value, 'Actual archive ledger field'));
  return a[0] + b[1] - a[1] - (b[2] - a[2]) - b[0];
}
async function bytes(name) {
  requireThat(isRepoPath(name), `Unsafe repository path: ${name}`);
  const raw = await reader(name);
  inputs.set(name, {path: name, bytes: raw.length, sha256: sha256(raw)});
  return raw;
}
async function json(name, manifest = true) {
  const value = JSON.parse((await bytes(name)).toString());
  requireThat(value && typeof value === 'object' && !Array.isArray(value), `${name}: expected JSON object`);
  if (manifest) reports.set(name, value);
  return value;
}
async function exists(name) {try {await fs.access(path.join(root, name));return true;} catch (cause) {if (cause.code === 'ENOENT') return false;throw cause;}}
async function section(id, work) {
  try {return {verified: true, ...await work(), errors: []};}
  catch (cause) {const issue = {section: id, message: cause.message};issues.push(issue);return {verified: false, errors: [issue]};}
}
async function write(name, value) {
  await fs.mkdir(output, {recursive: true});
  await fs.writeFile(path.join(output, name), `${JSON.stringify(value, null, 2)}\n`);
}
async function stableInputs() {
  for (const record of inputs.values()) {
    const raw = await reader(record.path);
    requireThat(raw.length === record.bytes && sha256(raw) === record.sha256, `Input changed during compilation: ${record.path}`);
  }
}

const metadataPath = 'releases/taptap/package-info-fusion.json';
// The local packager metadata lives under ignored releases/. Its actual hash is
// recorded in verification.inputs; do not make an absent private CLI file a
// required public proof report. The full metadata is copied into verification.
const metadata = await json(metadataPath, false);
const source = metadata.sourceCommit, zipSha = metadata.sha256;
requireThat(/^[0-9a-f]{40}$/.test(source) && /^[0-9a-f]{64}$/.test(zipSha), 'Package metadata needs full source/SHA256');
const verification = {schema: 1, generatedAt: new Date().toISOString(), compiler: relative(fileURLToPath(import.meta.url)),
  compilerSha256: sha256(await reader(relative(fileURLToPath(import.meta.url)))), version: metadata.version,
  sourceCommit: source, runtimeSourceSha: source, zipSha256: zipSha, package: metadata,
  physicalPhone: false, userVisualAcceptance: 'pending', sourceClean: false,
  policy: 'Computed from actual source/ZIP, raw local check files and fixed-package captures. No acceptance/status registry is written. Raw tests receive source qualification only after their checkout, runtime trees and hashes are verified.',
  knownLimits: ['Desktop touch emulation is not a physical phone test.', 'Paint P95 is reported as measured; no stable 60fps claim.',
    'Sound-cue events and silent films are not audible audio verification.', 'Platform readback does not imply an unavailable remote ZIP checksum.',
    'Local full-check logs are not a remote CI completion record.',
    'MP4 hashes bind captured H.264 review files; this compiler does not measure physical device codec/GPU presentation.'], errors: issues};

let binding, archiveEntries, registration, registry;
verification.runtime = await section('runtime', async () => {
  const runtimePaths = [...RUNTIME_ROOTS, 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', ':(top,glob)vite*.ts'];
  noErrors(git(['status', '--porcelain', '--', ...runtimePaths]).split('\n').filter(Boolean), 'Working runtime changes');
  requireThat(git(['diff', '--name-only', source, 'HEAD', '--', ...runtimePaths]) === '', 'Current runtime differs from package source');
  execFileSync('git', ['merge-base', '--is-ancestor', source, 'HEAD'], {cwd: root});
  binding = await collectRuntimeBinding(root, source);
  requireThat(binding.runtimeSourceSha === source, 'Computed runtime source differs from metadata');
  for (const name of RUNTIME_ROOTS) requireThat(git(['rev-parse', `HEAD:${name}`]) === binding.originalTrees[name], `Current original tree differs: ${name}`);
  const archive = await bytes(metadata.archive);
  requireThat(archive.length === metadata.bytes && sha256(archive) === zipSha, 'Actual ZIP bytes/hash differ from metadata');
  archiveEntries = readZipEntries(archive);
  requireThat(archiveEntries.size === metadata.files, 'Actual ZIP file count differs from metadata');
  registration = await json(REGISTRATION_PATH);registry = await json(REGISTRY_PATH, false);
  verification.sourceClean = true;
  Object.assign(verification, binding);
  return {binding, archiveBytes: archive.length, archiveFiles: archiveEntries.size, archiveSha256: zipSha, workingTreeValidated: true};
});

verification.engineering = await section('engineering', async () => {
  requireThat(binding, 'Runtime binding unavailable');
  const summary = await json(outPath('full-check-summary.json'));
  const exit = await json(outPath('full-check-exit.json'));
  const e2eName = outPath('e2e-results.json'), e2e = await json(e2eName);
  const logName = outPath('full-check.log'), logRaw = await bytes(logName), log = logRaw.toString().replace(/\x1b\[[0-9;]*m/g, '');
  requireThat(summary.command === 'npm run check' && summary.exitCode === 0 && exit.exitCode === 0, 'Actual complete local check did not exit 0');
  requireThat(summary.version === metadata.version && summary.head === summary.startedHead && summary.head === summary.finishedHead,
    'Check version/started/finished checkout attribution differs');
  requireThat(summary.headChangedDuringRun === false && summary.runtimeUnchangedAtCompletion === true,
    'Check observed a runtime/HEAD change');
  noErrors(summary.committedFilesChangedDuringRun, 'Committed files changed during full check');
  const testedCheckout = summary.startedHead;
  requireThat(/^[0-9a-f]{40}$/.test(testedCheckout), 'Full check lacks exact tested checkout');
  execFileSync('git', ['merge-base', '--is-ancestor', source, testedCheckout], {cwd: root});
  for (const name of RUNTIME_ROOTS) requireThat(git(['rev-parse', `${testedCheckout}:${name}`]) === binding.originalTrees[name], `Tested original tree differs: ${name}`);
  requireThat(git(['diff', '--name-only', source, testedCheckout, '--', 'index.html', 'package*.json', 'tsconfig.json', ':(top,glob)vite*.ts']) === '', 'Tested root runtime files differ from package');
  requireThat(Date.parse(summary.finishedAt) > Date.parse(summary.startedAt) && exit.finishedAt === summary.finishedAt, 'Check exit timestamps do not match raw completion');
  requireThat(summary.logSha256 === sha256(logRaw) && summary.scopedReportSha256 === inputs.get(e2eName).sha256, 'Raw local-check log/E2E hash differs from its summary');
  const unitFiles = [...log.matchAll(/Test Files\s+(\d+) passed\s*\((\d+)\)/g)].at(-1);
  const unitTests = [...log.matchAll(/\bTests\s+(\d+) passed\s*\((\d+)\)/g)].at(-1);
  requireThat(unitFiles && unitTests, 'Raw Vitest output does not report fully passed files/tests');
  const units = {filesPassed: +unitFiles[1], filesTotal: +unitFiles[2], testsPassed: +unitTests[1], testsTotal: +unitTests[2]};
  requireThat(units.filesPassed > 0 && units.filesPassed === units.filesTotal && units.testsPassed > 0 && units.testsPassed === units.testsTotal
    && equal(units, summary.unitTests), 'Raw unit counts differ from check summary');
  const buildCommands = ['build', 'build:d1', 'build:v034', 'build:fusion', 'build:v036'];
  requireThat(equal(summary.buildsPassed, buildCommands), 'Five required builds are absent from actual check summary');
  for (const command of buildCommands) requireThat(log.includes(`> loststar-game@${metadata.version} ${command}\n`), `Raw check log lacks ${command}`);
  requireThat(summary.designAssets?.verified === 20 && summary.designAssets.total === 20 && log.includes('Design assets verified: 20/20'), 'Original reference asset check is incomplete in raw log/summary');
  requireThat(summary.executionStaticGate?.staticValid === true && summary.executionStaticGate.errorsCount === 0, 'Actual starting static gate had errors');
  noErrors(e2e.errors, 'Raw E2E runner errors');
  const stats = e2e.stats;
  requireThat(stats && stats.expected > 0 && stats.skipped === 0 && stats.unexpected === 0 && stats.flaky === 0 && equal(stats, summary.e2eStats), 'Raw E2E statistics are not clean or differ from summary');
  const leaves = [];
  function visit(suite) {
    for (const spec of array(suite.specs, 'E2E suite specs')) {
      requireThat(spec.ok === true, `E2E spec failed: ${spec.title}`);
      for (const test of array(spec.tests, 'E2E tests')) {
        requireThat(test.expectedStatus === 'passed' && test.status === 'expected' && test.results.length === 1, 'E2E skipped, retried or non-passing test');
        const result = test.results[0];
        requireThat(result.status === 'passed' && result.retry === 0, 'Raw E2E result did not pass on its first execution');noErrors(result.errors, 'E2E result errors');leaves.push(test);
      }
    }
    for (const nested of suite.suites ?? []) visit(nested);
  }
  for (const suite of array(e2e.suites, 'E2E suites')) visit(suite);
  requireThat(leaves.length === stats.expected, 'Raw E2E test leaf count differs from summary');
  return {testedCheckout, runtimeSourceSha: source, originalTrees: binding.originalTrees, exitCode: exit.exitCode,
    startedAt: summary.startedAt, finishedAt: summary.finishedAt, unitTests: units, buildCommands, designAssets: summary.designAssets,
    e2e: {expected: stats.expected, observedTests: leaves.length, skipped: stats.skipped, unexpected: stats.unexpected, flaky: stats.flaky},
    raw: [outPath('full-check-summary.json'), outPath('full-check-exit.json'), e2eName, logName].map(name => inputs.get(name)),
    startingGateReviewReady: summary.executionStaticGate.reviewReady,
    scope: 'Complete local raw check, source-qualified here; not a CI success declaration or visual/phone acceptance'};
});

const captureSpecs = [
  ['screens-whole-state-evidence.json', 57, 78, 0], ['process-whole-state-evidence.json', 6, 30, 6],
  ['interactions-whole-state-evidence.json', 6, 48, 6], ['screens-evidence.json', 12, 24, 0],
  ['pages-evidence.json', 5, 81, 0], ['life-evidence.json', 1, 4, 1], ['assist-evidence.json', 1, 7, 1],
  ['cases-evidence.json', 2, 9, 2], ['excavation-evidence.json', 1, 2, 1],
  ['museum-physical-evidence.json', null, null, null], ['current-art-comparison.json', 4, 12, 0],
];
const captures = new Map();
function capture(name) {const result = captures.get(name);requireThat(result, `Required current capture unavailable: ${name}`);return result;}
async function addMedia(name, item, kind) {
  requireThat(typeof item.file === 'string', `${name}: media path missing`);
  const file = outPath(item.file);
  requireThat(file.startsWith(`${relative(output)}/`) && !file.split('/').some(segment => ['raw', 'history', 'capture-history', 'baseline'].includes(segment)), `Unsafe/current-history media path: ${file}`);
  requireThat(kind === 'video' ? file.endsWith('.mp4') : file.endsWith('.png'), `Expected actual PNG/MP4: ${file}`);
  const raw = await bytes(file), record = inputs.get(file);
  if (Object.hasOwn(item, 'sha256')) requireThat(item.sha256 === record.sha256, `Captured media hash differs: ${file}`);
  if (Object.hasOwn(item, 'bytes')) requireThat(item.bytes === record.bytes, `Captured media bytes differ: ${file}`);
  if (kind === 'video') requireThat(item.speed === 1 && finite(item.durationSeconds, 'Native video duration') > 0, `Video is not documented native 1x: ${file}`);
  media.set(file, {...record, kind, report: name});
}
for (const [name, expectedCases, expectedShots, expectedVideos] of captureSpecs) {
  const result = await section(name, async () => {
    const report = await json(outPath(name));
    requireThat(report.sourceCommit === source && report.zipSha256 === zipSha && report.sourceClean === true, `${name}: source/ZIP/clean runtime differs`);
    requireThat(report.package?.sourceCommit === source && report.package.sha256 === zipSha && report.package.version === metadata.version, `${name}: capture package differs`);
    requireThat(report.physicalPhone === false && report.touchEmulation === true && report.clockOverrides === false, `${name}: capture method fields missing/different`);
    noErrors(report.errors, `${name}: collector errors`);
    if (Object.hasOwn(report, 'complete')) requireThat(report.complete === true, `${name}: collector incomplete`);
    const cases = array(report.cases, `${name}: cases`), shots = array(report.screenshots, `${name}: screenshots`);
    const videos = array(!Object.hasOwn(report, 'videos') && expectedVideos === 0 ? [] : report.videos, `${name}: videos`);
    if (expectedCases !== null) requireThat(cases.length === expectedCases, `${name}: expected ${expectedCases} actual cases, got ${cases.length}`);
    if (expectedShots !== null) requireThat(shots.length === expectedShots, `${name}: expected ${expectedShots} actual screenshots, got ${shots.length}`);
    if (expectedVideos !== null) requireThat(videos.length === expectedVideos, `${name}: expected ${expectedVideos} actual videos, got ${videos.length}`);
    for (const item of cases) {
      if (Object.hasOwn(item, 'errors')) noErrors(item.errors, `${name}/${item.name}: errors`);
      if (Object.hasOwn(item, 'browserErrors')) noErrors(item.browserErrors, `${name}/${item.name}: browser errors`);
      if (Object.hasOwn(item, 'complete')) requireThat(item.complete === true, `${name}/${item.name}: incomplete`);
    }
    for (const item of shots) await addMedia(outPath(name), item, 'screenshot');
    for (const item of report.materials ?? []) await addMedia(outPath(name), item, 'material');
    for (const item of videos) await addMedia(outPath(name), item, 'video');
    captures.set(name, report);
    return {path: outPath(name), ...inputs.get(outPath(name)), cases: cases.length, screenshots: shots.length,
      materials: report.materials?.length ?? null, videos: videos.length};
  });
  verification.captureReports ??= {};verification.captureReports[name] = result;
}

verification.assets = await section('assets', async () => {
  requireThat(archiveEntries && registration && registry, 'Actual package/source asset binding unavailable');
  const assetValidation = await validateAssets({registry, registration, readFile: reader});
  noErrors(assetValidation.errors, 'Actual source/runtime registration errors');
  requireThat(assetValidation.checks.length === 18 && registration.assets.length === 18, 'Actual registered/decoded state count differs from 18');
  const html = archiveEntries.get(metadata.entry)?.toString();requireThat(html, 'ZIP production HTML missing');
  const dirname = path.posix.dirname(metadata.entry);
  const entryScripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(match => path.posix.normalize(path.posix.join(dirname, match[1])));
  requireThat(entryScripts.length > 0 && entryScripts.every(name => archiveEntries.has(name)), 'Actual ZIP HTML does not resolve production JS');
  const client = [...archiveEntries].filter(([name]) => name.endsWith('.js')).map(([, raw]) => raw.toString()).join('\n');
  requireThat(client.includes(source.slice(0, 7)) && client.includes(metadata.version) && client.includes('whole-v043/'), 'Actual ZIP JS lacks source/version/shared whole-state renderer');
  let bundledStateImages = 0;
  for (const item of registration.assets) {
    const found = [...archiveEntries].filter(([name]) => name.endsWith('.webp') && path.posix.basename(name).startsWith(`${item.id}-`));
    requireThat(found.length === 1 && sha256(found[0][1]) === sha256(await bytes(item.webp)), `Actual ZIP missing/wrong complete image: ${item.id}`);bundledStateImages++;
  }
  return {registeredStates: registration.assets.length, decodedStateChecks: assetValidation.checks.length, bundledStateImages,
    entryScripts, sourceOriginalTrees: binding.originalTrees, noDuplicateVisibleImages: true,
    artisticQualityInferred: false, packageClientIdentifiesSource: true};
});

verification.entrypoints = await section('entrypoints', async () => {
  requireThat(archiveEntries, 'ZIP unavailable');
  const runtime = await validateRuntimeContracts({readFile: reader});noErrors(runtime.errors, 'Actual production selector/import contract errors');
  const comparison = capture('current-art-comparison.json');
  for (const item of comparison.cases) {
    requireThat(item.complete === true && item.readOnly === true && item.ledger?.charged === 0
      && equal(item.initialOwnership, item.finalOwnership), 'Native scene comparison changed rights/payment');
    requireThat(item.servedEntry?.sha256 === sha256(archiveEntries.get(item.servedEntry.zipEntry)), 'Actually served HTML differs from fixed ZIP');
    requireThat(array(item.loadedScripts, 'Actually loaded JS list').length > 0, 'No actual loaded JS evidence');
    for (const script of item.loadedScripts) requireThat(archiveEntries.has(script.zipEntry) && script.sha256 === sha256(archiveEntries.get(script.zipEntry))
      && script.bytes === archiveEntries.get(script.zipEntry).length, 'Actual loaded JS differs from fixed ZIP');
  }
  requireThat(equal([...new Set(comparison.screenshots.map(item => item.scene))].sort(), ['collection', 'explore', 'workbench-stamp']), 'Three priority scenes are incomplete');
  return {runtimeContractChecks: runtime.checks.length, selectorAssertions: runtime.checks.find(item => item.id === 'runtime:saved-state-selector')?.assertions,
    wholeDrawAssertions: runtime.checks.find(item => item.id === 'runtime:whole-image-draw')?.assertions,
    actualSceneContexts: comparison.cases.length, actualSceneScreenshots: comparison.screenshots.length,
    actualLoadedScripts: comparison.cases.reduce((sum, item) => sum + item.loadedScripts.length, 0), servedClientBytesMatchZip: true};
});

verification.states = await section('states', async () => {
  const screens = capture('screens-whole-state-evidence.json'), process = capture('process-whole-state-evidence.json');
  const formal = screens.cases.filter(item => item.kind === 'complete-state');
  requireThat(formal.length === 54 && formal.every(item => item.readOnly === true), 'Native complete-state/read-only matrix is incomplete');
  const matrix = new Set(formal.map(item => `${item.engine}/${item.width}/${item.id}/${item.stage}`));
  for (const [engine, width] of [['chromium', 360], ['chromium', 390], ['webkit', 390]]) for (const id of CURIOS) for (const stage of STAGES)
    requireThat(matrix.has(`${engine}/${width}/${id}/${stage}`), 'Missing native engine/size/object/condition');
  const exports = [...array(screens.materials, 'State PNG exports'), ...array(process.materials, 'Processing PNG exports')];
  requireThat(exports.length === 90 && exports.every(item => item.width === 384 && item.height === 384 && item.differingBytes === 0
    && item.rgbaSha256 === item.previewRgbaSha256), 'Complete material RGBA differs from actual decoded complete state');
  const previews = formal.flatMap(item => item.readOnlyPreviews ?? []);
  requireThat(previews.length === 18 && previews.every(item => item.archiveCondition === 'stabilized' && item.ownershipUnchanged === true
    && item.returnedToCurrent === true && item.payment?.charged === 0 && item.rgbaSha256 === item.thumbnailRgbaSha256), 'Read-only enlarged previews altered image/rights/payment');
  for (const item of process.cases) {
    requireThat(item.noRepeatPayment === true && item.ownershipUnchanged === true && item.ledger.charged === item.quotedTotal
      && actualCharge(item.before, item.after) === item.quotedTotal && equal(item.before.ownership, item.after.ownership)
      && item.steps.length === 2, 'Paid complete-image process ledger failed');
    for (const step of item.steps) {
      requireThat(step.complete === true && step.noRepeatCharge === true && step.ledger.charged === step.quote.quoted
        && actualCharge(step.before, step.after) === step.quote.quoted, 'Paid step does not match one actual quote');
      requireThat(step.action.endsAt > step.action.startedAt && step.completedObservedAt >= step.action.endsAt, 'State changed before actual action end');
      requireThat(array(step.observations, 'Natural paid observations').length > 0, 'Paid processing has no actual observations');
    }
  }
  return {completeStateCases: formal.length, formalImages: 18, fullPngExports: exports.length, pixelDifferingBytes: 0,
    readOnlyEnlargedPreviews: previews.length, paidCurios: process.cases.length, paidSteps: process.cases.reduce((sum, item) => sum + item.steps.length, 0),
    quotedTotals: Object.fromEntries(process.cases.map(item => [item.id, item.quotedTotal])), sourceQualityApprovalInferred: false};
});

verification.data = await section('data', async () => {
  const invariants = await json(outPath('model-invariants.json'));
  requireThat(invariants.sourceCommit === source && invariants.database === 'loststar.fusion.firstplanet.v037', 'Model invariant source/database differs');
  requireThat(array(invariants.files, 'Business invariant files').length === 15 && new Set(invariants.files.map(item => item.path)).size === 15, 'Expected 15 distinct business modules');
  for (const item of invariants.files) {
    const actual = await bytes(item.path), original = execFileSync('git', ['show', `${invariants.baselineRuntime}:${item.path}`], {cwd: root});
    requireThat(item.identicalToBaseline === true && sha256(actual) === item.sha256 && actual.equals(original), `Business bytes changed: ${item.path}`);
  }
  const economy = await json(outPath('economy.json'));
  requireThat(economy.sourceCommit === source && economy.rows.length === 48 && economy.offline.length === 12, 'Economy source or 48/12 matrix differs');
  const names = ['negative', 'accounting', 'quotedPrice', 'categoryTotal', 'duplicateCharge', 'falseSignature', 'shuffledFog', 'duplicateClaim', 'archiveRights', 'directTapIncome', 'offlineCap', 'completedStudies'];
  for (const key of names) requireThat(economy.checks?.[key] === 0, `Economy anomaly/missing check: ${key}`);
  for (const row of economy.rows) requireThat(row.initial + row.gross - row.maintenance - row.spent === row.balance + row.held, 'Actual economy row does not reconcile');
  requireThat(economy.offline.every(item => item.duplicateClaimRejected === true && item.settledHours <= item.offlineCapHours), 'Offline claim/cap check failed');
  const interactions = capture('interactions-whole-state-evidence.json');
  for (const item of interactions.cases) {
    for (const key of ['gameMatchesOrdinaryAutomaticAdvance', 'ownershipUnchanged', 'receiptFactsUnchanged', 'curioStatesUnchanged', 'receiptTryAudit', 'noFreeRewardOrSpend']) requireThat(item[key] === true, `Free interaction missing/false ${key}`);
    requireThat(item.ledger.charged === 0 && actualCharge(item.before, item.after) === 0 && equal(item.before.ownership, item.after.ownership)
      && equal(item.beforeReceiptFacts, item.afterReceiptFacts) && item.replays.length === 2
      && item.initialMaterialRgbaSha256 === item.finalMaterialRgbaSha256, 'Free interaction altered money/material/facts');
    for (const replay of item.replays) requireThat(replay.complete === true && replay.free === true && replay.ledger.charged === 0 && replay.phaseScreenshots.length === 3
      && equal(replay.phaseScreenshots.map(shot => shot.targetProgress), [.2, .5, .8]), 'Sequential actual free phase evidence missing');
  }
  return {businessFiles: invariants.files.length, byteIdenticalBusinessFiles: invariants.files.length, businessBaseline: invariants.baselineRuntime,
    economyRows: economy.rows.length, offlineCases: economy.offline.length, economyCheckCount: names.length, economyAnomalies: 0,
    freeInteractionCurios: interactions.cases.length, freeInteractionReplays: interactions.cases.reduce((sum, item) => sum + item.replays.length, 0),
    ledgerAndFactsConserved: true, database: invariants.database};
});

verification.world = await section('world', async () => {
  const world = capture('screens-evidence.json'), life = capture('life-evidence.json'), assist = capture('assist-evidence.json');
  requireThat(world.cases.every(item => item.kind === 'world-field' && item.fieldBoundsDisjoint === true && item.inspectionSource === 'fusion-world' && item.drawerClosed === true), 'World/field same-scene bounds/source failed');
  const daynight = life.cases[0];
  requireThat(daynight.kind === 'complete-daynight' && daynight.durationSeconds === 312 && equal([...daynight.periods].sort(), ['dawn', 'day', 'dusk', 'night']), 'Full natural day/night phase evidence missing');
  requireThat(daynight.trace.length === 313 && daynight.trace.at(-1).at - daynight.trace[0].at >= 311000, 'Day/night trace is not a full natural 312s observation');
  const aid = assist.cases[0];
  requireThat(aid.durationSeconds === 36 && aid.speed === 1 && aid.naturalDecayObserved === true && aid.ledgerConserved === true
    && equal([...aid.tiersObserved].sort(), [0, 1, 2, 3]) && aid.arrivals.length >= 3, 'Three-tier native assist/decay/real arrival evidence missing');
  return {worldFieldCases: world.cases.length, naturalDayNightSeconds: daynight.durationSeconds, dayNightPhases: daynight.periods,
    dayNightObservations: daynight.trace.length, naturalAssistSeconds: aid.durationSeconds, assistTiers: aid.tiersObserved,
    realArrivals: aid.arrivals.length, ledgerConserved: aid.ledgerConserved};
});

verification.ui = await section('ui', async () => {
  const pages = capture('pages-evidence.json'), cases = capture('cases-evidence.json'), excavation = capture('excavation-evidence.json'), museum = capture('museum-physical-evidence.json');
  requireThat(pages.cases.filter(item => item.kind === 'reachable-pages').length === 4 && pages.cases.some(item => item.kind === 'return'), 'Four viewport/engine page sets or real return page missing');
  const install = cases.cases.find(item => item.kind === 'paid-case-installation');
  requireThat(install && install.upgrades.length === 3 && equal(install.upgrades.map(item => item.expected), [0, 1, 2]), 'Actual case 0→3 installation missing');
  for (const item of install.upgrades) requireThat(item.after.game.growth['case-0'] === item.expected + 1 && item.ledger.charged > 0, 'Case paid upgrade did not change the actual owned level');
  const extracted = excavation.cases[0];
  requireThat(extracted.kind === 'excavation' && extracted.before.receipt.stage === 'buried' && extracted.after.receipt.stage === 'displayed'
    && extracted.ledger.charged === 0, 'Actual free excavation did not finish');
  requireThat(museum.cases.length > 0 && museum.videos.length === museum.cases.length, 'No continuous museum evidence');
  for (const item of museum.cases) requireThat(equal([...item.targets].sort(), [...CURIOS].sort()) && item.minBodyClearance >= 6 && item.maxHandReach <= 85
    && item.trace.length >= 1000 && item.video.durationSeconds === 100, 'Six-cabinet physical transport evidence incomplete');
  return {reachablePageContexts: 4, realReturnPages: 1, actualPageScreenshots: pages.screenshots.length, installedLevels: install.upgrades.length,
    freeExcavations: excavation.cases.length, museumContinuousCases: museum.cases.length, museumTargetsPerCase: CURIOS.length,
    minimumBodyClearance: Math.min(...museum.cases.map(item => item.minBodyClearance)), maximumHandReach: Math.max(...museum.cases.map(item => item.maxHandReach))};
});

verification.packageSmoke = await section('packageSmoke', async () => {
  const smoke = await json(outPath('package-smoke.json'));
  requireThat(smoke.sourceCommit === source && smoke.physicalPhone === false && smoke.nativeTouchEmulation === true && smoke.clockOverrides === false, 'Fixed-package smoke source/method differs');
  requireThat(smoke.cases.length === 6, 'Six fixed-package new/existing-archive cases missing');
  const common = ['seed', 'siteConfiguration', 'collection', 'upgrades', 'paidSorting', 'noOverflow', 'noUnknownWorlds', 'oneRobot', 'noLegacySorter', 'singleSorter', 'noPaintedHitFrames'];
  const observed = new Set();
  for (const item of smoke.cases) {
    noErrors(item.errors, 'Fixed-package smoke errors');
    requireThat(item.build.includes(metadata.version) && item.build.includes(source.slice(0, 7)) && !item.build.includes('dirty'), 'Actual smoke build differs');
    const keys = [...common, ...(item.kind === 'existing-paid-archive' ? ['fullArchive', 'sourceBackup', 'originalLocalStorage'] : [])];
    for (const key of keys) requireThat(item.checks?.[key] === true, `Actual smoke missing/failed check: ${key}`);
    observed.add(`${item.engine}/${item.viewport.width}/${item.kind}`);
  }
  for (const [engine, width] of [['chromium', 360], ['chromium', 390], ['webkit', 390]]) for (const kind of ['new-player', 'existing-paid-archive']) requireThat(observed.has(`${engine}/${width}/${kind}`), 'Smoke engine/size/archive matrix missing');
  return {cases: smoke.cases.length, newPlayerCases: smoke.cases.filter(item => item.kind === 'new-player').length,
    existingPaidArchiveCases: smoke.cases.filter(item => item.kind === 'existing-paid-archive').length, browserErrors: 0};
});

verification.performance = await section('performance', async () => {
  const performance = await json(outPath('performance.json'));
  requireThat(performance.sourceCommit === source && performance.zipSha256 === zipSha && performance.physicalPhone === false, 'Actual performance source/package differs');
  requireThat(performance.cases.length === 12 && performance.method?.concurrency === 1 && performance.method.recording === false
    && performance.method.sampleMs === 10000, 'Expected twelve exclusive 10-second actual paint samples');
  const expectedViews = ['collection', 'receipt', 'tape', 'bell', 'tape-ii', 'bell-active'];
  for (const engine of ['chromium', 'webkit']) for (const view of expectedViews) requireThat(performance.cases.filter(item => item.engine === engine && item.view === view).length === 1, 'Performance engine/scene matrix missing');
  for (const item of performance.cases) {
    noErrors(item.errors, 'Actual performance browser errors');
    requireThat(item.build.includes(metadata.version) && item.build.includes(source.slice(0, 7)), 'Measured build differs');
    requireThat(finite(item.actualPaint?.samples, 'Actual paint samples') > 0 && finite(item.actualPaint.p95Ms, 'Actual paint P95') > 0
      && finite(item.meanDrawMs, 'Measured mean draw time') >= 0, 'Actual paint timing fields are missing');
  }
  return {cases: performance.cases.length, browserErrors: 0, sampleMs: performance.method.sampleMs, host: performance.host,
    measurements: performance.cases.map(item => ({engine: item.engine, view: item.view, samples: item.actualPaint.samples,
      medianMs: item.actualPaint.medianMs, p95Ms: item.actualPaint.p95Ms, meanDrawMs: item.meanDrawMs})),
    physicalPhoneMeasured: false, stable60FpsClaimed: false, scope: performance.textureMemory};
});

verification.media = await section('media', async () => {
  for (const [name] of captureSpecs) capture(name);
  return {currentCaptureReports: captures.size, screenshots: [...media.values()].filter(item => item.kind === 'screenshot').length,
    completePngExports: [...media.values()].filter(item => item.kind === 'material').length,
    nativeMp4Videos: [...media.values()].filter(item => item.kind === 'video').length, hashVerifiedFiles: media.size,
    physicalPhone: false, rawWebmExcluded: true};
});

verification.platform = {verified: false, status: 'PENDING', reason: 'Current sanitized TapTap self-test receipt is not available yet', remoteZipChecksumVerified: false};
const platformPath = outPath('taptap-self-test.json');
if (await exists(platformPath)) verification.platform = await section('platform', async () => {
  const platform = await json(platformPath), text = JSON.stringify(platform);
  requireThat(!/"(?:authorization|cookie|access_token|refresh_token|password|secret|qr_url|qrcode)"\s*:/i.test(text)
    && !/data:image|https?:\/\/[^"\s]*(?:token|signature|qrcode|qr_code)=/i.test(text), 'Platform receipt is not sanitized');
  requireThat(platform.runtimeSource === source && platform.version === metadata.version && platform.localZipSha256 === zipSha && platform.localBytes === metadata.bytes, 'Platform receipt does not bind current local source/ZIP');
  const remote = platform.remoteReadback;
  requireThat(remote && remote.file_size === metadata.bytes && remote.original_file_name === path.basename(metadata.archive)
    && Number.isInteger(platform.packageId) && platform.packageId > 0 && remote.package_id === platform.packageId && remote.screen_orientation === 1,
  'Actual remote package readback fields do not match this uploaded source/version/bytes');
  requireThat(remote.is_releasing === false && platform.mainPackageBound === false && platform.mainModuleBeforeAfterIdentical === true
    && platform.selfTestOnly === true && platform.submittedForReview === false && platform.formallyPublished === false,
  'Platform receipt does not document an isolated development self-test');
  return {status: 'RECORDED', packageId: platform.packageId, remoteFileName: remote.original_file_name, localBytes: platform.localBytes,
    remoteBytes: remote.file_size, localZipSha256: platform.localZipSha256, mainPackageBound: platform.mainPackageBound,
    submittedForReview: platform.submittedForReview, formallyPublished: platform.formallyPublished, remoteZipChecksumVerified: false};
});

verification.historicalEvidence = [];
for (const name of ['baseline-art-comparison.json', 'baseline/performance.json', 'baseline-trace/performance.json']) {
  const file = outPath(name);
  if (await exists(file)) {
    const old = await json(file, false);
    requireThat(old.sourceCommit !== source, `${name}: historical comparison must not masquerade as current evidence`);
    verification.historicalEvidence.push({...inputs.get(file), sourceCommit: old.sourceCommit, zipSha256: old.zipSha256,
      currentVerification: false, role: 'Historical before/baseline comparison only'});
  }
}
verification.finalRuntimeGuard = await section('finalRuntimeGuard', async () => {
  requireThat(binding, 'Initial runtime binding unavailable');
  const current = await collectRuntimeBinding(root, source);
  requireThat(equal(current, binding), 'Runtime/source trees changed while compiling evidence');
  const paths = [...RUNTIME_ROOTS, 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', ':(top,glob)vite*.ts'];
  requireThat(git(['status', '--porcelain', '--', ...paths]) === '' && git(['diff', '--name-only', source, 'HEAD', '--', ...paths]) === '',
    'Frozen source became dirty/different during compilation');
  return {runtimeSourceSha: current.runtimeSourceSha, runtimeTreeHash: current.runtimeTreeHash};
});
verification.inputs = [...inputs.values()];
verification.localVerified = issues.length === 0;
verification.platformPending = verification.platform.status === 'PENDING';
verification.complete = verification.localVerified && verification.platform.verified;
await stableInputs();
await write('verification.json', verification);
if (!verification.localVerified) {
  console.error(JSON.stringify({verification: outPath('verification.json'), localVerified: false, errors: issues}));process.exitCode = 1;
} else if (!makeProof) {
  console.log(JSON.stringify({verification: outPath('verification.json'), localVerified: true, platform: verification.platform.status,
    unitTests: verification.engineering.unitTests.testsPassed, e2eTests: verification.engineering.e2e.expected, media: verification.media}));
}

if (makeProof && verification.localVerified) {
  try {
    requireThat(verification.platform.verified === true, 'Cannot compile proof before the actual current sanitized TapTap remote receipt');
    const reviewName = outPath('review-status.json'), review = await json(reviewName);
    requireThat(review.sourceCommit === source && review.zipSha256 === zipSha, 'Root manual visual review refers to another source/ZIP');
    const records = array(review.requirements, 'Root requirement visual review records');
    requireThat(records.length > 0, 'Root has not supplied real per-requirement visual records');
    const validIds = new Set(registry.acceptance.requirements.map(item => item.id)), seen = new Set(), visualReviews = [];
    for (const record of records) {
      requireThat(validIds.has(record.requirementId) && !seen.has(record.requirementId), 'Unknown/duplicate root reviewed requirement');seen.add(record.requirementId);
      requireThat(typeof record.reviewer === 'string' && record.reviewer.trim() && array(record.targets, 'Actually viewed targets').length > 0
        && Array.isArray(record.findings), `Invalid actual root review record: ${record.requirementId}`);
      for (const target of record.targets) {
        requireThat(typeof target === 'string' && isRepoPath(target) && !/(?:^|\/)(?:raw|private|capture-history|history)(?:\/|$)/.test(target)
          && !/(?:credential|token|cookie|qrcode)/i.test(target), 'Unsafe/private review target');
        const raw = await bytes(target);requireThat(raw.length > 0, 'Viewed target is empty');
        if (target.endsWith('.json')) await json(target);else media.set(target, {...inputs.get(target), kind: 'viewed-target'});
      }
      visualReviews.push({requirementId: record.requirementId, reviewer: record.reviewer, targets: [...record.targets], findings: structuredClone(record.findings)});
    }
    // Only known capture/local-check logs are public evidence. CLI/API uploads,
    // private receipts, QR files and raw videos are deliberately not scanned.
    for (const item of await fs.readdir(output, {withFileTypes: true})) {
      if (!item.isFile() || !/^(?:capture-[a-z0-9-]+|full-check|measure-[a-z0-9-]+)\.log$/.test(item.name)
        || /taptap|upload|credential|token|cookie|qr/i.test(item.name)) continue;
      const name = outPath(item.name);await bytes(name);media.set(name, {...inputs.get(name), kind: 'safe-local-log'});
    }
    await json(outPath('verification.json'));
    const proofPath = outPath('proof.json');
    const proof = {schema: 1, generatedAt: new Date().toISOString(), runtimeVersion: metadata.version, ...binding,
      archive: {...inputs.get(metadata.archive), entry: metadata.entry},
      reports: [...reports.keys()].map(name => inputs.get(name)), media: [...media.values()].filter(item => !reports.has(item.path)).map(({path: name, bytes, sha256: hash}) => ({path: name, bytes, sha256: hash})),
      checks: [], visualReviews, userAcceptances: [], phoneRecords: [],
      method: 'Objective verification compiled from current raw reports and exact media hashes; visualReviews copied only from root supplied real per-requirement records. Canonical statuses untouched.'};
    const assertion = (pointer, equals) => ({kind: 'json', pointer, equals});
    const checks = {
      engineering: ['/engineering/exitCode', '/engineering/unitTests/testsPassed', '/engineering/e2e/observedTests', '/engineering/e2e/unexpected', '/engineering/e2e/flaky', '/engineering/e2e/skipped'],
      assets: ['/assets/registeredStates', '/assets/decodedStateChecks', '/assets/bundledStateImages', '/assets/packageClientIdentifiesSource'],
      entrypoints: ['/entrypoints/selectorAssertions', '/entrypoints/wholeDrawAssertions', '/entrypoints/actualSceneContexts', '/entrypoints/actualSceneScreenshots', '/entrypoints/servedClientBytesMatchZip'],
      states: ['/states/completeStateCases', '/states/fullPngExports', '/states/pixelDifferingBytes', '/states/readOnlyEnlargedPreviews', '/states/paidSteps'],
      data: ['/data/businessFiles', '/data/byteIdenticalBusinessFiles', '/data/economyRows', '/data/offlineCases', '/data/economyAnomalies', '/data/freeInteractionReplays', '/data/ledgerAndFactsConserved'],
      world: ['/world/worldFieldCases', '/world/naturalDayNightSeconds', '/world/dayNightObservations', '/world/assistTiers', '/world/ledgerConserved'],
      ui: ['/ui/reachablePageContexts', '/ui/realReturnPages', '/ui/actualPageScreenshots', '/ui/installedLevels', '/ui/freeExcavations', '/packageSmoke/cases', '/packageSmoke/browserErrors'],
      media: ['/media/currentCaptureReports', '/media/hashVerifiedFiles', '/media/nativeMp4Videos', '/media/rawWebmExcluded'],
      performance: ['/performance/cases', '/performance/browserErrors', '/performance/sampleMs', '/performance/measurements', '/performance/stable60FpsClaimed'],
      platform: ['/platform/packageId', '/platform/localBytes', '/platform/remoteBytes', '/platform/localZipSha256', '/platform/mainPackageBound', '/platform/submittedForReview', '/platform/formallyPublished'],
    };
    const pointer = value => value.slice(1).split('/').reduce((item, key) => item?.[key], verification);
    for (const [id, pointers] of Object.entries(checks)) {
      requireThat(verification[id]?.verified === true, `Cannot prove unverified ${id}`);
      const assertions = [assertion(`/${id}/verified`, true), assertion(`/${id}/errors`, []), ...pointers.map(value => {
        const actual = pointer(value);requireThat(actual !== undefined, `Actual assertion field missing: ${value}`);return assertion(value, actual);
      })];
      proof.checks.push({id, reportPath: outPath('verification.json'), assertions});
    }
    const proofBytes = Buffer.from(`${JSON.stringify(proof, null, 2)}\n`);
    const proofReader = name => name === proofPath ? Promise.resolve(proofBytes) : reader(name);
    const result = await validateProof({acceptance: {...registry.acceptance, delivery: {...registry.acceptance.delivery, proof: proofPath}},
      readFile: proofReader, binding: await collectRuntimeBinding(root, source), git: gitEvidenceContext(root), mode: 'delivery', registration});
    noErrors(result.errors, 'Compiled proof gate errors');noErrors(result.gaps, 'Compiled proof gate gaps');
    await stableInputs();await fs.writeFile(path.join(output, 'proof.json'), proofBytes);
    console.log(JSON.stringify({verification: outPath('verification.json'), proof: proofPath, checks: proof.checks.length,
      reports: proof.reports.length, media: proof.media.length, copiedActualVisualReviews: visualReviews.length, canonicalStatusesChanged: false}));
  } catch (cause) {console.error(`Proof not written: ${cause.message}`);process.exitCode = 1;}
}
