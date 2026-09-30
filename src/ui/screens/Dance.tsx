import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Flame, House, Music, Play, RotateCcw, Target, Trophy, Zap } from 'lucide-react';
import { useApp, type DanceResult } from '@/app/store';
import { t, type I18nKey } from '@/i18n';
import { speak, stopSpeech } from '@/audio/tts';
import { DombraSong } from '@/audio/dombra';
import { BEAT_MS, chart, type Level, type Note } from '@/game/dance/chart';
import { DanceJudge, multiplier, type JudgeEvent } from '@/game/dance/judge';
import { MOVES, MOVE_IDS } from '@/game/dance/moves';
import { demoDancePose } from '@/game/dance/demo';
import { useDemo, useLoop } from '../engine';
import { DwellButton } from '../gestures/DwellButton';
import { useGestures } from '../gestures/GestureProvider';
import { OverlayCanvas } from '../overlay/OverlayCanvas';
import { fitCanvas } from '../overlay/canvasSize';
import { moveIcons } from '../overlay/moveIcons';
import { Confetti } from '../components/Confetti';
import { Mascot, Speech } from '../components/Mascot';
import { PauseModal } from '../components/PauseModal';
import { StatBox } from '../components/StatBox';
import { HandsUpIcon } from '../components/icons';
import { ExitButton } from '../components/ExitButton';

/** the camera image arrives ~120 ms after the moment it shows: judge poses that much earlier */
const CAMERA_LATENCY_MS = 120;
/** how far ahead the lane shows upcoming moves */
const LANE_AHEAD_MS = 4200;
const LANE_BEHIND_MS = 700;
/** the hit circle, as a share of the lane width from the left */
const HIT_X = 0.14;
/** from this combo on the second dombra joins in and "ZHORGA!" lights up */
const HOT_COMBO = 16;

type Pop = { key: number; hit: JudgeEvent['hit']; points: number };
type Final = DanceResult & { xp: number; record: boolean };

/**
 * "Qara Zhorga": dance to the dombra. Every 2 (medium) or 4 (easy) beats a move has to be
 * struck exactly on the beat, like Just Dance / osu!. The music is synthesized and scheduled
 * on the audio clock; the lane and the timing ring are drawn at display rate from the song
 * position as heard, the poses are judged in song time (minus the camera latency).
 */
export function Dance() {
  const { go, openBoard } = useApp();
  const [stage, setStage] = useState<'select' | 'play' | 'results'>('select');
  const [level, setLevel] = useState<Level>('mid');
  const [paused, setPaused] = useState(false);
  const [run, setRun] = useState(0);
  const [final, setFinal] = useState<Final | null>(null);
  const icons = useMemo(() => moveIcons(), []);

  useGestures({
    // during the song "arms up" is a dance move: it only resumes a paused song
    handsUp: () => {
      if (stage === 'select') setStage('play');
      else if (paused) setPaused(false);
    },
    crossArms: () => {
      if (stage === 'play') setPaused(true);
      else go('games');
    },
  });

  useEffect(() => {
    if (stage === 'select') speak((tr) => `${tr('dance.title')}. ${tr('dance.greet')}`);
  }, [stage]);

  if (stage === 'play')
    return (
      <>
        <DanceGame
          key={run}
          level={level}
          paused={paused}
          onDone={(r) => {
            setFinal(r);
            setStage('results');
          }}
        />
        {paused && <PauseModal onResume={() => setPaused(false)} onExit={() => go('menu')} />}
      </>
    );

  if (stage === 'results' && final)
    return (
      <DanceResults
        r={final}
        onAgain={() => {
          setRun((n) => n + 1);
          setStage('play');
        }}
        onBoard={() => openBoard('dance')}
        onMenu={() => go('menu')}
      />
    );

  return (
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
          <h1 className="h1">{t('dance.title')}</h1>
          <div className="tabs">
            {(['easy', 'mid'] as const).map((l) => (
              <DwellButton
                key={l}
                variant="ghost"
                active={l === level}
                sub={t(`dance.${l}Sub`)}
                onSelect={() => setLevel(l)}
              >
                {t(`dance.${l}`)}
              </DwellButton>
            ))}
          </div>
        </div>
        <Speech mood="cheer" size={72}>
          {t('dance.greet')}
        </Speech>
        <section className="card dance-legend">
          <h2>
            <Music size={20} strokeWidth={2.75} color="var(--purple)" /> {t('dance.legend')}
          </h2>
          <ul>
            {MOVE_IDS.map((id) => (
              <li key={id}>
                <img src={icons[id].url} alt="" width={72} height={72} />
                <span>{t(MOVES[id].name)}</span>
              </li>
            ))}
          </ul>
        </section>
        <div className="dance-start">
          <DwellButton
            variant="primary"
            icon={<Play size={26} strokeWidth={2.75} fill="currentColor" />}
            onSelect={() => setStage('play')}
          >
            {t('dance.start')}
          </DwellButton>
          <p className="hands-hint">
            <HandsUpIcon size={22} /> {t('dance.handsUp')}
          </p>
        </div>
      </div>
    </div>
  );
}

