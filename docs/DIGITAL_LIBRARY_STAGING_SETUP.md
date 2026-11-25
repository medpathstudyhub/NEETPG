# MEDPATH Digital Library — staging setup checklist

This module is intentionally separate from the existing exam pages.

## 1. Add the browser-safe Supabase key

1. Open the repository branch `feature/medpath-digital-library-prep`.
2. Open `library-config.js` and choose **Edit**.
3. Replace only `PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE` with the **publishable key** from the staging Supabase project (Settings → API Keys).
4. Keep the Supabase project URL unchanged.
5. Commit the change to this feature branch.

The publishable key (or legacy anon key) is intended for browser use. Never place an `sb_secret_` key, `service_role` key, database password, or other secret in this file, any HTML/JavaScript, GitHub Pages, or a chat message.

## 2. Included first-pass functions

- Email/password sign-in and student self-registration.
- Email-confirmation flow returning to the Digital Library.
- Active-account check using the signed-in user's `profiles` row.
- Shared published-book catalogue with search, PDF reading, and download only when enabled.
- Personal PDF upload, read, download, and delete. Files are stored under the signed-in user's Auth UID.
- Admin-only shared-book upload as draft, publish/unpublish, download permission toggle, and delete.
- Student-private files are not listed for administrators. Audited admin support access is deliberately deferred until its Edge Function is ready.

## 3. Staging test sequence

Use separate test accounts and a small, non-sensitive sample PDF.

1. Sign in as the existing Super Admin and confirm the admin section appears.
2. Upload a small central PDF. Confirm it is initially a draft and not visible to a student.
3. Publish the book and confirm a separate active student account can read it.
4. Keep downloads disabled and confirm no Download button appears. Enable downloads and verify it appears.
5. Sign in as Student A, upload a personal PDF, and confirm it appears under **My PDFs**.
6. Sign in as Student B and confirm Student A's PDF is not visible or accessible.
7. Sign back in as Student A and test read, download, and delete.
8. Suspend a test account in Supabase and verify it cannot access the library.
9. Test sign-out, sign-in, email confirmation, mobile layout, and the 50 MB boundary.

Do not use real student records or confidential PDFs during staging.

## 4. Before public launch

- Configure a custom SMTP provider in Supabase Auth; the default email service has restrictive limits.
- Implement and test the audited Edge Function for administrator support access to private student PDFs.
- Add server-side upload validation and consider resumable uploads for larger PDFs.
- Review all RLS and Storage policies with at least two independent student accounts.
- Review the draft PR and explicitly approve merging before changing the live site.
