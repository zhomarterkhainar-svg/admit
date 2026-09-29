import type { ExerciseDefinition } from '@/engine/types';
import { bridge } from './bridge';
import { jumpingJack } from './jumpingJack';
import { lunge } from './lunge';
import { plank } from './plank';
import { press } from './press';
import { pushup } from './pushup';
import { sideBend } from './sideBend';
import { squat } from './squat';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyExercise = ExerciseDefinition<any>;

/** Standing exercises, filmed from the front: programs, free workout (kNN), challenge. */
const defs = { squat, jumpingJack, lunge, press, sideBend };
/** Floor exercises, filmed from the side: the "On the floor" mode. */
const floorDefs = { pushup, plank, bridge };

export type ExerciseId = keyof typeof defs;
export type FloorExerciseId = keyof typeof floorDefs;
export type AnyExerciseId = ExerciseId | FloorExerciseId;

/** Metric types erased so screens can treat all exercises uniformly. */
export const EXERCISES: Record<ExerciseId, AnyExercise> = defs;
export const EXERCISE_IDS = Object.keys(EXERCISES) as ExerciseId[];

export const FLOOR_EXERCISES: Record<FloorExerciseId, AnyExercise> = floorDefs;
export const FLOOR_EXERCISE_IDS = Object.keys(FLOOR_EXERCISES) as FloorExerciseId[];

/** Every exercise, standing and floor (lookup by a program step / result id). */
export const ALL_EXERCISES: Record<AnyExerciseId, AnyExercise> = { ...defs, ...floorDefs };
