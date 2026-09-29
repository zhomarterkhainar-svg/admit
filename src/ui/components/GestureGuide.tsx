import { Hand, MoveHorizontal } from 'lucide-react';
import { t, type I18nKey } from '@/i18n';
import { CrossArmsIcon, HandsUpIcon } from './icons';

const GESTURES: { icon: React.ReactNode; title: I18nKey; sub: I18nKey; tone: string }[] = [
  {
    icon: <HandsUpIcon size={44} strokeWidth={2} />,
    title: 'gest.handsUp',
    sub: 'gest.handsUpSub',
    tone: 'green',
  },
  {
    icon: <CrossArmsIcon size={44} strokeWidth={2} />,
    title: 'gest.cross',
    sub: 'gest.crossSub',
    tone: 'red',
  },
  {
    icon: <Hand size={36} strokeWidth={2.5} />,
    title: 'gest.cursor',
    sub: 'gest.cursorSub',
    tone: 'blue',
  },
  {
    icon: <MoveHorizontal size={36} strokeWidth={2.5} />,
    title: 'gest.swipe',
    sub: 'gest.swipeSub',
    tone: 'purple',
  },
];

/** Body gestures and what they do: a big pictogram + the action. Settings and the tour. */
export function GestureGuide({ compact = false }: { compact?: boolean }) {
  return (
    <ul className={`gesture-guide ${compact ? 'compact' : ''}`}>
      {GESTURES.map((g) => (
        <li key={g.title}>
          <span className={`gesture-pic tile-${g.tone}`} aria-hidden="true">
            {g.icon}
          </span>
          <div>
            <b>{t(g.title)}</b>
            <span>{t(g.sub)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
