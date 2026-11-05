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
export type SurfaceFogAppearance = 'sample' | 'regional';
const appearances = {
  // Keep the accepted, memory-only V036 sample's composition unchanged.
  sample: {offsets: [{x: -2, y: -32}, {x: 3, y: 0}, {x: -3, y: 10}],
    spread: [-26, 0, 32], lift: [12, 17, 22], holeY: 104, holeWidth: 151, holeHeight: 73,
    ground: {x: 160, y: 90, width: 320, height: 176}, contactWidth: 126, contactHeight: 37, bounceWidth: 67, bounceHeight: 57},
  regional: {offsets: [{x: -6, y: -25}, {x: 4, y: 0}, {x: -7, y: 9}],
    spread: [-20, 0, 25], lift: [8, 12, 16], holeY: 116, holeWidth: 154, holeHeight: 61,
    ground: {x: 168, y: 82, width: 336, height: 164}, contactWidth: 142, contactHeight: 34, bounceWidth: 78, bounceHeight: 48},
} as const;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const load = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();image.onload = () => resolve(image);image.onerror = reject;image.src = url;
});

/** The reveal hole, volumes and terrain all use the same world-space scale. */
export function surfaceFogLayout(site: SurfaceFogSite, motion: SurfaceFogMotion, appearance: SurfaceFogAppearance = 'sample') {
  const style = appearances[appearance], scale = site.width / 270;
  return style.offsets.map((offset, index) => {
    const breath = motion.reducedMotion ? 0 : Math.sin(motion.elapsedMs / (1400 + index * 430) + index * 2 + site.variant * .7);
    return {x: site.anchor.x + (offset.x + motion.reveal * style.spread[index]) * scale,
      y: site.anchor.y + (offset.y - motion.reveal * style.lift[index]) * scale,
      width: site.width + breath * 3 * scale,
      rotation: motion.reducedMotion ? 0 : breath * .008 + motion.reveal * (index - 1) * .045,
      mirror: site.variant % 2 ? -1 : 1,
      opening: Math.round(clamp(motion.reveal * 1.25 - index * .1) * 80) / 80};
  });
}
export function surfaceFogGroundBounds(site: SurfaceFogSite, appearance: SurfaceFogAppearance = 'sample') {
  const ground = appearances[appearance].ground, scale = site.width / 270;
  return {x: site.anchor.x - ground.x * scale, y: site.anchor.y - ground.y * scale,
    width: ground.width * scale, height: ground.height * scale};
}

