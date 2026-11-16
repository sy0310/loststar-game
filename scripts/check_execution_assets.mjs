#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {collectRuntimeBinding, createReader, gitEvidenceContext, REGISTRY_PATH, validateAcceptance} from './execution_acceptance.mjs';

const args = process.argv.slice(2);
let mode = 'static', reportPath;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--delivery') mode = 'delivery';
  else if (args[i] === '--report' && args[i + 1]) reportPath = args[++i];
  else {console.error(`Unknown execution gate argument: ${args[i]}`); process.exit(2);}
}
try {
  const root = process.cwd(), readFile = createReader(root);
  const registry = JSON.parse((await readFile(REGISTRY_PATH)).toString());
  let source = 'HEAD';
  if (registry.acceptance?.delivery?.proof) {
    try {source = JSON.parse((await readFile(registry.acceptance.delivery.proof)).toString()).runtimeSourceSha ?? 'HEAD';} catch {/* Validator reports missing proof as a visible gap. */}
  }
  const binding = await collectRuntimeBinding(root, source);
  const result = await validateAcceptance({root, readFile, registry, mode, binding, git: gitEvidenceContext(root)});
  if (reportPath) {await fs.mkdir(path.dirname(path.resolve(reportPath)), {recursive: true}); await fs.writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`);}
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.staticValid && (mode === 'static' || result.reviewReady) ? 0 : 1;
} catch (cause) {console.error(JSON.stringify({schema: 1, status: 'NOT_READY', staticValid: false, errors: [{code: 'GATE_INPUT_ERROR', message: cause.message}]})); process.exitCode = 1;}
