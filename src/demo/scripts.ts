import { P } from '@/core/types';
import { blend, type PoseEdit } from '@/core/reference/template';
import type { AnyExerciseId } from '@/exercises/registry';
import type { CommandId } from '@/game/challenge';
import { squatDown } from '@/exercises/squat/reference';
import { jackOpen } from '@/exercises/jumpingJack/reference';
import { lungeDown } from '@/exercises/lunge/reference';
import { pressStart, pressTop } from '@/exercises/press/reference';
import { sideBend } from '@/exercises/sideBend/reference';
import { pushupDown, pushupTop } from '@/exercises/pushup/reference';
import { plankPose } from '@/exercises/plank/reference';
import { bridgeDown, bridgeUp, bridgeUpFar } from '@/exercises/bridge/reference';

/** One scripted repetition: rest → peak → rest. */
export interface DemoRep {
  rest: PoseEdit;
  peak: PoseEdit;
  ms: number;
}

const rep = (peak: PoseEdit, ms = 2000, rest: PoseEdit = {}): DemoRep => ({ rest, peak, ms });

/**
 * The duel exercises as a clean rep plus the typical mistakes. Shared by the demo choreography
 * and the AI rival, who mixes them in by difficulty.
 */
export interface MoveSet {
  clean: DemoRep;
  faults: DemoRep[];
}

export const DUEL_MOVES = {
  squat: {
    clean: rep(squatDown()),
    faults: [
      rep(blend({}, squatDown(), 0.55)), // too shallow → not counted
      rep(
        squatDown({ [P.leftKnee]: [0.05, 0.45, -0.22], [P.rightKnee]: [-0.05, 0.45, -0.22] }),
        2600,
      ), // knees cave in
      rep(squatDown(), 600), // too fast
    ],
  },
  jumpingJack: {
    clean: rep(jackOpen(), 1000),
    faults: [
      rep(
        jackOpen({
          [P.leftElbow]: [0.4, -0.45],
          [P.rightElbow]: [-0.4, -0.45],
          [P.leftWrist]: [0.55, -0.55],
          [P.rightWrist]: [-0.55, -0.55],
        }),
        1000,
      ), // arms not overhead → not counted
      rep(
        jackOpen({
          [P.leftAnkle]: [0.25, 0.84],
          [P.rightAnkle]: [-0.25, 0.84],
          [P.leftHeel]: [0.25, 0.88],
          [P.rightHeel]: [-0.25, 0.88],
        }),
        1000,
      ), // narrow
    ],
  },
  press: {
    clean: rep(pressTop(), 1600, pressStart()),
    faults: [
      rep(
        pressTop({
          [P.leftElbow]: [0.36, -0.75],
          [P.rightElbow]: [-0.36, -0.75],
          [P.leftWrist]: [0.22, -1.0],
          [P.rightWrist]: [-0.22, -1.0],
        }),
        1600,
        pressStart(),
      ), // no lockout → not counted
      rep(
        pressTop({ [P.rightElbow]: [-0.36, -0.42], [P.rightWrist]: [-0.32, -0.62] }),
        2400,
        pressStart(),
      ), // one arm lags
    ],
  },
} satisfies Record<string, MoveSet>;

const { squat, jumpingJack, press } = DUEL_MOVES;

/**
 * Demo choreography per exercise: good reps mixed with typical mistakes so the error mode
 * can be seen without a camera. The engine is NOT told about the mistakes — it detects them.
 */
