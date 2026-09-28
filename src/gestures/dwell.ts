export interface DwellTarget {
  id: string;
  /** normalized screen rect [0..1] */
  rect: { left: number; top: number; right: number; bottom: number };
}

export interface DwellState {
  hoverId: string | null;
  /** 0..1 progress of the dwell on the hovered target */
  progress: number;
  /** id selected on this update, if any */
  selected: string | null;
}

/**
 * "Hover to click": holding the cursor over a target for `dwellMs` selects it.
 * After a selection the same target cannot fire again until the cursor leaves it.
 */
export class DwellTracker {
  private hoverId: string | null = null;
  private since = 0;
  private locked: string | null = null;

  constructor(private readonly dwellMs = 1100) {}

  update(cursor: { x: number; y: number } | null, targets: DwellTarget[], t: number): DwellState {
    const pad = 0.01;
    const hit = cursor
      ? targets.find(
          (tg) =>
            cursor.x >= tg.rect.left - pad &&
            cursor.x <= tg.rect.right + pad &&
            cursor.y >= tg.rect.top - pad &&
            cursor.y <= tg.rect.bottom + pad,
        )
      : undefined;
    const id = hit?.id ?? null;

    if (id !== this.hoverId) {
      this.hoverId = id;
      this.since = t;
      if (id !== this.locked) this.locked = null;
    }
    if (!id || id === this.locked) return { hoverId: id, progress: 0, selected: null };

    const progress = Math.min(1, (t - this.since) / this.dwellMs);
    if (progress >= 1) {
      this.locked = id;
      return { hoverId: id, progress: 1, selected: id };
    }
    return { hoverId: id, progress, selected: null };
  }

  reset(): void {
    this.hoverId = null;
    this.locked = null;
  }
}
