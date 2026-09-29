import { useEffect, useId, useRef, type ReactNode } from 'react';
import { sfx } from '@/audio/sfx';
import { useGestureApi } from './GestureProvider';

export type IconTone = 'green' | 'blue' | 'gold' | 'orange' | 'red' | 'purple' | 'plain';

interface Props {
  onSelect: () => void;
  children: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  /** coloured tile behind the icon (secondary cards) */
  tone?: IconTone;
  variant?: 'primary' | 'secondary' | 'ghost' | 'blue';
  className?: string;
  /** highlighted as the current choice (tabs) */
  active?: boolean;
}

/** Chunky 3D button "clicked" by hovering the hand cursor over it (mouse/touch click also works). */
export function DwellButton({
  onSelect,
  children,
  sub,
  icon,
  tone = 'plain',
  variant = 'secondary',
  className = '',
  active = false,
}: Props) {
  const id = useId();
  const ref = useRef<HTMLButtonElement>(null);
  const api = useGestureApi();
  const cb = useRef(onSelect);
  useEffect(() => {
    cb.current = onSelect;
  });
  useEffect(() => api.register(id, ref.current!, () => cb.current()), [api, id]);

  return (
    <button
      ref={ref}
      className={`dwell-btn dwell-${variant} ${active ? 'is-active' : ''} ${className}`}
      onClick={() => {
        sfx.select();
        cb.current();
      }}
    >
      <span className="dwell-fill" aria-hidden="true" />
      {icon && <span className={`dwell-icon tile-${tone}`}>{icon}</span>}
      <span className="dwell-text">
        <span className="dwell-label">{children}</span>
        {sub && <span className="dwell-sub">{sub}</span>}
      </span>
    </button>
  );
}
