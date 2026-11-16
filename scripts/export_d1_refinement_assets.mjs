import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const sourceRoot = new URL('../assets/src/generated/d1-refinement/', import.meta.url);
const runtimeRoot = new URL('../assets/runtime/d1-refinement/', import.meta.url);
const sourceManifest = JSON.parse(await readFile(new URL('registration.source.json', sourceRoot), 'utf8'));
await mkdir(runtimeRoot, {recursive: true});

function alphaBounds(data, width, height, threshold) {
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
  return right < 0 ? null : {x: left, y: top, width: right - left + 1, height: bottom - top + 1, count};
}

function measuredBounds(data, width, height) {
  return {
    nonzero: alphaBounds(data, width, height, 1),
    visible16: alphaBounds(data, width, height, 16),
    solid240: alphaBounds(data, width, height, 240),
  };
}

async function saveTexture(name, imageBuffer) {
  const output = new URL(name, runtimeRoot);
  await sharp(imageBuffer).webp({lossless: true, exact: true, alphaQuality: 100, effort: 6})
    .toFile(fileURLToPath(output));
  return {file: `assets/runtime/d1-refinement/${name}`, bytes: (await stat(output)).size};
}

async function exportInnerPaper(config) {
  const sourceBytes = await readFile(new URL(config.source, sourceRoot));
  const source = await sharp(sourceBytes).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const visible = alphaBounds(source.data, source.info.width, source.info.height, 16);
  if (!visible) throw new Error('Blank receipt inner paper has no visible pixels');
  const crop = {left: visible.x, top: visible.y, width: visible.width, height: visible.height};
  const fragment = await sharp(sourceBytes).extract(crop)
    .resize({height: config.visibleHeight, kernel: 'nearest'}).png().toBuffer();
  const size = await sharp(fragment).metadata();
  const left = Math.round((256 - size.width) / 2);
  const top = Math.round((256 - size.height) / 2);
  const normalized = await sharp({create: {width: 256, height: 256, channels: 4, background: '#00000000'}})
    .composite([{input: fragment, left, top}]).png().toBuffer();
  const output = await sharp(normalized).ensureAlpha().raw().toBuffer();
  const outputBounds = measuredBounds(output, 256, 256);
  if (outputBounds.visible16.height !== config.visibleHeight) {
    throw new Error('Blank receipt inner paper visible height changed during export');
  }
  const reference = await sharp(fileURLToPath(new URL('receipt-tier-0.webp', runtimeRoot)))
    .ensureAlpha().raw().toBuffer();
  let intersection = 0;
  let union = 0;
  let outsideReference = 0;
  for (let offset = 3; offset < output.length; offset += 4) {
    const innerVisible = output[offset] >= 16;
    const outerVisible = reference[offset] >= 16;
    if (innerVisible && outerVisible) intersection++;
    if (innerVisible || outerVisible) union++;
    if (innerVisible && !outerVisible) outsideReference++;
  }
  const hinge = sourceManifest.receipts.hingeUv;
  const hingeOffset = (Math.round(hinge.y * 256) * 256 + Math.round(hinge.x * 256)) * 4 + 3;
  const texture = await saveTexture('receipt-inner-blank.webp', normalized);
  return {
    ...texture,
    size: {width: 256, height: 256},
    source: `assets/src/generated/d1-refinement/${config.source}`,
    sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
    sourceSize: {width: source.info.width, height: source.info.height},
    sourceAlphaBounds: measuredBounds(source.data, source.info.width, source.info.height),
    alphaBounds: outputBounds,
    centerUv: {x: .5, y: .5},
    hingeUv: sourceManifest.receipts.hingeUv,
    paperFace: sourceManifest.receipts.paperFace,
    lowerCurl: sourceManifest.receipts.lowerCurl,
    unfoldCutY: config.unfoldCutY,
    inkStrip: {x: 0, y: 0, width: 0, height: 0},
    returnStamp: {x: 0, y: 0, width: 0, height: 0},
    sharedForTiers: [0, 1, 2, 3],
    validation: {
      alpha16OverlapWithTier0: intersection / union,
      alpha16OutsideTier0Pixels: outsideReference,
      hingeAlpha: output[hingeOffset],
    },
    normalization: {
      crop,
      outputFragment: {x: left, y: top, width: size.width, height: size.height},
      method: 'Proportional nearest-neighbour fit to239px visible height and nominal128/128 canvas centre',
    },
  };
}

