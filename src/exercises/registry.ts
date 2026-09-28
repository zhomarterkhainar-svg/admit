import type { ExerciseDefinition } from '@/engine/types';
import { squat } from './squat';

// TODO(Dev B): jumpingJack, lunge, press, sideBend, plank — see PLAN.md §2.1 / §4.2
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const EXERCISES: Record<string, ExerciseDefinition<any>> = {
  squat,
};
