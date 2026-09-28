import type { ExerciseDefinition } from '@/engine/types';
import { jumpingJack } from './jumpingJack';
import { lunge } from './lunge';
import { press } from './press';
import { sideBend } from './sideBend';
import { squat } from './squat';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyExercise = ExerciseDefinition<any>;

const defs = { squat, jumpingJack, lunge, press, sideBend };

export type ExerciseId = keyof typeof defs;

/** Metric types erased so screens can treat all exercises uniformly. */
export const EXERCISES: Record<ExerciseId, AnyExercise> = defs;

export const EXERCISE_IDS = Object.keys(EXERCISES) as ExerciseId[];
