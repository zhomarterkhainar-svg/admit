import { ALL_EXERCISES, type AnyExerciseId } from '@/exercises/registry';

export interface ProgramStep {
  id: AnyExerciseId;
  /** counted reps (seconds for a hold like the plank) to finish the step */
  target: number;
  /** safety net: move on after this many seconds */
  timeLimitSec: number;
}

export interface Program {
  id: 'quick' | 'full' | 'single' | 'free' | 'floor';
  steps: ProgramStep[];
}

export const QUICK: Program = {
  id: 'quick',
  steps: [
    { id: 'squat', target: 3, timeLimitSec: 45 },
    { id: 'jumpingJack', target: 4, timeLimitSec: 40 },
    { id: 'lunge', target: 2, timeLimitSec: 45 },
    { id: 'press', target: 3, timeLimitSec: 40 },
    { id: 'sideBend', target: 2, timeLimitSec: 40 },
  ],
};

export const FULL: Program = {
  id: 'full',
  steps: [
    { id: 'squat', target: 10, timeLimitSec: 120 },
    { id: 'jumpingJack', target: 15, timeLimitSec: 90 },
    { id: 'lunge', target: 8, timeLimitSec: 120 },
    { id: 'press', target: 10, timeLimitSec: 90 },
    { id: 'sideBend', target: 8, timeLimitSec: 90 },
  ],
};

/** "On the floor": push-ups, a plank hold (seconds) and glute bridges, filmed from the side. */
export const FLOOR: Program = {
  id: 'floor',
  steps: [
    { id: 'pushup', target: 6, timeLimitSec: 120 },
    { id: 'plank', target: 20, timeLimitSec: 90 },
    { id: 'bridge', target: 8, timeLimitSec: 120 },
  ],
};

export const single = (id: AnyExerciseId, target = ALL_EXERCISES[id].hold ? 30 : 8): Program => ({
  id: 'single',
  steps: [{ id, target, timeLimitSec: 180 }],
});
