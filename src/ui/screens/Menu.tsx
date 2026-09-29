import { useState } from 'react';
import {
  Award,
  Check,
  Hand,
  Timer,
  Dumbbell,
  Flame,
  Globe,
  ScrollText,
  Sparkles,
  Swords,
  Target,
  Trophy,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { useApp } from '@/app/store';
import { plural, t, type Lang } from '@/i18n';
import { FULL, QUICK } from '@/game/program';
import { rankFor } from '@/game/ranks';
import { dayKey, questFor } from '@/game/daily';
import { EXERCISES } from '@/exercises/registry';
import { DwellButton } from '../gestures/DwellButton';
import { Speech } from '../components/Mascot';
import { ProgressBar } from '../components/ProgressBar';
import { MirrorPip } from '../components/MirrorPip';
import { CrossArmsIcon, GameIcon } from '../components/icons';

const LANGS: Lang[] = ['ru', 'kk', 'en'];
const LANG_LABEL: Record<Lang, string> = { ru: 'Русский', kk: 'Қазақша', en: 'English' };
const ICON = { size: 30, strokeWidth: 2.75 } as const;

export function Menu() {
  const { go, startProgram, lang, setLang, muted, toggleMute, progress, playerName } = useApp();
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

  return (
    <div className="page menu">
      <div className="page-inner">
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
              {t('menu.greet')}
            </Speech>
            <div className="menu-grid">
              <DwellButton
                variant="primary"
                tone="green"
                icon={<Zap {...ICON} fill="currentColor" />}
                sub={t('menu.quickSub')}
                onSelect={() => startProgram(QUICK)}
              >
                {t('menu.quick')}
              </DwellButton>
              <DwellButton
                tone="blue"
                icon={<Dumbbell {...ICON} />}
                sub={t('menu.fullSub')}
                onSelect={() => startProgram(FULL)}
              >
                {t('menu.full')}
              </DwellButton>
              <DwellButton
                tone="purple"
                icon={<Target {...ICON} />}
                sub={t('menu.pickSub')}
                onSelect={() => go('pick')}
              >
                {t('menu.pick')}
              </DwellButton>
              <DwellButton
                tone="orange"
                icon={<Sparkles {...ICON} />}
                sub={t('menu.freeSub')}
                onSelect={() => go('free')}
              >
                {t('menu.free')}
              </DwellButton>
              <DwellButton
                tone="red"
                icon={<Swords {...ICON} />}
                sub={t('menu.challengeSub')}
                onSelect={() => go('challenge')}
              >
                {t('menu.challenge')}
              </DwellButton>
              <DwellButton
                tone="gold"
                icon={<Trophy {...ICON} />}
                sub={t('ach.title')}
                onSelect={() => go('records')}
              >
                {t('menu.records')}
              </DwellButton>
            </div>
          </section>

          <aside className="menu-side" aria-label={t('menu.you')}>
            <div className="card profile">
              <span className="avatar" aria-hidden="true">
                <GameIcon id={rank.icon} size={28} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="profile-name">{playerName}</div>
                <div className="profile-rank">
                  {t(rank.key)} · <span className="num">{progress.totalXp}</span> XP
                </div>
                {next && <ProgressBar value={rp} tone="gold" label={t(next.key)} />}
              </div>
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
            <div className="side-buttons">
              <DwellButton
                variant="ghost"
                icon={<Globe size={22} strokeWidth={2.5} />}
                sub={LANG_LABEL[lang]}
                onSelect={() => setLang(LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]!)}
              >
                {t('menu.lang')}
              </DwellButton>
              <DwellButton
                variant="ghost"
                icon={
                  muted ? (
                    <VolumeX size={22} strokeWidth={2.5} />
                  ) : (
                    <Volume2 size={22} strokeWidth={2.5} />
                  )
                }
                sub={t(muted ? 'menu.off' : 'menu.on')}
                onSelect={toggleMute}
              >
                {t('menu.sound')}
              </DwellButton>
            </div>
          </aside>
        </div>
        <footer className="gesture-help">
          <span>
            <Hand size={18} strokeWidth={2.5} /> {t('help.cursor')}
          </span>
          <span>
            <Timer size={18} strokeWidth={2.5} /> {t('help.hold')}
          </span>
          <span>
            <CrossArmsIcon size={20} /> {t('help.cross')}
          </span>
        </footer>
      </div>
    </div>
  );
}

function isRecent(lastDay: string, today: string): boolean {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  return lastDay === today || lastDay === dayKey(new Date(y, m - 1, d - 1).getTime());
}
