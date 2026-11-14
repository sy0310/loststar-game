/* Keep the original self-hashed v065 verifier and its354-row archive intact.
 * First check the actual current registry's complete historical prefix, then
 * give that immutable verifier its delivered registry and hashed source snapshots.
 * Actual old package/report/screenshot bytes still use the current artifact files. Current additions
 * are independently verified by verify-v066-evidence.cjs.
 */
const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const cp = require("node:child_process");
const assert = require("node:assert/strict");
const root = path.resolve(__dirname, "../../..");
const registry = path.join(root, "design/visual-renewal/ASSET_REGISTRY.json");
const originalRead = fs.readFileSync;
const archived = cp.execFileSync(
  "git",
  [
    "show",
    "6b75a870e9ec34d495c10febcabc2c63d4bdf258:design/visual-renewal/ASSET_REGISTRY.json",
  ],
  { cwd: root, maxBuffer: 12 * 1024 * 1024 },
);
const historical = JSON.parse(archived).acceptance;
const current = JSON.parse(originalRead(registry)).acceptance;
assert.equal(historical.requirements.length, 354);
assert.deepEqual(current.requirements.slice(0, 354), historical.requirements);
assert.deepEqual(current.requiredIds.slice(0, 354), historical.requiredIds);
assert.equal(new Set(current.requiredIds).size, current.requiredIds.length);
// Source/test documents are anchored to the evidence commit. Artifact bytes
// continue to come from the actual current repository and must remain intact.
const frozenReads = new Map([[registry, archived]]);
const proof = JSON.parse(
  originalRead(path.join(root, "artifacts/survivor-v065/verification.json")),
);
for (const item of proof.files.filter(
  (item) => !item.path.startsWith("artifacts/survivor-v065/"),
)) {
  const source = cp.execFileSync(
    "git",
    ["show", "6b75a870e9ec34d495c10febcabc2c63d4bdf258:" + item.path],
    { cwd: root, maxBuffer: 12 * 1024 * 1024 },
  );
  assert.equal(source.length, item.bytes, item.path);
  assert.equal(
    crypto.createHash("sha256").update(source).digest("hex"),
    item.sha256,
    item.path,
  );
  frozenReads.set(path.join(root, item.path), source);
}
fs.readFileSync = function (file, options) {
  const bytes =
    typeof file === "string" ? frozenReads.get(path.resolve(file)) : null;
  if (bytes) {
    const encoding = typeof options === "string" ? options : options?.encoding;
    return encoding ? bytes.toString(encoding) : Buffer.from(bytes);
  }
  return originalRead.apply(this, arguments);
};
try {
  require("./verify-v065-evidence.cjs");
} finally {
  fs.readFileSync = originalRead;
}
console.log(
  "PASS exact354 historical requirement prefix in the actual current registry, original immutable v065 verification retained",
);
