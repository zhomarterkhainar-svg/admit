import { ArrowLeft } from 'lucide-react';
import { useApp } from '@/app/store';
import { t } from '@/i18n';
import { single } from '@/game/program';
import { EXERCISES, EXERCISE_IDS } from '@/exercises/registry';
import { DwellButton } from '../gestures/DwellButton';
import { useGestures } from '../gestures/GestureProvider';
import { GhostPreview } from '../overlay/GhostPreview';
import { Speech } from '../components/Mascot';

export function ExercisePicker() {
  const { go, startProgram } = useApp();
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
          <h1 className="h1">{t('pick.title')}</h1>
        </div>
        <Speech mood="happy" size={64}>
          {t('menu.pickSub')}
        </Speech>
        <div className="pick-grid">
          {EXERCISE_IDS.map((id) => (
            <DwellButton key={id} className="pick-card" onSelect={() => startProgram(single(id))}>
              <GhostPreview exercise={EXERCISES[id]} />
              {t(EXERCISES[id].name)}
            </DwellButton>
          ))}
        </div>
      </div>
    </div>
  );
}
