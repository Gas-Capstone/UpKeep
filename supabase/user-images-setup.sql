-- Photos users upload for their own recipes and workout plans.
--
-- Unlike recipe-images and workout-images, which are read-only and filled from
-- the dashboard, this bucket is written to by the app. Writes are scoped by
-- path: every object lives under a folder named for the uploader's id, and the
-- policies below check that folder against auth.uid().
--
--   <user id>/recipes/<recipe id>.jpg
--   <user id>/workouts/<plan id>.jpg
--
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. Bucket
-- ---------------------------------------------------------------------------
-- Public read, so a card can show the photo with a plain URL and no signing
-- round trip per image. Anyone with the link can view it, which is the same
-- trade already made for avatars. Nothing private should go in here.
insert into storage.buckets (id, name, public)
values ('user-images', 'user-images', true)
on conflict (id) do update set public = true;

-- ---------------------------------------------------------------------------
-- 2. Policies
-- ---------------------------------------------------------------------------
drop policy if exists "user images are publicly readable" on storage.objects;
create policy "user images are publicly readable"
  on storage.objects for select
  using (bucket_id = 'user-images');

drop policy if exists "users upload into their own folder" on storage.objects;
create policy "users upload into their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'user-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Replacing a photo writes to the same path, and an upsert that overwrites an
-- existing object needs UPDATE as well as INSERT. Without this, the first
-- upload for an item succeeds and every later one fails.
drop policy if exists "users replace their own images" on storage.objects;
create policy "users replace their own images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'user-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'user-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "users delete their own images" on storage.objects;
create policy "users delete their own images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'user-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 3. Check the row updates are allowed too
-- ---------------------------------------------------------------------------
-- Uploading also writes image_url back to custom_recipes / workout_plans, so
-- those tables need an UPDATE policy for the author. If no row with cmd =
-- 'UPDATE' comes back for a table, the upload will succeed and the photo will
-- still not appear, because the row never gets the URL.
select tablename, policyname, cmd
from pg_policies
where tablename in ('custom_recipes', 'workout_plans')
order by tablename, cmd;
