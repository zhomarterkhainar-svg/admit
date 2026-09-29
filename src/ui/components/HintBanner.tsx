import {
  CircleAlert,
  CircleCheck,
  Lightbulb,
  ScanFace,
  TriangleAlert,
  Timer,
  X,
} from 'lucide-react';
import type { Hint, Severity } from '@/engine/types';
import { t, type I18nKey } from '@/i18n';
import type { Mood } from '../mascot/mascot';
import { Mascot } from './Mascot';

const LOOK: Record<Severity, { mood: Mood; icon: typeof CircleAlert }> = {
  setup: { mood: 'think', icon: ScanFace },
  safety: { mood: 'oops', icon: TriangleAlert },
  validity: { mood: 'oops', icon: X },
  form: { mood: 'oops', icon: CircleAlert },
  tempo: { mood: 'think', icon: Timer },
};

/**
 * Error-mode feedback, Duolingo style: the coach reacts, a coloured kicker says what kind of
 * problem it is, then WHAT is wrong and HOW to fix it. Green variant praises a fixed mistake.
 */
export function HintBanner({
  hint,
  praise = false,
  className = '',
}: {
  hint: Hint | null;
  praise?: boolean;
  className?: string;
}) {
  if (!hint && !praise) return null;
  if (!hint)
    return (
      <div className={`feedback tone-ok ${className}`} role="status">
        <Mascot mood="cheer" size={76} />
        <div className="feedback-body">
          <div className="feedback-kicker">
            <CircleCheck size={18} strokeWidth={3} /> {t('sev.ok')}
          </div>
          <div className="feedback-title">{t('praise.fixed')}</div>
        </div>
      </div>
    );
  const look = LOOK[hint.severity];
  const Icon = look.icon;
  return (
    <div className={`feedback tone-${hint.severity} ${className}`} key={hint.id} role="alert">
      <Mascot mood={look.mood} size={76} />
      <div className="feedback-body">
        <div className="feedback-kicker">
          <Icon size={18} strokeWidth={3} /> {t(`sev.${hint.severity}` as I18nKey)}
        </div>
        <div className="feedback-title">{t(hint.message)}</div>
        <div className="feedback-fix">
          <Lightbulb size={20} strokeWidth={2.5} /> {t(hint.fix)}
        </div>
      </div>
    </div>
  );
}
