import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

Deno.serve(async () => {
  const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false });
  const stmts = [
    `DROP POLICY IF EXISTS "app_settings_select" ON public.app_settings`,
    `DROP POLICY IF EXISTS "app_settings_public_select" ON public.app_settings`,
    `DROP POLICY IF EXISTS "Allow read app_settings" ON public.app_settings`,
    `CREATE POLICY "app_settings_select_auth" ON public.app_settings FOR SELECT TO authenticated USING (true)`,
    `REVOKE SELECT ON public.app_settings FROM anon`,
    `REVOKE EXECUTE ON FUNCTION public.promote_super_admin_by_email(text) FROM PUBLIC`,
    `REVOKE EXECUTE ON FUNCTION public.promote_super_admin_by_email(text) FROM anon`,
    `REVOKE EXECUTE ON FUNCTION public.promote_super_admin_by_email(text) FROM authenticated`,
    `REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC`,
    `REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon`,
    `REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated`,
    `REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC`,
    `REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM anon`,
    `REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM authenticated`,
  ];
  const results: unknown[] = [];
  for (const s of stmts) {
    try {
      await sql.unsafe(s);
      results.push({ sql: s, ok: true });
    } catch (e) {
      results.push({ sql: s, error: (e as Error).message });
    }
  }
  await sql.end();
  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { "content-type": "application/json" },
  });
});
