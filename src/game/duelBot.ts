import { blend, type PoseEdit } from '@/core/reference/template';
import type { PoseFrame } from '@/core/types';
import { demoFrame } from '@/demo/DemoActor';
import { DUEL_MOVES, type DemoRep, type MoveSet } from '@/demo/scripts';
import type { ExerciseId } from '@/exercises/registry';

export type BotLevel = 'easy' | 'medium' | 'hard';
export const BOT_LEVELS: readonly BotLevel[] = ['easy', 'medium', 'hard'];

export interface BotLevelSpec {
  /** a clean rep takes this × the reference time */
  tempo: number;
  /** stands still between reps for this × the rep time */
  rest: number;
  /** share of reps done with a typical mistake (not counted or not clean) */
  slip: number;
  /** ms from "go!" to the first rep */
  react: number;
}

export const BOT_LEVEL: Record<BotLevel, BotLevelSpec> = {
  easy: { tempo: 1.5, rest: 0.7, slip: 0.4, react: 1400 },
  medium: { tempo: 1.1, rest: 0.4, slip: 0.2, react: 900 },
  hard: { tempo: 0.9, rest: 0.2, slip: 0.05, react: 500 },
};

const MOVES: Partial<Record<ExerciseId, MoveSet>> = DUEL_MOVES;

/**
 * The AI rival for playing the duel alone: a virtual athlete that does the round's exercise at its
 * level's pace and now and then makes a typical mistake. It only moves — its reps are judged by
 * the same ExerciseRunner as the player's, so it scores by exactly the same rules.
 * Time is the game clock, so the rival freezes with the pause.
 */
export class DuelBot {
  private moves: MoveSet | null = null;
  private rep: DemoRep | null = null;
  private repAt = 0;
  private repMs = 0;
  private restMs = 0;

  constructor(
    readonly level: BotLevel,
    private readonly random: () => number = Math.random,
  ) {}

  get spec(): BotLevelSpec {
    return BOT_LEVEL[this.level];
  }

  /** Start doing `exercise` at game time t (after the level's reaction time); null = stand still. */
  start(exercise: ExerciseId | null, t: number): void {
    this.moves = exercise ? (MOVES[exercise] ?? null) : null;
    this.rep = null;
    this.repAt = t + this.spec.react;
  }

  private next(): DemoRep {
    const m = this.moves!;
    const slip = m.faults.length > 0 && this.random() < this.spec.slip;
    const rep = slip ? m.faults[Math.floor(this.random() * m.faults.length)]! : m.clean;
    // mistakes keep their own timing (one of them is "too fast"); clean reps follow the level
    const jitter = 0.9 + 0.2 * this.random();
    this.repMs = (slip ? rep.ms : rep.ms * this.spec.tempo) * jitter;
    this.restMs = Math.max(150, this.repMs * this.spec.rest);
    return rep;
  }

  pose(t: number): PoseEdit {
    if (!this.moves) return {};
    for (let guard = 0; guard < 100; guard++) {
      this.rep ??= this.next();
      const τ = t - this.repAt;
      if (τ < 0 || τ >= this.repMs) {
        if (τ < this.repMs + this.restMs) return this.rep.rest;
        this.repAt += this.repMs + this.restMs;
        this.rep = null;
        continue;
      }
      return blend(this.rep.rest, this.rep.peak, Math.sin((Math.PI * τ) / this.repMs));
    }
    return this.rep?.rest ?? {};
  }

  /** The rival as a camera of its own (the size of one duel half), ready for the runner. */
  frame(t: number): PoseFrame {
    return demoFrame(this.pose(t), t, false, 640);
  }
}
