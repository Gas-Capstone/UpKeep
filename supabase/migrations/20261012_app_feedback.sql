-- In-app feedback from the survey at the bottom of the Home screen.
--
-- rating is the star rating doubled, so half stars stay whole numbers:
-- 0.5 stars = 1, 3.5 stars = 7, 5 stars = 10.

create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 10),
  review text,
  created_at timestamptz not null default now()
);

alter table public.app_feedback enable row level security;

-- Users can send feedback and see their own; reading everyone's feedback is
-- done from the Supabase dashboard, which bypasses RLS.
drop policy if exists "Users submit their own feedback" on public.app_feedback;
create policy "Users submit their own feedback"
  on public.app_feedback
  for insert
  with check (user_id = auth.uid());

drop policy if exists "Users read their own feedback" on public.app_feedback;
create policy "Users read their own feedback"
  on public.app_feedback
  for select
  using (user_id = auth.uid());
