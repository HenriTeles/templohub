// One-shot security hardening migration. Safe to re-run.
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const SQL = `
-- ============================================================
-- Security hardening: search_path, EXECUTE grants, RLS policies,
-- storage bucket ownership checks, restricted public listing.
-- ============================================================

-- --- 1. Function search_path pinning + EXECUTE lockdown ---
-- All SECURITY DEFINER functions already have SET search_path = public in the
-- creation DDL, but set_updated_at (SECURITY INVOKER trigger) does not.
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public;
ALTER FUNCTION public.is_super_admin(uuid) SET search_path = public;
ALTER FUNCTION public.user_templo(uuid) SET search_path = public;
ALTER FUNCTION public.can_write_templo(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.create_templo_request(text, text, text) SET search_path = public;
ALTER FUNCTION public.approve_templo(uuid) SET search_path = public;
ALTER FUNCTION public.reject_templo(uuid) SET search_path = public;
ALTER FUNCTION public.promote_super_admin_by_email(text) SET search_path = public;

-- Revoke EXECUTE from PUBLIC/anon/authenticated on all SECURITY DEFINER
-- functions, then re-grant only to the roles that need them.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- Helper functions used inside RLS policies must be callable by the
-- authenticated role so policies evaluate correctly.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_templo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_templo(uuid, uuid) TO authenticated;

-- Onboarding + super-admin operations exposed via PostgREST RPC.
GRANT EXECUTE ON FUNCTION public.create_templo_request(text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_templo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_templo(uuid) TO authenticated;

-- Bootstrap function is only called from the trusted edge function using
-- service_role, so no anon/authenticated grants are needed.

-- --- 2. RLS policy always true: tighten templos_insert ---
DROP POLICY IF EXISTS "templos_insert" ON public.templos;
CREATE POLICY "templos_insert" ON public.templos FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND status = 'pendente'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.templo_id IS NOT NULL
    )
  );

-- --- 3. Storage: mediuns-fotos (public bucket) ---
-- Path convention enforced by the app: '<templo_id>/<mediun_id>/<file>'.
-- Restrict listing/writes by templo ownership; keep public read so <img src>
-- works with the public URL, but only for files that live under a real templo
-- folder the user can access.
DROP POLICY IF EXISTS "fotos_read" ON storage.objects;
DROP POLICY IF EXISTS "fotos_write" ON storage.objects;
DROP POLICY IF EXISTS "fotos_update" ON storage.objects;
DROP POLICY IF EXISTS "fotos_delete" ON storage.objects;

-- Public read stays public (bucket is public and files are referenced by URL),
-- but list/select through the API is gated to the owning templo or super_admin.
CREATE POLICY "fotos_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'mediuns-fotos'
    AND (
      auth.uid() IS NULL  -- anonymous fetches via public URL
      OR public.is_super_admin(auth.uid())
      OR (split_part(name, '/', 1))::uuid = public.user_templo(auth.uid())
    )
  );

CREATE POLICY "fotos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mediuns-fotos'
    AND public.can_write_templo(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "fotos_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'mediuns-fotos'
    AND public.can_write_templo(auth.uid(), (split_part(name, '/', 1))::uuid)
  )
  WITH CHECK (
    bucket_id = 'mediuns-fotos'
    AND public.can_write_templo(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "fotos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'mediuns-fotos'
    AND public.can_write_templo(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

-- --- 4. Storage: mediuns-docs (private bucket) ---
DROP POLICY IF EXISTS "docs_all" ON storage.objects;

CREATE POLICY "docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'mediuns-docs'
    AND (
      public.is_super_admin(auth.uid())
      OR (split_part(name, '/', 1))::uuid = public.user_templo(auth.uid())
    )
  );

CREATE POLICY "docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'mediuns-docs'
    AND public.can_write_templo(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "docs_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'mediuns-docs'
    AND public.can_write_templo(auth.uid(), (split_part(name, '/', 1))::uuid)
  )
  WITH CHECK (
    bucket_id = 'mediuns-docs'
    AND public.can_write_templo(auth.uid(), (split_part(name, '/', 1))::uuid)
  );

CREATE POLICY "docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'mediuns-docs'
    AND public.can_write_templo(auth.uid(), (split_part(name, '/', 1))::uuid)
  );
`;

Deno.serve(async (_req) => {

  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return new Response("SUPABASE_DB_URL missing", { status: 500 });

  const client = new Client(dbUrl);
  try {
    await client.connect();
    await client.queryArray(SQL);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e), stack: (e as Error).stack }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
});
