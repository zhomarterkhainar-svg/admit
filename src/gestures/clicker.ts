import type { HandState } from '@/core/vision/visionTypes';
import { DwellTracker, type DwellTarget } from './dwell';
import { GrabDetector, squeezeProgress } from './grab';

/** fallback when the fist can't be seen (too far for the hand model): hover this long = click */
export const FALLBACK_DWELL_MS = 4000;
/** after a click the next screen often has a button under the same spot */
export const CLICK_COOLDOWN_MS = 900;

export interface ClickState {
  hoverId: string | null;
  /** 0..1 fill of the ring / button: the squeeze or the 4 s hover, whichever is further */
  progress: number;
  /** the hand is a fist right now */
  closed: boolean;
  /** button clicked on this update */
  selected: string | null;
  /** how it was clicked */
  via: 'fist' | 'dwell' | null;
}

/**
 * The hand cursor's click logic, independent of React/DOM:
 * main click = open palm squeezed into a fist over a button; fallback = 4 s hover.
 * The squeeze is credited to the button the hand was on while still open (curling the
 * fingers moves the pose fingertip a bit). A held fist never repeats, and every click is
 * followed by a short cooldown.
 */
export class CursorClicker {
  private readonly dwell = new DwellTracker(FALLBACK_DWELL_MS);
  private readonly grab = new GrabDetector();
  private hoverOpen: string | null = null;
  private cooldownUntil = 0;

  update(
    cursor: { x: number; y: number } | null,
    targets: DwellTarget[],
    hand: HandState | null | undefined,
    t: number,
  ): ClickState {
    const cooling = t < this.cooldownUntil;
    const st = this.dwell.update(cursor, targets, t, cooling);
    const fist = this.grab.update(cursor ? hand : null, t);
    if (!fist.closed) this.hoverOpen = st.hoverId;
    const squeeze = cursor && st.hoverId && !cooling ? squeezeProgress(hand?.openness) : 0;
    const squeezed = fist.grab && !cooling ? (this.hoverOpen ?? st.hoverId) : null;
    const selected = squeezed ?? st.selected;
    if (selected) {
      this.cooldownUntil = t + CLICK_COOLDOWN_MS;
      this.dwell.lock(selected);
    }
    return {
      hoverId: st.hoverId,
      progress: Math.max(squeeze, st.progress),
      closed: !!cursor && fist.closed,
      selected,
      via: squeezed ? 'fist' : selected ? 'dwell' : null,
    };
  }
}
