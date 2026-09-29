import { t, type I18nKey } from '@/i18n';

/**
 * Vertical movement meter at the side of the camera view: how deep the current rep goes,
 * with the gold line marking "deep enough". Shared by workouts and the Batyr Challenge.
 */
export function DepthMeter({
  value,
  label = 'workout.depth',
  className = '',
}: {
  /** 0..1 */
  value: number;
  label?: I18nKey;
  className?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className={`depth-meter ${pct >= 85 ? 'reached' : ''} ${className}`} aria-hidden="true">
      <div className="depth-track">
        <div className="depth-fill" style={{ height: `${pct}%` }} />
        <div className="depth-goal" />
      </div>
      <span className="kicker">{t(label)}</span>
    </div>
  );
}
