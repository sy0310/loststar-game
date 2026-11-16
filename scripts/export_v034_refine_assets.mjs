import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const projectRoot = new URL('../', import.meta.url);
const sourceRoot = new URL('../assets/src/generated/v034-refine/', import.meta.url);
const outputRoot = new URL('../assets/runtime/v034-refine/', import.meta.url);
const auditRoot = new URL('audit/', sourceRoot);
const manifest = JSON.parse(await readFile(new URL('registration.source.json', sourceRoot), 'utf8'));
const previous = JSON.parse(await readFile(new URL('assets/runtime/v034/registration.json', projectRoot), 'utf8'));
await mkdir(outputRoot, {recursive: true});
await mkdir(auditRoot, {recursive: true});

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function visibleBounds(data, width, height, threshold = 16) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < threshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      count++;
    }
  }
  if (count === 0) return null;
  return {x: left, y: top, width: right - left + 1, height: bottom - top + 1, count};
}

async function load(url) {
  const bytes = await readFile(url);
  const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  return {...decoded, sha256: sha256(bytes)};
}

function asPng(data, width, height) {
  return sharp(data, {raw: {width, height, channels: 4}}).png().toBuffer();
}

async function save(file, rgba, width, height, extra = {}) {
  for (let offset = 0; offset < rgba.length; offset += 4) {
    if (rgba[offset + 3] === 0) rgba.fill(0, offset, offset + 3);
  }
  const output = new URL(file, outputRoot);
  await sharp(await asPng(rgba, width, height))
    .webp({lossless: true, exact: true, alphaQuality: 100, effort: 6})
    .toFile(fileURLToPath(output));
  return {
    file, size: {width, height}, bytes: (await stat(output)).size,
    visibleBounds: visibleBounds(rgba, width, height), ...extra,
  };
}

function patchContact(rgba, paper, hint) {
  let sum = 0;
  let sumX = 0;
  let sumY = 0;
  let nearest = null;
  let nearestDistance = Infinity;
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const offset = (y * 256 + x) * 4;
      const weight = rgba[offset + 3] * paper[offset + 3] / 255;
      sum += weight;
      sumX += x * weight;
      sumY += y * weight;
      if (hint && rgba[offset + 3] >= 128 && paper[offset + 3] >= 128) {
        const distance = (x - hint.x) ** 2 + (y - hint.y) ** 2;
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = {x, y};
        }
      }
    }
  }
  return nearest ?? {x: sumX / sum, y: sumY / sum};
}

const patchSource = await load(new URL(manifest.patchSource, sourceRoot));
const paper = await load(new URL('assets/runtime/v034/receipt-paper-damaged.webp', projectRoot));
const back = Buffer.alloc(256 * 256 * 4);
const front = Buffer.alloc(back.length);
const patchTargets = {};
const pieces = [];
for (const profile of manifest.patches) {
  const cellSize = patchSource.info.height;
  const cell = profile.sourceRegion ?? {left: profile.cell * cellSize, top: 0, width: cellSize, height: cellSize};
  const extracted = await sharp(patchSource.data, {raw: {...patchSource.info, channels: 4}})
    .extract(cell).raw().toBuffer({resolveWithObject: true});
  const sourceBounds = visibleBounds(extracted.data, cell.width, cell.height);
  const sourceScale = profile.width / sourceBounds.width;
  const sourceCenter = {
    x: sourceBounds.x + sourceBounds.width / 2,
    y: sourceBounds.y + sourceBounds.height / 2,
  };
  const piece = Buffer.alloc(back.length);
  for (let y = 0; y < 256; y++) {
    const sy = Math.floor(sourceCenter.y + (y + .5 - profile.center.y) / sourceScale);
    if (sy < 0 || sy >= cell.height) continue;
    for (let x = 0; x < 256; x++) {
      const sx = Math.floor(sourceCenter.x + (x + .5 - profile.center.x) / sourceScale);
      if (sx < 0 || sx >= cell.width) continue;
      const input = ((sy + cell.top) * patchSource.info.width + sx + cell.left) * 4;
      if (patchSource.data[input + 3] < 16) continue;
      const output = (y * 256 + x) * 4;
      patchSource.data.copy(piece, output, input, input + 4);
      const support = paper.data[output + 3] / 255;
      patchSource.data.copy(back, output, input, input + 4);
      patchSource.data.copy(front, output, input, input + 4);
      back[output + 3] = Math.round(patchSource.data[input + 3] * profile.backOpacity);
      front[output + 3] = Math.round(patchSource.data[input + 3] * profile.frontOpacity * support);
    }
  }
  const area = visibleBounds(piece, 256, 256);
  patchTargets[profile.id] = {
    srcRect: {x: area.x, y: area.y, width: area.width, height: area.height},
    contact: patchContact(piece, paper.data, profile.contactHint), bridgeCenter: profile.center,
    ...(profile.hinge ? {hinge: profile.hinge} : {}),
    role: profile.role,
  };
  pieces.push({
    id: profile.id, sourceCell: cell, sourceVisibleBounds: sourceBounds,
    sourceToTextureScale: sourceScale, textureBounds: area,
    backOpacity: profile.backOpacity, frontOpacity: profile.frontOpacity,
  });
}
const patchLayers = {
  patchBack: await save('receipt-patch-back.webp', back, 256, 256, {opacity: 1}),
  patchFront: await save('receipt-patch-front.webp', front, 256, 256, {opacity: 1}),
};

