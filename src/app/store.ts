import { create } from 'zustand';
import { setLang as setI18nLang, type Lang } from '@/i18n';
import { setMuted } from '@/audio/tts';
import type { Program } from '@/game/program';
import { summarize, type ExerciseResult, type WorkoutSummary } from '@/game/summary';
import {
  isRecord,
  loadProgress,
  renameScores,
  recordChallenge,
  recordScore,
  recordWorkout,
  saveProgress,
  type Progress,
  type ScoreEntry,
} from '@/storage/progress';
import { randomBatyrName } from '@/storage/names';
import type { Baseline } from '@/engine/baseline';
import { applySession } from '@/game/progression';
import { globalLeaderboard, type LeaderboardEntry } from '@/storage/leaderboard';
import type { AchievementDef } from '@/game/achievements';
import type { QuestDef } from '@/game/daily';

export type Screen =
  | 'calibration'
  | 'menu'
  | 'pick'
  | 'workout'
  | 'free'
  | 'results'
  | 'challenge'
  | 'challengeResults'
  | 'records'
  | 'profile'
  | 'moves'
  | 'settings'
  | 'floor'
  | 'games'
  | 'duel'
  | 'dance';

/** One Qara Zhorga song as the judge saw it. */
export interface DanceResult {
  score: number;
  perfect: number;
  good: number;
  miss: number;
  bestCombo: number;
  /** 0..1 */
  accuracy: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  level: 'easy' | 'mid';
}

export interface ChallengeResult {
  score: number;
  hits: number;
  clean: number;
  misses: number;
  bestCombo: number;
  xp: number;
  record: boolean;
}

interface AppState {
  screen: Screen;
  lang: Lang;
  muted: boolean;
  calibrated: boolean;
  /** personal standing baseline captured during calibration */
  baseline: Baseline | null;
  program: Program | null;
  summary: WorkoutSummary | null;
  /** xp before the last result, to animate rank-ups */
  xpBefore: number;
  challenge: ChallengeResult | null;
  progress: Progress;
  playerName: string;
  /** achievements unlocked by the last session, shown as toasts */
  toasts: AchievementDef[];
  /** quest of the day completed by the last session */
  questCompleted: QuestDef | null;
  /** demo mode: nothing is persisted or sent to the world leaderboard */
  demo: boolean;
  /** the first-visit tour of the menu (mascot + spotlight) is open */
  tutorial: boolean;
  /** the leaderboard tab to open with */
  boardMode: ScoreEntry['mode'];
  /** open the leaderboard on a given tab */
  openBoard(mode: ScoreEntry['mode']): void;

  go(screen: Screen): void;
  dismissToast(id: string): void;
  setDemo(demo: boolean): void;
  setLang(lang: Lang): void;
  toggleMute(): void;
  setCalibrated(): void;
  setBaseline(b: Baseline | null): void;
  startProgram(p: Program): void;
  finishWorkout(
    results: ExerciseResult[],
    startedAt: number,
    endedAt: number,
    programId?: Program['id'],
  ): void;
  finishChallenge(r: Omit<ChallengeResult, 'record'>, at: number): void;
  /** records the song and returns the XP it earned and whether it is a new record */
  finishDance(r: DanceResult, at: number): { xp: number; record: boolean };
  setPlayerName(name: string): void;
  openTutorial(): void;
  closeTutorial(): void;
}

const LANG_KEY = 'qozgal.lang';
const initialLang = (): Lang => {
  try {
    const l = localStorage.getItem(LANG_KEY);
    if (l === 'ru' || l === 'kk' || l === 'en') return l;
  } catch {
    /* ignore */
  }
  return navigator.language?.startsWith('kk') ? 'kk' : 'ru';
};

const MUTE_KEY = 'qozgal.muted';
const initialMuted = (): boolean => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
};

const TUTORIAL_KEY = 'qozgal.tutorial.v1';
const tutorialSeen = (): boolean => {
  try {
    return localStorage.getItem(TUTORIAL_KEY) === '1';
  } catch {
    return false;
  }
};

const loaded = loadProgress();
// first visit: the player gets a random batyr name + digits right away (changeable in the profile)
const progress0 = loaded.playerName ? loaded : { ...loaded, playerName: randomBatyrName() };
if (!loaded.playerName) saveProgress(progress0);
const muted0 = initialMuted();
setMuted(muted0);
const lang0 = initialLang();
setI18nLang(lang0);
if (typeof document !== 'undefined') document.documentElement.lang = lang0;

