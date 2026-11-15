import sharp from 'sharp';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const exportsDirectory = path.join(directory, 'exports');
await mkdir(exportsDirectory, {recursive: true});

const files = [];
const detailFiles = [];
async function exportJPEG(name, image, width, height, maximumBytes = 1024 * 1024, records = files) {
  let result;
  let quality;
  for (quality of [94, 90, 86, 82, 78, 74, 68]) {
    result = await sharp(image).jpeg({quality, mozjpeg: true, chromaSubsampling: '4:4:4'}).toBuffer();
    if (result.length <= maximumBytes) break;
  }
  if (result.length > maximumBytes) throw Error('Export exceeds size limit ' + name);
  const metadata = await sharp(result).metadata();
  if (metadata.width !== width || metadata.height !== height) throw Error('Invalid dimensions ' + name);
  const destination = path.join(exportsDirectory, name);
  await mkdir(path.dirname(destination), {recursive: true});
  await writeFile(destination, result);
  records.push({path: path.relative(root, destination), width, height, bytes: result.length, format: 'JPEG', quality, maximumBytes, sha256: createHash('sha256').update(result).digest('hex')});
}

const cover = await sharp(path.join(directory, 'originals/cover-generated.png')).resize(650, 250, {fit: 'cover'}).png().toBuffer();
await exportJPEG('01-cover-650x250.jpg', cover, 650, 250, 80000);

const landscape = await sharp(path.join(directory, 'originals/landscape-generated.png')).resize(1920, 1080, {fit: 'cover'}).png().toBuffer();
await exportJPEG('02-landscape-1920x1080.jpg', landscape, 1920, 1080);

const portraitSource = path.join(directory, 'originals/portrait-generated.png');
const portraitBackdrop = await sharp(portraitSource).resize(1080, 1920, {fit: 'cover'}).blur(24).modulate({brightness: 0.5}).png().toBuffer();
const portraitArt = await sharp(portraitSource).resize({height: 1920}).png().toBuffer();
const portraitMetadata = await sharp(portraitArt).metadata();
const portrait = await sharp(portraitBackdrop).composite([{input: portraitArt, left: Math.round((1080 - portraitMetadata.width) / 2), top: 0}]).png().toBuffer();
await exportJPEG('03-portrait-1080x1920.jpg', portrait, 1080, 1920);

const background = await sharp(path.join(directory, 'originals/story-frame-generated.png')).resize(1080, 1920, {fit: 'cover'}).png().toBuffer();
const screenshotBox = {left: 212, top: 388, width: 656, height: 1419};
const stories = [
  {
    name: '04-story-movement-1080x1920.jpg', title: '一指走位',
    lines: ['拖动飞船，躲避敌潮', '武器自动开火'], footer: '实际游戏画面',
    screenshot: 'artifacts/survivor-v0610/screenshot-natural-opening.png',
    sourceKind: 'Unmodified normal opening screenshot, fitted proportionally',
  },
  {
    name: '05-story-growth-1080x1920.jpg', title: '武装成长',
    lines: ['击退精英，收获随机强化', '试出你的武器与配件组合'], footer: '进阶配装演示',
    screenshot: 'design/star-salvage/wechat-promo-v0610/originals/upgrade-frame-19_15.png',
    sourceKind: 'Actual elite reward frame at 19.15 seconds of the prepared legal loadout recording',
  },
  {
    name: '06-story-fusion-1080x1920.jpg', title: '融合火力',
    lines: ['搭配专属配件，追求满级进化', '两件进化武器，继续融合'], footer: '进阶配装演示',
    screenshot: 'design/star-salvage/wechat-promo-v0610/originals/fusion-frame-12.png',
    sourceKind: 'Actual combat frame at 12 seconds of the prepared legal loadout recording',
  },
];

