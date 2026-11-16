import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

// Export/registration only. All new visible paint comes from the original
// image_gen PNGs; this script crops, scales, alpha-clips and registers them.
const root = path.resolve(import.meta.dirname, '..');
const sourceDir = path.join(root, 'assets/source/v039');
const runtimeDir = path.join(root, 'assets/runtime/v039');
const auditDir = path.join(root, 'design/v039');
await Promise.all([runtimeDir, auditDir].map(dir => fs.mkdir(dir, { recursive: true })));
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const transparent = (width, height) => sharp({ create: { width, height, channels: 4, background: '#00000000' } });

async function inspect(data, threshold = 16) {
  const { data: raw, info } = await sharp(data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let minX = info.width, minY = info.height, maxX = -1, maxY = -1, count = 0;
  let zero = 0, solid = 0, partial = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const alpha = raw[(y * info.width + x) * 4 + 3];
    if (alpha === 0) zero++; else if (alpha >= 240) solid++; else partial++;
    if (alpha < threshold) continue;
    count++; minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return { width: info.width, height: info.height, alpha: { zero, solid, partial }, visibleBounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, count } };
}

const sources = {};
for (const file of ['tape-adhesive-fibers-v1.png', 'tape-adhesive-fibers-v2.png', 'bell-corrosion-v1.png', 'restoration-tweezers-v1.png', 'restoration-screwdriver-v1.png']) {
  const bytes = await fs.readFile(path.join(sourceDir, file));
  sources[file] = { file: `assets/source/v039/${file}`, sha256: hash(bytes), bytes: bytes.length, ...await inspect(bytes) };
}

async function cropped(file, rect, width) {
  return sharp(path.join(sourceDir, file)).extract(rect).resize({ width, kernel: 'nearest' }).png().toBuffer();
}
async function save(file, buffer, extra = {}) {
  const webp = await sharp(buffer).webp({ lossless: true, effort: 6, exact: true }).toBuffer();
  await fs.writeFile(path.join(runtimeDir, file), webp);
  return { file: `assets/runtime/v039/${file}`, bytes: webp.length, sha256: hash(webp), ...await inspect(webp), ...extra };
}

const tapeBase = await sharp(path.join(root, 'assets/runtime/tape.webp')).extend({ left: 0, right: 0, top: 12, bottom: 11, background: '#00000000' }).png().toBuffer();
const bellBase = await sharp(path.join(root, 'assets/runtime/bell.webp')).resize({ width: 192, kernel: 'nearest' }).extend({ left: 0, right: 0, top: 6, bottom: 5, background: '#00000000' }).png().toBuffer();

const fiberRect = { left: 203, top: 95, width: 1610, height: 560 };
const corrosionRect = { left: 411, top: 249, width: 1153, height: 338 };
const dustTail = await cropped('tape-adhesive-fibers-v2.png', fiberRect, 52);
const dustRoll = await cropped('tape-adhesive-fibers-v2.png', fiberRect, 25);
const tapeDust = await transparent(192, 192).composite([
  { input: dustTail, left: 13, top: 138 },
  { input: dustRoll, left: 139, top: 108 },
]).png().toBuffer();
const tapeDustClipped = await sharp(tapeDust).composite([{ input: tapeBase, blend: 'dest-in' }]).png().toBuffer();
const tapeTailRegistered = await transparent(192, 192).composite([{ input: dustTail, left: 13, top: 138 }]).png().toBuffer();
const tapeRollRegistered = await transparent(192, 192).composite([{ input: dustRoll, left: 139, top: 108 }]).png().toBuffer();
const tapeTailClipped = await sharp(tapeTailRegistered).composite([{ input: tapeBase, blend: 'dest-in' }]).png().toBuffer();
const tapeRollClipped = await sharp(tapeRollRegistered).composite([{ input: tapeBase, blend: 'dest-in' }]).png().toBuffer();

