import type { FrameFeatures } from '@/core/types';
import type { FrameRule, RuleContext } from './types';

interface RuleState {
  active: boolean;
  /** time the current (unconfirmed) state change started */
  since: number | null;
}

/**
 * Evaluates frame rules with persistence + release hysteresis so hints don't flicker.
 * A rule only activates after violating for `persistMs`, and only clears after being fine for `clearMs`.
 */
export class RuleTracker {
  private readonly state = new Map<string, RuleState>();

  constructor(private readonly rules: ReadonlyArray<FrameRule>) {}

  update(f: FrameFeatures, ctx: RuleContext): FrameRule[] {
    const active: FrameRule[] = [];
    for (const rule of this.rules) {
      const st = this.state.get(rule.id) ?? { active: false, since: null };
      const inPhase = !rule.phases || rule.phases.includes(ctx.phase);
      const violating = inPhase && safeTest(rule, f, ctx);
      if (violating !== st.active) {
        st.since ??= f.t;
        const need = violating ? (rule.persistMs ?? 200) : (rule.clearMs ?? 300);
        if (f.t - st.since >= need || !inPhase) {
          st.active = violating;
          st.since = null;
        }
      } else {
        st.since = null;
      }
      this.state.set(rule.id, st);
      if (st.active) active.push(rule);
    }
    return active;
  }

  reset(): void {
    this.state.clear();
  }
}

function safeTest(rule: FrameRule, f: FrameFeatures, ctx: RuleContext): boolean {
  try {
    return rule.test(f, ctx) === true;
  } catch {
    return false;
  }
}
