import { useRef } from 'react';
import { usePoseEngine } from '@/ui/hooks/usePoseEngine';
import { EngineContext } from '@/ui/engine';
import { GestureProvider } from '@/ui/gestures/GestureProvider';
import { LiveDebug } from '@/ui/screens/LiveDebug';
import { Calibration } from '@/ui/screens/Calibration';
import { Menu } from '@/ui/screens/Menu';
import { ExercisePicker } from '@/ui/screens/ExercisePicker';
import { WorkoutFlow } from '@/ui/screens/WorkoutFlow';
import { Results } from '@/ui/screens/Results';
import { Records } from '@/ui/screens/Records';
import { Welcome } from '@/ui/screens/Welcome';
import { unlockAudio } from '@/audio/sfx';
import { useApp, type Screen } from './store';

const DEV = new URLSearchParams(location.search).has('dev');

const SCREENS: Record<Screen, () => React.ReactNode> = {
  calibration: Calibration,
  menu: Menu,
  pick: ExercisePicker,
  workout: WorkoutFlow,
  results: Results,
  challenge: Menu,
  challengeResults: Menu,
  records: Records,
};

export function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { status, start } = usePoseEngine(videoRef);
  const screen = useApp((s) => s.screen);
  useApp((s) => s.lang); // re-render all screens on language change
  const Current = SCREENS[screen];

  return (
    <main className="screen">
      <video ref={videoRef} className="camera" playsInline muted />
      {status.state === 'ready' ? (
        <EngineContext.Provider value={status.loop}>
          {DEV ? (
            <LiveDebug
              loop={status.loop}
              info={`${status.tracker.model}/${status.tracker.delegate}`}
            />
          ) : (
            <GestureProvider loop={status.loop}>
              <Current key={screen} />
            </GestureProvider>
          )}
        </EngineContext.Provider>
      ) : (
        <Welcome
          status={status}
          onStart={() => {
            unlockAudio();
            void start();
          }}
        />
      )}
    </main>
  );
}
