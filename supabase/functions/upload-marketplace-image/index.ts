import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-upload-folder",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function detectImage(bytes: Uint8Array): { mime: string; extension: string } | null {
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (jpeg) return { mime: "image/jpeg", extension: "jpg" };

  const png = bytes.length >= 24
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
    && String.fromCharCode(...bytes.slice(12, 16)) === "IHDR";
  if (png) return { mime: "image/png", extension: "png" };

  const webp = bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  if (webp) return { mime: "image/webp", extension: "webp" };

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed." }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return respond({ error: "Sign in to upload an image." }, 401);

    const folder = req.headers.get("x-upload-folder");
    if (folder !== "products" && folder !== "store") return respond({ error: "Invalid upload destination." }, 400);

    const declaredMime = req.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase() ?? "";
    const bytes = new Uint8Array(await req.arrayBuffer());
    if (bytes.length === 0) return respond({ error: "Choose an image to upload." }, 400);
    if (bytes.length > 5 * 1024 * 1024) return respond({ error: "Image must be 5 MiB or smaller." }, 413);

    const detected = detectImage(bytes);
    if (!detected || detected.mime !== declaredMime) {
      return respond({ error: "The file contents do not match a supported JPEG, PNG, or WebP image." }, 415);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKeys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
    const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")
      ?? (publishableKeys ? JSON.parse(publishableKeys).default : undefined);
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
      ?? (secretKeys ? JSON.parse(secretKeys).default : undefined);
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return respond({ error: "Image upload is not configured on the server." }, 500);
    }

    const token = authorization.slice("Bearer ".length);
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return respond({ error: "Your session is invalid. Sign in again." }, 401);

    const { data: profile, error: profileError } = await userClient
      .from("profiles").select("role").eq("id", authData.user.id).single();
    if (profileError || profile?.role !== "seller") return respond({ error: "Only sellers can upload marketplace images." }, 403);

    const { data: store, error: storeError } = await userClient
      .from("stores").select("id").eq("owner_id", authData.user.id).limit(1).maybeSingle();
    if (storeError || !store) return respond({ error: "Create your store before uploading images." }, 403);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const path = `${authData.user.id}/${folder}/${crypto.randomUUID()}.${detected.extension}`;
    const { error: uploadError } = await admin.storage.from("marketplace-images").upload(path, bytes, {
      contentType: detected.mime,
      cacheControl: "3600",
      upsert: false,
    });
    if (uploadError) return respond({ error: "The image could not be saved. Please try again." }, 500);

    const { data: publicData } = admin.storage.from("marketplace-images").getPublicUrl(path);
    return respond({ path, url: publicData.publicUrl });
  } catch (error) {
    console.error("Marketplace image upload failed:", error);
    return respond({ error: "The image could not be processed. Please try again." }, 500);
  }
});
