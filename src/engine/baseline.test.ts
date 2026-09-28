import { describe, expect, it } from 'vitest';
import { extractFeatures } from '@/core/features/extract';
import {
  STANDING_WORLD,
  blend,
  makePose,
  repSequence,
  type PoseEdit,
  type Pt,
} from '@/core/reference/template';
import { P } from '@/core/types';
import { squat } from '@/exercises/squat';
import { squatDown } from '@/exercises/squat/reference';
import { runExercise } from '../../tests/helpers/run';
import { BaselineEstimator, personalize, REFERENCE_BASELINE } from './baseline';
import { ExerciseRunner } from './runner';

/** Whole pose rotated around the x axis: a laptop camera looking up/down at the user. */
function tilt(edit: PoseEdit, deg: number): PoseEdit {
  const a = (deg * Math.PI) / 180;
  const out: PoseEdit = {};
  for (let i = 0; i < 33; i++) {
    const [x, y, z = 0] = (edit[i] ?? STANDING_WORLD[i] ?? [0, -0.6]) as Pt;
    out[i] = [x, y * Math.cos(a) - z * Math.sin(a), y * Math.sin(a) + z * Math.cos(a)];
  }
  return out;
}

/** Someone who naturally stands with soft knees (~151°). */
const SOFT_KNEES: PoseEdit = {
  [P.leftKnee]: [0.15, 0.43, -0.11],
  [P.rightKnee]: [-0.15, 0.43, -0.11],
};

describe('personal baseline', () => {
  it('reference baseline is an upright, straight-legged pose', () => {
    expect(REFERENCE_BASELINE.knee).toBeGreaterThan(170);
    expect(REFERENCE_BASELINE.torsoLean).toBeLessThan(5);
  });

  it('counts squats for a person standing with soft knees (auto baseline)', () => {
    const frames = repSequence(squatDown(), { reps: 3, start: SOFT_KNEES, holdMs: 900 });
    const standKnee = extractFeatures(frames[0]!).kneeAngle.l;
    expect(standKnee).toBeLessThan(157); // would never return to "up" without the baseline
    const { reps } = runExercise(squat, frames);
    expect(reps.filter((r) => r.counted)).toHaveLength(3);
  });

  it('does not invent depth: a shallow squat stays "not counted" after personalization', () => {
    const frames = repSequence(blend(SOFT_KNEES, squatDown(), 0.55), {
      reps: 2,
      start: SOFT_KNEES,
      holdMs: 900,
    });
    const { reps } = runExercise(squat, frames);
    expect(reps.length).toBeGreaterThan(0);
    expect(reps.every((r) => !r.counted)).toBe(true);
  });

  it('camera tilt does not produce false torso warnings', () => {
    const frames = repSequence(tilt(squatDown(), 12), {
      reps: 2,
      start: tilt({}, 12),
      holdMs: 900,
    });
    const { reps, hintIds } = runExercise(squat, frames);
    expect(reps.filter((r) => r.counted)).toHaveLength(2);
    expect(hintIds.has('squat.torso')).toBe(false);
  });

  it('estimator ignores non-standing frames and uses the median', () => {
    const est = new BaselineEstimator(5);
    est.add(extractFeatures(makePose(squatDown())));
    expect(est.ready).toBe(false);
    for (let i = 0; i < 10; i++) est.add(extractFeatures(makePose(SOFT_KNEES)));
    expect(est.value!.knee).toBeLessThan(155);
    const f = personalize(extractFeatures(makePose(SOFT_KNEES)), est.value);
    expect(f.kneeAngle.l).toBeGreaterThan(160);
  });
});

describe('noise robustness', () => {
  it('ignores a sub-350 ms threshold crossing', () => {
    const { reps } = runExercise(squat, repSequence(squatDown(), { reps: 1, msPerRep: 260 }));
    expect(reps).toHaveLength(0);
  });

  it('does not judge knees it cannot see', () => {
    const valgus = squatDown({
      [P.leftKnee]: [0.05, 0.45, -0.22],
      [P.rightKnee]: [-0.05, 0.45, -0.22],
    });
    const frames = repSequence(valgus, { msPerRep: 3000 }).map((fr) => ({
      ...fr,
      image: fr.image.map((l, i) =>
        i === P.leftKnee || i === P.rightKnee ? { ...l, visibility: 0.3 } : l,
      ),
    }));
    const { hintIds } = runExercise(squat, frames);
    expect(hintIds.has('squat.valgus')).toBe(false);
  });

  it('explicit calibration baseline is used as-is', () => {
    const est = new BaselineEstimator(3);
    for (let i = 0; i < 8; i++) est.add(extractFeatures(makePose(SOFT_KNEES)));
    const runner = new ExerciseRunner(squat, est.value);
    for (const fr of repSequence(squatDown(), { reps: 2, start: SOFT_KNEES }))
      runner.update(extractFeatures(fr), 1);
    expect(runner.reps.filter((r) => r.counted)).toHaveLength(2);
  });
});

describe('review fixes', () => {
  it('does not learn a baseline from the middle of a movement (no standing hold)', () => {
    const est = new BaselineEstimator(5);
    for (const fr of repSequence(squatDown(), { reps: 3, holdMs: 0 })) est.add(extractFeatures(fr));
    expect(est.value?.knee ?? REFERENCE_BASELINE.knee).toBeGreaterThan(170);
  });

  it('handles users standing with very soft knees (148°)', () => {
    const SOFTER: PoseEdit = {
      [P.leftKnee]: [0.15, 0.43, -0.115],
      [P.rightKnee]: [-0.15, 0.43, -0.115],
    };
    const frames = repSequence(squatDown(), { reps: 3, start: SOFTER, holdMs: 900 });
    expect(extractFeatures(frames[0]!).kneeAngle.l).toBeLessThan(150);
    expect(runExercise(squat, frames).reps.filter((r) => r.counted)).toHaveLength(3);
  });

  it('never changes angles at squat depth', () => {
    const b = { ...REFERENCE_BASELINE, knee: 150 };
    const f = extractFeatures(makePose(squatDown()));
    const deep = { ...f, kneeAngle: { l: 99, r: 99 } };
    expect(personalize(deep, b).kneeAngle.l).toBe(99);
  });

  it('back-to-back smooth reps all get a high control score', () => {
    const { reps } = runExercise(
      squat,
      repSequence(squatDown(), { reps: 4, msPerRep: 1200, holdMs: 0 }),
    );
    expect(reps.length).toBeGreaterThanOrEqual(3);
    for (const r of reps) expect(r.smoothness ?? 100).toBeGreaterThanOrEqual(75);
  });

  it('a knee warning does not turn into praise when the knees become hidden', () => {
    const valgus = squatDown({
      [P.leftKnee]: [0.05, 0.45, -0.22],
      [P.rightKnee]: [-0.05, 0.45, -0.22],
    });
    const frames = repSequence(valgus, { msPerRep: 4000 }).map((fr, i, all) =>
      i > all.length / 2
        ? {
            ...fr,
            image: fr.image.map((l, j) =>
              j === P.leftKnee || j === P.rightKnee ? { ...l, visibility: 0.2 } : l,
            ),
          }
        : fr,
    );
    const { events } = runExercise(squat, frames);
    expect(events.some((e) => e.type === 'fixed' && e.id === 'squat.valgus')).toBe(false);
  });
});
