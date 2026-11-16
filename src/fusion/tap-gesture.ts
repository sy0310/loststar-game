export interface TapPointer {
  id: number;
  primary: boolean;
  button: number;
  x: number;
  y: number;
  at: number;
  scroll: string;
}

/** A single short pointer gesture can produce at most one scene action. */
export class PlanetTapGesture {
  private active = new Set<number>();
  private candidate: TapPointer | null = null;

  down(pointer: TapPointer, eligible: boolean) {
    if (this.active.has(pointer.id)) {this.cancel();return;}
    this.active.add(pointer.id);
    if (this.active.size !== 1) {this.cancel();return;}
    this.candidate = eligible && pointer.primary && pointer.button === 0 ? {...pointer} : null;
  }

  move(pointer: TapPointer) {
    if (this.candidate?.id !== pointer.id) return;
    if (Math.hypot(pointer.x - this.candidate.x, pointer.y - this.candidate.y) > 10) this.cancel();
  }

  up(pointer: TapPointer) {
    const start = this.candidate;
    this.active.delete(pointer.id);
    const accepted = Boolean(start && start.id === pointer.id && pointer.primary && pointer.button === 0
      && this.active.size === 0 && pointer.at >= start.at && pointer.at - start.at <= 450
      && pointer.scroll === start.scroll && Math.hypot(pointer.x - start.x, pointer.y - start.y) <= 10);
    if (start?.id === pointer.id || this.active.size === 0) this.candidate = null;
    return accepted;
  }

  pointerCancel(id: number) {
    this.active.delete(id);
    this.cancel();
  }

  cancel() {this.candidate = null;}
  reset() {this.active.clear();this.cancel();}
}
