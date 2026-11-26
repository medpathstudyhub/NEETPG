# MEDPATH Digital Library — Backblaze B2 storage rollout

## Safety design

- Supabase remains the identity, role, catalogue, ownership, and progress database.
- Backblaze B2 is a private object store for newly uploaded PDFs.
- All B2 operations are initiated by the `library-b2` Supabase Edge Function. The browser never receives the B2 application key.
- The B2 bucket remains private. The Edge Function checks the signed-in Supabase user, active profile, role, publication state, download permission, and personal-file ownership before issuing a short-lived URL or deleting an object.
- New B2 keys are generated server-side and always start with `library/`, matching the restricted Backblaze application key prefix.
- Existing records with a NULL `storage_provider` continue to use the existing Supabase Storage buckets. No migration or deletion of existing PDF objects is performed.

## Backblaze values

Use these values in Supabase Edge Function Secrets (never in GitHub or browser JavaScript):

| Secret | Value |
|---|---|
| `B2_ENDPOINT` | `https://s3.ca-east-006.backblazeb2.com` |
| `B2_REGION` | `ca-east-006` |
| `B2_BUCKET` | `medpath-library-private` |
| `B2_KEY_ID` | Your saved Backblaze application key ID |
| `B2_APPLICATION_KEY` | Your saved Backblaze application key secret |

Do not put either key value in this repository, a screenshot, or a chat message. The key must be scoped to the `medpath-library-private` bucket and `library/` prefix, with read/write access.

Supabase already provides `SUPABASE_URL` and the user-facing publishable/anon key to Edge Functions. The function uses the caller's bearer token for database reads, so normal RLS remains in force.

## One-time Supabase steps (after code review)

1. Apply `supabase/migrations/202611260001_library_b2_storage.sql` to the dedicated `MEDPATH-DIGITAL-LIBRARY-STAGING` project only.
2. In Supabase Dashboard → Edge Functions → Secrets, add the five B2 secrets above. Never share their values.
3. Deploy the `library-b2` Edge Function from this repository to the same staging project.
4. Configure B2 bucket CORS for the exact site origin `https://medpathstudyhub.github.io`, methods GET, HEAD and PUT, request headers needed for PDF range requests and Content-Type, and expose Content-Length, Content-Range, Accept-Ranges, ETag and Content-Type. Test PDF.js range loading and browser uploads before enabling for students.
5. Confirm the Backblaze application key permits S3 GetObject, PutObject and DeleteObject for the bucket/prefix.

Do not configure production until staging tests pass.

## Data layout

- Shared catalogue PDFs: `library/shared/<server-generated-uuid>.pdf`
- Personal PDFs: `library/students/<supabase-user-id>/<server-generated-uuid>.pdf`

The database keeps the existing `storage_path` field for backward compatibility and adds `storage_provider` and `storage_key`. New records identify B2 explicitly; old records remain on Supabase.

## Required staging tests

- Active student can upload, read and delete only their own personal PDF.
- Student A cannot read or delete Student B's PDF by changing a record ID.
- Student cannot upload shared catalogue PDFs or delete shared books.
- Admin can upload a shared draft, read it, publish/unpublish it, and delete it.
- Unpublished shared books are not accessible to students.
- Download is denied to students when `allow_download=false`.
- Suspended/unconfirmed/inactive profiles cannot use the gateway.
- A legacy Supabase PDF still opens and downloads using the old bucket.
- PDF.js loads multiple pages and seeks across pages using HTTP Range requests before the signed URL expires.
- Failed metadata inserts remove the just-uploaded B2 object; failed B2 upload does not create a database row.

## Rollback

Do not delete any Supabase bucket or existing object. To roll back, revert the browser changes and leave B2 objects and metadata intact for investigation. Records with `storage_provider='b2'` must not be interpreted as Supabase paths. No automatic bulk migration of existing PDFs is included.

## Limitations

Signed URLs are bearer links until expiry; anyone who obtains one can use it during its lifetime. The gateway controls issuance but cannot prevent screenshots, printing, or copying after a PDF is delivered to a browser. B2 CORS and PDF.js range behavior must be tested in a real browser; code review alone is not proof of deployment readiness.
