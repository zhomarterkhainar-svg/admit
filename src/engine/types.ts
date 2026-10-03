import type { FrameFeatures } from '@/core/types';
import type { PoseEdit } from '@/core/reference/template';
import type { I18nKey } from '@/i18n';

/** Priority order: lower index wins in the arbiter. */
export const SEVERITIES = ['setup', 'safety', 'validity', 'form', 'tempo'] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface Arrow {
  /** landmark the arrow starts from */
  joint: number;
  /** direction in the user's (mirrored, selfie) screen space; y grows down */
  dir: [number, number];
}

/** What the user sees/hears: "what is wrong" + "how to fix it". */
export interface Hint {
  id: string;
  severity: Severity;
  message: I18nKey;
  fix: I18nKey;
  joints: readonly number[];
  /** correction arrows, e.g. both knees outward */
  arrows?: readonly Arrow[];
}

export interface RuleContext {
  phase: string;
  /** number of people in frame */
  people: number;
  /** ms since the current phase started */
  phaseMs: number;
  /** mean frame luminance 0..1 when known */
  brightness?: number;
}

/** Checked on every frame; becomes active only after `persistMs` of continuous violation. */
export interface FrameRule extends Hint {
  kind: 'frame';
  /** phases in which the rule is evaluated; all phases if omitted */
  phases?: readonly string[];
  test(f: FrameFeatures, ctx: RuleContext): boolean;
  /** violation must hold this long to activate (default 200 ms) */
  persistMs?: number;
  /** must be clear this long to deactivate (default 300 ms) */
  clearMs?: number;
}

/** Checked once when a rep completes, on metrics accumulated during the rep. */
export interface RepRule<M> extends Hint {
  kind: 'rep';
  test(metrics: M): boolean;
  /** rep is not counted when this rule fires */
  invalidates?: boolean;
}

export type Side = 'l' | 'r';

/** A live angle readout drawn on the skeleton: an arc at `at` between `from` and `to` + degrees. */
export interface Gauge {
  at: number;
  from: number;
  to: number;
  deg: number;
  /** green when the angle is where it should be, orange when it is wrong, neutral otherwise */
  tone?: 'good' | 'warn';
}

export interface RepSummary {
  index: number;
  startT: number;
  endT: number;
  counted: boolean;
  /** 0..100 */
  quality: number;
  /** ids of rules that fired during/at end of this rep */
  errors: string[];
  side?: Side;
  /** movement control 0..100 (DTW of the depth trajectory vs a smooth reference) */
  smoothness?: number;
  /** deepest point of the rep on the exercise's 0..1 depth scale (1 = full depth) */
  depth?: number;
  /** range of motion: deepest minus shallowest point of the rep, same 0..1 scale */
  rom?: number;
  /** the exercise's key joint angle at the deepest point, degrees (see `peakAngle`) */
  angle?: number;
}

export interface ExerciseDefinition<M = Record<string, number>> {
  id: string;
  name: I18nKey;
  /** short how-to shown before the set */
  howTo: I18nKey;
  /** camera view the rules assume */
  view: 'front' | 'side';
  /**
   * 'floor': done lying on the floor, filmed from the side (push-ups, plank, bridge).
   * Such exercises get floor framing checks and no standing baseline correction.
   */
  posture?: 'stand' | 'floor';
  /**
   * Floor exercises: the camera angles the rules understand (default: side only). With 'front'
   * the player may also face the camera; otherwise a front view asks them to turn sideways.
   */
  floorViews?: ReadonlyArray<'side' | 'front'>;
  /** live angle readouts on the skeleton (e.g. the elbow angle in a push-up) */
  gauges?(f: FrameFeatures): Gauge[];
  /** time-based exercise (plank): every second spent in `phase` counts as one unit */
  hold?: { phase: string };
  /** label under the side meter (default: "depth") */
  meterLabel?: I18nKey;
  /** landmark groups that must be visible */
  needs: ReadonlyArray<keyof FrameFeatures['visibility']>;
  phases: readonly string[];
  initialPhase: string;
  /** proposes the next phase; implement hysteresis by looking at `current` */
  nextPhase(f: FrameFeatures, current: string): string;
  /** a rep starts on leaving `repStart` and completes on returning to it */
  repStart: string;
  /** 0..1 depth of the movement, drives the phase bar */
  progress(f: FrameFeatures): number;
  /** fresh accumulator at rep start */
  initMetrics(f: FrameFeatures): M;
  /** accumulate extremes during the rep */
  track(m: M, f: FrameFeatures, ctx: RuleContext): M;
  frameRules: ReadonlyArray<FrameRule>;
  repRules: ReadonlyArray<RepRule<M>>;
  /**
   * The key joint angle at the deepest point of a rep (knee at the bottom of a squat, elbow at
   * the bottom of a push-up …), for the movement profile; `angleLabel` says what it is.
   */
  peakAngle?(m: M): number;
  angleLabel?: I18nKey;
  /** optional: which side worked (lunges, side bends) */
  sideOf?(m: M): Side | undefined;
  /** reference keyframes (world space) for the ghost overlay, demos and tests */
  keyframes: { rest: PoseEdit; peak: PoseEdit; peakAlt?: PoseEdit };
  /** reps shorter than this are treated as noise (default 350 ms) */
  minRepMs?: number;
  /** which keyframe the ghost should show for the user's current pose (default: peak) */
  ghostFor?(f: FrameFeatures): PoseEdit;
}
