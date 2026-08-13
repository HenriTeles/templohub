-- Item 1.2 — RPCs administrativas: uma única fonte de verdade para autorização
-- Execute no SQL Editor do Supabase externo (vuqogpswsdzlxuaeidcw).
--
-- Regra:
--  * approve_templo / reject_templo / update_templo / delete_templo /
--    promote_super_admin_by_email só são chamadas pelo servidor, com a chave de
--    serviço, e sempre depois de assertSuperAdmin() no server function.
--  * Por isso a checagem interna de auth.uid() é removida: com service_role
--    auth.uid() é NULL, então ela não protege nada e ainda derruba a ação.
--  * Em troca, o banco garante que essas funções sejam tecnicamente
--    inalcançáveis por qualquer papel que não seja service_role.
--
-- NÃO toca em helpers de RLS (is_super_admin, has_role, user_templo,
-- can_write_templo), policies, grants de tabela ou create_templo_request.
-- Script idempotente: pode ser reaplicado sem efeito colateral.

BEGIN;

-- ============================================================
-- 0) Diagnóstico antes (opcional, somente leitura)
-- ============================================================
-- select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as funcao,
--        case when p.prosecdef then 'DEFINER' else 'INVOKER' end as tipo,
--        coalesce(array_to_string(p.proacl, E'\n'), 'PADRÃO (PUBLIC pode executar)') as privilegios
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname in ('public','app_private') order by 1;

-- ============================================================
-- 1) Corpos sem a checagem falsa de auth.uid()
-- ============================================================

CREATE OR REPLACE FUNCTION public.approve_templo(_templo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Autorização: garantida por assertSuperAdmin() no server function.
  -- Esta função só é executável por service_role (ver GRANTs abaixo).
  IF _templo_id IS NULL THEN
    RAISE EXCEPTION 'templo_id required';
  END IF;
  UPDATE public.templos SET status = 'ativo' WHERE id = _templo_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_templo(_templo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _templo_id IS NULL THEN
    RAISE EXCEPTION 'templo_id required';
  END IF;
  UPDATE public.templos SET status = 'suspenso' WHERE id = _templo_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_templo(
  _templo_id uuid,
  _nome text,
  _cidade text,
  _estado text,
  _status public.templo_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _templo_id IS NULL THEN
    RAISE EXCEPTION 'templo_id required';
  END IF;
  UPDATE public.templos
     SET nome   = COALESCE(_nome, nome),
         cidade = _cidade,
         estado = _estado,
         status = COALESCE(_status, status)
   WHERE id = _templo_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_templo(_templo_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _templo_id IS NULL THEN
    RAISE EXCEPTION 'templo_id required';
  END IF;

  -- Valores customizados vinculados aos médiuns do templo
  DELETE FROM public.medium_custom_values
   WHERE mediun_id IN (SELECT id FROM public.mediuns WHERE templo_id = _templo_id);

  -- Anexos, histórico, mentores, médiuns e demais tabelas do templo
  DELETE FROM public.anexos               WHERE templo_id = _templo_id;
  DELETE FROM public.historico            WHERE templo_id = _templo_id;
  DELETE FROM public.mediun_mentores      WHERE templo_id = _templo_id;
  DELETE FROM public.medium_custom_fields WHERE templo_id = _templo_id;
  DELETE FROM public.mediuns              WHERE templo_id = _templo_id;
  DELETE FROM public.mentores             WHERE templo_id = _templo_id;
  DELETE FROM public.configuracoes        WHERE templo_id = _templo_id;
  DELETE FROM public.adjuracoes           WHERE templo_id = _templo_id;
  DELETE FROM public.centurias            WHERE templo_id = _templo_id;
  DELETE FROM public.falanges             WHERE templo_id = _templo_id;
  DELETE FROM public.legioes              WHERE templo_id = _templo_id;
  DELETE FROM public.povos                WHERE templo_id = _templo_id;
  DELETE FROM public.reinos               WHERE templo_id = _templo_id;
  DELETE FROM public.trinos               WHERE templo_id = _templo_id;

  -- Vínculos de usuários com esse templo
  DELETE FROM public.user_roles WHERE templo_id = _templo_id;
  UPDATE public.profiles SET templo_id = NULL WHERE templo_id = _templo_id;

  -- Finalmente, o próprio templo
  DELETE FROM public.templos WHERE id = _templo_id;
END;
$function$;

-- ============================================================
-- 2) Somente service_role pode executar
-- ============================================================

REVOKE ALL ON FUNCTION public.approve_templo(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reject_templo(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_templo(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_templo(uuid, text, text, text, public.templo_status) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.promote_super_admin_by_email(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.approve_templo(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reject_templo(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_templo(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_templo(uuid, text, text, text, public.templo_status) TO service_role;
GRANT EXECUTE ON FUNCTION public.promote_super_admin_by_email(text) TO service_role;

-- ============================================================
-- 3) Documentação inline (evita reintroduzir a checagem removida)
-- ============================================================

COMMENT ON FUNCTION public.approve_templo(uuid) IS
  'Somente service_role. Autorização feita em assertSuperAdmin() no server function; não adicionar checagem de auth.uid() (é NULL com service_role).';
COMMENT ON FUNCTION public.reject_templo(uuid) IS
  'Somente service_role. Autorização feita em assertSuperAdmin() no server function; não adicionar checagem de auth.uid().';
COMMENT ON FUNCTION public.update_templo(uuid, text, text, text, public.templo_status) IS
  'Somente service_role. Autorização feita em assertSuperAdmin() no server function; não adicionar checagem de auth.uid().';
COMMENT ON FUNCTION public.delete_templo(uuid) IS
  'Somente service_role. Autorização feita em assertSuperAdmin() no server function; não adicionar checagem de auth.uid().';
COMMENT ON FUNCTION public.promote_super_admin_by_email(text) IS
  'Somente service_role. Uso operacional/bootstrap; nunca exposta a anon/authenticated.';

COMMIT;

-- ============================================================
-- 4) Verificação depois (somente leitura)
-- ============================================================
-- select p.proname,
--        coalesce(array_to_string(p.proacl, E'\n'), 'PADRÃO (PUBLIC pode executar)') as privilegios
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('approve_templo','reject_templo','update_templo','delete_templo','promote_super_admin_by_email')
-- order by 1;
-- Esperado: apenas o dono (postgres) e service_role=X. Nenhum anon= ou authenticated=.
