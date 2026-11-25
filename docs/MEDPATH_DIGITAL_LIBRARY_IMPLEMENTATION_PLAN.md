# MEDPATH DIGITAL LIBRARY — Implementation Preparation

Status: approved requirements and architecture preparation
Repository: medpathstudyhub/NEETPG
Working branch: feature/medpath-digital-library-prep
Baseline: existing main branch; do not merge or publish without owner approval.

## 1. Approved product requirements

- Backend, authentication, database and file storage: Supabase.
- Student registration: self-registration with email confirmation.
- Central MEDPATH books: available to all registered/verified students.
- Central book download permission: configured separately by an administrator for each book.
- Student personal uploads: private to the uploading student in normal use.
- Authorised MEDPATH administrators may access a student's personal PDFs for support/moderation; every such access must be permission-checked and logged.
- Initial per-PDF upload limit: 50 MB.
- Google Drive is not part of the initial architecture.
- Existing NEET PG, INI-CET, question-bank, admin and PWA functionality must remain unchanged.

## 2. Architecture

Keep GitHub Pages as the static front-end host. Add a separate Digital Library module/page and connect it to Supabase using the public/anon publishable key only. Supabase provides:
- Auth: verified student and administrator sessions.
- Postgres: profiles, catalogue metadata, ownership, permissions and audit records.
- Storage: PDF files and book-cover images.
- Edge Functions: privileged operations, especially audited administrator access to personal student files and controlled signed-URL issuance.

Never place a Supabase secret/service-role key in browser code, HTML, JavaScript, GitHub Pages, or the public repository.

## 3. Roles

- super_admin: manages roles, admins, central books, policies and system settings.
- admin: manages central books and may request authorised access to student personal files through a logged support workflow.
- student: browses central books and manages only their own personal uploads.

Role assignment is server-controlled. A student must never be able to set or promote their own role through a profile update. The first super_admin is provisioned manually through a secure setup procedure, not through public sign-up.

## 4. Storage buckets

Create buckets with private access by default:
- medpath-books: central PDF files. Students receive short-lived read access only after authentication and catalogue permission checks. Admins can upload, replace and delete.
- student-private: student uploads. Object path convention: <auth.uid>/<random-object-id>/<sanitized-filename>. Students can access their own objects. Admin support access is mediated by an Edge Function that checks admin role, records an audit event, and returns a short-lived signed URL.
- book-covers: public thumbnails only; never store restricted PDFs here.

Bucket restrictions:
- PDF buckets accept application/pdf only.
- Student upload bucket maximum file size: 50 MB.
- Central book PDF bucket maximum file size: initially 50 MB unless owner approves a different limit.
- Covers accept approved image MIME types and a small image-size limit.
- Use random object identifiers; do not rely on user-supplied filenames as unique paths.
- Use resumable/TUS uploads for reliability around the 50 MB limit.

## 5. Database model (initial)

### profiles
- id UUID primary key referencing auth.users(id)
- display_name
- role (student/admin/super_admin; changed only by trusted admin process)
- account_status (pending/active/suspended)
- created_at, updated_at

### books
- id UUID primary key
- title, author, description
- subject, topic, edition, publisher, language
- storage_bucket, storage_path
- cover_path
- is_published
- allow_download (admin-controlled per book)
- uploaded_by, created_at, updated_at

### student_uploads
- id UUID primary key
- owner_id UUID referencing auth.users(id)
- title, subject, notes
- storage_bucket, storage_path
- original_filename, mime_type, size_bytes
- created_at, updated_at

### admin_access_audit
- id UUID primary key
- admin_id UUID
- student_id UUID
- upload_id UUID
- action (metadata_view / signed_link_issued / delete / other)
- reason
- created_at
- request correlation metadata where appropriate; avoid storing unnecessary personal data.

Potential later tables: book_categories, book_access_groups, reading_bookmarks, reading_progress, storage_usage. Do not add these until the first working release needs them.

## 6. Authorization rules

- Enable RLS on every exposed application table; explicitly configure SQL grants as well as policies.
- Unauthenticated users cannot browse the catalogue or personal uploads.
- Verified active students can read published central-book metadata and request a time-limited view URL.
- Students cannot upload, update, list, or delete objects belonging to another user.
- Students can update/delete only their own student_uploads metadata and matching storage objects.
- Only admin/super_admin can create, edit, publish, replace or delete central book records and files.
- Students cannot update role, account_status, owner_id, storage_path ownership, or admin permission fields.
- Personal PDF admin access is not a broad direct Storage policy. An Edge Function validates the current admin session and role, requires a reason, writes an audit record, then issues a short-lived signed URL. Super-admin access is also logged.
- Do not rely on a hidden button or client-side role check as a security boundary.

## 7. Central-book reading and download behaviour

