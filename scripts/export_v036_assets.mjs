import sharp from 'sharp';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';

const sourceRoot = new URL('../assets/src/generated/v036/', import.meta.url);
const outputRoot = new URL('../assets/runtime/v036/', import.meta.url);
const sourceName = 'star-fog-layers-v3.png';
const source = await readFile(new URL(sourceName, sourceRoot));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(outputRoot, {recursive: true});

function alphaBounds(pixels, width, height, threshold) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  let count = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3] < threshold) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
      count++;
    }
  }
  return {x: left, y: top, width: right - left + 1, height: bottom - top + 1, count};
}

const layers = [];
for (const [index, id] of ['back', 'body', 'rim'].entries()) {
  const sourceRect = {left: 0, top: index * 512, width: 1024, height: 512};
  const pixels = await sharp(source)
    .extract(sourceRect)
    .resize(256, 128, {kernel: 'nearest'})
    .extend({top: 50, bottom: 14, left: 0, right: 0, background: {r: 0, g: 0, b: 0, alpha: 0}})
    .ensureAlpha()
    .raw()
    .toBuffer();
  const bytes = await sharp(pixels, {raw: {width: 256, height: 192, channels: 4}})
    .webp({lossless: true, exact: true, effort: 6})
    .toBuffer();
  const file = `fog-${id}.webp`;
  await writeFile(new URL(file, outputRoot), bytes);
  layers.push({
    id,
    file,
    sourceRect,
    width: 256,
    height: 192,
    bytes: bytes.length,
    sha256: hash(bytes),
    alphaBounds: {
      visible16: alphaBounds(pixels, 256, 192, 16),
      solid220: alphaBounds(pixels, 256, 192, 220),
    },
  });
}

const existingTools = JSON.parse(await readFile(new URL('../assets/runtime/v034-refine/registration.json', import.meta.url), 'utf8'));
const benchName = 'restoration-workbench-v2.png';
const benchSource = await readFile(new URL(benchName, sourceRoot));
const benchMetadata = await sharp(benchSource).metadata();
const benchBytes = await sharp(benchSource)
  .resize(640, 700, {fit: 'cover', kernel: 'nearest'})
  .webp({lossless: true, exact: true, effort: 6})
  .toBuffer();
await writeFile(new URL('restoration-workbench.webp', outputRoot), benchBytes);
const registration = {
  schema: 1,
  status: 'Original runtime candidates referenced to approved concept PNGs, awaiting actual composition and user visual review',
  generator: 'OpenAI built-in image_gen',
  reference: 'assets/src/generated/parcel-globe.png',
  conceptImagesPresentAtGeneration: true,
  approvedReferences: ['design/v036/reference/失物星球探索流程概念图.png', 'design/v036/reference/失物星球_奇物修复展陈方案.png'],
  source: {file: sourceName, sha256: hash(source), width: 1024, height: 1536},
  canvas: {width: 256, height: 192},
  groundContact: {x: 128, y: 170},
  light: {key: 'upper-left lavender', reflected: 'lower-left warm orange'},
  layerOrder: ['fog-back', 'fog-body', 'fog-rim'],
  composition: {
    rule: 'Preserve equal X/Y scale. Stage back layer slightly higher than body and front rim below body to enclose a tall building.',
    suggestedOffsetsWorld: {back: {x: -3, y: -28}, body: {x: 0, y: 0}, rim: {x: 4, y: 9}},
    reveal: 'Apply a local scan-path mask to each layer, then displace separate pieces outward with distinct phase. Never globally fade all layers as one plate.',
  },
  layers,
  workbench: {
    file: 'restoration-workbench.webp',
    width: 640,
    height: 700,
    bytes: benchBytes.length,
    sha256: hash(benchBytes),
    source: {file: benchName, width: benchMetadata.width, height: benchMetadata.height, sha256: hash(benchSource)},
    quietActionArea: {x: 180, y: 150, width: 280, height: 320},
    workSurface: {topY: 438, frontY: 535},
    paperFoot: {x: 320, y: 490},
    lamp: {x: 114, y: 212},
    order: 'Backdrop behind independent tray, soil, paper, tools and glass. No paper or tools baked into backdrop.',
  },
  reusedContactTools: {
    registration: 'assets/runtime/v034-refine/registration.json',
    brush: existingTools.tools.brush,
    spatula: existingTools.tools.spatula,
    tray: 'assets/runtime/v034/restoration-tray.webp',
    glassBack: 'assets/runtime/case-receipt-back.webp',
    glassFront: 'assets/runtime/case-receipt-front.webp',
  },
};
await writeFile(new URL('registration.json', outputRoot), JSON.stringify(registration, null, 2) + '\n');
console.log(JSON.stringify({layers: layers.length, runtimeBytes: layers.reduce((sum, layer) => sum + layer.bytes, 0) + benchBytes.length, registration: 'assets/runtime/v036/registration.json'}));