const brush = await load(new URL('assets/runtime/v034/restoration-brush.webp', projectRoot));
const bristles = Buffer.alloc(brush.data.length);
const handle = Buffer.alloc(brush.data.length);
const split = manifest.brushSplit;
for (let y = 0; y < brush.info.height; y++) {
  for (let x = 0; x < brush.info.width; x++) {
    const offset = (y * brush.info.width + x) * 4;
    if (brush.data[offset + 3] < 16) continue;
    const projection = (x - split.root.x) * split.normal.x + (y - split.root.y) * split.normal.y;
    brush.data.copy(projection >= 0 ? bristles : handle, offset, offset, offset + 4);
  }
}
const brushParts = {
  bristles: await save('restoration-brush-bristles.webp', bristles, brush.info.width, brush.info.height),
  handle: await save('restoration-brush-handle.webp', handle, brush.info.width, brush.info.height),
};

const spatulaSource = await load(new URL(manifest.spatula.source, sourceRoot));
const spatulaBounds = visibleBounds(spatulaSource.data, spatulaSource.info.width, spatulaSource.info.height);
const crop = {
  left: spatulaBounds.x - 3, top: spatulaBounds.y - 3,
  width: spatulaBounds.width + 6, height: spatulaBounds.height + 6,
};
const spatulaImage = await sharp(spatulaSource.data, {raw: {...spatulaSource.info, channels: 4}})
  .extract(crop).resize({width: manifest.spatula.outputWidth, kernel: 'nearest'})
  .raw().toBuffer({resolveWithObject: true});
function toolPoint(point) {
  return {
    x: (point.x - crop.left) * spatulaImage.info.width / crop.width,
    y: (point.y - crop.top) * spatulaImage.info.height / crop.height,
  };
}
const spatula = await save('restoration-spatula.webp', spatulaImage.data, spatulaImage.info.width, spatulaImage.info.height, {
  source: manifest.spatula.source, sourceSha256: spatulaSource.sha256, sourceRect: crop,
  contact: toolPoint(manifest.spatula.contactSource), pivot: toolPoint(manifest.spatula.pivotSource),
  contactDefinition: 'Solid thin leading lip above the darker blade underside. This point slides beneath the paper edge.',
  contactTangent: manifest.spatula.contactTangentSource,
  suggestedWorldWidth: manifest.spatula.suggestedWorldWidth,
  suggestedWorldHeight: manifest.spatula.suggestedWorldWidth * spatulaImage.info.height / spatulaImage.info.width,
});

function containsPoint(points, x, y) {
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index++) {
    const a = points[index];
    const b = points[previous];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) {
      inside = !inside;
    }
  }
  return inside;
}

