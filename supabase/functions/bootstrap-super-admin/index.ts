// Promotes an email to super_admin ONLY when no super_admin exists yet.
// Safe to expose without auth: it becomes a no-op after the first bootstrap.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
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
