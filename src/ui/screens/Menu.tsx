import { useApp } from '@/app/store';
import { t, type Lang } from '@/i18n';
import { FULL, QUICK } from '@/game/program';
import { rankFor } from '@/game/ranks';
import { useLoop } from '../engine';
import { DwellButton } from '../gestures/DwellButton';
import { OverlayCanvas } from '../overlay/OverlayCanvas';

const LANGS: Lang[] = ['ru', 'kk', 'en'];
const LANG_LABEL: Record<Lang, string> = { ru: 'Русский', kk: 'Қазақша', en: 'English' };

export function Menu() {
  const loop = useLoop();
  const { go, startProgram, lang, setLang, muted, toggleMute, progress, playerName } = useApp();
  const { rank, next, progress: rp } = rankFor(progress.totalXp);

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
