import { describe, expect, it, vi } from 'vitest';
import { loadProgress, type Progress } from './progress';
import { LocalLeaderboard, periodStart, SupabaseLeaderboard } from './leaderboard';

const NOW = new Date('2026-09-29T15:00:00').getTime();
const H = 3_600_000;

describe('local leaderboard', () => {
  const progress: Progress = {
    ...loadProgress(undefined),
    scores: [
      { name: 'A', score: 900, mode: 'challenge', at: NOW - 2 * H },
      { name: 'B', score: 1200, mode: 'challenge', at: NOW - 30 * H },
      { name: 'C', score: 700, mode: 'challenge', at: NOW - 10 * 24 * H },
      { name: 'D', score: 300, mode: 'workout', at: NOW - H },
    ],
  };
  const lb = new LocalLeaderboard(
    () => progress,
    () => NOW,
  );

  it('filters by mode and period and sorts by score', async () => {
    expect((await lb.top('challenge', 'today')).map((e) => e.name)).toEqual(['A']);
    expect((await lb.top('challenge', 'week')).map((e) => e.name)).toEqual(['B', 'A']);
    expect((await lb.top('challenge', 'all')).map((e) => e.name)).toEqual(['B', 'A', 'C']);
    expect((await lb.top('workout', 'all')).map((e) => e.name)).toEqual(['D']);
  });

  it('period starts at local midnight', () => {
    const d = new Date(periodStart('today', NOW));
    expect([d.getHours(), d.getMinutes()]).toEqual([0, 0]);
    expect(periodStart('all', NOW)).toBe(0);
  });
});

describe('supabase leaderboard', () => {
  it('builds PostgREST requests with the anon key', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify([{ name: 'X', score: 5, mode: 'challenge', at: '2026-09-29T10:00:00Z' }]),
        ),
    );
    const lb = new SupabaseLeaderboard(
      'https://p.supabase.co',
      'anon',
      fetchFn as unknown as typeof fetch,
      () => NOW,
    );
    const rows = await lb.top('challenge', 'today', 5);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/rest/v1/scores?');
    expect(url).toContain('mode=eq.challenge');
    expect(url).toContain('order=score.desc');
    expect(url).toContain('limit=5');
    expect(decodeURIComponent(url)).toContain('at=gte.');
    expect((init.headers as Record<string, string>).apikey).toBe('anon');
    expect(rows[0]).toMatchObject({ name: 'X', score: 5 });

    await lb.submit({
      name: 'Очень-длинное-имя-батыра-больше-32-символов',
      score: 12.6,
      mode: 'challenge',
      at: NOW,
    });
    const body = JSON.parse(
      (fetchFn.mock.calls[1] as unknown as [string, RequestInit])[1].body as string,
    );
    expect(body.name.length).toBeLessThanOrEqual(32);
    expect(body.score).toBe(13);
    expect(body).not.toHaveProperty('at'); // server time, not the device clock
  });

  it('throws on HTTP errors so the UI can fall back to local', async () => {
    const lb = new SupabaseLeaderboard(
      'https://p',
      'k',
      (async () => new Response('', { status: 500 })) as unknown as typeof fetch,
    );
    await expect(lb.top('challenge', 'all')).rejects.toThrow();
  });
});
