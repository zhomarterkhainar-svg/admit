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
}

/** Where the model files live: self-hosted first, the CDN as a fallback. */
export interface ModelSource {
  wasm: string;
  pose: string;
  hand: string;
}

export type WorkerRequest =
  | { type: 'init'; model: PoseModel; sources: ModelSource[]; numPoses: number }
  | { type: 'config'; numPoses: number }
  | { type: 'detect'; id: number; ts: number; frame: ImageBitmap; hand?: ImageBitmap };

export type WorkerResponse =
  | { type: 'ready'; delegate: 'GPU' | 'CPU' }
  | { type: 'error'; message: string }
  | { type: 'result'; id: number; result: VisionResult };
