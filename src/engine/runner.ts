import type { FrameFeatures } from '@/core/types';
import { FeedbackArbiter } from './arbiter';
import { RuleTracker } from './ruleTracker';
import { NO_PERSON, setupRules } from './setupRules';
import type { ExerciseDefinition, FrameRule, Hint, RepSummary, RuleContext } from './types';

export type RunnerEvent =
  | { type: 'rep'; rep: RepSummary }
  | { type: 'hint'; hint: Hint; speak: boolean }
  | { type: 'fixed'; id: string };

export interface RunnerState {
  phase: string;
  /** 0..1 movement depth for the phase bar */
  progress: number;
  counted: number;
  attempted: number;
  hint: Hint | null;
  /** joints to paint red */
  errorJoints: ReadonlySet<number>;
  /** true while a setup problem pauses counting */
  paused: boolean;
  events: RunnerEvent[];
}

const PHASE_DEBOUNCE_MS = 80;
const QUALITY_PENALTY = { setup: 0, safety: 35, validity: 50, form: 20, tempo: 10 } as const;

/**
 * Runs one exercise: phase FSM → rep counting → frame/rep rules → arbiter.
 * Pure logic, no DOM: fully unit-testable with synthetic or recorded frames.
 */
export class ExerciseRunner<M> {
  private phase: string;
  private phaseSince = 0;
  private pending: { phase: string; since: number } | null = null;
  private metrics: M | null = null;
  private repStartT = 0;
  private repErrors = new Set<string>();
  private readonly setup: RuleTracker;
  private readonly form: RuleTracker;
  private readonly arbiter = new FeedbackArbiter();
  readonly reps: RepSummary[] = [];

  constructor(readonly def: ExerciseDefinition<M>) {
    this.phase = def.initialPhase;
    this.setup = new RuleTracker(setupRules(def.needs, def.view));
    this.form = new RuleTracker(def.frameRules);
  }

  /** @param t frame time (ms); defaults to f.t */
  update(f: FrameFeatures | null, people: number, t = f?.t ?? 0): RunnerState {
    const events: RunnerEvent[] = [];
    if (!f) {
      const out = this.arbiter.update([NO_PERSON], t);
      if (out.hint) events.push({ type: 'hint', hint: out.hint, speak: out.speak });
      return this.state(null, events, true, []);
    }
    const ctx: RuleContext = { phase: this.phase, people, phaseMs: f.t - this.phaseSince };

    const setupActive = this.setup.update(f, ctx);
    const paused = setupActive.length > 0;

    let formActive: FrameRule[] = [];
    if (!paused) {
      this.stepPhase(f, events);
      ctx.phase = this.phase;
      ctx.phaseMs = f.t - this.phaseSince;
      if (this.metrics) this.metrics = this.def.track(this.metrics, f, ctx);
      formActive = this.form.update(f, ctx);
      if (this.metrics) formActive.forEach((r) => this.repErrors.add(r.id));
    }

    const out = this.arbiter.update([...setupActive, ...formActive], f.t);
    if (out.hint) events.push({ type: 'hint', hint: out.hint, speak: out.speak });
    if (out.fixed) events.push({ type: 'fixed', id: out.fixed });
    return this.state(f, events, paused, [...setupActive, ...formActive]);
  }

  private stepPhase(f: FrameFeatures, events: RunnerEvent[]): void {
    const proposed = this.def.nextPhase(f, this.phase);
    if (proposed === this.phase) {
      this.pending = null;
      return;
    }
    if (!this.pending || this.pending.phase !== proposed) {
      this.pending = { phase: proposed, since: f.t };
      return;
    }
    if (f.t - this.pending.since < PHASE_DEBOUNCE_MS) return;

    const from = this.phase;
    this.phase = proposed;
    this.phaseSince = f.t;
    this.pending = null;

    if (from === this.def.repStart) {
      this.metrics = this.def.initMetrics(f);
      this.repStartT = f.t;
      this.repErrors = new Set();
    } else if (proposed === this.def.repStart && this.metrics) {
      events.push({ type: 'rep', rep: this.finishRep(f.t) });
    }
  }

  private finishRep(t: number): RepSummary {
    const m = this.metrics!;
    let counted = true;
    let quality = 100;
    for (const rule of this.def.repRules) {
      if (!rule.test(m)) continue;
      this.repErrors.add(rule.id);
      if (rule.invalidates) counted = false;
      this.arbiter.flash(rule, t);
    }
    for (const id of this.repErrors) {
      const rule = [...this.def.frameRules, ...this.def.repRules].find((r) => r.id === id);
      if (rule) quality -= QUALITY_PENALTY[rule.severity];
    }
    const rep: RepSummary = {
      index: this.reps.length,
      startT: this.repStartT,
      endT: t,
      counted,
      quality: counted ? Math.max(0, quality) : 0,
      errors: [...this.repErrors],
      side: this.def.sideOf?.(m),
    };
    this.reps.push(rep);
    this.metrics = null;
    return rep;
  }

  private state(
    f: FrameFeatures | null,
    events: RunnerEvent[],
    paused: boolean,
    active: Hint[],
  ): RunnerState {
    const counted = this.reps.filter((r) => r.counted).length;
    return {
      phase: this.phase,
      progress: f ? Math.min(1, Math.max(0, this.def.progress(f))) : 0,
      counted,
      attempted: this.reps.length,
      hint: events.find((e) => e.type === 'hint')?.hint ?? null,
      errorJoints: new Set(active.flatMap((h) => h.joints)),
      paused,
      events,
    };
  }
}
