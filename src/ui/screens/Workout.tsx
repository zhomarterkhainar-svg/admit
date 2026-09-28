import { useEffect, useMemo, useRef, useState } from 'react';
import type { PoseLoop } from '@/core/vision/poseLoop';
import { ExerciseRunner, type RunnerState } from '@/engine/runner';
import type { ExerciseDefinition, Hint } from '@/engine/types';
import { t } from '@/i18n';
import { speak } from '@/audio/tts';
import { sfx } from '@/audio/sfx';
import { OverlayCanvas } from '../overlay/OverlayCanvas';
import { drawArrow } from '../overlay/drawArrow';

interface Props<M> {
  loop: PoseLoop;
  exercise: ExerciseDefinition<M>;
  target: number;
  onDone?: (runner: ExerciseRunner<M>) => void;
}

type Flash = { kind: 'perfect' | 'good' | 'miss'; key: number } | null;

/** Live exercise HUD: rep counter, phase bar, one coaching hint, red joints + arrows, voice. */
export function Workout<M>({ loop, exercise, target, onDone }: Props<M>) {
  const runner = useMemo(() => new ExerciseRunner(exercise), [exercise]);
  const [ui, setUi] = useState<RunnerState | null>(null);
  const [flash, setFlash] = useState<Flash>(null);
  const [praise, setPraise] = useState(false);
  const hintRef = useRef<Hint | null>(null);
  const jointsRef = useRef<ReadonlySet<number>>(new Set());
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });

  useEffect(() => {
    speak(t(exercise.howTo));
    let lastUi = 0;
    return loop.subscribe((tick) => {
      const st = runner.update(tick.features, tick.people, tick.t);
      hintRef.current = st.hint;
      jointsRef.current = st.errorJoints;
      for (const e of st.events) {
        if (e.type === 'hint' && e.speak) {
          sfx.hint();
          speak(`${t(e.hint.message)}. ${t(e.hint.fix)}`);
        } else if (e.type === 'rep') {
          const kind = !e.rep.counted ? 'miss' : e.rep.quality === 100 ? 'perfect' : 'good';
          if (kind === 'miss') sfx.notCounted();
          else if (kind === 'perfect') sfx.perfect();
          else sfx.rep();
          setFlash({ kind, key: e.rep.index });
          if (e.rep.counted && runner.reps.filter((r) => r.counted).length >= target) {
            doneRef.current?.(runner);
          }
        } else if (e.type === 'fixed') {
          setPraise(true);
          setTimeout(() => setPraise(false), 1200);
        }
      }
      const now = performance.now();
      if (st.events.length || now - lastUi > 66) {
        lastUi = now;
        setUi(st);
      }
    });
  }, [loop, runner, exercise, target]);

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
          <div className="exercise-name">{t(exercise.name)}</div>
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
        <div className="rep-counter">
          <span className="rep-now">{ui?.counted ?? 0}</span>
          <span className="rep-target">/ {target}</span>
          {ui && ui.attempted > ui.counted && (
            <span className="rep-missed">не засчитано: {ui.attempted - ui.counted}</span>
          )}
        </div>
        <div className="phase-bar">
          <div
            className="phase-fill"
            style={{ height: `${Math.round((ui?.progress ?? 0) * 100)}%` }}
          />
          <div className="phase-goal" />
        </div>
        {flash && (
          <div key={flash.key} className={`rep-flash flash-${flash.kind}`}>
            {flash.kind === 'perfect' ? 'ИДЕАЛЬНО!' : flash.kind === 'good' ? '+1' : 'НЕ ЗАСЧИТАНО'}
          </div>
        )}
      </div>
    </>
  );
}
