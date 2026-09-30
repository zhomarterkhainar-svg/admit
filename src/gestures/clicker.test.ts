import { describe, expect, it } from 'vitest';
import { CursorClicker, FALLBACK_DWELL_MS, CLICK_COOLDOWN_MS } from './clicker';

const BTN = { id: 'start', rect: { left: 0.4, top: 0.4, right: 0.6, bottom: 0.6 } };
const OTHER = { id: 'other', rect: { left: 0.7, top: 0.4, right: 0.9, bottom: 0.6 } };
const ON = { x: 0.5, y: 0.5 };
const OFF = { x: 0.1, y: 0.1 };
const OPEN = { openness: 2.0, score: 0.9 };
const FIST = { openness: 1.0, score: 0.9 };
const DT = 33;

/** feeds frames and returns every click */
function run(
  c: CursorClicker,
  frames: { cursor: typeof ON | null; hand: typeof OPEN | null; ms: number }[],
  t0 = 0,
) {
  let t = t0;
  const clicks: { id: string; via: string | null; t: number }[] = [];
  let last = null as ReturnType<CursorClicker['update']> | null;
  for (const f of frames) {
    for (let e = 0; e < f.ms; e += DT) {
      last = c.update(f.cursor, [BTN, OTHER], f.hand, (t += DT));
      if (last.selected) clicks.push({ id: last.selected, via: last.via, t });
    }
  }
  return { clicks, last: last!, t };
}

describe('hand cursor: fist click', () => {
  it('open palm over a button, then a fist → one click at once', () => {
    const { clicks } = run(new CursorClicker(), [
      { cursor: ON, hand: OPEN, ms: 300 },
      { cursor: ON, hand: FIST, ms: 300 },
    ]);
    expect(clicks).toHaveLength(1);
    expect(clicks[0]).toMatchObject({ id: 'start', via: 'fist' });
    expect(clicks[0]!.t).toBeLessThan(700); // well before the 4 s fallback
  });

  it('holding the fist never repeats the click', () => {
    const { clicks } = run(new CursorClicker(), [
      { cursor: ON, hand: OPEN, ms: 300 },
      { cursor: ON, hand: FIST, ms: 6000 },
    ]);
    expect(clicks.map((c) => c.via)).toEqual(['fist']);
  });

  it('open again and squeeze again → a second click (after the cooldown)', () => {
    const { clicks } = run(new CursorClicker(), [
      { cursor: ON, hand: OPEN, ms: 300 },
      { cursor: ON, hand: FIST, ms: 300 },
      { cursor: OFF, hand: OPEN, ms: 400 }, // leave the button
      { cursor: ON, hand: OPEN, ms: 1000 },
      { cursor: ON, hand: FIST, ms: 300 },
    ]);
    expect(clicks).toHaveLength(2);
    expect(clicks[1]!.t - clicks[0]!.t).toBeGreaterThanOrEqual(CLICK_COOLDOWN_MS);
  });

  it('a fist without a preceding open palm does not click', () => {
    const { clicks } = run(new CursorClicker(), [{ cursor: ON, hand: FIST, ms: 1500 }]);
    expect(clicks).toEqual([]);
  });

  it('squeezing away from any button does nothing', () => {
    const { clicks } = run(new CursorClicker(), [
      { cursor: OFF, hand: OPEN, ms: 300 },
      { cursor: OFF, hand: FIST, ms: 300 },
    ]);
    expect(clicks).toEqual([]);
  });

  it('the click goes to the button the hand pointed at while open (fingertip drifts while curling)', () => {
    const { clicks } = run(new CursorClicker(), [
      { cursor: ON, hand: OPEN, ms: 300 },
      { cursor: { x: 0.75, y: 0.5 }, hand: FIST, ms: 200 }, // drifted onto "other" as the fist closed
    ]);
    expect(clicks[0]?.id).toBe('start');
  });

  it('low-confidence hand readings are ignored', () => {
    const { clicks } = run(new CursorClicker(), [
      { cursor: ON, hand: { openness: 2.0, score: 0.2 }, ms: 300 },
      { cursor: ON, hand: { openness: 1.0, score: 0.2 }, ms: 300 },
    ]);
    expect(clicks).toEqual([]);
  });

  it('the ring fills as the palm closes', () => {
    const c = new CursorClicker();
    run(c, [{ cursor: ON, hand: OPEN, ms: 200 }]);
    const half = c.update(ON, [BTN], { openness: 1.62, score: 0.9 }, 300).progress;
    expect(half).toBeGreaterThan(0.3);
    expect(half).toBeLessThan(0.8);
  });
});

describe('hand cursor: 4 s hover fallback (hand model cannot see the fist)', () => {
  it('no hand data: hovering 4 s clicks, 3.8 s does not', () => {
    const short = run(new CursorClicker(), [
      { cursor: ON, hand: null, ms: FALLBACK_DWELL_MS - 200 },
    ]);
    expect(short.clicks).toEqual([]);
    expect(short.last.progress).toBeGreaterThan(0.9);
    const full = run(new CursorClicker(), [
      { cursor: ON, hand: null, ms: FALLBACK_DWELL_MS + 200 },
    ]);
    expect(full.clicks).toEqual([expect.objectContaining({ id: 'start', via: 'dwell' })]);
  });

  it('staying on the button after a click does not click again', () => {
    const { clicks } = run(new CursorClicker(), [
      { cursor: ON, hand: null, ms: 3 * FALLBACK_DWELL_MS },
    ]);
    expect(clicks).toHaveLength(1);
  });

  it('leaving the button resets the timer', () => {
    const { clicks } = run(new CursorClicker(), [
      { cursor: ON, hand: null, ms: 3000 },
      { cursor: OFF, hand: null, ms: 200 },
      { cursor: ON, hand: null, ms: 3000 },
    ]);
    expect(clicks).toEqual([]);
  });

  it('a fist click wins long before the fallback and blocks a double click', () => {
    const { clicks } = run(new CursorClicker(), [
      { cursor: ON, hand: OPEN, ms: 500 },
      { cursor: ON, hand: FIST, ms: 200 },
      { cursor: ON, hand: FIST, ms: 5000 },
    ]);
    expect(clicks.map((c) => c.via)).toEqual(['fist']);
  });

  it('cursor lost (hand lowered) → nothing is clicked', () => {
    const { clicks } = run(new CursorClicker(), [{ cursor: null, hand: null, ms: 6000 }]);
    expect(clicks).toEqual([]);
  });
});
