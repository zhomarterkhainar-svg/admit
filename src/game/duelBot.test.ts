import { describe, expect, it } from 'vitest';
import { extractFeatures } from '@/core/features/extract';
import { ExerciseRunner } from '@/engine/runner';
import { EXERCISES } from '@/exercises/registry';
import { DUEL_ROUNDS, DuelGame, DUEL_BREAK_MS } from './duel';
import { BOT_LEVELS, DuelBot, type BotLevel } from './duelBot';

/** Deterministic Math.random stand-in. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}

/** One 20 s round of the bot, judged by the real runner at 30 fps. */
function playRound(level: BotLevel, exercise: (typeof DUEL_ROUNDS)[number]['exercise'], seed = 1) {
  const bot = new DuelBot(level, seeded(seed));
  const runner = new ExerciseRunner(EXERCISES[exercise]);
  bot.start(exercise, 0);
  let counted = 0;
  let clean = 0;
  for (let t = 0; t <= 20_000; t += 33) {
    for (const ev of runner.update(extractFeatures(bot.frame(t)), 1, t).events) {
      if (ev.type !== 'rep' || !ev.rep.counted) continue;
      counted++;
      if (!ev.rep.errors.length) clean++;
    }
  }
  return { counted, clean };
}

describe('AI rival', () => {
  for (const { exercise } of DUEL_ROUNDS) {
    it(`${exercise}: the engine counts its reps, harder levels score more`, () => {
      const score = (level: BotLevel) => {
        // average a few rounds: mistakes are random
        let sum = 0;
        for (let seed = 1; seed <= 4; seed++) {
          const r = playRound(level, exercise, seed);
          sum += r.counted * 10 + r.clean * 5;
        }
        return sum / 4;
      };
      const [easy, medium, hard] = BOT_LEVELS.map(score);
      expect(easy).toBeGreaterThan(0);
      expect(medium).toBeGreaterThan(easy!);
      expect(hard).toBeGreaterThan(medium!);
    });
  }

  it('a clean hard rival does clean reps (its pace is not "too fast")', () => {
    const r = playRound('hard', 'squat', 7);
    expect(r.counted).toBeGreaterThanOrEqual(6);
    expect(r.clean).toBeGreaterThanOrEqual(r.counted - 1);
  });

  it('stands still until "go!" and waits its reaction time', () => {
    const bot = new DuelBot('easy');
    expect(bot.pose(0)).toEqual({});
    bot.start('squat', 1000);
    expect(bot.pose(1000 + bot.spec.react - 10)).toEqual({});
    expect(bot.pose(1000 + bot.spec.react + 500)).not.toEqual({});
  });

  it('plays a whole match against the player through DuelGame', () => {
    const game = new DuelGame();
    const bot = new DuelBot('medium', seeded(3));
    game.start(0);
    let runner: ExerciseRunner<unknown> | null = null;
    for (let t = 0; game.phase !== 'over' && t < 200_000; t += 33) {
      for (const e of game.tick(t)) {
        if (e.type === 'go') {
          runner = new ExerciseRunner(EXERCISES[game.current.exercise]);
          bot.start(game.current.exercise, t);
        } else if (e.type === 'break') {
          runner = null;
          bot.start(null, t);
        }
      }
      if (!runner) continue;
      for (const ev of runner.update(extractFeatures(bot.frame(t)), 1, t).events)
        if (ev.type === 'rep') game.rep('R', ev.rep);
    }
    expect(game.phase).toBe('over');
    expect(game.players.R.reps).toBeGreaterThan(8);
    expect(game.winner()).toBe('R'); // the player (L) did nothing
    expect(DUEL_BREAK_MS).toBeGreaterThan(0);
  });
});
