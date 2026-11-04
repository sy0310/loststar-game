export interface ScenePoint {x: number; y: number}
export type ScenePickKind = 'space' | 'planet' | 'robot' | 'resident' | 'ship' | 'site';
export interface ScenePick extends ScenePoint {kind: ScenePickKind; id?: string}
export interface SceneHitTarget {kind: Exclude<ScenePickKind, 'space'>; id?: string}
export interface SceneImageCommand {
  target: SceneHitTarget;
  image?: HTMLImageElement | HTMLCanvasElement;
  source: {x: number; y: number; width: number; height: number};
  destination: {x: number; y: number; width: number; height: number};
  transform: {a: number; b: number; c: number; d: number; e: number; f: number};
  opacity: number;
}
export interface SceneAlphaMask {width: number; height: number; alpha: Uint8Array}

export function sceneClientPoint(clientX: number, clientY: number,
  rectangle: {left: number; top: number; width: number; height: number}, width: number, height: number): ScenePoint | null {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY) || rectangle.width <= 0 || rectangle.height <= 0) return null;
  return {x: (clientX - rectangle.left) * width / rectangle.width, y: (clientY - rectangle.top) * height / rectangle.height};
}

/** Invert the recorded camera, sprite rotation, mirror and scale from the actual paint command. */
export function sceneImagePoint(point: ScenePoint, command: SceneImageCommand): ScenePoint | null {
  const matrix = command.transform;
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  if (Math.abs(determinant) < 1e-8 || !command.destination.width || !command.destination.height) return null;
  const x = point.x - matrix.e;
  const y = point.y - matrix.f;
  const localX = (matrix.d * x - matrix.c * y) / determinant;
  const localY = (-matrix.b * x + matrix.a * y) / determinant;
  const u = (localX - command.destination.x) / command.destination.width;
  const v = (localY - command.destination.y) / command.destination.height;
  if (u < 0 || v < 0 || u >= 1 || v >= 1) return null;
  return {x: Math.floor(command.source.x + u * command.source.width), y: Math.floor(command.source.y + v * command.source.height)};
}

export function sceneAlphaHit(point: ScenePoint, command: SceneImageCommand, mask?: SceneAlphaMask) {
  const sample = sceneImagePoint(point, command);
  if (!sample || command.opacity < .1) return false;
  if (!command.image) return true;
  if (!mask || sample.x < 0 || sample.y < 0 || sample.x >= mask.width || sample.y >= mask.height) return false;
  return mask.alpha[sample.y * mask.width + sample.x] * command.opacity >= 24;
}

export function pickSceneCommands(point: ScenePoint, commands: readonly SceneImageCommand[],
  maskFor: (image: HTMLImageElement | HTMLCanvasElement) => SceneAlphaMask | undefined): ScenePick {
  for (let index = commands.length - 1; index >= 0; index--) {
    const command = commands[index];
    if (!sceneImagePoint(point, command)) continue;
    const mask = command.image ? maskFor(command.image) : undefined;
    if (sceneAlphaHit(point, command, mask)) return {...point, ...command.target};
  }
  return {...point, kind: 'space'};
}
