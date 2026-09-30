import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  Bot,
  Check,
  Crown,
  Eye,
  EyeOff,
  Feather,
  Flame,
  Gauge,
  House,
  RotateCcw,
  Timer,
  Users,
} from 'lucide-react';
import { useApp } from '@/app/store';
import { t, type I18nKey } from '@/i18n';
import { speak } from '@/audio/tts';
import { sfx } from '@/audio/sfx';
import { EXERCISES } from '@/exercises/registry';
import { pressTop } from '@/exercises/press/reference';
import { ExerciseRunner } from '@/engine/runner';
import type { Hint } from '@/engine/types';
import { PoseGestureDetector } from '@/gestures/poseGestures';
import { extractFeatures } from '@/core/features/extract';
import type { PoseTick } from '@/core/vision/poseLoop';
import {
  DUEL_SIDES,
  DuelGame,
  DuelTracker,
  fromHalf,
  type DuelEvent,
  type DuelPlayer,
  type DuelSide,
  type DuelView,
} from '@/game/duel';
import { BOT_LEVELS, DuelBot, type BotLevel } from '@/game/duelBot';
import { DEMO_SCRIPTS, type DemoRep } from '@/demo/scripts';
import { useDemo, useLoop } from '../engine';
import { DwellButton, type IconTone } from '../gestures/DwellButton';
import { useGestures } from '../gestures/GestureProvider';
import { OverlayCanvas } from '../overlay/OverlayCanvas';
import { drawSkeleton } from '../overlay/drawSkeleton';
import { GhostPreview } from '../overlay/GhostPreview';
import { Confetti } from '../components/Confetti';
import { Mascot, Speech } from '../components/Mascot';
import { PauseModal } from '../components/PauseModal';
import { HandsUpIcon } from '../components/icons';
import { ExitButton } from '../components/ExitButton';

/** Team colours: screen-left "Kök batyr" is blue, screen-right "Altyn batyr" is gold. */
const TEAM: Record<DuelSide, { color: string; name: 'duel.blue' | 'duel.gold' }> = {
  L: { color: '#1cb0f6', name: 'duel.blue' },
  R: { color: '#ffc800', name: 'duel.gold' },
};

/** Who plays the gold side: a second person or the AI rival at a difficulty level. */
type Rival = 'friend' | BotLevel;
type JoinState = 'none' | 'seen' | 'ready';
type Pop = { text: string; kind: 'clean' | 'hit' | 'miss'; key: number };

interface Hud {
  round: number;
  rounds: number;
  exercise: keyof typeof EXERCISES;
  phase: DuelGame['phase'];
  left: number;
  players: Record<DuelSide, DuelPlayer>;
  hints: Record<DuelSide, Hint | null>;
  seen: Record<DuelSide, boolean>;
}

interface Result {
  winner: DuelSide | 'draw';
  players: Record<DuelSide, DuelPlayer>;
}

/** Demo: both virtual athletes raise their hands to join. */
const JOIN_DEMO: DemoRep[] = [{ rest: {}, peak: pressTop(), ms: 3200 }];

const ICON = { size: 44, strokeWidth: 2.5 } as const;
const LEVEL_CARD: Record<BotLevel, { tone: IconTone; icon: ReactNode }> = {
  easy: { tone: 'green', icon: <Feather {...ICON} /> },
  medium: { tone: 'orange', icon: <Gauge {...ICON} /> },
  hard: { tone: 'red', icon: <Flame {...ICON} /> },
};

const RIVAL_KEY = 'qozgal.duel.rival';
function savedRival(): Rival | null {
  try {
    const r = localStorage.getItem(RIVAL_KEY);
    return r === 'friend' || BOT_LEVELS.includes(r as BotLevel) ? (r as Rival) : null;
  } catch {
    return null;
  }
}

const isBot = (r: Rival | null): r is BotLevel => r !== null && r !== 'friend';

/** Side names; against the AI the gold side is the "AI batyr". */
const teamName = (tr: (k: I18nKey) => string, side: DuelSide, rival: Rival | null) =>
  side === 'R' && isBot(rival) ? tr('duel.bot') : tr(TEAM[side].name);

