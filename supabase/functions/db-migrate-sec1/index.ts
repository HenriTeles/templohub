import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async () => {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const stmts = [
    // app_settings: restrict SELECT to authenticated
    `DROP POLICY IF EXISTS "app_settings_select" ON public.app_settings`,
    `DROP POLICY IF EXISTS "app_settings_public_select" ON public.app_settings`,
    `DROP POLICY IF EXISTS "Allow read app_settings" ON public.app_settings`,
    `CREATE POLICY "app_settings_select_auth" ON public.app_settings FOR SELECT TO authenticated USING (true)`,
    `REVOKE SELECT ON public.app_settings FROM anon`,
    // Revoke EXECUTE on privileged SECURITY DEFINER functions from public/authenticated/anon
    `REVOKE EXECUTE ON FUNCTION public.promote_super_admin_by_email(text) FROM PUBLIC, anon, authenticated`,
    `REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated`,
    `REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated`,
  ];
  const results: unknown[] = [];
  for (const sql of stmts) {
    const { error } = await admin.rpc("exec_sql", { sql });
    results.push({ sql, error: error?.message ?? null });
  }
  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { "content-type": "application/json" },
  });
});
