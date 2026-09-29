import { describe, expect, it } from 'vitest';
import { makePose } from '@/core/reference/template';
import type { Landmark } from '@/core/types';
import { LOST_MS, PersonLock, torsoColor, type Candidate, type Rgb } from './personLock';

const ASPECT = 1280 / 720;

/** The template person moved by (dx, dy) in the image and scaled by k around the hips. */
function person(dx = 0, dy = 0, k = 1): Landmark[] {
  return makePose().image.map((l) => ({
    ...l,
    x: 0.5 + (l.x - 0.5) * k + dx,
    y: 0.55 + (l.y - 0.55) * k + dy,
  }));
}
const cand = (image: Landmark[], color: Rgb | null = null): Candidate => ({ image, color });

const RED: Rgb = [0.8, 0.15, 0.15];
const BLUE: Rgb = [0.1, 0.2, 0.75];

describe('person lock', () => {
  it('locks onto the big person in the middle, not the small one at the edge', () => {
    const lock = new PersonLock();
    const i = lock.pick([cand(person(0.33, -0.05, 0.5)), cand(person())], 0, ASPECT);
    expect(i).toBe(1);
  });

  it('keeps following the player when a passer-by appears, whatever the order', () => {
    const lock = new PersonLock();
    lock.pick([cand(person(0, 0, 1), RED)], 0, ASPECT);
    for (let f = 1; f <= 30; f++) {
      const t = f * 33;
      // the player sways a little; the passer-by walks across the background
      const me = cand(person(Math.sin(f / 4) * 0.01, 0, 1), RED);
      const other = cand(person(-0.4 + f * 0.02, -0.04, 0.7), BLUE);
      const order = f % 2 ? [me, other] : [other, me];
      expect(lock.pick(order, t, ASPECT)).toBe(order.indexOf(me));
    }
  });

  it('ignores a passer-by while the player is hidden, then picks the player up again', () => {
    const lock = new PersonLock();
    lock.pick([cand(person(), RED)], 0, ASPECT);
    // the player is occluded: only a different-looking person at the side is visible
    expect(lock.pick([cand(person(0.25, 0, 0.8), BLUE)], 400, ASPECT)).toBe(-1);
    expect(lock.pick([cand(person(0.25, 0, 0.8), BLUE)], 900, ASPECT)).toBe(-1);
    expect(lock.pick([cand(person(0.25, 0, 0.8), BLUE), cand(person(), RED)], 1200, ASPECT)).toBe(
      1,
    );
  });

  it('follows the player through a squat (the torso moves and shrinks)', () => {
    const lock = new PersonLock();
    lock.pick([cand(person())], 0, ASPECT);
    for (let f = 1; f <= 20; f++) {
      const k = Math.sin((Math.PI * f) / 20);
      expect(lock.pick([cand(person(0, 0.12 * k, 1 - 0.15 * k))], f * 33, ASPECT)).toBe(0);
    }
  });

  it('re-locks on someone new after the player has been gone for a while', () => {
    const lock = new PersonLock();
    lock.pick([cand(person(), RED)], 0, ASPECT);
    expect(lock.pick([cand(person(0.2, 0, 0.9), BLUE)], 500, ASPECT)).toBe(-1);
    expect(lock.pick([cand(person(0.2, 0, 0.9), BLUE)], LOST_MS + 100, ASPECT)).toBe(0);
  });

  it('reset() forgets the player', () => {
    const lock = new PersonLock();
    lock.pick([cand(person(), RED)], 0, ASPECT);
    lock.reset();
    expect(lock.locked).toBe(false);
    expect(lock.pick([cand(person(0.1, 0, 0.9), BLUE)], 50, ASPECT)).toBe(0);
  });
});

describe('torso colour', () => {
  it('averages the pixels inside the shoulders–hips area', () => {
    const w = 32;
    const h = 18;
    const px = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i++) px.set([200, 40, 40, 255], i * 4);
    const c = torsoColor(person(), px, w, h)!;
    expect(c[0]).toBeCloseTo(200 / 255, 2);
    expect(c[2]).toBeCloseTo(40 / 255, 2);
  });
});
