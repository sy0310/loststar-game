import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {mkdir, readFile, readdir, stat, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';

const sourceRoot = new URL('../assets/src/generated/v034/', import.meta.url);
const outputRoot = new URL('../assets/runtime/v034/', import.meta.url);
const projectRoot = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('registration.source.json', sourceRoot), 'utf8'));
await mkdir(outputRoot, {recursive: true});

function bounds(data, width, height, threshold = 16) {
  let left = width, top = height, right = -1, bottom = -1, count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] < threshold) continue;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y); count++;
    }
  }
  return {x: left, y: top, width: right - left + 1, height: bottom - top + 1, count};
}

async function loadSource(name) {
  const bytes = await readFile(new URL(name, sourceRoot));
  const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  return {...decoded, sha256: createHash('sha256').update(bytes).digest('hex'), name};
}

function registerPaper(source) {
  const result = Buffer.alloc(256 * 256 * 4);
  const ref = manifest.reference;
  const scale = ref.target.height / ref.crop.height;
  for (let y = 0; y < 256; y++) {
    const sy = Math.floor((ref.crop.y + (y + .5 - ref.target.y) / scale) * source.info.height / ref.height);
    if (sy < 0 || sy >= source.info.height) continue;
    for (let x = 0; x < 256; x++) {
      const sx = Math.floor((ref.crop.x + (x + .5 - ref.target.x) / scale) * source.info.width / ref.width);
      if (sx < 0 || sx >= source.info.width) continue;
      const input = (sy * source.info.width + sx) * 4;
      source.data.copy(result, (y * 256 + x) * 4, input, input + 4);
    }
  }
  return result;
}

function registerPatchPieces(source, pieces) {
  const rgba = Buffer.alloc(256 * 256 * 4);
  const registration = [];
  for (const piece of pieces) {
    const points = [];
    const r = piece.sourceRegion;
    let total = 0, sumX = 0, sumY = 0;
    for (let y = r.top; y < r.top + r.height; y++) {
      for (let x = r.left; x < r.left + r.width; x++) {
        const alpha = source.data[(y * source.info.width + x) * 4 + 3];
        if (alpha < 16) continue;
        points.push({x, y, alpha}); total += alpha; sumX += x * alpha; sumY += y * alpha;
      }
    }
    const center = {x: sumX / total, y: sumY / total};
    let xx = 0, yy = 0, xy = 0;
    for (const p of points) {
      xx += (p.x - center.x) ** 2 * p.alpha;
      yy += (p.y - center.y) ** 2 * p.alpha;
      xy += (p.x - center.x) * (p.y - center.y) * p.alpha;
    }
    const angle = Math.atan2(2 * xy, xx - yy) / 2;
    const u = {x: Math.cos(angle), y: Math.sin(angle)};
    const v = {x: -u.y, y: u.x};
    const major = points.map(p => p.x * u.x + p.y * u.y);
    const minor = points.map(p => p.x * v.x + p.y * v.y);
    const majorLength = Math.max(...major) - Math.min(...major) + 1;
    const minorWidth = Math.max(...minor) - Math.min(...minor) + 1;
    const scale = piece.targetLength / majorLength;
    const placed = Buffer.alloc(rgba.length);
    for (let y = 0; y < 256; y++) {
      const sy = Math.floor(center.y + (y + .5 - piece.targetCenter.y) / scale);
      if (sy < r.top || sy >= r.top + r.height) continue;
      for (let x = 0; x < 256; x++) {
        const sx = Math.floor(center.x + (x + .5 - piece.targetCenter.x) / scale);
        if (sx < r.left || sx >= r.left + r.width) continue;
        const input = (sy * source.info.width + sx) * 4;
        const output = (y * 256 + x) * 4;
        source.data.copy(placed, output, input, input + 4);
        if (placed[output + 3]) placed.copy(rgba, output, output, output + 4);
      }
    }
    registration.push({
      id: piece.id, sourceRegion: r, sourceCenter: center, targetCenter: piece.targetCenter,
      sourcePrincipalSize: {length: majorLength, width: minorWidth},
      encodedPrincipalSize: {length: majorLength * scale, width: minorWidth * scale},
      sourceToTextureScale: scale, visibleBounds: bounds(placed, 256, 256),
    });
  }
  return {rgba, registration};
}