function insidePolygon(x, y, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const crossesRow = (currentPoint[1] > y) !== (previousPoint[1] > y);
    if (crossesRow && x < (
      (previousPoint[0] - currentPoint[0]) * (y - currentPoint[1]) /
      (previousPoint[1] - currentPoint[1]) + currentPoint[0]
    )) {
      inside = !inside;
    }
  }
  return inside;
}

async function exportCarrier(config) {
  const sourceBytes = await readFile(new URL(config.source, sourceRoot));
  const fragment = await sharp(sourceBytes).extract(config.crop)
    .resize({width: config.fragmentWidth, kernel: 'nearest'}).png().toBuffer();
  const fragmentSize = await sharp(fragment).metadata();
  const normalized = await sharp({create: {...config.canvas, channels: 4, background: '#00000000'}})
    .composite([{input: fragment, left: config.placement.x, top: config.placement.y}]).png().toBuffer();
  const rgba = await sharp(normalized).ensureAlpha().raw().toBuffer();
  const scaleX = fragmentSize.width / config.crop.width;
  const scaleY = fragmentSize.height / config.crop.height;
  const point = value => ({
    x: config.placement.x + (value.x - config.crop.left) * scaleX,
    y: config.placement.y + (value.y - config.crop.top) * scaleY,
  });
  const rectangle = value => ({
    ...point(value),
    width: value.width * scaleX,
    height: value.height * scaleY,
    w: value.width * scaleX,
    h: value.height * scaleY,
  });
  const cavity = rectangle(config.cavity);
  const displayScale = config.targetCavityHeight / cavity.height;
  const handles = config.handles.map(point);
  const gripMidpoint = {
    x: (handles[0].x + handles[1].x) / 2,
    y: (handles[0].y + handles[1].y) / 2,
  };
  const pixels = {
    back: Buffer.alloc(rgba.length),
    front: Buffer.alloc(rgba.length),
    lid: Buffer.alloc(rgba.length),
  };
  for (let y = 0; y < config.canvas.height; y++) {
    for (let x = 0; x < config.canvas.width; x++) {
      const offset = (y * config.canvas.width + x) * 4;
      const sourceX = config.crop.left + (x - config.placement.x + .5) / scaleX;
      const sourceY = config.crop.top + (y - config.placement.y + .5) / scaleY;
      let layer = 'back';
      if (insidePolygon(sourceX, sourceY, config.lidPolygon)) {
        layer = 'lid';
      } else if (config.frontPolygons.some(polygon => insidePolygon(sourceX, sourceY, polygon))) {
        layer = 'front';
      }
      rgba.copy(pixels[layer], offset, offset, offset + 4);
    }
  }
  const layers = {};
  const pngLayers = [];
  for (const name of ['back', 'front', 'lid']) {
    const png = await sharp(pixels[name], {raw: {...config.canvas, channels: 4}}).png().toBuffer();
    const texture = await saveTexture(`carry-case-${name}.webp`, png);
    layers[name] = {
      ...texture,
      alphaBounds: measuredBounds(pixels[name], config.canvas.width, config.canvas.height),
    };
    pngLayers.push({input: png, left: 0, top: 0});
  }
  const reconstructed = await sharp({create: {...config.canvas, channels: 4, background: '#00000000'}})
    .composite(pngLayers).ensureAlpha().raw().toBuffer();
  let alphaMaximumError = 0;
  let visibleChannelMaximumError = 0;
  for (let offset = 0; offset < rgba.length; offset += 4) {
    alphaMaximumError = Math.max(alphaMaximumError, Math.abs(reconstructed[offset + 3] - rgba[offset + 3]));
    if (rgba[offset + 3] < 16) continue;
    for (let channel = 0; channel < 3; channel++) {
      visibleChannelMaximumError = Math.max(visibleChannelMaximumError, Math.abs(reconstructed[offset + channel] - rgba[offset + channel]));
    }
  }
  const physicalBounds = measuredBounds(rgba, config.canvas.width, config.canvas.height).visible16;
  let cavityAlphaMaximum = 0;
  let cavityVisiblePixels = 0;
  for (let y = Math.ceil(cavity.y); y < Math.floor(cavity.y + cavity.height); y++) {
    for (let x = Math.ceil(cavity.x); x < Math.floor(cavity.x + cavity.width); x++) {
      const alpha = rgba[(y * config.canvas.width + x) * 4 + 3];
      cavityAlphaMaximum = Math.max(cavityAlphaMaximum, alpha);
      if (alpha >= 16) cavityVisiblePixels++;
    }
  }
  if (cavityVisiblePixels) throw new Error('Carrier safe cavity contains visible baked pixels');
  const registration = {
    schema: 1,
    status: 'D1 runtime composition candidate awaiting parent and user review',
    source: `assets/src/generated/d1-refinement/${config.source}`,
    sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
    sourceCrop: config.crop,
    sourcePhysicalBounds: config.sourcePhysicalBounds,
    sourceHandles: config.handles,
    sourceCavity: config.cavity,
    sourceMasks: {lid: config.lidPolygon, front: config.frontPolygons, back: 'remaining pixels'},
    canvas: config.canvas,
    normalization: {
      fragment: {
        x: config.placement.x,
        y: config.placement.y,
        width: fragmentSize.width,
        height: fragmentSize.height,
      },
      proportionalNearestNeighbour: true,
    },
    physicalBounds,
    displayScale,
    displayPhysicalSize: {width: physicalBounds.width * displayScale, height: physicalBounds.height * displayScale},
    cavity,
    displayCavitySize: {width: cavity.width * displayScale, height: cavity.height * displayScale},
    handles,
    gripMidpoint,
    displayGripDifference: {
      x: (handles[1].x - handles[0].x) * displayScale,
      y: (handles[1].y - handles[0].y) * displayScale,
    },
    hinge: point(config.hinge),
    handleBounds: rectangle(config.handleBounds),
    handleHinge: point(config.handleHinge),
    floorContact: point(config.floorContact),
    layers,
    validation: {
      cavityAlphaMaximum,
      cavityVisibleAlpha16Pixels: cavityVisiblePixels,
      reconstructionAlphaMaximumError: alphaMaximumError,
      reconstructionVisibleChannelMaximumError: visibleChannelMaximumError,
    },
  };
  await writeFile(new URL('carry-case-registration.json', runtimeRoot), JSON.stringify(registration, null, 2) + '\n');
  const auditRoot = new URL('audit/', sourceRoot);
  await mkdir(auditRoot, {recursive: true});
  await writeFile(new URL('carry-case-closed-registered.png', auditRoot), normalized);
  return registration;
}

