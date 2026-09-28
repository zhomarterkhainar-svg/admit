import type { FrameFeatures } from '@/core/types';
import type { FrameRule, RuleContext } from './types';

const MIN_JOINT_VISIBILITY = 0.5;

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

  /** rules corrected by the user on the last update (not just phase exits or hidden joints) */
  fixed: string[] = [];

  update(f: FrameFeatures, ctx: RuleContext): FrameRule[] {
    const active: FrameRule[] = [];
    this.fixed = [];
    for (const rule of this.rules) {
      const st = this.state.get(rule.id) ?? { active: false, since: null };
      const inPhase = !rule.phases || rule.phases.includes(ctx.phase);
      // technique rules are only trusted when the joints they talk about are clearly visible
      const visible =
        rule.severity === 'setup' ||
        rule.joints.every((j) => (f.jointVisibility[j] ?? 1) >= MIN_JOINT_VISIBILITY);
      if (inPhase && !visible) {
        // can't see the joints: the state is unknown, keep it (no false "fixed" praise, no new alarm)
        this.state.set(rule.id, { ...st, since: null });
        if (st.active) active.push(rule);
        continue;
      }
      const violating = inPhase && safeTest(rule, f, ctx);
      if (violating !== st.active) {
        st.since ??= f.t;
        const need = violating ? (rule.persistMs ?? 200) : (rule.clearMs ?? 300);
        if (f.t - st.since >= need || !inPhase) {
          // a real fix = the problem went away while the user was still in that phase
          if (st.active && !violating && inPhase) this.fixed.push(rule.id);
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
