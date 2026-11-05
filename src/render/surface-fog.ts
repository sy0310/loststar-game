import backUrl from '../../assets/runtime/v036/fog-back.webp';
import bodyUrl from '../../assets/runtime/v036/fog-body.webp';
import rimUrl from '../../assets/runtime/v036/fog-rim.webp';
import type {SceneFrame} from './scene';

export interface SurfaceFogSite {
  id: string;
  anchor: {x: number; y: number};
  width: number;
  variant: number;
}
export interface SurfaceFogMotion {
  elapsedMs: number;
  reveal: number;
  reducedMotion: boolean;
}
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const load = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();image.onload = () => resolve(image);image.onerror = reject;image.src = url;
});

/** Approved transparent volumes and terrain response shared by review and play. */
export function createSurfaceFogRenderer() {
  let art: HTMLImageElement[] = [];
  const ready = Promise.all([backUrl, bodyUrl, rimUrl].map(load)).then(images => {art = images;});
  const buffers = new Map<string, {layers: HTMLCanvasElement[]; openings: number[]; ground: HTMLCanvasElement; groundReady: boolean}>();
  function buffer(site: SurfaceFogSite) {
    const key = `${site.id}/${site.anchor.x}/${site.anchor.y}/${site.width}/${site.variant}`;
    let cached = buffers.get(key);
    if (!cached) {
      const layers = Array.from({length: 3}, () => {
        const layer = document.createElement('canvas');layer.width = 256;layer.height = 192;return layer;
      });
      const ground = document.createElement('canvas');ground.width = 160;ground.height = 88;
      cached = {layers, openings: [-1, -1, -1], ground, groundReady: false};
      buffers.set(key, cached);
    }
    return cached;
  }
  function groundResponse(context: CanvasRenderingContext2D, frame: SceneFrame, site: SurfaceFogSite, reveal: number) {
    if (reveal >= 1) return;
    const cached = buffer(site), scale = site.width / 270;
    const bounds = {x: site.anchor.x - 160 * scale, y: site.anchor.y - 90 * scale, width: 320 * scale, height: 176 * scale};
    if (!cached.groundReady) {
      const painter = cached.ground.getContext('2d')!;
      const step = 2 * scale;
      painter.imageSmoothingEnabled = false;
      painter.drawImage(frame.globe, (52 - bounds.x) / step, (70 - bounds.y) / step, 664 / step, 664 / step);
      const material = painter.getImageData(0, 0, 160, 88);
      for (let y = 0; y < 88; y++) for (let x = 0; x < 160; x++) {
        const index = (y * 160 + x) * 4;
        if (!material.data[index + 3]) continue;
        const localX = (bounds.x + x * step - site.anchor.x) / scale;
        const localY = (bounds.y + y * step - site.anchor.y) / scale;
        const contact = Math.max(0, 1 - Math.hypot(localX / 126, (localY - 11) / 37)) ** 2 * .42;
        const leftBounce = Math.max(0, 1 - Math.hypot((localX + 106) / 67, (localY + 11) / 57)) ** 2;
        const rightBounce = Math.max(0, 1 - Math.hypot((localX - 111) / 66, (localY - 8) / 48)) ** 2;
        const bounce = Math.max(leftBounce, rightBounce) * .23;
        const weight = contact + bounce;
        if (weight === 0) {material.data[index + 3] = 0;continue;}
        const shadowTint = [.43, .36, .76], reflectedTint = [.56, .34, .88];
        for (let channel = 0; channel < 3; channel++) {
          const original = material.data[index + channel];
          const shadow = original * shadowTint[channel];
          const reflection = original + (255 - original) * reflectedTint[channel];
          material.data[index + channel] = (shadow * contact + reflection * bounce) / weight;
        }
        material.data[index + 3] *= weight;
      }
      painter.putImageData(material, 0, 0);cached.groundReady = true;
    }
    context.save();context.globalAlpha = 1 - reveal;
    context.drawImage(cached.ground, bounds.x, bounds.y, bounds.width, bounds.height);context.restore();
  }
  function cloud(context: CanvasRenderingContext2D, site: SurfaceFogSite, motion: SurfaceFogMotion) {
    if (motion.reveal >= 1 || !art.length) return;
    const cached = buffer(site), scale = site.width / 270;
    const offsets = [{x: -2, y: -32}, {x: 3, y: 0}, {x: -3, y: 10}];
    for (let index = 0; index < 3; index++) {
      const canvas = cached.layers[index], painter = canvas.getContext('2d')!;
      const opening = Math.round(clamp(motion.reveal * 1.25 - index * .1) * 80) / 80;
      if (cached.openings[index] !== opening) {
        painter.clearRect(0, 0, 256, 192);painter.imageSmoothingEnabled = false;
        painter.drawImage(art[index], 0, 0);
        if (opening > 0) {
          painter.globalCompositeOperation = 'destination-out';
          for (let row = 0; row < 192; row += 3) for (let col = 0; col < 256; col += 3) {
            const nx = (col - 128) / 151, ny = (row - 104) / 73;
            const ripple = Math.sin(col * .073 + row * .091 + index * 1.3) * .075;
            if (Math.hypot(nx, ny) + ripple < opening * 2.4) painter.fillRect(col, row, 3, 3);
          }
          painter.globalCompositeOperation = 'source-over';
        }
        cached.openings[index] = opening;
      }
      const breath = motion.reducedMotion ? 0 : Math.sin(motion.elapsedMs / (1400 + index * 430) + index * 2 + site.variant * .7);
      const separation = motion.reveal * (index === 1 ? 0 : index === 0 ? -26 : 32) * scale;
      const width = site.width + breath * 3 * scale;
      context.save();
      context.translate(site.anchor.x + offsets[index].x * scale + separation,
        site.anchor.y + offsets[index].y * scale - motion.reveal * (12 + index * 5) * scale);
      context.rotate(motion.reducedMotion ? 0 : breath * .008 + motion.reveal * (index - 1) * .045);
      if (site.variant % 2) context.scale(-1, 1);
      context.drawImage(canvas, -width / 2, -170 / 256 * width, width, 192 / 256 * width);context.restore();
    }
  }
  return {
    ready, groundResponse, cloud,
    metrics() {
      return {fogDecodedTextureBytes: art.reduce((sum, image) => sum + image.naturalWidth * image.naturalHeight * 4, 0),
        groundRelightDecodedTextureBytes: buffers.size * 160 * 88 * 4, maskTextureBytes: buffers.size * 3 * 256 * 192 * 4};
    },
  };
}