function DanceGame({
  level,
  paused,
  onDone,
}: {
  level: Level;
  paused: boolean;
  onDone: (r: Final) => void;
}) {
  const loop = useLoop();
  const demo = useDemo();
  const finishDance = useApp((s) => s.finishDance);
  const lane = useRef<HTMLCanvasElement>(null);
  const ring = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const songRef = useRef<DombraSong | null>(null);
  const doneRef = useRef(onDone);
  useEffect(() => {
    doneRef.current = onDone;
  });
  const [note, setNote] = useState<Note | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [hud, setHud] = useState({ score: 0, combo: 0, accuracy: 0 });
  const [pop, setPop] = useState<Pop | null>(null);
  const icons = useMemo(() => moveIcons(), []);

  useEffect(() => {
    const notes = chart(level);
    const judge = new DanceJudge(notes);
    const song = new DombraSong();
    songRef.current = song;
    const latency = demo ? 0 : CAMERA_LATENCY_MS;
    const judged = new Map<number, JudgeEvent['hit']>();
    let popKey = 0;
    let ended = false;

    const handle = (events: JudgeEvent[]) => {
      if (!events.length) return;
      for (const e of events) {
        judged.set(e.note.i, e.hit);
        setPop({ key: ++popKey, hit: e.hit, points: e.points });
      }
      song.setHarmony(judge.combo >= HOT_COMBO);
      setHud({ score: judge.score, combo: judge.combo, accuracy: judge.accuracy });
    };

    if (demo) {
      const pose = demoDancePose(notes);
      demo.followTimeline((perf) => pose(song.songMsAt(perf)));
    }
    // the coach stops talking: the music and the beat are what matters now
    stopSpeech();
    song.start();

    const unsub = loop.subscribe((tick) => {
      const ms = song.songMsAt(tick.t - latency);
      const f = tick.features;
      const frame = tick.frame;
      handle(f && frame ? judge.update(ms, (m) => MOVES[m].match(f, frame)) : judge.advance(ms));
    });

    // display-rate drawing from the song position as heard (never from pose ticks)
    const canvas = lane.current!;
    const ctx = canvas.getContext('2d')!;
    const unfit = fitCanvas(canvas);
    const step = (level === 'mid' ? 2 : 4) * BEAT_MS;
    let shownNote = -1;
    let shownCount: number | null = null;
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const ms = song.songMsAt(performance.now());
      drawLane(ctx, ms, notes, judged, icons);

      // the next move to strike and the ring closing on its beat
      const upcoming = notes.find((n) => !judged.has(n.i) && n.t + 60 >= ms) ?? null;
      if ((upcoming?.i ?? -1) !== shownNote) {
        shownNote = upcoming?.i ?? -1;
        setNote(upcoming);
      }
      if (upcoming && ring.current) {
        const left = Math.min(1, Math.max(0, (upcoming.t - ms) / step));
        ring.current.style.setProperty('--left', left.toFixed(3));
      }
      if (bar.current) bar.current.style.width = `${Math.min(100, (ms / song.durationMs) * 100)}%`;

      // 4-3-2-1 on beats 4..7 of the intro
      const beat = Math.floor(ms / BEAT_MS);
      const c = beat >= 4 && beat <= 7 ? 8 - beat : null;
      if (c !== shownCount) {
        shownCount = c;
        setCount(c);
      }

      if (!ended && ms > song.durationMs + 400) {
        ended = true;
        handle(judge.advance(Infinity));
        const r: DanceResult = {
          score: judge.score,
          perfect: judge.counts.perfect,
          good: judge.counts.good,
          miss: judge.counts.miss,
          bestCombo: judge.bestCombo,
          accuracy: (judge.counts.perfect + 0.5 * judge.counts.good) / notes.length,
          grade: judge.grade,
          level,
        };
        const { xp, record } = finishDance(r, Date.now());
        doneRef.current({ ...r, xp, record });
      }
    };
    raf = requestAnimationFrame(draw);

    return () => {
      unsub();
      cancelAnimationFrame(raf);
      unfit();
      song.stop();
      demo?.followTimeline(null);
      demo?.perform(null);
    };
  }, [level, loop, demo, icons, finishDance]);

  useEffect(() => {
    if (paused) songRef.current?.pause();
    else songRef.current?.resume();
  }, [paused]);

  const hot = hud.combo >= HOT_COMBO;
  return (
    <>
      <OverlayCanvas loop={loop} />
      <div className={`hud dance-hud ${hot ? 'hot' : ''}`}>
        <ExitButton corner onExit={() => useApp.getState().go('games')} />
        <div className="dance-progress">
          <div ref={bar} className="dance-progress-fill" />
        </div>
        {note && (
          <div className="dance-move" key={`note-${note.i}`}>
            <div ref={ring} className="dance-ring">
              <img src={icons[note.move].url} alt="" />
            </div>
            <div className="dance-move-name">{t(MOVES[note.move].name)}</div>
          </div>
        )}
        <div className="dance-stats">
          <div className="hud-chip num">
            <Zap size={22} strokeWidth={2.5} fill="currentColor" /> {hud.score}
          </div>
          <div className={`hud-chip num ${hud.combo >= 8 ? 'dance-combo' : ''}`}>
            <Flame size={20} strokeWidth={2.75} fill="currentColor" /> {hud.combo}
            {multiplier(hud.combo) > 1 && <span className="ch-mult">×{multiplier(hud.combo)}</span>}
          </div>
          <div className="hud-chip num">
            <Target size={20} strokeWidth={2.75} /> {Math.round(hud.accuracy * 100)}%
          </div>
        </div>
        {hot && <div className="dance-jorga">{t('dance.jorga')}</div>}
        {count !== null && (
          <div className="countdown-big dance-count num" key={`count-${count}`}>
            {count}
          </div>
        )}
        {pop && (
          <div key={`pop-${pop.key}`} className={`dance-pop ${pop.hit}`}>
            {t(`dance.${pop.hit}` as I18nKey)}
            {pop.points > 0 && <span className="num"> +{pop.points}</span>}
          </div>
        )}
        <div className="dance-barys">
          <Mascot mood={hot ? 'cheer' : 'happy'} size={96} bob />
        </div>
        <canvas ref={lane} className="dance-lane" aria-hidden="true" />
      </div>
    </>
  );
}