const receiptSource = await readFile(new URL(sourceManifest.receipts.source, sourceRoot));
const sourceImage = await sharp(receiptSource).metadata();
const cellSize = sourceImage.width / 2;
if (!Number.isInteger(cellSize) || sourceImage.width !== sourceImage.height) {
  throw new Error('Receipt source must be an equal-cell square 2x2 atlas');
}

const tiers = [];
for (let tier = 0; tier < 4; tier++) {
  const sourceCell = {
    left: tier % 2 * cellSize,
    top: Math.floor(tier / 2) * cellSize,
    width: cellSize,
    height: cellSize,
  };
  const cell = await sharp(receiptSource).extract(sourceCell).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const sourceBounds = measuredBounds(cell.data, cellSize, cellSize);
  const visible = sourceBounds.visible16;
  if (!visible) throw new Error(`Receipt tier${tier} has no visible pixels`);
  const crop = {
    left: Math.max(0, visible.x - 4),
    top: Math.max(0, visible.y - 4),
    width: Math.min(cellSize, visible.x + visible.width + 4) - Math.max(0, visible.x - 4),
    height: Math.min(cellSize, visible.y + visible.height + 4) - Math.max(0, visible.y - 4),
  };
  const targetHeight = Math.round(crop.height * 240 / visible.height);
  const sourceCrop = {
    left: sourceCell.left + crop.left,
    top: sourceCell.top + crop.top,
    width: crop.width,
    height: crop.height,
  };
  const fragment = await sharp(receiptSource).extract(sourceCrop)
    .resize({height: targetHeight, kernel: 'nearest'}).png().toBuffer();
  const fragmentSize = await sharp(fragment).metadata();
  const scaleX = fragmentSize.width / crop.width;
  const scaleY = fragmentSize.height / crop.height;
  const left = Math.round(128 - (visible.x - crop.left + visible.width / 2) * scaleX);
  const top = Math.round(128 - (visible.y - crop.top + visible.height / 2) * scaleY);
  const normalized = await sharp({create: {width: 256, height: 256, channels: 4, background: '#00000000'}})
    .composite([{input: fragment, left, top}]).png().toBuffer();
  const decoded = await sharp(normalized).ensureAlpha().raw().toBuffer();
  const texture = await saveTexture(`receipt-tier-${tier}.webp`, normalized);
  tiers.push({
    id: tier,
    ...texture,
    size: {width: 256, height: 256},
    sourceCell,
    sourceAlphaBounds: sourceBounds,
    alphaBounds: measuredBounds(decoded, 256, 256),
    centerUv: {x: .5, y: .5},
    hingeUv: sourceManifest.receipts.hingeUv,
    paperFace: sourceManifest.receipts.paperFace,
    inkStrip: sourceManifest.receipts.inkStrip,
    returnStamp: sourceManifest.receipts.returnStamp,
    lowerCurl: sourceManifest.receipts.lowerCurl,
    normalization: {
      crop,
      outputFragment: {x: left, y: top, width: fragmentSize.width, height: fragmentSize.height},
      method: 'proportional nearest-neighbour fit, alpha16 visible height240, visible centre128/128',
    },
  });
}

