import type { FrameFeatures } from '@/core/types';

/** Pose descriptor for the classifier: view-independent, roughly unit-scaled features. */
export function toVector(f: FrameFeatures): number[] {
  const a = (deg: number) => (Number.isFinite(deg) ? deg / 180 : 0.5);
  const c = (v: number, lim: number) =>
    Number.isFinite(v) ? Math.max(-lim, Math.min(lim, v)) / lim : 0;
  return [
    a(f.kneeAngle.l),
    a(f.kneeAngle.r),
    a(f.hipAngle.l),
    a(f.hipAngle.r),
    a(f.elbowAngle.l),
    a(f.elbowAngle.r),
    a(f.shoulderAngle.l),
    a(f.shoulderAngle.r),
    c(f.torsoSideLean, 45),
    c(f.torsoPitch, 60),
    c(f.stanceRatio, 3),
    c(f.wristLift.l, 2),
    c(f.wristLift.r, 2),
    c(f.kneeDrop.l, 1.2),
    c(f.kneeDrop.r, 1.2),
    c(Math.abs(f.kneeDrop.l - f.kneeDrop.r), 1.2),
  ];
}

export const VECTOR_SIZE = 16;
