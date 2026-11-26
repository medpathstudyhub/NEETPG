import { createClient } from "npm:@supabase/supabase-js@2";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "npm:@aws-sdk/client-s3";
import { getSignedUrl } from "npm:@aws-sdk/s3-request-presigner";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://medpathstudyhub.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const required = (name: string) => {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing Edge Function secret: ${name}`);
  return value;
};

function storageClient() {
  return new S3Client({
    region: required("B2_REGION"),
    endpoint: required("B2_ENDPOINT"),
    forcePathStyle: true,
    credentials: {
      accessKeyId: required("B2_KEY_ID"),
      secretAccessKey: required("B2_APPLICATION_KEY"),
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin");
  if (origin && origin !== "https://medpathstudyhub.github.io" && !origin.startsWith("http://localhost:")) {
    return json({ error: "Origin not allowed" }, 403);
  }

  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Sign in required" }, 401);
    const supabaseUrl = required("SUPABASE_URL");
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") || JSON.parse(required("SUPABASE_PUBLISHABLE_KEYS")).default;
    const userDb = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userResult, error: userError } = await userDb.auth.getUser();
    const user = userResult?.user;
    if (userError || !user) return json({ error: "Invalid or expired session" }, 401);

    const { data: profile, error: profileError } = await userDb
      .from("profiles").select("role,account_status").eq("id", user.id).single();
    if (profileError || profile?.account_status !== "active") return json({ error: "Active account required" }, 403);
    const admin = ["admin", "super_admin"].includes(profile.role);

    const body = await req.json();
    const action = String(body.action || "");
    const kind = String(body.kind || "");
    if (!["shared", "personal"].includes(kind)) return json({ error: "Invalid file type" }, 400);

    const bucket = required("B2_BUCKET");
    const s3 = storageClient();
    const prefix = "library/";

    if (action === "sign-upload") {
      if (kind === "shared" && !admin) return json({ error: "Library administrator access required" }, 403);
      const fileId = crypto.randomUUID();
      const objectKey = kind === "shared"
        ? `${prefix}shared/${fileId}.pdf`
        : `${prefix}students/${user.id}/${fileId}.pdf`;
      const command = new PutObjectCommand({
        Bucket: bucket, Key: objectKey, ContentType: "application/pdf",
      });
      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
      return json({ uploadUrl, objectKey, expiresIn: 300 });
    }

    if (action === "abort-upload") {
      if (kind === "shared" && !admin) return json({ error: "Library administrator access required" }, 403);
      const objectKey = String(body.objectKey || "");
      const allowedPrefix = kind === "shared" ? `${prefix}shared/` : `${prefix}students/${user.id}/`;
      if (!objectKey.startsWith(allowedPrefix) || !objectKey.endsWith(".pdf")) {
        return json({ error: "Upload ownership check failed" }, 403);
      }
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
      return json({ ok: true });
    }

    const id = String(body.id || "");
    if (!id) return json({ error: "A file ID is required" }, 400);
    let objectKey = "";

    if (kind === "shared") {
      const { data: book, error } = await userDb.from("books")
        .select("id,storage_provider,storage_key,is_published,allow_download")
        .eq("id", id).single();
      if (error || !book) return json({ error: "Book not found" }, 404);
      if (!admin && !book.is_published) return json({ error: "Book is not available" }, 403);
      if (action === "sign-download" && body.download === true && !book.allow_download && !admin) {
        return json({ error: "Downloads are disabled for this book" }, 403);
      }
      if (book.storage_provider !== "b2" || !book.storage_key?.startsWith(prefix)) {
        return json({ error: "This file is stored in legacy Supabase Storage" }, 409);
      }
      objectKey = book.storage_key;
      if (action === "delete" && !admin) return json({ error: "Administrator access required" }, 403);
    } else {
      const { data: file, error } = await userDb.from("student_uploads")
        .select("id,owner_id,storage_provider,storage_key").eq("id", id).single();
      if (error || !file) return json({ error: "Personal PDF not found" }, 404);
      if (file.owner_id !== user.id) return json({ error: "File ownership check failed" }, 403);
      if (file.storage_provider !== "b2" || !file.storage_key?.startsWith(`${prefix}students/${user.id}/`)) {
        return json({ error: "This file is stored in legacy Supabase Storage" }, 409);
      }
      objectKey = file.storage_key;
    }

    if (action === "sign-download") {
      const command = new GetObjectCommand({
        Bucket: bucket, Key: objectKey,
        ...(body.download === true ? { ResponseContentDisposition: "attachment" } : {}),
      });
      const url = await getSignedUrl(s3, command, { expiresIn: 900 });
      return json({ url, expiresIn: 900 });
    }
    if (action === "delete") {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
      return json({ ok: true });
    }
    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("B2 gateway error", error instanceof Error ? error.message : "unknown");
    return json({ error: "Storage request failed. Check Edge Function configuration and logs." }, 500);
  }
});
