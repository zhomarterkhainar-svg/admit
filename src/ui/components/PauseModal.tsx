import type { ReactNode } from 'react';
import { House, Play } from 'lucide-react';
import { t } from '@/i18n';
import { DwellButton } from '../gestures/DwellButton';
import { Mascot } from './Mascot';

/** Shared pause dialog (workout, free workout, challenge). */
export function PauseModal({
  onResume,
  onExit,
  extra,
}: {
  onResume: () => void;
  onExit: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="modal">
      <div className="modal-card">
        <Mascot mood="think" size={96} />
        <h1 className="h1">{t('pause.title')}</h1>
        <p className="lead">{t('pause.sub')}</p>
        <div className="menu-col">
          <DwellButton
            variant="primary"
            icon={<Play size={22} strokeWidth={2.75} fill="currentColor" />}
            onSelect={onResume}
          >
            {t('pause.resume')}
          </DwellButton>
          {extra}
          <DwellButton
            variant="ghost"
            icon={<House size={20} strokeWidth={2.75} />}
            onSelect={onExit}
          >
            {t('pause.exit')}
          </DwellButton>
        </div>
      </div>
    </div>
  );
}
