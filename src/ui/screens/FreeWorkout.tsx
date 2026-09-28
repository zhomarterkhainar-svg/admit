import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/app/store';
import { t } from '@/i18n';
import { speak } from '@/audio/tts';
import { sfx } from '@/audio/sfx';
import { P } from '@/core/types';
import { EXERCISES, EXERCISE_IDS, type ExerciseId } from '@/exercises/registry';
import { FreeWorkoutSession, type FreeState } from '@/game/freeWorkout';
import type { Hint } from '@/engine/types';
import { useDemo, useLoop } from '../engine';
import { DwellButton } from '../gestures/DwellButton';
import { useGestures } from '../gestures/GestureProvider';
import { OverlayCanvas } from '../overlay/OverlayCanvas';
import { drawArrow } from '../overlay/drawArrow';
import { drawGhost } from '../overlay/drawGhost';
import { Particles } from '../overlay/particles';
import { coverMapper } from '../overlay/drawSkeleton';

const DURATION_SEC = 120;

/** Free workout: any exercise, any order — the kNN model recognizes which one and counts it. */
export function FreeWorkout() {
  const loop = useLoop();
  const demo = useDemo();
  const { baseline, finishWorkout, go } = useApp();
  const session = useMemo(() => new FreeWorkoutSession(baseline), [baseline]);
  const [ui, setUi] = useState<FreeState | null>(null);
  const [left, setLeft] = useState(DURATION_SEC);
  const [paused, setPaused] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const hintRef = useRef<Hint | null>(null);
  const activeRef = useRef<ExerciseId | null>(null);
  const pausedRef = useRef(false);
  const doneRef = useRef(false);
  const particles = useMemo(() => new Particles(), []);
  const burst = useRef(false);
  useEffect(() => {
    pausedRef.current = paused;
  });

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    const results = EXERCISE_IDS.filter((id) => session.accepted[id].length > 0).map((id) => ({
      id,
      target: Math.max(1, session.accepted[id].filter((r) => r.counted).length),
      reps: session.accepted[id],
      durationMs: 0,
    }));
    useApp.setState({ program: { id: 'free', steps: [] } });
    finishWorkout(results, startedAt, Date.now());
  };
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });

  useGestures({
    crossArms: () => setPaused(true),
    handsUp: () => setPaused(false),
  });

  useEffect(() => {
    demo?.perform('mix');
    return () => demo?.perform(null);
  }, [demo]);

  useEffect(() => {
    speak((tr) => `${tr('free.title')}. ${tr('free.start')}`);
    let activeMs = 0;
    let lastT: number | null = null;
    let lastUi = 0;
    return loop.subscribe((tick) => {
      if (doneRef.current) return;
      if (pausedRef.current) {
        lastT = null;
        return;
      }
      if (lastT !== null) activeMs += tick.t - lastT;
      lastT = tick.t;
      const st = session.update(tick.features, tick.people, tick.t, {
        brightness: tick.brightness,
      });
      hintRef.current = st.runner?.hint ?? null;
      activeRef.current = st.active;
      for (const e of st.events) {
        if (e.type === 'switch') {
          sfx.hint();
          speak((tr) => tr(EXERCISES[e.id].name));
        } else if (e.type === 'rep') {
          if (!e.rep.counted) sfx.notCounted();
          else if (e.rep.errors.length === 0) sfx.perfect();
          else sfx.rep();
          if (e.rep.counted) burst.current = true;
        } else if (e.type === 'hint' && e.speak) {
          speak((tr) => `${tr(e.hint.message)}. ${tr(e.hint.fix)}`);
        }
      }
      if (activeMs > DURATION_SEC * 1000) finishRef.current();
      if (st.events.length || tick.t - lastUi > 80) {
        lastUi = tick.t;
        setUi(st);
        setLeft(Math.max(0, Math.ceil(DURATION_SEC - activeMs / 1000)));
      }
    });
  }, [loop, session]);

  const active = ui?.active ?? null;
  const hint = ui?.runner?.hint ?? null;
  return (
    <>
      <OverlayCanvas
        loop={loop}
        errorJoints={ui?.runner?.errorJoints}
        onDraw={(ctx, tick) => {
          if (burst.current && tick.frame) {
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
            particles.burst(c.x, c.y, ['#2ee59d', '#00b5e2', '#ffc72c'], 30);
            burst.current = false;
          }
          particles.draw(ctx);
          const h = hintRef.current;
          const a = activeRef.current;
          if (!tick.frame || !h || !a) return;
          if (h.severity !== 'setup' && tick.features) {
            const ex = EXERCISES[a];
            drawGhost(ctx, tick.frame, ex.ghostFor?.(tick.features) ?? ex.keyframes.peak);
          }
          h.arrows?.forEach((ar) => drawArrow(ctx, tick.frame!, ar));
        }}
      />
      <div className="hud">
        <div className="hud-top">
          <div className="exercise-name">
            <span className="step">🤖 AI</span>
            {active ? t(EXERCISES[active].name) : t('free.waiting')}
          </div>
          {hint ? (
            <div className={`hint-card sev-${hint.severity}`} key={hint.id}>
              <div className="hint-msg">{t(hint.message)}</div>
              <div className="hint-fix">{t(hint.fix)}</div>
            </div>
          ) : !active ? (
            <div className="hint-card sev-setup">
              <div className="hint-msg">{t('free.start')}</div>
              <div className="hint-fix">{t('free.startSub')}</div>
            </div>
          ) : null}
        </div>
        <div className={`timer ${left <= 10 ? 'low' : ''}`}>
          {left}
          <small>{t('workout.timeLeft')}</small>
        </div>
        <div className="free-tiles">
          {EXERCISE_IDS.map((id) => (
            <div key={id} className={`free-tile ${id === active ? 'on' : ''}`}>
              <div className="free-count" key={ui?.counts[id]}>
                {ui?.counts[id] ?? 0}
              </div>
              <div className="free-name">{t(EXERCISES[id].name)}</div>
            </div>
          ))}
        </div>
        <div className="pause-hint">{t('free.finishHint')}</div>
      </div>
      {paused && (
        <div className="screen-dim center pause">
          <h1 className="h1">{t('pause.title')}</h1>
          <div className="menu-col">
            <DwellButton variant="primary" icon="▶" onSelect={() => setPaused(false)}>
              {t('pause.resume')}
            </DwellButton>
            <DwellButton icon="🏁" onSelect={() => finishRef.current()}>
              {t('free.finish')}
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
