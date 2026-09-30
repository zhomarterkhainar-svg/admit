import { describe, expect, it } from 'vitest';
import { extractFeatures } from '@/core/features/extract';
import { makePose } from '@/core/reference/template';
import { MOVES, MOVE_IDS } from './moves';

describe('dance moves', () => {
  for (const id of MOVE_IDS) {
    it(`the ${id} reference pose matches ${id} and nothing else`, () => {
      const frame = makePose(MOVES[id].pose);
      const f = extractFeatures(frame);
      const matched = MOVE_IDS.filter((m) => MOVES[m].match(f, frame));
      expect(matched).toEqual([id]);
    });
  }

  it('standing still is no move at all', () => {
    const frame = makePose({});
    const f = extractFeatures(frame);
    expect(MOVE_IDS.filter((m) => MOVES[m].match(f, frame))).toEqual([]);
  });
});
