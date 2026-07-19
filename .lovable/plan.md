
# Auditoria — Migração TemploHub para Supabase externo

Objetivo: verificar cada camada da aplicação, produzir um relatório estruturado (o que está OK, o que ainda depende do Lovable Cloud, erros encontrados) e entregar um único arquivo SQL/instruções corrigindo pendências. Nenhuma alteração de funcionalidade — apenas migração/limpeza.

## Escopo da verificação (evidências já coletadas em modo plano)

Base de dados / URLs / chaves — só o projeto externo `vuqogpswsdzlxuaeidcw` aparece:
- `src/integrations/supabase/client.ts` → `https://vuqogpswsdzlxuaeidcw.supabase.co` + publishable JWT.
- `.env`, `supabase/config.toml`, `vite.config.ts` → mesmo project ref, sem referências ao antigo projeto Cloud.
- `src/integrations/supabase/client.server.ts` + `auth-middleware.ts` → leem `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY` do runtime; secrets confirmados no painel (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_SECRET_KEYS`, etc.).

Referências ao Lovable ainda presentes (todas são plataforma, não Lovable Cloud/Supabase antigo):
- `package.json` → `@lovable.dev/vite-tanstack-config` (plugin de build; necessário para o próprio Lovable, sem vínculo com Cloud).
- `src/lib/lovable-error-reporting.ts` + uso em `src/routes/__root.tsx` → hook opcional `window.__lovableEvents` (telemetria da preview; no-op fora do Lovable).
- `__root.tsx` → `og:image` apontando para `pub-…r2.dev/…lovable.app…png` (screenshot antigo hospedado no CDN Lovable) e `twitter:site="@Lovable"`.
- `.lovable/*` (config interno do editor) — não afeta runtime.

Nenhum uso de `functions.invoke`, nenhum secret `LOVABLE_*` fora do `LOVABLE_API_KEY` (AI Gateway opcional, não é Cloud).

Auth: `src/routes/login.tsx` usa `supabase.auth.signInWithPassword`, `signUp` (com `emailRedirectTo`), `resetPasswordForEmail` (redirect para `/login`) e há `AccountCredentialsCard` para troca de e-mail/senha. **Falta uma rota `/reset-password`** que consuma o link de recuperação e chame `supabase.auth.updateUser({ password })` — hoje o link cai em `/login`, o usuário é auto-logado e nunca troca a senha.

Edge Functions: apenas `bootstrap-super-admin` — usa `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` do projeto externo. OK, mas precisa ser deployada no novo projeto (verificar via `supabase--curl_edge_functions`).

Storage: buckets `mediuns-docs`, `mediuns-fotos`, `app-branding`, `templos-logos` já existem no projeto externo (todos privados). OK.

RLS / Functions / Triggers:
- Todas as tabelas listadas têm políticas; helpers `is_super_admin`, `user_templo`, `has_role`, `can_write_templo` estão `SECURITY DEFINER` com `search_path=public`.
- `set_updated_at` está sem `SECURITY DEFINER` (ok) mas os triggers de `updated_at` precisam ser conferidos no dump — a seção `db-triggers` mostra "There are no triggers", o que sugere que os triggers de `set_updated_at` e o `on_auth_user_created → handle_new_user` **não foram recriados** no projeto externo. Isso quebra criação automática de perfil no signup e o `updated_at` das tabelas.
- Últimos scripts (`security-fix-definer-2026-07-18.sql` + `fix-rls-helpers-execute-2026-07-18.sql`) precisam estar aplicados na ordem correta — validar via consulta a `pg_proc`/`information_schema.routine_privileges`.
- Extensões (`pgcrypto`, `pg_trgm`, `uuid-ossp`) foram criadas no dump inicial — reconfirmar no projeto externo.

Migrações pendentes / possíveis erros identificados a priori:
1. **Trigger `on_auth_user_created` ausente** → novos signups não geram `profiles` (a menos que o fluxo passe por `create_templo_request`, que faz upsert). Impacto: super admin criado por convite fica sem perfil.
2. **Triggers `set_updated_at` ausentes** em todas as tabelas com `updated_at`.
3. **Rota `/reset-password` inexistente** → fluxo de recuperação de senha incompleto.
4. **`og:image` e `twitter:site`** apontam para asset Lovable antigo — não quebra nada, mas continua exibindo screenshot desatualizado como preview social. Ajustar para logo do TemploHub ou remover.
5. **Confirmar `EXECUTE`** em `user_templo`, `is_super_admin`, `can_write_templo`, `has_role` para `authenticated` (fix 07-18 já entregue, mas precisa ser aplicado no banco novo se ainda não foi).
6. **`bootstrap-super-admin`** precisa ser (re)deployada no novo projeto e o secret `BOOTSTRAP_SETUP_TOKEN` reconfigurado.

## Entregáveis (fase de build)

1. **Consulta ao Supabase externo** (via `supabase--read_query`) para confirmar:
   - Existência dos triggers (`pg_trigger`) e das extensões (`pg_extension`).
   - Grants atuais em `user_templo`, `is_super_admin`, `has_role`, `can_write_templo`, `create_templo_request`.
   - Status do deploy da edge function `bootstrap-super-admin`.

2. **Relatório** em `/mnt/documents/auditoria-migracao-2026-07-19.md` com três seções: ✅ O que está correto · ⚠️ Ainda depende do Lovable (telemetria opcional + plugin de build + og:image) · ❌ Erros encontrados (triggers ausentes, rota reset-password, etc.).

3. **Arquivo único de correção** em `/mnt/documents/fix-migracao-supabase-2026-07-19.sql` contendo, de forma idempotente:
   - `CREATE EXTENSION IF NOT EXISTS` para pgcrypto/pg_trgm/uuid-ossp.
   - Recriação do trigger `on_auth_user_created` → `handle_new_user`.
   - Recriação dos triggers `set_updated_at` em cada tabela que tem a coluna.
   - Reaplicação dos `GRANT EXECUTE` dos helpers de RLS a `authenticated` (defensivo).
   - Comentários sobre passos manuais (deploy da edge function + set do `BOOTSTRAP_SETUP_TOKEN`).

4. **Correções de código** (mínimas, apenas para fechar a migração):
   - Criar `src/routes/reset-password.tsx` com formulário para `supabase.auth.updateUser({ password })`.
   - Ajustar `resetPasswordForEmail` em `src/routes/login.tsx` para `redirectTo: ${origin}/reset-password`.
   - Substituir `og:image`/`twitter:image` do `__root.tsx` pela logo do TemploHub (ou remover) e trocar `twitter:site` para um handle próprio ou remover.

5. **Checklist final** de migração 100% concluída em `/mnt/documents/checklist-migracao-2026-07-19.md`.

## O que fica intencionalmente fora

- Não remover `@lovable.dev/vite-tanstack-config` nem `lovable-error-reporting.ts` — são infraestrutura do editor Lovable, não do Lovable Cloud. Removê-los quebraria a preview.
- Não alterar RLS/negócio existente; apenas restaurar o estado pós-migração.
- Não tocar em `LOVABLE_API_KEY` (AI Gateway, opcional).
