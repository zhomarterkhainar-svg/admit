import { blend, type PoseEdit } from '@/core/reference/template';
import type { Note } from './chart';
import { MOVES, MOVE_IDS, type MoveId } from './moves';

/** the demo dancer flows into each move this long before its beat, then holds it */
const FLOW_MS = 300;
/** every 11th note is danced late, every 17th is the wrong move — the judge must see it */
const LATE_EVERY = 11;
const LATE_MS = 350;
const WRONG_EVERY = 17;

function danced(n: Note): { t: number; move: MoveId } {
  const late = n.i % LATE_EVERY === LATE_EVERY - 1 ? LATE_MS : 0;
  const wrong = n.i % WRONG_EVERY === WRONG_EVERY - 1;
  // a wrong move that is clearly not the right one (another move of the set)
  const move = wrong ? MOVE_IDS[(MOVE_IDS.indexOf(n.move) + 4) % MOVE_IDS.length]! : n.move;
  return { t: n.t + late, move };
}

/**
 * The virtual dancer's pose at a song time: standing until the first move, then each move
 * reached `FLOW_MS` before its beat and held until the next one starts.
 */
export function demoDancePose(notes: readonly Note[]): (songMs: number) => PoseEdit {
  const steps = notes.map(danced);
  return (ms) => {
    let k = steps.findIndex((s) => s.t > ms);
    if (k < 0) k = steps.length; // after the last move
    const prev = k > 0 ? MOVES[steps[k - 1]!.move].pose : {};
    const next = steps[k];
    if (!next || ms < next.t - FLOW_MS) return prev;
    return blend(prev, MOVES[next.move].pose, (ms - (next.t - FLOW_MS)) / FLOW_MS);
  };
}
