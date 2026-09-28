import { useEffect, useMemo, useRef, useState } from 'react';
import type { PoseLoop } from '@/core/vision/poseLoop';
import { ExerciseRunner, type RunnerState } from '@/engine/runner';
import type { ExerciseDefinition, Hint, RepSummary } from '@/engine/types';
import { t } from '@/i18n';
import { speak } from '@/audio/tts';
import { sfx } from '@/audio/sfx';
import { OverlayCanvas } from '../overlay/OverlayCanvas';
import { drawArrow } from '../overlay/drawArrow';

interface Props<M> {
  loop: PoseLoop;
  exercise: ExerciseDefinition<M>;
  target: number;
  timeLimitSec: number;
  paused: boolean;
  /** called once when the target is reached or time runs out */
  onDone: (reps: RepSummary[], activeMs: number) => void;
  /** step label, e.g. "2 / 5" */
  step?: string;
}

type Flash = { kind: 'perfect' | 'good' | 'miss'; key: number } | null;

/** Live exercise HUD: rep counter, phase bar, one coaching hint, red joints + arrows, voice, timer. */
export function Workout<M>({
  loop,
  exercise,
  target,
  timeLimitSec,
  paused,
  onDone,
  step,
}: Props<M>) {
  const runner = useMemo(() => new ExerciseRunner(exercise), [exercise]);
  const [ui, setUi] = useState<RunnerState | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [praise, setPraise] = useState(false);
  const [remaining, setRemaining] = useState(timeLimitSec);
  const hintRef = useRef<Hint | null>(null);
  const pausedRef = useRef(paused);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
    pausedRef.current = paused;
  });

  useEffect(() => {
    let lastUi = 0;
    let lastT: number | null = null;
    let activeMs = 0;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      setTimeout(() => doneRef.current(runner.reps, activeMs), 900);
    };

    return loop.subscribe((tick) => {
      if (finished) return;
      if (pausedRef.current) {
        lastT = null;
        return;
      }
      if (lastT !== null) activeMs += tick.t - lastT;
      lastT = tick.t;

      const st = runner.update(tick.features, tick.people, tick.t);
      hintRef.current = st.hint;
      for (const e of st.events) {
        if (e.type === 'hint' && e.speak) {
          sfx.hint();
          speak(`${t(e.hint.message)}. ${t(e.hint.fix)}`);
        } else if (e.type === 'rep') {
          const kind = !e.rep.counted ? 'miss' : e.rep.errors.length === 0 ? 'perfect' : 'good';
          if (kind === 'miss') sfx.notCounted();
          else if (kind === 'perfect') sfx.perfect();
          else sfx.rep();
          setFlash({ kind, key: e.rep.index });
          if (st.counted >= target) finish();
        } else if (e.type === 'fixed') {
          setPraise(true);
          setTimeout(() => setPraise(false), 1200);
        }
      }
      if (activeMs > timeLimitSec * 1000) finish();

      if (st.events.length || tick.t - lastUi > 66) {
        lastUi = tick.t;
        setUi(st);
        setRemaining(Math.max(0, Math.ceil(timeLimitSec - activeMs / 1000)));
      }
    });
  }, [loop, runner, target, timeLimitSec]);

  const hint = ui?.hint;
  return (
    <>
      <OverlayCanvas
        loop={loop}
        errorJoints={ui?.errorJoints}
        onDraw={(ctx, tick) => {
          const h = hintRef.current;
          if (tick.frame && h?.arrows) h.arrows.forEach((a) => drawArrow(ctx, tick.frame!, a));
        }}
      />
      <div className="hud">
        <div className="hud-top">
          <div className="exercise-name">
            {step && <span className="step">{step}</span>}
            {t(exercise.name)}
          </div>
          {hint ? (
            <div className={`hint-card sev-${hint.severity}`} key={hint.id}>
              <div className="hint-msg">{t(hint.message)}</div>
              <div className="hint-fix">{t(hint.fix)}</div>
            </div>
          ) : praise ? (
            <div className="hint-card sev-ok">
              <div className="hint-msg">{t('praise.fixed')}</div>
            </div>
          ) : null}
        </div>
        <div className={`timer ${remaining <= 10 ? 'low' : ''}`}>
          {remaining}
          <small>{t('workout.timeLeft')}</small>
        </div>
        <div className="rep-counter">
          <span className="rep-now">{ui?.counted ?? 0}</span>
          <span className="rep-target">/ {target}</span>
          {ui && ui.attempted > ui.counted && (
            <span className="rep-missed">
              {t('workout.notCounted')}: {ui.attempted - ui.counted}
            </span>
          )}
        </div>
        <div className="phase-bar">
          <div
            className="phase-fill"
            style={{ height: `${Math.round((ui?.progress ?? 0) * 100)}%` }}
          />
          <div className="phase-goal" />
        </div>
        <div className="pause-hint">{t('workout.pauseHint')}</div>
        {flash && (
          <div key={flash.key} className={`rep-flash flash-${flash.kind}`}>
            {flash.kind === 'perfect'
              ? t('workout.perfect')
              : flash.kind === 'good'
                ? '+1'
                : t('workout.miss')}
          </div>
        )}
      </div>
    </>
  );
}
