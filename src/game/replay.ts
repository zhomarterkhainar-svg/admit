import type { PoseFrame } from '@/core/types';
import type { ExerciseDefinition, RepSummary, Severity } from '@/engine/types';
import type { AnyExerciseId } from '@/exercises/registry';

/** The worst rep of a set, kept as skeleton frames for a slow-motion replay on the results. */
export interface Replay {
  exercise: AnyExerciseId;
  /** the most serious error of that rep (validity > safety > form > tempo) */
  ruleId: string | null;
  frames: PoseFrame[];
  /** the deepest point of the movement: the replay pauses there and shows the ghost */
  peakIndex: number;
  counted: boolean;
}

/** how long before the rep starts and after it ends the clip runs, ms */
export const REPLAY_PRE_MS = 300;
export const REPLAY_POST_MS = 200;
/** frames kept in the rolling buffer, ms */
const BUFFER_MS = 6000;
const ORDER: readonly Severity[] = ['validity', 'safety', 'form', 'tempo'];

/** The error of a rep that matters most, by the rule severities of the exercise. */
export function worstRule(errors: readonly string[], def: ExerciseDefinition<unknown>): string | null {
  const rules = [...def.frameRules, ...def.repRules];
  let best: string | null = null;
  let bestRank = Infinity;
  for (const id of errors) {
    const sev = rules.find((r) => r.id === id)?.severity;
    const rank = sev ? ORDER.indexOf(sev) : -1;
    if (rank >= 0 && rank < bestRank) {
      best = id;
      bestRank = rank;
    }
  }
  return best;
}

/** lower = worse: a rep that did not count is worse than any counted one, then by quality */
const badness = (r: RepSummary): [number, number] => [r.counted ? 1 : 0, r.quality];
const worse = (a: [number, number], b: [number, number]) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);

/**
 * Records the last few seconds of poses and cuts out every rep that went wrong
 * ([start − 300 ms, end + 200 ms]); keeps only the worst one. Clean reps are ignored.
 */
export class ReplayRecorder {
  private buffer: { frame: PoseFrame; progress: number }[] = [];
  private pending: { rep: RepSummary; until: number } | null = null;
  private best: { key: [number, number]; replay: Replay } | null = null;

  constructor(
    private readonly id: AnyExerciseId,
    private readonly def: ExerciseDefinition<unknown>,
  ) {}

  push(frame: PoseFrame, progress: number): void {
    this.buffer.push({ frame, progress });
    while (this.buffer.length && frame.t - this.buffer[0]!.frame.t > BUFFER_MS) this.buffer.shift();
    if (this.pending && frame.t >= this.pending.until) this.cut();
  }

  onRep(rep: RepSummary): void {
    if (rep.counted && rep.errors.length === 0) return;
    if (this.pending) this.cut();
    this.pending = { rep, until: rep.endT + REPLAY_POST_MS };
  }

  /** The worst rep's clip (the set is over: a rep still waiting for its tail is cut now). */
  finish(): Replay | null {
    if (this.pending) this.cut();
    return this.best?.replay ?? null;
  }

  private cut(): void {
    const { rep, until } = this.pending!;
    this.pending = null;
    const key = badness(rep);
    if (this.best && !worse(key, this.best.key)) return;
    const clip = this.buffer.filter(
      (b) => b.frame.t >= rep.startT - REPLAY_PRE_MS && b.frame.t <= until,
    );
    if (clip.length < 3) return;
    let peakIndex = 0;
    clip.forEach((b, i) => {
      if (b.progress > clip[peakIndex]!.progress) peakIndex = i;
    });
    this.best = {
      key,
      replay: {
        exercise: this.id,
        ruleId: worstRule(rep.errors, this.def),
        frames: clip.map((b) => b.frame),
        peakIndex,
        counted: rep.counted,
      },
    };
  }
}
