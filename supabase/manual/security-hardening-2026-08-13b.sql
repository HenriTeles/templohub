-- Hardening de segurança — 2026-08-13 (lote B)
-- Execute no SQL Editor do Supabase externo (vuqogpswsdzlxuaeidcw).
-- Idempotente: pode ser reaplicado sem efeito colateral.
--
-- Cobre 4 achados do scanner:
--  1) SECURITY DEFINER chamável por usuários autenticados (public.*)
--  2) admin_password_resets sem políticas SELECT/UPDATE e com senha em texto puro
--  3) bucket app-branding legível por qualquer autenticado sem escopo
--  4) user_roles sem políticas/privilégios de escrita explícitos

BEGIN;

-- ============================================================
-- 1) SECURITY DEFINER fora da API: lógica em app_private,
--    wrappers SECURITY INVOKER em public (mantém as policies válidas)
-- ============================================================

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION app_private.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION app_private.user_templo(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.templo_id FROM public.profiles p WHERE p.id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION app_private.can_write_templo(_user_id uuid, _templo_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT app_private.is_super_admin(_user_id)
     OR EXISTS (
       SELECT 1 FROM public.user_roles ur
       WHERE ur.user_id = _user_id
         AND ur.role IN ('admin', 'secretario')
         AND ur.templo_id = _templo_id
     );
$$;

CREATE OR REPLACE FUNCTION app_private.create_templo_request(_nome text, _cidade text, _estado text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text;
  _templo_id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF app_private.is_super_admin(_uid) THEN
    RAISE EXCEPTION 'super admins do not belong to a templo';
  END IF;

  SELECT email INTO _email FROM auth.users WHERE id = _uid;

  INSERT INTO public.profiles (id, email, nome)
  VALUES (_uid, _email, split_part(COALESCE(_email, ''), '@', 1))
  ON CONFLICT (id) DO NOTHING;

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
END;
$$;

REVOKE ALL ON FUNCTION app_private.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.user_templo(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.can_write_templo(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.create_templo_request(text, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION app_private.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.user_templo(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.can_write_templo(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION app_private.create_templo_request(text, text, text) TO authenticated, service_role;

-- Wrappers em public: SECURITY INVOKER (não disparam o linter)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT app_private.is_super_admin(_user_id);
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT app_private.has_role(_user_id, _role);
$$;

CREATE OR REPLACE FUNCTION public.user_templo(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT app_private.user_templo(_user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_write_templo(_user_id uuid, _templo_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT app_private.can_write_templo(_user_id, _templo_id);
$$;

CREATE OR REPLACE FUNCTION public.create_templo_request(_nome text, _cidade text, _estado text)
RETURNS uuid LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = public AS $$
  SELECT app_private.create_templo_request(_nome, _cidade, _estado);
$$;

REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_templo(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_write_templo(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_templo_request(text, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_templo(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_templo(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_templo_request(text, text, text) TO authenticated, service_role;

-- Definer administrativos/gatilhos em public: apenas service_role
REVOKE ALL ON FUNCTION public.approve_templo(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_templo(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_templo(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_templo(uuid, text, text, text, public.templo_status) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.promote_super_admin_by_email(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.approve_templo(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_templo(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_templo(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_templo(uuid, text, text, text, public.templo_status) TO service_role;
GRANT EXECUTE ON FUNCTION public.promote_super_admin_by_email(text) TO service_role;

-- ============================================================
-- 2) admin_password_resets: sem senha em texto puro, sem leitura pelo cliente
--    A troca de senha administrativa agora usa a Admin API (item 1.1),
--    então a tabela vira apenas auditoria de metadados.
-- ============================================================

DROP TRIGGER IF EXISTS trg_apply_admin_password_reset ON public.admin_password_resets;
DROP FUNCTION IF EXISTS public.apply_admin_password_reset();

UPDATE public.admin_password_resets SET new_password = NULL WHERE new_password IS NOT NULL;
ALTER TABLE public.admin_password_resets DROP COLUMN IF EXISTS new_password;

-- Nenhum papel do cliente escreve/lê essa tabela: só o servidor (service_role)
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT policyname FROM pg_policies
            WHERE schemaname = 'public' AND tablename = 'admin_password_resets'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.admin_password_resets', p.policyname);
  END LOOP;
END $$;

REVOKE ALL ON TABLE public.admin_password_resets FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.admin_password_resets TO service_role;
ALTER TABLE public.admin_password_resets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_password_resets FORCE ROW LEVEL SECURITY;

COMMENT ON TABLE public.admin_password_resets IS
  'Somente auditoria de metadados (quem/quando/para qual e-mail). Nunca armazenar senha. Escrita/leitura apenas via service_role.';

-- ============================================================
-- 3) user_roles: escrita impossível pelo cliente (anti privilege escalation)
-- ============================================================

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.user_roles FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON TABLE public.user_roles FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Política RESTRITIVA: mesmo que alguém crie uma policy permissiva no futuro,
-- nenhuma escrita de anon/authenticated passa.
DROP POLICY IF EXISTS user_roles_no_client_writes ON public.user_roles;
CREATE POLICY user_roles_no_client_writes
  ON public.user_roles
  AS RESTRICTIVE
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (false);

COMMENT ON TABLE public.user_roles IS
  'Papéis de usuário. Escrita exclusivamente por service_role / rotinas SECURITY DEFINER em app_private.';

-- ============================================================
-- 4) Storage app-branding: leitura escopada ao logo global
--    Uploads passam a viver em global/ (ver src/routes/app.admin.tsx).
-- ============================================================

DROP POLICY IF EXISTS app_branding_select ON storage.objects;
DROP POLICY IF EXISTS app_branding_select_global ON storage.objects;
DROP POLICY IF EXISTS app_branding_write_super_admin ON storage.objects;

CREATE POLICY app_branding_select_global
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'app-branding'
    AND (storage.foldername(name))[1] = 'global'
  );

CREATE POLICY app_branding_write_super_admin
  ON storage.objects FOR ALL TO authenticated
  USING (
    bucket_id = 'app-branding'
    AND app_private.is_super_admin(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'app-branding'
    AND (storage.foldername(name))[1] = 'global'
    AND app_private.is_super_admin(auth.uid())
  );

COMMIT;
