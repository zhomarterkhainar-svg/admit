import { ArrowLeft, ListOrdered } from 'lucide-react';
import { useApp } from '@/app/store';
import { t } from '@/i18n';
import { FLOOR, single } from '@/game/program';
import { FLOOR_EXERCISES, FLOOR_EXERCISE_IDS } from '@/exercises/registry';
import { DwellButton } from '../gestures/DwellButton';
import { useGestures } from '../gestures/GestureProvider';
import { GhostPreview } from '../overlay/GhostPreview';
import { FloorCameraTip } from '../components/FloorCameraTip';

/** Second mode: exercises done on the floor and filmed from the side (push-ups, plank, bridge). */
export function FloorMode() {
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
          <h1 className="h1">{t('floor.title')}</h1>
        </div>
        <FloorCameraTip className="card" />
        <div className="floor-grid">
          <DwellButton
            variant="primary"
            className="floor-program"
            icon={<ListOrdered size={30} strokeWidth={2.75} />}
            tone="green"
            sub={t('floor.programSub')}
            onSelect={() => startProgram(FLOOR)}
          >
            {t('floor.program')}
          </DwellButton>
          {FLOOR_EXERCISE_IDS.map((id) => {
            const ex = FLOOR_EXERCISES[id];
            return (
              <DwellButton
                key={id}
                className="pick-card floor-card"
                onSelect={() => startProgram(single(id))}
              >
                <GhostPreview exercise={ex} />
                {t(ex.name)}
              </DwellButton>
            );
          })}
        </div>
      </div>
    </div>
  );
}