async function save(name, data, width = 256, height = 256, extra = {}) {
  // Transparent RGB sanitation leaves every alpha and visible colour unchanged.
  for (let offset = 0; offset < data.length; offset += 4) {
    if (data[offset + 3] === 0) data.fill(0, offset, offset + 3);
  }
  const png = await sharp(data, {raw: {width, height, channels: 4}}).png().toBuffer();
  const file = `${name}.webp`;
  const output = new URL(file, outputRoot);
  await sharp(png).webp({lossless: true, exact: true, alphaQuality: 100, effort: 6})
    .toFile(fileURLToPath(output));
  return {
    file, size: {width, height}, bytes: (await stat(output)).size,
    alphaBounds: {visible16: bounds(data, width, height), solid240: bounds(data, width, height, 240)},
    ...extra,
  };
}

const paperSource = await loadSource(manifest.receipt.paper);
const mudSource = await loadSource(manifest.receipt.mud);
const patchSource = await loadSource(manifest.receipt.patch);
const paper = registerPaper(paperSource);
const mud = registerPaper(mudSource);
const patchRegistration = manifest.receipt.patchPieces ? registerPatchPieces(patchSource, manifest.receipt.patchPieces) : null;
const patch = patchRegistration?.rgba ?? registerPaper(patchSource);
const surviving = Buffer.alloc(paper.length);
const patchBack = Buffer.from(patch);
const patchFront = Buffer.from(patch);
for (let offset = 0; offset < paper.length; offset += 4) {
  const paperAlpha = paper[offset + 3];
  mud[offset + 3] = Math.round(mud[offset + 3] * paperAlpha / 255);
  surviving.fill(255, offset, offset + 3); surviving[offset + 3] = paperAlpha;
  patchBack[offset + 3] = Math.round(patch[offset + 3] * (255 - paperAlpha) / 255);
  patchFront[offset + 3] = Math.round(patch[offset + 3] * paperAlpha / 255);
}
function patchTarget(top, bottom) {
  const region = Buffer.alloc(patch.length);
  let totalWeight = 0, supportedWeight = 0;
  let totalX = 0, totalY = 0, supportedX = 0, supportedY = 0;
  for (let y = top; y < bottom; y++) {
    for (let x = 0; x < 256; x++) {
      const offset = (y * 256 + x) * 4;
      patch.copy(region, offset, offset, offset + 4);
      const alpha = patch[offset + 3];
      if (alpha < 16) continue;
      const support = alpha * paper[offset + 3] / 255;
      totalWeight += alpha; totalX += x * alpha; totalY += y * alpha;
      supportedWeight += support; supportedX += x * support; supportedY += y * support;
    }
  }
  const area = bounds(region, 256, 256);
  return {
    srcRect: {x: area.x, y: area.y, width: area.width, height: area.height},
    contact: {x: supportedX / supportedWeight, y: supportedY / supportedWeight},
    bridgeCenter: {x: totalX / totalWeight, y: totalY / totalWeight},
    contactRule: 'Alpha-weighted tissue position on surviving paper support.',
  };
}
const patchTargets = {upper: patchTarget(0, 130), lower: patchTarget(130, 256)};
const layers = {
  paper: await save('receipt-paper-damaged', paper, 256, 256, {source: paperSource.name, sourceSha256: paperSource.sha256}),
  mud: await save('receipt-mud', mud, 256, 256, {source: mudSource.name, sourceSha256: mudSource.sha256}),
  patchBack: await save('receipt-patch-back', patchBack, 256, 256, {opacity: manifest.receipt.patchOpacity, source: patchSource.name, sourceSha256: patchSource.sha256}),
  patchFront: await save('receipt-patch-front', patchFront, 256, 256, {opacity: manifest.receipt.patchOpacity, source: patchSource.name, sourceSha256: patchSource.sha256}),
  survivingMask: await save('receipt-surviving-paper-mask', surviving, 256, 256, {derivedFrom: 'receipt-paper-damaged.webp'}),
};

async function exportComponent(source, region, width, name) {
  const roi = region ?? {left: 0, top: 0, width: source.info.width, height: source.info.height};
  const selected = await sharp(source.data, {raw: {...source.info, channels: 4}}).extract(roi)
    .ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const visible = bounds(selected.data, selected.info.width, selected.info.height, 128);
  const crop = {
    left: roi.left + Math.max(0, visible.x - 3),
    top: roi.top + Math.max(0, visible.y - 3),
    width: Math.min(roi.width, visible.x + visible.width + 3) - Math.max(0, visible.x - 3),
    height: Math.min(roi.height, visible.y + visible.height + 3) - Math.max(0, visible.y - 3),
  };
  const decoded = await sharp(source.data, {raw: {...source.info, channels: 4}}).extract(crop)
    .resize({width, kernel: 'nearest'}).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  const entry = await save(name, decoded.data, decoded.info.width, decoded.info.height, {
    source: source.name, sourceSha256: source.sha256, sourceRect: crop,
  });
  return {entry, rgba: decoded.data};
}

