import { describe, expect, it } from 'vitest';
import { FeedbackArbiter } from './arbiter';
import type { Hint } from './types';

const hint = (id: string, severity: Hint['severity']): Hint => ({
  id,
  severity,
  message: 'squat.name',
  fix: 'squat.name',
  joints: [],
});

describe('FeedbackArbiter', () => {
  it('shows the highest-priority problem and speaks it once per cooldown', () => {
    const a = new FeedbackArbiter();
    const form = hint('form', 'form');
    const safety = hint('safety', 'safety');
    const o1 = a.update([form, safety], 0);
    expect(o1.hint?.id).toBe('safety');
    expect(o1.speak).toBe(true);
    expect(a.update([form, safety], 100).speak).toBe(false);
  });

  it('keeps the current hint while active (no ping-pong between equal ones)', () => {
    const a = new FeedbackArbiter();
    a.update([hint('x', 'form')], 0);
    expect(a.update([hint('y', 'form'), hint('x', 'form')], 2000).hint?.id).toBe('x');
  });

  it('a setup problem pre-empts technique hints', () => {
    const a = new FeedbackArbiter();
    a.update([hint('x', 'form')], 0);
    expect(a.update([hint('x', 'form'), hint('setup', 'setup')], 100).hint?.id).toBe('setup');
  });

  it('reports a fix when a frame problem clears, but not when a rep flash expires', () => {
    const a = new FeedbackArbiter();
    a.update([hint('x', 'form')], 0);
    expect(a.update([], 500).fixed).toBe('x');

    const b = new FeedbackArbiter({ speakCooldownMs: 5000, flashMs: 1000 });
    b.flash(hint('depth', 'validity'), 0);
    expect(b.update([], 10).hint?.id).toBe('depth');
    const after = b.update([], 1500);
    expect(after.hint).toBeNull();
    expect(after.fixed).toBeNull();
  });
});