for (const story of stories) {
  const screenshot = await sharp(path.join(root, story.screenshot)).resize({width: screenshotBox.width, height: screenshotBox.height, fit: 'inside', kernel: 'nearest'}).png().toBuffer();
  const metadata = await sharp(screenshot).metadata();
  const typography = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920">
    <defs><linearGradient id="gold" x2="0" y2="1"><stop stop-color="#fff1ce"/><stop offset=".55" stop-color="#ffdf89"/><stop offset="1" stop-color="#eaa143"/></linearGradient></defs>
    <g text-anchor="middle" font-family="PingFang SC,Heiti SC,Arial Unicode MS,sans-serif">
      <text x="540" y="64" fill="#bfb3d7" font-size="35" letter-spacing="5">失物号 · 星海突进</text>
      <text x="540" y="206" fill="#4a2363" stroke="#4a2363" stroke-width="8" font-size="122" font-weight="900">${story.title}</text>
      <text x="540" y="194" fill="url(#gold)" stroke="#e9b061" stroke-width="1" font-size="122" font-weight="900">${story.title}</text>
      <text x="540" y="282" fill="#f0e7fa" font-size="40" font-weight="600">${story.lines[0]}</text>
      <text x="540" y="340" fill="#8ee4ed" font-size="38">${story.lines[1]}</text>
      <text x="540" y="1880" fill="#bfb3d7" font-size="32">${story.footer}</text>
    </g></svg>`);
  const image = await sharp(background).composite([
    {input: screenshot, left: screenshotBox.left + Math.floor((screenshotBox.width - metadata.width) / 2), top: screenshotBox.top},
    {input: typography, top: 0, left: 0},
  ]).png().toBuffer();
  await exportJPEG(story.name, image, 1080, 1920);
  const detailImage = await sharp(image).resize(720, 1280).png().toBuffer();
  await exportJPEG('wechat-detail-720x1280/' + story.name.replace('1080x1920', '720x1280'), detailImage, 720, 1280, 200000, detailFiles);
}

const sources = [
  'design/star-salvage/v0610/test-materials/art/exports/taptap-banner-title-only-1920x1080.png',
  'design/star-salvage/v068/store-media/exports/taptap-square-promo-1440.png',
  'artifacts/survivor-v0610/screenshot-natural-opening.png',
  'artifacts/survivor-v0610-active-video/late-loadout-active.mp4',
  'artifacts/survivor-v0610-active-video/evidence.json',
];
const sourceRecords = [];
for (const source of sources) {
  const data = await readFile(path.join(root, source));
  sourceRecords.push({path: source, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex')});
}
const manifest = {
  date: '2026-11-15', project: '失物号·星海突进', tool: 'built-in image_gen with original project references',
  platformCoverRequirement: {source: 'User-supplied WeChat promotion-page screenshot', width: 650, height: 250, format: 'JPG/JPEG', maximumBytes: 80000},
  platformDetailRequirement: {source: 'User-supplied detailed portrait promotion screenshot, 2026-11-15', width: 720, height: 1280, formats: ['JPEG', 'JPG', 'PNG'], maximumBytes: 200000, count: 3},
  otherDimensions: {source: 'Chosen portrait and landscape exports, pending platform-specific validation', landscape: [1920,1080], portrait: [1080,1920]},
  sources: sourceRecords, screenshots: stories, files, detailFiles,
  illustrativeArt: ['01-cover-650x250.jpg', '02-landscape-1920x1080.jpg', '03-portrait-1080x1920.jpg'],
  review: {manualReviewRecord: 'README.md', physicalPhoneScreenshots: false, webpageUploaded: false, webpageBlock: 'Prior site-safety denial for mp.weixin.qq.com'},
};
await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

const tiles = [];
for (const [index, file] of files.entries()) {
  const image = await sharp(path.join(root, file.path)).resize(430, 750, {fit: 'contain', background: '#0c081d'}).png().toBuffer();
  tiles.push({input: image, left: 20 + index % 3 * 450, top: 20 + Math.floor(index / 3) * 770});
}
await sharp({create: {width: 1370, height: 1560, channels: 3, background: '#0c081d'}}).composite(tiles).jpeg({quality:90}).toFile(path.join(directory, 'review.jpg'));
const detailTiles = await Promise.all(detailFiles.map(async (file, index) => ({
  input: await sharp(path.join(root, file.path)).resize(360, 640).png().toBuffer(),
  left: 20 + index * 380, top: 20,
})));
await sharp({create: {width: 1160, height: 680, channels: 3, background: '#0c081d'}}).composite(detailTiles).jpeg({quality:90}).toFile(path.join(directory, 'review-details.jpg'));
console.log(JSON.stringify({files, detailFiles}, null, 2));