const soilSource = await loadSource(manifest.soil.source);
const soilComponent = await exportComponent(soilSource, null, manifest.soil.outputWidth, 'receipt-soil-complete');
const {width: soilWidth, height: soilHeight} = soilComponent.entry.size;
const soilBack = Buffer.alloc(soilComponent.rgba.length);
const soilFront = Buffer.alloc(soilComponent.rgba.length);
for (let y = 0; y < soilHeight; y++) {
  for (let x = 0; x < soilWidth; x++) {
    const front = x < soilWidth * .28 || x > soilWidth * .72 || y >= soilHeight * .55;
    const offset = (y * soilWidth + x) * 4;
    soilComponent.rgba.copy(front ? soilFront : soilBack, offset, offset, offset + 4);
  }
}
const soilPlacement = {...manifest.soil.paperRelative, height: manifest.soil.paperRelative.width * soilHeight / soilWidth};
const soil = {
  back: await save('receipt-soil-back', soilBack, soilWidth, soilHeight, {paperRelative: soilPlacement}),
  front: await save('receipt-soil-front', soilFront, soilWidth, soilHeight, {paperRelative: soilPlacement}),
  complete: soilComponent.entry,
};

const toolSource = await loadSource(manifest.tools.source);
const tray = await exportComponent(toolSource, manifest.tools.trayRegion, 384, 'restoration-tray');
const brush = await exportComponent(toolSource, manifest.tools.brushRegion, 192, 'restoration-brush');
function componentPoint(point, entry) {
  return {
    x: (point.x - entry.sourceRect.left) * entry.size.width / entry.sourceRect.width,
    y: (point.y - entry.sourceRect.top) * entry.size.height / entry.sourceRect.height,
  };
}
const trayReceiver = componentPoint(manifest.tools.trayReceiverSource, tray.entry);
const trayWidth = 220;
const trayHeight = trayWidth * tray.entry.size.height / tray.entry.size.width;
const tools = {
  tray: {
    ...tray.entry, contact: trayReceiver, contactRole: 'receiver',
    placementRule: 'Live renderer anchors contact to the actual cabinet receiver plane. paperRelative is a local registration audit example.',
    frontLipY: (manifest.tools.trayFrontLipSourceY - tray.entry.sourceRect.top) * tray.entry.size.height / tray.entry.sourceRect.height,
    paperRelative: {x: 128 - trayReceiver.x / tray.entry.size.width * trayWidth, y: 248 - trayReceiver.y / tray.entry.size.height * trayHeight, width: trayWidth, height: trayHeight},
  },
  brush: {
    ...brush.entry,
    contact: componentPoint(manifest.tools.brushContactSource, brush.entry),
    pivot: componentPoint(manifest.tools.brushPivotSource, brush.entry),
    suggestedPaperWidth: 64.28, suggestedWorldWidth: 18,
  },
};

