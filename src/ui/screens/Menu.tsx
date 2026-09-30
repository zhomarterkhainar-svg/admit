import { useState } from 'react';
import {
  Award,
  BicepsFlexed,
  Check,
  ChevronRight,
  Dumbbell,
  Flame,
  ScrollText,
  Settings,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';
import { useApp } from '@/app/store';
import { plural, t } from '@/i18n';
import { FULL, QUICK } from '@/game/program';
import { rankFor } from '@/game/ranks';
import { dayKey, questFor } from '@/game/daily';
import { EXERCISES } from '@/exercises/registry';
import { DwellButton } from '../gestures/DwellButton';
import { Speech } from '../components/Mascot';
import { ProgressBar } from '../components/ProgressBar';
import { MirrorPip } from '../components/MirrorPip';
import { CrossArmsIcon, GameIcon, HandsUpIcon } from '../components/icons';
import { Tour } from '../components/Tour';
import { Hand } from 'lucide-react';

const ICON = { size: 30, strokeWidth: 2.75 } as const;

export function Menu() {
  const { go, startProgram, progress, playerName, tutorial } = useApp();
  const { rank, next, progress: rp } = rankFor(progress.totalXp);
  const [today] = useState(() => dayKey(Date.now()));
  const quest = questFor(today);
  const questState = progress.quest?.day === today ? progress.quest : null;
  const questProgress = questState?.progress ?? 0;
  const questDone = questState?.done ?? false;
  // a streak only counts if it reached today or yesterday
  const streakDays =
    progress.streak.lastDay && isRecent(progress.streak.lastDay, today) ? progress.streak.days : 0;
  const achCount = Object.keys(progress.achievements).length;
  // until the first workout is done, the quick workout is marked as the place to start
  const newbie = progress.stats.workouts === 0;

  return (
    <div className="page menu">
      <div className="page-inner" aria-hidden={tutorial || undefined} inert={tutorial || undefined}>
        <header className="topbar">
          <div className="logo">qozğal</div>
          <div className="stats-row">
            <span
              className={`chip ${streakDays ? 'chip-orange' : ''}`}
              title={`${streakDays} ${plural(streakDays, 'streak.days')}`}
            >
              <Flame size={24} strokeWidth={2.5} fill={streakDays ? 'currentColor' : 'none'} />
              <span className="num">{streakDays}</span>
            </span>
            <span className="chip chip-gold" title={t('results.xp')}>
              <Zap size={24} strokeWidth={2.5} fill="currentColor" />
              <span className="num">{progress.totalXp} XP</span>
            </span>
            <span className="chip chip-purple" title={t('ach.title')}>
              <Award size={24} strokeWidth={2.5} />
              <span className="num">
                {achCount} {plural(achCount, 'ach.count')}
              </span>
            </span>
          </div>
        </header>

        <div className="menu-layout">
          <section className="menu-main" aria-label={t('menu.modes')}>
            <Speech mood="wave" size={72} className="menu-greet">
              {t(newbie ? 'menu.greetNew' : 'menu.greet')}
            </Speech>
            <div className="menu-grid">
              <div className="tile-wrap" data-tour="training">
                <DwellButton
                  variant="primary"
                  tone="green"
                  icon={<Zap {...ICON} fill="currentColor" />}
                  sub={t('menu.quickSub')}
                  onSelect={() => startProgram(QUICK)}
                >
                  {t('menu.quick')}
                </DwellButton>
                {newbie && <span className="start-here">{t('menu.startHere')}</span>}
              </div>
              <div className="tile-wrap" data-tour="training">
                <DwellButton
                  tone="blue"
                  icon={<Dumbbell {...ICON} />}
                  sub={t('menu.fullSub')}
                  onSelect={() => startProgram(FULL)}
                >
                  {t('menu.full')}
                </DwellButton>
              </div>
              <div className="tile-wrap" data-tour="games">
                <DwellButton
                  tone="red"
                  icon={<Swords {...ICON} />}
                  sub={t('menu.gamesSub')}
                  onSelect={() => go('games')}
                >
                  {t('menu.games')}
                </DwellButton>
                {!newbie && <span className="start-here">{t('games.new')}</span>}
              </div>
              <div className="tile-wrap" data-tour="records">
                <DwellButton
                  tone="gold"
                  icon={<Trophy {...ICON} />}
                  sub={t('menu.recordsSub')}
                  onSelect={() => go('records')}
                >
                  {t('menu.records')}
                </DwellButton>
              </div>
              <div className="tile-wrap" data-tour="modes">
                <DwellButton
                  tone="purple"
                  icon={<Target {...ICON} />}
                  sub={t('menu.pickSub')}
                  onSelect={() => go('pick')}
                >
                  {t('menu.pick')}
                </DwellButton>
              </div>
              <div className="tile-wrap" data-tour="modes">
                <DwellButton
                  tone="orange"
                  icon={<Sparkles {...ICON} />}
                  sub={t('menu.freeSub')}
                  onSelect={() => go('free')}
                >
                  {t('menu.free')}
                </DwellButton>
              </div>
              <div className="tile-wrap" data-tour="modes">
                <DwellButton
                  tone="blue"
                  icon={<BicepsFlexed {...ICON} />}
                  sub={t('menu.floorSub')}
                  onSelect={() => go('floor')}
                >
                  {t('menu.floor')}
                </DwellButton>
              </div>

              <div className="tile-wrap" data-tour="settings">
                <DwellButton
                  tone="plain"
                  icon={<Settings {...ICON} />}
                  sub={t('menu.settingsSub')}
                  onSelect={() => go('settings')}
                >
                  {t('menu.settings')}
                </DwellButton>
              </div>
            </div>
          </section>

          <aside className="menu-side" aria-label={t('menu.you')}>
            <div data-tour="profile">
              <DwellButton className="profile-btn" onSelect={() => go('profile')}>
                <span className="profile">
                  <span className="avatar" aria-hidden="true">
                    <GameIcon id={rank.icon} size={28} />
                  </span>
                  <span className="profile-text">
                    <span className="profile-name">{playerName}</span>
                    <span className="profile-rank">
                      {t(rank.key)} · <span className="num">{progress.totalXp}</span> XP
                    </span>
                    {next && <ProgressBar value={rp} tone="gold" label={t(next.key)} />}
                  </span>
                  <ChevronRight className="profile-go" size={24} strokeWidth={3} />
                </span>
              </DwellButton>
            </div>
            <div className={`card quest ${questDone ? 'done' : ''}`}>
              <h2>
                <ScrollText size={22} strokeWidth={2.5} color="var(--orange)" /> {t('quest.title')}
              </h2>
              <div>
                {quest.target} × {t(EXERCISES[quest.exercise].name)}
              </div>
              <div className="quest-row">
                <ProgressBar
                  value={questDone ? 1 : questProgress / quest.target}
                  tone={questDone ? 'green' : 'gold'}
                />
                <span className="quest-count num">
                  {questDone ? (
                    <Check size={18} strokeWidth={3.5} />
                  ) : (
                    `${questProgress}/${quest.target}`
                  )}
                </span>
              </div>
              <div className="chip chip-gold" style={{ padding: 0 }}>
                <Zap size={18} strokeWidth={2.5} fill="currentColor" /> +{quest.xp} XP
              </div>
            </div>
            <MirrorPip />
          </aside>
        </div>
        <footer className="gesture-help">
          <span>
            <Hand size={18} strokeWidth={2.5} /> {t('help.cursor')}
          </span>
          <span>
            <HandsUpIcon size={20} /> {t('gest.handsUp')}
          </span>
          <span>
            <CrossArmsIcon size={20} /> {t('help.cross')}
          </span>
        </footer>
      </div>
      {tutorial && <Tour />}
    </div>
  );
}

function isRecent(lastDay: string, today: string): boolean {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  return lastDay === today || lastDay === dayKey(new Date(y, m - 1, d - 1).getTime());
}