export const DEMO_SCRIPTS: Record<AnyExerciseId, DemoRep[]> = {
  squat: [
    squat.clean,
    squat.faults[0]!,
    squat.faults[1]!,
    squat.clean,
    squat.faults[2]!,
    squat.clean,
  ],
  jumpingJack: [
    jumpingJack.clean,
    jumpingJack.faults[0]!,
    jumpingJack.clean,
    jumpingJack.faults[1]!,
    jumpingJack.clean,
  ],
  press: [press.clean, press.faults[0]!, press.faults[1]!, press.clean],
  lunge: [
    rep(lungeDown('l'), 2400),
    rep(blend({}, lungeDown('r'), 0.6), 2400), // shallow → not counted
    rep(lungeDown('r'), 2400),
    rep(
      lungeDown('l', {
        [P.leftShoulder]: [0.19, -0.2, -0.3],
        [P.rightShoulder]: [-0.19, -0.2, -0.3],
        [P.nose]: [0, -0.3, -0.4],
      }),
      2800,
    ), // leaning forward
  ],
  sideBend: [
    rep(sideBend('l')),
    rep(sideBend('r')),
    rep(blend({}, sideBend('l'), 0.7)), // too small → not counted
    rep(sideBend('l')),
  ],
  pushup: [
    rep(pushupDown(), 2200, pushupTop()),
    rep(blend(pushupTop(), pushupDown(), 0.5), 1800, pushupTop()), // too shallow → not counted
    rep(pushupDown(), 2200, pushupTop()),
    rep(pushupDown(0.15), 2600, pushupTop(0.15)), // hips sag
    rep(pushupDown(), 2200, pushupTop()),
  ],
  plank: [
    rep(plankPose(), 4000, plankPose()),
    rep(plankPose(0.13), 3200, plankPose()), // hips sag, the coach says so
    rep(plankPose(), 4000, plankPose()),
    rep(plankPose(-0.12), 3200, plankPose()), // hips piked up
  ],
  bridge: [
    rep(bridgeUp(), 2200, bridgeDown()),
    rep(blend(bridgeDown(), bridgeUp(), 0.6), 1800, bridgeDown()), // half bridge → not counted
    rep(bridgeUp(), 2200, bridgeDown()),
    rep(bridgeUpFar(), 2400, bridgeDown()), // feet too far
  ],
};

/** Free-workout demo: a mix of clean reps across all exercises (the AI must tell them apart). */
export const DEMO_MIX: DemoRep[] = [
  DEMO_SCRIPTS.squat[0]!,
  DEMO_SCRIPTS.squat[0]!,
  DEMO_SCRIPTS.jumpingJack[0]!,
  DEMO_SCRIPTS.jumpingJack[0]!,
  DEMO_SCRIPTS.jumpingJack[0]!,
  DEMO_SCRIPTS.press[0]!,
  DEMO_SCRIPTS.press[0]!,
  DEMO_SCRIPTS.sideBend[0]!,
  DEMO_SCRIPTS.sideBend[1]!,
  DEMO_SCRIPTS.lunge[0]!,
  DEMO_SCRIPTS.lunge[2]!,
];

/**
 * Batyr Challenge demo: the virtual athlete reacts to each command with the right move (and the
 * right side). Every fourth command starts with a sloppy try, so the "almost — fix this" hint shows.
 */
export function challengeDemo(cmd: CommandId, n: number): DemoRep[] {
  const sloppy = n % 4 === 1;
  switch (cmd) {
    case 'squat':
      return sloppy
        ? [rep(blend({}, squatDown(), 0.55), 1300), rep(squatDown(), 1600)]
        : [rep(squatDown(), 1600)];
    case 'jumpingJack':
      return [rep(jackOpen(), 1000)];
    case 'press':
      return sloppy
        ? [
            rep(
              pressTop({
                [P.leftElbow]: [0.36, -0.75],
                [P.rightElbow]: [-0.36, -0.75],
                [P.leftWrist]: [0.22, -1.0],
                [P.rightWrist]: [-0.22, -1.0],
              }),
              1300,
              pressStart(),
            ),
            rep(pressTop(), 1400, pressStart()),
          ]
        : [rep(pressTop(), 1400, pressStart())];
    case 'bendLeft':
      return [rep(sideBend('l'), 1600)];
    case 'bendRight':
      return [rep(sideBend('r'), 1600)];
  }
}
