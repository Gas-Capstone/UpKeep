-- The first-time app tour is shown once per account (not per device), the
-- first time the user reaches the Home screen. tour_seen_at records when.
alter table public.profiles add column if not exists tour_seen_at timestamptz;

-- Existing accounts have already been using the app, so don't show them the
-- first-time tour. They can still replay it from Settings.
update public.profiles set tour_seen_at = now() where tour_seen_at is null;
