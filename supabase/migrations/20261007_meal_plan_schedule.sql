-- Meal planning now shares the habits schedule model: each planned meal has a
-- time of day and either repeats on weekdays (like a habit) or falls on one
-- date. Planned meals can be checked off per day, like habit_completions.
--
-- Run once in the Supabase SQL editor before shipping the app change.

-- 1. Time of day, stored in the same "h:mm AM" format as habits.time.
alter table public.meal_plan_entries add column if not exists meal_time text;

update public.meal_plan_entries
set meal_time = case meal_type
  when 'breakfast' then '8:00 AM'
  when 'lunch' then '12:00 PM'
  when 'snack' then '3:00 PM'
  else '6:00 PM'
end
where meal_time is null;

alter table public.meal_plan_entries alter column meal_time set not null;

-- 2. Weekly repeat. null = one-off on planned_date; '{}' = every day;
--    otherwise 0 (Sun) through 6 (Sat), same as habits.weekdays.
alter table public.meal_plan_entries add column if not exists weekdays smallint[];
alter table public.meal_plan_entries alter column planned_date drop not null;

alter table public.meal_plan_entries
  drop constraint if exists meal_plan_entries_schedule_check;
alter table public.meal_plan_entries
  add constraint meal_plan_entries_schedule_check
  check ((planned_date is null) <> (weekdays is null));

-- 3. A day can now hold more than one meal of a type (e.g. two snacks), and
--    repeating entries have no date, so the old one-recipe-per-slot unique
--    constraint on (user_id, planned_date, meal_type) goes.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select conname from pg_constraint
    where conrelid = 'public.meal_plan_entries'::regclass and contype = 'u'
  loop
    execute format(
      'alter table public.meal_plan_entries drop constraint %I',
      constraint_name
    );
  end loop;
end $$;

-- 4. Per-day check-offs, mirroring habit_completions.
create table if not exists public.meal_plan_completions (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_id uuid not null references public.meal_plan_entries (id) on delete cascade,
  completed_on date not null,
  primary key (entry_id, completed_on)
);

alter table public.meal_plan_completions enable row level security;

drop policy if exists "Users manage their own meal completions"
  on public.meal_plan_completions;
create policy "Users manage their own meal completions"
  on public.meal_plan_completions
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
