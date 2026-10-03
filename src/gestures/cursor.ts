import { P, type PoseFrame } from '@/core/types';
import { OneEuroFilter } from '@/core/filters/oneEuro';

export interface Cursor {
  /** normalized screen coords [0..1], already mirrored for the selfie view */
  x: number;
  y: number;
  hand: 'l' | 'r';
}

/** The body measurements the reach box is built from (aspect-corrected image units). */
export interface ReachBody {
  /** shoulder midpoint */
  x: number;
  y: number;
  hipY: number;
  torso: number;
  shoulderWidth: number;
}

export function reachBody(frame: PoseFrame): ReachBody | null {
  const im = frame.image;
  const aspect = frame.width / frame.height;
  const ls = im[P.leftShoulder]!;
  const rs = im[P.rightShoulder]!;
  const lh = im[P.leftHip]!;
  const rh = im[P.rightHip]!;
  if (Math.min(ls.visibility, rs.visibility) < 0.5) return null;
  const y = (ls.y + rs.y) / 2;
  const hipY = (lh.y + rh.y) / 2;
  return {
    x: ((ls.x + rs.x) / 2) * aspect,
    y,
    hipY,
    torso: Math.max(hipY - y, 0.05),
    shoulderWidth: Math.max(Math.abs(ls.x - rs.x) * aspect, 0.03),
  };
}

/**
 * Kinect-style "reach box": a comfortable box around the shoulders is mapped onto the whole screen,
 * so the user can reach every corner without stretching or walking.
 * The active hand is whichever hand is raised higher (and above the hips).
 * @param body the (optionally smoothed) body the box is anchored to
 */
/**
 * Centre of the palm from the 21 hand landmarks (wrist + the four knuckles): unlike the fingertips
 * it stays put while the fingers curl into a fist, so squeezing to click does not move the cursor.
 */
export function palmCenter(
  points: readonly { x: number; y: number }[],
): { x: number; y: number } | null {
  const idx = [0, 5, 9, 13, 17];
  if (points.length < 21) return null;
  let x = 0;
  let y = 0;
  for (const i of idx) {
    x += points[i]!.x;
    y += points[i]!.y;
  }
  return { x: x / idx.length, y: y / idx.length };
}

/** The hand model's view of one hand (video-normalized), to steer the cursor by the fingers. */
export interface HandPoint {
  hand: 'l' | 'r';
  x: number;
  y: number;
}

/** Where the pose model puts the pointing hand (video-normalized). */
export function posePoint(frame: PoseFrame, hand: 'l' | 'r'): { x: number; y: number } {
  const tip = frame.image[hand === 'l' ? P.leftIndex : P.rightIndex]!;
  const wrist = frame.image[hand === 'l' ? P.leftWrist : P.rightWrist]!;
  // the fingertip alone is the noisiest landmark: blend it with the steadier wrist
  return { x: 0.7 * tip.x + 0.3 * wrist.x, y: 0.7 * tip.y + 0.3 * wrist.y };
}

export function computeCursor(
  frame: PoseFrame,
  prev: Cursor | null,
  body: ReachBody | null = reachBody(frame),
  /** the palm seen close up by the hand model: more precise than the pose fingertip */
  palm: HandPoint | null = null,
): Cursor | null {
  if (!body) return null;
  const im = frame.image;
  const aspect = frame.width / frame.height;
  const { torso, shoulderWidth: sw } = body;

  const candidates = (['l', 'r'] as const)
    .map((hand) => {
      const wrist = im[hand === 'l' ? P.leftWrist : P.rightWrist]!;
      const point = palm && palm.hand === hand ? { x: palm.x, y: palm.y } : posePoint(frame, hand);
      return {
        hand,
        point,
        raised: wrist.visibility > 0.5 && wrist.y < body.hipY - 0.15 * torso,
      };
    })
    .filter((c) => c.raised);
  if (!candidates.length) return null;

  // hysteresis: keep the previous hand while it is still raised
  const pick =
    candidates.find((c) => c.hand === prev?.hand) ??
    candidates.reduce((a, b) => (a.point.y < b.point.y ? a : b));

  const box = {
    left: body.x - 1.7 * sw,
    right: body.x + 1.7 * sw,
    top: body.y - 1.1 * torso,
    bottom: body.y + 0.8 * torso,
  };
  const nx = (pick.point.x * aspect - box.left) / (box.right - box.left);
  const ny = (pick.point.y - box.top) / (box.bottom - box.top);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return { x: clamp(1 - nx), y: clamp(ny), hand: pick.hand };
}

