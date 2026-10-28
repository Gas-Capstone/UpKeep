-- Timed exercises in a plan (cardio, holds like a plank): each set lasts
-- duration_seconds instead of being counted in reps. reps is null on these
-- rows; the app shows "30 min" or "3 sets × 45 sec" for them.
alter table public.workout_plan_workouts
  add column if not exists duration_seconds integer
    constraint workout_plan_workouts_duration_positive check (duration_seconds > 0);

comment on column public.workout_plan_workouts.duration_seconds is
  'For timed exercises (cardio, holds): how long each set lasts. reps is null on these rows.';
