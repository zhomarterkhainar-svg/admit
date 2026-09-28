import type { FrameFeatures } from '@/core/types';
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
  arrow?: Arrow;
}

export interface RuleContext {
  phase: string;
  /** number of people in frame */
  people: number;
  /** ms since the current phase started */
  phaseMs: number;
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
}

export interface ExerciseDefinition<M = Record<string, number>> {
  id: string;
  name: I18nKey;
  /** short how-to shown before the set */
  howTo: I18nKey;
  /** camera view the rules assume */
  view: 'front' | 'side';
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
  /** optional: which side worked (lunges, side bends) */
  sideOf?(m: M): Side | undefined;
}
