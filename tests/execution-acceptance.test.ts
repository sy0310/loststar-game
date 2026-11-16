import {beforeAll, describe, expect, test} from 'vitest';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import {CURIOS, STAGES, MINIMUM_REQUIREMENT_IDS, REGISTRATION_PATH, createReader, hashRuntimeEntries, isRepoPath, minimumIdsFromContract, readZipEntries, sha256, validateAcceptance, validateAssets, validateProof, validateRequirements, validateRuntimeContracts} from '../scripts/execution_acceptance.mjs';
import {exportWholeCurioState, registeredWholeStateMasters} from '../scripts/export_whole_curio_states.mjs';

const contractPath = 'design/visual-renewal/EXECUTION_AND_ART_ACCEPTANCE.md';
const rootReader = createReader(process.cwd());
const sourceSha = 'a'.repeat(40), treeHash = 'b'.repeat(64);
const originalTrees = Object.fromEntries(['src', 'assets/runtime', 'assets/source'].map(name => [name, 'c'.repeat(40)]));
const binding = {runtimeSourceSha: sourceSha, runtimeTreeHash: treeHash, originalTrees};
const git = {head: 'd'.repeat(40), tree: () => 'c'.repeat(40), isAncestor: () => true};
const clone = <T>(object: T): T => structuredClone(object);
const codes = (result: {errors: {code: string}[]}) => result.errors.map(error => error.code);

function requirements() {
  return {schema: 1, requiredIds: [...MINIMUM_REQUIREMENT_IDS], baselineRuntime: 'f'.repeat(40), requirements: MINIMUM_REQUIREMENT_IDS.map(id => ({id, parent: null, sourceRefs: [{path: 'contract.md', startLine: 1, endLine: 1}], scope: 'IN_SCOPE', implementation: 'IMPLEMENTED', evidence: 'STALE', visual: 'NOT_REVIEWED', phone: 'NOT_TESTED', code: ['src/runtime.ts'], assets: [], entrypoints: ['/?sample=first-planet'], checks: ['unit:state'], proofs: [], gap: 'Fresh media pending', nextAction: 'Capture the fixed package'})), delivery: {status: 'PENDING', title: 'V0.4.4 待用户/真机验收', proof: 'proof.json'}};
}

function memoryReader(files: Map<string, Buffer>, fallback = false) {
  return async (name: string) => {
    if (!isRepoPath(name)) throw Error('Invalid repository file path');
    if (files.has(name)) return files.get(name)!;
    if (fallback) return rootReader(name);
    throw Error(`Fixture file does not exist: ${name}`);
  };
}

function requirementFiles() {
  return new Map<string, Buffer>([['contract.md', Buffer.from('Current required clause\n')], ['src/runtime.ts', Buffer.from('export const saved = true;')], [contractPath, Buffer.from(MINIMUM_REQUIREMENT_IDS.map(id => `| ${id} | requirement | acceptance |`).join('\n'))], ['package.json', Buffer.from('{"version":"0.4.4"}')]]);
}

