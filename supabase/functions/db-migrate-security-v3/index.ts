// Temporary security hardening migration.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SQL = `
-- 1) can_write_templo: remove null-templo bypass
CREATE OR REPLACE FUNCTION public.can_write_templo(_user_id uuid, _templo_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT
    public.is_super_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.role IN ('admin','secretario')
        AND ur.templo_id = _templo_id
    );
$fn$;

-- 2) SECURITY DEFINER executable-by-authenticated: revoke broadly then re-grant only user-facing RPCs
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_templo(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.can_write_templo(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_templo(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reject_templo(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_templo(uuid, text, text, text, templo_status) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_templo_request(text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promote_super_admin_by_email(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- Re-grant only user-callable RPCs
GRANT EXECUTE ON FUNCTION public.create_templo_request(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_templo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_templo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_templo(uuid, text, text, text, templo_status) TO authenticated;

-- Helpers used inside RLS/other SECURITY DEFINER funcs run with owner privileges;
-- they do not need EXECUTE on the invoker role. Grant to service_role for admin use.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_templo(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.can_write_templo(uuid, uuid) TO service_role;

-- 3) mediuns-fotos: enforce auth + templo ownership on SELECT
DROP POLICY IF EXISTS fotos_select ON storage.objects;
DROP POLICY IF EXISTS fotos_insert ON storage.objects;
DROP POLICY IF EXISTS fotos_update ON storage.objects;
DROP POLICY IF EXISTS fotos_delete ON storage.objects;

CREATE POLICY fotos_select ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'mediuns-fotos'
  AND (
    public.is_super_admin(auth.uid())
    OR public.user_templo(auth.uid())::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY fotos_insert ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'mediuns-fotos'
  AND public.can_write_templo(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY fotos_update ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'mediuns-fotos'
  AND public.can_write_templo(auth.uid(), ((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'mediuns-fotos'
  AND public.can_write_templo(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY fotos_delete ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'mediuns-fotos'
  AND public.can_write_templo(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
`;

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, key);
  const { error } = await admin.rpc("exec_sql", { sql: SQL } as any).catch((e: any) => ({ error: e }));
  if (error) {
    // Fallback: run via pg-meta style not available; use direct SQL over PostgREST is not possible.
    // Use fetch to Supabase's SQL endpoint via the admin API is not exposed here.
    // As a workaround, split and run each statement using .from().rpc — not applicable.
    return new Response(JSON.stringify({ ok: false, error: String(error?.message ?? error) }), { status: 500 });
  }
  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
});