const soilSource = await load(new URL('assets/runtime/v034/receipt-soil-complete.webp', projectRoot));
const chips = [];
for (let index = 0; index < manifest.soilChips.length; index++) {
  const profile = manifest.soilChips[index];
  const region = profile.sourceRect;
  const rgba = Buffer.alloc(region.width * region.height * 4);
  for (let y = 0; y < region.height; y++) {
    for (let x = 0; x < region.width; x++) {
      if (!containsPoint(profile.outline, x + .5, y + .5)) continue;
      const input = ((y + region.top) * soilSource.info.width + x + region.left) * 4;
      soilSource.data.copy(rgba, (y * region.width + x) * 4, input, input + 4);
    }
  }
  const area = visibleBounds(rgba, region.width, region.height);
  const bottomRow = area.y + area.height - 1;
  let footSumX = 0;
  let footPixels = 0;
  for (let x = 0; x < region.width; x++) {
    if (rgba[(bottomRow * region.width + x) * 4 + 3] < 16) continue;
    footSumX += x + .5;
    footPixels++;
  }
  chips.push(await save(`soil-chip-${index}.webp`, rgba, region.width, region.height, {
    source: 'assets/runtime/v034/receipt-soil-complete.webp', sourceSha256: soilSource.sha256,
    sourceRect: region, outline: profile.outline,
    contact: {x: footSumX / footPixels, y: bottomRow + 1},
    pivot: {x: area.x + area.width / 2, y: area.y + area.height / 2},
    suggestedWorldWidth: profile.suggestedWorldWidth,
  }));
}

const oldBird = previous.residents.tagbird;
const correctedBirdScale = manifest.bird.targetVisibleHeight / oldBird.frames[0].visibleBounds.height;
const registration = {
  schema: 1, status: 'Refinement art candidates awaiting actual scene and user review',
  generator: 'OpenAI image_gen built-in',
  receipt: {
    canvas: previous.receipt.canvas, center: previous.receipt.center, hinge: previous.receipt.hinge,
    paperReference: {file: 'assets/runtime/v034/receipt-paper-damaged.webp', sha256: paper.sha256},
    survivingMaskReference: 'assets/runtime/v034/receipt-surviving-paper-mask.webp',
    layers: patchLayers, patchTargets, pieces,
    materialRule: 'Source cellulose tissue is drawn behind the upper tear and softly over the curl root. Original paper and missing ink stay independently registered.',
  },
  tools: {
    brush: {
      ...previous.tools.brush, file: 'assets/runtime/v034/restoration-brush.webp',
      runtimeSourceSha256: brush.sha256, root: split.root, splitNormal: split.normal, parts: brushParts,
    },
    spatula,
  },
  soil: {chips},
  residentDaily: {
    bird: {
      files: oldBird.frames.map(frame => frame.file),
      sourceDirectory: 'assets/runtime/v034', contact: oldBird.frames[0].contact,
      displayScale: correctedBirdScale, previousDisplayScale: oldBird.frames[0].displayScale,
      targetVisibleHeight: manifest.bird.targetVisibleHeight,
      frames: oldBird.frames.map(frame => ({
        file: frame.file, visibleBounds: frame.visibleBounds,
        logicalVisibleSize: {width: frame.visibleBounds.width * correctedBirdScale, height: frame.visibleBounds.height * correctedBirdScale},
      })),
    },
  },
};
await writeFile(new URL('registration.json', outputRoot), JSON.stringify(registration, null, 2) + '\n');
console.log('Exported two fibre-patch layers, split brush, thin spatula, four soil chips and bird scale override.');

