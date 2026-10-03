import type { Landmark } from '../types';

export type PoseModel = 'lite' | 'full';

/** A rectangle in source video pixels. */
export interface Roi {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The hand under the cursor, seen close up by the hand model (a crop around the pose wrist). */
export interface HandState {
  /**
   * How far the fingertips reach compared with the knuckles (3D, 4 fingers averaged):
   * ≈ 1.9–2.2 open palm, ≈ 0.9–1.3 fist. See `handOpenness`.
   */
  openness: number;
  /** hand model confidence 0..1 */
  score: number;
  /**
   * The 21 hand landmarks (wrist, then 4 per finger), 2D. From the worker they are normalized to
   * the hand crop; the pose loop converts them to normalized video coordinates.
   */
  points?: { x: number; y: number }[];
}

/** One person as the pose model saw them (landmarks only; the frame metadata is added later). */
export interface RawPerson {
  image: Landmark[];
  world: Landmark[];
}

export interface VisionResult {
  people: RawPerson[];
  /** undefined: the hand was not requested; null: requested but not found */
  hand?: HandState | null;
  /** inference time, ms */
  ms: number;
  /**
   * The frame shrunk to THUMB_W×THUMB_H RGBA (when asked for): brightness and clothing colours
   * are read from it, so the main thread never has to copy video pixels back from the GPU.
   */
  thumb?: Uint8ClampedArray;
}

export const THUMB_W = 96;
export const THUMB_H = 54;

/** Where the model files live: self-hosted first, the CDN as a fallback. */
export interface ModelSource {
  wasm: string;
  pose: string;
  hand: string;
}

/**
 * Two workers run in parallel: one for the pose model (every camera frame), one for the hand model
 * (the cursor hand's crop). In one worker they had to take turns, and the pose rate dropped
 * several times over whenever the cursor was on screen.
 */
export type WorkerTask = 'pose' | 'hand';

export type WorkerRequest =
  | {
      type: 'init';
      task: WorkerTask;
      model: PoseModel;
      sources: ModelSource[];
      numPoses: number;
    }
  | { type: 'config'; numPoses: number }
  | {
      type: 'detect';
      id: number;
      ts: number;
      frame?: ImageBitmap;
      hand?: ImageBitmap;
      /** also return the frame as a tiny thumbnail */
      thumb?: boolean;
    };

export type WorkerResponse =
  | { type: 'ready'; delegate: 'GPU' | 'CPU' }
  | { type: 'error'; message: string }
  | { type: 'result'; id: number; result: VisionResult };
