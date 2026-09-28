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

export type Screen =
  | 'calibration'
  | 'menu'
  | 'pick'
  | 'workout'
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
  program: Program | null;
  summary: WorkoutSummary | null;
  /** xp before the last result, to animate rank-ups */
  xpBefore: number;
  challenge: ChallengeResult | null;
  progress: Progress;
  playerName: string;

  go(screen: Screen): void;
  setLang(lang: Lang): void;
  toggleMute(): void;
  setCalibrated(): void;
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

export const useApp = create<AppState>((set, get) => ({
  screen: 'calibration',
  lang: lang0,
  muted: muted0,
  calibrated: false,
  program: null,
  summary: null,
  xpBefore: progress0.totalXp,
  challenge: null,
  progress: progress0,
  playerName: progress0.playerName ?? randomBatyrName(),

  go: (screen) => set({ screen }),

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

  startProgram: (program) => set({ program, screen: 'workout' }),

  finishWorkout: (results, startedAt, endedAt) => {
    const { program, progress, playerName } = get();
    const summary = summarize(program?.id ?? 'single', results, startedAt, endedAt);
    const next = recordWorkout({ ...progress, playerName }, summary, playerName);
    saveProgress(next);
    set({ summary, xpBefore: progress.totalXp, progress: next, screen: 'results' });
  },

  finishChallenge: (r, at) => {
    const { progress, playerName } = get();
    const record = isRecord(progress, 'challenge', r.score);
    const next = recordChallenge({ ...progress, playerName }, r.score, playerName, at, r.xp);
    saveProgress(next);
    set({
      challenge: { ...r, record },
      xpBefore: progress.totalXp,
      progress: next,
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
