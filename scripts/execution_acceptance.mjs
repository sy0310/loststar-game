/**
 * Executable evidence gate, separate from artistic/user acceptance.
 * Every validator accepts an injected readFile, so adversarial tests never edit originals.
 * Evidence schema and the runtime digest algorithm are exported for capture tooling.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {inflateRawSync} from 'node:zlib';
import sharp from 'sharp';
import {parse} from '@babel/parser';
import {renderExecutionCoverage} from './render_execution_coverage.mjs';

export const CURIOS = ['receipt', 'tape', 'nested', 'stamp', 'cosmic-parcel', 'bell'];
export const STAGES = ['found', 'clean', 'stabilized'];
export const MINIMUM_REQUIREMENT_IDS = ['ART-01', 'ART-02', 'INT-01', 'INT-02', 'ART-03', 'ART-04', 'ART-05', 'UI-01', 'WORLD-01', 'DATA-01', 'PERF-01', 'DEL-01'];
export const REGISTRATION_PATH = 'assets/runtime/visual-renewal/whole-states-v043/registration.json';
export const REGISTRY_PATH = 'design/visual-renewal/ASSET_REGISTRY.json';
export const RUNTIME_ROOTS = ['src', 'assets/runtime', 'assets/source'];
const ROOT_RUNTIME_FILES = ['index.html', 'package.json', 'package-lock.json', 'tsconfig.json'];
const HASH = /^[0-9a-f]{64}$/;
const COMMIT = /^[0-9a-f]{40}$/;
const arrays = ['code', 'assets', 'entrypoints', 'checks', 'proofs'];
const dimensions = {implementation: ['TODO', 'IN_PROGRESS', 'IMPLEMENTED', 'BLOCKED'], evidence: ['MISSING', 'STALE', 'CURRENT_VERIFIED'], visual: ['NOT_REVIEWED', 'INTERNAL_CHANGES_REQUIRED', 'INTERNAL_PASS', 'USER_ACCEPTED'], phone: ['NOT_TESTED', 'ISSUES_FOUND', 'PASS_WITH_DEVICE_RECORD']};
export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const filePath = ref => typeof ref === 'string' ? ref : ref?.path;
const failure = (code, message, requirement) => ({code, message, ...(requirement ? {requirement} : {})});

export function isRepoPath(value) {
  return typeof value === 'string' && value.length > 0 && !path.posix.isAbsolute(value) && !value.includes('\\') && !value.split('/').some(p => p === '..' || p === '.' || p === '') && !/^[a-z]+:/i.test(value) && !/[?#\0]/.test(value);
}

export function createReader(root) {
  const base = path.resolve(root);
  return async relative => {
    if (!isRepoPath(relative)) throw Error(`Unsafe or non-file repository path: ${relative}`);
    const absolute = await fs.realpath(path.resolve(base, relative));
    if (!absolute.startsWith(`${base}${path.sep}`)) throw Error(`File escapes repository: ${relative}`);
    return fs.readFile(absolute);
  };
}

/** sha256(sorted(`${POSIX path}\0${sha256(bytes)}\n`)); no timestamps or Git metadata. */
export function hashRuntimeEntries(entries) {
  return sha256([...entries].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([name, bytes]) => `${name}\0${sha256(bytes)}\n`).join(''));
}

export async function collectRuntimeBinding(root, source = 'HEAD') {
  const git = args => execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  const runtimeSourceSha = git(['rev-parse', `${source}^{commit}`]);
  const reader = createReader(root), entries = [];
  async function walk(relative) {
    for (const item of await fs.readdir(path.join(root, relative), {withFileTypes: true})) {
      const name = `${relative}/${item.name}`;
      if (item.isDirectory()) await walk(name);
      else entries.push([name, await reader(name)]);
    }
  }
  for (const dir of RUNTIME_ROOTS) await walk(dir);
  const rootNames = await fs.readdir(root);
  for (const name of [...ROOT_RUNTIME_FILES, ...rootNames.filter(n => /^vite.*\.ts$/.test(n))]) entries.push([name, await reader(name)]);
  return {runtimeSourceSha, runtimeTreeHash: hashRuntimeEntries(entries), originalTrees: Object.fromEntries(RUNTIME_ROOTS.map(name => [name, git(['rev-parse', `${runtimeSourceSha}:${name}`])]))};
}

