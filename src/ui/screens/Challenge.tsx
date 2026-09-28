import { useEffect, useRef, useState } from 'react';
import { useApp } from '@/app/store';
import { t, type I18nKey } from '@/i18n';
import { speak } from '@/audio/tts';
import { sfx } from '@/audio/sfx';
import { EXERCISES } from '@/exercises/registry';
import { ExerciseRunner } from '@/engine/runner';
import type { Hint } from '@/engine/types';
import { ChallengeGame, type ActiveCommand } from '@/game/challenge';
import { useDemo, useLoop } from '../engine';
import { DwellButton } from '../gestures/DwellButton';
import { useGestures } from '../gestures/GestureProvider';
import { OverlayCanvas } from '../overlay/OverlayCanvas';
import { drawArrow } from '../overlay/drawArrow';
import { Confetti } from '../components/Confetti';

type Pop = { text: string; kind: 'hit' | 'clean' | 'miss' | 'warn'; key: number };

interface View {
  score: number;
  lives: number;
  combo: number;
  multiplier: number;
  timeLeft: number;
  command: ActiveCommand | null;
  /** 0..1 of the reaction window left */
  windowLeft: number;
  hint: Hint | null;
}

const COUNTDOWN_SEC = 4;

export function Challenge() {
  const loop = useLoop();
  const { go, finishChallenge, baseline } = useApp();
  const demo = useDemo();
  useEffect(() => () => demo?.perform(null), [demo]);
  const [stage, setStage] = useState<'ready' | 'play'>('ready');
  const [count, setCount] = useState(COUNTDOWN_SEC);
  const [paused, setPaused] = useState(false);
  const [view, setView] = useState<View | null>(null);
  const [pop, setPop] = useState<Pop | null>(null);
  const [errorJoints, setErrorJoints] = useState<ReadonlySet<number>>(new Set());
  const hintRef = useRef<Hint | null>(null);
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  });

  useGestures({
    crossArms: () => (stage === 'play' ? setPaused(true) : go('menu')),
    handsUp: () => {
      if (paused) setPaused(false);
      else if (stage === 'ready') setStage('play');
    },
  });

  // countdown
  useEffect(() => {
    if (stage !== 'ready') return;
    speak((tr) => `${tr('ch.title')}. ${tr('ch.rules')}`);
    const started = performance.now();
    const id = setInterval(() => {
      const left = COUNTDOWN_SEC + 3 - Math.floor((performance.now() - started) / 1000);
      setCount(left);
      if (left <= 3 && left > 0) sfx.hint();
      if (left <= 0) {
        clearInterval(id);
        setStage('play');
      }
    }, 250);
    return () => clearInterval(id);
  }, [stage]);

  // game loop
  useEffect(() => {
    if (stage !== 'play') return;
    const game = new ChallengeGame();
    let runner: ExerciseRunner<unknown> | null = null;
    let clock = 0; // game time: advances only while not paused
    let lastT: number | null = null;
    let lastUi = 0;
    let popKey = 0;
    const show = (text: string, kind: Pop['kind']) => setPop({ text, kind, key: ++popKey });

    const handle = (events: ReturnType<ChallengeGame['tick']>) => {
      for (const e of events) {
        if (e.type === 'command') {
          runner = new ExerciseRunner(EXERCISES[e.command.def.exercise], baseline);
          demo?.perform(e.command.def.exercise);
          speak((tr) => tr(`ch.cmd.${e.command.def.id}` as I18nKey));
        } else if (e.type === 'hit') {
          if (e.clean) sfx.perfect();
          else sfx.rep();
          show(
            `+${e.points}${e.combo > 1 ? `  ×${game.multiplier}` : ''}`,
            e.clean ? 'clean' : 'hit',
          );
          runner = null;
        } else if (e.type === 'almost') {
          sfx.notCounted();
          const rule = [...runner!.def.repRules].find((r) => e.rep.errors.includes(r.id));
          if (rule) speak((tr) => tr(rule.fix));
          show(rule ? t(rule.fix) : t('ch.miss'), 'warn');
        } else if (e.type === 'wrongSide') {
          sfx.notCounted();
          show(t('ch.wrongSide'), 'warn');
        } else if (e.type === 'miss') {
          sfx.notCounted();
          show(t('ch.miss'), 'miss');
          runner = null;
        } else if (e.type === 'over') {
          sfx.perfect();
          const xp = game.xp();
          setTimeout(
            () =>
              finishChallenge(
                {
                  score: game.score,
                  hits: game.hits,
                  clean: game.clean,
                  misses: game.misses,
                  bestCombo: game.bestCombo,
                  xp,
                },
                Date.now(),
              ),
            1200,
          );
        }
      }
    };

    handle(game.start(0));
    return loop.subscribe((tick) => {
      if (game.over) return;
      if (pausedRef.current) {
        lastT = null;
        return;
      }
      if (lastT !== null) clock += tick.t - lastT;
      lastT = tick.t;

      let hint: Hint | null = null;
      if (runner) {
        const st = runner.update(tick.features, tick.people, tick.t, {
          brightness: tick.brightness,
        });
        hint = st.hint;
        setErrorJoints((prev) => (sameSet(prev, st.errorJoints) ? prev : st.errorJoints));
        for (const e of st.events) if (e.type === 'rep') handle(game.rep(e.rep, clock));
      }
      handle(game.tick(clock));
      hintRef.current = hint;

      if (tick.t - lastUi > 66) {
        lastUi = tick.t;
        const cmd = game.command;
        setView({
          score: game.score,
          lives: game.lives,
          combo: game.combo,
          multiplier: game.multiplier,
          timeLeft: Math.ceil(game.timeLeftMs(clock) / 1000),
          command: cmd,
          windowLeft: cmd ? Math.max(0, (cmd.deadline - clock) / (cmd.deadline - cmd.issuedAt)) : 0,
          hint,
        });
      }
    });
  }, [stage, loop, finishChallenge, demo, baseline]);

  return (
    <>
      <OverlayCanvas
        loop={loop}
        errorJoints={errorJoints}
        onDraw={(ctx, tick) => {
          const h = hintRef.current;
          if (tick.frame && h?.arrows) h.arrows.forEach((a) => drawArrow(ctx, tick.frame!, a));
        }}
      />
      {stage === 'ready' ? (
        <div className="screen-dim center">
          <h1 className="h1">🏹 {t('ch.title')}</h1>
          <p className="lead">{t('ch.rules')}</p>
          <p className="muted">{t('intro.handsUp')}</p>
          <div className="countdown-big" key={count}>
            {count <= 3 ? (count > 0 ? count : t('intro.go')) : ''}
          </div>
        </div>
      ) : (
        <div className="hud challenge-hud">
          <div className="ch-top">
            <div className="ch-lives">
              {Array.from({ length: 3 }, (_, i) => (
                <span key={i} className={i < (view?.lives ?? 3) ? 'life' : 'life lost'}>
                  ❤
                </span>
              ))}
            </div>
            <div className="ch-score">
              {view?.score ?? 0}
              {view && view.multiplier > 1 && <span className="ch-mult">×{view.multiplier}</span>}
            </div>
            <div className={`timer ch-timer ${view && view.timeLeft <= 10 ? 'low' : ''}`}>
              {view?.timeLeft ?? 60}
            </div>
          </div>
          {view?.command && (
            <div className="ch-command" key={view.command.n}>
              <div className="ch-ring" style={{ '--left': view.windowLeft } as React.CSSProperties}>
                <span>{view.command.def.icon}</span>
              </div>
              <div className="ch-cmd-text">{t(`ch.cmd.${view.command.def.id}` as I18nKey)}</div>
            </div>
          )}
          {view?.hint && (
            <div className={`hint-card ch-hint sev-${view.hint.severity}`}>
              <div className="hint-msg">{t(view.hint.message)}</div>
              <div className="hint-fix">{t(view.hint.fix)}</div>
            </div>
          )}
          {pop && (
            <div key={pop.key} className={`ch-pop pop-${pop.kind}`}>
              {pop.text}
            </div>
          )}
          {view && view.combo > 1 && (
            <div className="ch-combo">
              🔥 {view.combo} {t('ch.combo')}
            </div>
          )}
        </div>
      )}
      {paused && (
        <div className="screen-dim center pause">
          <h1 className="h1">{t('pause.title')}</h1>
          <div className="menu-col">
            <DwellButton variant="primary" icon="▶" onSelect={() => setPaused(false)}>
              {t('pause.resume')}
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

export function ChallengeResults() {
  const loop = useLoop();
  const { challenge, go } = useApp();
  useGestures({ crossArms: () => go('menu') });
  useEffect(() => {
    if (!challenge) return;
    speak(
      (tr) =>
        `${tr('ch.over')}. ${tr('ch.score')}: ${challenge.score}. ${challenge.record ? tr('ch.record') : ''}`,
    );
  }, [challenge]);
  if (!challenge) return null;
  return (
    <>
      <OverlayCanvas loop={loop} />
      {challenge.record && <Confetti />}
      <div className="screen-dim results">
        <h1 className="h1">{t('ch.over')}</h1>
        {challenge.record && <div className="record-badge">🏆 {t('ch.record')}</div>}
        <div className="ch-final">{challenge.score}</div>
        <div className="stats">
          <Mini label={t('ch.hits')} value={challenge.hits} />
          <Mini label={t('ch.cleanHits')} value={challenge.clean} />
          <Mini label={t('ch.misses')} value={challenge.misses} />
          <Mini label={t('ch.bestCombo')} value={challenge.bestCombo} />
          <Mini label={t('results.xp')} value={`+${challenge.xp}`} />
        </div>
        <div className="menu-row">
          <DwellButton variant="primary" icon="↻" onSelect={() => go('challenge')}>
            {t('ch.again')}
          </DwellButton>
          <DwellButton icon="🏆" onSelect={() => go('records')}>
            {t('results.records')}
          </DwellButton>
          <DwellButton variant="ghost" icon="🏠" onSelect={() => go('menu')}>
            {t('results.menu')}
          </DwellButton>
        </div>
      </div>
    </>
  );
}

function Mini({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

const sameSet = (a: ReadonlySet<number>, b: ReadonlySet<number>) =>
  a.size === b.size && [...a].every((x) => b.has(x));
