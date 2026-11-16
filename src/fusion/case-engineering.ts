import {layerPoint, type Exhibit} from '../render/museum-layout';

type Palette = {shadow: string; side: string; face: string; bevel: string; lamp: string};
const metal: Palette = {shadow: '#251d34', side: '#624851', face: '#9b744f', bevel: '#d1a16d', lamp: '#a8d7bd'};
const caseUrls = import.meta.glob('../../assets/runtime/case-*-back.webp', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;
const caseImages = Object.fromEntries(Object.entries(caseUrls).map(([path, url]) => {
  const image = new Image();
  image.src = url;
  return [path.split('/').at(-1)!.replace('case-', '').replace('-back.webp', ''), image];
}));

function plate(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number) {
  x = Math.round(x);y = Math.round(y);width = Math.round(width);height = Math.round(height);
  context.fillStyle = metal.shadow;
  context.fillRect(x - 2, y - 2, width + 4, height + 5);
  context.fillStyle = metal.side;
  context.fillRect(x + 2, y + 2, width, height + 2);
  context.fillStyle = metal.face;
  context.fillRect(x, y, width, height);
  context.fillStyle = metal.bevel;
  context.fillRect(x, y, width - 2, 2);
  context.fillRect(x, y + 2, 2, height - 3);
  context.fillStyle = '#76564d';
  context.fillRect(x + 3, y + height - 3, width - 3, 3);
  context.fillRect(x + width - 3, y + 3, 3, height - 3);
}

function shortPipe(context: CanvasRenderingContext2D, start: number, end: number, y: number) {
  const left = Math.min(start, end);
  const width = Math.max(7, Math.abs(end - start));
  context.fillStyle = metal.shadow;
  context.fillRect(left - 1, y - 2, width + 2, 11);
  context.fillStyle = '#76504d';
  context.fillRect(left, y, width, 8);
  context.fillStyle = '#b38760';
  context.fillRect(left, y, width, 4);
  context.fillStyle = '#d0aa7a';
  context.fillRect(left, y, width, 2);
  for (const x of [left + 1, left + width - 5]) {
    context.fillStyle = '#403044';
    context.fillRect(x - 1, y - 2, 5, 12);
    context.fillStyle = '#ac8a67';
    context.fillRect(x, y - 1, 3, 10);
    context.fillStyle = '#d4b185';
    context.fillRect(x, y, 1, 8);
  }
}

function sidecar(context: CanvasRenderingContext2D, x: number, y: number, height: number, level: number, time: number) {
  const image = caseImages['cosmic-parcel'];
  const width = 20;
  plate(context, x + 1, y + height - 9, width - 1, 10);
  if (image?.complete && image.naturalWidth) {
    // Registered controller, pipe joints and ventilation from the authored brass case.
    context.drawImage(image, 237, 157, 31, 132, x, y, width, height);
  } else {
    plate(context, x + 3, y + 3, width - 6, height - 6);
    context.fillStyle = '#3e4d51';context.fillRect(x + 6, y + 10, 8, 12);
    context.fillStyle = '#9bbdaf';context.fillRect(x + 8, y + 13, 4, 2);
  }
  if (level >= 3) {
    plate(context, x - 1, y + height - 18, width + 2, 8);
    context.fillStyle = '#3d2e40';context.fillRect(x + 4, y + height - 15, 11, 2);
  }
  context.fillStyle = Math.sin(time * 1.2) > 0 ? metal.lamp : '#6c8876';
  context.fillRect(x + 8, y + 7, 2, 2);
}

function fittedMount(context: CanvasRenderingContext2D, exhibit: Exhibit) {
  if (exhibit.id === 'receipt') return;
  const image = caseImages[exhibit.id];
  if (!image?.complete || !image.naturalWidth) return;
  const original = layerPoint(exhibit, exhibit.crop.x, exhibit.crop.y);
  const cavity = layerPoint(exhibit, exhibit.cavity.x, exhibit.cavity.y);
  const width = exhibit.crop.w * exhibit.scale;
  const height = exhibit.crop.h * exhibit.scale;
  const expansion = exhibit.id === 'nested' ? 1.1 : 1.14;
  const left = exhibit.x + (original.x - exhibit.x) * expansion;
  const top = original.y - 5;
  context.save();
  // The fitted shroud follows each existing jar, polygonal case, tube, vault or dome.
  // Its inner aperture and original pedestal stay clear of duplicated glass and bases.
  context.beginPath();
  context.rect(left - 3, top - 3, width * expansion + 6, exhibit.y - 13 - top);
  context.rect(cavity.x + 1, cavity.y + 1, exhibit.cavity.w * exhibit.scale - 2, exhibit.cavity.h * exhibit.scale - 2);
  context.clip('evenodd');
  context.drawImage(image, exhibit.crop.x, exhibit.crop.y, exhibit.crop.w, exhibit.crop.h,
    left, top, width * expansion, height + 5);
  context.restore();
}

/** Structural upgrades reuse the authored metal and original cavity/support registration. */
export function drawCaseEngineering(
  context: CanvasRenderingContext2D,
  exhibit: Exhibit,
  rawLevel: number,
  seconds: number,
  layer: 'back' | 'front',
) {
  const level = Math.max(0, Math.min(3, Math.floor(rawLevel)));
  if (level === 0) return;
  const crop = layerPoint(exhibit, exhibit.crop.x, exhibit.crop.y);
  const cavity = layerPoint(exhibit, exhibit.cavity.x, exhibit.cavity.y);
  const bodyRight = crop.x + exhibit.crop.w * exhibit.scale;
  const cavityWidth = exhibit.cavity.w * exhibit.scale;
  const footLeft = exhibit.x - exhibit.width * .57;
  const footWidth = exhibit.width * 1.14;
  const floor = exhibit.y;
  const controlX = bodyRight - 1;
  const controlY = floor - (level === 3 ? 65 : 54);

  context.save();
  context.imageSmoothingEnabled = false;
  if (layer === 'back') {
    context.fillStyle = '#160e2940';
    context.beginPath();context.ellipse(exhibit.x + 2, floor + 3, footWidth * .52, 7, 0, 0, Math.PI * 2);context.fill();
    plate(context, footLeft, floor - 9, footWidth, 12);
    for (const x of [crop.x + 1, bodyRight - 7]) plate(context, x, floor - 24, 8, 19);
    if (level >= 2) shortPipe(context, bodyRight - 8, controlX + 9, floor - 21);
    if (level >= 3) {
      fittedMount(context, exhibit);
      plate(context, footLeft - 3, floor - 2, 16, 9);
      plate(context, footLeft + footWidth - 13, floor - 2, 16, 9);
    }
    context.restore();
    return;
  }

  // The stepped face ends above the independently registered nameplate at floor + 12.
  plate(context, footLeft + 4, floor - 5, footWidth - 8, 9);
  context.fillStyle = metal.shadow;
  context.fillRect(exhibit.x - footWidth * .3, floor - 2, footWidth * .6, 3);
  context.fillStyle = '#e3bf83';
  context.fillRect(exhibit.x - footWidth * .16, floor - 1, footWidth * .32, 1);
  for (const side of [-1, 1]) {
    const x = exhibit.x + side * footWidth * .4;
    context.fillStyle = '#c6a078';context.fillRect(x - 3, floor - 4, 6, 2);
    context.fillStyle = metal.shadow;context.fillRect(x - 1, floor - 3, 2, 2);
  }
  if (level >= 2) {
    sidecar(context, controlX, controlY, floor - controlY - 4, level, seconds);
    for (const x of [crop.x + 2, bodyRight - 6]) {
      plate(context, x - 2, floor - 31, 10, 21);
      context.fillStyle = '#4e3947';context.fillRect(x + 1, floor - 27, 3, 10);
      context.fillStyle = '#b9956c';context.fillRect(x + 1, floor - 27, 1, 8);
    }
  }
  if (level >= 3) {
    const corners = exhibit.id === 'receipt' ? [cavity.y + 12] : [cavity.y + 6, cavity.y + exhibit.cavity.h * exhibit.scale - 8];
    for (const y of corners) {
      for (const x of [cavity.x - 5, cavity.x + cavityWidth - 1]) {
        plate(context, x - 2, y - 2, 9, 9);
        context.fillStyle = '#e6c58f';context.fillRect(x, y, 2, 2);
        context.fillStyle = '#62464b';context.fillRect(x + 3, y + 3, 2, 2);
      }
    }
  }
  context.restore();
}