/** Playing alone: the locked player uses the whole picture as their camera. */
const soloView = (tick: PoseTick): DuelView => ({
  frame: tick.frame,
  features: tick.features,
  half: tick.frame,
});

/** The AI rival drawn in the gold half, judged as a camera of its own. */
function botView(bot: DuelBot, t: number): DuelView {
  const half = bot.frame(t);
  return { frame: fromHalf(half, 'R'), features: extractFeatures(half), half };
}

/**
 * "Batyr vs Batyr": two players side by side in front of one camera, each in their own half of
 * the picture — or one player against the AI rival (easy / medium / hard). Join by raising both
 * hands, then three rounds of the same exercise at the same time: a counted rep is 10 points,
 * a clean one 5 more. Each half is judged as its own camera; the AI's reps go through the same
 * runner, so it scores by the same rules.
 */
export function Duel() {
  const loop = useLoop();
  const { go } = useApp();
  const demo = useDemo();
  const [stage, setStage] = useState<'pick' | 'join' | 'play' | 'over'>('pick');
  const [rival, setRival] = useState<Rival | null>(null);
  const [lastRival] = useState(savedRival);
  const [match, setMatch] = useState(0);
  const [paused, setPaused] = useState(false);
  const [join, setJoin] = useState<Record<DuelSide, JoinState>>({ L: 'none', R: 'none' });
  const [hud, setHud] = useState<Hud | null>(null);
  const [pops, setPops] = useState<Record<DuelSide, Pop | null>>({ L: null, R: null });
  const [result, setResult] = useState<Result | null>(null);
  const views = useRef<Record<DuelSide, DuelView> | null>(null);
  const errors = useRef<Record<DuelSide, ReadonlySet<number>>>({ L: new Set(), R: new Set() });
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  });

  // two people in the picture: MediaPipe must look for both (against the AI: just the player)
  useEffect(() => {
    if (rival !== 'friend') return;
    loop.setMaxPeople?.(2);
    return () => loop.setMaxPeople?.(1);
  }, [loop, rival]);
  useEffect(() => () => demo?.performDuo(null), [demo]);

  const choose = (r: Rival) => {
    try {
      localStorage.setItem(RIVAL_KEY, r);
    } catch {
      /* ignore */
    }
    views.current = null;
    setRival(r);
    setJoin({ L: 'none', R: 'none' });
    setStage('join');
  };
  const repick = () => {
    views.current = null;
    setResult(null);
    setHud(null);
    setRival(null);
    setStage('pick');
  };

  useGestures({
    crossArms: () =>
      stage === 'play' ? setPaused(true) : stage === 'join' ? repick() : go('games'),
    handsUp: () => paused && setPaused(false),
  });

  // --- join: each player raises both hands in their own half (the AI is always ready) ---
  useEffect(() => {
    if (stage !== 'join' || !rival) return;
    const bot = isBot(rival) ? new DuelBot(rival) : null;
    speak((tr) => `${tr('duel.title')}. ${tr(bot ? 'duel.joinHintBot' : 'duel.joinHint')}`);
    const tracker = new DuelTracker();
    const detectors = { L: new PoseGestureDetector(), R: new PoseGestureDetector() };
    const ready = { L: false, R: !!bot };
    let bothSince: number | null = null;
    let lastUi = 0;
    demo?.performDuo({ L: JOIN_DEMO, R: bot ? [] : JOIN_DEMO }, 900);
    return loop.subscribe((tick) => {
      const v = bot
        ? { L: soloView(tick), R: botView(bot, tick.t) }
        : tracker.update(tick.crowd ?? (tick.frame ? [tick.frame] : []), tick.t);
      views.current = v;
      for (const side of DUEL_SIDES) {
        if (bot && side === 'R') continue;
        const { half, features } = v[side];
        if (!half) ready[side] = false; // walked away before the start
        if (detectors[side].update(half, features).includes('handsUp') && !ready[side]) {
          ready[side] = true;
          sfx.select();
        }
      }
      const state = (s: DuelSide): JoinState =>
        !v[s].frame ? 'none' : ready[s] ? 'ready' : 'seen';
      bothSince = state('L') === 'ready' && state('R') === 'ready' ? (bothSince ?? tick.t) : null;
      if (bothSince !== null && tick.t - bothSince > 700) {
        sfx.perfect();
        setStage('play');
      }
      if (tick.t - lastUi > 100) {
        lastUi = tick.t;
        setJoin((prev) =>
          prev.L === state('L') && prev.R === state('R') ? prev : { L: state('L'), R: state('R') },
        );
      }
    });
  }, [stage, rival, loop, demo]);

  // --- the match ---
  useEffect(() => {
    if (stage !== 'play' || !rival) return;
    const bot = isBot(rival) ? new DuelBot(rival) : null;
    const tracker = new DuelTracker();
    const game = new DuelGame();
    const runners: Record<DuelSide, ExerciseRunner<unknown> | null> = { L: null, R: null };
    const hints: Record<DuelSide, Hint | null> = { L: null, R: null };
    let clock = 0; // game time: stands still while paused
    let lastT: number | null = null;
    let lastUi = 0;
    let popKey = 0;
    const pop = (side: DuelSide, text: string, kind: Pop['kind']) =>
      setPops((p) => ({ ...p, [side]: { text, kind, key: ++popKey } }));

    const handle = (events: DuelEvent[]) => {
      for (const e of events) {
        if (e.type === 'break') {
          const ex = EXERCISES[game.rounds[e.round]!.exercise];
          runners.L = runners.R = null;
          errors.current = { L: new Set(), R: new Set() };
          sfx.hint();
          speak((tr) => `${tr('duel.round')} ${e.round + 1}: ${tr(ex.name)}`);
          bot?.start(null, clock);
          demo?.performDuo({ L: [], R: [] });
        } else if (e.type === 'go') {
          const id = game.current.exercise;
          for (const s of DUEL_SIDES) runners[s] = new ExerciseRunner(EXERCISES[id]);
          sfx.perfect();
          speak((tr) => tr('duel.go'));
          bot?.start(id, clock);
          // the demo athletes do the same set, shifted a little so the score is not a tie
          const script = DEMO_SCRIPTS[id];
          demo?.performDuo({ L: script, R: bot ? [] : [...script.slice(1), script[0]!] }, 500);
        } else if (e.type === 'point') {
          if (e.clean) sfx.perfect();
          else sfx.rep();
          pop(e.side, `+${e.points}`, e.clean ? 'clean' : 'hit');
        } else if (e.type === 'miss') {
          sfx.notCounted();
          pop(e.side, t('workout.miss'), 'miss');
        } else if (e.type === 'over') {
          sfx.perfect();
          const players = structuredClone(game.players);
          speak((tr) =>
            e.winner === 'draw'
              ? tr('duel.draw')
              : `${teamName(tr, e.winner, rival)} ${tr('duel.winner')}!`,
          );
          setResult({ winner: e.winner, players });
          setStage('over');
          demo?.performDuo({ L: [], R: [] });
        }
      }
    };

    handle(game.start(0));
    return loop.subscribe((tick) => {
      if (game.phase === 'over') return;
      if (pausedRef.current) {
        lastT = null;
        return;
      }
      if (lastT !== null) clock += tick.t - lastT;
      lastT = tick.t;

      const v = bot
        ? { L: soloView(tick), R: botView(bot, clock) }
        : tracker.update(tick.crowd ?? (tick.frame ? [tick.frame] : []), tick.t);
      views.current = v;
      for (const side of DUEL_SIDES) {
        const runner = runners[side];
        if (!runner) continue;
        // the AI lives on the game clock (it freezes with the pause)
        const st = runner.update(v[side].features, 1, bot && side === 'R' ? clock : tick.t);
        hints[side] = st.hint;
        errors.current[side] = st.errorJoints;
        for (const ev of st.events) if (ev.type === 'rep') handle(game.rep(side, ev.rep));
      }
      handle(game.tick(clock));

      if (tick.t - lastUi > 80) {
        lastUi = tick.t;
        setHud({
          round: game.round,
          rounds: game.rounds.length,
          exercise: game.current.exercise,
          phase: game.phase,
          left: Math.ceil(game.left(clock) / 1000),
          players: structuredClone(game.players),
          hints: { ...hints },
          seen: { L: !!v.L.frame, R: !!v.R.frame },
        });
      }
    });
  }, [stage, rival, match, loop, demo]);

  const rematch = () => {
    setResult(null);
    setHud(null);
    setPops({ L: null, R: null });
    setMatch((m) => m + 1);
    setStage('play');
  };

  return (
    <>
      <OverlayCanvas
        loop={loop}
        skeleton={false}
        onDraw={(ctx) => {
          const v = views.current;
          if (!v) return;
          for (const side of DUEL_SIDES) {
            const frame = v[side].frame;
            if (frame)
              drawSkeleton(ctx, frame, {
                color: TEAM[side].color,
                errorJoints: errors.current[side],
              });
          }
        }}
      />
      {stage !== 'pick' && <div className="duel-divider" aria-hidden="true" />}
      {stage === 'pick' && (
        <div className="page">
          <div className="page-inner">
            <div className="page-head">
              <DwellButton
                variant="ghost"
                icon={<ArrowLeft size={22} strokeWidth={2.75} />}
                onSelect={() => go('games')}
              >
                {t('back')}
              </DwellButton>
              <h1 className="h1">{t('duel.title')}</h1>
            </div>
            <Speech mood="cheer" size={64}>
              {t('duel.pickHint')}
            </Speech>
            <div className="duel-pick">
              <section className="duel-pick-group">
                <h2 className="duel-pick-label">
                  <Users size={20} strokeWidth={2.75} /> {t('duel.vsFriend')}
                </h2>
                <DwellButton
                  className="game-card"
                  tone="blue"
                  icon={<Users {...ICON} />}
                  sub={t('duel.friendSub')}
                  active={lastRival === 'friend'}
                  onSelect={() => choose('friend')}
                >
                  {t('duel.friend')}
                </DwellButton>
              </section>
              <section className="duel-pick-group bot">
                <h2 className="duel-pick-label">
                  <Bot size={20} strokeWidth={2.75} /> {t('duel.vsBot')}
                </h2>
                <div className="duel-levels">
                  {BOT_LEVELS.map((level) => (
                    <DwellButton
                      key={level}
                      className="game-card"
                      tone={LEVEL_CARD[level].tone}
                      icon={LEVEL_CARD[level].icon}
                      sub={t(`duel.level.${level}Sub`)}
                      active={lastRival === level}
                      onSelect={() => choose(level)}
                    >
                      {t(`duel.level.${level}`)}
                    </DwellButton>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {stage === 'join' && (
        <div className="hud duel-join">
          <h1 className="duel-title">{t('duel.title')}</h1>
          <p className="duel-join-hint">{t(isBot(rival) ? 'duel.joinHintBot' : 'duel.joinHint')}</p>
          {DUEL_SIDES.map((side) =>
            side === 'R' && isBot(rival) ? (
              <div key={side} className="duel-slot R ready bot">
                <span className="duel-slot-name">{t('duel.bot')}</span>
                <span className="duel-slot-icon">
                  <Bot size={44} strokeWidth={2.5} />
                </span>
                <span className="duel-slot-state">
                  {t('duel.ready')} · {t(`duel.level.${rival}`)}
                </span>
              </div>
            ) : (
              <div key={side} className={`duel-slot ${side} ${join[side]}`}>
                <span className="duel-slot-name">{t(TEAM[side].name)}</span>
                <span className="duel-slot-icon">
                  {join[side] === 'none' ? (
                    <EyeOff size={40} strokeWidth={2.5} />
                  ) : join[side] === 'seen' ? (
                    <HandsUpIcon size={52} />
                  ) : (
                    <Check size={44} strokeWidth={3.5} />
                  )}
                </span>
                <span className="duel-slot-state">{t(`duel.${join[side]}`)}</span>
              </div>
            ),
          )}
          <ExitButton corner onExit={() => go('games')} />
        </div>
      )}

      {stage === 'play' && hud && (
        <div className="hud duel-hud">
          <ExitButton corner onExit={() => go('games')} />
          <div className="duel-top">
            <div className="hud-chip">
              <span className="step num">
                {t('duel.round')} {hud.round + 1}/{hud.rounds}
              </span>
              {t(EXERCISES[hud.exercise].name)}
            </div>
            <div
              className={`hud-chip timer-chip num ${hud.phase === 'play' && hud.left <= 5 ? 'low' : ''}`}
            >
              <Timer size={20} strokeWidth={2.75} /> {hud.left}
            </div>
          </div>
          {DUEL_SIDES.map((side) => {
            const p = hud.players[side];
            const hint = hud.hints[side];
            const lead = hud.players[side].score > hud.players[side === 'L' ? 'R' : 'L'].score;
            return (
              <div key={side} className={`duel-card ${side}`}>
                <div className="duel-card-name">
                  {lead && <Crown size={18} strokeWidth={2.75} />}
                  {side === 'R' && isBot(rival) && <Bot size={18} strokeWidth={2.75} />}
                  {teamName(t, side, rival)}
                  {!hud.seen[side] && <EyeOff size={18} strokeWidth={2.75} />}
                </div>
                {side === 'R' && isBot(rival) && (
                  <span className="duel-level-tag">{t(`duel.level.${rival}`)}</span>
                )}
                <div className="duel-score num">{p.score}</div>
                <div className="duel-round-reps">
                  <span className="num">{p.roundReps}</span> {t('duel.roundReps')}
                </div>
                {!hud.seen[side] ? (
                  <div className="duel-hint warn">
                    <Eye size={16} strokeWidth={2.75} /> {t('duel.lost')}
                  </div>
                ) : (
                  hint &&
                  hud.phase === 'play' && (
                    <div className={`duel-hint ${hint.severity}`}>{t(hint.message)}</div>
                  )
                )}
              </div>
            );
          })}
          {DUEL_SIDES.map((side) => {
            const pop = pops[side];
            return (
              pop && (
                <div key={`${side}-${pop.key}`} className={`duel-pop ${side} pop-${pop.kind}`}>
                  {pop.text}
                </div>
              )
            );
          })}
          {hud.phase === 'break' && (
            <div className="duel-break" key={`break-${hud.round}`}>
              <span className="kicker">
                {t('duel.round')} {hud.round + 1}
              </span>
              <h2>{t(EXERCISES[hud.exercise].name)}</h2>
              <div className="duel-break-ghost">
                <GhostPreview exercise={EXERCISES[hud.exercise]} />
              </div>
              <div className="countdown num" key={hud.left}>
                {hud.left}
              </div>
            </div>
          )}
        </div>
      )}

      {stage === 'over' && result && (
        <>
          <Confetti />
          <div className="page duel-over">
            <div className="page-inner center">
              <Mascot mood="cheer" size={110} bob />
              <h1 className="results-title">
                {result.winner === 'draw'
                  ? t('duel.draw')
                  : `${teamName(t, result.winner, rival)} — ${t('duel.win')}`}
              </h1>
              <div className="duel-final">
                {DUEL_SIDES.map((side) => (
                  <div
                    key={side}
                    className={`duel-final-card ${side} ${result.winner === side ? 'win' : ''}`}
                  >
                    {result.winner === side && (
                      <Crown className="duel-final-crown" size={34} strokeWidth={2.5} />
                    )}
                    <span className="duel-card-name">{teamName(t, side, rival)}</span>
                    <span className="duel-score num">{result.players[side].score}</span>
                    <span className="muted">
                      <span className="num">{result.players[side].reps}</span> {t('duel.reps')} ·{' '}
                      <span className="num">{result.players[side].clean}</span> {t('duel.clean')}
                    </span>
                  </div>
                ))}
              </div>
              <div className="menu-row">
                <DwellButton
                  variant="primary"
                  icon={<RotateCcw size={24} strokeWidth={2.75} />}
                  onSelect={rematch}
                >
                  {t('duel.rematch')}
                </DwellButton>
                <DwellButton
                  variant="ghost"
                  icon={
                    isBot(rival) ? (
                      <Bot size={22} strokeWidth={2.75} />
                    ) : (
                      <Users size={22} strokeWidth={2.75} />
                    )
                  }
                  onSelect={repick}
                >
                  {t('duel.newRival')}
                </DwellButton>
                <DwellButton
                  variant="ghost"
                  icon={<House size={22} strokeWidth={2.75} />}
                  onSelect={() => go('menu')}
                >
                  {t('results.menu')}
                </DwellButton>
              </div>
            </div>
          </div>
        </>
      )}
      {paused && <PauseModal onResume={() => setPaused(false)} onExit={() => go('menu')} />}
    </>
  );
}
