-- MEDPATH Digital Library: initial staging schema
-- Apply only to the dedicated STAGING Supabase project after reviewing this file.
-- No service-role/secret keys belong in browser code.

create extension if not exists pgcrypto;

-- Profiles are created automatically for new Auth users. Self-registration is always student.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'student' check (role in ('super_admin','admin','student')),
  account_status text not null default 'active' check (account_status in ('active','suspended','pending')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, role, account_status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'full_name'),
    'student',
    'active'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_medpath on auth.users;
create trigger on_auth_user_created_medpath
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_medpath_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role in ('admin','super_admin')
      and p.account_status = 'active'
  );
$$;

create or replace function public.is_medpath_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.role = 'super_admin'
      and p.account_status = 'active'
  );
$$;

create or replace function public.is_medpath_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.account_status = 'active'
  );
$$;

-- Central catalogue. PDFs live in private Storage, never in database rows.
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  description text,
  subject text,
  topic text,
  edition text,
  publisher text,
  language text,
  storage_bucket text not null default 'medpath-books' check (storage_bucket = 'medpath-books'),
  storage_path text not null unique,
  cover_path text,
  is_published boolean not null default false,
  allow_download boolean not null default false,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Personal PDFs. The object path must begin with the owner's immutable Auth UID.
create table if not exists public.student_uploads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  subject text,
  notes text,
  storage_bucket text not null default 'student-private' check (storage_bucket = 'student-private'),
  storage_path text not null unique,
  original_filename text not null,
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint student_upload_path_owner check (split_part(storage_path, '/', 1) = owner_id::text)
);

-- This table is written by the trusted admin-access Edge Function using a server-only key.
create table if not exists public.admin_access_audit (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete restrict,
  student_id uuid not null references auth.users(id) on delete restrict,
  upload_id uuid not null references public.student_uploads(id) on delete restrict,
  action text not null check (action in ('view','download')),
  reason text not null check (length(trim(reason)) >= 10),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.student_uploads enable row level security;
alter table public.admin_access_audit enable row level security;

-- Restrict table privileges as well as using RLS. Users may update only display_name.
revoke all on public.profiles, public.books, public.student_uploads, public.admin_access_audit from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, insert, update, delete on public.books to authenticated;
grant select, insert, update, delete on public.student_uploads to authenticated;
grant select on public.admin_access_audit to authenticated;

drop policy if exists "profile read self or admin" on public.profiles;
create policy "profile read self or admin" on public.profiles
for select to authenticated
using (id = (select auth.uid()) or public.is_medpath_admin());

drop policy if exists "profile update own display name" on public.profiles;
create policy "profile update own display name" on public.profiles
for update to authenticated
using (id = (select auth.uid()) and account_status = 'active')
with check (id = (select auth.uid()) and account_status = 'active');

drop policy if exists "books visible to active users when published" on public.books;
create policy "books visible to active users when published" on public.books
for select to authenticated
using ((is_published and public.is_medpath_active_user()) or public.is_medpath_admin());

drop policy if exists "books admin insert" on public.books;
create policy "books admin insert" on public.books
for insert to authenticated
with check (public.is_medpath_admin() and uploaded_by = (select auth.uid()));

drop policy if exists "books admin update" on public.books;
create policy "books admin update" on public.books
for update to authenticated
using (public.is_medpath_admin())
with check (public.is_medpath_admin());

drop policy if exists "books admin delete" on public.books;
create policy "books admin delete" on public.books
for delete to authenticated
using (public.is_medpath_admin());

drop policy if exists "student uploads owner select" on public.student_uploads;
create policy "student uploads owner select" on public.student_uploads
for select to authenticated
using (owner_id = (select auth.uid()) and public.is_medpath_active_user());

drop policy if exists "student uploads owner insert" on public.student_uploads;
create policy "student uploads owner insert" on public.student_uploads
for insert to authenticated
with check (owner_id = (select auth.uid()) and public.is_medpath_active_user());

drop policy if exists "student uploads owner update" on public.student_uploads;
create policy "student uploads owner update" on public.student_uploads
for update to authenticated
using (owner_id = (select auth.uid()) and public.is_medpath_active_user())
with check (owner_id = (select auth.uid()) and public.is_medpath_active_user());

drop policy if exists "student uploads owner delete" on public.student_uploads;
create policy "student uploads owner delete" on public.student_uploads
for delete to authenticated
using (owner_id = (select auth.uid()) and public.is_medpath_active_user());

drop policy if exists "audit read admins only" on public.admin_access_audit;
create policy "audit read admins only" on public.admin_access_audit
for select to authenticated
using (public.is_medpath_admin());

-- Private buckets: central book PDFs and personal student PDFs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('medpath-books', 'medpath-books', false, 52428800, array['application/pdf']),
  ('student-private', 'student-private', false, 52428800, array['application/pdf']),
  ('book-covers', 'book-covers', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Student access is owner-only for personal files. Admin support access must use
-- an Edge Function that verifies role, captures a reason, inserts an audit row,
-- then returns a short-lived signed URL. Do not add a broad admin Storage policy.
drop policy if exists "student private owner read" on storage.objects;
create policy "student private owner read" on storage.objects
for select to authenticated
using (bucket_id = 'student-private' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "student private owner insert" on storage.objects;
create policy "student private owner insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'student-private' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "student private owner update" on storage.objects;
create policy "student private owner update" on storage.objects
for update to authenticated
using (bucket_id = 'student-private' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'student-private' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "student private owner delete" on storage.objects;
create policy "student private owner delete" on storage.objects
for delete to authenticated
using (bucket_id = 'student-private' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "central books active users read" on storage.objects;
create policy "central books active users read" on storage.objects
for select to authenticated
using (
  bucket_id = 'medpath-books'
  and public.is_medpath_active_user()
  and (
    public.is_medpath_admin()
    or exists (
      select 1 from public.books b
      where b.storage_bucket = 'medpath-books'
        and b.storage_path = name
        and b.is_published = true
    )
  )
);

drop policy if exists "central books admins insert" on storage.objects;
create policy "central books admins insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'medpath-books' and public.is_medpath_admin());

drop policy if exists "central books admins update" on storage.objects;
create policy "central books admins update" on storage.objects
for update to authenticated
using (bucket_id = 'medpath-books' and public.is_medpath_admin())
with check (bucket_id = 'medpath-books' and public.is_medpath_admin());

drop policy if exists "central books admins delete" on storage.objects;
create policy "central books admins delete" on storage.objects
for delete to authenticated
using (bucket_id = 'medpath-books' and public.is_medpath_admin());

-- Public covers contain thumbnails only; never place PDF files in this bucket.
drop policy if exists "cover admins insert" on storage.objects;
create policy "cover admins insert" on storage.objects
for insert to authenticated
with check (bucket_id = 'book-covers' and public.is_medpath_admin());

drop policy if exists "cover admins update" on storage.objects;
create policy "cover admins update" on storage.objects
for update to authenticated
using (bucket_id = 'book-covers' and public.is_medpath_admin())
with check (bucket_id = 'book-covers' and public.is_medpath_admin());

drop policy if exists "cover admins delete" on storage.objects;
create policy "cover admins delete" on storage.objects
for delete to authenticated
using (bucket_id = 'book-covers' and public.is_medpath_admin());

comment on table public.student_uploads is 'Private student PDFs; owner-only access. Admin support access is through an audited Edge Function.';
comment on table public.admin_access_audit is 'Audit trail for authorised administrator access to private student PDFs.';
