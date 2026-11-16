import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const projectRoot = new URL('../', import.meta.url);
const sourceRoot = new URL('../assets/src/generated/resident-cycle/', import.meta.url);
const outputRoot = new URL('../assets/runtime/resident-cycle/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('registration.source.json', sourceRoot), 'utf8'));
await mkdir(outputRoot, {recursive: true});

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

function nearestRegisteredFrame(source, sourceCell, sourceContact, scale) {
  const {width, height} = manifest.canvas;
  const output = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sourceY = Math.floor(sourceContact.y + (y + .5 - manifest.contact.y) / scale);
    if (sourceY < 0 || sourceY >= sourceCell.height) continue;
    for (let x = 0; x < width; x++) {
      const sourceX = Math.floor(sourceContact.x + (x + .5 - manifest.contact.x) / scale);
      if (sourceX < 0 || sourceX >= sourceCell.width) continue;
      const inputOffset = ((sourceY + sourceCell.top) * source.info.width + sourceX + sourceCell.left) * 4;
      const outputOffset = (y * width + x) * 4;
      source.data.copy(output, outputOffset, inputOffset, inputOffset + 4);
    }
  }
  return output;
}

async function exportPosePair(species, profile, kind) {
  const sourceBytes = await readFile(new URL(profile.source, sourceRoot));
  const source = await sharp(sourceBytes).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  if (source.info.width !== source.info.height * 2) {
    throw new Error(`${species} requires two equal square source cells`);
  }
  const sourceCells = [0, 1].map(index => ({left: index * source.info.height, top: 0, width: source.info.height, height: source.info.height}));
  const sourceBounds = [];
  for (const cell of sourceCells) {
    const frame = await sharp(sourceBytes).extract(cell).ensureAlpha().raw().toBuffer({resolveWithObject: true});
    const visible = alphaBounds(frame.data, cell.width, cell.height, 16);
    if (!visible) throw new Error(`${species} has an empty source pose`);
    sourceBounds.push(visible);
  }

  const displayScale = profile.logicalSquareSize / manifest.canvas.width;
  const maximumWidth = Math.max(...sourceBounds.map(bounds => bounds.width));
  const maximumHeight = Math.max(...sourceBounds.map(bounds => bounds.height));
  const maximumLeft = Math.max(...sourceBounds.map(bounds => profile.sourceContact.x - bounds.x));
  const maximumRight = Math.max(...sourceBounds.map(bounds => bounds.x + bounds.width - profile.sourceContact.x));
  const maximumAbove = Math.max(...sourceBounds.map(bounds => profile.sourceContact.y - bounds.y));
  const maximumBelow = Math.max(0, ...sourceBounds.map(bounds => bounds.y + bounds.height - profile.sourceContact.y));
  // Both poses use one source-to-output scale. The breath is retained at its
  // native relative size while all pixels share the same support contact.
  const sourceScale = Math.min(
    profile.maximumVisibleSize.width / displayScale / maximumWidth,
    profile.maximumVisibleSize.height / displayScale / maximumHeight,
    (manifest.contact.x - 8) / maximumLeft,
    (manifest.canvas.width - 8 - manifest.contact.x) / maximumRight,
    (manifest.contact.y - 8) / maximumAbove,
    (manifest.canvas.height - 1 - manifest.contact.y) / maximumBelow,
  );
  const frames = [];
  const pngFrames = [];
  let bytesTotal = 0;
  for (let index = 0; index < 2; index++) {
    const rgba = nearestRegisteredFrame(source, sourceCells[index], profile.sourceContact, sourceScale);
    const visibleBounds = alphaBounds(rgba, manifest.canvas.width, manifest.canvas.height, 16);
    const png = await sharp(rgba, {raw: {...manifest.canvas, channels: 4}}).png().toBuffer();
    const file = `${species}-${kind}-${index}.webp`;
    const output = new URL(file, outputRoot);
    await sharp(png).webp({lossless: true, exact: true, alphaQuality: 100, effort: 6})
      .toFile(fileURLToPath(output));
    const bytes = (await stat(output)).size;
    bytesTotal += bytes;
    frames.push({
      file,
      index,
      contact: manifest.contact,
      displayScale,
      visibleBounds,
      encodedVisibleLogicalSize: {width: visibleBounds.width * displayScale, height: visibleBounds.height * displayScale},
      scaleRelativeToDay: visibleBounds.width * displayScale / profile.dayWidth,
      sourceCell: sourceCells[index],
      sourceVisibleBounds: sourceBounds[index],
      sourceContact: profile.sourceContact,
      sourceToTextureScale: sourceScale,
      alphaBounds: {
        nonzero: alphaBounds(rgba, manifest.canvas.width, manifest.canvas.height, 1),
        solid240: alphaBounds(rgba, manifest.canvas.width, manifest.canvas.height, 240),
      },
      bytes,
    });
    pngFrames.push(png);
  }
  return {
    source: `assets/src/generated/resident-cycle/${profile.source}`,
    sourceSha256: createHash('sha256').update(sourceBytes).digest('hex'),
    sourceSize: {width: source.info.width, height: source.info.height},
    frames,
    pngFrames,
    bytesTotal,
  };
}