- A signed-in, verified student may open published central books.
- The admin-controlled allow_download flag determines whether the UI offers an explicit download action.
- Reading/viewing still requires a short-lived signed URL.
- A browser cannot guarantee DRM: a student who can view a PDF may be able to save, print, screenshot or otherwise capture its contents. The setting controls the official download feature and access workflow, not absolute copying prevention. Do not advertise it as DRM or copy protection.

## 8. Registration and account lifecycle

- Enable Supabase email confirmation.
- Configure exact production Site URL and allowed redirect URLs for the MEDPATH GitHub Pages domain and local development.
- Use a custom SMTP provider before public launch for reliable verification and recovery email delivery.
- Add sign-up, email confirmation, sign-in, password reset, sign-out and suspended-account handling.
- Public sign-up always creates a student account. Admin roles are granted separately by a trusted process.
- Add rate limits and basic abuse protection before public launch.

## 9. File upload and lifecycle

- Validate MIME type, extension and byte size in the UI and again in trusted server-side logic.
- Reject non-PDF files for the first release.
- Initial maximum size is 50 MB per PDF. Supabase's Free plan currently caps the project-wide maximum file size at 50 MB; bucket limits cannot exceed the global limit. Confirm the chosen Supabase plan and global/bucket limits before enabling uploads.
- Use resumable uploads for reliability; test interrupted uploads and retry behaviour.
- Store metadata in Postgres, not PDF binaries.
- On replacement or deletion, keep database and Storage state consistent; define cleanup/rollback behaviour to avoid orphaned objects.
- Add quotas only after deciding the total storage allowance per student and project budget.

## 10. Front-end pages

- library.html: central catalogue, search, subject/topic filters, book details, PDF reader and permitted download action.
- my-library.html: student's own PDF uploads, upload progress, rename/organise/delete and PDF reader.
- library-admin.html: central-book upload/edit/publish/delete and per-book download setting; separate audited workflow for student-file support access.
- library-auth.js / library-client.js: shared auth/session and Supabase client setup.
- Keep existing admin.html question-bank workflows separate; add a clear navigation link only after library authentication is ready.

## 11. Implementation sequence

1. Confirm Supabase project exists, region, plan and owner access; do not ask the owner to share passwords or secret keys in chat.
2. Create a separate Supabase project for staging/testing before production.
3. Add version-controlled SQL migrations, RLS policies, Storage policies and Edge Function source in the repository.
4. Run database and RLS tests using at least two student accounts, one admin and one super-admin.
5. Build sign-up/login/password recovery.
6. Build admin central-book upload and catalogue management.
7. Build student catalogue, PDF reader and per-book download behaviour.
8. Build private student uploads and cross-device access.
9. Build audited admin support access for personal PDFs.
10. Test mobile/PWA behaviour, storage limits, signed-link expiry, role escalation attempts, cross-user access denial and deletion.
11. Submit a pull request for review. Do not merge or publish without explicit approval.

## 12. Acceptance tests

- Student A cannot list, read, replace or delete Student B's personal PDF, even by changing an object path or API request.
- Admin can access a personal PDF only through the audited support endpoint; the audit row records who accessed which file and why.
- Student cannot alter their own role or status.
- Unverified or suspended accounts cannot access the library.
- A registered student can open published central books.
- A student sees a download action only when the book's allow_download setting is true.
- Changing a book's download setting takes effect for newly issued access links; short-lived links limit stale access.
- A 50 MB PDF uploads successfully within configured plan/bucket limits; larger files are rejected with a clear message.
- Existing exam pages, exam tags, question-bank admin, PWA install and service worker continue to work.
- No secret/service-role key appears in committed files or browser network assets.

## 13. Owner setup inputs needed before deployment

The owner will need to create/own the Supabase project and provide only the non-secret project URL and publishable/anon key for front-end configuration. Secret keys, database passwords, SMTP credentials and signing secrets must remain in Supabase project settings or protected deployment secrets and must never be pasted into chat or committed to GitHub.

The owner must also choose/confirm:
- Supabase project name and region.
- Whether to start with a staging project first (recommended: yes).
- Custom email sender/domain or an approved SMTP provider.
- Initial total storage budget/quota and retention policy before bulk uploads.
- The authorised administrator accounts and first super-admin.

## 14. External documentation checked

- Supabase Storage access control: https://supabase.com/docs/guides/storage/security/access-control
- Supabase Storage buckets: https://supabase.com/docs/guides/storage/buckets/fundamentals
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase upload limits: https://supabase.com/docs/guides/storage/uploads/file-limits
- Supabase production security checklist: https://supabase.com/docs/guides/security/production-checklist

This document is a preparation specification, not a claim that Supabase has already been provisioned or that any library feature is deployed.
