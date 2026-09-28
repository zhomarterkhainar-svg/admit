import { useApp } from '@/app/store';
import { t } from '@/i18n';
import { single } from '@/game/program';
import { EXERCISES, EXERCISE_IDS } from '@/exercises/registry';
import { useLoop } from '../engine';
import { DwellButton } from '../gestures/DwellButton';
import { useGestures } from '../gestures/GestureProvider';
import { GhostPreview } from '../overlay/GhostPreview';
import { OverlayCanvas } from '../overlay/OverlayCanvas';

export function ExercisePicker() {
  const loop = useLoop();
  const { go, startProgram } = useApp();
  useGestures({ crossArms: () => go('menu') });

  return (
    <>
      <OverlayCanvas loop={loop} />
      <div className="screen-dim menu">
        <h1 className="h1">{t('pick.title')}</h1>
        <div className="pick-grid">
          {EXERCISE_IDS.map((id) => (
            <DwellButton key={id} className="pick-card" onSelect={() => startProgram(single(id))}>
              <GhostPreview exercise={EXERCISES[id]} />
              {t(EXERCISES[id].name)}
            </DwellButton>
          ))}
        </div>
        <DwellButton variant="ghost" icon="←" onSelect={() => go('menu')}>
          {t('back')}
        </DwellButton>
      </div>
    </>
  );
}