const residents = {};
const auditRows = [];
const flightAuditRows = [];
let runtimeBytes = 0;
let runtimeFrames = 0;
for (const [species, profile] of Object.entries(manifest.residents)) {
  const pair = await exportPosePair(species, profile, 'rest');
  const dayBytes = await readFile(new URL(profile.daySource, projectRoot));
  const dayImage = await sharp(dayBytes).metadata();
  runtimeBytes += pair.bytesTotal;
  runtimeFrames += pair.frames.length;
  residents[species] = {
    source: pair.source,
    sourceSha256: pair.sourceSha256,
    sourceSize: pair.sourceSize,
    daySource: profile.daySource,
    daySize: {width: dayImage.width, height: dayImage.height},
    dayContact: profile.dayContact,
    dayLogicalSize: {width: profile.dayWidth, height: profile.dayWidth * dayImage.height / dayImage.width},
    dayDisplayScale: profile.dayWidth / dayImage.width,
    contactDefinition: profile.contactDefinition,
    frames: pair.frames,
  };
  auditRows.push({species, dayBytes, pngFrames: pair.pngFrames});
  if (profile.flight) {
    const flight = await exportPosePair(species, {...profile.flight, dayWidth: profile.dayWidth}, 'flight');
    residents[species].flightSource = flight.source;
    residents[species].flightSourceSha256 = flight.sourceSha256;
    residents[species].flightFrames = flight.frames;
    residents[species].flightContactDefinition = profile.flight.contactDefinition;
    runtimeBytes += flight.bytesTotal;
    runtimeFrames += flight.frames.length;
    flightAuditRows.push({species, dayBytes, pngFrames: flight.pngFrames});
  }
}

const registration = {
  schema: 1,
  status: 'Resident rest and flight art candidates awaiting actual scene and user review',
  generator: 'OpenAI image_gen built-in',
  canvas: manifest.canvas,
  export: 'One proportional nearest-neighbour transform per species pair, fixed support contact, lossless exact-RGB/alpha WebP',
  scaleRelativeToDayMeaning: 'Measured pose visible width divided by daytime nominal width. This measurement is already encoded. Runtime draws with displayScale once.',
  drawRule: 'drawImage(frame, worldX-contact.x*displayScale, worldY-contact.y*displayScale, canvas.width*displayScale, canvas.height*displayScale)',
  runtimeBytes,
  residents,
};
await writeFile(new URL('registration.json', outputRoot), JSON.stringify(registration, null, 2) + '\n');
console.log(`Exported ${runtimeFrames} registered resident poses using ${runtimeBytes} bytes.`);

if (process.argv.includes('--audit')) {
  const auditRoot = new URL('audit/', sourceRoot);
  await mkdir(auditRoot, {recursive: true});
  const tiles = [];
  for (let y = 0; y < 360; y += 4) {
    for (let x = 0; x < 360; x += 4) {
      tiles.push(`<rect x="${x}" y="${y}" width="4" height="4" fill="${(x / 4 + y / 4) % 2 ? '#777780' : '#a6a6ae'}"/>`);
    }
  }
  for (let row = 0; row < 3; row++) {
    tiles.push(`<path d="M0 ${row * 120 + 110}H360" stroke="#e5ba68" stroke-width="1"/>`);
  }
  const grid = Buffer.from(`<svg width="360" height="360">${tiles.join('')}</svg>`);
  const overlays = [];
  for (let row = 0; row < auditRows.length; row++) {
    const {species, dayBytes, pngFrames} = auditRows[row];
    const resident = residents[species];
    const baseline = row * 120 + 110;
    const day = await sharp(dayBytes).resize({width: resident.dayLogicalSize.width, kernel: 'nearest'}).png().toBuffer();
    overlays.push({input: day, left: Math.round(60 - resident.dayContact.x * resident.dayDisplayScale), top: Math.round(baseline - resident.dayContact.y * resident.dayDisplayScale)});
    for (let index = 0; index < pngFrames.length; index++) {
      const frame = resident.frames[index];
      const width = Math.round(manifest.canvas.width * frame.displayScale);
      const height = Math.round(manifest.canvas.height * frame.displayScale);
      const native = await sharp(pngFrames[index]).resize(width, height, {kernel: 'nearest', fit: 'fill'}).png().toBuffer();
      overlays.push({input: native, left: Math.round(180 + index * 120 - frame.contact.x * frame.displayScale), top: Math.round(baseline - frame.contact.y * frame.displayScale)});
    }
  }
  const native = await sharp(grid).composite(overlays).png().toBuffer();
  await writeFile(new URL('resident-day-rest-native.png', auditRoot), native);
  await sharp(native).resize(1080, 1080, {kernel: 'nearest'}).png()
    .toFile(fileURLToPath(new URL('resident-day-rest-native-3x.png', auditRoot)));
  console.log('Wrote day/rest pose audit at actual logical scale before magnification.');
  for (const {species, dayBytes, pngFrames} of flightAuditRows) {
    const resident = residents[species];
    const day = await sharp(dayBytes).resize({width: resident.dayLogicalSize.width, kernel: 'nearest'}).png().toBuffer();
    const overlays = [{input: day, left: Math.round(60 - resident.dayContact.x * resident.dayDisplayScale), top: Math.round(110 - resident.dayContact.y * resident.dayDisplayScale)}];
    for (let index = 0; index < pngFrames.length; index++) {
      const frame = resident.flightFrames[index];
      const width = Math.round(manifest.canvas.width * frame.displayScale);
      const native = await sharp(pngFrames[index]).resize(width, width, {kernel: 'nearest'}).png().toBuffer();
      overlays.push({input: native, left: Math.round(180 + index * 120 - frame.contact.x * frame.displayScale), top: Math.round(110 - frame.contact.y * frame.displayScale)});
    }
    const strip = await sharp(grid).extract({left: 0, top: 0, width: 360, height: 120})
      .composite(overlays).png().toBuffer();
    await writeFile(new URL(`${species}-day-flight-native.png`, auditRoot), strip);
    await sharp(strip).resize(1440, 480, {kernel: 'nearest'}).png()
      .toFile(fileURLToPath(new URL(`${species}-day-flight-native-4x.png`, auditRoot)));
  }
}
