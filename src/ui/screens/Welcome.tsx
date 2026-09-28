import { t, type I18nKey, type Lang } from '@/i18n';
import { useApp } from '@/app/store';
import type { EngineStatus } from '../hooks/usePoseEngine';

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
    <div className="screen center layer welcome">
      <div className="lang-switch" role="group" aria-label="language">
        {LANGS.map((l) => (
          <button key={l.id} className={l.id === lang ? 'on' : ''} onClick={() => setLang(l.id)}>
            {l.label}
          </button>
        ))}
      </div>
      <div className="ornament" aria-hidden="true" />
      <h1 className="title">QOZĞAL</h1>
      <p className="subtitle">{t('app.tagline')}</p>
      <ul className="features">
        <li>
          <b>🏋️ {t('feat.exercises')}</b>
          <span>{t('feat.exercisesSub')}</span>
        </li>
        <li>
          <b>🎯 {t('feat.errors')}</b>
          <span>{t('feat.errorsSub')}</span>
        </li>
        <li>
          <b>✋ {t('feat.gestures')}</b>
          <span>{t('feat.gesturesSub')}</span>
        </li>
      </ul>
      {status.state === 'idle' && (
        <>
          <button className="btn-primary" onClick={onStart} autoFocus>
            {t('ui.start')}
          </button>
          <p className="muted">{t('ui.oneClick')}</p>
          <button className="btn-link" onClick={onDemo}>
            {t('ui.demo')}
          </button>
        </>
      )}
      {status.state === 'loading' && (
        <div className="loading">
          <div className="spinner" />
          <p className="subtitle">
            {t(status.step === 'camera' ? 'ui.loadingCamera' : 'ui.loadingModel')}
          </p>
        </div>
      )}
      {status.state === 'error' && (
        <>
          <p className="error">{t(`ui.err.${status.kind}` as I18nKey)}</p>
          <button className="btn-primary" onClick={() => location.reload()}>
            {t('ui.retry')}
          </button>
          <button className="btn-link" onClick={onDemo}>
            {t('ui.demo')}
          </button>
        </>
      )}
      <p className="privacy">{t('ui.privacy')}</p>
    </div>
  );
}
