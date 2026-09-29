import type { MoveId } from './moves';
import type { Note } from './chart';

/** A note is judged on poses from 400 ms before its beat to 450 ms after. */
export const WINDOW = { before: 400, after: 450 } as const;
/** closest matching pose within this of the beat: "Keremet!" (perfect) */
export const PERFECT_MS = 130;
/** within this: "Zhaqsy" (good); farther or never: a miss */
export const GOOD_MS = 300;
export const POINTS = { perfect: 100, good: 50 } as const;

export type Hit = 'perfect' | 'good' | 'miss';
export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

export interface JudgeEvent {
  note: Note;
  hit: Hit;
  /** |pose time − beat| of the best matching pose, ms (undefined for a miss without any) */
  offset?: number;
  points: number;
  /** combo after this note */
  combo: number;
}

export const multiplier = (combo: number) => Math.min(4, 1 + Math.floor(combo / 8));

export function gradeFor(accuracy: number): Grade {
  if (accuracy >= 0.95) return 'S';
  if (accuracy >= 0.85) return 'A';
  if (accuracy >= 0.7) return 'B';
  if (accuracy >= 0.5) return 'C';
  return 'D';
}

/**
 * The rhythm judge. Feed it pose samples in song time (already shifted back by the camera
 * latency) with a matcher for "is the dancer in move X now"; it tracks, per note, the matching
 * pose closest to the beat. A perfect is awarded the moment one lands within 130 ms; good or
 * miss when the note's window closes. Holding the pose through the beat is a perfect.
 */
export class DanceJudge {
  score = 0;
  combo = 0;
  bestCombo = 0;
  readonly counts: Record<Hit, number> = { perfect: 0, good: 0, miss: 0 };
  private next = 0;
  private readonly best = new Map<number, number>();
  private readonly done = new Set<number>();

  constructor(readonly notes: readonly Note[]) {}

  /** @param ms song time of the pose; @param matches is the pose this move? */
  update(ms: number, matches: (move: MoveId) => boolean): JudgeEvent[] {
    const out: JudgeEvent[] = [];
    for (let k = this.next; k < this.notes.length; k++) {
      const n = this.notes[k]!;
      if (n.t - WINDOW.before > ms) break;
      if (this.done.has(k) || ms > n.t + WINDOW.after || !matches(n.move)) continue;
      const off = Math.abs(ms - n.t);
      this.best.set(k, Math.min(this.best.get(k) ?? Infinity, off));
      if (off <= PERFECT_MS) out.push(this.resolve(k, 'perfect', off));
    }
    // windows that have closed
    while (this.next < this.notes.length && ms > this.notes[this.next]!.t + WINDOW.after) {
      const k = this.next++;
      if (this.done.has(k)) continue;
      const b = this.best.get(k);
      out.push(this.resolve(k, b !== undefined && b <= GOOD_MS ? 'good' : 'miss', b));
    }
    return out;
  }

  /** Close every window up to `ms` without a pose (the dancer is out of view). */
  advance(ms: number): JudgeEvent[] {
    return this.update(ms, () => false);
  }

  get judged(): number {
    return this.counts.perfect + this.counts.good + this.counts.miss;
  }

  /** (perfect + ½ good) / notes judged so far */
  get accuracy(): number {
    return this.judged ? (this.counts.perfect + 0.5 * this.counts.good) / this.judged : 0;
  }

  /** the final grade over the whole chart */
  get grade(): Grade {
    const n = this.notes.length || 1;
    return gradeFor((this.counts.perfect + 0.5 * this.counts.good) / n);
  }

  get over(): boolean {
    return this.next >= this.notes.length;
  }

  private resolve(k: number, hit: Hit, offset?: number): JudgeEvent {
    this.done.add(k);
    this.counts[hit]++;
    let points = 0;
    if (hit === 'miss') this.combo = 0;
    else {
      points = POINTS[hit] * multiplier(this.combo);
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
    }
    this.score += points;
    return { note: this.notes[k]!, hit, offset, points, combo: this.combo };
  }
}