async function exportResident(species, profile) {
  const source = await loadSource(profile.source);
  if (source.info.width !== source.info.height * 2) {
    throw new Error(`${species} requires two square source cells`);
  }
  const canvas = {width: 256, height: 256};
  const contact = {x: 128, y: 244};
  const cells = [0, 1].map(index => ({
    left: index * source.info.height, top: 0,
    width: source.info.height, height: source.info.height,
  }));
  const sourceBounds = [];
  for (const cell of cells) {
    const decoded = await sharp(source.data, {raw: {...source.info, channels: 4}})
      .extract(cell).raw().toBuffer({resolveWithObject: true});
    sourceBounds.push(bounds(decoded.data, cell.width, cell.height));
  }
  const displayScale = profile.logicalSquareSize / canvas.width;
  const largestWidth = Math.max(...sourceBounds.map(area => area.width));
  const largestHeight = Math.max(...sourceBounds.map(area => area.height));
  const maximumLeft = Math.max(...sourceBounds.map((area, index) => profile.sourceContacts[index].x - area.x));
  const maximumRight = Math.max(...sourceBounds.map((area, index) => area.x + area.width - profile.sourceContacts[index].x));
  const maximumAbove = Math.max(...sourceBounds.map((area, index) => profile.sourceContacts[index].y - area.y));
  const maximumBelow = Math.max(0, ...sourceBounds.map((area, index) => area.y + area.height - profile.sourceContacts[index].y));
  // A pair shares one proportional transform. Each measured support point is
  // registered independently so an actual crouch retains its shorter outline.
  const sourceScale = Math.min(
    profile.maximumVisibleSize.width / displayScale / largestWidth,
    profile.maximumVisibleSize.height / displayScale / largestHeight,
    (contact.x - 4) / maximumLeft,
    (canvas.width - contact.x - 4) / maximumRight,
    (contact.y - 4) / maximumAbove,
    (canvas.height - contact.y - 1) / maximumBelow,
  );
  const frames = [];
  for (let index = 0; index < cells.length; index++) {
    const cell = cells[index];
    const sourceContact = profile.sourceContacts[index];
    const rgba = Buffer.alloc(canvas.width * canvas.height * 4);
    for (let y = 0; y < canvas.height; y++) {
      const sy = Math.floor(sourceContact.y + (y + .5 - contact.y) / sourceScale);
      if (sy < 0 || sy >= cell.height) continue;
      for (let x = 0; x < canvas.width; x++) {
        const sx = Math.floor(sourceContact.x + (x + .5 - contact.x) / sourceScale);
        if (sx < 0 || sx >= cell.width) continue;
        const input = ((sy + cell.top) * source.info.width + sx + cell.left) * 4;
        // The raw bird PNG includes a white A1 matte. Only sub-visible alpha is
        // removed, while all source pixels at alpha16 and above remain exact.
        if (source.data[input + 3] < 16) continue;
        source.data.copy(rgba, (y * canvas.width + x) * 4, input, input + 4);
      }
    }
    const entry = await save(`resident-${species}-${index}`, rgba, canvas.width, canvas.height);
    const visibleBounds = entry.alphaBounds.visible16;
    frames.push({
      ...entry, index, action: profile.actions[index], contact, displayScale,
      visibleBounds,
      encodedVisibleLogicalSize: {width: visibleBounds.width * displayScale, height: visibleBounds.height * displayScale},
      sourceCell: cell, sourceContact, sourceVisibleBounds: sourceBounds[index],
      sourceToTextureScale: sourceScale,
    });
  }
  const day = await sharp(fileURLToPath(new URL(profile.daySource, projectRoot))).metadata();
  return {
    source: `assets/src/generated/v034/${profile.source}`, sourceSha256: source.sha256,
    sourceSize: {width: source.info.width, height: source.info.height},
    daySource: profile.daySource, dayContact: profile.dayContact,
    dayLogicalSize: {width: profile.dayWidth, height: profile.dayWidth * day.height / day.width},
    dayDisplayScale: profile.dayWidth / day.width,
    contactDefinition: profile.contactDefinition,
    alphaRule: 'Source alpha below16 is cleared. Visible source colours and alpha16+ are retained.',
    frames,
  };
}

const residents = {};
for (const [species, profile] of Object.entries(manifest.residents)) {
  residents[species] = await exportResident(species, profile);
}
const registration = {
  schema: 1, status: 'V0.3.4 material candidates awaiting actual composition and user review',
  generator: 'OpenAI image_gen built-in',
  receipt: {
    canvas: {width: 256, height: 256}, center: {x: 128, y: 128}, hinge: {x: 186, y: 48}, unfoldCutY: 190,
    alphaBounds: {visible16: bounds(paper, 256, 256)},
    paperFace: {x: 50, y: 23, width: 158, height: 188}, lowerCurl: {x: 138, y: 199, width: 69, height: 49},
    layers,
    patchTargets,
    patchPieces: patchRegistration?.registration ?? null,
    fixedMarks: ['RET-031', 'P03', 'blank signature line'],
    printRule: 'All stages use the same original ink coordinates and survivingMask. Repair support carries no recovered missing ink.',
    stages: {S0: ['paper', 'originalInk', 'mud'], S1: ['paper', 'originalInk'], S2: ['patchBack', 'paper', 'originalInk', 'patchFront']},
    sourceTransform: manifest.reference,
  },
  soil, tools, residents,
};
await writeFile(new URL('registration.json', outputRoot), JSON.stringify(registration, null, 2) + '\n');
console.log('Exported registered receipt, restoration tools and six daytime resident poses.');

