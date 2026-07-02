// One-shot migration v2: super admin cleanup, mediun new fields, falange seed,
// approve_templo/create_templo_request updates, templos UPDATE policy for super_admin.
import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const SUPER_ADMIN_EMAIL = "henriquetelesdorosario@hotmail.com";

const NINFA_FALANGES = [
  "Nityama","Samaritana","Grega","Maya","Yurici","Muruayci","Dharman Oxinto",
  "Jaçanã","Ariana da Estrela Testemunha","Madalena de Cássia","Franciscana",
  "Narayama","Rochana","Cayçara","Tupinambá","Cigana Aganara","Cigana Tagana",
  "Agulha Ysmênia","Nyatra",
];
const MESTRE_FALANGES = ["Magos","Príncipe Maya"];

function quote(s: string) {
  return `'${s.replace(/'/g, "''")}'`;
}

const seedValues = [
  ...NINFA_FALANGES.map((n) => `(NULL, ${quote(n)}, 'ninfa')`),
  ...MESTRE_FALANGES.map((n) => `(NULL, ${quote(n)}, 'mestre')`),
].join(",\n  ");

const SQL = `
-- 1) Super admin cleanup: detach from any templo, delete templos they created solo
DO $$
DECLARE _uid uuid;
DECLARE _templo uuid;
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = ${quote(SUPER_ADMIN_EMAIL)} LIMIT 1;
  IF _uid IS NULL THEN
    RAISE NOTICE 'super admin user not found';
  ELSE
    -- capture templo (if any) attached to profile
    SELECT templo_id INTO _templo FROM public.profiles WHERE id = _uid;

    -- detach profile
    UPDATE public.profiles SET templo_id = NULL WHERE id = _uid;

    -- drop non-super-admin roles for this user (admin/secretario/consulta artifacts)
    DELETE FROM public.user_roles WHERE user_id = _uid AND role <> 'super_admin';

    -- if a templo exists AND was created by this user, delete it (and cascade child rows)
    IF _templo IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.templos WHERE id = _templo AND created_by = _uid) THEN
        DELETE FROM public.mediuns WHERE templo_id = _templo;
        DELETE FROM public.falanges WHERE templo_id = _templo;
        DELETE FROM public.centurias WHERE templo_id = _templo;
        DELETE FROM public.mentores WHERE templo_id = _templo;
        DELETE FROM public.historico WHERE templo_id = _templo;
        DELETE FROM public.configuracoes WHERE templo_id = _templo;
        DELETE FROM public.user_roles WHERE templo_id = _templo;
        DELETE FROM public.templos WHERE id = _templo;
      END IF;
    END IF;
  END IF;
END $$;

-- 2) Block super_admin from creating templos through the RPC
CREATE OR REPLACE FUNCTION public.create_templo_request(_nome text, _cidade text, _estado text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
DECLARE
  _uid uuid := auth.uid();
  _templo_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF public.is_super_admin(_uid) THEN
    RAISE EXCEPTION 'super admins do not belong to a templo';
  END IF;
  IF (SELECT templo_id FROM public.profiles WHERE id = _uid) IS NOT NULL THEN
    RAISE EXCEPTION 'user already belongs to a templo';
  END IF;

  INSERT INTO public.templos (nome, cidade, estado, status, created_by)
  VALUES (_nome, _cidade, _estado, 'pendente', _uid)
  RETURNING id INTO _templo_id;

  UPDATE public.profiles SET templo_id = _templo_id WHERE id = _uid;

  INSERT INTO public.user_roles (user_id, role, templo_id)
  VALUES (_uid, 'admin', _templo_id)
  ON CONFLICT DO NOTHING;

  RETURN _templo_id;
END; $fn$;

-- 3) approve_templo: stop copying global falanges/mentores
CREATE OR REPLACE FUNCTION public.approve_templo(_templo_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.templos SET status = 'ativo' WHERE id = _templo_id;
END; $fn$;

-- 4) update_templo RPC for super admin
CREATE OR REPLACE FUNCTION public.update_templo(
  _templo_id uuid,
  _nome text,
  _cidade text,
  _estado text,
  _status public.templo_status
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE public.templos
    SET nome = COALESCE(_nome, nome),
        cidade = _cidade,
        estado = _estado,
        status = COALESCE(_status, status)
    WHERE id = _templo_id;
END; $fn$;

REVOKE EXECUTE ON FUNCTION public.update_templo(uuid, text, text, text, public.templo_status) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_templo(uuid, text, text, text, public.templo_status) TO authenticated;

-- 5) templos: allow super_admin to update/delete
DROP POLICY IF EXISTS "templos_update_super" ON public.templos;
CREATE POLICY "templos_update_super" ON public.templos
  FOR UPDATE TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "templos_delete_super" ON public.templos;
CREATE POLICY "templos_delete_super" ON public.templos
  FOR DELETE TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 6) mediuns: new columns
ALTER TABLE public.mediuns
  ADD COLUMN IF NOT EXISTS guia_missionaria text,
  ADD COLUMN IF NOT EXISTS ministro text,
  ADD COLUMN IF NOT EXISTS cavaleiro text,
  ADD COLUMN IF NOT EXISTS preto_velho text,
  ADD COLUMN IF NOT EXISTS caboclo text,
  ADD COLUMN IF NOT EXISTS medico_cura text;

-- 7) Falanges seed: rewrite globals, drop templo-scoped duplicates
-- detach mediuns pointing at templo-scoped falanges so we can delete them
UPDATE public.mediuns SET falange_id = NULL
  WHERE falange_id IN (SELECT id FROM public.falanges WHERE templo_id IS NOT NULL);
UPDATE public.mediuns SET falange_missionaria_id = NULL
  WHERE falange_missionaria_id IN (SELECT id FROM public.falanges WHERE templo_id IS NOT NULL);

DELETE FROM public.falanges WHERE templo_id IS NOT NULL;
DELETE FROM public.falanges WHERE templo_id IS NULL;

INSERT INTO public.falanges (templo_id, nome, categoria) VALUES
  ${seedValues.split(",\n  ").map((v) => `(NULL, ${v})`).join(",\n  ")};
`;

Deno.serve(async () => {
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) return new Response("SUPABASE_DB_URL missing", { status: 500 });
  const client = new Client(dbUrl);
  try {
    await client.connect();
    await client.queryArray(SQL);
    return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: String(e), stack: (e as Error).stack }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
});
