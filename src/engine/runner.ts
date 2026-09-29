import type { FrameFeatures } from '@/core/types';
import { FeedbackArbiter } from './arbiter';
import { BaselineEstimator, personalize, type Baseline } from './baseline';
import { smoothnessScore } from './dtw';
import { RuleTracker } from './ruleTracker';
import { DARK_THRESHOLD, NO_PERSON, TOO_DARK, floorSetupRules, setupRules } from './setupRules';
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
/** Shorter "reps" are sensor noise crossing a threshold, not movements. */
const MIN_REP_MS = 350;
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
  private readonly autoBaseline = new BaselineEstimator();
  /** depth trajectory: rolling pre-rep buffer + samples during the rep */
  private trail: { t: number; v: number }[] = [];
  private repTrail: { t: number; v: number }[] | null = null;
  /** time-based exercises: ms held toward the next second, and what went wrong during it */
  private held = 0;
  private heldLastT: number | null = null;
  private heldSince = 0;
  private heldErrors = new Set<string>();

  /**
   * @param baseline personal standing baseline (from calibration); if omitted it is
   *   estimated automatically from the first ~0.7 s of relaxed standing
   */
  constructor(
    readonly def: ExerciseDefinition<M>,
    private baseline: Baseline | null = null,
  ) {
    this.phase = def.initialPhase;
    this.setup = new RuleTracker(
      def.posture === 'floor' ? floorSetupRules() : setupRules(def.needs, def.view),
    );
    this.form = new RuleTracker(def.frameRules);
  }

  /**
   * @param t frame time (ms); defaults to f.t
   * @param env optional environment measurements (frame brightness)
   */
  update(
    f: FrameFeatures | null,
    people: number,
    t = f?.t ?? 0,
    env: { brightness?: number; extraHints?: Hint[] } = {},
  ): RunnerState {
    const events: RunnerEvent[] = [];
    if (!f) {
      const dark = env.brightness !== undefined && env.brightness < DARK_THRESHOLD;
      const out = this.arbiter.update([dark ? TOO_DARK : NO_PERSON], t);
      if (out.hint) events.push({ type: 'hint', hint: out.hint, speak: out.speak });
      return this.state(null, events, true, []);
    }
    // the standing baseline means nothing for someone lying on the floor
    if (this.def.posture !== 'floor') {
      if (!this.baseline && this.phase === this.def.initialPhase) {
        this.autoBaseline.add(f);
        this.baseline = this.autoBaseline.value;
      }
      f = personalize(f, this.baseline);
    }
    const depth = Math.min(1, Math.max(0, this.def.progress(f)));
    this.trail.push({ t: f.t, v: depth });
    while (this.trail.length && f.t - this.trail[0]!.t > 600) this.trail.shift();
    this.repTrail?.push({ t: f.t, v: depth });
    const ctx: RuleContext = {
      phase: this.phase,
      people,
      phaseMs: f.t - this.phaseSince,
      brightness: env.brightness,
    };

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
      if (this.def.hold) this.stepHold(f.t, this.def.hold.phase, formActive, events);
    } else {
      this.heldLastT = null;
    }

    const extra = paused ? [] : (env.extraHints ?? []);
    const out = this.arbiter.update([...setupActive, ...formActive, ...extra], f.t);
    if (out.hint) events.push({ type: 'hint', hint: out.hint, speak: out.speak });
    if (
      out.fixed &&
      (this.setup.fixed.includes(out.fixed) || this.form.fixed.includes(out.fixed))
    ) {
      events.push({ type: 'fixed', id: out.fixed });
    }
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
    if (this.def.hold) return; // time-based: no reps, see stepHold

    if (from === this.def.repStart) {
      this.repTrail = [...this.trail];
      this.metrics = this.def.initMetrics(f);
      this.repStartT = f.t;
      this.repErrors = new Set();
    } else if (proposed === this.def.repStart && this.metrics) {
      if (f.t - this.repStartT < (this.def.minRepMs ?? MIN_REP_MS)) {
        this.metrics = null; // noise, not a movement
      } else {
        events.push({ type: 'rep', rep: this.finishRep(f.t) });
      }
    }
  }

  /**
   * Plank-style exercises: every full second in the hold phase is one counted unit whose
   * quality drops for each form problem seen during that second. Leaving the phase stops the clock.
   */
  private stepHold(t: number, phase: string, active: FrameRule[], events: RunnerEvent[]): void {
    if (this.phase !== phase) {
      this.heldLastT = null;
      return;
    }
    if (this.heldLastT === null) {
      this.heldLastT = t;
      this.heldSince = t;
      return;
    }
    this.held += Math.min(t - this.heldLastT, 250); // a stalled camera must not add time
    this.heldLastT = t;
    active.forEach((r) => this.heldErrors.add(r.id));
    if (this.held < 1000) return;
    this.held -= 1000;
    let quality = 100;
    for (const id of this.heldErrors) {
      const rule = this.def.frameRules.find((r) => r.id === id);
      if (rule) quality -= QUALITY_PENALTY[rule.severity];
    }
    const rep: RepSummary = {
      index: this.reps.length,
      startT: this.heldSince,
      endT: t,
      counted: true,
      quality: Math.max(0, quality),
      errors: [...this.heldErrors],
    };
    this.reps.push(rep);
    this.heldErrors = new Set();
    this.heldSince = t;
    events.push({ type: 'rep', rep });
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
      smoothness: this.repTrail ? smoothnessScore(this.repTrail) : undefined,
    };
    this.repTrail = null;
    // the next rep's pre-roll must not contain the tail of this one
    this.trail = [];
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