async function assetFixture() {
  const files = new Map<string, Buffer>(), rows: any[] = [], assetRows: any[] = [], curioStates: any[] = [];
  files.set('scripts/export_whole_curio_states.mjs', Buffer.from(`const bounds=${JSON.stringify(Object.fromEntries(CURIOS.map(id => [id, [50, 100, 51, 101]])))};`));
  let index = 0;
  for (const curio of CURIOS) for (const state of STAGES) {
    const id = `${curio}-${state}`, color = {r: 10 + index * 10, g: 30 + index, b: 200 - index, alpha: 1}; index++;
    const chip = await sharp({create: {width: 2, height: 2, channels: 4, background: color}}).png().toBuffer();
    const png = await sharp({create: {width: 384, height: 384, channels: 4, background: '#00000000'}}).composite([{input: chip, left: 100, top: 200}]).png().toBuffer();
    const webp = await sharp(png).webp({lossless: true}).toBuffer();
    const reused = state === 'stabilized';
    const source = reused ? png : await sharp({create: {width: 4, height: 4, channels: 4, background: '#00000000'}}).composite([{input: chip, left: 1, top: 1}]).png().toBuffer();
    const sourcePath = `assets/source/visual-renewal/whole-states-v043/${curio}/${id}.png`, runtime = `assets/runtime/visual-renewal/whole-states-v043/${id}.png`, webpPath = runtime.replace('.png', '.webp');
    files.set(sourcePath, source); files.set(runtime, png); files.set(webpPath, webp);
    for (const [name, bytes, size] of [[sourcePath, source, reused ? 384 : 4], [runtime, png, 384], [webpPath, webp, 384]] as [string, Buffer, number][]) rows.push({path: name, bytes: bytes.length, sha256: sha256(bytes), width: size, height: size});
    assetRows.push({id, curio, state, source: sourcePath, sourceSha256: sha256(source), canonicalReuse: reused, sourceExteriorCrop: reused ? null : {left: 1, top: 1, width: 2, height: 2}, wholeImagePlacement: reused ? {left: 0, top: 0} : {left: 100, top: 200}, wholeImageSize: reused ? {width: 384, height: 384} : {width: 2, height: 2}, runtime, webp: webpPath, width: 384, height: 384, logicalSize: 192, sha256: sha256(png)});
    curioStates.push({id: curio, state, path: runtime});
  }
  const registration = {schema: 1, version: '0.4.3', assets: assetRows};
  files.set(REGISTRATION_PATH, Buffer.from(JSON.stringify(registration)));
  return {files, registration, registry: {files: rows, completeCurioStateCount: 18, curioStates, moduleRegistrations: [{path: REGISTRATION_PATH, data: clone(registration)}]}};
}

async function registeredMasterFixture() {
  const registry = JSON.parse((await rootReader('design/visual-renewal/ASSET_REGISTRY.json')).toString());
  const registration = JSON.parse((await rootReader(REGISTRATION_PATH)).toString());
  const result = await exportWholeCurioState({id: 'tape', state: 'clean', readFile: rootReader});
  registration.assets[registration.assets.findIndex((row: any) => row.id === 'tape-clean')] = result.entry;
  const files = new Map<string, Buffer>([[REGISTRATION_PATH, Buffer.from(JSON.stringify(registration))], [result.entry.runtime, result.png], [result.entry.webp, result.webp]]);
  registry.moduleRegistrations.find((row: any) => row.path === REGISTRATION_PATH).data = clone(registration);
  for (const [name, bytes] of [[registeredWholeStateMasters['tape-clean'].path, await rootReader(registeredWholeStateMasters['tape-clean'].path)], [result.entry.runtime, result.png], [result.entry.webp, result.webp]] as [string, Buffer][]) {
    const row = {path: name, kind: name.includes('/source/') ? 'source' : 'runtime', bytes: bytes.length, sha256: sha256(bytes), width: 384, height: 384};
    const index = registry.files.findIndex((entry: any) => entry.path === name);
    if (index < 0) registry.files.push(row); else registry.files[index] = {...registry.files[index], ...row};
  }
  return {registry, registration, files, readFile: memoryReader(files, true)};
}

