const masks = new WeakMap<HTMLImageElement, Map<string, HTMLCanvasElement>>();

/** Tint the already composed world through the actual irregular globe alpha. */
export function tintWorld(
  context: CanvasRenderingContext2D,
  globe: HTMLImageElement,
  color: string,
  strength: number,
) {
  if (strength <= 0) return;
  let colors = masks.get(globe);
  if (!colors) {
    colors = new Map();
    masks.set(globe, colors);
  }
  let mask = colors.get(color);
  if (!mask) {
    mask = document.createElement('canvas');
    mask.width = globe.width;
    mask.height = globe.height;
    const source = mask.getContext('2d')!;
    source.drawImage(globe, 0, 0);
    source.globalCompositeOperation = 'source-in';
    source.fillStyle = color;
    source.fillRect(0, 0, mask.width, mask.height);
    colors.set(color, mask);
  }
  context.save();
  context.globalCompositeOperation = 'multiply';
  context.globalAlpha = Math.min(1, strength);
  context.drawImage(mask, 52, 70, 664, 664);
  context.restore();
}
