import type { ExerciseDefinition } from '@/engine/types';
import { jumpingJack } from './jumpingJack';
import { lunge } from './lunge';
import { press } from './press';
import { sideBend } from './sideBend';
import { squat } from './squat';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyExercise = ExerciseDefinition<any>;

export const EXERCISES = { squat, jumpingJack, lunge, press, sideBend } satisfies Record<
  string,
  AnyExercise
>;

export type ExerciseId = keyof typeof EXERCISES;

export const EXERCISE_IDS = Object.keys(EXERCISES) as ExerciseId[];
