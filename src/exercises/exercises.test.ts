import { describe, expect, it } from 'vitest';
import { P } from '@/core/types';
import { blend, repSequence } from '@/core/reference/template';
import { concat, runExercise } from '../../tests/helpers/run';
import { jumpingJack } from './jumpingJack';
import { jackOpen } from './jumpingJack/reference';
import { lunge } from './lunge';
import { lungeDown } from './lunge/reference';
import { press } from './press';
import { pressStart, pressTop } from './press/reference';
import { sideBend } from './sideBend';
import { sideBend as bendPose } from './sideBend/reference';
import { EXERCISES } from './registry';

describe('jumping jack', () => {
  it('counts clean reps', () => {
    const { reps, hintIds } = run(jumpingJack, repSequence(jackOpen(), { reps: 3, msPerRep: 900 }));
    expect(reps.map((r) => r.counted)).toEqual([true, true, true]);
    expect([...hintIds]).toEqual([]);
  });

  it('rejects reps where hands stay below the head', () => {
    const low = jackOpen({
      [P.leftElbow]: [0.4, -0.45],
      [P.rightElbow]: [-0.4, -0.45],
      [P.leftWrist]: [0.55, -0.55],
      [P.rightWrist]: [-0.55, -0.55],
    });
    const { reps, hintIds } = run(jumpingJack, repSequence(low, { reps: 1, msPerRep: 900 }));
    expect(reps[0]!.counted).toBe(false);
    expect(hintIds).toContain('jumpingJack.armsLow');
  });

  it('rejects arms-only reps (legs did not move)', () => {
    const armsOnly: Record<number, [number, number, number?]> = {};
    for (const i of [P.leftElbow, P.rightElbow, P.leftWrist, P.rightWrist])
      armsOnly[i] = jackOpen()[i]!;
    const { reps } = run(jumpingJack, repSequence(armsOnly, { reps: 1, msPerRep: 900 }));
    expect(reps[0]!.counted).toBe(false);
    expect(reps[0]!.errors).toContain('jumpingJack.noLegs');
  });

  it('flags a narrow jump but still counts it', () => {
    const narrow = blend({}, jackOpen(), 1);
    for (const i of [P.leftAnkle, P.leftHeel, P.leftFootIndex])
      narrow[i] = [0.25, narrow[i]![1], narrow[i]![2]];
    for (const i of [P.rightAnkle, P.rightHeel, P.rightFootIndex])
      narrow[i] = [-0.25, narrow[i]![1], narrow[i]![2]];
    const { reps } = run(jumpingJack, repSequence(narrow, { reps: 1, msPerRep: 900 }));
    expect(reps[0]!.counted).toBe(true);
    expect(reps[0]!.errors).toContain('jumpingJack.narrow');
  });
});

describe('lunge', () => {
  it('counts alternating lunges and detects the front leg', () => {
    const frames = concat(repSequence(lungeDown('l')), repSequence(lungeDown('r')));
    const { reps, hintIds } = run(lunge, frames);
    expect(reps.map((r) => [r.counted, r.side])).toEqual([
      [true, 'l'],
      [true, 'r'],
    ]);
    expect([...hintIds]).toEqual([]);
  });

  it('rejects a shallow lunge', () => {
    const { reps, hintIds } = run(lunge, repSequence(blend({}, lungeDown('l'), 0.6)));
    expect(reps[0]!.counted).toBe(false);
    expect(hintIds).toContain('lunge.depth');
  });

  it('flags leaning torso', () => {
    const lean = lungeDown('l', {
      [P.leftShoulder]: [0.19, -0.2, -0.3],
      [P.rightShoulder]: [-0.19, -0.2, -0.3],
      [P.nose]: [0, -0.3, -0.4],
    });
    const { hintIds } = run(lunge, repSequence(lean, { msPerRep: 3000 }));
    expect(hintIds).toContain('lunge.torso');
  });
});

describe('press ("raise the shield")', () => {
  const seq = (top = pressTop()) =>
    repSequence(top, { reps: 2, msPerRep: 1500, start: pressStart() });

  it('counts full presses', () => {
    const { reps, hintIds } = run(press, seq());
    expect(reps.map((r) => r.counted)).toEqual([true, true]);
    expect([...hintIds]).toEqual([]);
  });

  it('rejects presses without lockout', () => {
    const bent = pressTop({
      [P.leftElbow]: [0.36, -0.75],
      [P.rightElbow]: [-0.36, -0.75],
      [P.leftWrist]: [0.22, -1.0],
      [P.rightWrist]: [-0.22, -1.0],
    });
    const { reps, hintIds } = run(press, seq(bent));
    expect(reps.every((r) => !r.counted)).toBe(true);
    expect(hintIds).toContain('press.lockout');
  });

  it('flags one arm lagging', () => {
    const lag = pressTop({ [P.rightElbow]: [-0.36, -0.42], [P.rightWrist]: [-0.32, -0.62] });
    const { hintIds } = run(press, repSequence(lag, { msPerRep: 2500, start: pressStart() }));
    expect(hintIds).toContain('press.asym');
  });
});

describe('side bend', () => {
  it('counts left and right bends', () => {
    const frames = concat(repSequence(bendPose('l')), repSequence(bendPose('r')));
    const { reps, hintIds } = run(sideBend, frames);
    expect(reps.map((r) => [r.counted, r.side])).toEqual([
      [true, 'l'],
      [true, 'r'],
    ]);
    expect([...hintIds]).toEqual([]);
  });

  it('rejects a tiny bend', () => {
    const { reps } = run(sideBend, repSequence(blend({}, bendPose('l'), 0.7)));
    expect(reps).toHaveLength(1);
    expect(reps[0]!.counted).toBe(false);
    expect(reps[0]!.errors).toContain('sideBend.depth');
  });
});

describe('registry', () => {
  it('every exercise has reference keyframes that produce clean counted reps', () => {
    for (const def of Object.values(EXERCISES)) {
      const { reps } = run(
        def,
        repSequence(def.keyframes.peak, { start: def.keyframes.rest, msPerRep: 2000 }),
      );
      expect(reps, def.id).toHaveLength(1);
      expect(reps[0]!.counted, def.id).toBe(true);
      expect(reps[0]!.quality, def.id).toBe(100);
    }
  });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const run = (def: any, frames: Parameters<typeof runExercise>[1]) => runExercise(def, frames);
