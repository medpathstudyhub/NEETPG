import { createClient } from "npm:@supabase/supabase-js@2";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} from "npm:@aws-sdk/client-s3@3.850.0";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner@3.850.0";

const BUCKET = Deno.env.get("B2_BUCKET") ?? "";
const MAX_BYTES = 50 * 1024 * 1024;
const URL_TTL = 3600;
const ALLOWED_ORIGINS = new Set([
  "https://medpathstudyhub.github.io",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);
const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin)
    ? origin
    : "https://medpathstudyhub.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

const s3 = new S3Client({
  region: Deno.env.get("B2_REGION") ?? "",
  endpoint: Deno.env.get("B2_ENDPOINT") ?? "",
  forcePathStyle: true,
  credentials: {
    accessKeyId: Deno.env.get("B2_KEY_ID") ?? "",
    secretAccessKey: Deno.env.get("B2_APPLICATION_KEY") ?? "",
  },
});

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}
function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function isSafeKey(key: string, prefix: string) {
  return key.startsWith(prefix) && key.startsWith("library/") &&
    !key.includes("..") && !key.includes("\\");
}
function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error("Server storage configuration is incomplete: " + name);
  return value;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);

  try {
    requiredEnv("B2_BUCKET");
    requiredEnv("B2_REGION");
    requiredEnv("B2_ENDPOINT");
    requiredEnv("B2_KEY_ID");
    requiredEnv("B2_APPLICATION_KEY");

    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "Please sign in again." }, 401, origin);
    }
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const publishableKeys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}");
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? publishableKeys.default;
    if (!publishableKey) throw new Error("Supabase publishable key is not available to this function.");

    const db = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await db.auth.getUser();
    if (authError || !authData.user) return json({ error: "Your session is invalid. Please sign in again." }, 401, origin);
    const user = authData.user;

    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("role,account_status")
      .eq("id", user.id)
      .single();
    if (profileError || profile?.account_status !== "active") {
      return json({ error: "Your MEDPATH account is not active." }, 403, origin);
    }
    const admin = ["admin", "super_admin"].includes(profile.role);
    const body = await req.json();
    const action = cleanText(body.action, 40);
    const kind = cleanText(body.kind, 20);
    if (!["book", "personal"].includes(kind)) return json({ error: "Invalid library file type." }, 400, origin);

    if (action === "upload-start") {
      if (kind === "book" && !admin) return json({ error: "Administrator access is required." }, 403, origin);
      const sizeBytes = Number(body.sizeBytes);
      const title = cleanText(body.metadata?.title, 220);
      if (!title) return json({ error: "Please enter a display title." }, 400, origin);
      if (!Number.isFinite(sizeBytes) || sizeBytes < 1 || sizeBytes > MAX_BYTES) {
        return json({ error: "The PDF must be 50 MB or smaller." }, 400, origin);
      }
      const key = kind === "book"
        ? "library/shared/" + crypto.randomUUID() + ".pdf"
        : "library/students/" + user.id + "/" + crypto.randomUUID() + ".pdf";
      const uploadUrl = await getSignedUrl(
        s3,
        new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: "application/pdf" }),
        { expiresIn: 600 },
      );
      return json({ uploadUrl, storageKey: key, expiresIn: 600 }, 200, origin);
    }

    if (action === "upload-complete") {
      const key = cleanText(body.storageKey, 500);
      const prefix = kind === "book" ? "library/shared/" : "library/students/" + user.id + "/";
      if (!isSafeKey(key, prefix)) return json({ error: "Invalid upload location." }, 400, origin);
      if (kind === "book" && !admin) return json({ error: "Administrator access is required." }, 403, origin);
      const head = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      const actualSize = Number(head.ContentLength ?? 0);
      if (actualSize < 1 || actualSize > MAX_BYTES || head.ContentType?.toLowerCase() !== "application/pdf") {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })).catch(() => undefined);
        return json({ error: "The uploaded file is not a valid PDF within the 50 MB limit." }, 400, origin);
      }
      const meta = body.metadata ?? {};
      let insertRow: Record<string, unknown>;
      if (kind === "book") {
        insertRow = {
          title: cleanText(meta.title, 220),
          author: cleanText(meta.author, 180) || null,
          subject: cleanText(meta.subject, 100) || null,
          topic: cleanText(meta.topic, 120) || null,
          edition: cleanText(meta.edition, 80) || null,
          publisher: cleanText(meta.publisher, 140) || null,
          language: cleanText(meta.language, 60) || null,
          description: cleanText(meta.description, 1500) || null,
          storage_path: key,
          storage_provider: "b2",
          storage_key: key,
          is_published: false,
          allow_download: false,
          uploaded_by: user.id,
        };
      } else {
        insertRow = {
          owner_id: user.id,
          title: cleanText(meta.title, 180),
          subject: cleanText(meta.subject, 100) || null,
          notes: cleanText(meta.notes, 500) || null,
          storage_path: key,
          storage_provider: "b2",
          storage_key: key,
          original_filename: cleanText(meta.original_filename, 180) || "document.pdf",
          mime_type: "application/pdf",
          size_bytes: actualSize,
        };
      }
      if (!insertRow.title) return json({ error: "Please enter a display title." }, 400, origin);
      const table = kind === "book" ? "books" : "student_uploads";
      const { data, error } = await db.from(table).insert(insertRow).select("id").single();
      if (error) {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key })).catch(() => undefined);
        return json({ error: "Could not save the PDF details: " + error.message }, 400, origin);
      }
      return json({ id: data.id, ok: true }, 200, origin);
    }

    if (action === "resolve") {
      const id = cleanText(body.id, 80);
      const download = body.download === true;
      if (!id) return json({ error: "Missing file ID." }, 400, origin);
      let row: Record<string, unknown> | null = null;
      if (kind === "book") {
        const result = await db.from("books")
          .select("id,storage_provider,storage_key,storage_path,is_published,allow_download")
          .eq("id", id).single();
        if (result.error || !result.data) return json({ error: "Book not found or access denied." }, 404, origin);
        row = result.data;
        if (!row.is_published && !admin) return json({ error: "This book is not published." }, 403, origin);
        if (download && !row.allow_download && !admin) return json({ error: "Downloads are not enabled for this book." }, 403, origin);
      } else {
        const result = await db.from("student_uploads")
          .select("id,owner_id,storage_provider,storage_key,storage_path")
          .eq("id", id).single();
        if (result.error || !result.data || result.data.owner_id !== user.id) {
          return json({ error: "Personal PDF not found or access denied." }, 404, origin);
        }
        row = result.data;
      }
      if (row.storage_provider !== "b2") {
        return json({ legacy: true, storagePath: row.storage_path }, 200, origin);
      }
      const key = String(row.storage_key || row.storage_path || "");
      const prefix = kind === "book" ? "library/shared/" : "library/students/" + user.id + "/";
      if (!isSafeKey(key, prefix)) return json({ error: "Invalid stored file location." }, 403, origin);
      const command = new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ResponseContentDisposition: download ? 'attachment; filename="MEDPATH-library.pdf"' : 'inline; filename="MEDPATH-library.pdf"',
      });
      const url = await getSignedUrl(s3, command, { expiresIn: URL_TTL });
      return json({ url, expiresIn: URL_TTL }, 200, origin);
    }

    if (action === "delete") {
      const id = cleanText(body.id, 80);
      if (!id) return json({ error: "Missing file ID." }, 400, origin);
      let row: Record<string, unknown> | null = null;
      if (kind === "book") {
        if (!admin) return json({ error: "Administrator access is required." }, 403, origin);
        const result = await db.from("books").select("id,storage_provider,storage_key,storage_path").eq("id", id).single();
        if (result.error || !result.data) return json({ error: "Book not found or access denied." }, 404, origin);
        row = result.data;
      } else {
        const result = await db.from("student_uploads").select("id,owner_id,storage_provider,storage_key,storage_path").eq("id", id).single();
        if (result.error || !result.data || result.data.owner_id !== user.id) {
          return json({ error: "Personal PDF not found or access denied." }, 404, origin);
        }
        row = result.data;
      }
      if (row.storage_provider !== "b2") {
        return json({ legacy: true, storagePath: row.storage_path }, 200, origin);
      }
      const key = String(row.storage_key || row.storage_path || "");
      const prefix = kind === "book" ? "library/shared/" : "library/students/" + user.id + "/";
      if (!isSafeKey(key, prefix)) return json({ error: "Invalid stored file location." }, 403, origin);
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
      } catch (error) {
        return json({ error: "Backblaze could not delete the PDF. Check the application key's delete permission. " + String(error) }, 502, origin);
      }
      const table = kind === "book" ? "books" : "student_uploads";
      const { error } = await db.from(table).delete().eq("id", id);
      if (error) return json({ error: "The file was removed but its database record could not be deleted: " + error.message }, 409, origin);
      return json({ ok: true }, 200, origin);
    }

    return json({ error: "Unknown storage action." }, 400, origin);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected storage error." }, 500, origin);
  }
});
