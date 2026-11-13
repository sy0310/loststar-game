/* Keep the original self-hashed v065 verifier and its354-row archive intact.
 * First check the actual current registry's complete historical prefix, then
 * give that immutable verifier its own delivered registry. Current additions
 * are independently verified by verify-v066-evidence.cjs.
 */
const fs = require("node:fs");
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
fs.readFileSync = function (file, options) {
  if (typeof file === "string" && path.resolve(file) === registry) {
    const encoding = typeof options === "string" ? options : options?.encoding;
    return encoding ? archived.toString(encoding) : Buffer.from(archived);
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
