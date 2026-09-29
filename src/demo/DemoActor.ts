import { extractFeatures } from '@/core/features/extract';
import { blend, makePose, type PoseEdit } from '@/core/reference/template';
import type { PoseListener, PoseSource, PoseTick } from '@/core/vision/poseLoop';
import { ALL_EXERCISES, type AnyExerciseId } from '@/exercises/registry';
import { DEMO_MIX, DEMO_SCRIPTS, type DemoRep } from './scripts';

const HOLD_MS = 700;
const FPS = 30;
const FIT_TOP = 0.12;
const FIT_SCALE = 0.9;

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
  /** lying exercises are drawn near the bottom of the picture, where the floor is */
  private floor = false;

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

  /** Start performing an exercise's demo choreography ('mix' = all exercises, null = stand still). */
  perform(id: AnyExerciseId | 'mix' | null): void {
    this.performScript(id === 'mix' ? DEMO_MIX : id ? DEMO_SCRIPTS[id] : []);
    this.floor = id !== null && id !== 'mix' && ALL_EXERCISES[id].posture === 'floor';
  }

  /** Loop a custom choreography, starting after a short "reaction" delay. */
  performScript(script: DemoRep[], delayMs = 800): void {
    this.floor = false;
    this.script = script;
    this.rest = this.script[0]?.rest ?? {};
    this.repIdx = 0;
    this.repStart = performance.now() + delayMs;
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
    for (const l of frame.image) {
      // the template puts the feet at ~1.03 of the frame height: fit the whole body (head
      // ~0.14 → feet ~0.87) so the virtual athlete stands fully inside the picture
      l.y = FIT_TOP + (l.y - 0.2) * FIT_SCALE;
      l.x = 0.5 + (l.x - 0.5) * FIT_SCALE;
      if (this.floor) l.y += 0.22;
      // a little sensor noise so it looks alive
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