const rustDome = await cropped('bell-corrosion-v1.png', corrosionRect, 99);
const rustStem = await cropped('bell-corrosion-v1.png', corrosionRect, 25);
const bellRust = await transparent(192, 192).composite([
  { input: rustDome, left: 42, top: 108 },
  { input: rustStem, left: 76, top: 47 },
]).png().toBuffer();
const bellRustClipped = await sharp(bellRust).composite([{ input: bellBase, blend: 'dest-in' }]).png().toBuffer();

const layers = {
  tapeAdhesiveDust: await save('tape-adhesive-dust.webp', tapeDustClipped, {
    source: 'tape-adhesive-fibers-v2.png', sourceRect: fiberRect,
    placements: [{ x: 13, y: 138, width: 52 }, { x: 139, y: 108, width: 25 }],
    contactTargets: [{ x: 38, y: 150 }, { x: 151, y: 118 }],
    material: 'Removable sticky paper lint and adhesive dust; never reused as soil or rust.',
  }),
  tapeTailDust: await save('tape-adhesive-dust-tail.webp', tapeTailClipped, {
    source: 'tape-adhesive-fibers-v2.png', sourceRect: fiberRect,
    contactTargets: [{ x: 38, y: 150 }],
    movementRule: 'Follow only the original tape tail/loose-end rig, sharing its mask and pivot.',
  }),
  tapeRollDust: await save('tape-adhesive-dust-roll.webp', tapeRollClipped, {
    source: 'tape-adhesive-fibers-v2.png', sourceRect: fiberRect,
    contactTargets: [{ x: 151, y: 118 }],
    movementRule: 'Stay on the fixed roll outer wall. Never follow the loose tail rotation.',
  }),
  bellRust: await save('bell-rust.webp', bellRustClipped, {
    source: 'bell-corrosion-v1.png', sourceRect: corrosionRect,
    placements: [{ x: 42, y: 108, width: 99 }, { x: 76, y: 47, width: 25 }],
    contactTargets: [{ x: 91, y: 129 }, { x: 128, y: 127 }, { x: 87, y: 56 }],
    material: 'Brass oxidation crust with pitting; never reused as mud or generic scratch lines.',
  }),
};

async function tool(file, out, rect, sourceContact, sourcePivot, definition, worldWidth) {
  const buffer = await cropped(file, rect, 192);
  const { height } = await sharp(buffer).metadata();
  const sx = 192 / rect.width, sy = height / rect.height;
  const point = p => ({ x: (p.x - rect.left) * sx, y: (p.y - rect.top) * sy });
  return save(out, buffer, { source: file, sourceRect: rect, contact: point(sourceContact), pivot: point(sourcePivot), contactDefinition: definition, suggestedWorldWidth: worldWidth, sourceContact, sourcePivot });
}
const tools = {
  tweezers: await tool('restoration-tweezers-v1.png', 'restoration-tweezers.webp', { left: 139, top: 63, width: 1315, height: 915 }, { x: 187, y: 945 }, { x: 1245, y: 210 }, 'Grip center between the two bent tips. The fiber is held in the transparent jaw gap; do not align the handle with the target.', 24),
  screwdriver: await tool('restoration-screwdriver-v1.png', 'restoration-screwdriver.webp', { left: 48, top: 48, width: 1445, height: 941 }, { x: 65, y: 967 }, { x: 1283, y: 228 }, 'Solid leading flat blade edge at the lower-left end; align this point with the base fastener.', 24),
};

