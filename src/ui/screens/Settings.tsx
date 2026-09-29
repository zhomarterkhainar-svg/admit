import { useState } from 'react';
import { ArrowLeft, CircleHelp, Globe, ScanFace, Volume2, VolumeX } from 'lucide-react';
import { useApp } from '@/app/store';
import { t, type Lang } from '@/i18n';
import { sfx } from '@/audio/sfx';
import { useLoop } from '../engine';
import { DwellButton } from '../gestures/DwellButton';
import { useGestures } from '../gestures/GestureProvider';
import { GestureGuide } from '../components/GestureGuide';

const LANGS: { id: Lang; label: string }[] = [
  { id: 'ru', label: 'Русский' },
  { id: 'kk', label: 'Қазақша' },
  { id: 'en', label: 'English' },
];

/** Language, sound, the body gestures cheat sheet, the tour again, "a new player stepped in". */
export function Settings() {
  const { go, lang, setLang, muted, toggleMute, openTutorial } = useApp();
  const loop = useLoop();
  const [relocked, setRelocked] = useState(false);
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
          <h1 className="h1">{t('settings.title')}</h1>
        </div>

        <div className="settings-grid">
          <section className="card settings-gestures">
            <h2>{t('settings.gestures')}</h2>
            <GestureGuide />
          </section>

          <div className="settings-side">
            <section className="card">
              <h2>
                <Globe size={20} strokeWidth={2.75} color="var(--blue)" /> {t('menu.lang')}
              </h2>
              <div className="settings-row">
                {LANGS.map((l) => (
                  <DwellButton
                    key={l.id}
                    variant="ghost"
                    active={l.id === lang}
                    onSelect={() => setLang(l.id)}
                  >
                    {l.label}
                  </DwellButton>
                ))}
              </div>
            </section>
            <section className="card">
              <h2>
                {muted ? (
                  <VolumeX size={20} strokeWidth={2.75} color="var(--ink-3)" />
                ) : (
                  <Volume2 size={20} strokeWidth={2.75} color="var(--green)" />
                )}{' '}
                {t('menu.sound')}
              </h2>
              <div className="settings-row">
                <DwellButton variant="ghost" active={!muted} onSelect={() => muted && toggleMute()}>
                  {t('menu.on')}
                </DwellButton>
                <DwellButton variant="ghost" active={muted} onSelect={() => !muted && toggleMute()}>
                  {t('menu.off')}
                </DwellButton>
              </div>
            </section>
            {loop.resetLock && (
              <DwellButton
                icon={<ScanFace size={24} strokeWidth={2.5} />}
                tone="orange"
                sub={t(relocked ? 'settings.relocked' : 'settings.relockSub')}
                onSelect={() => {
                  loop.resetLock?.();
                  sfx.perfect();
                  setRelocked(true);
                }}
              >
                {t('settings.relock')}
              </DwellButton>
            )}
            <DwellButton
              icon={<CircleHelp size={24} strokeWidth={2.5} />}
              tone="green"
              sub={t('settings.tourSub')}
              onSelect={openTutorial}
            >
              {t('settings.tour')}
            </DwellButton>
          </div>
        </div>
      </div>
    </div>
  );
}
