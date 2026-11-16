/**
 * Deterministic D1 exhibit exports. This only crops/nearest-neighbour scales
 * original generated PNGs; it never repaints a concept image as a sprite.
 *
 * Run: node scripts/export_d1_assets.mjs
 * Registration is measured in each original PNG, not inferred from its centre.
 */
import sharp from 'sharp';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const sourceRoot = new URL('../assets/src/generated/d1/', import.meta.url);
const outputRoot = new URL('../assets/runtime/d1/', import.meta.url);
const sourceManifestUrl = new URL('registration.source.json', sourceRoot);
const manifest = JSON.parse(await readFile(sourceManifestUrl, 'utf8'));
await mkdir(outputRoot, { recursive: true });

function alphaBounds(data, info, threshold) {
  let left = info.width, top = info.height, right = -1, bottom = -1, count = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] < threshold) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y); count++;
    }
  }
  return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1, count };
}

function point(p, crop, sx, sy) {
  return { x: (p.x - crop.left) * sx, y: (p.y - crop.top) * sy };
}

function rectangle(r, crop, sx, sy) {
  return { ...point({ x: r.left, y: r.top }, crop, sx, sy), width: r.width * sx, height: r.height * sy };
}

const files = {};
for (const asset of manifest.assets) {
  const source = new URL(asset.source, sourceRoot);
  const sourceBytes = await readFile(source);
  const { data, info } = await sharp(sourceBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.channels !== 4) throw new Error(`${asset.id}: RGBA decode failed`);
  const visibleBounds = alphaBounds(data, info, 16);
  if (!visibleBounds) throw new Error(`${asset.id}: empty image`);
  const clearPixelCount = data.filter((_, index) => index % 4 === 3 && data[index] === 0).length;
  if (!clearPixelCount) throw new Error(`${asset.id}: no genuinely transparent pixels`);

  let exportSource = sourceBytes;
  let registrationSize = { width: info.width, height: info.height };
  const componentSources = {};
  // An animation atlas may register individually cropped components at different
  // positions. Each component is still scaled proportionally, never squashed.
  if (asset.assembly) {
    registrationSize = { width: asset.assembly.width, height: asset.assembly.height };
    const components = [];
    for (const layer of asset.assembly.layers) {
      const layerSource = layer.source ? await readFile(new URL(layer.source, sourceRoot)) : sourceBytes;
      if (layer.source) componentSources[layer.source] = createHash('sha256').update(layerSource).digest('hex');
      const input = await sharp(layerSource).extract(layer.crop)
        .resize(layer.width, undefined, { kernel: 'nearest' }).png().toBuffer();
      components.push({ input, left: layer.left, top: layer.top });
    }
    exportSource = await sharp({ create: { ...registrationSize, channels: 4, background: '#00000000' } })
      .composite(components).png().toBuffer();
  }
  const crop = asset.crop ?? { left: 0, top: 0, ...registrationSize };
  const outputWidth = asset.outputWidth ?? crop.width;
  // One width controls both dimensions; no non-uniform fit/fill distortion.
  const outputHeight = Math.round(crop.height * outputWidth / crop.width);
  const sx = outputWidth / crop.width, sy = outputHeight / crop.height;
  const outputName = `${asset.id}.webp`;
  const output = new URL(outputName, outputRoot);
  await sharp(exportSource).extract(crop).resize(outputWidth, outputHeight, { kernel: 'nearest', fit: 'inside' })
    .webp({ lossless: true, alphaQuality: 100, exact: true, effort: 6 }).toFile(fileURLToPath(output));
  const decoded = await sharp(fileURLToPath(output)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const foot = point(asset.foot, crop, sx, sy);
  const widthAtFoot = asset.foot.width * sx;
  const worldScale = asset.target.footWidth / widthAtFoot;
  const runtimeCavity = asset.cavity ? rectangle(asset.cavity, crop, sx, sy) : null;
  const sourceParts = asset.parts ?? {};
  const parts = Object.fromEntries(Object.entries(sourceParts).map(([key, value]) => [key, rectangle(value, crop, sx, sy)]));
  const draw = {
    left: asset.target.anchor.x - foot.x * worldScale,
    top: asset.target.anchor.y - foot.y * worldScale,
    width: decoded.info.width * worldScale,
    height: decoded.info.height * worldScale,
  };
  let clearReceiptEnvelope = null;
  if (asset.id !== 'receipt-base-l1') {
    const envelope = { left: 141.53658536585365, top: 412.4634146341463, width: 66.92682926829268, height: 66.92682926829268 };
    const left = Math.max(0, Math.floor((envelope.left - draw.left) / worldScale));
    const top = Math.max(0, Math.floor((envelope.top - draw.top) / worldScale));
    const right = Math.min(decoded.info.width, Math.ceil((envelope.left + envelope.width - draw.left) / worldScale));
    const bottom = Math.min(decoded.info.height, Math.ceil((envelope.top + envelope.height - draw.top) / worldScale));
    let maximum = 0, visibleCount = 0, sum = 0;
    for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
      const a = decoded.data[(y * decoded.info.width + x) * 4 + 3];
      maximum = Math.max(maximum, a); sum += a; if (a >= 16) visibleCount++;
    }
    const count = (right - left) * (bottom - top);
    clearReceiptEnvelope = { world: envelope, sampledPixels: count, alphaMaximum: maximum, alphaMean: sum / count, visibleAlpha16Count: visibleCount };
    if (visibleCount) throw new Error(`${asset.id}: visible baked pixels intersect the fixed receipt envelope`);
  }
  files[asset.id] = {
    source: `assets/src/generated/d1/${asset.source}`,
    sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
    sourceSize: { width: info.width, height: info.height },
    registrationSpace: { kind: asset.assembly ? 'component atlas' : 'source image', ...registrationSize },
    assembly: asset.assembly ?? null,
    componentSources,
    sourceAlphaBounds: { nonzero: alphaBounds(data, info, 1), visible16: visibleBounds, solid240: alphaBounds(data, info, 240) },
    crop,
    output: `assets/runtime/d1/${outputName}`,
    outputSize: { width: decoded.info.width, height: decoded.info.height },
    outputBytes: (await stat(output)).size,
    outputAlphaBounds: { nonzero: alphaBounds(decoded.data, decoded.info, 1), visible16: alphaBounds(decoded.data, decoded.info, 16) },
    foot: { ...foot, width: widthAtFoot },
    cavity: runtimeCavity,
    parts,
    clearReceiptEnvelope,
    world: {
      anchor: asset.target.anchor,
      scale: worldScale,
      footWidth: asset.target.footWidth,
      draw,
      cavity: runtimeCavity ? {
        left: asset.target.anchor.x + (runtimeCavity.x - foot.x) * worldScale,
        top: asset.target.anchor.y + (runtimeCavity.y - foot.y) * worldScale,
        width: runtimeCavity.width * worldScale,
        height: runtimeCavity.height * worldScale,
      } : null,
    },
    notes: asset.notes,
  };
}