/** Save locally and post to the world leaderboard (if configured) — never in demo mode. */
function persist(p: Progress, demo: boolean, entry: LeaderboardEntry): void {
  if (demo) return;
  saveProgress(p);
  if (entry.score > 0)
    globalLeaderboard()
      ?.submit(entry)
      .catch((e) => console.warn('[leaderboard]', e));
}

export const useApp = create<AppState>((set, get) => ({
  screen: 'calibration',
  lang: lang0,
  muted: muted0,
  calibrated: false,
  baseline: null,
  program: null,
  summary: null,
  xpBefore: progress0.totalXp,
  challenge: null,
  progress: progress0,
  playerName: progress0.playerName!,
  toasts: [],
  questCompleted: null,
  demo: false,
  tutorial: false,
  boardMode: 'challenge',

  go: (screen) => set({ screen }),
  openBoard: (boardMode) => set({ boardMode, screen: 'records' }),
  dismissToast: (id) => set({ toasts: get().toasts.filter((a) => a.id !== id) }),
  setDemo: (demo) => set({ demo }),

  setLang: (lang) => {
    setI18nLang(lang);
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(LANG_KEY, lang);
    } catch {
      /* ignore */
    }
    set({ lang });
  },

  toggleMute: () => {
    const muted = !get().muted;
    setMuted(muted);
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      /* ignore */
    }
    set({ muted });
  },

  // the tour opens on the first arrival at the menu (never in the camera-less demo)
  setCalibrated: () =>
    set({ calibrated: true, screen: 'menu', tutorial: !get().demo && !tutorialSeen() }),
  setBaseline: (baseline) => set({ baseline }),

  startProgram: (program) => set({ program, screen: 'workout' }),

  finishWorkout: (results, startedAt, endedAt, programId) => {
    const { program, progress, playerName } = get();
    const summary = summarize(programId ?? program?.id ?? 'single', results, startedAt, endedAt);
    const recorded = recordWorkout({ ...progress, playerName }, summary, playerName);
    const out = applySession(recorded, { workout: summary, now: endedAt });
    persist(out.progress, get().demo, {
      name: playerName,
      score: summary.xp,
      mode: 'workout',
      at: endedAt,
    });
    set({
      summary,
      xpBefore: progress.totalXp,
      progress: out.progress,
      toasts: [...get().toasts, ...out.unlocked],
      questCompleted: out.questCompleted,
      screen: 'results',
    });
  },

  finishChallenge: (r, at) => {
    const { progress, playerName } = get();
    const record = isRecord(progress, 'challenge', r.score);
    const recorded = recordChallenge({ ...progress, playerName }, r.score, playerName, at, r.xp);
    const out = applySession(recorded, {
      challenge: { bestCombo: r.bestCombo, hits: r.hits },
      now: at,
    });
    persist(out.progress, get().demo, { name: playerName, score: r.score, mode: 'challenge', at });
    set({
      challenge: { ...r, record },
      xpBefore: progress.totalXp,
      progress: out.progress,
      toasts: [...get().toasts, ...out.unlocked],
      questCompleted: out.questCompleted,
      screen: 'challengeResults',
    });
  },

  finishDance: (r, at) => {
    const { progress, playerName } = get();
    const record = isRecord(progress, 'dance', r.score);
    const xp = Math.round(r.score / 20);
    const recorded = recordScore({ ...progress, playerName }, 'dance', r.score, playerName, at, xp);
    const out = applySession(recorded, {
      dance: { bestCombo: r.bestCombo, hits: r.perfect + r.good },
      now: at,
    });
    persist(out.progress, get().demo, { name: playerName, score: r.score, mode: 'dance', at });
    set({
      xpBefore: progress.totalXp,
      progress: out.progress,
      toasts: [...get().toasts, ...out.unlocked],
      questCompleted: out.questCompleted,
    });
    return { xp, record };
  },

  setPlayerName: (playerName) => {
    const old = get().playerName;
    const progress = { ...renameScores(get().progress, old, playerName), playerName };
    if (!get().demo) saveProgress(progress);
    set({ playerName, progress });
  },

  openTutorial: () => set({ tutorial: true, screen: 'menu' }),
  closeTutorial: () => {
    try {
      localStorage.setItem(TUTORIAL_KEY, '1');
    } catch {
      /* ignore */
    }
    set({ tutorial: false });
  },
}));

// e2e / debugging hook: drive screens from Playwright (?e2e in the URL)
if (typeof window !== 'undefined' && new URLSearchParams(location.search).has('e2e')) {
  (window as unknown as { __app: typeof useApp }).__app = useApp;
}
