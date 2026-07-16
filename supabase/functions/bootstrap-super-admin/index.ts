// Promotes an email to super_admin ONLY when:
//  1) no super_admin exists yet, AND
//  2) the caller presents the correct BOOTSTRAP_SETUP_TOKEN shared secret.
// The token must be configured as a Supabase secret before first use.
// After the first super_admin is created, the function becomes a no-op.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const setupToken = Deno.env.get("BOOTSTRAP_SETUP_TOKEN");
  if (!setupToken) {
    return json({ ok: false, error: "bootstrap disabled: BOOTSTRAP_SETUP_TOKEN not configured" }, 503);
  }

  const provided =
    req.headers.get("x-setup-token") ??
    (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!provided || !timingSafeEqual(provided, setupToken)) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  let email: string;
  try {
    const body = await req.json();
    email = String(body.email ?? "").trim().toLowerCase();
  } catch {
    return new Response("invalid body", { status: 400 });
  }
  if (!email) return new Response("email required", { status: 400 });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: existing, error: e1 } = await admin
    .from("user_roles")
    .select("id")
    .eq("role", "super_admin")
    .limit(1);
  if (e1) return json({ ok: false, error: e1.message }, 500);
  if (existing && existing.length > 0) {
    return json({ ok: false, error: "super_admin already exists" }, 409);
  }

  const { error } = await admin.rpc("promote_super_admin_by_email", { _email: email });
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, email });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
