-- Performance metrics: the table the app writes events into, the views for
-- reading them in the Supabase dashboard, and the developer-only summary the
-- in-app Performance screen calls.
--
-- Run the whole file in the SQL editor. Safe to re-run.
--
-- What gets recorded (see src/lib/metrics.ts):
--   supabase_request  every call through the Supabase client: method, path, status
--   agent_turn        every message to the assistant: outcome, tools, and the
--                     server's own phase timings (auth / model / tools)
--   image_error       a photo that failed to load: which bucket
--   data_load         a screen's data arriving (meals catalog, fridge, workout
--                     plans and history, the exercise library, habits, a
--                     workout's exercises and records): the whole wait the
--                     user sees, and how many rows came back
--   workout_session   a workout ending: how (all sets done, time up, stopped
--                     early), planned minutes, sets done of total, and
--                     whether its exercise details saved
--   notifications_sync  reminders being rebuilt: permission state, reminders
--                     built vs actually scheduled
--   notification_opened a reminder being tapped: which kind
--
-- Deliberately never recorded: message text, ingredient or habit names, meal
-- contents, query parameters, storage object names. Ids, durations and
-- outcome codes only.

-- ---------------------------------------------------------------------------
-- 1. Events
-- ---------------------------------------------------------------------------
create table if not exists public.app_events (
  id          bigint generated always as identity primary key,
  -- Supplied by the client: events are batched, so insert time can trail the
  -- moment it happened by up to the flush interval.
  created_at  timestamptz not null default now(),
  -- Deleting an account deletes its events with it.
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) <= 64),
  -- Up to 24 hours: workout sessions run far longer than any request does.
  duration_ms integer check (duration_ms is null or duration_ms between 0 and 86400000),
  ok          boolean,
  platform    text check (char_length(platform) <= 16),
  app_version text check (char_length(app_version) <= 32),
  -- The EAS update the event came from: 'dev' under Metro, 'embedded' for the
  -- bundle shipped inside a build. Lets the views compare one update with the
  -- last, which is how a regression gets pinned to a release.
  update_id   text check (char_length(update_id) <= 64),
  -- Any signed-in user can insert, so payload size is capped here rather
  -- than trusted to the client.
  props       jsonb not null default '{}'::jsonb check (pg_column_size(props) <= 4096)
);

-- If app_events already existed — for example the shorter version of this
-- table sketched while metrics were being planned — `create table if not
-- exists` above leaves it as it was, and the first function below that reads
-- a newer column fails with "column update_id does not exist". So bring an
-- existing table up to the definition above. On a fresh one this is a no-op.
alter table public.app_events add column if not exists platform    text;
alter table public.app_events add column if not exists app_version text;
alter table public.app_events add column if not exists update_id   text;

-- The sketch allowed a null user_id and had no foreign key. A row with no user
-- could never have passed the insert policy, so the only rows this can remove
-- are test rows inserted by hand from the SQL editor.
delete from public.app_events where user_id is null;
alter table public.app_events alter column user_id set default auth.uid();
alter table public.app_events alter column user_id set not null;

-- The first version of this script capped durations at 10 minutes, which a
-- workout session exceeds — and one rejected row takes its whole batch with
-- it. A check constraint can't be altered in place, so drop it here and let
-- the loop below add the current one.
alter table public.app_events drop constraint if exists app_events_duration_ms_check;

-- Constraints written inline above only exist when the table is created fresh,
-- so add any that are missing. NOT VALID: rows already present are not
-- re-checked, while every new row is.
do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('app_events_name_check',        'check (char_length(name) <= 64)'),
      ('app_events_duration_ms_check', 'check (duration_ms is null or duration_ms between 0 and 86400000)'),
      ('app_events_platform_check',    'check (char_length(platform) <= 16)'),
      ('app_events_app_version_check', 'check (char_length(app_version) <= 32)'),
      ('app_events_update_id_check',   'check (char_length(update_id) <= 64)'),
      ('app_events_props_check',       'check (pg_column_size(props) <= 4096)'),
      ('app_events_user_id_fkey',      'foreign key (user_id) references auth.users (id) on delete cascade')
    ) as t(conname, definition)
  loop
    if not exists (
      select 1 from pg_constraint
      where conrelid = 'public.app_events'::regclass and conname = c.conname
    ) then
      execute format(
        'alter table public.app_events add constraint %I %s not valid',
        c.conname, c.definition
      );
    end if;
  end loop;
