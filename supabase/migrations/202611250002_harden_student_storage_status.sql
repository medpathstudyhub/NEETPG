-- MEDPATH Digital Library: block suspended users from personal Storage objects
-- Apply only to the dedicated STAGING Supabase project.
-- Existing owner-only rules are retained and strengthened with active-account checks.

drop policy if exists "student private owner read" on storage.objects;
create policy "student private owner read" on storage.objects
for select to authenticated
using (
  bucket_id = 'student-private'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.is_medpath_active_user()
);

drop policy if exists "student private owner insert" on storage.objects;
create policy "student private owner insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'student-private'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.is_medpath_active_user()
);

drop policy if exists "student private owner update" on storage.objects;
create policy "student private owner update" on storage.objects
for update to authenticated
using (
  bucket_id = 'student-private'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.is_medpath_active_user()
)
with check (
  bucket_id = 'student-private'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.is_medpath_active_user()
);

drop policy if exists "student private owner delete" on storage.objects;
create policy "student private owner delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'student-private'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.is_medpath_active_user()
);
