import { useEffect, useMemo, useRef, useState } from 'react';
import type { PoseSource } from '@/core/vision/poseLoop';
import { ExerciseRunner, type RunnerState } from '@/engine/runner';
import type { ExerciseDefinition, Hint, RepSummary } from '@/engine/types';
import { t } from '@/i18n';
import { useApp } from '@/app/store';
import { speak, speakIfIdle } from '@/audio/tts';
import { sfx } from '@/audio/sfx';
import { OverlayCanvas } from '../overlay/OverlayCanvas';
import { drawArrow } from '../overlay/drawArrow';
import { drawGhost } from '../overlay/drawGhost';
import { GhostPreview } from '../overlay/GhostPreview';
import { Particles } from '../overlay/particles';
import { coverMapper } from '../overlay/drawSkeleton';
import { P } from '@/core/types';
import { ExerciseRecognizer } from '@/ml/recognizer';

interface Props<M> {
  loop: PoseSource;
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
  const baseline = useApp((s) => s.baseline);
  const runner = useMemo(() => new ExerciseRunner(exercise, baseline), [exercise, baseline]);
  const [ui, setUi] = useState<RunnerState | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [praise, setPraise] = useState(false);
  const [cleanRun, setCleanRun] = useState(0);
  const [remaining, setRemaining] = useState(timeLimitSec);
  const hintRef = useRef<Hint | null>(null);
  const particles = useMemo(() => new Particles(), []);
  const burstRef = useRef<'perfect' | 'good' | null>(null);
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

    // kNN recognizer: "you seem to be doing a different exercise"
    const recognizer = new ExerciseRecognizer();
    const wrongHint: Hint = {
      id: 'wrongExercise',
      severity: 'validity',
      message: 'wrong.title',
      fix: exercise.howTo,
      joints: [],
    };
    let lastCountedT = performance.now();

    return loop.subscribe((tick) => {
      if (finished) return;
      if (pausedRef.current) {
        lastT = null;
        return;
      }
      if (lastT !== null) activeMs += tick.t - lastT;
      lastT = tick.t;

      const rec = recognizer.update(tick.features);
      const wrong =
        rec.label !== null &&
        rec.label !== exercise.id &&
        rec.share >= 0.75 &&
        tick.t - lastCountedT > 6000;
      const st = runner.update(tick.features, tick.people, tick.t, {
        brightness: tick.brightness,
        extraHints: wrong ? [wrongHint] : [],
      });
      hintRef.current = st.hint;
      for (const e of st.events) {
        if (e.type === 'hint' && e.speak) {
          sfx.hint();
          speak((tr) => `${tr(e.hint.message)}. ${tr(e.hint.fix)}`);
        } else if (e.type === 'rep') {
          const kind = !e.rep.counted ? 'miss' : e.rep.errors.length === 0 ? 'perfect' : 'good';
          if (kind === 'miss') sfx.notCounted();
          else if (kind === 'perfect') sfx.perfect();
          else sfx.rep();
          setFlash({ kind, key: e.rep.index });
          if (e.rep.counted) lastCountedT = tick.t;
          setCleanRun((n) => (e.rep.counted && e.rep.errors.length === 0 ? n + 1 : 0));
          if (e.rep.counted) speakIfIdle(String(st.counted));
          if (kind !== 'miss') burstRef.current = kind;
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
  }, [loop, runner, target, timeLimitSec, exercise]);

  const hint = ui?.hint;
  return (
    <>
      <OverlayCanvas
        loop={loop}
        errorJoints={ui?.errorJoints}
        onDraw={(ctx, tick) => {
          if (burstRef.current && tick.frame) {
            const { map } = coverMapper(
              tick.frame.width,
              tick.frame.height,
              ctx.canvas.width,
              ctx.canvas.height,
              true,
            );
            const ls = tick.frame.image[P.leftShoulder]!;
            const rs = tick.frame.image[P.rightShoulder]!;
            const c = map((ls.x + rs.x) / 2, (ls.y + rs.y) / 2);
            particles.burst(
              c.x,
              c.y,
              burstRef.current === 'perfect'
                ? ['#ffc72c', '#fff3c4', '#ffffff']
                : ['#2ee59d', '#00b5e2'],
              burstRef.current === 'perfect' ? 48 : 28,
            );
            burstRef.current = null;
          }
          particles.draw(ctx);
          const h = hintRef.current;
          if (!tick.frame || !h) return;
          // technique problem → show the correct pose as a ghost over the user
          if (h.severity !== 'setup' && tick.features) {
            const target = exercise.ghostFor?.(tick.features) ?? exercise.keyframes.peak;
            drawGhost(ctx, tick.frame, target);
          }
          h.arrows?.forEach((a) => drawArrow(ctx, tick.frame!, a));
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
        {cleanRun >= 2 && (
          <div className="clean-streak" key={cleanRun}>
            🔥 {cleanRun} {t('workout.cleanStreak')}
          </div>
        )}
        <div className="mini-coach" aria-hidden="true">
          <GhostPreview exercise={exercise} />
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
