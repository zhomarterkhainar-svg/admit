/** Thick rounded progress bar with a glossy highlight. `value` is 0..1. */
export function ProgressBar({
  value,
  tone = 'green',
  className = '',
  label,
}: {
  value: number;
  tone?: 'green' | 'gold' | 'blue' | 'orange' | 'red';
  className?: string;
  label?: string;
}) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div
      className={`pbar tone-${tone} ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
    >
      <div className="pbar-fill" style={{ width: `${pct}%`, minWidth: pct ? undefined : 0 }} />
    </div>
  );
}
