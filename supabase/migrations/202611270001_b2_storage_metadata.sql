-- MEDPATH Digital Library: additive storage metadata for the private Backblaze B2 provider.
-- Existing NULL storage_provider values remain legacy Supabase Storage records.
-- storage_path is retained and mirrored to storage_key for compatibility with existing code.

alter table public.books
  add column if not exists storage_provider text,
  add column if not exists storage_key text;

alter table public.student_uploads
  add column if not exists storage_provider text,
  add column if not exists storage_key text;

alter table public.books
  drop constraint if exists books_storage_provider_check;
alter table public.books
  add constraint books_storage_provider_check
  check (storage_provider is null or storage_provider in ('supabase', 'b2'));

alter table public.student_uploads
  drop constraint if exists student_uploads_storage_provider_check;
alter table public.student_uploads
  add constraint student_uploads_storage_provider_check
  check (storage_provider is null or storage_provider in ('supabase', 'b2'));

create index if not exists books_storage_provider_idx
  on public.books(storage_provider);
create index if not exists student_uploads_storage_provider_idx
  on public.student_uploads(storage_provider);