const registration = {
  schema: 1,
  status: 'D1 refinement candidates awaiting parent and user visual review',
  generator: 'OpenAI image_gen built-in',
  export: 'Proportional nearest-neighbour PNG crop registration and lossless exact-RGB/alpha WebP',
  common: {vaultEmitters: sourceManifest.vaultEmitters, floorReceivers: sourceManifest.floorReceivers},
  receipts: {
    source: `assets/src/generated/d1-refinement/${sourceManifest.receipts.source}`,
    sourceSha256: createHash('sha256').update(receiptSource).digest('hex'),
    common: {
      canvas: {width: 256, height: 256},
      frame: 66.92682926829268,
      fitVisibleHeight: true,
      centerUv: {x: .5, y: .5},
      hingeUv: sourceManifest.receipts.hingeUv,
    },
    tiers,
  },
  carrier: null,
};

if (sourceManifest.receipts.innerPaper) {
  registration.receipts.innerPaper = await exportInnerPaper(sourceManifest.receipts.innerPaper);
}

if (sourceManifest.carrier) registration.carrier = await exportCarrier(sourceManifest.carrier);

await writeFile(new URL('registration.json', runtimeRoot), JSON.stringify(registration, null, 2) + '\n');
console.log(`Exported ${tiers.length} registered receipt textures and ${registration.carrier ? 3 : 0} carrier layers.`);

