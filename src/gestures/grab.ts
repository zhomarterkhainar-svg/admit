import type { HandState } from '@/core/vision/visionTypes';

interface Pt {
  x: number;
  y: number;
  z: number;
}

/** MediaPipe hand landmarks: wrist, then [knuckle (MCP), fingertip] of index … pinky. */
const WRIST = 0;
const FINGERS: ReadonlyArray<readonly [number, number]> = [
  [5, 8],
  [9, 12],
  [13, 16],
  [17, 20],
];

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * Open palm vs fist from the 21 hand landmarks (3D world coords, so it does not depend on how the
 * hand is turned): the average of fingertip→wrist over knuckle→wrist for the four fingers.
 * ≈ 1.9–2.2 with straight fingers, ≈ 0.9–1.3 when they are curled into a fist.
 */
export function handOpenness(lms: readonly Pt[]): number {
  const w = lms[WRIST];
  if (!w || lms.length < 21) return NaN;
  let sum = 0;
  for (const [mcp, tip] of FINGERS) sum += dist(lms[tip]!, w) / Math.max(dist(lms[mcp]!, w), 1e-6);
  return sum / FINGERS.length;
}

/** openness at or above this = open hand, at or below CLOSED_AT = fist (hysteresis in between) */
export const OPEN_AT = 1.5;
export const CLOSED_AT = 1.2;
/**
 * 0 = fully open palm … 1 = fist: drives the "squeeze" ring on the cursor and the button fill,
 * so the user sees the click coming as the fingers curl.
 */
export function squeezeProgress(openness: number | undefined): number {
  if (openness === undefined || !Number.isFinite(openness)) return 0;
  const OPEN_FULL = 1.95;
  return Math.min(1, Math.max(0, (OPEN_FULL - openness) / (OPEN_FULL - CLOSED_AT)));
}

/** the fist must follow an open hand this soon to count as a "squeeze" */
const SQUEEZE_WINDOW_MS = 1500;
/** consecutive fist readings needed (one bad frame must not click) */
const CLOSED_FRAMES = 2;

export interface GrabState {
  /** the hand is currently a fist */
  closed: boolean;
  /** open → fist just happened: click now */
  grab: boolean;
}

/**
 * "Squeeze to click": an open hand that closes into a fist fires once. To click again the hand
 * has to open first, so holding the fist never repeats the click.
 */
export class GrabDetector {
  private armed = false;
  private lastOpen = -Infinity;
  private closedFrames = 0;
  private closed = false;

  update(hand: HandState | null | undefined, t: number): GrabState {
    if (!hand || hand.score < 0.5 || !Number.isFinite(hand.openness)) {
      this.closedFrames = 0;
      if (t - this.lastOpen > SQUEEZE_WINDOW_MS) this.armed = false;
      return { closed: this.closed, grab: false };
    }
    if (hand.openness >= OPEN_AT) {
      this.armed = true;
      this.lastOpen = t;
      this.closedFrames = 0;
      this.closed = false;
      return { closed: false, grab: false };
    }
    if (hand.openness <= CLOSED_AT) {
      this.closedFrames++;
      this.closed = true;
      if (
        this.armed &&
        this.closedFrames >= CLOSED_FRAMES &&
        t - this.lastOpen < SQUEEZE_WINDOW_MS
      ) {
        this.armed = false;
        return { closed: true, grab: true };
      }
    }
    return { closed: this.closed, grab: false };
  }

  reset(): void {
    this.armed = false;
    this.closed = false;
    this.closedFrames = 0;
    this.lastOpen = -Infinity;
  }
}
