# Мировая таблица лидеров (опционально, ≈5 минут)

Без настройки приложение показывает рекорды **этого устройства**. Для общей таблицы на всех устройствах:

1. Создайте бесплатный проект на https://supabase.com → **SQL Editor** → выполните:

```sql
create table public.scores (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 32),
  score integer not null check (score between 0 and 100000),
  mode text not null check (mode in ('challenge', 'workout')),
  at timestamptz not null default now()
);
create index scores_mode_score on public.scores (mode, score desc);

alter table public.scores enable row level security;
-- anyone can read the board
create policy "read" on public.scores for select using (true);
-- anyone can add a score, but only a sane one and only "now" (the app never sends `at`; the default now() is used)
create policy "insert" on public.scores for insert
  with check (at between now() - interval '5 minutes' and now() + interval '5 minutes');
```

2. **Project Settings → API**: скопируйте `Project URL` и `anon public` key.
3. Перед сборкой задайте переменные (в `.env` при локальной сборке или в Netlify → **Site configuration → Environment variables**):
   - `VITE_SUPABASE_URL` = Project URL
   - `VITE_SUPABASE_ANON_KEY` = anon key
4. Пересоберите и задеплойте. В «Рекордах» появится переключатель **«Мир / Это устройство»**.

`netlify.toml` (и `vercel.json`) уже разрешает запросы к `*.supabase.co` в CSP. Anon key публичный по дизайну Supabase:
защиту обеспечивают RLS-политики выше (только чтение и вставка, с ограничениями).
