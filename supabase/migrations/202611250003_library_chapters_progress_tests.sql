-- MEDPATH Digital Library: chapter index, student reading progress and chapter test attempts
-- Apply to the dedicated MEDPATH Digital Library Supabase project before enabling these features.

create table if not exists public.book_chapters (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  title text not null check (length(trim(title)) between 1 and 180),
  start_page integer not null check (start_page >= 1),
  end_page integer not null check (end_page >= start_page),
  subject text not null check (length(trim(subject)) between 1 and 100),
  topic text not null check (length(trim(topic)) between 1 and 180),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(book_id, sort_order)
);
create index if not exists book_chapters_book_order_idx on public.book_chapters(book_id, sort_order);

create table if not exists public.book_chapter_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references public.book_chapters(id) on delete cascade,
  last_page integer not null default 1 check (last_page >= 1),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  reading_completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(user_id, chapter_id)
);
create index if not exists book_chapter_progress_user_idx on public.book_chapter_progress(user_id);

create table if not exists public.chapter_test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_id uuid not null references public.book_chapters(id) on delete cascade,
  question_ids text[] not null,
  answers jsonb not null default '{}'::jsonb,
  correct_count integer not null check (correct_count >= 0),
  total_questions integer not null check (total_questions > 0),
  score_percent integer not null check (score_percent between 0 and 100),
  completed_at timestamptz not null default now(),
  check (correct_count <= total_questions),
  check (cardinality(question_ids) = total_questions)
);
create index if not exists chapter_test_attempts_user_chapter_idx on public.chapter_test_attempts(user_id, chapter_id, completed_at desc);

alter table public.book_chapters enable row level security;
alter table public.book_chapter_progress enable row level security;
alter table public.chapter_test_attempts enable row level security;

revoke all on public.book_chapters, public.book_chapter_progress, public.chapter_test_attempts from anon, authenticated;
grant select, insert, update, delete on public.book_chapters to authenticated;
grant select, insert, update on public.book_chapter_progress to authenticated;
grant select, insert on public.chapter_test_attempts to authenticated;

drop policy if exists "chapter index visible to active book readers" on public.book_chapters;
create policy "chapter index visible to active book readers" on public.book_chapters
for select to authenticated
using (
  public.is_medpath_active_user()
  and exists (select 1 from public.books b where b.id = book_id and (b.is_published or public.is_medpath_admin()))
);

drop policy if exists "chapter index admin insert" on public.book_chapters;
create policy "chapter index admin insert" on public.book_chapters
for insert to authenticated with check (public.is_medpath_admin());
drop policy if exists "chapter index admin update" on public.book_chapters;
create policy "chapter index admin update" on public.book_chapters
for update to authenticated using (public.is_medpath_admin()) with check (public.is_medpath_admin());
drop policy if exists "chapter index admin delete" on public.book_chapters;
create policy "chapter index admin delete" on public.book_chapters
for delete to authenticated using (public.is_medpath_admin());

drop policy if exists "students read own chapter progress" on public.book_chapter_progress;
create policy "students read own chapter progress" on public.book_chapter_progress
for select to authenticated using (user_id = (select auth.uid()) and public.is_medpath_active_user());
drop policy if exists "students insert own chapter progress" on public.book_chapter_progress;
create policy "students insert own chapter progress" on public.book_chapter_progress
for insert to authenticated with check (
  user_id = (select auth.uid()) and public.is_medpath_active_user()
  and exists (select 1 from public.book_chapters c join public.books b on b.id=c.book_id where c.id=chapter_id and b.is_published)
);
drop policy if exists "students update own chapter progress" on public.book_chapter_progress;
create policy "students update own chapter progress" on public.book_chapter_progress
for update to authenticated using (user_id = (select auth.uid()) and public.is_medpath_active_user())
with check (user_id = (select auth.uid()) and public.is_medpath_active_user());

drop policy if exists "students read own chapter tests" on public.chapter_test_attempts;
create policy "students read own chapter tests" on public.chapter_test_attempts
for select to authenticated using (user_id = (select auth.uid()) and public.is_medpath_active_user());
drop policy if exists "students insert own chapter tests" on public.chapter_test_attempts;
create policy "students insert own chapter tests" on public.chapter_test_attempts
for insert to authenticated with check (
  user_id = (select auth.uid()) and public.is_medpath_active_user()
  and exists (select 1 from public.book_chapters c join public.books b on b.id=c.book_id where c.id=chapter_id and b.is_published)
);
