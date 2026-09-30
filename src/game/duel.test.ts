import { describe, expect, it } from 'vitest';
import { extractFeatures } from '@/core/features/extract';
import { blend, makePose } from '@/core/reference/template';
import { ExerciseRunner } from '@/engine/runner';
import { EXERCISES } from '@/exercises/registry';
import { squatDown } from '@/exercises/squat/reference';
import type { RepSummary } from '@/engine/types';
import {
  DUEL_BREAK_MS,
  DuelGame,
  DuelTracker,
  fromHalf,
  splitPlayers,
  toHalf,
  type DuelSide,
} from './duel';

/** A person standing in the middle of one half of a 1280×720 picture. */
const inHalf = (side: DuelSide, edit = {}, t = 0) => fromHalf(makePose(edit, t, 640, 720), side);

const rep = (counted: boolean, errors: string[] = []): RepSummary => ({
  index: 0,
  startT: 0,
  endT: 1,
  counted,
  quality: counted ? 100 : 0,
  errors,
});

describe('duel: two players in one picture', () => {
  it('the screen-left player is the one in the image right half (mirrored screen)', () => {
    const { L, R } = splitPlayers([inHalf('R'), inHalf('L')]);
    expect(L && (L.image[23]!.x + L.image[24]!.x) / 2).toBeGreaterThan(0.5);
    expect(R && (R.image[23]!.x + R.image[24]!.x) / 2).toBeLessThan(0.5);
  });

  it('keeps the biggest person of each half (a passer-by far behind is ignored)', () => {
    const near = inHalf('L');
    const far: typeof near = {
      ...near,
      image: near.image.map((l) => ({ ...l, x: 0.75 + (l.x - 0.75) * 0.4, y: 0.4 + l.y * 0.4 })),
    };
    expect(splitPlayers([far, near]).L).toBe(near);
  });

  it('a half is a camera of its own: the features match a single-player frame', () => {
    const pose = squatDown();
    const single = extractFeatures(makePose(pose, 0, 640, 720));
    const half = extractFeatures(toHalf(inHalf('R', pose), 'R'));
    expect(half.kneeAngle.l).toBeCloseTo(single.kneeAngle.l, 5);
    expect(half.center.x).toBeCloseTo(single.center.x, 5);
    expect(half.bodyHeightFrac).toBeCloseTo(single.bodyHeightFrac, 5);
  });

  it('counts both players at once, each with their own runner', () => {
    const tracker = new DuelTracker();
    const runners = {
      L: new ExerciseRunner(EXERCISES.squat),
      R: new ExerciseRunner(EXERCISES.squat),
    };
    let t = 0;
    const counted = { L: 0, R: 0 };
    // L squats deep twice, R only half-way (not counted). The tracker smooths the poses (like the
    // camera loop does), so the last rise lands a couple of frames late: stand still at the end.
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i <= 90; i++) {
        const k = r === 2 || i < 30 ? 0 : Math.sin((Math.PI * (i - 30)) / 60);
        t += 33;
        const views = tracker.update(
          [
            inHalf('L', blend({}, squatDown(), k), t),
            inHalf('R', blend({}, squatDown(), k * 0.5), t),
          ],
          t,
        );
        for (const side of ['L', 'R'] as const) {
          const st = runners[side].update(views[side].features, 1, t);
          counted[side] = st.counted;
        }
      }
    }
    expect(counted.L).toBe(2);
    expect(counted.R).toBe(0);
  });
});

describe('duel game', () => {
  it('break → play → next round … → over, with a winner', () => {
    const g = new DuelGame([
      { exercise: 'squat', ms: 1000 },
      { exercise: 'press', ms: 1000 },
    ]);
    expect(g.start(0)).toEqual([{ type: 'break', round: 0 }]);
    expect(g.rep('L', rep(true))).toEqual([]); // no points during the break
    expect(g.tick(DUEL_BREAK_MS)).toEqual([{ type: 'go', round: 0 }]);
    g.rep('L', rep(true));
    g.rep('L', rep(true, ['squat.torso']));
    g.rep('R', rep(false, ['squat.depth']));
    expect(g.players.L.score).toBe(25);
    expect(g.players.R.score).toBe(0);
    expect(g.tick(DUEL_BREAK_MS + 1000)).toEqual([{ type: 'break', round: 1 }]);
    g.tick(2 * DUEL_BREAK_MS + 1000);
    g.rep('R', rep(true));
    expect(g.players.R.roundReps).toBe(1);
    expect(g.tick(2 * DUEL_BREAK_MS + 2000)).toEqual([{ type: 'over', winner: 'L' }]);
  });

  it('equal scores are a draw', () => {
    const g = new DuelGame([{ exercise: 'squat', ms: 10 }]);
    g.start(0);
    g.tick(DUEL_BREAK_MS);
    g.rep('L', rep(true));
    g.rep('R', rep(true));
    expect(g.winner()).toBe('draw');
  });
});
