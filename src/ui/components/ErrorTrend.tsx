import { ArrowDown, ArrowUp, History, Minus } from 'lucide-react';
import { t } from '@/i18n';

const pct = (v: number) => `${Math.round(v * 100)}%`;
/** changes smaller than this are "about the same" */
const SAME = 0.03;

/**
 * "was 40% → now 10% ↓" for one technique error (share of the exercise's reps with it).
 * Green arrow down = fewer mistakes, red arrow up = more. `before` null = first time seen.
 */
export function ErrorTrend({
  before,
  now,
  labels = ['progress.was', 'progress.now'],
}: {
  before: number | null;
  now: number | null;
  labels?: ['progress.was' | 'progress.first', 'progress.now' | 'progress.last'];
}) {
  if (before === null || now === null)
    return (
      <span className="err-trend first">
        <History size={15} strokeWidth={2.75} /> {t('progress.remember')}
      </span>
    );
  const d = now - before;
  const dir = d < -SAME ? 'down' : d > SAME ? 'up' : 'same';
  const Icon = dir === 'down' ? ArrowDown : dir === 'up' ? ArrowUp : Minus;
  return (
    <span className={`err-trend ${dir}`}>
      {t(labels[0])} <b className="num">{pct(before)}</b> → {t(labels[1])}{' '}
      <b className="num">{pct(now)}</b>
      <Icon size={16} strokeWidth={3} />
    </span>
  );
}
