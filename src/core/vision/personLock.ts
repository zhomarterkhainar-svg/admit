import { P, type Landmark } from '../types';

export type Rgb = readonly [number, number, number];

/** One detected person as the tracker sees it. */
export interface Candidate {
  /** 33 normalized image landmarks */
  image: Landmark[];
  /** mean colour (0..1) of the torso area — clothing — when it was sampled this frame */
  color?: Rgb | null;
}

/** Where a person is and how big, in aspect-corrected image units (1 unit on x == 1 on y). */
export interface BodyGeometry {
  x: number;
  y: number;
  /** torso size: robust to bending forward (shoulder width) and to lying sideways (torso length) */
  scale: number;
}

interface Target extends BodyGeometry {
  color: Rgb | null;
  lastSeen: number;
}

/** How long the locked person may be missing before we lock onto someone else. */
export const LOST_MS = 2000;
/** A candidate is the same person only if its cost stays below this. */
const MAX_COST = 1.6;
const W_POS = 1;
const W_SCALE = 1.5;
const W_COLOR = 2.5;
/** smoothing of the remembered target (higher = follows faster) */
const FOLLOW = { pos: 0.6, scale: 0.2, color: 0.1 } as const;

const TORSO = [P.leftShoulder, P.rightShoulder, P.leftHip, P.rightHip] as const;

export function bodyGeometry(image: Landmark[], aspect: number): BodyGeometry | null {
  const pts = TORSO.map((i) => image[i]);
  if (pts.some((p) => !p) || Math.min(...pts.map((p) => p!.visibility)) < 0.2) return null;
  const [ls, rs, lh, rh] = pts as Landmark[] as [Landmark, Landmark, Landmark, Landmark];
  const sx = (ls.x + rs.x) / 2;
  const sy = (ls.y + rs.y) / 2;
  const hx = (lh.x + rh.x) / 2;
  const hy = (lh.y + rh.y) / 2;
  const torso = Math.hypot((sx - hx) * aspect, sy - hy);
  const shoulders = Math.hypot((ls.x - rs.x) * aspect, ls.y - rs.y);
  const scale = Math.max(torso, shoulders * 1.25);
  if (!(scale > 1e-3)) return null;
  return { x: ((sx + hx) / 2) * aspect, y: (sy + hy) / 2, scale };
}

const colorDist = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * Keeps the camera on ONE person. The first prominent person (big, near the middle — the one
 * standing in front of the camera) gets locked; after that, every frame picks the candidate that
 * matches the remembered position, size and clothing colour. Someone walking past in the
 * background is a different size, place and colour, so they are ignored instead of stealing the
 * skeleton. If the locked person is missing for LOST_MS, the lock is released and re-acquired.
 */
export class PersonLock {
  private target: Target | null = null;

  get locked(): boolean {
    return this.target !== null;
  }

  /** Forget the current person (e.g. a new player steps in at calibration). */
  reset(): void {
    this.target = null;
  }

  /** Index of the locked person among `cands`, or -1 when they are not in frame right now. */
  pick(cands: readonly Candidate[], t: number, aspect: number): number {
    if (this.target && t - this.target.lastSeen > LOST_MS) this.target = null;
    const geo = cands.map((c) => bodyGeometry(c.image, aspect));

    if (!this.target) {
      const best = mostProminent(geo, aspect);
      if (best >= 0) this.remember(geo[best]!, cands[best]!.color ?? null, t, true);
      return best;
    }

    const tg = this.target;
    // while the person is briefly lost (occluded, stepped aside) trust position less, colour more
    const missing = Math.min(1, Math.max(0, (t - tg.lastSeen - 300) / LOST_MS));
    const wPos = W_POS * (1 - 0.75 * missing);
    let best = -1;
    let bestCost = MAX_COST;
    geo.forEach((g, i) => {
      if (!g) return;
      const color = cands[i]!.color;
      const cost =
        (wPos * Math.hypot(g.x - tg.x, g.y - tg.y)) / tg.scale +
        W_SCALE * Math.abs(Math.log(g.scale / tg.scale)) +
        (color && tg.color ? W_COLOR * colorDist(color, tg.color) : 0);
      if (cost < bestCost) {
        bestCost = cost;
        best = i;
      }
    });
    if (best >= 0) this.remember(geo[best]!, cands[best]!.color ?? null, t, false);
    return best;
  }

  private remember(g: BodyGeometry, color: Rgb | null, t: number, fresh: boolean): void {
    const prev = this.target;
    if (fresh || !prev) {
      this.target = { ...g, color, lastSeen: t };
      return;
    }
    this.target = {
      x: lerp(prev.x, g.x, FOLLOW.pos),
      y: lerp(prev.y, g.y, FOLLOW.pos),
      scale: lerp(prev.scale, g.scale, FOLLOW.scale),
      color:
        color && prev.color
          ? [
              lerp(prev.color[0], color[0], FOLLOW.color),
              lerp(prev.color[1], color[1], FOLLOW.color),
              lerp(prev.color[2], color[2], FOLLOW.color),
            ]
          : (color ?? prev.color),
      lastSeen: t,
    };
  }
}

/** Biggest person, weighted toward the middle of the frame (a passer-by is usually at the edge). */
function mostProminent(geo: (BodyGeometry | null)[], aspect: number): number {
  let best = -1;
  let bestScore = 0;
  geo.forEach((g, i) => {
    if (!g) return;
    const off = Math.abs(g.x / aspect - 0.5); // 0 center … 0.5 edge
    const score = g.scale * (1.15 - off * 1.5);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/**
 * Mean colour of the torso (a 3×3 grid inside the shoulders–hips quad) from a small RGBA
 * snapshot of the frame. Works for side views too: the quad collapses onto the torso line.
 */
export function torsoColor(
  image: Landmark[],
  px: Uint8ClampedArray,
  w: number,
  h: number,
): Rgb | null {
  const [ls, rs, lh, rh] = TORSO.map((i) => image[i]!);
  if (!ls || !rs || !lh || !rh) return null;
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (const u of [0.3, 0.5, 0.7]) {
    for (const v of [0.25, 0.5, 0.75]) {
      const topX = lerp(ls.x, rs.x, u);
      const topY = lerp(ls.y, rs.y, u);
      const botX = lerp(lh.x, rh.x, u);
      const botY = lerp(lh.y, rh.y, u);
      const x = Math.round(lerp(topX, botX, v) * (w - 1));
      const y = Math.round(lerp(topY, botY, v) * (h - 1));
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const k = (y * w + x) * 4;
      r += px[k]!;
      g += px[k + 1]!;
      b += px[k + 2]!;
      n++;
    }
  }
  return n ? [r / n / 255, g / n / 255, b / n / 255] : null;
}