if (process.argv.includes('--audit')) {
  const auditRoot = new URL('audit/', sourceRoot);
  await mkdir(auditRoot, {recursive: true});
  const squares = [];
  for (let y = 0; y < 100; y += 4) {
    for (let x = 0; x < 500; x += 4) {
      squares.push(`<rect x="${x}" y="${y}" width="4" height="4" fill="${(x / 4 + y / 4) % 2 ? '#73747b' : '#a3a3aa'}"/>`);
    }
  }
  const checker = Buffer.from(`<svg width="500" height="100">${squares.join('')}</svg>`);
  const oldReceipt = await readFile(new URL('../assets/runtime/receipt.webp', import.meta.url));
  const images = [oldReceipt, ...await Promise.all(tiers.map(tier => readFile(new URL(tier.file.split('/').at(-1), runtimeRoot))))];
  const fragments = [];
  for (let index = 0; index < images.length; index++) {
    const decoded = await sharp(images[index]).ensureAlpha().raw().toBuffer({resolveWithObject: true});
    const visible = alphaBounds(decoded.data, decoded.info.width, decoded.info.height, 16);
    const native = await sharp(images[index]).extract({left: visible.x, top: visible.y, width: visible.width, height: visible.height})
      .resize({height: 67, kernel: 'nearest'}).png().toBuffer();
    const size = await sharp(native).metadata();
    fragments.push({input: native, left: index * 100 + Math.round((100 - size.width) / 2), top: 17});
  }
  const audit = await sharp(checker).composite(fragments).png().toBuffer();
  await sharp(audit).resize(1500, 300, {kernel: 'nearest'}).png()
    .toFile(fileURLToPath(new URL('receipt-old-tiers-native67.png', auditRoot)));
  console.log('Wrote original and four-tier alpha audit at native67px before magnification.');
  if (registration.carrier) {
    const carrier = registration.carrier;
    const checker = [];
    for (let y = 0; y < 80; y += 4) {
      for (let x = 0; x < 100; x += 4) {
        checker.push(`<rect x="${x}" y="${y}" width="4" height="4" fill="${(x / 4 + y / 4) % 2 ? '#73747b' : '#a3a3aa'}"/>`);
      }
    }
    const grid = Buffer.from(`<svg width="100" height="80">${checker.join('')}</svg>`);
    const width = Math.round(carrier.canvas.width * carrier.displayScale);
    const height = Math.round(carrier.canvas.height * carrier.displayScale);
    const closed = await readFile(new URL('carry-case-closed-registered.png', auditRoot));
    const native = await sharp(closed).resize(width, height, {kernel: 'nearest', fit: 'fill'}).png().toBuffer();
    const composed = await sharp(grid).composite([{input: native, left: Math.round((100 - width) / 2), top: 12}]).png().toBuffer();
    await sharp(composed).resize(600, 480, {kernel: 'nearest'}).png()
      .toFile(fileURLToPath(new URL('carry-case-native57.png', auditRoot)));
    console.log('Wrote carrier alpha audit at the proposed57px physical size before magnification.');
  }
  if (registration.receipts.innerPaper) {
    const checker = (width, height, cell) => Buffer.from(
      `<svg width="${width}" height="${height}"><defs><pattern id="grid" width="${cell * 2}" height="${cell * 2}" patternUnits="userSpaceOnUse"><rect width="${cell * 2}" height="${cell * 2}" fill="#a3a3aa"/><rect width="${cell}" height="${cell}" fill="#73747b"/><rect x="${cell}" y="${cell}" width="${cell}" height="${cell}" fill="#73747b"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid)"/></svg>`,
    );
    const outer = await readFile(new URL('receipt-tier-0.webp', runtimeRoot));
    const inner = await readFile(new URL('receipt-inner-blank.webp', runtimeRoot));
    await sharp(checker(512, 256, 8)).composite([
      {input: outer, left: 0, top: 0},
      {input: inner, left: 256, top: 0},
    ]).png().toFile(fileURLToPath(new URL('receipt-outer-inner-registered256.png', auditRoot)));
    const overlays = [];
    for (const [index, bytes] of [outer, inner].entries()) {
      const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer();
      const visible = alphaBounds(decoded, 256, 256, 16);
      const native = await sharp(bytes).extract({left: visible.x, top: visible.y, width: visible.width, height: visible.height})
        .resize({height: 67, kernel: 'nearest'}).png().toBuffer();
      const size = await sharp(native).metadata();
      overlays.push({input: native, left: index * 100 + Math.round((100 - size.width) / 2), top: 17});
    }
    const native = await sharp(checker(200, 100, 4)).composite(overlays).png().toBuffer();
    await writeFile(new URL('receipt-outer-inner-native67.png', auditRoot), native);
    await sharp(native).resize(800, 400, {kernel: 'nearest'}).png()
      .toFile(fileURLToPath(new URL('receipt-outer-inner-native67-4x.png', auditRoot)));
    console.log('Wrote registered256px and native67px outer/blank inner paper audits.');
  }
}
