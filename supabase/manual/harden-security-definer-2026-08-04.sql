-- Hardening: SECURITY DEFINER functions executable by signed-in users
-- Execute este script no SQL Editor do Supabase externo (vuqogpswsdzlxuaeidcw).
--
-- Regra aplicada:
--  * Funções administrativas/mutadoras SECURITY DEFINER deixam de ser chamáveis
--    por anon/authenticated. Elas só rodam via service_role (server functions
--    autenticadas que já validam o Administrador Geral).
--  * Funções gatilho (trigger/event trigger) não precisam de EXECUTE para
--    usuários finais: os gatilhos rodam com o dono da tabela/função.
--  * Helpers de RLS (is_super_admin, user_templo, can_write_templo, has_role)
--    permanecem com EXECUTE para authenticated: as policies são avaliadas com
--    os privilégios do usuário chamador e sem esse GRANT o login/leitura quebra.
--  * create_templo_request permanece disponível: é o onboarding do usuário.

BEGIN;

-- 1) Nunca acessíveis pelo cliente (só service_role / server functions)
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

-- 2) Funções de gatilho: nenhum papel do cliente precisa chamá-las diretamente
REVOKE ALL ON FUNCTION public.apply_admin_password_reset() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;

-- 3) Helpers necessários para RLS e onboarding (mantidos de propósito),
--    mas sem acesso anônimo.
REVOKE ALL ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_templo(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_write_templo(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_templo_request(text, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_templo(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_templo(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_templo_request(text, text, text) TO authenticated, service_role;

-- 4) O vínculo do usuário com o templo é administrado apenas por rotinas
--    privilegiadas. Usuários finais podem editar seus dados básicos, mas não
--    podem trocar profiles.templo_id e atravessar o isolamento multi-tenant.
REVOKE UPDATE ON TABLE public.profiles FROM authenticated;
GRANT UPDATE (nome, email) ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;

COMMIT;
