import type { Progress, ScoreEntry } from './progress';

export type Mode = ScoreEntry['mode'];
export type Period = 'today' | 'week' | 'all';

export interface LeaderboardEntry {
  name: string;
  score: number;
  mode: Mode;
  at: number;
}

export interface LeaderboardProvider {
  readonly id: 'local' | 'global';
  submit(e: LeaderboardEntry): Promise<void>;
  top(mode: Mode, period: Period, n?: number): Promise<LeaderboardEntry[]>;
}

/** Start of the period in local time (today = since midnight, week = last 7 days). */
export function periodStart(period: Period, now: number): number {
  if (period === 'all') return 0;
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return period === 'today' ? d.getTime() : d.getTime() - 6 * 86_400_000;
}

/** Scores stored on this device (see progress.scores). */
export class LocalLeaderboard implements LeaderboardProvider {
  readonly id = 'local' as const;
  constructor(
    private readonly getProgress: () => Progress,
    private readonly now: () => number = Date.now,
  ) {}

  async submit(): Promise<void> {
    /* local scores are written by recordWorkout / recordChallenge */
  }

  async top(mode: Mode, period: Period, n = 10): Promise<LeaderboardEntry[]> {
    const from = periodStart(period, this.now());
    return this.getProgress()
      .scores.filter((s) => s.mode === mode && s.at >= from)
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  }
}

/**
 * World leaderboard on Supabase (PostgREST), enabled by VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY.
 * Table + row-level-security policies: docs/LEADERBOARD.md.
 */
export class SupabaseLeaderboard implements LeaderboardProvider {
  readonly id = 'global' as const;
  constructor(
    private readonly url: string,
    private readonly key: string,
    private readonly fetchFn: typeof fetch = (...a) => fetch(...a),
    private readonly now: () => number = Date.now,
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      apikey: this.key,
      Authorization: `Bearer ${this.key}`,
      'Content-Type': 'application/json',
      ...extra,
    };
  }

  async submit(e: LeaderboardEntry): Promise<void> {
    const res = await this.fetchFn(`${this.url}/rest/v1/scores`, {
      method: 'POST',
      headers: this.headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        name: e.name.slice(0, 32),
        score: Math.round(e.score),
        mode: e.mode,
        // no client time: the column defaults to now() on the server (device clocks drift)
      }),
    });
    if (!res.ok) throw new Error(`leaderboard submit failed: ${res.status}`);
  }

  async top(mode: Mode, period: Period, n = 10): Promise<LeaderboardEntry[]> {
    const q = new URLSearchParams({
      select: 'name,score,mode,at',
      mode: `eq.${mode}`,
      order: 'score.desc',
      limit: String(n),
    });
    const from = periodStart(period, this.now());
    if (from > 0) q.set('at', `gte.${new Date(from).toISOString()}`);
    const res = await this.fetchFn(`${this.url}/rest/v1/scores?${q}`, { headers: this.headers() });
    if (!res.ok) throw new Error(`leaderboard query failed: ${res.status}`);
    const rows = (await res.json()) as { name: string; score: number; mode: Mode; at: string }[];
    return rows.map((r) => ({ name: r.name, score: r.score, mode: r.mode, at: Date.parse(r.at) }));
  }
}

export interface MyPlace {
  /** 1-based place of the player's best row */
  place: number;
  score: number;
  /** points still needed to overtake the row above (0 when first) */
  gap: number;
}

/** Where the player stands on a board (their best row), or null if they are not on it. */
export function myPlace(rows: readonly LeaderboardEntry[], name: string): MyPlace | null {
  const i = rows.findIndex((r) => r.name === name);
  if (i < 0) return null;
  const score = rows[i]!.score;
  const above = rows
    .slice(0, i)
    .reverse()
    .find((r) => r.score > score);
  return { place: i + 1, score, gap: above ? above.score - score + 1 : 0 };
}

/** Configured world leaderboard, or null when the env vars are not set. */
export function globalLeaderboard(): SupabaseLeaderboard | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return url && key ? new SupabaseLeaderboard(url.replace(/\/$/, ''), key) : null;
}
