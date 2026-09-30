import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/app/store';
import { t } from '@/i18n';
import { speak } from '@/audio/tts';
import { sfx } from '@/audio/sfx';
import { ALL_EXERCISES } from '@/exercises/registry';
import type { ExerciseResult } from '@/game/summary';
import type { ProgramStep } from '@/game/program';
import type { RepSummary } from '@/engine/types';
import type { Replay } from '@/game/replay';
import { useDemo, useLoop } from '../engine';
import { DwellButton } from '../gestures/DwellButton';
import { useGestures } from '../gestures/GestureProvider';
import { GhostPreview } from '../overlay/GhostPreview';
import { Workout } from './Workout';
import { PoseCompare } from '../components/PoseCompare';
import { ERROR_EXAMPLES } from '@/exercises/errorExamples';
import { Lightbulb, SkipForward, Target, Timer } from 'lucide-react';
import { Speech } from '../components/Mascot';
import { PauseModal } from '../components/PauseModal';
import { HandsUpIcon } from '../components/icons';
import { FloorCameraTip } from '../components/FloorCameraTip';
import { ExitButton } from '../components/ExitButton';

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

  const next = (reps: RepSummary[], activeMs: number, replay: Replay | null = null) => {
    results.current.push({
      id: current.id,
      target: current.target,
      reps,
      durationMs: activeMs,
      ...(replay ? { replay } : {}),
    });
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
        <Intro
          key={idx}
          step={current}
          label={stepLabel}
          index={idx}
          total={steps.length}
          onStart={() => setStage('active')}
        />
      ) : (
        <Workout
          key={idx}
          loop={loop}
          exercise={ALL_EXERCISES[current.id]}
          target={current.target}
          timeLimitSec={current.timeLimitSec}
          paused={paused}
          step={stepLabel}
          onDone={next}
        />
      )}
      {paused && (
        <PauseModal
          onResume={() => setPaused(false)}
          onExit={() => go('menu')}
          extra={
            <DwellButton
              icon={<SkipForward size={22} strokeWidth={2.75} />}
              onSelect={() => next([], 0)}
            >
              {t('pause.skip')}
            </DwellButton>
          }
        />
      )}
    </>
  );
}

function Intro({
  step,
  label,
  index,
  total,
  onStart,
}: {
  step: ProgramStep;
  label?: string;
  index: number;
  total: number;
  onStart: () => void;
}) {
  const ex = ALL_EXERCISES[step.id];
  const mistakes = [...ex.repRules, ...ex.frameRules]
    .filter((r) => ERROR_EXAMPLES[r.id])
    .slice(0, 2);
  const [left, setLeft] = useState(INTRO_SEC);
  const startRef = useRef(onStart);
  useEffect(() => {
    startRef.current = onStart;
  });

  useEffect(() => {
    speak((tr) => `${tr(ex.name)}. ${tr(ex.howTo)}`);
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
    <div className="page">
      <div className="page-inner">
        <div className="intro">
          <div className="intro-text">
            {total > 1 && (
              <div className="steps" aria-label={label}>
                {Array.from({ length: total }, (_, i) => (
                  <span key={i} className={i < index ? 'done' : i === index ? 'now' : ''} />
                ))}
              </div>
            )}
            <div className="intro-title">
              <ExitButton onExit={() => useApp.getState().go('menu')} />
              <h1 className="h1">{t(ex.name)}</h1>
            </div>
            <Speech mood="happy" size={84}>
              {t(ex.howTo)}
            </Speech>
            <div className="target-row">
              <span className="pill">
                <Target size={18} strokeWidth={2.75} color="var(--green)" /> {step.target}{' '}
                {ex.hold ? t('workout.sec') : '×'}
              </span>
              <span className="pill">
                <Timer size={18} strokeWidth={2.75} color="var(--blue)" /> {step.timeLimitSec} s
              </span>
            </div>
            {ex.posture === 'floor' && <FloorCameraTip />}
            {mistakes.length > 0 && (
              <div className="intro-mistakes">
                <div className="kicker">{t('intro.mistakes')}</div>
                {mistakes.map((r) => (
                  <div key={r.id} className="intro-mistake">
                    <PoseCompare ruleId={r.id} joints={r.joints} />
                    <div>
                      <b>{t(r.message)}</b>
                      <div className="fix">
                        <Lightbulb size={16} strokeWidth={2.75} /> {t(r.fix)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="hands-hint">
              <HandsUpIcon size={22} /> {t('intro.handsUp')}
            </p>
          </div>
          <div className="intro-ghost">
            <span className="kicker">{t('workout.coach')}</span>
            <GhostPreview exercise={ex} />
            <div className={`countdown num ${left <= 3 ? 'hot' : ''}`} key={left}>
              {left > 0 ? left : t('intro.go')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