end
$$;

create index if not exists app_events_created_at_idx
  on public.app_events (created_at desc);
create index if not exists app_events_name_created_at_idx
  on public.app_events (name, created_at desc);

alter table public.app_events enable row level security;

-- Users write their own events and read nothing back, including their own.
-- There is no select, update or delete policy on purpose.
-- The first drop removes the sketch's identically-behaving policy, so the
-- table does not end up with two.
drop policy if exists "insert own events" on public.app_events;
drop policy if exists "users insert their own events" on public.app_events;
create policy "users insert their own events"
  on public.app_events for insert to authenticated
  with check (user_id = auth.uid());

revoke select, update, delete on public.app_events from anon, authenticated;
revoke all on public.app_events from anon;
-- Stated rather than left to Supabase's default privileges, so the one thing
-- users can do here does not depend on a project setting.
grant insert on public.app_events to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Who counts as a developer
-- ---------------------------------------------------------------------------
-- No policies: nobody can read or change membership through the API. Manage it
-- from the dashboard (see step 6).
create table if not exists public.developers (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

alter table public.developers enable row level security;
revoke all on public.developers from anon, authenticated;

create or replace function public.is_developer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.developers where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- 3. Aggregations, parameterised by window
-- ---------------------------------------------------------------------------
-- Written once as functions so the fixed-window dashboard views (step 4) and
-- the variable-window in-app summary (step 5) cannot drift apart.

create or replace function public.perf_endpoint_latency_since(p_since timestamptz)
returns table (
  method    text,
  path      text,
  requests  bigint,
  p50_ms    integer,
  p95_ms    integer,
  max_ms    integer,
  error_pct numeric
)
language sql
stable
set search_path = public
as $$
  select
    props->>'method',
    props->>'path',
    count(*),
    round(percentile_cont(0.5)  within group (order by duration_ms))::integer,
    round(percentile_cont(0.95) within group (order by duration_ms))::integer,
    max(duration_ms),
    round(100.0 * avg(case when ok then 0 else 1 end), 1)
  from public.app_events
  where name = 'supabase_request'
    and created_at >= p_since
  group by 1, 2;
$$;

create or replace function public.perf_agent_outcomes_since(p_since timestamptz)
returns table (
  outcome text,
  turns   bigint,
  pct     numeric,
  avg_ms  integer,
  p95_ms  integer
)
language sql
stable
set search_path = public
as $$
  select
    coalesce(props->>'outcome', 'unknown'),
    count(*),
    round(100.0 * count(*) / sum(count(*)) over (), 1),
    round(avg(duration_ms))::integer,
    round(percentile_cont(0.95) within group (order by duration_ms))::integer
  from public.app_events
  where name = 'agent_turn'
    and created_at >= p_since
  group by 1;
$$;

-- Where an assistant turn spends its time. "network + tunnel" is the part
-- the server cannot see: the phone's total minus the server's own total.
create or replace function public.perf_agent_phases_since(p_since timestamptz)
returns table (
  step   integer,
  phase  text,
  turns  bigint,
  avg_ms integer,
  p95_ms integer
)
language sql
stable
set search_path = public
as $$
  with base as (
    select duration_ms, props
    from public.app_events
    where name = 'agent_turn'
      and created_at >= p_since
  ),
  phases as (
              select 1 as step, 'auth' as phase,  (props->>'auth_ms')::numeric  as ms from base where props ? 'auth_ms'
    union all select 2, 'model',                  (props->>'model_ms')::numeric        from base where props ? 'model_ms'
    union all select 3, 'tools',                  (props->>'tool_ms')::numeric         from base where props ? 'tool_ms'
    union all select 4, 'network + tunnel',
                     greatest(0, duration_ms - (props->>'server_ms')::numeric)
              from base where props ? 'server_ms' and duration_ms is not null
  )
  select
    step,
    phase,
    count(*),
    round(avg(ms))::integer,
    round(percentile_cont(0.95) within group (order by ms))::integer
  from phases
  group by step, phase;
$$;

create or replace function public.perf_daily_since(p_since timestamptz)
returns table (
  day               date,
  requests          bigint,
  request_p95_ms    integer,
  request_error_pct numeric,
  agent_turns       bigint,
  agent_ok_pct      numeric,
  agent_p95_ms      integer
)
language sql
stable
set search_path = public
as $$
  -- Days are UTC.
  select
    created_at::date,
    count(*) filter (where name = 'supabase_request'),
    round(percentile_cont(0.95) within group (order by duration_ms)
          filter (where name = 'supabase_request'))::integer,
    round(100.0 * avg(case when ok then 0 else 1 end)
          filter (where name = 'supabase_request'), 1),
    count(*) filter (where name = 'agent_turn'),
    round(100.0 * avg(case when ok then 1 else 0 end)
          filter (where name = 'agent_turn'), 1),
    round(percentile_cont(0.95) within group (order by duration_ms)
          filter (where name = 'agent_turn'))::integer
  from public.app_events
  where created_at >= p_since
  group by 1;
$$;

create or replace function public.perf_by_update_since(p_since timestamptz)
returns table (
  update_id         text,
  app_version       text,
  first_seen        timestamptz,
  requests          bigint,
  request_p95_ms    integer,
  request_error_pct numeric,
  agent_turns       bigint,
  agent_ok_pct      numeric
)
language sql
stable
set search_path = public
as $$
  select
    coalesce(update_id, 'unknown'),
    max(app_version),
    min(created_at),
    count(*) filter (where name = 'supabase_request'),
    round(percentile_cont(0.95) within group (order by duration_ms)
          filter (where name = 'supabase_request'))::integer,
    round(100.0 * avg(case when ok then 0 else 1 end)
          filter (where name = 'supabase_request'), 1),
    count(*) filter (where name = 'agent_turn'),
    round(100.0 * avg(case when ok then 1 else 0 end)
          filter (where name = 'agent_turn'), 1)
  from public.app_events
  where created_at >= p_since
  group by 1;
$$;

create or replace function public.perf_data_loads_since(p_since timestamptz)
returns table (
  source    text,
  loads     bigint,
  p50_ms    integer,
  p95_ms    integer,
  error_pct numeric,
  avg_rows  integer
)
language sql
stable
set search_path = public
as $$
  select
    props->>'source',
    count(*),
    round(percentile_cont(0.5)  within group (order by duration_ms))::integer,
    round(percentile_cont(0.95) within group (order by duration_ms))::integer,
    round(100.0 * avg(case when ok then 0 else 1 end), 1),
    round(avg((props->>'rows')::numeric))::integer
  from public.app_events
  where name = 'data_load'
    and created_at >= p_since
  group by 1;
$$;

-- Duration here is active time with pauses excluded, in minutes rather than
-- ms because that is the scale a workout is thought about in.
create or replace function public.perf_workout_sessions_since(p_since timestamptz)
returns table (
  outcome            text,
  sessions           bigint,
  pct                numeric,
  avg_minutes        numeric,
  avg_planned_min    numeric,
  set_completion_pct numeric
)
language sql
stable
set search_path = public
as $$
  select
    coalesce(props->>'outcome', 'unknown'),
    count(*),
    round(100.0 * count(*) / sum(count(*)) over (), 1),
    round(avg(duration_ms) / 60000.0, 1),
    round(avg((props->>'planned_min')::numeric), 1),
    round(100.0 * sum((props->>'sets_done')::numeric)
          / nullif(sum((props->>'sets_total')::numeric), 0), 1)
  from public.app_events
  where name = 'workout_session'
    and created_at >= p_since
  group by 1;
$$;

-- Split by permission, because that is what explains a gap between reminders
-- built and reminders scheduled: with notifications blocked the sync still
-- succeeds and nothing is scheduled.
create or replace function public.perf_notification_syncs_since(p_since timestamptz)
returns table (
  permission    text,
  syncs         bigint,
  p50_ms        integer,
  p95_ms        integer,
  error_pct     numeric,
  avg_built     numeric,
  avg_scheduled numeric
)
language sql
stable
set search_path = public
as $$
  select
    coalesce(props->>'permission', 'unknown'),
    count(*),
    round(percentile_cont(0.5)  within group (order by duration_ms))::integer,
    round(percentile_cont(0.95) within group (order by duration_ms))::integer,
    round(100.0 * avg(case when ok then 0 else 1 end), 1),
    round(avg((props->>'built')::numeric), 1),
    round(avg((props->>'scheduled')::numeric), 1)
  from public.app_events
  where name = 'notifications_sync'
    and created_at >= p_since
  group by 1;
$$;

create or replace function public.perf_notification_opens_since(p_since timestamptz)
returns table (
  kind  text,
  opens bigint
)
language sql
stable
set search_path = public
as $$
  select coalesce(props->>'kind', 'other'), count(*)
  from public.app_events
  where name = 'notification_opened'
    and created_at >= p_since
  group by 1;
$$;

-- Callable only from the dashboard and from the summary function below,
-- never directly through the API.
revoke execute on function public.perf_endpoint_latency_since(timestamptz) from public, anon, authenticated;
revoke execute on function public.perf_agent_outcomes_since(timestamptz)   from public, anon, authenticated;
revoke execute on function public.perf_agent_phases_since(timestamptz)     from public, anon, authenticated;
revoke execute on function public.perf_daily_since(timestamptz)            from public, anon, authenticated;
revoke execute on function public.perf_by_update_since(timestamptz)        from public, anon, authenticated;
revoke execute on function public.perf_data_loads_since(timestamptz)       from public, anon, authenticated;
revoke execute on function public.perf_workout_sessions_since(timestamptz) from public, anon, authenticated;
revoke execute on function public.perf_notification_syncs_since(timestamptz) from public, anon, authenticated;
revoke execute on function public.perf_notification_opens_since(timestamptz) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Dashboard views
-- ---------------------------------------------------------------------------
-- Browse these in the Table editor or query them in the SQL editor.
--
-- security_invoker matters here: a plain Postgres view runs as its owner and
-- would hand every signed-in user the raw aggregates through the API,
-- bypassing RLS. With it, an API caller is subject to the table's policies,
-- which allow no reads at all.

create or replace view public.perf_endpoint_latency with (security_invoker = true) as
  select * from public.perf_endpoint_latency_since(now() - interval '7 days')
  order by p95_ms desc nulls last;

create or replace view public.perf_agent_outcomes with (security_invoker = true) as
  select * from public.perf_agent_outcomes_since(now() - interval '7 days')
  order by turns desc;

create or replace view public.perf_agent_phases with (security_invoker = true) as
  select * from public.perf_agent_phases_since(now() - interval '7 days')
  order by step;

create or replace view public.perf_daily with (security_invoker = true) as
  select * from public.perf_daily_since(now() - interval '14 days')
  order by day desc;

create or replace view public.perf_by_update with (security_invoker = true) as
  select * from public.perf_by_update_since(now() - interval '30 days')
  order by first_seen desc;

create or replace view public.perf_data_loads with (security_invoker = true) as
  select * from public.perf_data_loads_since(now() - interval '7 days')
  order by p95_ms desc nulls last;

create or replace view public.perf_workout_sessions with (security_invoker = true) as
  select * from public.perf_workout_sessions_since(now() - interval '30 days')
  order by sessions desc;

create or replace view public.perf_notification_syncs with (security_invoker = true) as
  select * from public.perf_notification_syncs_since(now() - interval '7 days')
  order by syncs desc;

create or replace view public.perf_notification_opens with (security_invoker = true) as
  select * from public.perf_notification_opens_since(now() - interval '30 days')
  order by opens desc;

create or replace view public.perf_recent_errors with (security_invoker = true) as
  select
    created_at,
    name,
    coalesce(props->>'path', props->>'outcome', props->>'source', props->>'bucket') as detail,
    props->>'status' as status,
    duration_ms,
    update_id
  from public.app_events
  where ok = false
  order by created_at desc
  limit 50;

revoke all on public.perf_endpoint_latency, public.perf_agent_outcomes,
              public.perf_agent_phases, public.perf_daily,
              public.perf_by_update, public.perf_recent_errors,
              public.perf_data_loads, public.perf_workout_sessions,
              public.perf_notification_syncs, public.perf_notification_opens
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Summary for the in-app Performance screen
-- ---------------------------------------------------------------------------
-- security definer so it can read app_events on a developer's behalf; the
-- is_developer() check is what stops it doing so for anyone else. Returns
-- aggregates only — raw events never leave the database.
--
-- p_tz is the phone's time zone, so the timeline's hours and days line up
-- with the developer's own. The one-argument version this replaces is
-- dropped first: create or replace with a new argument list would add a
-- second function beside it rather than replace it. Older app versions
-- that pass only p_hours still reach this one, through p_tz's default.
drop function if exists public.get_performance_summary(integer);

create or replace function public.get_performance_summary(
  p_hours integer default 168,
  p_tz    text    default 'UTC'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hours integer := greatest(1, least(coalesce(p_hours, 168), 720));
  v_since timestamptz := now() - make_interval(hours => v_hours);
  v_tz    text := coalesce(nullif(p_tz, ''), 'UTC');
  -- Timeline: hours for a day or two, days beyond that. Buckets are whole
  -- hours or days ending with the current one, so the first bar isn't a
  -- partial period that only looks quiet.
  v_unit        text;
  v_buckets     integer;
  v_start_local timestamp;
  v_start       timestamptz;
begin
  if not public.is_developer() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if not exists (select 1 from pg_timezone_names where name = v_tz) then
    v_tz := 'UTC';
  end if;

  v_unit := case when v_hours <= 48 then 'hour' else 'day' end;
  v_buckets := case when v_unit = 'hour' then v_hours else ceil(v_hours / 24.0)::integer end;
  v_start_local := date_trunc(v_unit, now() at time zone v_tz)
                   - (v_buckets - 1) * ('1 ' || v_unit)::interval;
  v_start := v_start_local at time zone v_tz;

  return jsonb_build_object(
    'window_hours', v_hours,
    'generated_at', now(),

    -- Errors split by cause, since they call for different fixes: the server
    -- failing (5xx), the app asking for something wrong (4xx), or the phone
    -- getting no answer at all (status 0: offline, or the request dropped).
    'requests', (
      select jsonb_build_object(
        'count',             count(*),
        'p50_ms',            round(percentile_cont(0.5)  within group (order by duration_ms))::integer,
        'p95_ms',            round(percentile_cont(0.95) within group (order by duration_ms))::integer,
        'error_pct',         round(100.0 * avg(case when ok then 0 else 1 end), 1),
        'server_error_pct',  round(100.0 * avg(case when status >= 500 then 1 else 0 end), 1),
        'client_error_pct',  round(100.0 * avg(case when status between 400 and 499 then 1 else 0 end), 1),
        'network_error_pct', round(100.0 * avg(case when status = 0 then 1 else 0 end), 1)
      )
      from (
        select
          duration_ms,
          ok,
          -- Guarded: one malformed status must not break the whole summary.
          case when props->>'status' ~ '^[0-9]+$' then (props->>'status')::integer end as status
        from public.app_events
        where name = 'supabase_request' and created_at >= v_since
      ) r
    ),

    'timeline', (
      select jsonb_build_object(
        'unit', v_unit,
        'buckets', coalesce(jsonb_agg(jsonb_build_object(
          -- Local time, without an offset: the phone reads it as its own.
          'start',             to_char(t.bucket, 'YYYY-MM-DD"T"HH24:MI:SS'),
          'requests',          t.requests,
          'request_p95_ms',    t.request_p95_ms,
          'request_error_pct', t.request_error_pct,
          'agent_turns',       t.agent_turns,
          'agent_ok_pct',      t.agent_ok_pct,
          'agent_p95_ms',      t.agent_p95_ms,
          'workouts',          t.workouts
        ) order by t.bucket), '[]'::jsonb)
      )
      from (
        select
          b.bucket,
          count(*) filter (where e.name = 'supabase_request') as requests,
          round(percentile_cont(0.95) within group (order by e.duration_ms)
                filter (where e.name = 'supabase_request'))::integer as request_p95_ms,
          round(100.0 * avg(case when e.ok then 0 else 1 end)
                filter (where e.name = 'supabase_request'), 1) as request_error_pct,
          count(*) filter (where e.name = 'agent_turn') as agent_turns,
          round(100.0 * avg(case when e.ok then 1 else 0 end)
                filter (where e.name = 'agent_turn'), 1) as agent_ok_pct,
          round(percentile_cont(0.95) within group (order by e.duration_ms)
                filter (where e.name = 'agent_turn'))::integer as agent_p95_ms,
          count(*) filter (where e.name = 'workout_session') as workouts
        -- Every bucket, including empty ones, so a quiet hour shows as a gap
        -- rather than the chart skipping it.
        from generate_series(
          v_start_local,
          date_trunc(v_unit, now() at time zone v_tz),
          ('1 ' || v_unit)::interval
        ) as b(bucket)
        left join (
          select date_trunc(v_unit, created_at at time zone v_tz) as bucket,
                 name, duration_ms, ok
          from public.app_events
          where created_at >= v_start
            and name in ('supabase_request', 'agent_turn', 'workout_session')
        ) e on e.bucket = b.bucket
        group by b.bucket
      ) t
    ),

    'endpoints', coalesce((
      select jsonb_agg(to_jsonb(e) order by e.p95_ms desc nulls last)
      from (
        select * from public.perf_endpoint_latency_since(v_since)
        order by p95_ms desc nulls last
        limit 8
      ) e
    ), '[]'::jsonb),

    'agent', (
      select jsonb_build_object(
        'turns',  count(*),
        'ok_pct', round(100.0 * avg(case when ok then 1 else 0 end), 1),
        'p50_ms', round(percentile_cont(0.5)  within group (order by duration_ms))::integer,
        'p95_ms', round(percentile_cont(0.95) within group (order by duration_ms))::integer
      )
      from public.app_events
      where name = 'agent_turn' and created_at >= v_since
    ),

    'agent_outcomes', coalesce((
      select jsonb_agg(to_jsonb(o) order by o.turns desc)
      from public.perf_agent_outcomes_since(v_since) o
    ), '[]'::jsonb),

    'agent_phases', coalesce((
      select jsonb_agg(to_jsonb(p) order by p.step)
      from public.perf_agent_phases_since(v_since) p
    ), '[]'::jsonb),

    'image_errors', (
      select count(*)
      from public.app_events
      where name = 'image_error' and created_at >= v_since
    ),

    'data_loads', coalesce((
      select jsonb_agg(to_jsonb(d) order by d.p95_ms desc nulls last)
      from public.perf_data_loads_since(v_since) d
    ), '[]'::jsonb),

    'workouts', (
      select jsonb_build_object(
        'sessions',           count(*),
        'avg_minutes',        round(avg(duration_ms) / 60000.0, 1),
        'set_completion_pct', round(100.0 * sum((props->>'sets_done')::numeric)
                                    / nullif(sum((props->>'sets_total')::numeric), 0), 1),
        -- Of the sessions that report it (app versions from Sprint 6 on):
        -- how many saved their exercise results and remembered sets, not
        -- just the session itself. Null until one reports.
        'details_saved_pct',  round(100.0 * avg(case when props->>'details_saved' = 'true' then 1 else 0 end)
                                    filter (where props ? 'details_saved'), 1)
      )
      from public.app_events
      where name = 'workout_session' and created_at >= v_since
    ),

    'workout_outcomes', coalesce((
      select jsonb_agg(to_jsonb(w) order by w.sessions desc)
      from public.perf_workout_sessions_since(v_since) w
    ), '[]'::jsonb),

    'notifications', (
      select jsonb_build_object(
        'syncs',         count(*),
        'p50_ms',        round(percentile_cont(0.5)  within group (order by duration_ms))::integer,
        'p95_ms',        round(percentile_cont(0.95) within group (order by duration_ms))::integer,
        'error_pct',     round(100.0 * avg(case when ok then 0 else 1 end), 1),
        'denied_pct',    round(100.0 * avg(case when props->>'permission' = 'denied'
                                                then 1 else 0 end), 1),
        'avg_built',     round(avg((props->>'built')::numeric), 1),
        'avg_scheduled', round(avg((props->>'scheduled')::numeric), 1)
      )
      from public.app_events
      where name = 'notifications_sync' and created_at >= v_since
    ),

    'notification_opens', coalesce((
      select jsonb_agg(to_jsonb(n) order by n.opens desc)
      from public.perf_notification_opens_since(v_since) n
    ), '[]'::jsonb),

    'recent_errors', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.created_at desc)
      from (
        select
          created_at,
          name,
          coalesce(props->>'path', props->>'outcome', props->>'source', props->>'bucket') as detail,
          props->>'status' as status
        from public.app_events
        where ok = false and created_at >= v_since
        order by created_at desc
        limit 10
      ) r
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.is_developer()                     from public, anon;
grant  execute on function public.is_developer()                     to authenticated;
revoke execute on function public.get_performance_summary(integer, text) from public, anon;
grant  execute on function public.get_performance_summary(integer, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Make yourself a developer
-- ---------------------------------------------------------------------------
-- Uncomment, put in the email you sign into the app with, and run. The
-- Developer section in Settings appears for that account on next open.
--
-- insert into public.developers (user_id)
-- select id from auth.users where email = '<your-email>'
-- on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------
-- Nothing expires on its own. Run occasionally, or schedule it with pg_cron:
--
-- delete from public.app_events where created_at < now() - interval '90 days';
