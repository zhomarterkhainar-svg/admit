import { useEffect, useId, useRef, type ReactNode } from 'react';
import { sfx } from '@/audio/sfx';
import { useGestureApi } from './GestureProvider';

interface Props {
  onSelect: () => void;
  children: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
}

/** Big button "clicked" by hovering the hand cursor over it (mouse/touch click also works). */
export function DwellButton({
  onSelect,
  children,
  sub,
  icon,
  variant = 'secondary',
  className = '',
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
      className={`dwell-btn dwell-${variant} ${className}`}
      onClick={() => {
        sfx.select();
        cb.current();
      }}
    >
      <span className="dwell-fill" aria-hidden="true" />
      {icon && <span className="dwell-icon">{icon}</span>}
      <span className="dwell-text">
        <span className="dwell-label">{children}</span>
        {sub && <span className="dwell-sub">{sub}</span>}
      </span>
    </button>
  );
}
