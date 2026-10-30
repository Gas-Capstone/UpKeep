-- 1. What each finished session was measured against, so History can reopen
-- its summary. Weight lifted and personal records aren't stored here: they're
-- worked out from workout_exercise_results when a summary is opened, so
-- deleting a session updates the records of the sessions after it.
--
-- Null on sessions saved before these were recorded.
alter table public.workout_sessions
  add column if not exists planned_min integer check (planned_min > 0),
  add column if not exists sets_done integer check (sets_done >= 0),
  add column if not exists sets_total integer check (sets_total >= 0),
  add column if not exists exercises_done integer check (exercises_done >= 0),
  add column if not exists exercises_total integer check (exercises_total >= 0);

-- 2. Sets and reps (or set length) a user changed on a built-in plan,
-- remembered for their next session of it. Only exercises that differ from
-- the plan are stored; changing one back removes its row. A user's own plans
-- aren't covered: they change those by editing the plan.
create table if not exists public.workout_plan_overrides (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  workout_plan_id uuid not null references public.workout_plans (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  sets integer not null check (sets between 1 and 999),
  reps integer check (reps between 1 and 999),
  duration_seconds integer check (duration_seconds > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, workout_plan_id, workout_id),
  constraint workout_plan_overrides_counted_or_timed
    check ((reps is null) <> (duration_seconds is null))
);

alter table public.workout_plan_overrides enable row level security;

drop policy if exists "Users read their own overrides" on public.workout_plan_overrides;
create policy "Users read their own overrides"
  on public.workout_plan_overrides for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users save overrides on built-in plans" on public.workout_plan_overrides;
create policy "Users save overrides on built-in plans"
  on public.workout_plan_overrides for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.workout_plans p
      where p.id = workout_plan_overrides.workout_plan_id and p.created_by is null
    )
  );

drop policy if exists "Users change their own overrides" on public.workout_plan_overrides;
create policy "Users change their own overrides"
  on public.workout_plan_overrides for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.workout_plans p
      where p.id = workout_plan_overrides.workout_plan_id and p.created_by is null
    )
  );

drop policy if exists "Users remove their own overrides" on public.workout_plan_overrides;
create policy "Users remove their own overrides"
  on public.workout_plan_overrides for delete to authenticated
  using (user_id = auth.uid());

grant select, insert, update, delete on public.workout_plan_overrides to authenticated;
