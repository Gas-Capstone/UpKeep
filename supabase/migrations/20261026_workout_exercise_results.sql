-- What was done on each exercise in a finished workout session, so the app
-- can show personal records. One row per exercise with at least one set
-- logged. A row is either counted (reps, with an optional weight) or timed
-- (duration_seconds), never both.
--
-- workout_session_exercises is something else: per-plan progress from an
-- earlier timer design, one row per user, plan and exercise. It can't hold
-- history, so it's left as it is.
create table if not exists public.workout_exercise_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  sets_done integer not null check (sets_done between 1 and 999),
  reps integer check (reps between 1 and 999),
  weight_kg numeric(6, 2) check (weight_kg between 0 and 9999),
  duration_seconds integer check (duration_seconds > 0),
  created_at timestamptz not null default now(),
  constraint workout_exercise_results_counted_or_timed
    check ((reps is null) <> (duration_seconds is null)),
  constraint workout_exercise_results_once_per_session unique (session_id, workout_id)
);

-- Records are looked up per user and exercise.
create index if not exists workout_exercise_results_user_workout
  on public.workout_exercise_results (user_id, workout_id);

alter table public.workout_exercise_results enable row level security;

drop policy if exists "Users read their own results" on public.workout_exercise_results;
create policy "Users read their own results"
  on public.workout_exercise_results for select to authenticated
  using (user_id = auth.uid());

-- Results can only go into the user's own sessions.
drop policy if exists "Users save results for their own sessions" on public.workout_exercise_results;
create policy "Users save results for their own sessions"
  on public.workout_exercise_results for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.workout_sessions s
      where s.id = workout_exercise_results.session_id and s.user_id = auth.uid()
    )
  );

grant select, insert on public.workout_exercise_results to authenticated;
