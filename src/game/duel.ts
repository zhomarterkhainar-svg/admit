import { extractFeatures } from '@/core/features/extract';
import { LandmarkSmoother } from '@/core/filters/landmarkSmoother';
import { bodyGeometry } from '@/core/vision/personLock';
import type { FrameFeatures, PoseFrame } from '@/core/types';
import type { RepSummary } from '@/engine/types';
import type { ExerciseId } from '@/exercises/registry';

/** Sides as the players see them on the (mirrored) screen. */
export type DuelSide = 'L' | 'R';
export const DUEL_SIDES: readonly DuelSide[] = ['L', 'R'];

/**
 * The camera picture is not mirrored, the screen is: the player on the screen's left stands in
 * the image's right half (x > 0.5).
 */
const HALF_START: Record<DuelSide, number> = { L: 0.5, R: 0 };

/** Which half of the picture a person stands in (by the middle of their hips). */
export function sideOf(frame: PoseFrame): DuelSide {
  const hipX = (frame.image[23]!.x + frame.image[24]!.x) / 2;
  return hipX >= 0.5 ? 'L' : 'R';
}

/**
 * Each player's half of the picture becomes a camera of their own: x is stretched back to 0..1
 * and the frame is half as wide, so aspect-corrected features, framing checks ("off center",
 * "too close") and exercise rules work unchanged for both players.
 */
export function toHalf(frame: PoseFrame, side: DuelSide): PoseFrame {
  const x0 = HALF_START[side];
  return {
    ...frame,
    width: frame.width / 2,
    image: frame.image.map((l) => ({ ...l, x: (l.x - x0) * 2 })),
  };
}

/** The inverse of toHalf: a pose made for one half placed into the full picture (demo). */
export function fromHalf(frame: PoseFrame, side: DuelSide): PoseFrame {
  const x0 = HALF_START[side];
  return {
    ...frame,
    width: frame.width * 2,
    image: frame.image.map((l) => ({ ...l, x: x0 + l.x / 2 })),
  };
}

/** One player per half — the biggest person standing there. */
export function splitPlayers(crowd: readonly PoseFrame[]): Record<DuelSide, PoseFrame | null> {
  const out: Record<DuelSide, PoseFrame | null> = { L: null, R: null };
  const size: Record<DuelSide, number> = { L: 0, R: 0 };
  for (const p of crowd) {
    const g = bodyGeometry(p.image, p.width / p.height);
    if (!g) continue;
    const side = sideOf(p);
    if (g.scale > size[side]) {
      size[side] = g.scale;
      out[side] = p;
    }
  }
  return out;
}

export interface DuelView {
  /** smoothed pose in full-picture coordinates (for drawing) */
  frame: PoseFrame | null;
  /** features of the player's own half ("virtual camera") */
  features: FrameFeatures | null;
  half: PoseFrame | null;
}

/** Splits every tick into two smoothed players. */
export class DuelTracker {
  private readonly smooth = {
    L: { image: new LandmarkSmoother(), world: new LandmarkSmoother() },
    R: { image: new LandmarkSmoother(), world: new LandmarkSmoother() },
  };

  update(crowd: readonly PoseFrame[], t: number): Record<DuelSide, DuelView> {
    const raw = splitPlayers(crowd);
    const view = (side: DuelSide): DuelView => {
      const r = raw[side];
      const s = this.smooth[side];
      if (!r) {
        s.image.reset();
        s.world.reset();
        return { frame: null, features: null, half: null };
      }
      const frame: PoseFrame = {
        ...r,
        t,
        image: s.image.smooth(r.image, t),
        world: s.world.smooth(r.world, t),
      };
      const half = toHalf(frame, side);
      return { frame, half, features: extractFeatures(half) };
    };
    return { L: view('L'), R: view('R') };
  }
}

export interface DuelRound {
  exercise: ExerciseId;
  ms: number;
}

/** Three short rounds that any two people can do side by side. */
export const DUEL_ROUNDS: readonly DuelRound[] = [
  { exercise: 'squat', ms: 20_000 },
  { exercise: 'jumpingJack', ms: 20_000 },
  { exercise: 'press', ms: 20_000 },
];

export const DUEL_BREAK_MS = 3500;
export const DUEL_POINTS = { counted: 10, clean: 5 } as const;

export interface DuelPlayer {
  score: number;
  reps: number;
  clean: number;
  /** counted reps in the current round */
  roundReps: number;
}

export type DuelEvent =
  | { type: 'break'; round: number }
  | { type: 'go'; round: number }
  | { type: 'point'; side: DuelSide; points: number; clean: boolean }
  | { type: 'miss'; side: DuelSide; rep: RepSummary }
  | { type: 'over'; winner: DuelSide | 'draw' };

/**
 * "Batyr vs Batyr": both players do the same exercise at the same time, round after round.
 * A counted rep scores 10, a clean one 5 more. Pure rules — no pose detection or rendering.
 */
export class DuelGame {
  readonly players: Record<DuelSide, DuelPlayer> = {
    L: { score: 0, reps: 0, clean: 0, roundReps: 0 },
    R: { score: 0, reps: 0, clean: 0, roundReps: 0 },
  };
  round = 0;
  phase: 'break' | 'play' | 'over' = 'break';
  private phaseAt = 0;

  constructor(readonly rounds: readonly DuelRound[] = DUEL_ROUNDS) {}

  start(t: number): DuelEvent[] {
    this.phaseAt = t;
    return [{ type: 'break', round: 0 }];
  }

  get current(): DuelRound {
    return this.rounds[Math.min(this.round, this.rounds.length - 1)]!;
  }

  /** ms left in the current phase */
  left(t: number): number {
    const len = this.phase === 'break' ? DUEL_BREAK_MS : this.current.ms;
    return Math.max(0, this.phaseAt + len - t);
  }

  tick(t: number): DuelEvent[] {
    if (this.phase === 'over' || this.left(t) > 0) return [];
    this.phaseAt = t;
    if (this.phase === 'break') {
      this.phase = 'play';
      for (const s of DUEL_SIDES) this.players[s].roundReps = 0;
      return [{ type: 'go', round: this.round }];
    }
    if (this.round + 1 < this.rounds.length) {
      this.round++;
      this.phase = 'break';
      return [{ type: 'break', round: this.round }];
    }
    this.phase = 'over';
    return [{ type: 'over', winner: this.winner() }];
  }

  rep(side: DuelSide, rep: RepSummary): DuelEvent[] {
    if (this.phase !== 'play') return [];
    if (!rep.counted) return [{ type: 'miss', side, rep }];
    const p = this.players[side];
    const clean = rep.errors.length === 0;
    const points = DUEL_POINTS.counted + (clean ? DUEL_POINTS.clean : 0);
    p.score += points;
    p.reps++;
    p.roundReps++;
    if (clean) p.clean++;
    return [{ type: 'point', side, points, clean }];
  }

  winner(): DuelSide | 'draw' {
    const { L, R } = this.players;
    return L.score === R.score ? 'draw' : L.score > R.score ? 'L' : 'R';
  }
}