const HIT_COLORS = { perfect: '#ffc800', good: '#58cc02', miss: '#ff4b4b' } as const;

/**
 * The lane: upcoming moves ride from the right toward the hit circle on the left; thin lines
 * are beats, thick ones bars. The circle pulses on every beat.
 */
function drawLane(
  ctx: CanvasRenderingContext2D,
  ms: number,
  notes: readonly Note[],
  judged: ReadonlyMap<number, JudgeEvent['hit']>,
  icons: ReturnType<typeof moveIcons>,
): void {
  const { width: w, height: h } = ctx.canvas;
  ctx.clearRect(0, 0, w, h);
  const hitX = w * HIT_X;
  const pxPerMs = (w - hitX) / LANE_AHEAD_MS;
  const xOf = (t: number) => hitX + (t - ms) * pxPerMs;
  const cy = h / 2;
  const r = h * 0.36;

  // beat and bar lines
  const first = Math.floor((ms - LANE_BEHIND_MS) / BEAT_MS);
  const last = Math.ceil((ms + LANE_AHEAD_MS) / BEAT_MS);
  for (let b = Math.max(0, first); b <= last; b++) {
    const x = xOf(b * BEAT_MS);
    const barLine = b % 4 === 0;
    ctx.fillStyle = barLine ? 'rgba(28, 176, 246, 0.55)' : 'rgba(28, 176, 246, 0.22)';
    ctx.fillRect(x - (barLine ? 2 : 1), h * 0.12, barLine ? 4 : 2, h * 0.76);
  }

  // the hit circle, pulsing on the beat
  const since = ((ms % BEAT_MS) + BEAT_MS) % BEAT_MS;
  const pulse = ms > 0 ? Math.max(0, 1 - since / 160) : 0;
  ctx.beginPath();
  ctx.arc(hitX, cy, r * (1.08 + 0.14 * pulse), 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 200, 0, ${0.18 + 0.3 * pulse})`;
  ctx.fill();
  ctx.lineWidth = Math.max(3, h * 0.035);
  ctx.strokeStyle = '#ffc800';
  ctx.stroke();

  // the moves
  for (const n of notes) {
    if (n.t < ms - LANE_BEHIND_MS) continue;
    if (n.t > ms + LANE_AHEAD_MS) break;
    const x = xOf(n.t);
    const hit = judged.get(n.i);
    const fade = hit ? Math.max(0, 1 - (ms - n.t) / LANE_BEHIND_MS) : 1;
    ctx.globalAlpha = hit === 'miss' ? 0.5 * fade : fade;
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = Math.max(3, h * 0.04);
    ctx.strokeStyle = hit ? HIT_COLORS[hit] : '#84d8ff';
    ctx.stroke();
    const s = r * 1.7;
    ctx.drawImage(icons[n.move].canvas, x - s / 2, cy - s / 2, s, s);
    ctx.globalAlpha = 1;
  }
}

function DanceResults({
  r,
  onAgain,
  onBoard,
  onMenu,
}: {
  r: Final;
  onAgain: () => void;
  onBoard: () => void;
  onMenu: () => void;
}) {
  // no "hands up = again" here: arms up is also the last move of the song
  useGestures({ crossArms: onMenu });
  useEffect(() => {
    speak(
      (tr) =>
        `${tr('dance.over')}. ${r.grade}. ${tr('dance.score')}: ${r.score}. ${r.record ? tr('ch.record') : ''}`,
    );
  }, [r]);
  return (
    <>
      {(r.record || r.grade === 'S') && <Confetti />}
      <div className="page">
        <div className="page-inner center">
          <div className="results-head">
            <Mascot mood={['S', 'A', 'B'].includes(r.grade) ? 'cheer' : 'happy'} size={110} bob />
            <div className="results-headline">
              <h1 className="results-title">{t('dance.over')}</h1>
              {r.record && (
                <div className="record-badge">
                  <Trophy size={20} strokeWidth={2.75} /> {t('ch.record')}
                </div>
              )}
            </div>
            <div className={`dance-grade g${r.grade}`}>{r.grade}</div>
          </div>
          <div className="ch-final num">{r.score}</div>
          <div className="stats" style={{ width: 'min(900px, 100%)' }}>
            <StatBox
              label={t('dance.accuracy')}
              value={`${Math.round(r.accuracy * 100)}%`}
              color="blue"
            />
            <StatBox label={t('dance.perfects')} value={r.perfect} color="gold" />
            <StatBox label={t('dance.goods')} value={r.good} color="green" />
            <StatBox label={t('dance.misses')} value={r.miss} color="red" />
            <StatBox label={t('ch.bestCombo')} value={r.bestCombo} color="orange" />
            <StatBox label={t('results.xp')} value={`+${r.xp}`} color="purple" />
          </div>
          <div className="menu-row">
            <DwellButton
              variant="primary"
              icon={<RotateCcw size={24} strokeWidth={2.75} />}
              onSelect={onAgain}
            >
              {t('dance.again')}
            </DwellButton>
            <DwellButton
              icon={<Trophy size={24} strokeWidth={2.75} />}
              tone="gold"
              onSelect={onBoard}
            >
              {t('results.records')}
            </DwellButton>
            <DwellButton
              variant="ghost"
              icon={<House size={22} strokeWidth={2.75} />}
              onSelect={onMenu}
            >
              {t('results.menu')}
            </DwellButton>
          </div>
        </div>
      </div>
    </>
  );
}