export function gitEvidenceContext(root) {
  const git = args => execFileSync('git', args, {cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  return {head: git(['rev-parse', 'HEAD']), tree: (commit, name) => git(['rev-parse', `${commit}:${name}`]), isAncestor: commit => {try {git(['merge-base', '--is-ancestor', commit, 'HEAD']); return true;} catch {return false;}}};
}

function visibleBytes(data) {
  const out = Buffer.from(data);
  for (let i = 0; i < out.length; i += 4) if (out[i + 3] === 0) out.fill(0, i, i + 3);
  return out;
}

async function decode(bytes) {
  return sharp(bytes, {failOn: 'warning'}).ensureAlpha().raw().toBuffer({resolveWithObject: true});
}

export async function validateAssets({registry, registration, readFile}) {
  const errors = [], checks = [], digests = new Map();
  const error = (code, message) => errors.push(failure(code, message, 'ART-01'));
  let exportBounds, exportMasters = {};
  try {
    const exporter = (await readFile('scripts/export_whole_curio_states.mjs')).toString();
    const declarations = parseFile('exporter.mjs', exporter).program.body.filter(node => node.type === 'VariableDeclaration').flatMap(node => node.declarations);
    const value = name => {const declaration = declarations.find(item => item.id?.name === name); return declaration?.init ? vm.runInNewContext(`(${exporter.slice(declaration.init.start, declaration.init.end)})`, {}, {timeout: 1000}) : undefined;};
    exportBounds = value('bounds'); exportMasters = value('registeredWholeStateMasters') ?? {};
    if (!exportBounds) throw Error('Missing deterministic identity bounds');
  } catch (cause) {error('EXPORT_BOUNDS', cause.message);}
  const registered = new Map();
  for (const row of registry.files ?? []) {
    if (registered.has(row.path)) error('DUPLICATE_ASSET_PATH', row.path);
    registered.set(row.path, row);
  }
  const expected = CURIOS.flatMap(id => STAGES.map(stage => `${id}-${stage}`));
  const entries = registration.assets ?? [];
  if (entries.length !== 18) error('STATE_COUNT', `Expected 18 state registrations, found ${entries.length}`);
  if (registry.completeCurioStateCount !== 18 || registry.curioStates?.length !== 18) error('REGISTRY_STATE_COUNT', 'Canonical registry must contain exactly 18 complete states');
  const seen = new Set(), canonical = new Set();
  for (const item of registry.curioStates ?? []) {
    const key = `${item.id}-${item.state}`;
    if (canonical.has(key)) error('DUPLICATE_CANONICAL_STATE', key);
    canonical.add(key);
    if (!expected.includes(key) || item.path !== `assets/runtime/visual-renewal/whole-states-v043/${key}.png`) error('CANONICAL_STATE_MAPPING', key);
  }
  const snapshot = registry.moduleRegistrations?.find(row => row.path === REGISTRATION_PATH);
  if (!snapshot || !equal(snapshot.data, registration)) error('REGISTRATION_SNAPSHOT', 'Canonical registry registration snapshot differs from runtime registration');
  for (const module of registry.moduleRegistrations ?? []) {
    try {
      const actual = JSON.parse((await readFile(module.path)).toString());
      if (!equal(module.data, actual)) error('MODULE_REGISTRATION_SNAPSHOT', module.path);
      for (const asset of actual.assets ?? []) for (const field of ['pivot', 'contact', 'support']) {
        const point=asset[field];
        if(point&&typeof point==='object'&&!(Array.isArray(point)?point.length===2&&point.every(Number.isFinite):Number.isFinite(point.x)&&Number.isFinite(point.y)))error('PIVOT_REGISTRATION', `${module.path}/${asset.id}/${field}`);
      }
    } catch (cause) {error('MODULE_REGISTRATION_READ', `${module.path}: ${cause.message}`);}
  }
  for (const entry of entries) {
    const key = `${entry.curio}-${entry.state}`;
    if (seen.has(entry.id)) error('DUPLICATE_STATE_ID', entry.id);
    seen.add(entry.id);
    if (!expected.includes(key) || key !== entry.id) error('STATE_MAPPING', `${entry.id}: unexpected curio/state mapping`);
    const base = `assets/runtime/visual-renewal/whole-states-v043/${key}`;
    const original = `assets/source/visual-renewal/whole-states-v043/${entry.curio}/${key}.png`;
    if (entry.runtime !== `${base}.png` || entry.webp !== `${base}.webp` || entry.source !== original) error('STATE_PATH_MAPPING', key);
    if (entry.width !== 384 || entry.height !== 384 || entry.logicalSize !== 192) error('STATE_DIMENSIONS', key);
    if (typeof entry.canonicalReuse !== 'boolean' || entry.canonicalReuse && entry.state !== 'stabilized') error('SOURCE_ORIGIN', `${key}: reuse must be explicit and only approved stabilized images may be reused`);
    const expectedMaster = exportMasters[key];
    if ((entry.registeredMaster || expectedMaster) && (!expectedMaster || !equal(entry.registeredMaster, expectedMaster))) error('REGISTERED_MASTER_METADATA', `${key}: production master metadata must exactly match the explicit exporter registration`);
    if ((entry.registeredMaster || expectedMaster) && entry.canonicalReuse) error('REGISTERED_MASTER_CANONICAL_REUSE', `${key}: an archived B production master is not approved-C reuse`);
    try {
      const sourceRaw = await readFile(entry.source), pngRaw = await readFile(entry.runtime), webpRaw = await readFile(entry.webp);
      const source = await decode(sourceRaw), png = await decode(pngRaw), webp = await decode(webpRaw);
      for (const [name, raw, image] of [[entry.source, sourceRaw, source], [entry.runtime, pngRaw, png], [entry.webp, webpRaw, webp]]) {
        const row = registered.get(name);
        if (!row || row.bytes !== raw.length || row.sha256 !== sha256(raw) || row.width !== image.info.width || row.height !== image.info.height) error('FILE_REGISTRATION', `${key}: missing/stale bytes/hash/dimensions for ${name}`);
      }
      if (entry.sourceSha256 !== sha256(sourceRaw) || entry.sha256 !== sha256(pngRaw)) error('STATE_HASH', key);
      if (png.info.width !== 384 || png.info.height !== 384 || webp.info.width !== 384 || webp.info.height !== 384) error('DECODED_DIMENSIONS', key);
      const pngVisible = visibleBytes(png.data), webpVisible = visibleBytes(webp.data);
      if (!pngVisible.equals(webpVisible)) error('PNG_WEBP_MISMATCH', key);
      let visible = 0, transparent = 0;
      for (let i = 3; i < png.data.length; i += 4) {if (png.data[i] > 8) visible++; if (png.data[i] === 0) transparent++;}
      if (!visible || !transparent) error('INVISIBLE_OR_OPAQUE_STATE', key);
      const digest = sha256(pngVisible);
      if (digests.has(digest)) error('DUPLICATE_VISIBLE_IMAGE', `${key} duplicates ${digests.get(digest)}`);
      digests.set(digest, key);
      const placement = entry.wholeImagePlacement, size = entry.wholeImageSize, crop = entry.sourceExteriorCrop;
      if (![placement?.left, placement?.top, size?.width, size?.height].every(Number.isInteger) || placement.left < 0 || placement.top < 0 || size.width <= 0 || size.height <= 0 || placement.left + size.width > 384 || placement.top + size.height > 384) error('PLACEMENT_REGISTRATION', key);
      if (entry.registeredMaster || expectedMaster) {
        const master = expectedMaster;
        if (!master || !isRepoPath(master.path) || !HASH.test(master.sha256) || !COMMIT.test(master.originCommit) || !COMMIT.test(master.originBlobSha1) || master.originRuntimePath !== entry.runtime || master.originalSourceSha256 !== entry.sourceSha256 || !master.reason) throw Error(`${key}: invalid master origin/source registration`);
        const masterRaw = await readFile(master.path), masterImage = await decode(masterRaw), masterMetadata = await sharp(masterRaw).metadata(), masterRow = registered.get(master.path);
        const blobSha1 = createHash('sha1').update(`blob ${masterRaw.length}\0`).update(masterRaw).digest('hex');
        if (sha256(masterRaw) !== master.sha256 || blobSha1 !== master.originBlobSha1 || !masterRaw.equals(pngRaw)) error('REGISTERED_MASTER_BYTES', `${key}: runtime PNG must be the byte-identical checksummed production master`);
        if (masterMetadata.format !== 'png' || !masterMetadata.hasAlpha || masterImage.info.width !== 384 || masterImage.info.height !== 384) error('REGISTERED_MASTER_DIMENSIONS', key);
        if (!masterRow || masterRow.bytes !== masterRaw.length || masterRow.sha256 !== sha256(masterRaw) || masterRow.width !== 384 || masterRow.height !== 384) error('REGISTERED_MASTER_FILE', `${key}: master must be indexed with actual bytes, hash and dimensions`);
        let hasTransparent = false, hasVisible = false;
        for (let i = 3; i < masterImage.data.length; i += 4) {hasTransparent ||= masterImage.data[i] === 0; hasVisible ||= masterImage.data[i] > 8;}
        if (!hasTransparent || !hasVisible) error('REGISTERED_MASTER_ALPHA', key);
        if (!equal({width: source.info.width, height: source.info.height}, master.originalSourceDimensions) || sha256(sourceRaw) !== master.originalSourceSha256) error('REGISTERED_MASTER_ORIGINAL_SOURCE', key);
        let left = source.info.width, top = source.info.height, right = 0, bottom = 0;
        for (let y = 0; y < source.info.height; y++) for (let x = 0; x < source.info.width; x++) if (source.data[(y * source.info.width + x) * 4 + 3] > 8) {left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);}
        const actualCrop = {left, top, width: right - left, height: bottom - top};
        if (!equal(crop, actualCrop) || !equal(crop, master.originalExport.sourceExteriorCrop) || !equal(size, master.originalExport.wholeImageSize) || !equal(placement, master.originalExport.wholeImagePlacement)) error('REGISTERED_MASTER_SOURCE_MAPPING', `${key}: original source crop, size and support placement must stay registered`);
        const b = exportBounds?.[entry.curio];
        if (!Array.isArray(b) || b.length !== 4 || !b.every(Number.isFinite)) throw Error(`${key}: missing identity support bounds`);
        const scale = Math.min(Math.round((b[2] - b[0]) * 2) / actualCrop.width, Math.round((b[3] - b[1]) * 2) / actualCrop.height);
        const analyticalSize = {width: Math.round(actualCrop.width * scale), height: Math.round(actualCrop.height * scale)}, analyticalPlacement = {left: Math.round(b[0] + b[2] - analyticalSize.width / 2), top: Math.round(b[3] * 2 - analyticalSize.height)};
        if (!equal(size, analyticalSize) || !equal(placement, analyticalPlacement)) error('IDENTITY_SUPPORT_MAPPING', `${key}: master retains the original whole-image identity support geometry`);
        const provenance = JSON.parse((await readFile(master.provenance)).toString()), trace = provenance.productionMasters?.[entry.state];
        if (!trace || trace.file !== path.posix.basename(master.path) || trace.sha256 !== master.sha256 || trace.originCommit !== master.originCommit || trace.originRuntimePath !== master.originRuntimePath || trace.originBlobSha1 !== master.originBlobSha1 || trace.originalSource !== entry.source || trace.originalSourceSha256 !== master.originalSourceSha256 || trace.newDrawing !== false || trace.canonicalReuse !== false) error('REGISTERED_MASTER_PROVENANCE', `${key}: production master must link the preserved authoring original and recorded V0.4.3 runtime/blob, without claiming a new drawing or approved-C reuse`);
      } else if (entry.canonicalReuse) {
        if (!sourceRaw.equals(pngRaw) || crop !== null || !equal(placement, {left: 0, top: 0}) || !equal(size, {width: 384, height: 384})) error('REUSE_NOT_BYTE_IDENTICAL', key);
      } else if (![crop?.left, crop?.top, crop?.width, crop?.height].every(Number.isInteger) || crop.left < 0 || crop.top < 0 || crop.width <= 0 || crop.height <= 0 || crop.left + crop.width > source.info.width || crop.top + crop.height > source.info.height) error('SOURCE_CROP', key);
      else {
        // Reconstruct the documented whole-image export. This checks mapping, not an author's PASS.
        let left = source.info.width, top = source.info.height, right = 0, bottom = 0;
        for (let y = 0; y < source.info.height; y++) for (let x = 0; x < source.info.width; x++) if (source.data[(y * source.info.width + x) * 4 + 3] > 8) {left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);}
        if (!equal(crop, {left, top, width: right - left, height: bottom - top})) error('EXTERIOR_ONLY_CROP', key);
        const bounds = exportBounds?.[entry.curio];
        if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite)) throw Error(`${key}: missing identity support bounds`);
        const object = await sharp(sourceRaw).extract(crop).resize({width: Math.round((bounds[2] - bounds[0]) * 2), height: Math.round((bounds[3] - bounds[1]) * 2), fit: 'inside', kernel: 'nearest'}).png().toBuffer();
        const actualSize = await sharp(object).metadata(), actualPlacement = {left: Math.round(bounds[0] + bounds[2] - actualSize.width / 2), top: Math.round(bounds[3] * 2 - actualSize.height)};
        if (!equal(size, {width: actualSize.width, height: actualSize.height}) || !equal(placement, actualPlacement)) error('IDENTITY_SUPPORT_MAPPING', `${key}: exported size/placement differs from identity support bounds`);
        // Match the actual exporter through its PNG output boundary before
        // decoding RGBA. A raw libvips pipeline can retain a premultiplied
        // intermediate; that is not the exported image the player receives.
        const reconstructedPng=await sharp({create: {width: 384, height: 384, channels: 4, background: '#00000000'}}).composite([{input: object, ...placement}]).png({compressionLevel:9}).toBuffer();
        const reconstructed=(await decode(reconstructedPng)).data;
        if (!visibleBytes(reconstructed).equals(pngVisible)) {
          let pixels=0,alpha=0,maxChannelDelta=0;const samples=[];
          for(let i=0;i<reconstructed.length;i+=4){
            if(reconstructed[i+3]!==png.data[i+3])alpha++;
            if((reconstructed[i+3]||png.data[i+3])&&[0,1,2,3].some(k=>reconstructed[i+k]!==png.data[i+k])){
              pixels++;for(let k=0;k<4;k++)maxChannelDelta=Math.max(maxChannelDelta,Math.abs(reconstructed[i+k]-png.data[i+k]));
              if(samples.length<8)samples.push({x:i/4%384,y:Math.floor(i/4/384),expected:[...png.data.subarray(i,i+4)],reconstructed:[...reconstructed.subarray(i,i+4)]});
            }
          }
          error('SOURCE_EXPORT_MAPPING', `${key}: recorded whole-image placement does not reproduce runtime pixels; ${JSON.stringify({pixels,alpha,maxChannelDelta,samples,platform:process.platform,arch:process.arch,versions:sharp.versions})}`);
        }
      }
      checks.push({id: `asset:${key}`, source: entry.source, runtime: entry.runtime, visibleSha256: digest});
    } catch (cause) {error('ASSET_READ_OR_DECODE', `${key}: ${cause.message}`);}
  }
  for (const id of expected) if (!seen.has(id) || !canonical.has(id)) error('MISSING_STATE', id);
  return {errors, checks};
}