if (process.argv.includes('--audit')) {
  const checker = (width, height) => Buffer.from(`<svg width="${width}" height="${height}"><defs><pattern id="c" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#b4aeb7"/><rect width="8" height="8" fill="#8a8393"/><rect x="8" y="8" width="8" height="8" fill="#8a8393"/></pattern></defs><rect width="100%" height="100%" fill="url(#c)"/></svg>`);
  const paperPng = await asPng(paper.data, 256, 256);
  async function oldPatch(file, opacity) {
    const decoded = await load(new URL(`assets/runtime/v034/${file}`, projectRoot));
    for (let offset = 3; offset < decoded.data.length; offset += 4) {
      decoded.data[offset] = Math.round(decoded.data[offset] * opacity);
    }
    return asPng(decoded.data, decoded.info.width, decoded.info.height);
  }
  const oldBack = await oldPatch('receipt-patch-back.webp', previous.receipt.layers.patchBack.opacity);
  const oldFront = await oldPatch('receipt-patch-front.webp', previous.receipt.layers.patchFront.opacity);
  const panels = [];
  panels.push(await sharp(checker(256, 256)).composite([{input: paperPng}]).png().toBuffer());
  panels.push(await sharp(checker(256, 256)).composite([
    {input: oldBack}, {input: paperPng}, {input: oldFront},
  ]).png().toBuffer());
  panels.push(await sharp(checker(256, 256)).composite([
    {input: await asPng(back, 256, 256)}, {input: paperPng}, {input: await asPng(front, 256, 256)},
  ]).png().toBuffer());
  await sharp(checker(768, 256)).composite(panels.map((input, index) => ({input, left: index * 256, top: 0})))
    .png().toFile(fileURLToPath(new URL('receipt-s1-old-s2-new-s2-registered256.png', auditRoot)));
  const nativePanels = await Promise.all(panels.map(input => sharp(input).resize(72, 72, {kernel: 'nearest'}).png().toBuffer()));
  const nativeReceipt = await sharp(checker(264, 88)).composite(nativePanels.map((input, index) => ({input, left: index * 88 + 8, top: 8}))).png().toBuffer();
  await writeFile(new URL('receipt-s1-old-s2-new-s2-native67.png', auditRoot), nativeReceipt);
  await sharp(nativeReceipt).resize(1320, 440, {kernel: 'nearest'}).png()
    .toFile(fileURLToPath(new URL('receipt-s1-old-s2-new-s2-native67-5x.png', auditRoot)));

  const cycle = JSON.parse(await readFile(new URL('assets/runtime/resident-cycle/registration.json', projectRoot), 'utf8'));
  const birdCycle = cycle.residents.tagbird;
  const birdSamples = [
    {file: 'assets/runtime/tagbird.webp', contact: birdCycle.dayContact, scale: birdCycle.dayDisplayScale},
    ...birdCycle.frames.map(frame => ({file: `assets/runtime/resident-cycle/${frame.file}`, contact: frame.contact, scale: frame.displayScale})),
    ...birdCycle.flightFrames.map(frame => ({file: `assets/runtime/resident-cycle/${frame.file}`, contact: frame.contact, scale: frame.displayScale})),
    ...oldBird.frames.map(frame => ({file: `assets/runtime/v034/${frame.file}`, contact: frame.contact, scale: frame.displayScale})),
    ...oldBird.frames.map(frame => ({file: `assets/runtime/v034/${frame.file}`, contact: frame.contact, scale: correctedBirdScale})),
  ];
  const birdOverlays = [];
  for (let index = 0; index < birdSamples.length; index++) {
    const sample = birdSamples[index];
    const image = await sharp(fileURLToPath(new URL(sample.file, projectRoot))).metadata();
    const input = await sharp(fileURLToPath(new URL(sample.file, projectRoot)))
      .resize({width: Math.round(image.width * sample.scale), kernel: 'nearest'}).png().toBuffer();
    birdOverlays.push({input, left: Math.round(index * 96 + 48 - sample.contact.x * sample.scale), top: Math.round(86 - sample.contact.y * sample.scale)});
  }
  const birdNative = await sharp(checker(864, 104)).composite(birdOverlays).png().toBuffer();
  await writeFile(new URL('bird-day-rest-flight-old-new-native.png', auditRoot), birdNative);
  await sharp(birdNative).resize(2592, 312, {kernel: 'nearest'}).png()
    .toFile(fileURLToPath(new URL('bird-day-rest-flight-old-new-native-3x.png', auditRoot)));

  const toolOverlays = [];
  for (const [index, entry] of [previous.tools.brush, spatula].entries()) {
    const file = index === 0 ? new URL('assets/runtime/v034/restoration-brush.webp', projectRoot) : new URL(entry.file, outputRoot);
    const input = await sharp(fileURLToPath(file)).resize({width: Math.round(entry.suggestedWorldWidth), kernel: 'nearest'}).png().toBuffer();
    toolOverlays.push({input, left: index * 60 + 16, top: 20});
  }
  const toolsNative = await sharp(checker(120, 60)).composite(toolOverlays).png().toBuffer();
  await sharp(toolsNative).resize(960, 480, {kernel: 'nearest'}).png()
    .toFile(fileURLToPath(new URL('brush-spatula-native-8x.png', auditRoot)));

  const paperNative = await sharp(paperPng).resize(72, 72, {kernel: 'nearest'}).png().toBuffer();
  const contactOverlays = [];
  for (const [index, entry] of [previous.tools.brush, spatula].entries()) {
    const file = index === 0 ? new URL('assets/runtime/v034/restoration-brush.webp', projectRoot) : new URL(entry.file, outputRoot);
    const scale = entry.suggestedWorldWidth / entry.size.width;
    const input = await sharp(fileURLToPath(file)).resize({width: Math.round(entry.suggestedWorldWidth), kernel: 'nearest'}).png().toBuffer();
    const sourcePaperContact = {x: 67, y: 147};
    const paperLeft = index * 120 + 20;
    contactOverlays.push({input: paperNative, left: paperLeft, top: 8});
    contactOverlays.push({
      input,
      left: Math.round(paperLeft + sourcePaperContact.x * 72 / 256 - entry.contact.x * scale),
      top: Math.round(8 + sourcePaperContact.y * 72 / 256 - entry.contact.y * scale),
    });
  }
  const contactAudit = await sharp({create: {width: 240, height: 92, channels: 4, background: '#272233'}})
    .composite(contactOverlays).png().toBuffer();
  await sharp(contactAudit).resize(1440, 552, {kernel: 'nearest'}).png()
    .toFile(fileURLToPath(new URL('brush-spatula-on-paper-native-6x.png', auditRoot)));

  const chipOverlays = [];
  for (let index = 0; index < chips.length; index++) {
    chipOverlays.push({input: await readFile(new URL(chips[index].file, outputRoot)), left: index * 48 + 8, top: 8});
  }
  const chipAudit = await sharp(checker(192, 48)).composite(chipOverlays).png().toBuffer();
  await sharp(chipAudit).resize(1152, 288, {kernel: 'nearest'})
    .png().toFile(fileURLToPath(new URL('soil-chips-source-6x.png', auditRoot)));

  const runtimeFiles = {};
  for (const file of (await readdir(outputRoot)).sort()) {
    const bytes = await readFile(new URL(file, outputRoot));
    runtimeFiles[file] = {bytes: bytes.length, sha256: sha256(bytes)};
  }
  const sourcePngs = {};
  for (const file of (await readdir(sourceRoot)).filter(file => file.endsWith('.png')).sort()) {
    const bytes = await readFile(new URL(file, sourceRoot));
    sourcePngs[file] = {bytes: bytes.length, sha256: sha256(bytes)};
  }
  const references = {};
  for (const file of [
    'assets/runtime/v034/receipt-paper-damaged.webp',
    'assets/runtime/v034/receipt-surviving-paper-mask.webp',
    'assets/runtime/v034/restoration-brush.webp',
    'assets/runtime/v034/receipt-soil-complete.webp',
    ...oldBird.frames.map(frame => `assets/runtime/v034/${frame.file}`),
  ]) {
    const bytes = await readFile(new URL(file, projectRoot));
    references[file] = {bytes: bytes.length, sha256: sha256(bytes)};
  }
  await writeFile(new URL('export-audit.json', auditRoot), JSON.stringify({
    exporterSha256: sha256(await readFile(fileURLToPath(import.meta.url))),
    sourceManifestSha256: sha256(await readFile(new URL('registration.source.json', sourceRoot))),
    runtimeFiles,
    sourcePngs, references,
    runtimeBytes: Object.values(runtimeFiles).reduce((sum, file) => sum + file.bytes, 0),
    paperSha256: paper.sha256, patchSourceSha256: patchSource.sha256,
    bird: registration.residentDaily.bird,
  }, null, 2) + '\n');
  console.log('Wrote material, native-size bird and tool audits.');
}