/** Small standard stored ZIP; all mutation fixtures remain in memory. */
function zip(entries: [string, string][]) {
  const locals: Buffer[] = [], centrals: Buffer[] = []; let offset = 0;
  for (const [name, text] of entries) {
    const label = Buffer.from(name), data = Buffer.from(text), local = Buffer.alloc(30), central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(label.length, 26);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(label.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, label, data); centrals.push(central, label); offset += local.length + label.length + data.length;
  }
  const directory = Buffer.concat(centrals), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

function proofFixture() {
  const files = requirementFiles();
  const archive = zip([['loststar-fusion/index.html', '<script type="module" src="./assets/game.js"></script>'], ['loststar-fusion/assets/game.js', `const source="${sourceSha.slice(0, 7)}"; const version="0.4.4"; const renderer="whole-v043/";`]]);
  const report = Buffer.from(JSON.stringify({sourceCommit: sourceSha, zipSha256: sha256(archive), summary: {failures: 0, passed: 18}, status: 'PASS'})), media = Buffer.from('actual-captured-media-fixture');
  files.set('archive.zip', archive); files.set('report.json', report); files.set('screen.png', media);
  const manifest = (name: string) => ({path: name, bytes: files.get(name)!.length, sha256: sha256(files.get(name)!)});
  const proof: any = {schema: 1, ...binding, runtimeVersion: '0.4.4', generatedAt: '2026-11-06T12:00:00Z', archive: manifest('archive.zip'), reports: [manifest('report.json')], media: [manifest('screen.png')], checks: [{id: 'unit:state', reportPath: 'report.json', assertions: [{kind: 'json', pointer: '/summary/failures', equals: 0}, {kind: 'json', pointer: '/summary/passed', equals: 18}]}]};
  const acceptance = requirements();
  for (const row of acceptance.requirements) {row.evidence = 'CURRENT_VERIFIED'; (row.proofs as string[]).push('report.json', 'screen.png');}
  files.set('proof.json', Buffer.from(JSON.stringify(proof)));
  return {files, proof, acceptance, readFile: memoryReader(files)};
}

describe('execution contract is concrete and cannot silently omit required scope', () => {
  test('source table drives IDs; pending dimensions remain explicit rather than a final PASS', async () => {
    const acceptance = requirements(), files = requirementFiles();
    expect(minimumIdsFromContract('| ART-99 | new row | criteria |\n')).toEqual(['ART-99']);
    const result = await validateRequirements({acceptance, readFile: memoryReader(files)});
    expect(result.errors).toEqual([]); expect(result.gaps?.some(row => row.code === 'EVIDENCE_PENDING')).toBe(true);
    expect(result.gaps?.some(row => row.code === 'PHONE_PENDING' && row.pendingAcceptance)).toBe(true);
    const omitted = clone(acceptance); omitted.requirements.pop();
    expect(codes(await validateRequirements({acceptance: omitted, readFile: memoryReader(files)}))).toContain('REQUIREMENT_OMITTED');
  });

  test('rejects duplicates, missing children, empty/missing refs and self-reported proof claims', async () => {
    const acceptance = requirements(), files = requirementFiles();
    acceptance.requirements.push(clone(acceptance.requirements[0]));
    acceptance.requirements[0].sourceRefs = []; acceptance.requirements[1].sourceRefs[0].endLine = 99;
    acceptance.requirements[2].code = ['src/omitted.ts']; acceptance.requirements[3].evidence = 'CURRENT_VERIFIED';
    const result = await validateRequirements({acceptance, readFile: memoryReader(files), expectedRequirementIds: ['ART-01-CHILD']});
    expect(codes(result)).toEqual(expect.arrayContaining(['DUPLICATE_REQUIREMENT_ID', 'SOURCE_REFS_MISSING', 'SOURCE_REF_INVALID', 'REQUIREMENT_FILE_MISSING', 'VERIFIED_WITHOUT_PROOF', 'REQUIREMENT_OMITTED']));
  });

  test('file and route mutation cannot escape repository or point at a missing entry', async () => {
    const acceptance = requirements(), files = requirementFiles();
    acceptance.requirements[0].assets = ['../secret.png'] as never[];
    acceptance.requirements[1].entrypoints = ['missing.html'];
    expect(codes(await validateRequirements({acceptance, readFile: memoryReader(files)}))).toEqual(expect.arrayContaining(['REQUIREMENT_FILE_MISSING', 'ENTRYPOINT_FILE_MISSING']));
    for (const name of ['../secret', '/etc/passwd', 'a/../../b', 'https://invalid', 'a\\b', 'a?x=1']) expect(isRepoPath(name)).toBe(false);
  });
});

describe('six identities × three decoded images and actual source/export mapping', () => {
  let fixture: Awaited<ReturnType<typeof assetFixture>>;
  beforeAll(async () => {fixture = await assetFixture();});
  test('validates all 18 isolated PNGs, lossless WebPs, source sizes, reuse and placement', async () => {
    const result = await validateAssets({...fixture, readFile: memoryReader(fixture.files)});
    expect(result.errors).toEqual([]); expect(result.checks).toHaveLength(18);
  });
  test('catches wrong mappings, hashes, duplicate IDs, missing files and mutated pivots/placement', async () => {
    const registration = clone(fixture.registration), files = new Map(fixture.files);
    registration.assets[0].curio = 'tape'; registration.assets[1].sha256 = '0'.repeat(64);
    registration.assets[2].wholeImagePlacement.left = 400; registration.assets[3].id = registration.assets[4].id;
    files.delete(registration.assets[5].webp);
    const result = await validateAssets({...fixture, registration, readFile: memoryReader(files)});
    expect(codes(result)).toEqual(expect.arrayContaining(['STATE_MAPPING', 'STATE_PATH_MAPPING', 'STATE_HASH', 'PLACEMENT_REGISTRATION', 'DUPLICATE_STATE_ID', 'ASSET_READ_OR_DECODE', 'REGISTRATION_SNAPSHOT']));
  });
  test('18 names referring to repeated visible pixels fail even if transparent RGB differs', async () => {
    const files = new Map(fixture.files), first = fixture.registration.assets[0], second = fixture.registration.assets[1];
    files.set(second.runtime, files.get(first.runtime)!); files.set(second.webp, files.get(first.webp)!);
    expect(codes(await validateAssets({...fixture, readFile: memoryReader(files)}))).toContain('DUPLICATE_VISIBLE_IMAGE');
  });
});

describe('registered production master preserves actual B bytes without alpha tolerances', () => {
  test('single-asset export is deterministic and preserves all on-disk runtime PNGs and the authoring original', async () => {
    const paths = CURIOS.flatMap(id => STAGES.map(state => `assets/runtime/visual-renewal/whole-states-v043/${id}-${state}.png`));
    const before = await Promise.all(paths.map(async name => sha256(await rootReader(name))));
    const originalPath = 'assets/source/visual-renewal/whole-states-v043/tape/tape-clean.png', originalBefore = await rootReader(originalPath);
    const first = await exportWholeCurioState({id: 'tape', state: 'clean', readFile: rootReader});
    const second = await exportWholeCurioState({id: 'tape', state: 'clean', readFile: rootReader});
    expect(first.png.equals(await rootReader(first.entry.runtime))).toBe(true);
    expect(first.png.equals(second.png)).toBe(true); expect(first.webp.equals(second.webp)).toBe(true);
    expect(first.entry.source).toBe(originalPath); expect(first.entry.sourceSha256).toBe(sha256(originalBefore));
    expect(first.entry.canonicalReuse).toBe(false); expect(first.entry.registeredMaster).toEqual(registeredWholeStateMasters['tape-clean']);
    expect((await sharp(first.webp).ensureAlpha().raw().toBuffer()).length).toBe(384 * 384 * 4);
    expect((await rootReader(originalPath)).equals(originalBefore)).toBe(true);
    expect(await Promise.all(paths.map(async name => sha256(await rootReader(name))))).toEqual(before);
  }, 15000);

  test('actual registered master validates exact visible pixels while the other seventeen retain strict source reconstruction', async () => {
    const fixture = await registeredMasterFixture();
    expect((await validateAssets(fixture)).errors).toEqual([]);
    const entry = fixture.registration.assets.find((row: any) => row.id === 'tape-clean');
    const png = await sharp(await fixture.readFile(entry.runtime)).ensureAlpha().raw().toBuffer(), webp = await sharp(await fixture.readFile(entry.webp)).ensureAlpha().raw().toBuffer();
    let mismatch = 0;
    for (let i = 0; i < png.length; i += 4) if (webp[i + 3] !== png[i + 3] || png[i + 3] && !webp.subarray(i, i + 3).equals(png.subarray(i, i + 3))) mismatch++;
    expect(mismatch).toBe(0);
  }, 15000);

  test('master bytes, path, canonical-reuse flag and original-source checksum mutations fail closed', async () => {
    const fixture = await registeredMasterFixture();
    const mutate = async (change: (entry: any, files: Map<string, Buffer>) => void) => {
      const registration = clone(fixture.registration), files = new Map(fixture.files), entry = registration.assets.find((row: any) => row.id === 'tape-clean');
      change(entry, files);
      return codes(await validateAssets({...fixture, registration, readFile: memoryReader(files, true)}));
    };
    expect(await mutate((entry, files) => files.set(entry.registeredMaster.path, Buffer.from('replaced-master')))).toContain('ASSET_READ_OR_DECODE');
    expect(await mutate(entry => {entry.registeredMaster.path = entry.source;})).toContain('REGISTERED_MASTER_METADATA');
    expect(await mutate(entry => {entry.canonicalReuse = true;})).toContain('REGISTERED_MASTER_CANONICAL_REUSE');
    expect(await mutate(entry => {entry.sourceSha256 = '0'.repeat(64);})).toContain('STATE_HASH');
    expect(await mutate(entry => {delete entry.registeredMaster;})).toContain('REGISTERED_MASTER_METADATA');
    const wrongMaster = registeredWholeStateMasters['tape-clean'].path;
    await expect(exportWholeCurioState({id: 'tape', state: 'clean', readFile: async name => name === wrongMaster ? rootReader('assets/runtime/visual-renewal/whole-states-v043/tape-stabilized.png') : rootReader(name)})).rejects.toThrow('registered production master bytes');
    await expect(exportWholeCurioState({id: 'tape', state: 'clean', raw: await rootReader('assets/source/visual-renewal/whole-states-v043/tape/tape-found.png'), readFile: rootReader})).rejects.toThrow('original authoring source');
  }, 30000);
});

describe('production contract probes inspect executable selectors and forced preview events', () => {
  test('current formal selectors and actual Fusion production import graph satisfy the contract', async () => {
    expect((await validateRuntimeContracts({readFile: rootReader})).errors).toEqual([]);
  });
  test('a timer-selected upgrade, cropped draw or abandoned state import is caught', async () => {
    const name = 'src/fusion/curio-state-images.ts', original = (await readFile(name)).toString();
    const mutations = [original.replace('${state.condition}', "${state.action ? 'stabilized' : state.condition}"), original.replace('drawImage(image, 0, 0, size, size)', 'drawImage(image, 0, 0, 32, 32, 0, 0, size, size)'), original.replace('whole-states-v043/*.webp', 'curios/*.webp')];
    const expected = ['SAVED_STATE_SELECTOR', 'WHOLE_IMAGE_DRAW', 'STATIC_STATE_IMPORT'];
    for (let i = 0; i < mutations.length; i++) expect(codes(await validateRuntimeContracts({readFile: memoryReader(new Map([[name, Buffer.from(mutations[i])]]), true)}))).toContain(expected[i]);
  });
  test('removing payment gate or charging from preview is caught without altering the actual source', async () => {
    const name = 'src/fusion/ui.ts', original = (await readFile(name)).toString();
    const removedGate = original.replace("if (body.dataset.imagePreview==='true'&&['fusion-paper-primary','fusion-curio-primary','fusion-try','fusion-ability-upgrade'].includes(button.id))return;", '');
    expect(codes(await validateRuntimeContracts({readFile: memoryReader(new Map([[name, Buffer.from(removedGate)]]), true)}))).toContain('PREVIEW_PAYMENT_GATE');
    const chargedPreview = original.replace("query('#fusion-state-preview').hidden=false", "await act({type:'repair'});query('#fusion-state-preview').hidden=false");
    expect(codes(await validateRuntimeContracts({readFile: memoryReader(new Map([[name, Buffer.from(chargedPreview)]]), true)}))).toContain('PREVIEW_MUTATION');
  });
  test('a card/return selector that grants the next condition before archive commit is rejected', async () => {
    const name = 'src/fusion/curio-state-images.ts', original = (await readFile(name)).toString();
    const premature = original.replace("return id==='receipt'?save.receipt.condition", "return id==='receipt'?(save.receipt.action?'stabilized':save.receipt.condition)");
    expect(premature).not.toBe(original);
    expect(codes(await validateRuntimeContracts({readFile: memoryReader(new Map([[name, Buffer.from(premature)]]), true)}))).toContain('FORMAL_SAVED_CONDITION');
  });
});

describe('fixed-package provenance is measured rather than manually declared PASS', () => {
  test('computes deterministic tree hashes and decodes actual archive members', () => {
    const a: [string, Buffer][] = [['src/a.ts', Buffer.from('a')], ['assets/runtime/a.webp', Buffer.from('b')]];
    expect(hashRuntimeEntries(a)).toBe(hashRuntimeEntries([...a].reverse()));
    expect(hashRuntimeEntries(a)).not.toBe(hashRuntimeEntries([a[0], ['assets/runtime/a.webp', Buffer.from('changed')]]));
    expect([...readZipEntries(zip([['loststar-fusion/index.html', '<html>actual bytes</html>']])).keys()]).toEqual(['loststar-fusion/index.html']);
    expect(() => readZipEntries(Buffer.from('PKfake'))).toThrow();
  });
  test('accepts concrete hashed report assertions; missing fresh proof stays visibly pending', async () => {
    const fixture = proofFixture();
    expect((await validateProof({...fixture, binding, git, mode: 'delivery'})).errors).toEqual([]);
    fixture.files.delete('proof.json');
    expect((await validateProof({...fixture, binding, git})).gaps?.[0].code).toBe('DELIVERY_PROOF_MISSING');
  });
  test('an ignored frozen ZIP missing from CI is blocking pending evidence only in static mode', async () => {
    const fixture = proofFixture(), originalReader = fixture.readFile;
    const readFile = async (name: string) => {
      if (name === 'archive.zip') throw Object.assign(Error('Frozen local ZIP is not checked out in CI'), {code: 'ENOENT'});
      return originalReader(name);
    };
    const staticResult = await validateProof({...fixture, readFile, binding, git, mode: 'static'});
    expect(staticResult.errors).toEqual([]);
    expect(staticResult.gaps).toEqual([expect.objectContaining({code: 'FIXED_ARCHIVE_NOT_AVAILABLE'})]);
    expect(staticResult.checks).toEqual([expect.objectContaining({id: 'unit:state'})]);
    const strictResult = await validateProof({...fixture, readFile, binding, git, mode: 'delivery'});
    expect(codes(strictResult)).toContain('PROOF_FILE_INVALID');
    expect(strictResult.gaps?.some(gap => gap.code === 'FIXED_ARCHIVE_NOT_AVAILABLE')).toBe(false);
    fixture.files.set('screen.png', Buffer.from('replacement-media'));
    expect(codes(await validateProof({...fixture, readFile, binding, git, mode: 'static'}))).toContain('PROOF_FILE_INVALID');
  });
  test('archive bytes, version, tree, report assertions and false phone/user records fail closed', async () => {
    const fixture = proofFixture();
    fixture.proof.runtimeVersion = '0.4.3'; fixture.proof.runtimeTreeHash = '0'.repeat(64);
    fixture.proof.checks[0].assertions = [{kind: 'json', pointer: '/status', equals: 'PASS'}];
    fixture.acceptance.requirements[0].phone = 'PASS_WITH_DEVICE_RECORD'; fixture.acceptance.requirements[0].visual = 'USER_ACCEPTED';
    fixture.files.set('archive.zip', Buffer.from('PKchanged bytes')); fixture.files.set('proof.json', Buffer.from(JSON.stringify(fixture.proof)));
    const result = await validateProof({...fixture, binding, git, mode: 'delivery'});
    expect(codes(result)).toEqual(expect.arrayContaining(['PROOF_VERSION', 'STALE_RUNTIME_PROOF', 'PROOF_FILE_INVALID', 'PROOF_ASSERTION', 'PHONE_PASS_UNPROVEN', 'USER_ACCEPTANCE_UNPROVEN', 'UNVERIFIED_REQUIREMENT_CHECK']));
  });
  test('runtime/original tree mutation on an evidence-only commit and stale media are detected', async () => {
    const fixture = proofFixture(); fixture.files.set('screen.png', Buffer.from('stale-or-replaced-media'));
    const changedGit = {...git, tree: (commit: string) => commit === sourceSha ? 'c'.repeat(40) : 'e'.repeat(40)};
    expect(codes(await validateProof({...fixture, binding, git: changedGit, mode: 'delivery'}))).toEqual(expect.arrayContaining(['EVIDENCE_ONLY_TREE_CHANGED', 'PROOF_FILE_INVALID', 'UNBOUND_REQUIREMENT_PROOF']));
  });
  test('unknown modes are rejected instead of falling back to a permissive gate', async () => {
    await expect(validateAcceptance({mode: 'PASS'})).rejects.toThrow('Unknown execution gate mode');
  });
});
