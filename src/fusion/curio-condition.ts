import {itemCenter, type Exhibit} from '../render/museum-layout';

export type CurioState = {condition: 'found' | 'clean' | 'stabilized'; action?: {kind: 'clean' | 'repair'; startedAt: number; endsAt: number}};
const materials = new WeakMap<HTMLImageElement, {canvas: HTMLCanvasElement; solid: {x: number; y: number}[]}>();

function materialFor(image: HTMLImageElement) {
  let material = materials.get(image);
  if (material) return material;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 192;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0, 192, 192);
  const alpha = context.getImageData(0, 0, 192, 192).data;
  const solid: {x: number; y: number}[] = [];
  for (let y = 0; y < 192; y += 2) for (let x = 0; x < 192; x += 2) if (alpha[(y * 192 + x) * 4 + 3] > 220) solid.push({x, y});
  material = {canvas, solid};
  materials.set(image, material);
  return material;
}

function contact(solid: {x: number; y: number}[], x: number, y: number) {
  let closest = solid[0] ?? {x: 96, y: 96};
  let distance = Infinity;
  for (const point of solid) {
    const next = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (next < distance) {distance = next;closest = point;}
  }
  return closest;
}

/** Called by MuseumScene inside its measured cavity, before the foreground glass. */
export function drawCurioSpecimen(context: CanvasRenderingContext2D, exhibit: Exhibit, image: HTMLImageElement, state: CurioState, now: number) {
  const material = materialFor(image);
  const painter = material.canvas.getContext('2d')!;
  const phase = state.action ? Math.min(1, Math.max(0, (now - state.action.startedAt) / (state.action.endsAt - state.action.startedAt))) : 0;
  painter.clearRect(0, 0, 192, 192);
  painter.drawImage(image, 0, 0, 192, 192);
  if (state.condition === 'found') {
    const colors = exhibit.id === 'stamp' ? ['#925d43', '#b07d4a', '#644347'] : ['#62594f', '#a18d72', '#776350'];
    painter.globalAlpha = .8;
    for (let i = 0; i < 35; i++) {
      const x = (i * 37 + exhibit.id.length * 11) % 172 + 10;
      const y = (i * 29 + 13) % 172 + 10;
      if (state.action?.kind === 'clean' && x / 192 < phase) continue;
      painter.fillStyle = colors[i % colors.length];
      painter.fillRect(x, y, 8 + i % 6, 5 + i % 5);
    }
    painter.globalAlpha = 1;
    painter.globalCompositeOperation = 'destination-in';painter.drawImage(image, 0, 0, 192, 192);painter.globalCompositeOperation = 'source-over';
  }
  const center = itemCenter(exhibit);
  const size = exhibit.item.size * exhibit.scale;
  const repaired = state.condition === 'stabilized' ? 1 : state.action?.kind === 'repair' ? phase : 0;
  const bob = Math.sin(now / 750 + exhibit.id.length) * 1.2;
  const anchor = contact(material.solid, 123, 116);
  context.save();context.translate(center.x, center.y + bob);context.scale(size / 192, size / 192);context.translate(-96, -96);
  context.drawImage(material.canvas, 0, 0);
  const idle = Math.sin(now / 500);
  context.save();context.translate(anchor.x, anchor.y);
  if (exhibit.id === 'tape') {
    context.strokeStyle = repaired ? '#e6d2a5' : '#a18869';context.lineWidth = 5;
    context.beginPath();context.moveTo(0, 0);context.quadraticCurveTo(31, 14 * (1 - repaired), 22 - 14 * repaired, 27 - 16 * repaired + idle);context.stroke();
    if (repaired) {context.fillStyle = '#e7dcc3';context.fillRect(3, 6, 12, 3);}
  } else if (exhibit.id === 'nested') {
    context.rotate(-.35 * repaired + idle * .035 * repaired);context.fillStyle = '#e7b876';context.fillRect(-29, -5, 34, 6);context.fillStyle = '#9c6452';context.fillRect(-28, 1, 31, 3);
    if (repaired) {context.fillStyle = '#d9bc94';context.fillRect(-15, 1, 8, 8);}
  } else if (exhibit.id === 'stamp') {
    context.fillStyle = repaired ? '#e1b577' : '#776271';context.fillRect(-4, -16, 7, 24);
    if (repaired) {context.fillStyle = '#f0ca8c';context.fillRect(-7, -7, 14, 5);context.fillStyle = '#775752';context.fillRect(-2, -5, 3, 2);}
  } else if (exhibit.id === 'cosmic-parcel') {
    context.strokeStyle = repaired ? '#d8b28b' : '#604c63';context.lineWidth = 3;
    context.beginPath();context.moveTo(-6, -23);context.lineTo(-14, -9);context.lineTo(-3, 3);context.stroke();
    if (repaired) {context.fillStyle = '#d1baa0';context.fillRect(-19, -15, 23, 11);context.fillStyle = '#7d6662';context.fillRect(-13, -10, 10, 2);}
  } else if (exhibit.id === 'bell') {
    context.save();context.rotate(repaired ? idle * .1 : .35);context.fillStyle = '#c3a17a';context.fillRect(-3, -2, 5, 23);context.fillStyle = '#e0be82';context.fillRect(-6, 18, 12, 5);context.restore();
  }
  context.restore();
  if (state.action) {
    const desired = state.action.kind === 'clean' ? {x: 25 + phase * 142, y: 100 + Math.sin(phase * Math.PI * 6) * 25} : anchor;
    const tip = contact(material.solid, desired.x, desired.y);
    // Arm starts at the measured container rim, with a tool that meets solid material.
    context.strokeStyle = '#7e827b';context.lineWidth = 3;context.beginPath();context.moveTo(171, 160);context.lineTo(tip.x + 18, tip.y - 26);context.lineTo(tip.x, tip.y);context.stroke();
    context.save();context.translate(tip.x, tip.y);context.rotate(-.6);context.fillStyle = '#b98c63';context.fillRect(-2, -29, 5, 25);
    context.fillStyle = state.action.kind === 'clean' ? '#d7c4a0' : '#c1b9aa';context.fillRect(-7, -5, 15, 7);
    if (state.action.kind === 'clean') {context.fillStyle = '#e7d7b4';for (let i = 0; i < 6; i++) context.fillRect(-6 + i * 2, 2, 1, 5);}
    context.restore();
  }
  context.restore();
}