/** Approved transparent volumes and terrain response shared by review and play. */
export function createSurfaceFogRenderer(options: {appearance?: SurfaceFogAppearance} = {}) {
  const appearance = options.appearance ?? 'sample', style = appearances[appearance];
  let art: HTMLImageElement[] = [];
  const ready = Promise.all([backUrl, bodyUrl, rimUrl].map(load)).then(images => {art = images;});
  let terrain: HTMLCanvasElement | undefined;
  const buffers = new Map<string, {layers: HTMLCanvasElement[]; openings: number[]; ground: HTMLCanvasElement; groundReady: boolean}>();
  function terrainSupport(globe: HTMLImageElement) {
    if (terrain || appearance !== 'regional') return;
    terrain = document.createElement('canvas');terrain.width = 256;terrain.height = 256;
    const painter = terrain.getContext('2d')!;
    painter.drawImage(globe, 0, 0, 256, 256);
    const pixels = painter.getImageData(0, 0, 256, 256), distance = new Uint16Array(256 * 256);
    // Distance inward from the actual art silhouette. An inset plus a soft
    // transition keeps the cloud inside the terrain even during its small breath.
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const at = y * 256 + x;
      distance[at] = pixels.data[at * 4 + 3] < 24 || x === 0 || y === 0 || x === 255 || y === 255 ? 0
        : 1 + Math.min(distance[at - 1], distance[at - 256]);
    }
    for (let y = 255; y >= 0; y--) for (let x = 255; x >= 0; x--) {
      const at = y * 256 + x;
      if (x < 255 && y < 255) distance[at] = Math.min(distance[at], 1 + distance[at + 1], 1 + distance[at + 256]);
      const edge = clamp((distance[at] - 2) / 4);
      pixels.data[at * 4 + 3] *= edge * edge * (3 - 2 * edge);
    }
    painter.putImageData(pixels, 0, 0);
  }
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
    terrainSupport(frame.globe);
    const cached = buffer(site), scale = site.width / 270;
    const bounds = surfaceFogGroundBounds(site, appearance);
    if (!cached.groundReady) {
      const painter = cached.ground.getContext('2d')!;
      const stepX = bounds.width / 160, stepY = bounds.height / 88;
      painter.imageSmoothingEnabled = false;
      painter.drawImage(frame.globe, (52 - bounds.x) / stepX, (70 - bounds.y) / stepY, 664 / stepX, 664 / stepY);
      const material = painter.getImageData(0, 0, 160, 88);
      for (let y = 0; y < 88; y++) for (let x = 0; x < 160; x++) {
        const index = (y * 160 + x) * 4;
        if (!material.data[index + 3]) continue;
        const localX = (bounds.x + x * stepX - site.anchor.x) / scale;
        const localY = (bounds.y + y * stepY - site.anchor.y) / scale;
        const contact = Math.max(0, 1 - Math.hypot(localX / style.contactWidth, (localY - 11) / style.contactHeight)) ** 2 * .42;
        const leftBounce = Math.max(0, 1 - Math.hypot((localX + 106) / style.bounceWidth, (localY + 11) / style.bounceHeight)) ** 2;
        const rightBounce = Math.max(0, 1 - Math.hypot((localX - 111) / (appearance === 'sample' ? 66 : 77), (localY - 8) / (appearance === 'sample' ? 48 : 44))) ** 2;
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
    const cached = buffer(site), layout = surfaceFogLayout(site, motion, appearance);
    for (let index = 0; index < 3; index++) {
      const canvas = cached.layers[index], painter = canvas.getContext('2d')!;
      const layer = layout[index], opening = layer.opening;
      if (cached.openings[index] !== opening) {
        painter.clearRect(0, 0, 256, 192);painter.imageSmoothingEnabled = false;
        painter.drawImage(art[index], 0, 0);
        if (opening > 0) {
          painter.globalCompositeOperation = 'destination-out';
          for (let row = 0; row < 192; row += 3) for (let col = 0; col < 256; col += 3) {
            const nx = (col - 128) / style.holeWidth, ny = (row - style.holeY) / style.holeHeight;
            const ripple = Math.sin(col * .073 + row * .091 + index * 1.3) * .075;
            if (Math.hypot(nx, ny) + ripple < opening * 2.4) painter.fillRect(col, row, 3, 3);
          }
          painter.globalCompositeOperation = 'source-over';
        }
        if (terrain) {
          // Invert the registered volume transform so the same terrain support
          // clips art and its hit alpha. Inset margin contains the tiny breath.
          const fixed = {...layer, width: site.width,
            rotation: motion.reducedMotion ? 0 : motion.reveal * (index - 1) * .045};
          painter.save();painter.globalCompositeOperation = 'destination-in';
          painter.translate(128, 170);painter.scale(256 / fixed.width, 256 / fixed.width);
          painter.scale(fixed.mirror, 1);painter.rotate(-fixed.rotation);painter.translate(-fixed.x, -fixed.y);
          painter.drawImage(terrain, 52, 70, 664, 664);painter.restore();
        }
        cached.openings[index] = opening;
        canvas.dataset.hitRevision = String(opening);
      }
      context.save();
      context.translate(layer.x, layer.y);context.rotate(layer.rotation);
      if (layer.mirror < 0) context.scale(-1, 1);
      context.drawImage(canvas, -layer.width / 2, -170 / 256 * layer.width, layer.width, 192 / 256 * layer.width);context.restore();
    }
  }
  return {
    ready, groundResponse, cloud,
    metrics() {
      return {fogDecodedTextureBytes: art.reduce((sum, image) => sum + image.naturalWidth * image.naturalHeight * 4, 0),
        groundRelightDecodedTextureBytes: buffers.size * 160 * 88 * 4, maskTextureBytes: buffers.size * 3 * 256 * 192 * 4,
        terrainMaskTextureBytes: terrain ? 256 * 256 * 4 : 0};
    },
  };
}
