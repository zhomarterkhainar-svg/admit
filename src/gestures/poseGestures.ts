import { P, type FrameFeatures, type PoseFrame } from '@/core/types';

export type PoseGesture = 'handsUp' | 'crossArms' | 'swipeLeft' | 'swipeRight';

interface Hold {
  since: number | null;
  fired: boolean;
}

const HOLD_MS = { handsUp: 700, crossArms: 700 } as const;
const SWIPE = { windowMs: 380, minDist: 1.3, cooldownMs: 800 } as const;

/**
 * Whole-body command gestures:
 * - handsUp: both wrists above the head, held → start / pause / resume
 * - crossArms: forearms crossed in front of the chest ("X"), held → stop / back to menu
 * - swipeLeft / swipeRight: fast horizontal hand sweep at chest height → previous / next
 * Directions are in the mirrored (selfie) screen space the user sees.
 */
export class PoseGestureDetector {
  private readonly holds: Record<'handsUp' | 'crossArms', Hold> = {
    handsUp: { since: null, fired: false },
    crossArms: { since: null, fired: false },
  };
  private trail: { t: number; x: number; hand: 'l' | 'r' }[] = [];
  private swipeCooldownUntil = 0;

  update(frame: PoseFrame | null, f: FrameFeatures | null): PoseGesture[] {
    if (!frame || !f) {
      this.holds.handsUp = { since: null, fired: false };
      this.holds.crossArms = { since: null, fired: false };
      this.trail = [];
      return [];
    }
    const out: PoseGesture[] = [];
    const t = f.t;

    const handsUp = f.wristAboveHead.l && f.wristAboveHead.r && f.visibility.upper > 0.5;
    if (this.hold('handsUp', handsUp, t)) out.push('handsUp');
    if (this.hold('crossArms', isCrossed(frame), t)) out.push('crossArms');

    const swipe = this.swipe(frame, f, t);
    if (swipe) out.push(swipe);
    return out;
  }

  private hold(name: 'handsUp' | 'crossArms', active: boolean, t: number): boolean {
    const h = this.holds[name];
    if (!active) {
      h.since = null;
      h.fired = false;
      return false;
    }
    h.since ??= t;
    if (!h.fired && t - h.since >= HOLD_MS[name]) {
      h.fired = true;
      return true;
    }
    return false;
  }

  private swipe(frame: PoseFrame, f: FrameFeatures, t: number): PoseGesture | null {
    const im = frame.image;
    const aspect = frame.width / frame.height;
    const shoulderY = (im[P.leftShoulder]!.y + im[P.rightShoulder]!.y) / 2;
    const hipY = (im[P.leftHip]!.y + im[P.rightHip]!.y) / 2;
    // the hand at chest height (between shoulders and hips), prefer the higher one
    const hands = (['l', 'r'] as const)
      .map((hand) => ({ hand, w: im[hand === 'l' ? P.leftWrist : P.rightWrist]! }))
      .filter(({ w }) => w.visibility > 0.5 && w.y > shoulderY - 0.1 && w.y < hipY);
    const pick = hands.find((h) => h.hand === this.trail.at(-1)?.hand) ?? hands[0];
    if (!pick) {
      this.trail = [];
      return null;
    }
    this.trail.push({ t, x: pick.w.x * aspect, hand: pick.hand });
    this.trail = this.trail.filter((p) => t - p.t <= SWIPE.windowMs && p.hand === pick.hand);
    if (t < this.swipeCooldownUntil || this.trail.length < 3) return null;

    const dx = (this.trail.at(-1)!.x - this.trail[0]!.x) / Math.max(f.shoulderWidth, 1e-3);
    if (Math.abs(dx) < SWIPE.minDist) return null;
    this.swipeCooldownUntil = t + SWIPE.cooldownMs;
    this.trail = [];
    // image +x is the user's left; on the mirrored screen that is visually "left"
    return dx > 0 ? 'swipeLeft' : 'swipeRight';
  }
}

/** Wrists crossed over the chest: each wrist is on the opposite side of the body midline. */
function isCrossed(frame: PoseFrame): boolean {
  const im = frame.image;
  const lw = im[P.leftWrist]!;
  const rw = im[P.rightWrist]!;
  const ls = im[P.leftShoulder]!;
  const rs = im[P.rightShoulder]!;
  const lh = im[P.leftHip]!;
  const rh = im[P.rightHip]!;
  if (Math.min(lw.visibility, rw.visibility, ls.visibility, rs.visibility) < 0.5) return false;
  const midX = (ls.x + rs.x) / 2;
  const sw = Math.abs(ls.x - rs.x);
  const shoulderY = (ls.y + rs.y) / 2;
  const hipY = (lh.y + rh.y) / 2;
  const chest = (y: number) =>
    y > shoulderY - 0.25 * (hipY - shoulderY) && y < hipY - 0.2 * (hipY - shoulderY);
  // user's left side is image +x
  return lw.x < midX - 0.15 * sw && rw.x > midX + 0.15 * sw && chest(lw.y) && chest(rw.y);
}
