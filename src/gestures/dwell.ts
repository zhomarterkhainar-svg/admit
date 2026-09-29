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
 * How long the hand cursor must rest on a button to press it. Long enough that sweeping the hand
 * across the screen never clicks by accident; squeezing the hand into a fist clicks at once.
 */
export const DWELL_MS = 2200;

/** Extra margin around the button that is already hovered: jitter at its edge must not reset it. */
const STICKY_PAD = 0.035;
const PAD = 0.01;

const inside = (c: { x: number; y: number }, r: DwellTarget['rect'], pad: number) =>
  c.x >= r.left - pad && c.x <= r.right + pad && c.y >= r.top - pad && c.y <= r.bottom + pad;

/**
 * "Hover to click": holding the cursor over a target for `dwellMs` selects it.
 * After a selection the same target cannot fire again until the cursor leaves it.
 * The hovered target is "sticky" (a wider margin to leave it than to enter it), so a slightly
 * shaky hand near the edge keeps filling the ring instead of starting over.
 */
export class DwellTracker {
  private hoverId: string | null = null;
  private since = 0;
  private locked: string | null = null;

  constructor(private readonly dwellMs = DWELL_MS) {}

  /** @param frozen track hovering but make no progress (e.g. right after a selection) */
  update(
    cursor: { x: number; y: number } | null,
    targets: DwellTarget[],
    t: number,
    frozen = false,
  ): DwellState {
    const current = this.hoverId ? targets.find((tg) => tg.id === this.hoverId) : undefined;
    const hit = cursor
      ? current && inside(cursor, current.rect, STICKY_PAD)
        ? current
        : targets.find((tg) => inside(cursor, tg.rect, PAD))
      : undefined;
    const id = hit?.id ?? null;

    if (id !== this.hoverId) {
      this.hoverId = id;
      this.since = t;
      if (id !== this.locked) this.locked = null;
    }
    if (!id || id === this.locked) return { hoverId: id, progress: 0, selected: null };
    if (frozen) {
      this.since = t;
      return { hoverId: id, progress: 0, selected: null };
    }

    const progress = Math.min(1, (t - this.since) / this.dwellMs);
    if (progress >= 1) {
      this.locked = id;
      return { hoverId: id, progress: 1, selected: id };
    }
    return { hoverId: id, progress, selected: null };
  }

  /** Treat `id` as just selected (by another input, e.g. a fist squeeze): no repeat until it is left. */
  lock(id: string): void {
    this.locked = id;
  }

  reset(): void {
    this.hoverId = null;
    this.locked = null;
  }
}
