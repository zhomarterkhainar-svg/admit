import type { ReactNode } from 'react';

/** Duolingo-style stat tile: coloured label strip on top, big value inside. */
export function StatBox({
  label,
  value,
  sub,
  icon,
  color = 'green',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  color?: 'green' | 'gold' | 'blue' | 'purple' | 'orange' | 'red';
}) {
  return (
    <div className={`statbox c-${color}`}>
      <div className="statbox-label">{label}</div>
      <div className="statbox-body">
        {icon}
        <div>
          {value}
          {sub && <span className="statbox-sub">{sub}</span>}
        </div>
      </div>
    </div>
  );
}
