import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/app/store';
import { t } from '@/i18n';
import { speak } from '@/audio/tts';
import { sfx } from '@/audio/sfx';
import { EXERCISES } from '@/exercises/registry';
import type { ExerciseResult } from '@/game/summary';
import type { ProgramStep } from '@/game/program';
import type { RepSummary } from '@/engine/types';
import { useDemo, useLoop } from '../engine';
import { DwellButton } from '../gestures/DwellButton';
import { useGestures } from '../gestures/GestureProvider';
import { GhostPreview } from '../overlay/GhostPreview';
import { OverlayCanvas } from '../overlay/OverlayCanvas';
import { Workout } from './Workout';

const INTRO_SEC = 7;

/** Runs a program: for each step an intro (ghost demo + countdown) then the live exercise. */
export function WorkoutFlow() {
  const loop = useLoop();
  const { program, go, finishWorkout } = useApp();
  const [idx, setIdx] = useState(0);
  const [stage, setStage] = useState<'intro' | 'active'>('intro');
  const [paused, setPaused] = useState(false);
  const results = useRef<ExerciseResult[]>([]);
  const [startedAt] = useState(() => Date.now());

  const steps = program?.steps ?? [];
  const current = steps[idx];
  const demo = useDemo();
  useEffect(() => {
    demo?.perform(stage === 'active' && !paused && current ? current.id : null);
  }, [demo, stage, paused, current]);
  useEffect(() => () => demo?.perform(null), [demo]);

  useGestures({
    crossArms: () => (stage === 'active' ? setPaused(true) : undefined),
    handsUp: () => {
      if (paused) setPaused(false);
      else if (stage === 'intro') setStage('active');
    },
  });

  if (!current) return null;

  const next = (reps: RepSummary[], activeMs: number) => {
    results.current.push({ id: current.id, target: current.target, reps, durationMs: activeMs });
    setPaused(false);
    if (idx + 1 >= steps.length) {
      finishWorkout(results.current, startedAt, Date.now());
    } else {
      setIdx(idx + 1);
      setStage('intro');
    }
  };

  const stepLabel = steps.length > 1 ? `${idx + 1} / ${steps.length}` : undefined;

  return (
    <>
      {stage === 'intro' ? (
        <Intro key={idx} step={current} label={stepLabel} onStart={() => setStage('active')} />
      ) : (
        <Workout
          key={idx}
          loop={loop}
          exercise={EXERCISES[current.id]}
          target={current.target}
          timeLimitSec={current.timeLimitSec}
          paused={paused}
          step={stepLabel}
          onDone={next}
        />
      )}
      {paused && (
        <div className="screen-dim center pause">
          <h1 className="h1">{t('pause.title')}</h1>
          <div className="menu-col">
            <DwellButton variant="primary" icon="▶" onSelect={() => setPaused(false)}>
              {t('pause.resume')}
            </DwellButton>
            <DwellButton icon="⏭" onSelect={() => next([], 0)}>
              {t('pause.skip')}
            </DwellButton>
            <DwellButton variant="ghost" icon="🏠" onSelect={() => go('menu')}>
              {t('pause.exit')}
            </DwellButton>
          </div>
        </div>
      )}
    </>
  );
}

function Intro({
  step,
  label,
  onStart,
}: {
  step: ProgramStep;
  label?: string;
  onStart: () => void;
}) {
  const loop = useLoop();
  const ex = EXERCISES[step.id];
  const [left, setLeft] = useState(INTRO_SEC);
  const startRef = useRef(onStart);
  useEffect(() => {
    startRef.current = onStart;
  });

  useEffect(() => {
    speak(`${t(ex.name)}. ${t(ex.howTo)}`);
    const started = performance.now();
    const id = setInterval(() => {
      const l = INTRO_SEC - Math.floor((performance.now() - started) / 1000);
      setLeft((prev) => {
        if (l !== prev && l <= 3 && l > 0) sfx.hint();
        return l;
      });
      if (l <= 0) {
        clearInterval(id);
        sfx.perfect();
        startRef.current();
      }
    }, 100);
    return () => clearInterval(id);
  }, [ex]);

  return (
    <>
      <OverlayCanvas loop={loop} />
      <div className="screen-dim intro">
        <div className="intro-text">
          {label && <div className="step">{label}</div>}
          <h1 className="h1">{t(ex.name)}</h1>
          <p className="lead">{t(ex.howTo)}</p>
          <p className="target">
            🎯 {step.target} × · ⏱ {step.timeLimitSec}s
          </p>
          <p className="muted">{t('intro.handsUp')}</p>
        </div>
        <div className="intro-ghost">
          <GhostPreview exercise={ex} />
        </div>
        <div className={`countdown ${left <= 3 ? 'hot' : ''}`} key={left}>
          {left > 0 ? left : t('intro.go')}
        </div>
      </div>
    </>
  );
}
