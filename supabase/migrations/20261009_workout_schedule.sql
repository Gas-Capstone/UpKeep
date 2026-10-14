-- Scheduled workouts: a workout plan placed at a time of day that either
-- repeats on weekdays (like a habit) or falls on one date (like a one-off
-- planned meal). They show on the Habits page.
--
-- A scheduled workout counts as done on a day if the user logged a
-- workout_sessions row for that plan that day, or ticked it off by hand
-- (workout_schedule_completions).

create table if not exists public.workout_schedule_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  workout_plan_id uuid not null references public.workout_plans (id) on delete cascade,
  -- Same "h:mm AM" format as habits.time.
  scheduled_time text not null,
  -- null = one-off on planned_date; '{}' = every day; otherwise 0 (Sun)-6 (Sat).
  weekdays smallint[],
  planned_date date,
  created_at timestamptz not null default now(),
  constraint workout_schedule_entries_schedule_check
    check ((planned_date is null) <> (weekdays is null))
);

create table if not exists public.workout_schedule_completions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_id uuid not null references public.workout_schedule_entries (id) on delete cascade,
  completed_on date not null,
  primary key (entry_id, completed_on)
);

alter table public.workout_schedule_entries enable row level security;
alter table public.workout_schedule_completions enable row level security;

drop policy if exists "Users manage their own scheduled workouts"
  on public.workout_schedule_entries;
create policy "Users manage their own scheduled workouts"
  on public.workout_schedule_entries
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users manage their own workout check-offs"
  on public.workout_schedule_completions;
create policy "Users manage their own workout check-offs"
  on public.workout_schedule_completions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
