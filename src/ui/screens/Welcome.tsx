import { CircleAlert, Dumbbell, Hand, Lock, Sparkles } from 'lucide-react';
import { t, type I18nKey, type Lang } from '@/i18n';
import { useApp } from '@/app/store';
import type { EngineStatus } from '../hooks/usePoseEngine';
import { Mascot } from '../components/Mascot';
import { NoBreak } from '../components/NoBreak';

/** The only screen that needs a click: browsers require a user gesture for camera + audio. */
interface Props {
  status: EngineStatus;
  onStart: () => void;
  onDemo: () => void;
}

const LANGS: { id: Lang; label: string }[] = [
  { id: 'ru', label: 'RU' },
  { id: 'kk', label: 'ҚАЗ' },
  { id: 'en', label: 'EN' },
];

export function Welcome({ status, onStart, onDemo }: Props) {
  const { lang, setLang } = useApp();
  return (
    <div className="welcome">
      <header className="welcome-head">
        <div className="logo">qozğal</div>
        <div className="lang-switch" role="group" aria-label={t('welcome.langLabel')}>
          <span className="kicker">{t('welcome.langLabel')}</span>
          {LANGS.map((l) => (
            <button
              key={l.id}
              className={l.id === lang ? 'on' : ''}
              aria-pressed={l.id === lang}
              onClick={() => setLang(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </header>

      <main className="welcome-hero">
        <div className="welcome-art">
          <div className="bubble">{t('welcome.hello')}</div>
          <Mascot mood="wave" size={280} bob />
          <div className="ground" aria-hidden="true" />
        </div>

        <div className="welcome-text">
          <h1 className="welcome-title">
            <NoBreak text={t('app.tagline')} />
          </h1>
          <ul className="features">
            <li>
              <span className="dwell-icon tile-green">
                <Dumbbell size={24} strokeWidth={2.75} />
              </span>
              <div>
                <b>{t('feat.exercises')}</b>
                <span>{t('feat.exercisesSub')}</span>
              </div>
            </li>
            <li>
              <span className="dwell-icon tile-red">
                <Sparkles size={24} strokeWidth={2.75} />
              </span>
              <div>
                <b>{t('feat.errors')}</b>
                <span>{t('feat.errorsSub')}</span>
              </div>
            </li>
            <li>
              <span className="dwell-icon tile-blue">
                <Hand size={24} strokeWidth={2.75} />
              </span>
              <div>
                <b>{t('feat.gestures')}</b>
                <span>{t('feat.gesturesSub')}</span>
              </div>
            </li>
          </ul>

          <div className="cta">
            {status.state === 'idle' && (
              <>
                <button className="btn btn-big" onClick={onStart} autoFocus>
                  {t('ui.start')}
                </button>
                <button className="btn btn-white btn-big" onClick={onDemo}>
                  {t('ui.demoShort')}
                </button>
                <p className="muted">{t('ui.oneClick')}</p>
              </>
            )}
            {status.state === 'loading' && (
              <div className="loading" role="status">
                <div className="spinner" />
                <p className="lead">
                  {t(status.step === 'camera' ? 'ui.loadingCamera' : 'ui.loadingModel')}
                </p>
              </div>
            )}
            {status.state === 'error' && (
              <>
                <p className="error-box" role="alert">
                  <CircleAlert size={20} strokeWidth={2.75} />
                  {t(`ui.err.${status.kind}` as I18nKey)}
                </p>
                <button className="btn btn-big" onClick={() => location.reload()}>
                  {t('ui.retry')}
                </button>
                <button className="btn btn-white btn-big" onClick={onDemo}>
                  {t('ui.demoShort')}
                </button>
              </>
            )}
          </div>
        </div>
      </main>

      <p className="privacy">
        <Lock size={15} strokeWidth={2.75} /> {t('ui.privacy')}
      </p>
    </div>
  );
}
