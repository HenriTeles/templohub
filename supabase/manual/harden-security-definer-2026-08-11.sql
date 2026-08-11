-- Hardening: "Signed-In Users Can Execute SECURITY DEFINER Function"
-- Execute este script no SQL Editor do Supabase externo (vuqogpswsdzlxuaeidcw).
--
-- Estratégia:
--  * A lógica privilegiada (SECURITY DEFINER) passa a viver no schema
--    app_private, que NÃO é exposto pela API (PostgREST). Nada de definer
--    chamável no schema public.
--  * As funções em public viram wrappers SECURITY INVOKER, para que todas as
--    policies de RLS existentes (que referenciam public.is_super_admin, etc.)
--    continuem funcionando sem precisar ser reescritas.
--  * anon perde qualquer acesso; authenticated mantém apenas o necessário
--    para o RLS/onboarding continuar operando.

BEGIN;

CREATE SCHEMA IF NOT EXISTS app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA app_private TO authenticated, service_role;

-- 1) Lógica privilegiada em app_private (SECURITY DEFINER, fora da API)
CREATE OR REPLACE FUNCTION app_private.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
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
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

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

-- 2) public.* vira SECURITY INVOKER (mantém as policies existentes válidas)
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

-- 3) Reforço: nenhum definer administrativo/gatilho em public chamável pelo cliente
REVOKE ALL ON FUNCTION public.approve_templo(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_templo(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_templo(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_templo(uuid, text, text, text, public.templo_status) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.promote_super_admin_by_email(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_admin_password_reset() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.approve_templo(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_templo(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_templo(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_templo(uuid, text, text, text, public.templo_status) TO service_role;
GRANT EXECUTE ON FUNCTION public.promote_super_admin_by_email(text) TO service_role;

COMMIT;
