import { P } from '@/core/types';
import type { FrameRule } from './types';

/**
 * Framing / environment checks shared by all exercises. Highest priority in the arbiter:
 * while any is active the rep counter is paused.
 */
export function setupRules(
  needs: ReadonlyArray<'upper' | 'lower' | 'feet'>,
  view: 'front' | 'side',
): FrameRule[] {
  const rules: FrameRule[] = [
    {
      kind: 'frame',
      id: 'setup.multiplePeople',
      severity: 'setup',
      message: 'setup.multiplePeople.msg',
      fix: 'setup.multiplePeople.fix',
      joints: [],
      persistMs: 800,
      test: (_f, ctx) => ctx.people > 1,
    },
    {
      kind: 'frame',
      id: 'setup.tooClose',
      severity: 'setup',
      message: 'setup.tooClose.msg',
      fix: 'setup.tooClose.fix',
      joints: [],
      persistMs: 400,
      test: (f) => f.bodyHeightFrac > 1.05 || (needs.includes('feet') && f.visibility.feet < 0.5),
    },
    {
      kind: 'frame',
      id: 'setup.tooFar',
      severity: 'setup',
      message: 'setup.tooFar.msg',
      fix: 'setup.tooFar.fix',
      joints: [],
      persistMs: 600,
      test: (f) => f.bodyHeightFrac < 0.4 && f.visibility.feet > 0.5,
    },
    {
      kind: 'frame',
      id: 'setup.offCenter',
      severity: 'setup',
      message: 'setup.offCenter.msg',
      fix: 'setup.offCenter.fix',
      joints: [P.leftHip, P.rightHip],
      persistMs: 600,
      test: (f) => f.center.x < 0.2 || f.center.x > 0.8,
    },
  ];
  if (needs.includes('upper')) {
    rules.push({
      kind: 'frame',
      id: 'setup.armsHidden',
      severity: 'setup',
      message: 'setup.armsHidden.msg',
      fix: 'setup.armsHidden.fix',
      joints: [P.leftWrist, P.rightWrist],
      persistMs: 500,
      test: (f) => f.visibility.upper < 0.4,
    });
  }
  if (view === 'front') {
    rules.push({
      kind: 'frame',
      id: 'setup.notFacing',
      severity: 'setup',
      message: 'setup.notFacing.msg',
      fix: 'setup.notFacing.fix',
      joints: [P.leftShoulder, P.rightShoulder],
      persistMs: 800,
      test: (f) => f.frontality < 0.45,
    });
  }
  return rules;
}
