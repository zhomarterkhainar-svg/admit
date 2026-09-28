import { useApp } from '@/app/store';
import { plural, t, type Lang } from '@/i18n';
import { FULL, QUICK } from '@/game/program';
import { rankFor } from '@/game/ranks';
import { dayKey, questFor } from '@/game/daily';
import { EXERCISES } from '@/exercises/registry';
import { useState } from 'react';
import { useLoop } from '../engine';
import { DwellButton } from '../gestures/DwellButton';
import { OverlayCanvas } from '../overlay/OverlayCanvas';

const LANGS: Lang[] = ['ru', 'kk', 'en'];
const LANG_LABEL: Record<Lang, string> = { ru: 'Русский', kk: 'Қазақша', en: 'English' };

export function Menu() {
  const loop = useLoop();
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

  return (
    <>
      <OverlayCanvas loop={loop} />
      <div className="screen-dim menu">
        <header className="menu-head">
          <div className="logo">QOZĞAL</div>
          <div className="player">
            <span className="rank-icon">{rank.icon}</span>
            <div>
              <div className="player-name">{playerName}</div>
              <div className="player-rank">
                {t(rank.key)} · {progress.totalXp} XP
              </div>
              {next && (
                <div className="xp-bar">
                  <div style={{ width: `${Math.round(rp * 100)}%` }} />
                </div>
              )}
            </div>
          </div>
        </header>
        <div className="menu-status">
          {streakDays > 0 && (
            <div className="chip">
              🔥 {streakDays} {plural(streakDays, 'streak.days')}
            </div>
          )}
          <div className={`chip quest ${questDone ? 'done' : ''}`}>
            📜 {t('quest.title')}: {quest.target} × {t(EXERCISES[quest.exercise].name)}
            <span className="quest-bar">
              <span style={{ width: `${(questProgress / quest.target) * 100}%` }} />
            </span>
            {questDone ? '✓' : `${questProgress}/${quest.target}`} · +{quest.xp} XP
          </div>
          <div className="chip">
            🏅 {Object.keys(progress.achievements).length} {t('ach.title').toLowerCase()}
          </div>
        </div>
        <div className="menu-grid">
          <DwellButton
            variant="primary"
            icon="⚡"
            sub={t('menu.quickSub')}
            onSelect={() => startProgram(QUICK)}
          >
            {t('menu.quick')}
          </DwellButton>
          <DwellButton icon="🏋️" sub={t('menu.fullSub')} onSelect={() => startProgram(FULL)}>
            {t('menu.full')}
          </DwellButton>
          <DwellButton icon="🎯" sub={t('menu.pickSub')} onSelect={() => go('pick')}>
            {t('menu.pick')}
          </DwellButton>
          <DwellButton icon="🤖" sub={t('menu.freeSub')} onSelect={() => go('free')}>
            {t('menu.free')}
          </DwellButton>
          <DwellButton icon="🏹" sub={t('menu.challengeSub')} onSelect={() => go('challenge')}>
            {t('menu.challenge')}
          </DwellButton>
          <DwellButton icon="🏆" onSelect={() => go('records')}>
            {t('menu.records')}
          </DwellButton>
          <div className="menu-small">
            <DwellButton
              variant="ghost"
              icon="🌐"
              sub={LANG_LABEL[lang]}
              onSelect={() => setLang(LANGS[(LANGS.indexOf(lang) + 1) % LANGS.length]!)}
            >
              {t('menu.lang')}
            </DwellButton>
            <DwellButton
              variant="ghost"
              icon={muted ? '🔇' : '🔊'}
              sub={t(muted ? 'menu.off' : 'menu.on')}
              onSelect={toggleMute}
            >
              {t('menu.sound')}
            </DwellButton>
          </div>
        </div>
        <footer className="gesture-help">{t('menu.gestures')}</footer>
      </div>
    </>
  );
}

function isRecent(lastDay: string, today: string): boolean {
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  return lastDay === today || lastDay === dayKey(new Date(y, m - 1, d - 1).getTime());
}
