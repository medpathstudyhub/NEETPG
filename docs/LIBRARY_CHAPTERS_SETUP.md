# MEDPATH Digital Library — Chapter learning setup

## What this update adds
- Free browser/device text-to-speech voice selection. Installed English (India) voices are preferred; if unavailable, the browser falls back to another installed English voice.
- Sentence-sized narration chunks, short pauses, and basic medical abbreviation expansion.
- Pause, resume, stop and speed controls.
- PDF bookmarks/outline navigation when embedded in the PDF.
- Admin-defined chapter index for shared catalogue PDFs that do not have useful PDF bookmarks.
- Chapter-to-question mapping using the existing `window.QUESTION_BANK`; no separate question bank is created.
- Chapter tests choose up to 20 distinct matching MCQs. If fewer than 20 are available for the mapped subject/topic, the test uses all available matching questions and does not repeat them.
- Per-chapter reading progress, test status and average book chapter progress saved to the signed-in student's account.

## Required Supabase migration
GitHub Pages does not run SQL migrations automatically. Before using admin chapter mapping or saving student progress, apply this migration to the dedicated MEDPATH Digital Library Supabase project:

`supabase/migrations/202611250003_library_chapters_progress_tests.sql`

In Supabase Dashboard:
1. Open the MEDPATH Digital Library staging project.
2. Open SQL Editor.
3. Create a new query.
4. Copy the complete contents of the migration file from this repository.
5. Run it once and confirm it completes successfully.

The migration creates `book_chapters`, `book_chapter_progress`, and `chapter_test_attempts` with row-level security. Do not run it in any other Supabase project.

## Add a chapter index
1. Sign in to the Digital Library using an active Library admin account.
2. Open Library admin.
3. Find the shared book and choose **Chapters / topics**.
4. Enter chapter title, first and last PDF page, exact MEDPATH subject, and topic name.
5. Save each chapter. Use the same subject/topic values used in the existing question bank. Topic number prefixes such as `001 ` are optional for matching.
6. Publish the book when its details and chapter map are ready.

Students see the chapter index when they open the published shared book. Selecting a chapter jumps to its start page.

## Student flow
- Select a chapter in the PDF index.
- Read to the end page to unlock its chapter test.
- Start the test. Up to 20 unique MCQs are selected from the mapped MEDPATH subject/topic.
- The student's reading progress and test result are saved against their signed-in account and protected by RLS.

## Important limitations
- Browser speech synthesis uses voices installed/provided by the student's operating system and browser. This free option cannot guarantee a natural human-quality voice or an Indian English voice on every device.
- Scanned/image-only PDF pages need OCR before text narration is possible.
- Embedded PDF bookmarks are used automatically only when there is no admin-defined chapter map. Admin chapter mappings are more useful because they also link to MEDPATH question topics.
- Chapter tests are a study feature; client-side question answers are part of the existing static question bank and should not be treated as secure/high-stakes exam scoring.
- This update does not modify the main NEET PG / INI-CET exam flow or question records.
