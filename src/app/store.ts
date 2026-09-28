import { create } from 'zustand';
import { setLang as setI18nLang, type Lang } from '@/i18n';
import { setMuted } from '@/audio/tts';
import type { Program } from '@/game/program';
import { summarize, type ExerciseResult, type WorkoutSummary } from '@/game/summary';
import {
  isRecord,
  loadProgress,
  recordChallenge,
  recordWorkout,
  saveProgress,
  type Progress,
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
  | 'records';

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

  go(screen: Screen): void;
  dismissToast(id: string): void;
  setDemo(demo: boolean): void;
  setLang(lang: Lang): void;
  toggleMute(): void;
  setCalibrated(): void;
  setBaseline(b: Baseline | null): void;
  startProgram(p: Program): void;
  finishWorkout(results: ExerciseResult[], startedAt: number, endedAt: number): void;
  finishChallenge(r: Omit<ChallengeResult, 'record'>, at: number): void;
  setPlayerName(name: string): void;
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

const progress0 = loadProgress();
const muted0 = initialMuted();
setMuted(muted0);
const lang0 = initialLang();
setI18nLang(lang0);

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
  playerName: progress0.playerName ?? randomBatyrName(),
  toasts: [],
  questCompleted: null,
  demo: false,

  go: (screen) => set({ screen }),
  dismissToast: (id) => set({ toasts: get().toasts.filter((a) => a.id !== id) }),
  setDemo: (demo) => set({ demo }),

  setLang: (lang) => {
    setI18nLang(lang);
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

  setCalibrated: () => set({ calibrated: true, screen: 'menu' }),
  setBaseline: (baseline) => set({ baseline }),

  startProgram: (program) => set({ program, screen: 'workout' }),

  finishWorkout: (results, startedAt, endedAt) => {
    const { program, progress, playerName } = get();
    const summary = summarize(program?.id ?? 'single', results, startedAt, endedAt);
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
    const out = applySession(recorded, { challenge: { bestCombo: r.bestCombo }, now: at });
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

  setPlayerName: (playerName) => {
    const progress = { ...get().progress, playerName };
    saveProgress(progress);
    set({ playerName, progress });
  },
}));

// e2e / debugging hook: drive screens from Playwright (?e2e in the URL)
if (typeof window !== 'undefined' && new URLSearchParams(location.search).has('e2e')) {
  (window as unknown as { __app: typeof useApp }).__app = useApp;
}
