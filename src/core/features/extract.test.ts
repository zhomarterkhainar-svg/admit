import { describe, expect, it } from 'vitest';
import { P } from '../types';
import { extractFeatures } from './extract';
import { makePose, squatDown } from '../../../tests/helpers/pose';

describe('extractFeatures', () => {
  it('standing pose: straight legs, upright torso, fully visible', () => {
    const f = extractFeatures(makePose());
    expect(f.kneeAngle.l).toBeGreaterThan(170);
    expect(f.kneeAngle.r).toBeGreaterThan(170);
    expect(f.torsoLean).toBeLessThan(5);
    expect(Math.abs(f.torsoSideLean)).toBeLessThan(3);
    expect(f.wristAboveHead.l).toBe(false);
    expect(f.bodyHeightFrac).toBeGreaterThan(0.6);
    expect(f.visibility.feet).toBeGreaterThan(0.9);
  });

  it('squat bottom: knees bent and torso leans forward', () => {
    const f = extractFeatures(makePose(squatDown()));
    expect(f.kneeAngle.l).toBeLessThan(100);
    expect(f.torsoLean).toBeGreaterThan(20);
  });

  it('arms overhead: wrists above head', () => {
    const f = extractFeatures(
      makePose({
        [P.leftWrist]: [0.25, -1.0],
        [P.rightWrist]: [-0.25, -1.0],
        [P.leftElbow]: [0.24, -0.75],
        [P.rightElbow]: [-0.24, -0.75],
      }),
    );
    expect(f.wristAboveHead.l && f.wristAboveHead.r).toBe(true);
    expect(f.shoulderAngle.l).toBeGreaterThan(150);
  });

  it('side lean to user left gives negative torsoSideLean', () => {
    const f = extractFeatures(
      makePose({ [P.leftShoulder]: [0.4, -0.42], [P.rightShoulder]: [0.02, -0.55] }),
    );
    expect(f.torsoSideLean).toBeLessThan(-10);
  });

  it('knees caving in lowers kneeAnkleRatio', () => {
    const f = extractFeatures(
      makePose(
        squatDown({ [P.leftKnee]: [0.05, 0.45, -0.22], [P.rightKnee]: [-0.05, 0.45, -0.22] }),
      ),
    );
    expect(f.kneeAnkleRatio).toBeLessThan(0.8);
  });
});

describe('extractFeatures: extended', () => {
  it('standing: knees well below hips, not inward, no pitch', () => {
    const f = extractFeatures(makePose());
    expect(f.kneeDrop.l).toBeGreaterThan(0.7);
    expect(Math.abs(f.kneeInward.l)).toBeLessThan(0.15);
    expect(Math.abs(f.torsoPitch)).toBeLessThan(5);
  });
  it('squat bottom: torso pitches toward camera', () => {
    expect(extractFeatures(makePose(squatDown())).torsoPitch).toBeGreaterThan(20);
  });
});
