import { extractFeatures } from '@/core/features/extract';
import { blend, makePose, type PoseEdit } from '@/core/reference/template';
import type { PoseFrame } from '@/core/types';
import type { PoseListener, PoseSource, PoseTick } from '@/core/vision/poseLoop';
import { ALL_EXERCISES, type AnyExerciseId } from '@/exercises/registry';
import { fromHalf, type DuelSide } from '@/game/duel';
import { DEMO_MIX, DEMO_SCRIPTS, type DemoRep } from './scripts';

const HOLD_MS = 700;
const FPS = 30;
const FIT_TOP = 0.12;
const FIT_SCALE = 0.9;

/** Plays one looping choreography of reps: rest → peak → rest, then a short hold. */
class Performer {
  private script: DemoRep[] = [];
  private repIdx = 0;
  private repStart = 0;
  private rest: PoseEdit = {};

  play(script: DemoRep[], startAt: number): void {
    this.script = script;
    this.rest = script[0]?.rest ?? {};
    this.repIdx = 0;
    this.repStart = startAt;
  }

  pose(t: number): PoseEdit {
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
}

/** Template pose → a camera frame with the whole body inside the picture. */
function toFrame(edit: PoseEdit, t: number, floor: boolean, width = 1280): PoseFrame {
  const frame = makePose(edit, t, width, 720);
  for (const l of frame.image) {
    // the template puts the feet at ~1.03 of the frame height: fit the whole body (head
    // ~0.14 → feet ~0.87) so the virtual athlete stands fully inside the picture
    l.y = FIT_TOP + (l.y - 0.2) * FIT_SCALE;
    l.x = 0.5 + (l.x - 0.5) * FIT_SCALE;
    if (floor) l.y += 0.22;
    // a little sensor noise so it looks alive
    l.x += (Math.random() - 0.5) * 0.002;
    l.y += (Math.random() - 0.5) * 0.002;
  }
  return frame;
}

/**
 * A virtual athlete that emits synthetic pose ticks like the camera loop does.
 * Used for the no-camera demo mode and for end-to-end tests of the whole app.
 * Three ways to move: loop a rep choreography, follow a pose timeline (the dance mode, in time
 * with the music), or perform as TWO athletes side by side (the duel).
 */
export class DemoActor implements PoseSource {
  private readonly listeners = new Set<PoseListener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly main = new Performer();
  /** lying exercises are drawn near the bottom of the picture, where the floor is */
  private floor = false;
  private timeline: ((t: number) => PoseEdit) | null = null;
  private duo: Record<DuelSide, Performer> | null = null;

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
    this.timeline = null;
    this.duo = null;
    this.main.play(script, performance.now() + delayMs);
  }

  /** Follow a pose given as a function of time (performance.now() ms); null = stop. */
  followTimeline(poseAt: ((t: number) => PoseEdit) | null): void {
    this.floor = false;
    this.duo = null;
    this.timeline = poseAt;
  }

  /** Two athletes, one per half of the picture (screen-left `L`, screen-right `R`). */
  performDuo(scripts: Record<DuelSide, DemoRep[]> | null, delayMs = 600): void {
    this.timeline = null;
    this.floor = false;
    if (!scripts) {
      this.duo = null;
      return;
    }
    const at = performance.now() + delayMs;
    const L = new Performer();
    const R = new Performer();
    L.play(scripts.L, at);
    R.play(scripts.R, at + 250); // not in perfect sync, like real people
    this.duo = { L, R };
  }

  private step(): void {
    const t = performance.now();
    let frame: PoseFrame;
    let crowd: PoseFrame[] | undefined;
    if (this.duo) {
      crowd = (['L', 'R'] as const).map((side) =>
        fromHalf(toFrame(this.duo![side].pose(t), t, false, 640), side),
      );
      frame = crowd[0]!;
    } else {
      frame = toFrame(this.timeline ? this.timeline(t) : this.main.pose(t), t, this.floor);
    }
    const tick: PoseTick = {
      t,
      frame,
      features: extractFeatures(frame),
      people: crowd?.length ?? 1,
      crowd: crowd ?? [frame],
      fps: FPS,
      inferenceMs: 0,
    };
    this.listeners.forEach((fn) => fn(tick));
  }
}
