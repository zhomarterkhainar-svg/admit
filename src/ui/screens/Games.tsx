import type { ReactNode } from 'react';
import { ArrowLeft, Music, Swords, Users } from 'lucide-react';
import { useApp, type Screen } from '@/app/store';
import { t, type I18nKey } from '@/i18n';
import { DwellButton } from '../gestures/DwellButton';
import { useGestures } from '../gestures/GestureProvider';
import { Speech } from '../components/Mascot';
import type { IconTone } from '../gestures/DwellButton';

interface GameCard {
  screen: Screen;
  title: I18nKey;
  sub: I18nKey;
  icon: ReactNode;
  tone: IconTone;
  isNew?: boolean;
}

const ICON = { size: 44, strokeWidth: 2.5 } as const;

export const GAMES: GameCard[] = [
  {
    screen: 'challenge',
    title: 'menu.challenge',
    sub: 'menu.challengeSub',
    icon: <Swords {...ICON} />,
    tone: 'red',
  },
  {
    screen: 'duel',
    title: 'duel.title',
    sub: 'duel.sub',
    icon: <Users {...ICON} />,
    tone: 'blue',
    isNew: true,
  },
  {
    screen: 'dance',
    title: 'dance.title',
    sub: 'dance.sub',
    icon: <Music {...ICON} />,
    tone: 'purple',
    isNew: true,
  },
];

/** The game modes in one place: Batyr Challenge, the two-player duel, the rhythm dance. */
export function Games() {
  const { go } = useApp();
  useGestures({ crossArms: () => go('menu') });
  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-head">
          <DwellButton
            variant="ghost"
            icon={<ArrowLeft size={22} strokeWidth={2.75} />}
            onSelect={() => go('menu')}
          >
            {t('back')}
          </DwellButton>
          <h1 className="h1">{t('games.title')}</h1>
        </div>
        <Speech mood="cheer" size={64}>
          {t('games.greet')}
        </Speech>
        <div className="games-grid" style={{ '--n': GAMES.length } as React.CSSProperties}>
          {GAMES.map((g) => (
            <div key={g.screen} className="tile-wrap">
              <DwellButton
                className="game-card"
                tone={g.tone}
                icon={g.icon}
                sub={t(g.sub)}
                onSelect={() => go(g.screen)}
              >
                {t(g.title)}
              </DwellButton>
              {g.isNew && <span className="start-here">{t('games.new')}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
