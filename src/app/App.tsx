import { useRef, useState } from 'react';
import { usePoseEngine } from '@/ui/hooks/usePoseEngine';
import { DemoContext, EngineContext } from '@/ui/engine';
import { GestureProvider } from '@/ui/gestures/GestureProvider';
import { LiveDebug } from '@/ui/screens/LiveDebug';
import { Calibration } from '@/ui/screens/Calibration';
import { Menu } from '@/ui/screens/Menu';
import { ExercisePicker } from '@/ui/screens/ExercisePicker';
import { WorkoutFlow } from '@/ui/screens/WorkoutFlow';
import { Results } from '@/ui/screens/Results';
import { Records } from '@/ui/screens/Records';
import { Welcome } from '@/ui/screens/Welcome';
import { Challenge, ChallengeResults } from '@/ui/screens/Challenge';
import { FreeWorkout } from '@/ui/screens/FreeWorkout';
import { unlockAudio } from '@/audio/sfx';
import { DemoActor } from '@/demo/DemoActor';
import { QUICK } from '@/game/program';
import type { PoseSource } from '@/core/vision/poseLoop';
import { t } from '@/i18n';
import { useApp, type Screen } from './store';

const DEV = new URLSearchParams(location.search).has('dev');

const SCREENS: Record<Screen, () => React.ReactNode> = {
  calibration: Calibration,
  menu: Menu,
  pick: ExercisePicker,
  workout: WorkoutFlow,
  free: FreeWorkout,
  results: Results,
  challenge: Challenge,
  challengeResults: ChallengeResults,
  records: Records,
};

export function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { status, start } = usePoseEngine(videoRef);
  const [demo, setDemo] = useState<DemoActor | null>(null);
  const screen = useApp((s) => s.screen);
  useApp((s) => s.lang); // re-render all screens on language change
  const Current = SCREENS[screen];

  const source: PoseSource | null = demo ?? (status.state === 'ready' ? status.loop : null);

  const startDemo = () => {
    unlockAudio();
    const actor = new DemoActor();
    actor.start();
    setDemo(actor);
    useApp.getState().startProgram(QUICK);
  };

  return (
    <main className={`screen ${demo ? 'demo' : ''}`}>
      <video ref={videoRef} className="camera" playsInline muted />
      {source ? (
        <EngineContext.Provider value={source}>
          <DemoContext.Provider value={demo}>
            {DEV && status.state === 'ready' ? (
              <LiveDebug
                loop={source}
                info={`${status.tracker.model}/${status.tracker.delegate}`}
              />
            ) : (
              <GestureProvider loop={source} enabled={!demo}>
                <Current key={screen} />
              </GestureProvider>
            )}
            {demo && (
              <div className="demo-badge">
                {t('ui.demoBadge')}
                <button className="btn-link" onClick={() => location.reload()}>
                  {t('ui.demoExit')}
                </button>
              </div>
            )}
          </DemoContext.Provider>
        </EngineContext.Provider>
      ) : (
        <Welcome
          status={status}
          onStart={() => {
            unlockAudio();
            void start();
          }}
          onDemo={startDemo}
        />
      )}
    </main>
  );
}
