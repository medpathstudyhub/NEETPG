# MEDPATH Backblaze B2 storage integration

This folder contains the private Backblaze B2 gateway for the Digital Library.

## Security model

- Supabase Auth remains the identity provider. Every request must carry the signed-in user's Supabase JWT.
- The function checks the user's active profile and role, then uses a Supabase client carrying that user's JWT. Database Row Level Security remains in force for all metadata reads, inserts, and deletes.
- Backblaze credentials are read only from Supabase Edge Function secrets. Never put them in browser JavaScript, GitHub files, or chat.
- The B2 bucket remains private. The function issues temporary presigned URLs only after checking the corresponding library record and permissions.
- New shared PDFs are stored under `library/shared/`; personal PDFs are stored under `library/students/<auth-user-id>/`.
- New metadata rows set `storage_provider='b2'`, `storage_key` to the B2 object key, and `storage_path` to the same key for compatibility with the existing non-null/legacy path usage. Existing rows with NULL `storage_provider` continue using Supabase Storage.
- Existing Supabase buckets and files are not migrated, deleted, or modified.

## Edge Function secrets

Configure these in Supabase Dashboard → Edge Functions → Secrets:

| Secret | Value |
|---|---|
| `B2_BUCKET` | `medpath-library-private` |
| `B2_REGION` | `ca-east-006` |
| `B2_ENDPOINT` | `https://s3.ca-east-006.backblazeb2.com` |
| `B2_KEY_ID` | Backblaze application key ID |
| `B2_APPLICATION_KEY` | Backblaze application key secret |

Supabase provides `SUPABASE_URL` and its publishable key environment variables to Edge Functions. Do not add a service-role key for this function.

The Backblaze application key must be restricted to the `medpath-library-private` bucket and the `library/` filename prefix. The function needs read and write permissions. If permanent delete is enabled in the UI, the key also needs the Backblaze `deleteFiles` capability; Backblaze documents that S3 Delete Object by name generally needs both `writeFiles` and `deleteFiles`.

## Deployment

Deploy this function only after its secrets have been added:

```sh
supabase functions deploy library-storage --project-ref <your-project-ref>
```

Keep the default Edge Function JWT verification enabled. Do not set `verify_jwt = false`.

## Backblaze bucket CORS

For the MEDPATH GitHub Pages origin, configure the B2 S3-compatible CORS rule to allow:
- Origin: `https://medpathstudyhub.github.io`
- Methods: `GET`, `HEAD`, `PUT`
- Allowed headers: `*`
- Exposed headers: `Accept-Ranges`, `Content-Length`, `Content-Range`, `ETag`, `Last-Modified`
- Max age: `3600`

If testing locally, temporarily add the exact local development origin you use. Do not use a public wildcard origin for the private library.

## API actions

- `upload-start`: checks user role, PDF size metadata and creates a 10-minute presigned PUT URL.
- `upload-complete`: checks the uploaded object's real size and MIME type, then inserts the appropriate metadata row.
- `resolve`: checks published/download/ownership permissions and returns a one-hour presigned GET URL for B2 files. Legacy Supabase files are identified for the browser's existing signed-URL flow.
- `delete`: checks admin/owner permissions before deleting a B2 object and its metadata. Legacy Supabase files continue using the existing Supabase Storage deletion path.

## First rollout checklist

1. Add the five B2 secrets in Supabase; do not paste them into GitHub or chat.
2. Confirm the application key has `readFiles` and `writeFiles`. Confirm `deleteFiles` too if delete is required.
3. Configure the bucket CORS rule above.
4. Deploy the Edge Function with JWT verification enabled.
5. Test with a small private student PDF, then a shared draft PDF, then publish/read/download permissions, then deletion.
6. Verify old Supabase-backed PDFs still open and that the existing library reader, chapters, progress and tests still work.
7. Do not migrate or delete old Supabase files until all tests pass and a separate migration plan is approved.
