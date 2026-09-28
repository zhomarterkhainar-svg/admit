import { extractFeatures } from '@/core/features/extract';
import { makePose } from '@/core/reference/template';
import type { FrameFeatures } from '@/core/types';

/** How this person stands in front of this camera (averaged relaxed standing pose). */
export interface Baseline {
  knee: number;
  hip: number;
  torsoLean: number;
  torsoPitch: number;
  torsoSideLean: number;
}

const ref = extractFeatures(makePose());
/** The reference standing pose the thresholds were designed for. */
export const REFERENCE_BASELINE: Baseline = {
  knee: (ref.kneeAngle.l + ref.kneeAngle.r) / 2,
  hip: (ref.hipAngle.l + ref.hipAngle.r) / 2,
  torsoLean: ref.torsoLean,
  torsoPitch: ref.torsoPitch,
  torsoSideLean: ref.torsoSideLean,
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Largest correction we trust (a baseline recorded mid-movement must not break counting). */
const MAX = { knee: 14, hip: 14, lean: 14, side: 8 };
/** frames the pose must stay unchanged (±4°) to count as "standing still" */
const STILL_FRAMES = 6;
/** no knee/hip correction at or below this angle, so real depth is never altered */
const NO_CORRECTION_BELOW = 110;

/**
 * Collects a baseline from frames where the user stands still and upright-ish.
 * Used automatically at the start of each exercise and during calibration.
 */
export class BaselineEstimator {
  private readonly frames: Baseline[] = [];
  /** last few frames, to require the pose to be still (not the middle of a rep) */
  private readonly recent: Baseline[] = [];

  constructor(private readonly need = 20) {}

  add(f: FrameFeatures): void {
    if (this.ready) return;
    const b: Baseline = {
      knee: (f.kneeAngle.l + f.kneeAngle.r) / 2,
      hip: (f.hipAngle.l + f.hipAngle.r) / 2,
      torsoLean: f.torsoLean,
      torsoPitch: f.torsoPitch,
      torsoSideLean: f.torsoSideLean,
    };
    this.recent.push(b);
    if (this.recent.length > STILL_FRAMES) this.recent.shift();
    const upright =
      b.knee > 140 &&
      b.torsoLean < 25 &&
      Math.abs(b.torsoSideLean) < 12 &&
      f.visibility.lower > 0.5;
    const range = (sel: (x: Baseline) => number) =>
      Math.max(...this.recent.map(sel)) - Math.min(...this.recent.map(sel));
    const still =
      this.recent.length === STILL_FRAMES &&
      range((x) => x.knee) < 4 &&
      range((x) => x.torsoLean) < 4;
    if (upright && still) this.frames.push(b);
  }

  get ready(): boolean {
    return this.frames.length >= this.need;
  }

  get value(): Baseline | null {
    if (!this.ready) return null;
    const med = (sel: (b: Baseline) => number) => {
      const v = this.frames.map(sel).sort((a, b) => a - b);
      return v[Math.floor(v.length / 2)]!;
    };
    return {
      knee: med((b) => b.knee),
      hip: med((b) => b.hip),
      torsoLean: med((b) => b.torsoLean),
      torsoPitch: med((b) => b.torsoPitch),
      torsoSideLean: med((b) => b.torsoSideLean),
    };
  }
}

/**
 * Removes the person/camera-specific offset from the features: e.g. someone who stands with
 * knees at 166° or a laptop camera looking up (torso seems to lean back). Corrections fade out
 * toward deep flexion (none below 110°) so real depth is never "invented".
 */
export function personalize(f: FrameFeatures, b: Baseline | null): FrameFeatures {
  if (!b) return f;
  const r = REFERENCE_BASELINE;
  const dKnee = clamp(r.knee - b.knee, 0, MAX.knee);
  const dHip = clamp(r.hip - b.hip, 0, MAX.hip);
  // full correction when standing, none at 90° (deep squat)
  const fade = (angle: number, base: number) =>
    clamp((angle - NO_CORRECTION_BELOW) / Math.max(base - NO_CORRECTION_BELOW, 1), 0, 1);
  const knee = (a: number) => Math.min(180, a + dKnee * fade(a, b.knee));
  const hip = (a: number) => Math.min(180, a + dHip * fade(a, b.hip));
  const dPitch = clamp(b.torsoPitch - r.torsoPitch, -MAX.lean, MAX.lean);
  const dLean = clamp(b.torsoLean - r.torsoLean, 0, MAX.lean);
  const dSide = clamp(b.torsoSideLean - r.torsoSideLean, -MAX.side, MAX.side);
  return {
    ...f,
    kneeAngle: { l: knee(f.kneeAngle.l), r: knee(f.kneeAngle.r) },
    hipAngle: { l: hip(f.hipAngle.l), r: hip(f.hipAngle.r) },
    torsoLean: Math.max(0, f.torsoLean - dLean),
    torsoPitch: f.torsoPitch - dPitch,
    torsoSideLean: f.torsoSideLean - dSide,
  };
}
