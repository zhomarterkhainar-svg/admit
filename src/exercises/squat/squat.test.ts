import { describe, expect, it } from 'vitest';
import { P, type PoseFrame } from '@/core/types';
import { extractFeatures } from '@/core/features/extract';
import { ExerciseRunner, type RunnerEvent } from '@/engine/runner';
import { blend, repSequence, squatDown } from '../../../tests/helpers/pose';
import { squat } from '.';

function run(frames: PoseFrame[], people = 1) {
  const runner = new ExerciseRunner(squat);
  const events: RunnerEvent[] = [];
  let last = runner.update(null, people);
  for (const fr of frames) {
    last = runner.update(extractFeatures(fr), people);
    events.push(...last.events);
  }
  const hintIds = new Set(events.flatMap((e) => (e.type === 'hint' ? [e.hint.id] : [])));
  return { runner, last, events, hintIds };
}

describe('squat', () => {
  it('counts clean deep reps without form errors', () => {
    const { runner, hintIds } = run(repSequence(squatDown(), { reps: 3 }));
    expect(runner.reps).toHaveLength(3);
    expect(runner.reps.every((r) => r.counted)).toBe(true);
    expect(runner.reps.every((r) => r.quality === 100)).toBe(true);
    expect([...hintIds]).toEqual([]);
  });

  it('does not count a shallow squat and explains why', () => {
    const shallow = blend({}, squatDown(), 0.55);
    const { runner, hintIds } = run(repSequence(shallow, { reps: 2 }));
    expect(runner.reps).toHaveLength(2);
    expect(runner.reps.every((r) => !r.counted)).toBe(true);
    expect(runner.reps[0]!.errors).toContain('squat.depth');
    expect(hintIds).toContain('squat.depth');
  });

  it('flags knee valgus at the bottom and highlights knees', () => {
    const valgus = squatDown({
      [P.leftKnee]: [0.05, 0.45, -0.22],
      [P.rightKnee]: [-0.05, 0.45, -0.22],
    });
    const { runner, hintIds, events } = run(repSequence(valgus, { reps: 1, msPerRep: 3000 }));
    expect(hintIds).toContain('squat.valgus');
    expect(runner.reps[0]!.errors).toContain('squat.valgus');
    expect(runner.reps[0]!.quality).toBeLessThan(100);
    expect(events.some((e) => e.type === 'hint' && e.hint.joints.includes(P.leftKnee))).toBe(true);
  });

  it('flags a too-fast rep', () => {
    const { runner } = run(repSequence(squatDown(), { reps: 1, msPerRep: 600 }));
    expect(runner.reps[0]!.errors).toContain('squat.tempo');
    expect(runner.reps[0]!.counted).toBe(true);
  });

  it('pauses counting and asks to step back when feet are not visible', () => {
    const frames = repSequence(squatDown(), { reps: 2 }).map((fr) => ({
      ...fr,
      image: fr.image.map((l, i) =>
        i === P.leftAnkle || i === P.rightAnkle ? { ...l, visibility: 0.1 } : l,
      ),
    }));
    const { runner, hintIds, last } = run(frames);
    expect(runner.reps).toHaveLength(0);
    expect(hintIds).toContain('setup.tooClose');
    expect(last.paused).toBe(true);
  });

  it('asks to stay alone when two people are in frame', () => {
    const { hintIds, runner } = run(repSequence(squatDown(), { reps: 1 }), 2);
    expect(hintIds).toContain('setup.multiplePeople');
    expect(runner.reps).toHaveLength(0);
  });
});

describe('runner without a person', () => {
  it('asks the user to stand in front of the camera', () => {
    const runner = new ExerciseRunner(squat);
    const st = runner.update(null, 0, 1000);
    expect(st.hint?.id).toBe('setup.noPerson');
    expect(st.paused).toBe(true);
  });
});

describe('darkness', () => {
  it('explains "too dark" instead of "can\'t see you"', () => {
    const runner = new ExerciseRunner(squat);
    expect(runner.update(null, 0, 1000, { brightness: 0.05 }).hint?.id).toBe('setup.dark');
  });

  it('pauses counting in a dark room even when a pose is found', () => {
    const { runner } = (() => {
      const r = new ExerciseRunner(squat);
      for (const fr of repSequence(squatDown(), { reps: 2 }))
        r.update(extractFeatures(fr), 1, fr.t, { brightness: 0.08 });
      return { runner: r };
    })();
    expect(runner.reps).toHaveLength(0);
  });
});

describe('movement control (DTW)', () => {
  it('smooth synthetic reps get a high smoothness score', () => {
    const { runner } = run(repSequence(squatDown(), { reps: 2 }));
    for (const r of runner.reps) expect(r.smoothness).toBeGreaterThanOrEqual(80);
  });
});
