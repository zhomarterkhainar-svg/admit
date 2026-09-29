import {
  Bird,
  Bot,
  BowArrow,
  CalendarCheck,
  Crosshair,
  Flame,
  Gem,
  ScrollText,
  Shield,
  Sprout,
  Target,
  Zap,
  type LucideProps,
} from 'lucide-react';
import type { GameIconId } from '@/game/icons';

type SvgProps = { size?: number; strokeWidth?: number; className?: string };

/** "100" badge for the Century achievement (no stock icon says it better). */
function Hundred({ size = 24, strokeWidth = 2.5, className }: SvgProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3.5 8.5 5.5 7v10" />
      <rect x="8.5" y="7" width="5" height="10" rx="2.5" />
      <rect x="15.5" y="7" width="5" height="10" rx="2.5" />
    </svg>
  );
}

const LUCIDE: Record<Exclude<GameIconId, 'hundred'>, React.ComponentType<LucideProps>> = {
  sprout: Sprout,
  bow: BowArrow,
  shield: Shield,
  eagle: Bird,
  gem: Gem,
  target: Target,
  flame: Flame,
  calendar: CalendarCheck,
  bot: Bot,
  zap: Zap,
  crosshair: Crosshair,
  scroll: ScrollText,
};

/** Rank / achievement pictogram. */
export function GameIcon({
  id,
  size = 24,
  strokeWidth = 2.5,
  className,
}: SvgProps & { id: GameIconId }) {
  if (id === 'hundred')
    return <Hundred size={size} strokeWidth={strokeWidth} className={className} />;
  const Icon = LUCIDE[id];
  return <Icon size={size} strokeWidth={strokeWidth} className={className} aria-hidden="true" />;
}

/** Stick figure shared by the gesture pictograms: head, body and legs. */
function Figure({
  size = 24,
  strokeWidth = 2.2,
  className,
  children,
}: SvgProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="5.2" r="2.3" />
      <path d="M12 8.5v6.5M12 15l-3 6M12 15l3 6" />
      {children}
    </svg>
  );
}

/** Gesture: both hands up (start / continue). */
export function HandsUpIcon(props: SvgProps) {
  return (
    <Figure {...props}>
      <path d="M12 10 7 4.5M12 10l5-5.5" />
    </Figure>
  );
}

/** Gesture: arms crossed in front of the chest (pause / back). */
export function CrossArmsIcon(props: SvgProps) {
  return (
    <Figure {...props}>
      <path d="M8 9.5 16 14M16 9.5 8 14" />
    </Figure>
  );
}
