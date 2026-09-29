import { describe, expect, it } from 'vitest';
import { extractFeatures } from '@/core/features/extract';
import { blend, makePose, repSequence, type PoseEdit } from '@/core/reference/template';
import { P, type PoseFrame } from '@/core/types';
import { concat, runExercise } from '../../tests/helpers/run';
import { elbow, facingCamera, flare, floorView, hip } from './floorPose';
import { FLOOR_EXERCISES } from './registry';
import { pushup } from './pushup';
import { pushupDown, pushupDownFlared, pushupTop } from './pushup/reference';
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

  it('tells a side view from a front view', () => {
    expect(floorView(feat(pushupTop()))).toBe('side');
    expect(floorView(feat(pushupDown()))).toBe('side');
    expect(floorView(feat(facingCamera(pushupTop())))).toBe('front');
    expect(floorView(feat(facingCamera(pushupDown())))).toBe('front');
  });

  it('measures the same elbow angle from the side and from the front', () => {
    for (const p of [pushupTop(), pushupDown()]) {
      expect(elbow(feat(facingCamera(p)))).toBeCloseTo(elbow(feat(p)), 0);
    }
  });

  it('counts clean push-ups filmed from the front', () => {
    const { reps, errors, hintIds } = run(
      pushup,
      repSequence(facingCamera(pushupDown()), {
        start: facingCamera(pushupTop()),
        reps: 2,
        msPerRep: 2000,
      }),
    );
    expect([...hintIds].filter((h) => h.startsWith('setup.'))).toEqual([]);
    expect(reps).toHaveLength(2);
    expect(reps.every((r) => r.counted && r.quality === 100)).toBe(true);
    expect(errors.size).toBe(0);
  });

  it('rejects a shallow push-up from the front too', () => {
    const { reps, errors } = run(
      pushup,
      repSequence(facingCamera(blend(pushupTop(), pushupDown(), 0.5)), {
        start: facingCamera(pushupTop()),
      }),
    );
    expect(reps[0]!.counted).toBe(false);
    expect(errors).toContain('pushup.depth');
  });

  it('flags elbows flared out to the sides, from either camera angle', () => {
    expect(flare(feat(pushupDown()))).toBeLessThan(50);
    expect(flare(feat(pushupDownFlared()))).toBeGreaterThan(80);
    for (const turn of [(e: PoseEdit) => e, facingCamera]) {
      const bad = run(
        pushup,
        repSequence(turn(pushupDownFlared()), { start: turn(pushupTop()), msPerRep: 2400 }),
      );
      expect(bad.errors).toContain('pushup.flare');
      const good = run(
        pushup,
        repSequence(turn(pushupDown()), { start: turn(pushupTop()), msPerRep: 2400 }),
      );
      expect(good.errors).not.toContain('pushup.flare');
    }
  });

  it('flags sagging hips from the front', () => {
    const { errors } = run(
      pushup,
      repSequence(facingCamera(pushupDown(0.15)), {
        start: facingCamera(pushupTop(0.15)),
        msPerRep: 2400,
      }),
    );
    expect(errors).toContain('pushup.sag');
  });

  it('shows the elbow angle: the near arm from the side, both arms from the front', () => {
    const side = pushup.gauges!(feat(pushupDown()));
    expect(side).toHaveLength(1);
    expect(side[0]!.deg).toBeLessThan(75);
    expect(side[0]!.tone).toBe('good');
    const front = pushup.gauges!(feat(facingCamera(pushupDown())));
    expect(front.map((g) => g.at).sort()).toEqual([P.leftElbow, P.rightElbow].sort());
    expect(pushup.gauges!(feat(pushupTop()))[0]!.tone).toBeUndefined();
  });
});

describe('side-only floor exercises', () => {
  it('ask to turn sideways when filmed from the front', () => {
    const { hintIds, last } = run(plank, still(facingCamera(plankPose()), 2000));
    expect(hintIds).toContain('setup.floorSide');
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
