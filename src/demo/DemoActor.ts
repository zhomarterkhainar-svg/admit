import { extractFeatures } from '@/core/features/extract';
import { blend, makePose, type PoseEdit } from '@/core/reference/template';
import type { PoseListener, PoseSource, PoseTick } from '@/core/vision/poseLoop';
import type { ExerciseId } from '@/exercises/registry';
import { DEMO_SCRIPTS, type DemoRep } from './scripts';

const HOLD_MS = 700;
const FPS = 30;

/**
 * A virtual athlete that emits synthetic pose ticks like the camera loop does.
 * Used for the no-camera demo mode and for end-to-end tests of the whole app.
 */
export class DemoActor implements PoseSource {
  private readonly listeners = new Set<PoseListener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private script: DemoRep[] = [];
  private repIdx = 0;
  private repStart = 0;
  private rest: PoseEdit = {};

  subscribe(fn: PoseListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  start(): void {
    this.timer ??= setInterval(() => this.step(), 1000 / FPS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Start performing an exercise's demo choreography (null = stand still). */
  perform(id: ExerciseId | null): void {
    this.script = id ? DEMO_SCRIPTS[id] : [];
    this.rest = this.script[0]?.rest ?? {};
    this.repIdx = 0;
    this.repStart = performance.now() + 800;
  }

  private pose(t: number): PoseEdit {
    const cur = this.script[this.repIdx % Math.max(1, this.script.length)];
    if (!cur || t < this.repStart) return this.rest;
    const τ = t - this.repStart;
    if (τ >= cur.ms + HOLD_MS) {
      this.repIdx++;
      this.repStart = t;
      return cur.rest;
    }
    if (τ >= cur.ms) return cur.rest;
    return blend(cur.rest, cur.peak, Math.sin((Math.PI * τ) / cur.ms));
  }

  private step(): void {
    const t = performance.now();
    const frame = makePose(this.pose(t), t);
    // a little sensor noise so it looks alive
    for (const l of frame.image) {
      l.x += (Math.random() - 0.5) * 0.002;
      l.y += (Math.random() - 0.5) * 0.002;
    }
    const tick: PoseTick = {
      t,
      frame,
      features: extractFeatures(frame),
      people: 1,
      fps: FPS,
      inferenceMs: 0,
    };
    this.listeners.forEach((fn) => fn(tick));
  }
}
