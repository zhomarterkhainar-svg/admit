import type { ReactNode } from 'react';
import { mascotUrl, type Mood } from '../mascot/mascot';

/** Barys, the snow-leopard coach. `bob` adds a gentle idle bounce. */
export function Mascot({
  mood = 'happy',
  size = 120,
  bob = false,
  className = '',
}: {
  mood?: Mood;
  size?: number;
  bob?: boolean;
  className?: string;
}) {
  return (
    <img
      src={mascotUrl(mood)}
      width={size}
      height={size * 1.1}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={`mascot ${bob ? 'bob' : ''} ${className}`}
    />
  );
}

/** Mascot with a speech bubble, the way a coach talks to you. */
export function Speech({
  mood = 'happy',
  size = 96,
  children,
  className = '',
}: {
  mood?: Mood;
  size?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`speech ${className}`}>
      <Mascot mood={mood} size={size} bob />
      <div className="bubble">{children}</div>
    </div>
  );
}
