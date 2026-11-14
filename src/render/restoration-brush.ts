import {receiptRestorationRegistration} from './receipt-restoration';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => {const progress = clamp(value);return progress * progress * (3 - 2 * progress);};

/** The lifted return stroke never clears dirt or presses against the paper. */
export function restorationBrushPose(progress: number) {
  const work = clamp(progress) * 8;
  const pass = Math.min(7, Math.floor(work));
  const local = work >= 8 ? 1 : work - pass;
  const forward = pass % 2 === 0;
  const sweep = clamp(local / .72);
  const transit = ease((local - .72) / .28);
  return {
    pass,
    local,
    source: {x: forward ? sweep * 256 : 256 - sweep * 256, y: 16 + pass * 32 + (pass < 7 ? 32 * transit : 0)},
    pressure: local < .72 ? ease(local / .06) * (1 - ease((local - .65) / .07)) : 0,
    lift: local > .72 ? Math.sin(transit * Math.PI) * 30 : 0,
    contact: local < .72 && progress > 0 && progress < 1,
  };
}

/** The soft fan compresses along its fibres while the actual contact stays fixed. */
export function restorationBrushToolTransform(pressure: number) {
  const brush = receiptRestorationRegistration().tools.brush;
  const dx = brush.root.x - brush.contact.x;
  const dy = brush.root.y - brush.contact.y;
  const length = Math.hypot(dx, dy);
  const nx = dx / length;
  const ny = dy / length;
  const along = 1 - clamp(pressure) * .30;
  const across = 1 + clamp(pressure) * .20;
  const a = across + (along - across) * nx * nx;
  const b = (along - across) * nx * ny;
  const c = b;
  const d = across + (along - across) * ny * ny;
  const e = -a * brush.contact.x - c * brush.contact.y;
  const f = -b * brush.contact.x - d * brush.contact.y;
  const handleOrigin = {x: a * brush.root.x + c * brush.root.y + e - brush.root.x,
    y: b * brush.root.x + d * brush.root.y + f - brush.root.y};
  return {bristles: {a, b, c, d, e, f}, handleOrigin,
    handleGrip: {x: handleOrigin.x + brush.pivot.x, y: handleOrigin.y + brush.pivot.y}};
}
