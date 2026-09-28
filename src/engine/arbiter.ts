import { SEVERITIES, type Hint } from './types';

const rank = (h: Hint) => SEVERITIES.indexOf(h.severity);

export interface ArbiterOutput {
  /** hint to display now (null = all good) */
  hint: Hint | null;
  /** true when the hint should be spoken now (respects per-hint cooldown) */
  speak: boolean;
  /** id of a hint the user just fixed (for positive reinforcement) */
  fixed: string | null;
}

/**
 * Picks ONE hint to show out of all active problems.
 * - priority: setup > safety > validity > form > tempo
 * - a shown hint stays while it is active; it is replaced only when it clears or a
 *   higher-priority problem appears (no ping-pong between two equal errors)
 * - the same hint is spoken at most once per `speakCooldownMs`
 * - rep-level hints (pushed via `flash`) are shown for `flashMs`
 */
export class FeedbackArbiter {
  private current: Hint | null = null;
  private shownAt = 0;
  private flashUntil = 0;
  private flashHint: Hint | null = null;
  private readonly lastSpoken = new Map<string, number>();

  constructor(private readonly opts = { speakCooldownMs: 5000, flashMs: 2500 }) {}

  /** Show a rep-level hint (e.g. "not counted: squat deeper"). */
  flash(hint: Hint, t: number): void {
    this.flashHint = hint;
    this.flashUntil = t + this.opts.flashMs;
  }

  update(active: Hint[], t: number): ArbiterOutput {
    const candidates = [...active];
    if (this.flashHint && t < this.flashUntil) candidates.push(this.flashHint);
    candidates.sort((a, b) => rank(a) - rank(b));
    const best = candidates[0] ?? null;

    let fixed: string | null = null;
    const currentStillActive = this.current && candidates.some((c) => c.id === this.current!.id);
    const outranks = best && this.current && rank(best) < rank(this.current);

    if (!currentStillActive || outranks) {
      // praise only real fixes: a rep-level flash simply expiring is not a fix
      if (this.current && !currentStillActive && this.current !== this.flashHint)
        fixed = this.current.id;
      if (best?.id !== this.current?.id) {
        this.current = best;
        this.shownAt = t;
      }
    }

    let speak = false;
    if (this.current && t - this.shownAt < 50) {
      const last = this.lastSpoken.get(this.current.id) ?? -Infinity;
      if (t - last >= this.opts.speakCooldownMs) {
        speak = true;
        this.lastSpoken.set(this.current.id, t);
      }
    }
    return { hint: this.current, speak, fixed };
  }

  reset(): void {
    this.current = null;
    this.flashHint = null;
    this.lastSpoken.clear();
  }
}
