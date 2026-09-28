import { t, type I18nKey } from '@/i18n';
import type { EngineStatus } from '../hooks/usePoseEngine';

/** The only screen that needs a click: browsers require a user gesture for camera + audio. */
export function Welcome({ status, onStart }: { status: EngineStatus; onStart: () => void }) {
  return (
    <div className="screen center layer welcome">
      <div className="ornament" aria-hidden="true" />
      <h1 className="title">QOZĞAL</h1>
      <p className="subtitle">{t('app.tagline')}</p>
      {status.state === 'idle' && (
        <>
          <button className="btn-primary" onClick={onStart} autoFocus>
            {t('ui.start')}
          </button>
          <p className="muted">{t('ui.oneClick')}</p>
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
        </>
      )}
      <p className="privacy">{t('ui.privacy')}</p>
    </div>
  );
}