const registration = {
  version: 'v039-art-1', status: 'candidate-awaiting-root-render-and-user-visual-review',
  mode: 'built-in image_gen.imagegen', canvas: { width: 192, height: 192 },
  baseTransforms: {
    tape: { source: 'assets/runtime/tape.webp', sourceSha256: hash(await fs.readFile(path.join(root, 'assets/runtime/tape.webp'))), sourceSize: { width: 192, height: 169 }, scale: 1, x: 0, y: 11.5 },
    bell: { source: 'assets/runtime/bell.webp', sourceSha256: hash(await fs.readFile(path.join(root, 'assets/runtime/bell.webp'))), sourceSize: { width: 256, height: 241 }, scale: .75, x: 0, y: 5.625 },
  },
  sources, layers, tools,
  reuse: {
    receipt: ['assets/runtime/v034/receipt-paper-damaged.webp', 'assets/runtime/v034/receipt-surviving-paper-mask.webp', 'assets/runtime/v034-refine/receipt-patch-back.webp', 'assets/runtime/v034-refine/receipt-patch-front.webp'],
    softBrush: 'assets/runtime/v034-refine/registration.json#tools.brush',
    spatula: 'assets/runtime/v034-refine/registration.json#tools.spatula',
    identityRule: 'The approved original receipt gaps/ink, amber tape and brass bell remain the object. Generated materials are independent overlays, never replacement full-object pictures.',
  },
  reviewBoundaries: ['This JSON registers textures; it is not proof of actual animation, integration, phone performance or user approval.', 'Tool contact and removal masks must be verified by the root agent in the actual Canvas renderer.', 'Corrosion is visually removable crust; do not imply restoration erased the history, star engraving or missing receipt records.', 'The bell has no physical lamp. Red RGB at original (215,108) has alpha 1/255, a transparent-color artifact between ribbons; never draw a dark/bright lamp there.'],
};
await fs.writeFile(path.join(runtimeDir, 'registration.json'), JSON.stringify(registration, null, 2) + '\n');

// Static material audit only. It deliberately does not claim to show the new
// structural rig, game UI, animation or a runtime screenshot.
const tapeDirty = await sharp(tapeBase).composite([{ input: tapeDustClipped }]).png().toBuffer();
const bellDirty = await sharp(bellBase).composite([{ input: bellRustClipped }]).png().toBuffer();
const board = await sharp({ create: { width: 840, height: 410, channels: 4, background: '#393047' } }).composite([
  { input: tapeBase, left: 12, top: 12 }, { input: tapeDirty, left: 216, top: 12 },
  { input: bellBase, left: 432, top: 12 }, { input: bellDirty, left: 636, top: 12 },
  { input: await fs.readFile(path.join(runtimeDir, 'restoration-tweezers.webp')), left: 54, top: 242 },
  { input: await fs.readFile(path.join(runtimeDir, 'restoration-screwdriver.webp')), left: 282, top: 242 },
  { input: await sharp(tapeDirty).resize({ width: 68, kernel: 'nearest' }).png().toBuffer(), left: 552, top: 270 },
  { input: await sharp(bellDirty).resize({ width: 68, kernel: 'nearest' }).png().toBuffer(), left: 656, top: 270 },
]).png().toBuffer();
await fs.writeFile(path.join(auditDir, 'material-registration-audit.png'), board);
const native = await sharp({ create: { width: 544, height: 272, channels: 4, background: '#393047' } }).composite([
  { input: await sharp(tapeBase).resize(68, 68, { kernel: 'nearest' }).png().toBuffer(), left: 0, top: 0 },
  { input: await sharp(tapeDirty).resize(68, 68, { kernel: 'nearest' }).png().toBuffer(), left: 68, top: 0 },
  { input: await sharp(bellBase).resize(68, 68, { kernel: 'nearest' }).png().toBuffer(), left: 136, top: 0 },
  { input: await sharp(bellDirty).resize(68, 68, { kernel: 'nearest' }).png().toBuffer(), left: 204, top: 0 },
]).png().toBuffer();
await fs.writeFile(path.join(auditDir, 'material-native68-audit-4x.png'), await sharp(native).extract({ left: 0, top: 0, width: 272, height: 68 }).resize(1088, 272, { kernel: 'nearest' }).png().toBuffer());
console.log(JSON.stringify({ runtime: Object.values(layers).concat(Object.values(tools)).map(a => ({ file: a.file, bytes: a.bytes, size: [a.width, a.height], visibleBounds: a.visibleBounds })), registration: 'assets/runtime/v039/registration.json', audit: 'design/v039/material-registration-audit.png' }, null, 2));
