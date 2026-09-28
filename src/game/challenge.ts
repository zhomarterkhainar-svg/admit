import type { ExerciseId } from '@/exercises/registry';
import type { RepSummary, Side } from '@/engine/types';

export type CommandId = 'squat' | 'jumpingJack' | 'press' | 'bendLeft' | 'bendRight';

export interface CommandDef {
  id: CommandId;
  exercise: ExerciseId;
  side?: Side;
  icon: string;
}

export const COMMANDS: Record<CommandId, CommandDef> = {
  squat: { id: 'squat', exercise: 'squat', icon: '⬇️' },
  jumpingJack: { id: 'jumpingJack', exercise: 'jumpingJack', icon: '✴️' },
  press: { id: 'press', exercise: 'press', icon: '🛡️' },
  bendLeft: { id: 'bendLeft', exercise: 'sideBend', side: 'l', icon: '⬅️' },
  bendRight: { id: 'bendRight', exercise: 'sideBend', side: 'r', icon: '➡️' },
};

export interface ActiveCommand {
  def: CommandDef;
  /** sequence number, changes on every new command */
  n: number;
  issuedAt: number;
  deadline: number;
}

export type GameEvent =
  | { type: 'command'; command: ActiveCommand }
  | { type: 'hit'; points: number; clean: boolean; combo: number }
  | { type: 'almost'; rep: RepSummary }
  | { type: 'wrongSide' }
  | { type: 'miss'; livesLeft: number }
  | { type: 'over'; reason: 'time' | 'lives' };

export interface ChallengeOptions {
  durationMs: number;
  lives: number;
  /** reaction window at the start / at the end (linearly shrinking) */
  windowStartMs: number;
  windowEndMs: number;
  /** short breather between commands */
  gapMs: number;
}

export const DEFAULT_CHALLENGE: ChallengeOptions = {
  durationMs: 60_000,
  lives: 3,
  windowStartMs: 5000,
  windowEndMs: 3000,
  gapMs: 600,
};

/**
 * "Batyr Challenge" rules, independent of rendering and pose detection:
 * a random command appears, the player has a shrinking window to do one correct rep.
 * Clean reps give a bonus; consecutive hits grow the combo multiplier (×1…×4).
 * A rep that is not counted doesn't cost a life — the player sees the fix and can retry
 * until the window closes. Timeouts cost a life.
 */
export class ChallengeGame {
  score = 0;
  lives: number;
  combo = 0;
  bestCombo = 0;
  hits = 0;
  clean = 0;
  misses = 0;
  over = false;
  command: ActiveCommand | null = null;
  private startedAt = 0;
  private nextAt = 0;
  private n = 0;

  constructor(
    private readonly opts: ChallengeOptions = DEFAULT_CHALLENGE,
    private readonly rand: () => number = Math.random,
  ) {
    this.lives = opts.lives;
  }

  get multiplier(): number {
    return Math.min(4, 1 + Math.floor(this.combo / 2));
  }

  timeLeftMs(t: number): number {
    return Math.max(0, this.startedAt + this.opts.durationMs - t);
  }

  start(t: number): GameEvent[] {
    this.startedAt = t;
    this.nextAt = t;
    return this.tick(t);
  }

  tick(t: number): GameEvent[] {
    if (this.over) return [];
    const events: GameEvent[] = [];
    if (t - this.startedAt >= this.opts.durationMs) return this.end('time');

    if (this.command && t > this.command.deadline) {
      this.misses++;
      this.lives--;
      this.combo = 0;
      this.command = null;
      this.nextAt = t + this.opts.gapMs;
      events.push({ type: 'miss', livesLeft: this.lives });
      if (this.lives <= 0) return [...events, ...this.end('lives')];
    }
    if (!this.command && t >= this.nextAt) {
      this.command = this.issue(t);
      events.push({ type: 'command', command: this.command });
    }
    return events;
  }

  /** Report a completed rep of the current command's exercise. */
  rep(rep: RepSummary, t: number): GameEvent[] {
    const cmd = this.command;
    if (this.over || !cmd) return [];
    if (!rep.counted) {
      this.combo = 0;
      return [{ type: 'almost', rep }];
    }
    if (cmd.def.side && rep.side && rep.side !== cmd.def.side) {
      this.combo = 0;
      return [{ type: 'wrongSide' }];
    }
    const isClean = rep.errors.length === 0;
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.hits++;
    if (isClean) this.clean++;
    // faster reactions score more
    const speed = 1 - Math.min(1, (t - cmd.issuedAt) / (cmd.deadline - cmd.issuedAt));
    const points = Math.round((100 + (isClean ? 50 : 0) + 50 * speed) * this.multiplier);
    this.score += points;
    this.command = null;
    this.nextAt = t + this.opts.gapMs;
    return [{ type: 'hit', points, clean: isClean, combo: this.combo }];
  }

  xp(): number {
    return Math.round(this.score / 20);
  }

  private end(reason: 'time' | 'lives'): GameEvent[] {
    this.over = true;
    this.command = null;
    return [{ type: 'over', reason }];
  }

  private issue(t: number): ActiveCommand {
    const ids = Object.keys(COMMANDS) as CommandId[];
    let id = ids[Math.floor(this.rand() * ids.length)]!;
    // avoid the same command twice in a row
    if (this.command === null && this.lastId === id) id = ids[(ids.indexOf(id) + 1) % ids.length]!;
    this.lastId = id;
    const k = Math.min(1, (t - this.startedAt) / this.opts.durationMs);
    const window = this.opts.windowStartMs + (this.opts.windowEndMs - this.opts.windowStartMs) * k;
    return { def: COMMANDS[id], n: ++this.n, issuedAt: t, deadline: t + window };
  }

  private lastId: CommandId | null = null;
}
