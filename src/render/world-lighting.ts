const masks = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();

/** The isolated world includes terrain and every resident, including raised silhouettes. */
export function tintWorld(
  context: CanvasRenderingContext2D,
  color: string,
  strength: number,
) {
  if (strength <= 0) return;
  const world = context.canvas as HTMLCanvasElement;
  let mask = masks.get(world);
  if (!mask) {
    mask = document.createElement('canvas');
    mask.width = world.width;
    mask.height = world.height;
    masks.set(world, mask);
  }
  const source = mask.getContext('2d')!;
  source.globalCompositeOperation = 'source-over';
  source.clearRect(0, 0, mask.width, mask.height);
  source.drawImage(world, 0, 0);
  source.globalCompositeOperation = 'source-in';
  source.fillStyle = color;
  source.fillRect(0, 0, mask.width, mask.height);
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.globalCompositeOperation = 'multiply';
  context.globalAlpha = Math.min(1, strength);
  context.drawImage(mask, 0, 0);
  context.restore();
}