function parseFile(_name, source) {return parse(source, {sourceType: 'module', plugins: ['typescript']});}
function visitAst(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') visit(node);
  for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(child => visitAst(child, visit)); else if (value && typeof value === 'object' && typeof value.type === 'string') visitAst(value, visit);
}
function namedFunction(source, name) {
  const file = parseFile('runtime.ts', source);
  return file.program.body.map(node => node.type === 'ExportNamedDeclaration' ? node.declaration : node).find(node => node?.type === 'FunctionDeclaration' && node.id?.name === name);
}
function executeFunction(source, name, globals, expression) {
  const node = namedFunction(source, name);
  if (!node?.body) throw Error(`Missing runtime function ${name}`);
  // Strip only parsed TypeScript type spans; do not rewrite runtime expressions.
  // TS7 no longer exposes its old JS compiler API, so this uses the parser already in the lockfile.
  const ranges = [];
  visitAst(node, child => {
    if (child.type === 'TSTypeAnnotation' || child.type === 'TSTypeParameterDeclaration') ranges.push([child.start, child.end]);
    if (child.type === 'TSAsExpression' || child.type === 'TSSatisfiesExpression') ranges.push([child.expression.end, child.end]);
    if (child.type === 'TSNonNullExpression') ranges.push([child.expression.end, child.end]);
  });
  const removed = new Set(); for (const [start, end] of ranges) for (let i = start; i < end; i++) removed.add(i);
  const compiled = [...source.slice(node.start, node.end)].filter((_, index) => !removed.has(node.start + index)).join('');
  return vm.runInNewContext(`${compiled}\n${expression}`, globals, {timeout: 1000});
}

