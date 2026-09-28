import type { FrameFeatures } from '@/core/types';
import type { Baseline } from '@/engine/baseline';
import { ExerciseRunner, type RunnerState } from '@/engine/runner';
import type { Hint, RepSummary } from '@/engine/types';
import { EXERCISES, EXERCISE_IDS, type ExerciseId } from '@/exercises/registry';
import { ExerciseRecognizer } from '@/ml/recognizer';

export type FreeEvent =
  | { type: 'rep'; id: ExerciseId; rep: RepSummary }
  | { type: 'switch'; id: ExerciseId }
  | { type: 'hint'; hint: Hint; speak: boolean }
  | { type: 'fixed'; id: string };

export interface FreeState {
  /** exercise the AI currently believes the user is doing */
  active: ExerciseId | null;
  /** HUD state of the active exercise's runner */
  runner: RunnerState | null;
  counts: Record<ExerciseId, number>;
  events: FreeEvent[];
}

const SWITCH_SHARE = 0.7;
const ACCEPT_SHARE = 0.55;

/**
 * "Free workout": the user does any exercise in any order; the kNN recognizer decides which.
 * All exercise runners track the body in parallel, so even the very first rep of a new exercise
 * is caught; a rep is credited only to the exercise the recognizer saw during that rep
 * (a jumping jack also lifts the wrists overhead, but it must not count as a press).
 */
export class FreeWorkoutSession {
  readonly runners: Record<ExerciseId, ExerciseRunner<unknown>>;
  readonly accepted: Record<ExerciseId, RepSummary[]>;
  private readonly recognizer = new ExerciseRecognizer();
  active: ExerciseId | null = null;

  constructor(baseline: Baseline | null = null) {
    this.runners = Object.fromEntries(
      EXERCISE_IDS.map((id) => [id, new ExerciseRunner(EXERCISES[id], baseline)]),
    ) as Record<ExerciseId, ExerciseRunner<unknown>>;
    this.accepted = Object.fromEntries(EXERCISE_IDS.map((id) => [id, []])) as unknown as Record<
      ExerciseId,
      RepSummary[]
    >;
  }

  update(
    f: FrameFeatures | null,
    people: number,
    t: number,
    env: { brightness?: number } = {},
  ): FreeState {
    const events: FreeEvent[] = [];
    const rec = this.recognizer.update(f);
    const recognized = rec.label as ExerciseId | null;

    if (recognized && rec.share >= SWITCH_SHARE && recognized !== this.active) {
      this.active = recognized;
      events.push({ type: 'switch', id: recognized });
    }

    let activeState: RunnerState | null = null;
    for (const id of EXERCISE_IDS) {
      const st = this.runners[id].update(f, people, t, env);
      if (id === (this.active ?? 'sideBend')) activeState = st; // sideBend: generic framing checks before any exercise
      for (const e of st.events) {
        if (e.type !== 'rep') continue;
        if (recognized === id && rec.share >= ACCEPT_SHARE) {
          this.accepted[id].push(e.rep);
          events.push({ type: 'rep', id, rep: e.rep });
          if (this.active !== id) {
            this.active = id;
            events.push({ type: 'switch', id });
          }
        }
      }
    }
    for (const e of activeState?.events ?? []) {
      // before recognition only framing advice makes sense (not another exercise's technique)
      if (e.type === 'hint' && (this.active || e.hint.severity === 'setup')) events.push(e);
      else if (e.type === 'fixed' && this.active) events.push(e);
    }
    // before the first exercise is recognized, only framing hints make sense
    if (!this.active && activeState?.hint && activeState.hint.severity !== 'setup') {
      activeState = { ...activeState, hint: null, errorJoints: new Set() };
    }
    return { active: this.active, runner: activeState, counts: this.counts(), events };
  }

  counts(): Record<ExerciseId, number> {
    return Object.fromEntries(
      EXERCISE_IDS.map((id) => [id, this.accepted[id].filter((r) => r.counted).length]),
    ) as Record<ExerciseId, number>;
  }
}
