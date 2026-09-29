import { describe, expect, it } from 'vitest';
import { extractFeatures } from '@/core/features/extract';
import { blend, makePose, repSequence, type PoseEdit } from '@/core/reference/template';
import type { PoseFrame } from '@/core/types';
import { concat, runExercise } from '../../tests/helpers/run';
import { elbow, hip } from './floorPose';
import { FLOOR_EXERCISES } from './registry';
import { pushup } from './pushup';
import { pushupDown, pushupTop } from './pushup/reference';
import { plank } from './plank';
import { plankPose } from './plank/reference';
import { bridge } from './bridge';
import { bridgeDown, bridgeUp, bridgeUpFar } from './bridge/reference';

const feat = (e: PoseEdit) => extractFeatures(makePose(e));
/** A pose held still for `ms` at 30 fps. */
const still = (e: PoseEdit, ms: number): PoseFrame[] =>
  Array.from({ length: Math.round(ms / 33) }, (_, i) => makePose(e, i * 33));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (def: any, frames: PoseFrame[]) => runExercise(def, frames);

describe('floor features', () => {
  it('tell standing from lying', () => {
    expect(feat({}).bodyTilt).toBeGreaterThan(80);
    expect(feat(pushupTop()).bodyTilt).toBeLessThan(25);
    expect(feat(plankPose()).bodyTilt).toBeLessThan(15);
    expect(feat(bridgeDown()).bodyTilt).toBeLessThan(5);
  });

  it('measure sagging and piked hips off the body line', () => {
    expect(Math.abs(feat(plankPose()).hipOffset)).toBeLessThan(0.01);
    expect(feat(plankPose(0.13)).hipOffset).toBeGreaterThan(0.07);
    expect(feat(plankPose(-0.13)).hipOffset).toBeLessThan(-0.07);
  });

  it('reference poses have the textbook joint angles', () => {
    expect(elbow(feat(pushupTop()))).toBeGreaterThan(165);
    expect(elbow(feat(pushupDown()))).toBeLessThan(75);
    expect(hip(feat(bridgeDown()))).toBeLessThan(135);
    expect(hip(feat(bridgeUp()))).toBeGreaterThan(165);
  });
});

describe('floor registry', () => {
  it('every floor exercise counts its own reference movement cleanly', () => {
    for (const def of Object.values(FLOOR_EXERCISES)) {
      if (def.hold) continue;
      const { reps } = run(
        def,
        repSequence(def.keyframes.peak, { start: def.keyframes.rest, reps: 2, msPerRep: 2000 }),
      );
      expect(reps, def.id).toHaveLength(2);
      expect(
        reps.every((r) => r.counted && r.quality === 100),
        def.id,
      ).toBe(true);
    }
  });
});

describe('push-up', () => {
  it('rejects a shallow push-up', () => {
    const { reps, errors } = run(
      pushup,
      repSequence(blend(pushupTop(), pushupDown(), 0.5), { start: pushupTop() }),
    );
    expect(reps).toHaveLength(1);
    expect(reps[0]!.counted).toBe(false);
    expect(errors).toContain('pushup.depth');
  });

  it('flags sagging hips', () => {
    const { reps, errors } = run(
      pushup,
      repSequence(pushupDown(0.15), { start: pushupTop(0.15), msPerRep: 2400 }),
    );
    expect(reps[0]!.counted).toBe(true);
    expect(errors).toContain('pushup.sag');
  });

  it('waits for the player to get down on the floor', () => {
    const { reps, hintIds, last } = run(pushup, still({}, 2000));
    expect(reps).toHaveLength(0);
    expect(hintIds).toContain('setup.floorDown');
    expect(last.paused).toBe(true);
  });
});

describe('plank', () => {
  it('counts every second held straight', () => {
    const { reps, errors } = run(plank, still(plankPose(), 5200));
    expect(reps.length).toBeGreaterThanOrEqual(4);
    expect(reps.length).toBeLessThanOrEqual(5);
    expect(reps.every((r) => r.counted && r.quality === 100)).toBe(true);
    expect(errors.size).toBe(0);
  });

  it('keeps the clock running but flags sagging hips', () => {
    const { reps, errors } = run(
      plank,
      concat(still(plankPose(), 1500), still(plankPose(0.13), 3000)),
    );
    expect(reps.length).toBeGreaterThanOrEqual(3);
    expect(errors).toContain('plank.sag');
    expect(reps.at(-1)!.quality).toBeLessThan(100);
  });

  it('stops the clock when the body breaks the line', () => {
    const { reps, hintIds } = run(
      plank,
      concat(still(plankPose(), 2100), still(plankPose(0.25), 3000)),
    );
    expect(reps.length).toBeLessThanOrEqual(2);
    expect(hintIds).toContain('plank.broken');
  });
});

describe('glute bridge', () => {
  it('rejects hips that do not come up to a straight line', () => {
    const { reps, errors } = run(
      bridge,
      repSequence(blend(bridgeDown(), bridgeUp(), 0.6), { start: bridgeDown() }),
    );
    expect(reps).toHaveLength(1);
    expect(reps[0]!.counted).toBe(false);
    expect(errors).toContain('bridge.height');
  });

  it('notices the feet placed too far away', () => {
    const { reps, errors } = run(bridge, repSequence(bridgeUpFar(), { start: bridgeDown() }));
    expect(reps[0]!.counted).toBe(true);
    expect(errors).toContain('bridge.feet');
  });
});
