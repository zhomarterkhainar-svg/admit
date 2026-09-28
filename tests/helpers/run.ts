import { extractFeatures } from '@/core/features/extract';
import type { PoseFrame } from '@/core/types';
import { ExerciseRunner, type RunnerEvent } from '@/engine/runner';
import type { ExerciseDefinition } from '@/engine/types';

/** Feeds frames through a fresh runner and collects everything a test may assert on. */
export function runExercise<M>(def: ExerciseDefinition<M>, frames: PoseFrame[], people = 1) {
  const runner = new ExerciseRunner(def);
  const events: RunnerEvent[] = [];
  let last = runner.update(null, people, 0);
  for (const fr of frames) {
    last = runner.update(extractFeatures(fr), people);
    events.push(...last.events);
  }
  const hintIds = new Set(events.flatMap((e) => (e.type === 'hint' ? [e.hint.id] : [])));
  hintIds.delete('setup.noPerson'); // emitted by the initial null frame
  const errors = new Set(runner.reps.flatMap((r) => r.errors));
  return { runner, last, events, hintIds, errors, reps: runner.reps };
}

/** Concatenates sequences, shifting timestamps so time keeps increasing. */
export function concat(...seqs: PoseFrame[][]): PoseFrame[] {
  const out: PoseFrame[] = [];
  let offset = 0;
  for (const seq of seqs) {
    const base = offset;
    for (const f of seq) out.push({ ...f, t: f.t + base });
    offset = (out.at(-1)?.t ?? 0) + 33;
  }
  return out;
}
