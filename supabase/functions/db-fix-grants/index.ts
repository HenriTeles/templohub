// deno-lint-ignore-file
import postgres from "https://deno.land/x/postgresjs@v3.4.4/mod.js";

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_DB_URL")!;
  const sql = postgres(url, { prepare: false });
  try {
    await sql.unsafe(`
      GRANT EXECUTE ON FUNCTION public.user_templo(uuid) TO authenticated;
      GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
      GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
      GRANT EXECUTE ON FUNCTION public.can_write_templo(uuid, uuid) TO authenticated;
    `);
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: { "content-type": "application/json" } });
  } finally {
    await sql.end();
  }
});