/** Keep the cursor through tracking dropouts shorter than this (a blink of the hand landmark). */
const GRACE_MS = 220;
/** How fast the reach box follows the body (per frame): the box must not wobble with breathing. */
const BODY_FOLLOW = 0.12;
/**
 * The hand model does not see the hand on every frame. Switching the cursor between the palm and
 * the pose point would make it jump, so the palm is applied as a correction of the pose point
 * that eases in (per frame) while the palm is seen and fades out when it is not.
 */
const PALM_IN = 0.3;
const PALM_OUT = 0.1;

/**
 * Steady hand cursor for the UI:
 * - the reach box follows the shoulders slowly, so body sway does not move the pointer;
 * - a One Euro filter removes jitter when the hand is still but keeps fast sweeps snappy;
 * - short dropouts (the hand landmark blinking) keep the cursor instead of hiding it,
 *   so a dwell in progress is not lost.
 */
export class HandCursor {
  private body: ReachBody | null = null;
  private readonly fx = new OneEuroFilter({ minCutoff: 0.8, beta: 4, dCutoff: 1 });
  private readonly fy = new OneEuroFilter({ minCutoff: 0.8, beta: 4, dCutoff: 1 });
  private last: Cursor | null = null;
  private lastSeen = -Infinity;
  /** palm − pose point of `offset.hand`, eased */
  private offset = { hand: null as 'l' | 'r' | null, x: 0, y: 0 };

  /** the pose point corrected by the eased palm offset (null while there is no correction) */
  private steer(frame: PoseFrame, palm: HandPoint | null): HandPoint | null {
    const o = this.offset;
    if (palm && palm.hand !== o.hand) Object.assign(o, { hand: palm.hand, x: 0, y: 0 });
    if (!o.hand) return null;
    const base = posePoint(frame, o.hand);
    const k = palm ? PALM_IN : PALM_OUT;
    o.x += ((palm ? palm.x - base.x : 0) - o.x) * k;
    o.y += ((palm ? palm.y - base.y : 0) - o.y) * k;
    return { hand: o.hand, x: base.x + o.x, y: base.y + o.y };
  }

  update(frame: PoseFrame | null, t: number, palm: HandPoint | null = null): Cursor | null {
    const raw = frame ? reachBody(frame) : null;
    if (raw) {
      const b = this.body;
      this.body = b
        ? {
            x: b.x + (raw.x - b.x) * BODY_FOLLOW,
            y: b.y + (raw.y - b.y) * BODY_FOLLOW,
            hipY: b.hipY + (raw.hipY - b.hipY) * BODY_FOLLOW,
            torso: b.torso + (raw.torso - b.torso) * BODY_FOLLOW,
            shoulderWidth: b.shoulderWidth + (raw.shoulderWidth - b.shoulderWidth) * BODY_FOLLOW,
          }
        : raw;
    }
    const c =
      frame && this.body
        ? computeCursor(frame, this.last, this.body, this.steer(frame, palm))
        : null;
    if (!c) {
      if (this.last && t - this.lastSeen < GRACE_MS) return this.last;
      this.reset();
      return null;
    }
    if (this.last && this.last.hand !== c.hand) {
      this.fx.reset();
      this.fy.reset();
    }
    this.last = { x: this.fx.filter(c.x, t), y: this.fy.filter(c.y, t), hand: c.hand };
    this.lastSeen = t;
    return this.last;
  }

  reset(): void {
    this.last = null;
    this.offset = { hand: null, x: 0, y: 0 };
    this.fx.reset();
    this.fy.reset();
  }
}