const result = {
  schema: 1,
  status: 'D1 review candidate; generated art is not user-approved',
  tool: 'image_gen.imagegen built-in',
  export: 'Source alpha retained within explicit crop. Proportional nearest-neighbour resize. Lossless exact-alpha/RGB WebP.',
  roomCoordinateSpace: { width: 768, height: 960 },
  receipt: { foot: { x: 175, y: 526 }, item: { x: 175, y: 445.9268292682927, size: 66.92682926829268 } },
  files,
};
await writeFile(new URL('registration.json', outputRoot), JSON.stringify(result, null, 2) + '\n');
console.log(`Exported ${Object.keys(files).length} D1 receipt assets with measured registration.`);

if (process.argv.includes('--audit')) {
  const auditRoot = new URL('audit/', sourceRoot); await mkdir(auditRoot, { recursive: true });
  const cells = [];
  for (let y = 0; y < 260; y += 4) for (let x = 0; x < 180; x += 4) {
    cells.push(`<rect x="${x}" y="${y}" width="4" height="4" fill="${(x / 4 + y / 4) % 2 ? '#93969a' : '#c4c6ca'}"/>`);
  }
  const checker = Buffer.from(`<svg width="180" height="260">${cells.join('')}</svg>`);
  for (const [id, entry] of Object.entries(files)) {
    const width = Math.round(entry.world.draw.width), height = Math.round(entry.world.draw.height);
    const native = await sharp(fileURLToPath(new URL(`${id}.webp`, outputRoot)))
      .resize(width, height, { kernel: 'nearest', fit: 'fill' }).png().toBuffer();
    const left = Math.round(90 - entry.foot.x / entry.outputSize.width * width);
    const top = Math.round(248 - entry.foot.y / entry.outputSize.height * height);
    // Composite BEFORE magnification. This exposes real alpha on a neutral grid
    // and shows the actual room-pixel grid, rather than a black RGB-only preview.
    const composed = await sharp(checker).composite([{ input: native, left, top }]).png().toBuffer();
    await sharp(composed).resize(720, 1040, { kernel: 'nearest' }).png()
      .toFile(fileURLToPath(new URL(`${id}-native-alpha.png`, auditRoot)));
  }
  console.log('Wrote native-room-pixel alpha checker audits (not runtime screenshots).');
}
