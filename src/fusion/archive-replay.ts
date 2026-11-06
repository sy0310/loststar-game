import {advance, newGame, type SaveData} from '../game/engine';
import {ExpeditionScene} from '../render/scene';
import {createFusionScene} from './scene';
import type {FusionSave} from './contracts';

/** Reconstruct only the last recorded configuration in an isolated render state. */
export function archiveReplaySeed(history: SaveData, now: number): SaveData {
  const recorded = history.world.lastReport?.result;
  const receipt = history.station.lastNight;
  if (!recorded || !receipt || history.world.lastReport!.number !== receipt.number) throw new Error('这一夜的记录尚未齐备');
  const configuration = recorded.configuration;
  const seed = newGame(now - 240000);
  seed.upgrades = {...history.upgrades};
  seed.collection = [...history.collection];
  seed.growth = {...history.growth};
  const beacon = configuration.slots.findIndex(id => id === 'beacon' || id === 'tape');
  const gate = configuration.slots.findIndex(id => id === 'gate' || id === 'bell');
  seed.growth['guard-0'] = beacon < 0 ? 0 : configuration.strengths[beacon];
  seed.growth['guard-1'] = gate < 0 ? 0 : configuration.strengths[gate];
  seed.world.slots = configuration.slots.map(id => id === 'tape' ? 'beacon' : id === 'bell' ? 'gate' : id) as SaveData['world']['slots'];
  seed.station.autoRepair = false;
  seed.station.integrity = Math.max(0, Math.min(100, 100 - receipt.repaired - receipt.unrepaired + receipt.damage));
  const night = advance(seed, now);
  // A replay can only display discoveries already present in the reviewed archive.
  night.collection = [...history.collection];
  return night;
}

/** One cached scene is moved between drawer mounts and never touches a player controller. */
export class ArchiveNightReplay {
  readonly scene: ExpeditionScene;
  private state = newGame(Date.now());
  private startedAt = 0;
  private elapsed = 0;
  private running = false;
  private visualSource?: FusionSave;
  number = 0;

  constructor(parent: HTMLElement, private getVisualSource?: () => FusionSave) {
    // Rendering metadata is a local snapshot. Replay work, rewards and damage
    // continue to use the isolated recorded game, never the player controller.
    if (getVisualSource) this.visualSource = structuredClone(getVisualSource());
    const getState = () => {
      const elapsed = this.seconds * 1000;
      this.state = advance(this.state, this.startedAt + elapsed);
      const now = Date.now();
      return {...this.state, lastAt: now, world: {...this.state.world, lastAt: now}};
    };
    const visual = getVisualSource ? () => ({...this.visualSource!, game: getState()}) : undefined;
    const extension = createFusionScene(getState, undefined, () => this.visualSource?.projects ?? [], visual);
    this.scene = new ExpeditionScene(parent, getState, extension);
    this.scene.canvas.setAttribute('aria-label', '上一夜的发现记录，只读回看');
  }

  get seconds() {
    if (this.running) this.elapsed = Math.min(60000, Math.max(0, performance.now() - this.startedPerformance));
    return this.elapsed / 1000;
  }
  private startedPerformance = 0;

  mount(parent: HTMLElement) {
    parent.append(this.scene.canvas);
    this.scene.setActive(false);
    this.scene.canvas.hidden = true;
  }

  start(history: SaveData) {
    if (this.getVisualSource) this.visualSource = structuredClone(this.getVisualSource());
    this.startedAt = Date.now();
    this.state = archiveReplaySeed(history, this.startedAt);
    this.startedPerformance = performance.now();
    this.elapsed = 0;
    this.number = history.station.lastNight!.number;
    this.running = true;
    this.scene.canvas.hidden = false;
    this.scene.restart();
    this.scene.setActive(true);
  }

  stop() {
    this.elapsed = this.seconds * 1000;
    this.running = false;
    this.scene.setActive(false);
  }
}