if (process.argv.includes('--audit')) {
  const auditRoot = new URL('audit/', sourceRoot);
  await mkdir(auditRoot, {recursive: true});
  const checker = (width, height) => Buffer.from(`<svg width="${width}" height="${height}"><defs><pattern id="c" width="16" height="16" patternUnits="userSpaceOnUse"><rect width="16" height="16" fill="#a6a4ac"/><rect width="8" height="8" fill="#77737f"/><rect x="8" y="8" width="8" height="8" fill="#77737f"/></pattern></defs><rect width="100%" height="100%" fill="url(#c)"/></svg>`);
  async function png(data, width = 256, height = 256, opacity = 1) {
    const copy = Buffer.from(data);
    for (let offset = 3; offset < copy.length; offset += 4) copy[offset] = Math.round(copy[offset] * opacity);
    return sharp(copy, {raw: {width, height, channels: 4}}).png().toBuffer();
  }
  async function placed(entry) {
    const p = entry.paperRelative;
    return {input: await sharp(fileURLToPath(new URL(entry.file, outputRoot))).resize(Math.round(p.width), Math.round(p.height), {kernel: 'nearest', fit: 'fill'}).png().toBuffer(), left: Math.round(p.x), top: Math.round(p.y)};
  }
  const paperPng = await png(paper), mudPng = await png(mud);
  const patchBackPng = await png(patchBack, 256, 256, manifest.receipt.patchOpacity);
  const patchFrontPng = await png(patchFront, 256, 256, manifest.receipt.patchOpacity);
  const panels = [];
  for (const stage of ['Excavate', 'S0', 'S1', 'S2']) {
    const overlays = [await placed(tools.tray)];
    if (stage === 'Excavate') overlays.push(await placed(soil.back));
    if (stage === 'S2') overlays.push({input: patchBackPng, left: 0, top: 0});
    const dy = stage === 'Excavate' ? 45 : 0;
    const shifted = async image => dy ? sharp(image).extract({left: 0, top: 0, width: 256, height: 256 - dy}).png().toBuffer() : image;
    overlays.push({input: await shifted(paperPng), left: 0, top: dy});
    if (stage === 'Excavate' || stage === 'S0') overlays.push({input: await shifted(mudPng), left: 0, top: dy});
    if (stage === 'S2') overlays.push({input: patchFrontPng, left: 0, top: 0});
    if (stage === 'Excavate') overlays.push(await placed(soil.front));
    const panel = await sharp(checker(256, 300)).composite(overlays).png().toBuffer();
    panels.push(panel);
    await writeFile(new URL(`receipt-${stage.toLowerCase()}-registered256.png`, auditRoot), panel);
  }
  await sharp({create: {width: 1024, height: 300, channels: 4, background: '#00000000'}})
    .composite(panels.map((input, index) => ({input, left: index * 256, top: 0}))).png()
    .toFile(fileURLToPath(new URL('receipt-stages-registered256.png', auditRoot)));
  const nativePanels = await Promise.all(panels.map(input => sharp(input).resize({height: 84, kernel: 'nearest'}).png().toBuffer()));
  const native = await sharp(checker(400, 110)).composite(nativePanels.map((input, index) => ({input, left: index * 100 + 14, top: 6}))).png().toBuffer();
  await writeFile(new URL('receipt-stages-native67.png', auditRoot), native);
  await sharp(native).resize(1600, 440, {kernel: 'nearest'}).png()
    .toFile(fileURLToPath(new URL('receipt-stages-native67-4x.png', auditRoot)));
  const oldMud = registerPaper(await loadSource('receipt-mud-layer-v1.png'));
  for (let offset = 3; offset < oldMud.length; offset += 4) oldMud[offset] = Math.round(oldMud[offset] * paper[offset] / 255);
  const oldComposite = await sharp(checker(256, 256)).composite([{input: paperPng}, {input: await png(oldMud)}]).png().toBuffer();
  const newComposite = await sharp(checker(256, 256)).composite([{input: paperPng}, {input: mudPng}]).png().toBuffer();
  await sharp(checker(512, 256)).composite([{input: oldComposite, left: 0, top: 0}, {input: newComposite, left: 256, top: 0}]).png()
    .toFile(fileURLToPath(new URL('mud-v1-v2-registered256.png', auditRoot)));
  console.log('Wrote real-alpha registered256 and native67 receipt stage audits.');
  const residentOverlays = [];
  const residentRows = Object.values(residents);
  for (let row = 0; row < residentRows.length; row++) {
    const resident = residentRows[row];
    const baseline = row * 120 + 110;
    const day = await sharp(fileURLToPath(new URL(resident.daySource, projectRoot)))
      .resize({width: resident.dayLogicalSize.width, kernel: 'nearest'}).png().toBuffer();
    residentOverlays.push({
      input: day,
      left: Math.round(60 - resident.dayContact.x * resident.dayDisplayScale),
      top: Math.round(baseline - resident.dayContact.y * resident.dayDisplayScale),
    });
    for (let index = 0; index < resident.frames.length; index++) {
      const frame = resident.frames[index];
      const nativeSize = Math.round(frame.size.width * frame.displayScale);
      const input = await sharp(fileURLToPath(new URL(frame.file, outputRoot)))
        .resize(nativeSize, nativeSize, {kernel: 'nearest'}).png().toBuffer();
      residentOverlays.push({
        input, left: Math.round(180 + index * 120 - frame.contact.x * frame.displayScale),
        top: Math.round(baseline - frame.contact.y * frame.displayScale),
      });
    }
  }
  const residentAudit = await sharp(checker(360, 360)).composite(residentOverlays).png().toBuffer();
  await writeFile(new URL('resident-daily-native.png', auditRoot), residentAudit);
  await sharp(residentAudit).resize(1080, 1080, {kernel: 'nearest'}).png()
    .toFile(fileURLToPath(new URL('resident-daily-native-3x.png', auditRoot)));
  console.log('Wrote old-day / new-action0 / new-action1 resident audit at native logical size.');

  const standards = await loadSource('anomaly-standards-v1.png');
  const standardsRgba = Buffer.from(standards.data);
  let clearedLowAlphaPixels = 0;
  let visiblePixels = 0;
  let visibleSaturatedRedPixels = 0;
  for (let offset = 0; offset < standardsRgba.length; offset += 4) {
    const alpha = standardsRgba[offset + 3];
    if (alpha < 16) {
      if (alpha) clearedLowAlphaPixels++;
      standardsRgba.fill(0, offset, offset + 4);
      continue;
    }
    visiblePixels++;
    if (standardsRgba[offset] > 210 && standardsRgba[offset + 1] < 70 && standardsRgba[offset + 2] < 70) {
      visibleSaturatedRedPixels++;
    }
  }
  await sharp({create: {width: standards.info.width, height: standards.info.height, channels: 4, background: '#272436'}})
    .composite([{input: standardsRgba, raw: {width: standards.info.width, height: standards.info.height, channels: 4}}])
    .png().toFile(fileURLToPath(new URL('anomaly-standards-dark.png', auditRoot)));

  const runtimeFiles = {};
  for (const file of (await readdir(outputRoot)).sort()) {
    const bytes = await readFile(new URL(file, outputRoot));
    runtimeFiles[file] = {bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')};
  }
  const scriptBytes = await readFile(fileURLToPath(import.meta.url));
  const sourceManifest = await readFile(new URL('registration.source.json', sourceRoot));
  const report = {
    scope: 'Art export and actual-alpha audits only. Scene animation and phone compatibility are reviewed separately.',
    exporterSha256: createHash('sha256').update(scriptBytes).digest('hex'),
    registrationSourceSha256: createHash('sha256').update(sourceManifest).digest('hex'),
    runtimeFiles,
    runtimeBytes: Object.values(runtimeFiles).reduce((total, file) => total + file.bytes, 0),
    residents: Object.fromEntries(Object.entries(residents).map(([species, resident]) => [species, {
      sourceSha256: resident.sourceSha256, dayContact: resident.dayContact,
      frames: resident.frames.map(frame => ({file: frame.file, contact: frame.contact, displayScale: frame.displayScale, visibleBounds: frame.visibleBounds, logicalVisibleSize: frame.encodedVisibleLogicalSize})),
    }])),
    anomalyStandards: {
      source: standards.name, sourceSha256: standards.sha256,
      size: {width: standards.info.width, height: standards.info.height},
      purpose: 'Conceptual three-species storyboard. No runtime atlas is derived from this sheet.',
      clearedLowAlphaPixels, visiblePixels, visibleSaturatedRedPixels,
    },
  };
  await writeFile(new URL('export-audit.json', auditRoot), JSON.stringify(report, null, 2) + '\n');
  console.log(`Wrote conceptual anomaly sheet audit and hashes for ${Object.keys(runtimeFiles).length} runtime files.`);
}
