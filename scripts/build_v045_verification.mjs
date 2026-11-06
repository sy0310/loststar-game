#!/usr/bin/env node
/** Objective V045 evidence compiler. Read-only inputs; no canonical status edits. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual as equal} from 'node:util';
import {collectRuntimeBinding, createReader, gitEvidenceContext, isRepoPath, readZipEntries, sha256,
  validateAssets, validateRuntimeContracts, validateProof, REGISTRATION_PATH, REGISTRY_PATH, RUNTIME_ROOTS, CURIOS, STAGES} from './execution_acceptance.mjs';

const args = process.argv.slice(2);
if (args.length > 1 || args.some(arg => !['--verification', '--proof'].includes(arg))) throw Error('Expected --verification (default) or --proof');
const proofMode = args.includes('--proof'), root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const batchRoot = path.join(root, 'artifacts/v045-a-exploration');
const out = path.resolve(root, process.env.RENEWAL_OUTPUT ?? batchRoot);
if (out !== batchRoot && !out.startsWith(`${batchRoot}/`)) throw Error('Write only this V045 artifact batch');
const relative = name => path.relative(root, name).split(path.sep).join('/'), outputPath = name => relative(path.join(out, name));
const read = createReader(root), inputs = new Map(), jsonInputs = new Map(), media = new Map(), errors = [];
const check = (condition, message) => {if (!condition) throw Error(message);};
const arr = (value, label) => {check(Array.isArray(value), `${label}: actual array missing`);return value;};
const empty = (value, label) => check(arr(value, label).length === 0, `${label}: actual errors present`);
const numeric = (value, label) => {check(typeof value === 'number' && Number.isFinite(value), `${label}: actual number missing`);return value;};
function naturalReadOnly(record, label) {
  check(record?.equal === true && record.completedAt >= record.startedAt && equal(record.actualRights, record.expectedRights)
    && equal(record.actualLedger, record.expectedLedger) && record.actualLedger?.charged === 0
    && equal(arr(record.addedCollection, `${label} actual automatic discoveries`), arr(record.expectedAddedCollection, `${label} expected automatic discoveries`)),
  `${label}: read-only ledger/rights differ from exact ordinary model advancement`);
}
function actualFlow(flow, label) {
  check(flow?.closed === true && flow.ledger?.charged === 0 && flow.summaryVisible === true && flow.summary.trim()
    && equal(arr(flow.steps, `${label} actual timeline`).map(step=>step.id), ['day','dusk','night','dawn'])
    && flow.steps.every(step=>typeof step.label==='string'&&step.label.trim()) && flow.steps.filter(step=>step.current).length===1
    && flow.steps.find(step=>step.current).id===flow.period, `${label}: actual summary/current timeline missing`);
  naturalReadOnly(flow.naturalAdvance, label);
}
const git = args => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
async function bytes(name) {
  check(isRepoPath(name), `Unsafe evidence path: ${name}`);const raw = await read(name);
  inputs.set(name, {path: name, bytes: raw.length, sha256: sha256(raw)});return raw;
}
async function json(name, publicReport = true) {
  const result = JSON.parse((await bytes(name)).toString());check(result && typeof result === 'object' && !Array.isArray(result), `${name}: expected object`);
  if (publicReport) jsonInputs.set(name, result);return result;
}
async function exists(name) {try {await fs.access(path.join(root, name));return true;} catch (e) {if (e.code === 'ENOENT') return false;throw e;}}
async function section(name, fn) {
  try {return {verified: true, ...await fn(), errors: []};}
  catch (e) {const issue = {section: name, message: e.message};errors.push(issue);return {verified: false, errors: [issue]};}
}
async function stable() {
  for (const item of inputs.values()) {const raw = await read(item.path);check(raw.length === item.bytes && sha256(raw) === item.sha256, `Input changed: ${item.path}`);}
}
function charge(before, after) {
  for (const item of [before, after]) for (const key of ['balance', 'grossIncome', 'maintenancePaid']) numeric(item[key], key);
  return before.balance + after.grossIncome - before.grossIncome - (after.maintenancePaid - before.maintenancePaid) - after.balance;
}
const metadata = await json('releases/taptap/package-info-fusion.json', false);
const source = metadata.sourceCommit, zipSha = metadata.sha256, modes = ['screens', 'night', 'collection', 'assist', 'museum', 'cases'];
check(/^[0-9a-f]{40}$/.test(source) && /^[0-9a-f]{64}$/.test(zipSha), 'Actual package source/hash missing');
const verification = {schema: 1, version: metadata.version, sourceCommit: source, runtimeSourceSha: source, zipSha256: zipSha,
  package: metadata, generatedAt: new Date().toISOString(), compilerSha256: sha256(await read(relative(fileURLToPath(import.meta.url)))),
  sourceClean: false, physicalPhone: false, userVisualAcceptance: 'pending', errors,
  policy: 'Actual local raw check + six current immutable-package capture modes. No V044 media/counts relabeled. No canonical implementation/evidence/visual/phone status is written.',
  limits: ['Measured desktop paint P95 is not a 60fps/physical-phone claim.', 'Silent native MP4 files do not prove audible sound.',
    'Local check exit is not a remote CI result.', 'TapTap file readback is not an unavailable remote ZIP checksum.',
    'Complete-image RGBA equality and engineering checks do not establish artistic or user acceptance.']};
let binding, zip, registration, registry;
const frozenPaths = [...RUNTIME_ROOTS, 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', ':(top,glob)vite*.ts'];
verification.runtime = await section('runtime', async () => {
  check(!git(['status', '--porcelain', '--', ...frozenPaths]) && !git(['diff', '--name-only', source, 'HEAD', '--', ...frozenPaths]), 'Actual working runtime/source originals differ from package source');
  execFileSync('git', ['merge-base', '--is-ancestor', source, 'HEAD'], {cwd: root});
  binding = await collectRuntimeBinding(root, source);check(binding.runtimeSourceSha === source, 'Computed source differs');
  for (const key of RUNTIME_ROOTS) check(git(['rev-parse', `HEAD:${key}`]) === binding.originalTrees[key], `Current tree differs: ${key}`);
  const archive = await bytes(metadata.archive);check(archive.length === metadata.bytes && sha256(archive) === zipSha, 'Actual frozen ZIP hash/bytes differ');
  zip = readZipEntries(archive);check(zip.size === metadata.files, 'Actual ZIP file count differs');
  registration = await json(REGISTRATION_PATH);registry = await json(REGISTRY_PATH, false);
  const requirements = arr(registry.acceptance?.requirements, 'Canonical effective requirements');
  check(requirements.length === 174 && new Set(requirements.map(row => row.id)).size === 174
    && equal([...registry.acceptance.requiredIds].sort(), requirements.map(row => row.id).sort()), 'Canonical 161 retained + 13 A requirements are incomplete');
  Object.assign(verification, binding);verification.sourceClean = true;
  return {runtimeSourceSha: source, runtimeTreeHash: binding.runtimeTreeHash, originalTrees: binding.originalTrees,
    actualZipBytes: archive.length, actualZipFiles: zip.size, effectiveRequirements: requirements.length};
});

verification.engineering = await section('engineering', async () => {
  check(binding, 'No actual runtime binding');
  const summary = await json(outputPath('full-check-summary.json')), exit = await json(outputPath('full-check-exit.json'));
  const e2eName = outputPath('e2e-results.json'), e2e = await json(e2eName), logName = outputPath('full-check.log'), logRaw = await bytes(logName);
  const log = logRaw.toString().replace(/\x1b\[[0-9;]*m/g, '');
  check(summary.command === 'npm run check' && summary.exitCode === 0 && exit.exitCode === 0, 'Actual complete check did not exit zero');
  check(summary.version === metadata.version && summary.head === summary.startedHead && summary.head === summary.finishedHead
    && summary.headChangedDuringRun === false && summary.runtimeUnchangedAtCompletion === true, 'Actual check changed source/runtime or tested another version');
  empty(summary.committedFilesChangedDuringRun, 'Committed changes during full check');
  check(/^[0-9a-f]{40}$/.test(summary.startedHead), 'Actual tested checkout missing');
  execFileSync('git', ['merge-base', '--is-ancestor', source, summary.startedHead], {cwd: root});
  for (const key of RUNTIME_ROOTS) check(git(['rev-parse', `${summary.startedHead}:${key}`]) === binding.originalTrees[key], `Tested original tree differs: ${key}`);
  check(!git(['diff', '--name-only', source, summary.startedHead, '--', ...frozenPaths]), 'Tested runtime files differ from current fixed source');
  check(Date.parse(summary.finishedAt) > Date.parse(summary.startedAt) && exit.finishedAt === summary.finishedAt, 'Raw check timestamps/exit record differ');
  check(summary.logSha256 === sha256(logRaw) && summary.scopedReportSha256 === inputs.get(e2eName).sha256, 'Raw check log/E2E hash differs from summary');
  const files = [...log.matchAll(/Test Files\s+(\d+) passed\s*\((\d+)\)/g)].at(-1), tests = [...log.matchAll(/\bTests\s+(\d+) passed\s*\((\d+)\)/g)].at(-1);
  check(files && tests, 'Actual raw Vitest result missing');
  const units = {filesPassed: +files[1], filesTotal: +files[2], testsPassed: +tests[1], testsTotal: +tests[2]};
  check(units.filesPassed > 0 && units.filesPassed === units.filesTotal && units.testsPassed > 0 && units.testsPassed === units.testsTotal
    && equal(units, summary.unitTests), 'Raw unit counts differ from actual summary');
  const builds = ['build', 'build:d1', 'build:v034', 'build:fusion', 'build:v036'];
  check(equal(summary.buildsPassed, builds) && builds.every(name => log.includes(`> loststar-game@${metadata.version} ${name}\n`)), 'Five actual build stages missing');
  check(log.includes('Design assets verified: 20/20') && log.includes('V045 approved reference PNGs verified: 4/4'), 'Full check lacks original 20 and new approved 4 PNG checks');
  check(summary.executionStaticGate?.staticValid === true && summary.executionStaticGate.errorsCount === 0, 'Starting static gate had actual errors');
  empty(e2e.errors, 'Raw E2E runner errors');const stats = e2e.stats;
  check(stats && stats.expected > 0 && stats.skipped === 0 && stats.unexpected === 0 && stats.flaky === 0 && equal(stats, summary.e2eStats), 'Raw E2E stats differ or contain failure/skip/retry');
  const leaves = [];
  function visit(suite) {
    for (const spec of arr(suite.specs, 'E2E suite specs')) {
      check(spec.ok === true, `E2E spec failed: ${spec.title}`);
      for (const test of arr(spec.tests, 'E2E spec tests')) {
        check(test.status === 'expected' && test.expectedStatus === 'passed' && test.results.length === 1, 'E2E skipped/retried/unexpected result');
        check(test.results[0].status === 'passed' && test.results[0].retry === 0, 'Raw E2E did not pass first execution');empty(test.results[0].errors, 'E2E leaf errors');leaves.push(test);
      }
    }
    for (const nested of suite.suites ?? []) visit(nested);
  }
  for (const suite of arr(e2e.suites, 'E2E suites')) visit(suite);
  check(leaves.length === stats.expected, 'Actual E2E leaf count differs');
  return {testedCheckout: summary.startedHead, exitCode: exit.exitCode, unitTests: units, builds, e2e: {...stats, observedTests: leaves.length},
    rawLogSha256: sha256(logRaw), rawE2eSha256: inputs.get(e2eName).sha256, newOriginalReferenceChecks: 4, originalReferenceChecks: 20};
});

const captures = new Map();
function capture(mode) {const report = captures.get(mode);check(report, `Required actual ${mode} capture unavailable`);return report;}
verification.captureReports = {};
for (const mode of modes) verification.captureReports[mode] = await section(`capture:${mode}`, async () => {
  const name = outputPath(`${mode}-evidence.json`), report = await json(name);
  check(report.mode === mode && report.version === metadata.version && report.sourceCommit === source && report.zipSha256 === zipSha
    && report.sourceClean === true && report.complete === true, `${mode}: actual source/package/completion differs`);
  check(report.physicalPhone === false && report.privateContexts === true && report.clockOverrides === false && report.speed === 1, `${mode}: actual capture method differs`);
  check(report.package?.sourceCommit === source && report.package.sha256 === zipSha, `${mode}: package metadata differs`);empty(report.errors, `${mode} collector errors`);
  check(equal(report.initialGuard.originalTrees, binding.originalTrees) && report.initialGuard.runtimeTreeHash === binding.runtimeTreeHash
    && equal(report.finalGuard.originalTrees, binding.originalTrees) && report.finalGuard.runtimeTreeHash === binding.runtimeTreeHash, `${mode}: actual runtime tree binding differs`);
  for (const item of arr(report.cases, `${mode} actual cases`)) {check(item.complete === true, `${mode}/${item.name}: incomplete`);empty(item.errors, `${mode}/${item.name} browser errors`);}
  for (const kind of ['screenshots', 'materials', 'videos']) for (const item of arr(report[kind], `${mode} ${kind}`)) {
    check(typeof item.file === 'string' && !item.file.split('/').some(part => ['raw', 'history', 'baseline', 'private'].includes(part)), 'Private/historical capture media path');
    const file = outputPath(item.file);check(file.startsWith(`${relative(out)}/`), 'Capture media escapes current batch');
    const raw = await bytes(file);check(sha256(raw) === item.sha256 && raw.length === item.bytes, `Actual media hash/bytes differ: ${file}`);
    if (kind === 'videos') {
      const actualProbe = JSON.parse(execFileSync('ffprobe', ['-v','quiet','-show_format','-show_streams','-of','json',path.join(root,file)], {encoding:'utf8'}));
      const streams = arr(actualProbe.streams,'Actual encoded video streams'), video = streams.filter(stream=>stream.codec_type==='video');
      const duration = Number(actualProbe.format?.duration), recordedDuration = Number(item.probe?.format?.duration);
      check(file.endsWith('.mp4') && item.speed === 1 && item.audioRecorded === false && Number.isFinite(duration) && duration > 0
        && item.durationSeconds === duration && recordedDuration === duration && video.length === 1
        && streams.every(stream=>stream.codec_type!=='audio') && Number.isFinite(item.reviewElapsedSeconds) && item.reviewElapsedSeconds > 0,
      'Actual film is not native/silent 1x or declared duration differs from actual ffprobe');
    }
    else check(file.endsWith('.png') && raw.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'Actual PNG signature missing');
    media.set(file, {...inputs.get(file), kind, sourceReport: name});
  }
  captures.set(mode, report);return {path: name, sha256: inputs.get(name).sha256, cases: report.cases.length,
    screenshots: report.screenshots.length, completePngs: report.materials.length, nativeFilms: report.videos.length};
});

verification.references = await section('references', async () => {
  const name = 'design/v045_a_simplified_exploration/manifest.json', manifest = await json(name);
  check(manifest.images.length === 4, 'Four approved A originals missing');
  for (const item of manifest.images) {
    const raw = await bytes(item.path);
    check(raw.length === item.bytes && sha256(raw) === item.sha256 && raw.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
      && raw.readUInt32BE(16) === item.width && raw.readUInt32BE(20) === item.height, `Approved full original changed: ${item.path}`);
    media.set(item.path, {...inputs.get(item.path), kind: 'approved-reference'});
  }
  return {approvedOriginalPngs: manifest.images.length, manifestSha256: inputs.get(name).sha256,
    originalFiles: manifest.images.map(item => inputs.get(item.path)), use: 'Full concept references, not cut runtime sprites or new economy rules'};
});
verification.assets = await section('assets', async () => {
  check(zip && registration && registry, 'Actual asset/archive binding unavailable');
  const validation = await validateAssets({registry, registration, readFile: read});empty(validation.errors, 'Actual registered asset errors');
  check(validation.checks.length === 18 && registration.assets.length === 18, 'Eighteen actual independent registered states missing');
  const html = zip.get(metadata.entry)?.toString();check(html, 'Actual ZIP HTML missing');
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(match => path.posix.normalize(path.posix.join(path.posix.dirname(metadata.entry), match[1])));
  check(scripts.length > 0 && scripts.every(name => zip.has(name)), 'Actual HTML does not resolve production JS');
  const client = [...zip].filter(([name]) => name.endsWith('.js')).map(([, raw]) => raw.toString()).join('\n');
  check(client.includes(source.slice(0, 7)) && client.includes(metadata.version) && client.includes('whole-v043/'), 'Actual packaged JS lacks source/version/whole-image selector');
  let bundled = 0;
  for (const item of registration.assets) {const matching = [...zip].filter(([name]) => name.endsWith('.webp') && path.posix.basename(name).startsWith(`${item.id}-`));
    check(matching.length === 1 && sha256(matching[0][1]) === sha256(await bytes(item.webp)), `Actual packaged WebP differs: ${item.id}`);bundled++;}
  return {registeredStates: registration.assets.length, decodedStateChecks: validation.checks.length, bundledStateWebps: bundled,
    sourceQualifiedClient: true, artisticApprovalInferred: false};
});
verification.entrypoints = await section('entrypoints', async () => {
  const runtime = await validateRuntimeContracts({readFile: read});empty(runtime.errors, 'Actual formal selector/import contract errors');
  const screens = capture('screens'), pages = screens.cases.filter(item => item.kind === 'simplified-pages');
  check(pages.length === 4, 'Actual four mobile/desktop page contexts missing');
  for (const [engine, width] of [['chromium', 360], ['chromium', 390], ['webkit', 390], ['chromium', 1440]])
    check(pages.some(item => item.engine === engine && item.width === width), 'Actual A viewport/engine context missing');
  for (const item of pages) check(item.homeContract?.dedicatedAssist === true && item.homeContract.singleFlowEntry === true
    && item.homeContract.objectiveVisible === true && item.homeContract.secondaryManagementHidden === true, 'A simplified home contract missing/false');
  for(const item of pages)check(item.completedWorkbenches?.length===CURIOS.length&&equal(item.completedWorkbenches.map(row=>row.id).sort(),[...CURIOS].sort())
    &&item.completedWorkbenches.every(row=>row.file&&row.observation.condition==='stabilized'&&row.observation.selected==='stabilized'&&row.observation.stateRenderer==='whole-image-v043'), 'Actual six complete workbenches in every viewport/engine tour missing');
  return {runtimeContractChecks: runtime.checks.length, selectorAssertions: runtime.checks.find(item => item.id === 'runtime:saved-state-selector')?.assertions,
    wholeDrawAssertions: runtime.checks.find(item => item.id === 'runtime:whole-image-draw')?.assertions,
    actualPageContexts: pages.length, actualHomeScreenshots: screens.screenshots.filter(item => item.kind === 'home').length,
    oneFlowAndDedicatedAssistObserved: true};
});
verification.states = await section('states', async () => {
  const screens = capture('screens'), cases = screens.cases.filter(item => item.kind === 'curio-state');
  check(cases.length === CURIOS.length * STAGES.length && screens.materials.length === cases.length, 'Actual 6×3 state/export matrix missing');
  for (const id of CURIOS) for (const stage of STAGES) check(cases.some(item => item.id === id && item.stage === stage && item.observation.condition === stage && item.observation.selected === stage), 'Actual saved-stage workbench mapping missing');
  for (const item of cases.filter(item => item.stage === 'stabilized')) check(item.workbenchUi?.paidPrimaryVisible === false
    && item.workbenchUi.representativeButtons === 1 && item.workbenchUi.researchButtons === 0 && item.workbenchUi.backToCollectionPresent === true, 'Actual simplified completed workbench controls differ');
  check(new Set(screens.materials.map(item => item.rgbaSha256)).size === 18 && screens.materials.every(item => item.width === 384 && item.height === 384
    && item.differingBytes === 0 && item.rgbaSha256 === item.expectedRgbaSha256), 'Eighteen actual independent full images/RGBA equality missing');
  const previews = cases.flatMap(item => arr(item.previews, 'Actual isolated preview records'));
  check(previews.length === 18 && previews.every(item => item.isolated === true && item.controlsHidden === true && item.ledger.charged === 0
    && item.previewSource.path === item.previewSource.thumbnailPath && item.previewSource.width === 384 && item.previewSource.height === 384), 'Actual preview isolation/full image source missing');
  for (const item of cases) naturalReadOnly(item.naturalAdvance, `${item.name} actual state view`);
  for (const item of previews) naturalReadOnly(item.naturalAdvance, `${item.target} actual isolated preview`);
  const collection = capture('collection');check(collection.cases.length === 6 && collection.videos.length === 6, 'Six actual complete collection routes missing');
  const quotes = {receipt: [40,120], tape: [30,100], nested: [50,140], stamp: [45,180], 'cosmic-parcel': [60,220], bell: [35,120]};
  const excavation=collection.cases.find(item=>item.id==='receipt')?.excavation;
  check(excavation?.complete===true&&excavation.quoted===0&&excavation.before.stage==='buried'&&excavation.after.stage==='displayed'
    &&excavation.before.condition==='found'&&excavation.after.condition==='found'&&excavation.actualAction.kind==='excavate'
    &&excavation.completedObservedAt>=excavation.actualAction.endsAt&&excavation.actualAction.endsAt>excavation.actualAction.startedAt
    &&excavation.ledger.charged===0&&charge(excavation.before,excavation.after)===0&&excavation.factsPreserved===true
    &&equal(excavation.before.receiptFacts,excavation.after.receiptFacts)&&excavation.beforeFile&&excavation.processingFile&&excavation.completeFile,'Actual ordinary free receipt excavation/fact isolation missing');
  naturalReadOnly(excavation.naturalAdvance,'Actual free receipt excavation');
  check(excavation.observations.length>0&&new Set(excavation.observations.map(row=>row.material.rgbaSha256)).size===1
    &&excavation.observations.every(row=>row.material.condition==='found'&&row.material.afterCondition==='found'&&row.material.differingBytes===0),'Free excavation changed its actual complete A image');
  for (const item of collection.cases) {
    check(quotes[item.id] && item.steps.length === 2 && equal(item.steps.map(step => step.kind), ['clean', 'repair'])
      && equal(item.steps.map(step => step.quoted), quotes[item.id]), 'Original real clean/repair quotes or sequence differ');
    check(charge(item.before, item.after) === item.quotedTotal && item.ledger.charged === item.quotedTotal && equal(item.before.rights, item.after.rights), 'Actual route charge/rights differ');
    for (const step of item.steps) {
      check(step.actualAction.endsAt > step.actualAction.startedAt && step.completedObservedAt >= step.actualAction.endsAt
        && charge(step.before, step.after) === step.quoted && step.ledger.charged === step.quoted
        && step.before.condition === (step.kind === 'clean' ? 'found' : 'clean') && step.after.condition === (step.kind === 'clean' ? 'clean' : 'stabilized'), 'Actual durable paid step timing/ledger/condition differs');
      check(step.observations.length > 0 && step.processingFile && step.completeFile, 'Processing/commit actual evidence missing');
      const prior = step.before.condition;
      const stableBefore = step.observations.filter(observed => observed.condition === prior && observed.action
        && observed.material.condition === prior && observed.material.afterCondition === prior);
      check(stableBefore.length > 0 && new Set(stableBefore.map(observed => observed.material.rgbaSha256)).size === 1
        && stableBefore.every(observed => observed.material.differingBytes === 0), 'Actual image changed during active pre-commit processing');
    }
  }
  return {completeStateCases: cases.length, completePngExports: screens.materials.length, distinctCompleteImages: 18,
    differingRgbaBytes: 0, isolatedPreviews: previews.length, paidRoutes: collection.cases.length,
    actualPaidSteps: collection.cases.reduce((sum, item) => sum + item.steps.length, 0), actualFreeExcavations:1,oldQuoteTotals: Object.fromEntries(collection.cases.map(item => [item.id, item.quotedTotal]))};
});
verification.data = await section('data', async () => {
  const invariant = await json(outputPath('model-invariants.json'));check(invariant.sourceCommit === source && invariant.database === 'loststar.fusion.firstplanet.v037', 'Actual invariant source/database differs');
  check(invariant.files.length === 15 && new Set(invariant.files.map(item => item.path)).size === 15, 'Actual 15 business modules missing');
  for (const item of invariant.files) {const current = await bytes(item.path), original = execFileSync('git', ['show', `${invariant.baselineRuntime}:${item.path}`], {cwd: root});
    check(item.identicalToBaseline === true && sha256(current) === item.sha256 && current.equals(original), `Actual business bytes changed: ${item.path}`);}
  const economy = await json(outputPath('economy.json'));check(economy.sourceCommit === source && economy.rows.length === 48 && economy.offline.length === 12, 'Actual economy 48/12 source/matrix differs');
  const keys = ['negative','accounting','quotedPrice','categoryTotal','duplicateCharge','falseSignature','shuffledFog','duplicateClaim','archiveRights','directTapIncome','offlineCap','completedStudies'];
  for (const key of keys) check(economy.checks?.[key] === 0, `Actual economy check missing/nonzero: ${key}`);
  check(economy.rows.every(row => row.initial + row.gross - row.maintenance - row.spent === row.balance + row.held)
    && economy.offline.every(row => row.duplicateClaimRejected === true && row.settledHours <= row.offlineCapHours), 'Actual money/offline rows do not reconcile');
  const collection = capture('collection');let replayCount = 0;
  for (const item of collection.cases) {
    check(item.freeReplays.length === 2 && item.returnSelector === '#fusion-back-to-collection', 'Two actual representative replays/collection return missing');
    for (const replay of item.freeReplays) {
      check(replay.complete === true && replay.noRewardOrSpend === true && replay.ledger.charged === 0 && equal(replay.phases.map(phase => phase.targetProgress), [.2,.5,.8]), 'Actual free phases or ordinary-reward isolation missing');replayCount++;
    }
    const a = item.before.receiptFacts, b = item.after.receiptFacts;
    for (const key of ['specimenId','evidenceIds','verifiedEvidenceIds','observations']) check(equal(a[key], b[key]), `Actual signed fact changed: ${key}`);
    check(item.id === 'receipt' ? b.transactions.length - a.transactions.length === 2 : equal(a.transactions, b.transactions), 'Actual paid receipt transactions differ');
  }
  check(replayCount === 12, 'Twelve actual free replays missing');
  return {businessFiles: invariant.files.length, byteIdenticalBusinessFiles: invariant.files.length, economyRows: economy.rows.length,
    offlineCases: economy.offline.length, economyCheckCount: keys.length, economyAnomalies: 0, actualFreeReplays: replayCount,
    signedFactsPreserved: true, database: invariant.database};
});
verification.world = await section('world', async () => {
  const night = capture('night');check(night.cases.length === 1 && night.videos.length === 1, 'One actual continuous night film missing');
  const cycle = night.cases[0];check(cycle.kind === 'same-planet-natural-night' && cycle.trace.length === 313
    && cycle.trace.at(-1).elapsedMs >= 312000 && night.videos[0].durationSeconds >= 312, 'Actual continuous 312s observation missing');
  check(['day','dusk','night','dawn'].every(phase => cycle.phases.includes(phase)) && cycle.paperShadowFile
    && cycle.trace.some(row => row.visual.anomaly === 'paper-shadow') && cycle.trace.some(row => row.lastNight), 'Actual same-globe phases/paper shadow/morning result missing');
  check(cycle.flows.length >= 4 && cycle.flows.every(flow => flow.closed === true && flow.ledger.charged === 0)
    && cycle.morningFlow.content.trim() && charge(cycle.before, cycle.after) === 0, 'Actual unified-flow/morning/ledger evidence missing');
  for (const flow of [...cycle.flows,cycle.morningFlow]) actualFlow(flow,'Actual natural night flow');
  naturalReadOnly(cycle.naturalAdvance,'Actual complete natural night cycle');
  const morning = cycle.morningFlow.previousNight;
  check(morning?.visible === true && morning.text.trim() && morning.number === cycle.trace.at(-1).lastNight?.number,
    'Morning content is not the actual completed night record');
  const assist = capture('assist');check(assist.cases.length === 1 && assist.videos.length === 1, 'One actual dedicated-assist film missing');
  const aid = assist.cases[0];check(aid.kind === 'dedicated-real-assist' && aid.trace.length === 361 && aid.trace.at(-1).elapsedMs >= 36000
    && equal(aid.tiersObserved, [0,1,2,3]) && aid.decay && aid.arrivals.length >= 3, 'Actual dedicated-button 36s tiers/decay/work arrivals missing');
  check(aid.attempts.length === aid.schedule.length && aid.attempts.every(attempt => attempt.target === '#fusion-assist')
    && aid.assistLedger.accepted === aid.attempts.length && aid.assistLedger.enqueuedMs === aid.assistLedger.accepted * 600
    && Math.abs(aid.assistLedger.enqueuedMs - aid.assistLedger.appliedMs - aid.assistLedger.pendingMs) < .01 && charge(aid.before, aid.after) === 0, 'Actual assist work/reward ledger differs');
  return {actualNightTraceRows: cycle.trace.length, actualNightElapsedMs: cycle.trace.at(-1).elapsedMs, nightPhases: cycle.phases,
    sameFlowVisits: cycle.flows.length, paperShadowFrames: 1, morningResultObserved: true, actualAssistTraceRows: aid.trace.length,
    actualAssistElapsedMs: aid.trace.at(-1).elapsedMs, assistTiers: aid.tiersObserved, actualAssistInputs: aid.attempts.length, assistWorkConserved: true};
});
verification.ui = await section('ui', async () => {
  const screens = capture('screens'), pages = screens.cases.filter(item => item.kind === 'simplified-pages');
  for (const item of pages) {
    actualFlow(item.flow,`${item.name} page flow`);naturalReadOnly(item.naturalAdvance,`${item.name} actual page tour`);
    check(equal(item.after.rights,item.naturalAdvance.actualRights),'Actual page summary differs from observed natural ownership');
    for (const selector of ['#fusion-map','#fusion-wallet','#fusion-settings','#fusion-base [data-drawer="upgrades"]'])
      check(item.routes.some(route => route.from === 'base' && route.selector === selector && route.file), 'Actual base-scoped management route missing');
    check(Array.isArray(item.facilityRoutesDiscovered), 'Actual necessary facility route inventory missing');
  }
  const returned = screens.cases.filter(item => item.kind === 'actual-return'), replay = screens.cases.filter(item => item.kind === 'owned-same-world-replay');
  check(returned.length === 1 && returned[0].sameUnifiedFlow === true && returned[0].pendingReturn && returned[0].claimSelector === '#fusion-flow-content #fusion-claim', 'Actual offline return is not in the unified flow');
  check(replay.length === 1 && replay[0].projects.includes('archive') && replay[0].file, 'Actual already-owned same-world archive replay missing');
  naturalReadOnly(returned[0].naturalAdvance,'Actual read-only return');naturalReadOnly(replay[0].naturalAdvance,'Actual isolated archive replay');
  const museum=capture('museum'),installation=capture('cases');
  check(museum.cases.length===3&&museum.videos.length===museum.cases.length&&equal(museum.cases.map(row=>row.variant).sort(),['all-0','all-3','mixed']), 'Actual base/all-upgraded/mixed museum contexts missing');
  const handling=['open','grip','lift-clear','inspect','place','release','close','return'];
  for(const room of museum.cases){
    check(room.kind==='museum-continuous'&&room.trace.length===1001&&room.trace.at(-1).elapsedMs>=100000
      && room.video.durationSeconds>=100&&equal([...room.targets].sort(),[...CURIOS].sort()),'Actual 100s museum trace/film/six targets missing');
    naturalReadOnly(room.naturalAdvance,`${room.name} actual room`);
    check(room.minBodyClearance===Math.min(...room.trace.map(row=>row.bodyClearance))&&room.minBodyClearance>=6
      &&room.maxHandReach===Math.max(...room.trace.map(row=>row.handReach))&&room.maxHandReach<=85,'Actual room clearance/reach differs');
    check(room.completeVisits.length>=2&&new Set(room.completeVisits.map(visit=>visit.id)).size===room.completeVisits.length,'Two complete distinct actual handling visits missing');
    for(const visit of room.completeVisits)check(CURIOS.includes(visit.id)&&equal(visit.sequence.map(row=>row.phase),handling)
      && visit.sequence.every((row,index)=>room.trace.some(actual=>actual.target===visit.id&&actual.phase===row.phase&&actual.frame===row.frame&&actual.elapsedMs===row.elapsedMs)
        &&(!index||row.elapsedMs>visit.sequence[index-1].elapsedMs)),'Actual handling phase order/frame trace differs');
  }
  check(installation.cases.length===1&&installation.videos.length===1,'Actual paid cabinet installation route missing');
  const install=installation.cases[0];check(install.kind==='paid-case-installation'&&install.id==='case-0'&&install.upgrades.length===3
    &&equal(install.upgrades.map(row=>row.expected),[0,1,2])&&equal(install.upgrades.map(row=>row.quoted),[160,480,1100]),'Actual original 0→3 upgrade matrix/quotes differ');
  for(const step of install.upgrades){
    const expected=structuredClone(step.before.rights);expected.growth={...expected.growth,'case-0':step.expected+1};
    check((step.before.rights.growth['case-0']??0)===step.expected&&step.after.rights.growth['case-0']===step.expected+1
      &&step.otherRightsStable===true&&equal(step.after.rights,expected)&&charge(step.before,step.after)===step.quoted&&step.ledger.charged===step.quoted,'Actual case payment/other earned rights differ');
    check(step.factsMatchNaturalAdvance===true&&equal(step.after.receiptFacts,step.naturalExpectedFacts),'Actual case installation facts differ from exact ordinary model advancement');
    check(step.trace.length>0&&step.trace.some(row=>row.installProgress>0&&row.installProgress<1)&&step.trace.some(row=>row.installProgress>=.999)
      &&step.trace.every(row=>row.before===step.expected&&row.after===step.expected+1&&row.level===step.expected+1),'Actual installation motion/before-after frames missing');
  }
  check(install.totalQuoted===install.upgrades.reduce((sum,row)=>sum+row.quoted,0)&&install.ledger.charged===install.totalQuoted
    &&charge(install.before,install.after)===install.totalQuoted,'Actual full cabinet ledger differs');
  return {actualPageContexts: pages.length, actualBaseRoutes: pages.reduce((sum, item) => sum + item.routes.length, 0),
    actualUnifiedReturnCases: returned.length, actualOwnedSameWorldReplays: replay.length,
    actualMuseumContexts:museum.cases.length,actualMuseumCompleteVisits:museum.cases.reduce((sum,row)=>sum+row.completeVisits.length,0),
    actualPaidCabinetSteps:install.upgrades.length,actualCabinetCharges:install.totalQuoted,
    collectionRoutesReturned: capture('collection').cases.filter(item => item.returnSelector === '#fusion-back-to-collection').length};
});
verification.packageSmoke = await section('packageSmoke', async () => {
  const smoke = await json(outputPath('package-smoke.json'));check(smoke.sourceCommit === source && smoke.physicalPhone === false
    && smoke.nativeTouchEmulation === true && smoke.clockOverrides === false && smoke.cases.length === 6, 'Actual six fixed-package smoke contexts missing');
  for (const item of smoke.cases) {
    empty(item.errors, 'Package smoke browser errors');check(item.build.includes(metadata.version) && item.build.includes(source.slice(0,7)) && !item.build.includes('dirty'), 'Actual smoke build differs');
    const required = ['seed','siteConfiguration','collection','upgrades','paidSorting','noOverflow','noUnknownWorlds','oneRobot','singleSorter',
      ...(item.kind === 'existing-paid-archive' ? ['fullArchive','sourceBackup','originalLocalStorage'] : [])];
    check(required.every(key => item.checks?.[key] === true) && Object.values(item.checks).every(value => value === true), 'Actual smoke check missing/false');
  }
  for (const [engine,width] of [['chromium',360],['chromium',390],['webkit',390]]) for (const kind of ['new-player','existing-paid-archive'])
    check(smoke.cases.some(item => item.engine === engine && item.viewport.width === width && item.kind === kind), 'Actual smoke viewport/archive matrix missing');
  return {actualCases: smoke.cases.length, actualBooleanChecks: smoke.cases.reduce((sum,item) => sum + Object.keys(item.checks).length,0), browserErrors: 0};
});
verification.performance = await section('performance', async () => {
  const perf = await json(outputPath('performance.json'));check(perf.sourceCommit === source && perf.zipSha256 === zipSha && perf.physicalPhone === false
    && perf.cases.length === 12 && perf.method.concurrency === 1 && perf.method.recording === false && perf.method.sampleMs === 10000, 'Actual twelve isolated performance samples/source differ');
  const views = engine => perf.cases.filter(item => item.engine === engine).map(item => item.view).sort();
  check(views('chromium').length === 6 && new Set(views('chromium')).size === 6 && equal(views('chromium'), views('webkit')), 'Actual two-engine same-scene performance matrix missing');
  for (const item of perf.cases) {empty(item.errors, 'Performance browser errors');check(item.build.includes(source.slice(0,7)) && item.build.includes(metadata.version)
    && numeric(item.actualPaint.samples,'Actual paint samples') > 0 && numeric(item.actualPaint.p95Ms,'Actual paint P95') > 0, 'Actual paint source/samples missing');}
  return {actualCases: perf.cases.length, browserErrors: 0, sampleMs: perf.method.sampleMs, host: perf.host,
    measured: perf.cases.map(item => ({engine:item.engine,view:item.view,samples:item.actualPaint.samples,medianMs:item.actualPaint.medianMs,p95Ms:item.actualPaint.p95Ms,meanDrawMs:item.meanDrawMs})),
    stable60FpsClaimed: false, physicalPhoneMeasured: false, memoryScope: perf.textureMemory};
});
verification.media = await section('media', async () => {
  modes.forEach(capture);
  const frameCache=new Map(),worldFrames=[];let extractedFrames=0;
  for(const report of captures.values())for(const frame of report.screenshots.filter(row=>row.kind==='native-film-frame')){
    const movie=report.videos.find(row=>row.file===frame.sourceVideo);check(movie&&movie.sha256===frame.sourceVideoSha256,'Actual extracted-frame parent film hash differs');
    if(!frameCache.has(movie.file))frameCache.set(movie.file,JSON.parse(execFileSync('ffprobe',['-v','quiet','-select_streams','v:0','-show_frames','-show_entries','frame=best_effort_timestamp_time','-of','json',path.join(out,movie.file)],{encoding:'utf8',maxBuffer:8*1024*1024})).frames);
    const frames=frameCache.get(movie.file);check(Number.isInteger(frame.frameIndex)&&frame.frameIndex>=0&&Number(frames[frame.frameIndex]?.best_effort_timestamp_time)===frame.ptsSeconds,'Extracted frame index/PTS differs from actual encoded frames');extractedFrames++;
    if(frame.label)worldFrames.push(frame);
  }
  for(const label of ['fog-unrevealed','fog-partial','fog-revealed','ship-front','ship-back','robot-scan','robot-return'])check(worldFrames.some(frame=>frame.label===label),`Actual continuous-film review frame missing: ${label}`);
  return {currentCaptureReports: captures.size, actualScreenshots: [...media.values()].filter(item => item.kind === 'screenshots').length,
    actualCompletePngExports: [...media.values()].filter(item => item.kind === 'materials').length,
    actualNativeFilms: [...media.values()].filter(item => item.kind === 'videos').length,
    hashVerifiedCurrentMedia: [...media.values()].filter(item => item.sourceReport).length, actualIndexedFilmFrames:extractedFrames,
    worldFrameLabels:[...new Set(worldFrames.map(frame=>frame.label))],occlusionAppearanceRequiresVisualReview:true,rawWebmAndPrivateCliExcluded: true};
});

verification.platform = {verified:false,status:'PENDING',reason:'Actual current sanitized TapTap upload/readback is not available',remoteZipChecksumVerified:false};
const platformPath = outputPath('taptap-self-test.json');
if (await exists(platformPath)) verification.platform = await section('platform', async () => {
  const platform = await json(platformPath), encoded = JSON.stringify(platform);
  check(!/"(?:authorization|cookie|access_token|refresh_token|password|secret|qr_url|qrcode)"\s*:/i.test(encoded) && !/data:image|https?:\/\/[^"\s]*(?:token|signature|qrcode)=/i.test(encoded), 'Platform receipt is not sanitized');
  check(platform.runtimeSource === source && platform.version === metadata.version && platform.localZipSha256 === zipSha && platform.localBytes === metadata.bytes, 'Actual current platform local source/package differs');
  const remote = platform.remoteReadback;check(remote && remote.file_size === metadata.bytes && remote.original_file_name === path.basename(metadata.archive)
    && Number.isInteger(platform.packageId) && platform.packageId > 0 && remote.package_id === platform.packageId && remote.screen_orientation === 1, 'Actual remote package readback differs');
  check(remote.is_releasing === false && platform.mainPackageBound === false && platform.mainModuleBeforeAfterIdentical === true && platform.selfTestOnly === true
    && platform.submittedForReview === false && platform.formallyPublished === false, 'Not an isolated development self-test receipt');
  return {status:'RECORDED',actualPackageId:platform.packageId,localBytes:platform.localBytes,remoteBytes:remote.file_size,
    localZipSha256:platform.localZipSha256,mainPackageBound:platform.mainPackageBound,submittedForReview:platform.submittedForReview,formallyPublished:platform.formallyPublished,remoteZipChecksumVerified:false};
});
verification.history = {beforeSource:'7074cff043a239771acae1f0b7133db1225f797a',role:'Historical V044 home comparison only; not current capture/check evidence'};
verification.finalRuntimeGuard = await section('finalRuntimeGuard', async () => {
  check(binding && equal(binding,await collectRuntimeBinding(root,source)) && !git(['status','--porcelain','--',...frozenPaths])
    && !git(['diff','--name-only',source,'HEAD','--',...frozenPaths]), 'Actual frozen runtime changed during evidence compilation');return {runtimeTreeHash:binding.runtimeTreeHash};
});
await stable();verification.inputs = [...inputs.values()];verification.localVerified = errors.length === 0;
verification.platformPending = verification.platform.status === 'PENDING';verification.complete = verification.localVerified && verification.platform.verified;
await fs.mkdir(out,{recursive:true});await fs.writeFile(path.join(out,'verification.json'),JSON.stringify(verification,null,2)+'\n');
if (!verification.localVerified) {console.error(JSON.stringify({localVerified:false,errors}));process.exitCode=1;}
else if (!proofMode) console.log(JSON.stringify({file:outputPath('verification.json'),localVerified:true,platform:verification.platform.status,unitTests:verification.engineering.unitTests.testsPassed,e2eTests:verification.engineering.e2e.expected}));

if (proofMode && verification.localVerified) try {
  check(verification.platform.verified === true,'Actual current platform receipt is required before proof');
  const review = await json(outputPath('review-status.json'));
  check(review.sourceCommit === source && review.zipSha256 === zipSha,'Root manual review source/package differs');
  const records = arr(review.requirements,'Actual root per-requirement reviews'), expected = new Set(registry.acceptance.requirements.map(row=>row.id));
  check(records.length === expected.size && records.length === 174,'All 174 actual retained/new requirement review records are required; none are generated');
  const seen = new Set(), visualReviews=[];
  for (const record of records) {
    check(expected.has(record.requirementId) && !seen.has(record.requirementId),'Unknown/duplicate actual root review');seen.add(record.requirementId);
    check(typeof record.reviewer === 'string' && record.reviewer.trim() && arr(record.targets,'Actually reviewed targets').length > 0 && Array.isArray(record.findings),'Missing real reviewer/targets/findings');
    for (const target of record.targets) {
      check(typeof target === 'string' && isRepoPath(target) && !/(?:^|\/)(?:raw|private|history|capture-history)(?:\/|$)|credential|token|qrcode/i.test(target),'Private/unsafe actual visual-review target');
      const raw = await bytes(target);check(raw.length > 0,'Empty reviewed target');
      if (target.endsWith('.json')) await json(target);else media.set(target,{...inputs.get(target),kind:'root-viewed-target'});
    }
    visualReviews.push({requirementId:record.requirementId,reviewer:record.reviewer,targets:[...record.targets],findings:structuredClone(record.findings),
      ...(record.reviewBasis ? {reviewBasis:record.reviewBasis} : {})});
  }
  // index.html can be a real reviewed target. It must already be the FINAL
  // gallery, whose inventory never depends on this proof/verification output.
  if (media.has(outputPath('index.html'))) {
    const gallery = await json(outputPath('gallery-status.json'));
    check(gallery.sourceCommit === source && gallery.zipSha256 === zipSha && modes.every(mode=>gallery.reportSha256?.[`${mode}-evidence.json`]===inputs.get(outputPath(`${mode}-evidence.json`)).sha256),'Reviewed final gallery is stale');
  }
  for (const item of await fs.readdir(out,{withFileTypes:true})) if (item.isFile() && /^(?:capture-[a-z0-9-]+|full-check|measure-[a-z0-9-]+)\.log$/.test(item.name) && !/upload|taptap|credential|token|cookie|qr/i.test(item.name)) {
    const name=outputPath(item.name);await bytes(name);media.set(name,{...inputs.get(name),kind:'safe-local-log'});
  }
  await json(outputPath('verification.json'));
  const proofPath=outputPath('proof.json'), proof={schema:1,generatedAt:new Date().toISOString(),runtimeVersion:metadata.version,...binding,
    archive:{...inputs.get(metadata.archive),entry:metadata.entry},reports:[...jsonInputs.keys()].map(name=>inputs.get(name)),
    media:[...media.values()].filter(item=>!jsonInputs.has(item.path)).map(({path,bytes,sha256})=>({path,bytes,sha256})),checks:[],visualReviews,userAcceptances:[],phoneRecords:[],
    method:'Actual current raw evidence; 174 root-authored records copied exactly, no invented visual/user/phone acceptance. Canonical status fields untouched.'};
  const fields={engineering:['/engineering/exitCode','/engineering/unitTests/testsPassed','/engineering/e2e/observedTests','/engineering/e2e/unexpected','/engineering/rawLogSha256'],
    references:['/references/approvedOriginalPngs','/references/manifestSha256'],assets:['/assets/registeredStates','/assets/decodedStateChecks','/assets/bundledStateWebps'],
    entrypoints:['/entrypoints/actualPageContexts','/entrypoints/actualHomeScreenshots','/entrypoints/selectorAssertions','/entrypoints/wholeDrawAssertions'],
    states:['/states/completeStateCases','/states/completePngExports','/states/distinctCompleteImages','/states/differingRgbaBytes','/states/isolatedPreviews','/states/actualPaidSteps'],
    data:['/data/businessFiles','/data/byteIdenticalBusinessFiles','/data/economyRows','/data/offlineCases','/data/economyAnomalies','/data/actualFreeReplays'],
    world:['/world/actualNightTraceRows','/world/actualNightElapsedMs','/world/nightPhases','/world/actualAssistTraceRows','/world/actualAssistInputs','/world/assistWorkConserved'],
    ui:['/ui/actualPageContexts','/ui/actualBaseRoutes','/ui/actualUnifiedReturnCases','/ui/actualOwnedSameWorldReplays','/ui/actualMuseumContexts','/ui/actualMuseumCompleteVisits','/ui/actualPaidCabinetSteps','/ui/actualCabinetCharges','/packageSmoke/actualCases','/packageSmoke/browserErrors'],
    media:['/media/currentCaptureReports','/media/actualCompletePngExports','/media/actualNativeFilms','/media/hashVerifiedCurrentMedia','/media/actualIndexedFilmFrames','/media/worldFrameLabels','/media/rawWebmAndPrivateCliExcluded'],
    performance:['/performance/actualCases','/performance/browserErrors','/performance/sampleMs','/performance/measured','/performance/stable60FpsClaimed'],
    platform:['/platform/actualPackageId','/platform/localBytes','/platform/remoteBytes','/platform/localZipSha256','/platform/mainPackageBound','/platform/submittedForReview']};
  for (const [id,pointers] of Object.entries(fields)) {
    check(verification[id]?.verified === true,`Actual ${id} section is not verified`);
    proof.checks.push({id,reportPath:outputPath('verification.json'),assertions:[{kind:'json',pointer:`/${id}/verified`,equals:true},{kind:'json',pointer:`/${id}/errors`,equals:[]},...pointers.map(pointer=>{
      const actual=pointer.slice(1).split('/').reduce((value,key)=>value?.[key],verification);check(actual!==undefined,`Missing actual proof assertion ${pointer}`);return{kind:'json',pointer,equals:actual};})]});
  }
  const raw=Buffer.from(JSON.stringify(proof,null,2)+'\n'), proofReader=name=>name===proofPath?Promise.resolve(raw):read(name);
  const gate=await validateProof({acceptance:{...registry.acceptance,delivery:{...registry.acceptance.delivery,proof:proofPath}},readFile:proofReader,
    binding:await collectRuntimeBinding(root,source),git:gitEvidenceContext(root),mode:'delivery',registration});
  empty(gate.errors,'Compiled proof gate errors');empty(gate.gaps,'Compiled proof gate gaps');await stable();
  await fs.writeFile(path.join(out,'proof.json'),raw);console.log(JSON.stringify({proof:proofPath,checks:proof.checks.length,reports:proof.reports.length,media:proof.media.length,copiedActualRootReviews:visualReviews.length,canonicalStatusesChanged:false}));
} catch(e) {console.error(`Proof not written: ${e.message}`);process.exitCode=1;}