/** Probe actual selectors/draw functions and verify their reachable production import chain. */
export async function validateRuntimeContracts({readFile}) {
  const errors = [], checks = [], sources = new Map();
  const error = (code, message) => errors.push(failure(code, message, 'INT-01'));
  async function source(name) {if (!sources.has(name)) sources.set(name, (await readFile(name)).toString()); return sources.get(name);}
  try {
    const selectorPath = 'src/fusion/curio-state-images.ts', selector = await source(selectorPath);
    const glob = "../../assets/runtime/visual-renewal/whole-states-v043/*.webp";
    const selectorAst = parseFile(selectorPath, selector);
    let actualGlob = false;
    visitAst(selectorAst, node => {if (node.type === 'CallExpression' && selector.slice(node.callee.start, node.callee.end) === 'import.meta.glob' && node.arguments[0]?.value === glob && /eager\s*:\s*true/.test(selector.slice(node.arguments[1]?.start, node.arguments[1]?.end))) actualGlob = true;});
    if (!actualGlob) error('STATIC_STATE_IMPORT', 'Production selector must eagerly import the registered whole-state WebP directory');
    const urls = Object.fromEntries(CURIOS.flatMap(id => STAGES.map(stage => [`../../assets/runtime/visual-renewal/whole-states-v043/${id}-${stage}.webp`, `${id}-${stage}`])));
    for (const id of CURIOS) for (const condition of STAGES) {
      for (const action of [undefined, {kind: 'clean', startedAt: 0, endsAt: -1}, {kind: 'repair', startedAt: 0, endsAt: 1}]) {
        const state = {condition, ...(action ? {action} : {})}, before = JSON.stringify(state);
        const key = executeFunction(selector, 'curioStateImageKey', {id, state}, 'curioStateImageKey(id,state)');
        if (key !== `${id}-${condition}` || JSON.stringify(state) !== before) error('SAVED_STATE_SELECTOR', `${id}/${condition}: in-flight state changed selection or saved state`);
      }
      const url = executeFunction(selector, 'curioStateImageUrl', {id, condition, urls}, 'curioStateImageUrl(id,condition)');
      if (url !== `${id}-${condition}`) error('STATE_URL_MAPPING', `${id}/${condition}`);
      const image = {naturalWidth: 384}, calls = [];
      const context = new Proxy({}, {get: (_, name) => (...args) => calls.push([name, ...args]), set: () => {calls.push(['write']); return true;}});
      const result = executeFunction(selector, 'drawWholeCurioState', {context, id, state: {condition}, curioStateImage: () => image}, 'drawWholeCurioState(context,id,state,384)');
      if (result !== true || calls.length !== 1 || calls[0][0] !== 'drawImage' || calls[0][1] !== image || !equal(calls[0].slice(2), [0, 0, 384, 384])) error('WHOLE_IMAGE_DRAW', `${id}/${condition}: expected one uncropped drawImage`);
    }
    const condition = await source('src/fusion/curio-condition.ts');
    const materialNode = namedFunction(condition, 'prepareCurioMaterial');
    const material = materialNode ? condition.slice(materialNode.start, materialNode.end) : '';
    if (!/drawWholeCurioState\(context,\s*id,\s*state,\s*384\)/.test(material) || !/whole-v043\/\$\{id\}\/\$\{state\.condition\}/.test(material) || /paintPhysicalRig\(|prepareParts\(|destination-(?:out|in)|putImageData\(/.test(material)) error('MATERIAL_SELECTION', 'Physical material must use the saved whole state without slices or progress-selected images');
    // The production support anchors remain explicit for every identity and are actually used.
    const model = await source('src/fusion/curio-renewal-model.ts');
    for (const id of CURIOS) {
      const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (!new RegExp(`(?:['"]${escaped}['"]|\\b${escaped})\\s*:\\s*\\{material:[^}]*support:`).test(model)) error('SUPPORT_ANCHOR_MISSING', `${id}: missing registered support anchor`);
    }
    if (!condition.includes('renewalCurioRegistration[id].support')) error('SUPPORT_ANCHOR_UNUSED', 'Workbench must use the registered identity support anchor');
    const art = await source('src/fusion/renewal-ui.ts');
    for (const id of CURIOS) for (const condition of STAGES) {
      const selected = executeFunction(art, 'renewalArtUrl', {id, condition, isRenewalCurio: candidate => CURIOS.includes(candidate), curioStateImageUrl: (candidate, stage) => `${candidate}-${stage}`}, 'renewalArtUrl(id,condition)');
      if (selected !== `${id}-${condition}`) error('FORMAL_CARD_STATE_SELECTOR', `${id}/${condition}: card/discovery/return path must call the shared state URL selector`);
      for (const action of [undefined, {kind: 'repair', startedAt: 0, endsAt: -1}]) {
        const save = {receipt: {condition, action}, curios: Object.fromEntries(CURIOS.filter(item => item !== 'receipt').map(item => [item, {condition, action}]))}, before = JSON.stringify(save);
        if (executeFunction(selector, 'savedCurioCondition', {save, id}, 'savedCurioCondition(save,id)') !== condition || before !== JSON.stringify(save)) error('FORMAL_SAVED_CONDITION', `${id}/${condition}: formal entry must use durable archive condition without mutating it`);
      }
    }
    const ui = await source('src/fusion/ui.ts');
    const previewStart = ui.indexOf('if (button.dataset.imagePreviewCondition');
    const previewEnd = ui.indexOf("if (button.id==='fusion-state-preview-close')", previewStart);
    const preview = ui.slice(previewStart, previewEnd);
    if (previewStart < 0 || previewEnd < 0 || !preview.includes('curioStateImageUrl') || /\b(?:act|dispatch|transact|save|setItem)\s*\(|controller\.state\s*=|\.condition\s*=/.test(preview)) error('PREVIEW_MUTATION', 'Read-only preview handler missing or performs a state/payment operation');
    const gate = /if\s*\(body\.dataset\.imagePreview==='true'&&\['fusion-paper-primary','fusion-curio-primary','fusion-try','fusion-ability-upgrade'\]\.includes\(button\.id\)\)return;/.exec(ui);
    if (!gate || gate.index > ui.indexOf("if (button.id === 'fusion-paper-primary')")) error('PREVIEW_PAYMENT_GATE', 'Forced action events must be rejected during read-only preview before handlers run');
    // A root-to-selector reachability check prevents testing an abandoned helper.
    const visited = new Set(), todo = ['src/fusion/entry.ts'];
    while (todo.length) {
      const name = todo.pop(); if (visited.has(name)) continue; visited.add(name);
      const ast = parseFile(name, await source(name));
      for (const node of ast.program.body) if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) && node.source?.value) {
        if (node.importKind === 'type' || node.exportKind === 'type') continue;
        const specifier = node.source.value;
        if (specifier.startsWith('.') && !/\.(?:json|css|png|webp|svg)$/.test(specifier)) todo.push(`${path.posix.normalize(path.posix.join(path.posix.dirname(name), specifier))}${/\.ts$/.test(specifier) ? '' : '.ts'}`);
      }
    }
    if (!visited.has(selectorPath) || !visited.has('src/fusion/curio-condition.ts') || !visited.has('src/fusion/ui.ts')) error('PRODUCTION_IMPORT_CHAIN', 'Fusion entry does not reach the shared state renderer and UI');
    const config = await source('vite.fusion.config.ts');
    if (!config.includes('src/fusion/entry.ts') || !config.includes('transformIndexHtml')) error('PACKAGED_ENTRY', 'Fusion package must select the inspected production entry');
    const exportScript = await source('scripts/export_whole_curio_states.mjs');
    if (!exportScript.includes('wholeImagePlacement') || !exportScript.includes('sourceSha256') || !exportScript.includes('canonicalReuse')) error('EXPORT_REGISTRATION', 'Deterministic whole-image exporter is not registered');
    checks.push({id: 'runtime:saved-state-selector', assertions: 54}, {id: 'runtime:whole-image-draw', assertions: 18}, {id: 'runtime:preview-gate'}, {id: 'runtime:production-import-chain', modules: visited.size});
  } catch (cause) {error('RUNTIME_CONTRACT_READ', cause.message);}
  return {errors, checks};
}

/** The minimum table is executable input, so adding a new top-level row cannot silently pass. */
export function minimumIdsFromContract(text) {
  return [...new Set([...text.matchAll(/^\|\s*([A-Z][A-Z0-9]*-\d+)\s*\|/gm)].map(match => match[1]))];
}

/** Source lines that carry instructions, rather than headings, separators or historical prose. */
export function extractNormativeClauses(documentPath, text) {
  const clauses = []; let fenced = false;
  for (const [index, line] of text.split('\n').entries()) {
    if (/^\s*```/.test(line)) {fenced = !fenced; continue;}
    if (fenced || !line.trim() || /^\s*(?:#|>)/.test(line)) continue;
    const table = /^\s*\|/.test(line) && !/^\s*\|[\s:|-]+\|\s*$/.test(line) && !/^\s*\|\s*(?:ID|id|对象|要求|项目|物件|奇物|状态|页面|交付项|模块|检查项|范围|尺寸|步骤|级别|属性|字段|文件|资源|编号|核对对象)\s*\|/i.test(line);
    if (/^\s*(?:[-*]|\d+\.)\s+/.test(line) || table || /必须|不得|不能|禁止|至少/.test(line)) clauses.push({path: documentPath, startLine: index + 1, endLine: index + 1, text: line.trim()});
  }
  return clauses;
}

export async function validateSourceCoverage({acceptance, readFile}) {
  const errors = [], gaps = [], coverage = acceptance?.sourceCoverage;
  if (!coverage?.documents?.length) return {errors, gaps: [failure('SOURCE_COVERAGE_MISSING', 'Original and current normative clauses need a sourceCoverage document inventory')]};
  const allRefs = (acceptance.requirements ?? []).flatMap(row => row.sourceRefs ?? []);
  for (const ref of coverage.informationalRefs ?? []) {
    try {
      const lines = (await readFile(ref.path)).toString().split('\n');
      if (!ref.reason?.trim() || !Number.isInteger(ref.startLine) || !Number.isInteger(ref.endLine) || ref.startLine < 1 || ref.endLine < ref.startLine || ref.endLine > lines.length) throw Error('informational classification needs a real span and explicit reason');
      allRefs.push(ref);
    } catch (cause) {errors.push(failure('INFORMATIONAL_SOURCE_REF', `${ref.path}: ${cause.message}`));}
  }
  const superseded = acceptance.supersededRules ?? [];
  for (const rule of superseded) {
    const original = rule.sourceRefs ?? rule.originalSourceRefs ?? rule.originalRefs ?? [];
    const replacement = rule.replacementSourceRefs ?? rule.replacementRefs ?? [];
    if (!(rule.reason || rule.rule) || !original.length || !replacement.length) {errors.push(failure('SUPERSEDED_RULE_UNPROVEN', 'Superseded clause needs original refs, explicit reason and current replacement refs')); continue;}
    for (const ref of [...original, ...replacement]) {
      try {const lines = (await readFile(ref.path)).toString().split('\n'); if (!Number.isInteger(ref.startLine) || !Number.isInteger(ref.endLine) || ref.startLine < 1 || ref.endLine < ref.startLine || ref.endLine > lines.length) throw Error('invalid source span');}
      catch (cause) {errors.push(failure('SUPERSEDED_RULE_REF', `${ref.path}: ${cause.message}`));}
    }
    allRefs.push(...original);
  }
  for (const name of coverage.documents) {
    try {
      const clauses = extractNormativeClauses(name, (await readFile(name)).toString());
      for (const clause of clauses) if (!allRefs.some(ref => ref.path === name && ref.startLine <= clause.startLine && ref.endLine >= clause.endLine)) gaps.push(failure('SOURCE_CLAUSE_UNMAPPED', `${name}:${clause.startLine}: ${clause.text}`));
    } catch (cause) {errors.push(failure('SOURCE_COVERAGE_FILE', `${name}: ${cause.message}`));}
  }
  return {errors, gaps};
}

export async function validateRequirements({acceptance, readFile, expectedRequirementIds = []}) {
  const errors = [], gaps = [], rows = acceptance?.requirements;
  const error = (code, message, id) => errors.push(failure(code, message, id));
  if (acceptance?.schema !== 1) error('ACCEPTANCE_SCHEMA', 'acceptance.schema must be 1');
  if (!COMMIT.test(acceptance?.baselineRuntime ?? '')) error('BASELINE_RUNTIME', 'baselineRuntime must identify the original full runtime commit SHA');
  if (!Array.isArray(rows) || !rows.length) return {errors: [...errors, failure('REQUIREMENTS_MISSING', 'Canonical registry needs requirement rows')], gaps, ids: []};
  let contractIds = [];
  try {contractIds = minimumIdsFromContract((await readFile('design/visual-renewal/EXECUTION_AND_ART_ACCEPTANCE.md')).toString());} catch (cause) {error('CONTRACT_READ', cause.message);}
  const required = new Set([...MINIMUM_REQUIREMENT_IDS, ...contractIds, ...expectedRequirementIds, ...(acceptance.requiredIds ?? [])]);
  const seen = new Set();
  for (const row of rows) {
    const id = row?.id;
    if (typeof id !== 'string' || !/^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+(?:\.[A-Z0-9][A-Z0-9_-]*)?$/.test(id)) error('REQUIREMENT_ID', `Invalid requirement ID: ${id}`);
    if (seen.has(id)) error('DUPLICATE_REQUIREMENT_ID', id, id);
    seen.add(id);
    if (!Object.hasOwn(row, 'parent') || row.parent !== null && typeof row.parent !== 'string') error('REQUIREMENT_PARENT', 'parent must be null or a requirement ID', id);
    if (row.scope !== 'IN_SCOPE') error('REQUIREMENT_SCOPE', 'Effective requirements cannot silently leave IN_SCOPE', id);
    for (const [field, values] of Object.entries(dimensions)) if (!values.includes(row[field])) error('REQUIREMENT_STATUS', `${field}: ${row[field]}`, id);
    for (const field of ['gap', 'nextAction']) if (typeof row[field] !== 'string') error('REQUIREMENT_FIELD', `Missing ${field}`, id);
    for (const field of arrays) if (!Array.isArray(row[field])) error('REQUIREMENT_FIELD', `${field} must be an array`, id);
    if (!Array.isArray(row.sourceRefs) || !row.sourceRefs.length) error('SOURCE_REFS_MISSING', 'At least one exact source span is required', id);
    for (const ref of row.sourceRefs ?? []) {
      try {
        if (!isRepoPath(ref.path) || !Number.isInteger(ref.startLine) || !Number.isInteger(ref.endLine) || ref.startLine < 1 || ref.endLine < ref.startLine) throw Error('invalid source path/span');
        const lines = (await readFile(ref.path)).toString().split('\n');
        if (ref.endLine > lines.length || !lines.slice(ref.startLine - 1, ref.endLine).some(line => line.trim())) throw Error('source span is empty or out of bounds');
      } catch (cause) {error('SOURCE_REF_INVALID', `${ref?.path}: ${cause.message}`, id);}
    }
    for (const field of ['code', 'assets', 'proofs']) for (const ref of row[field] ?? []) {
      try {const name = filePath(ref); if (!isRepoPath(name)) throw Error('invalid repository file path'); await readFile(name);} catch (cause) {error('REQUIREMENT_FILE_MISSING', `${field}: ${filePath(ref)}: ${cause.message}`, id);}
    }
    for (const entry of row.entrypoints ?? []) {
      const value = typeof entry === 'string' ? entry : entry?.route ?? entry?.path;
      if (typeof value !== 'string' || !value.trim() || /^(?:https?:|javascript:)/i.test(value)) error('ENTRYPOINT_INVALID', `${value}`, id);
      else if (!value.startsWith('/') && !value.startsWith('?') && !value.startsWith('#') && !/^\.[a-z_-][a-z0-9_-]*$|^\[[a-z-]+(?:=["'][^"']+["'])?\]$/i.test(value)) try {await readFile(value);} catch (cause) {error('ENTRYPOINT_FILE_MISSING', `${value}: ${cause.message}`, id);}
    }
    for (const check of row.checks ?? []) if (typeof check !== 'string' && typeof check?.id !== 'string') error('CHECK_ID_INVALID', 'checks require concrete check IDs or {id,path}', id);
    if (row.implementation !== 'IMPLEMENTED') gaps.push(failure('IMPLEMENTATION_PENDING', `${row.implementation}: ${row.gap || 'No completed implementation'}`, id));
    if (row.implementation === 'IMPLEMENTED' && !(row.code?.length || row.assets?.length)) error('IMPLEMENTATION_WITHOUT_FILES', 'Implemented row needs code or asset paths', id);
    if (row.implementation === 'IMPLEMENTED' && !row.entrypoints?.length) gaps.push(failure('ENTRYPOINTS_MISSING', 'Implemented row needs an actual entry point', id));
    if (!row.checks?.length) gaps.push(failure('CHECKS_MISSING', 'No executable check IDs linked', id));
    if (row.evidence !== 'CURRENT_VERIFIED') gaps.push(failure('EVIDENCE_PENDING', `${row.evidence}: ${row.gap}`, id));
    if (row.evidence === 'CURRENT_VERIFIED' && !row.proofs?.length) error('VERIFIED_WITHOUT_PROOF', 'CURRENT_VERIFIED requires actual report/media paths', id);
    if (!['INTERNAL_PASS', 'USER_ACCEPTED'].includes(row.visual)) gaps.push(failure('VISUAL_PENDING', row.visual, id));
    if (row.phone !== 'PASS_WITH_DEVICE_RECORD') gaps.push({...failure('PHONE_PENDING', row.phone, id), pendingAcceptance: true});
    if (row.visual !== 'USER_ACCEPTED') gaps.push({...failure('USER_PENDING', 'Specific version/scope user acceptance remains pending', id), pendingAcceptance: true});
    if (row.implementation !== 'IMPLEMENTED' && !row.nextAction?.trim() || row.implementation === 'BLOCKED' && !row.gap?.trim()) error('PENDING_WITHOUT_ACTION', 'Pending/blocked work needs a gap and next action', id);
  }
  for (const id of required) if (!seen.has(id)) error('REQUIREMENT_OMITTED', `Required ID is absent: ${id}`, id);
  for (const row of rows) if (row.parent && (!seen.has(row.parent) || row.parent === row.id)) error('REQUIREMENT_PARENT', `Unknown/self parent: ${row.parent}`, row.id);
  for (const row of rows) {
    const visited = new Set([row.id]); let parent = row.parent;
    while (parent) {if (visited.has(parent)) {error('REQUIREMENT_PARENT_CYCLE', row.id, row.id); break;} visited.add(parent); parent = rows.find(r => r.id === parent)?.parent;}
  }
  return {errors, gaps, ids: [...seen]};
}

function pointer(object, value) {
  if (value === '') return object;
  if (typeof value !== 'string' || !value.startsWith('/')) throw Error('assertion needs an RFC6901 JSON pointer');
  return value.slice(1).split('/').reduce((result, key) => result?.[key.replace(/~1/g, '/').replace(/~0/g, '~')], object);
}

/** Decode the actual classic ZIP used by package_taptap.py; no shell, temp files or metadata-only checks. */
export function readZipEntries(bytes) {
  let end = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) if (bytes.readUInt32LE(offset) === 0x06054b50 && offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length) {end = offset; break;}
  if (end < 0 || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6)) throw Error('Invalid/multipart ZIP');
  const count = bytes.readUInt16LE(end + 10), centralSize = bytes.readUInt32LE(end + 12), centralStart = bytes.readUInt32LE(end + 16), entries = new Map();
  if (!count || centralStart + centralSize !== end || count !== bytes.readUInt16LE(end + 8)) throw Error('Invalid ZIP central directory');
  let offset = centralStart;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50) throw Error('Invalid ZIP directory entry');
    const flags = bytes.readUInt16LE(offset + 8), method = bytes.readUInt16LE(offset + 10), compressedSize = bytes.readUInt32LE(offset + 20), size = bytes.readUInt32LE(offset + 24), nameLength = bytes.readUInt16LE(offset + 28), extraLength = bytes.readUInt16LE(offset + 30), commentLength = bytes.readUInt16LE(offset + 32), local = bytes.readUInt32LE(offset + 42);
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString('utf8');
    if (!isRepoPath(name) || entries.has(name) || flags & 1 || ![0, 8].includes(method) || size > 100 * 1024 * 1024 || local + 30 > centralStart || bytes.readUInt32LE(local) !== 0x04034b50) throw Error(`Invalid/duplicate/unsupported ZIP member: ${name}`);
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28);
    if (start + compressedSize > centralStart) throw Error(`ZIP member exceeds data bounds: ${name}`);
    const compressed = bytes.subarray(start, start + compressedSize), data = method === 8 ? inflateRawSync(compressed, {maxOutputLength: 100 * 1024 * 1024}) : compressed;
    if (data.length !== size) throw Error(`ZIP member size mismatch: ${name}`);
    entries.set(name, data);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  if (offset !== end) throw Error('ZIP central directory size mismatch');
  return entries;
}

export async function validateProof({acceptance, readFile, binding, git, mode = 'static', registration}) {
  const errors = [], gaps = [], checks = [], proofPath = acceptance?.delivery?.proof;
  const error = (code, message, id) => errors.push(failure(code, message, id));
  const gap = (code, message, id) => gaps.push(failure(code, message, id));
  if (!proofPath) {gap('DELIVERY_PROOF_MISSING', 'Fresh fixed-package proof is not linked', 'DEL-01'); return {errors, gaps, checks};}
  let proof;
  try {proof = JSON.parse((await readFile(proofPath)).toString());} catch (cause) {gap('DELIVERY_PROOF_MISSING', `${proofPath}: ${cause.message}`, 'DEL-01'); return {errors, gaps, checks};}
  if (proof.schema !== 1) error('PROOF_SCHEMA', 'proof.schema must be 1', 'DEL-01');
  if (!COMMIT.test(proof.runtimeSourceSha ?? '') || !HASH.test(proof.runtimeTreeHash ?? '') || !Number.isFinite(Date.parse(proof.generatedAt))) error('PROOF_BINDING', 'Proof needs full runtime source SHA, computed tree hash and generatedAt', 'DEL-01');
  const pkg = JSON.parse((await readFile('package.json')).toString());
  if (proof.runtimeVersion !== pkg.version) error('PROOF_VERSION', `Proof ${proof.runtimeVersion} differs from current runtime ${pkg.version}`, 'DEL-01');
  if (binding && (proof.runtimeSourceSha !== binding.runtimeSourceSha || proof.runtimeTreeHash !== binding.runtimeTreeHash || !equal(proof.originalTrees, binding.originalTrees))) error('STALE_RUNTIME_PROOF', 'Proof differs from the actual source/runtime/original trees', 'DEL-01');
  if (mode === 'delivery' && (!binding || !git)) error('DELIVERY_GIT_BINDING_MISSING', 'Strict delivery requires computed working-tree binding and Git context', 'DEL-01');
  if (git) {
    try {
      if (!git.isAncestor(proof.runtimeSourceSha)) error('RUNTIME_SOURCE_ANCESTRY', 'Runtime source must be an ancestor of current evidence HEAD', 'DEL-01');
      for (const name of RUNTIME_ROOTS) if (!proof.originalTrees?.[name] || proof.originalTrees[name] !== git.tree(proof.runtimeSourceSha, name) || proof.originalTrees[name] !== git.tree(git.head, name)) error('EVIDENCE_ONLY_TREE_CHANGED', `${name}: evidence commit changed runtime/source originals`, 'DEL-01');
    } catch (cause) {error('PROOF_GIT_READ', cause.message, 'DEL-01');}
  }
  const verified = new Map(), reportObjects = new Map(), unavailableArchives = new Set();
  for (const [kind, entries] of [['archive', [proof.archive]], ['report', proof.reports], ['media', proof.media]]) {
    if (!Array.isArray(entries) || !entries.length || !entries[0]) {gap('PROOF_FILES_MISSING', `Missing ${kind} manifest`, 'DEL-01'); continue;}
    for (const entry of entries) {
      try {
        if (!isRepoPath(entry?.path) || !HASH.test(entry.sha256 ?? '') || !Number.isInteger(entry.bytes) || entry.bytes < 1) throw Error('manifest requires path, positive bytes and SHA256');
        if (verified.has(entry.path)) throw Error('duplicate manifest path');
        let bytes;
        try {bytes = await readFile(entry.path);}
        catch (cause) {
          if (mode === 'static' && kind === 'archive' && cause.code === 'ENOENT') {
            unavailableArchives.add(entry.path);
            gap('FIXED_ARCHIVE_NOT_AVAILABLE', `${entry.path}: the frozen local ZIP is absent here; its bytes, hash, JS and 18 bundled state images have not been verified by this run`, 'DEL-01');
            continue;
          }
          throw cause;
        }
        if (bytes.length !== entry.bytes || sha256(bytes) !== entry.sha256) throw Error('actual bytes/SHA256 do not match');
        if (kind === 'archive') {
          const archive = readZipEntries(bytes), entryPath = entry.entry ?? 'loststar-fusion/index.html', html = archive.get(entryPath)?.toString();
          if (!html) throw Error(`Actual archive entry missing: ${entryPath}`);
          const dirname = path.posix.dirname(entryPath), scriptPaths = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)].map(match => path.posix.normalize(path.posix.join(dirname, match[1])));
          if (!scriptPaths.length || scriptPaths.some(name => !archive.has(name))) throw Error('Archive entry does not resolve its production script');
          const javascript = [...archive].filter(([name]) => name.endsWith('.js')).map(([, data]) => data.toString()).join('\n');
          if (!javascript.includes(proof.runtimeSourceSha?.slice(0, 7)) || !javascript.includes(proof.runtimeVersion) || !javascript.includes('whole-v043/')) throw Error('Actual JS does not identify the claimed source/version/shared whole-state renderer');
          for (const asset of registration?.assets ?? []) {
            const matches = [...archive].filter(([name]) => name.endsWith('.webp') && path.posix.basename(name).startsWith(`${asset.id}-`));
            if (matches.length !== 1 || sha256(matches[0][1]) !== sha256(await readFile(asset.webp))) throw Error(`Actual package missing/wrong state asset: ${asset.id}`);
          }
        }
        verified.set(entry.path, entry);
        if (kind === 'report') reportObjects.set(entry.path, JSON.parse(bytes.toString()));
      } catch (cause) {error('PROOF_FILE_INVALID', `${entry?.path}: ${cause.message}`, 'DEL-01');}
    }
  }
  const checkIds = new Set();
  for (const check of proof.checks ?? []) {
    if (typeof check.id !== 'string' || checkIds.has(check.id)) {error('PROOF_CHECK_ID', `Missing/duplicate check ID: ${check.id}`, 'DEL-01'); continue;}
    const report = reportObjects.get(check.reportPath), assertions = check.assertions ?? (check.assertion ? [check.assertion] : []);
    if (!report || !assertions.length) {error('PROOF_CHECK_REPORT', `${check.id}: check needs a hashed JSON report and computed assertions`, 'DEL-01'); continue;}
    let valid = true;
    const reportSource = check.sourcePointer ? pointer(report, check.sourcePointer) : report.runtimeSourceSha ?? report.sourceCommit ?? (typeof report.runtimeSource === 'string' ? report.runtimeSource : report.runtimeSource?.sourceSha);
    const reportArchive = check.archivePointer ? pointer(report, check.archivePointer) : report.zipSha256 ?? report.package?.sha256 ?? report.archive?.sha256;
    if (reportSource !== proof.runtimeSourceSha || reportArchive !== undefined && reportArchive !== proof.archive?.sha256) {valid = false; error('REPORT_RUNTIME_BINDING', `${check.id}: report source/package differs from fixed proof (or source is absent)`, 'DEL-01');}
    for (const assertion of assertions) {
      try {
        const actual = pointer(report, assertion.pointer);
        if (assertion.kind !== 'json' || !Object.hasOwn(assertion, 'equals') || actual === undefined || !equal(actual, assertion.equals)) throw Error(`assertion ${assertion.pointer} does not equal ${JSON.stringify(assertion.equals)}`);
        // A literal PASS alone is never an objective engineering assertion.
        if (typeof actual === 'string' && /^(?:pass|success|complete|verified)$/i.test(actual)) throw Error('typed status is insufficient; assert concrete counts, errors, hashes or measurements');
      } catch (cause) {valid = false; error('PROOF_ASSERTION', `${check.id}: ${cause.message}`, 'DEL-01');}
    }
    if (valid) {checkIds.add(check.id); checks.push({id: check.id, reportPath: check.reportPath});}
  }
  for (const row of acceptance.requirements ?? []) {
    if (row.evidence === 'CURRENT_VERIFIED') {
      for (const id of row.checks ?? []) if (!checkIds.has(typeof id === 'string' ? id : id.id)) error('UNVERIFIED_REQUIREMENT_CHECK', `${typeof id === 'string' ? id : id.id} has no valid hashed report assertion`, row.id);
      for (const ref of row.proofs ?? []) if (!verified.has(filePath(ref)) && !unavailableArchives.has(filePath(ref))) error('UNBOUND_REQUIREMENT_PROOF', `${filePath(ref)} is not hashed in fixed-package proof`, row.id);
    }
    if (row.visual === 'INTERNAL_PASS' || row.visual === 'USER_ACCEPTED') {
      const review = proof.visualReviews?.find(review => review.requirementId === row.id);
      if (!review || !review.reviewer || !review.targets?.length || review.targets.some(target => !verified.has(filePath(target))) || !Array.isArray(review.findings)) gap('VISUAL_REVIEW_RECORD_MISSING', 'Internal pass needs named reviewer, viewed hashed target media and findings', row.id);
    }
    if (row.visual === 'USER_ACCEPTED') {
      const record = proof.userAcceptances?.find(record => record.requirementId === row.id);
      if (!record?.quote || record.runtimeSourceSha !== proof.runtimeSourceSha || !verified.has(record.recordPath)) error('USER_ACCEPTANCE_UNPROVEN', 'Specific user quote/version/scope and hashed source record required', row.id);
    }
    if (row.phone === 'PASS_WITH_DEVICE_RECORD') {
      const record = proof.phoneRecords?.find(record => record.requirementId === row.id);
      if (!record?.device || !record.os || record.runtimeSourceSha !== proof.runtimeSourceSha || !verified.has(record.recordPath)) error('PHONE_PASS_UNPROVEN', 'Phone pass needs actual device, OS, package source and hashed record', row.id);
    }
  }
  if (!proof.checks?.length) gap('PROOF_CHECKS_MISSING', 'No objective report assertions provided', 'DEL-01');
  return {errors, gaps, checks, proof};
}

export async function validateAcceptance(options) {
  const mode = options.mode ?? 'static';
  if (!['static', 'delivery'].includes(mode)) throw Error(`Unknown execution gate mode: ${mode}`);
  const readFile = options.readFile ?? createReader(options.root ?? process.cwd());
  const registry = options.registry ?? JSON.parse((await readFile(REGISTRY_PATH)).toString());
  const registration = options.registration ?? JSON.parse((await readFile(REGISTRATION_PATH)).toString());
  const acceptance = registry.acceptance;
  const assets = await validateAssets({registry, registration, readFile});
  const runtime = await validateRuntimeContracts({readFile});
  const requirements = await validateRequirements({acceptance, readFile, expectedRequirementIds: options.expectedRequirementIds});
  const sourceCoverage = await validateSourceCoverage({acceptance, readFile});
  if (acceptance?.rendering?.document) {
    try {if ((await readFile(acceptance.rendering.document)).toString() !== renderExecutionCoverage(acceptance)) sourceCoverage.errors.push(failure('COVERAGE_VIEW_STALE', 'Human-readable coverage differs from canonical acceptance; regenerate the view'));}
    catch (cause) {sourceCoverage.errors.push(failure('COVERAGE_VIEW_READ', cause.message));}
  }
  const proof = await validateProof({acceptance, readFile, binding: options.binding, git: options.git, mode, registration});
  const errors = [...assets.errors, ...runtime.errors, ...requirements.errors, ...sourceCoverage.errors, ...proof.errors];
  const gaps = [...requirements.gaps, ...sourceCoverage.gaps, ...proof.gaps];
  const reviewReady = errors.length === 0 && gaps.every(item => item.pendingAcceptance);
  const overallFinal = reviewReady && gaps.length === 0;
  const declared = acceptance?.delivery?.status;
  if (declared && !['PENDING', 'REVIEW_READY', 'FINAL'].includes(declared)) errors.push(failure('DELIVERY_STATUS', `Unknown declared delivery status: ${declared}`));
  if (reviewReady && !overallFinal && !acceptance?.delivery?.title?.includes('待用户/真机验收')) errors.push(failure('DELIVERY_PENDING_TITLE', 'Review-ready title must explicitly say 待用户/真机验收'));
  // A local review-ready declaration is not a current CI verification. An unavailable
  // ignored ZIP remains blocking, while all independently verifiable inputs stay strict.
  const onlyUnavailableArchive = mode === 'static' && !errors.length && gaps.some(item => item.code === 'FIXED_ARCHIVE_NOT_AVAILABLE') && gaps.every(item => item.pendingAcceptance || item.code === 'FIXED_ARCHIVE_NOT_AVAILABLE');
  if (declared === 'FINAL' && !overallFinal || declared === 'REVIEW_READY' && !reviewReady && !onlyUnavailableArchive) errors.push(failure('FALSE_DELIVERY_CLAIM', `Declared ${declared} exceeds verified readiness`));
  const ready = reviewReady && !errors.length, final = overallFinal && !errors.length;
  return {schema: 1, mode, staticValid: errors.length === 0, reviewReady: ready, overallFinal: final, status: final ? 'FINAL' : ready ? 'REVIEW_READY_PENDING_USER_PHONE' : 'NOT_READY', errors, gaps, checks: [...assets.checks, ...runtime.checks, ...proof.checks], summary: {requirements: requirements.ids.length, states: assets.checks.length, errors: errors.length, gaps: gaps.length, pendingUserOrPhone: gaps.filter(item => item.pendingAcceptance).length}};
}
