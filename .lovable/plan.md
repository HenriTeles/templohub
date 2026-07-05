## Objetivo

Recriar no novo Supabase (`vuqogpswsdzlxuaeidcw`) toda a estrutura que estava no Lovable Cloud: 19 tabelas, 7 enums, funções `SECURITY DEFINER`, triggers, RLS + policies, GRANTs, 4 buckets de Storage com suas policies, e os dados atualmente exportados.

O dump reordenado já existe em `/mnt/documents/templohub-dump-v2.sql` (677 linhas, 33 INSERTs de dados). Vou aplicá-lo em blocos via a ferramenta de migração e criar os buckets via a ferramenta de storage.

## O que será executado

### 1. Buckets de Storage (via tool dedicada)
Criar como **privados** (todos usam signed URLs no código):
- `mediuns-docs`
- `mediuns-fotos`
- `app-branding`
- `templos-logos`

### 2. Migração — Schema base
- 7 ENUM types (`app_role`, `mediun_sexo`, `mediun_funcao`, `mediun_polaridade`, `mediun_situacao`, `mentor_tipo`, `templo_status`)
- 19 tabelas em `public` (profiles, user_roles, templos, app_settings, configuracoes, adjuracoes, centurias, falanges, legioes, povos, reinos, trinos, mentores, mediuns, mediun_mentores, anexos, historico, medium_custom_fields, medium_custom_values)
- Constraints na ordem correta: PKs → UNIQUEs → CHECKs → FKs (só do schema `public`; as FKs para `auth.users` ficam para depois)
- Índices

### 3. Migração — Funções e triggers
- Funções `SECURITY DEFINER`: `has_role`, `is_super_admin`, `user_templo`, `can_write_templo`, `create_templo_request`, `approve_templo`, `reject_templo`, `update_templo`, `handle_new_user`, `promote_super_admin_by_email`, `set_updated_at`
- Triggers `trg_updated_at` / `mcf_touch` / `mcv_touch`
- `GRANT EXECUTE` para `authenticated` nas funções-helper de RLS (invariante já documentado no `.lovable/plan.md`)

### 4. Migração — RLS e Policies
- `ENABLE ROW LEVEL SECURITY` em todas as 19 tabelas
- Todas as policies de SELECT/INSERT/UPDATE/DELETE (scoped por `templo_id`, `has_role`, `is_super_admin`)
- `GRANT SELECT/INSERT/UPDATE/DELETE ... TO authenticated` + `GRANT ALL ... TO service_role` em cada tabela

### 5. Migração — Storage policies
Recriar policies em `storage.objects` para os 4 buckets, mantendo o escopo por templo (path começa com `<templo_id>/…`), exceto `app-branding` que é global (SELECT para authenticated, escrita só super_admin).

### 6. Migração — Dados existentes (33 INSERTs)
`INSERT … ON CONFLICT DO NOTHING` das linhas atuais das tabelas doutrinárias globais (falanges, centúrias, adjurações, trinos, povos, legiões, reinos), do `app_settings`, do templo Vajaro, etc. **Não** insere `profiles`/`user_roles` porque dependem de `auth.users` (usuários serão recriados via signup normal).

## O que fica de fora (e por quê)

- **FKs para `auth.users`** (`profiles.id → auth.users.id`, `user_roles.user_id → auth.users.id`, `app_settings.updated_by → auth.users.id`): não recriadas agora. Os usuários novos serão criados via signup normal do app e a trigger `handle_new_user` popula `profiles` automaticamente. Se você quiser preservar os UUIDs antigos, isso exige recriar os usuários via Admin API — posso fazer num passo seguinte.
- **Arquivos de Storage**: os buckets serão criados vazios. A cópia dos objetos (logos, fotos, anexos) do bucket antigo do Lovable Cloud para o novo Supabase precisa ser feita fora (script Node com service_role) — está descrito em `/mnt/documents/MIGRACAO-SUPABASE.md`.
- **Trigger `on_auth_user_created`** em `auth.users`: **é** criada normalmente (não modifica o schema `auth`, só anexa uma trigger que chama `public.handle_new_user`). Só é necessária para novos signups.
- **Edge Functions**: `bootstrap-super-admin` continua existindo no repo; posso implantar depois se você usar.

## Detalhes técnicos

- Ordem de execução respeitada: buckets → enums → tabelas → constraints públicas → índices → funções → triggers → RLS/policies → grants → dados.
- Migração dividida em múltiplas chamadas (schema, funções, policies, dados) para facilitar aprovação e rollback caso alguma parte falhe.
- Nenhuma alteração no `.env` — as variáveis `VITE_SUPABASE_*` já foram atualizadas quando você conectou o projeto.
- Nenhuma alteração no código do app é necessária: `src/integrations/supabase/client.ts` e `types.ts` já apontam para o novo projeto.

## Depois que rodar

1. Fazer signup do super admin (`henriquetelesdorosario@hotmail.com`) na tela `/login`.
2. Chamar `promote_super_admin_by_email('henriquetelesdorosario@hotmail.com')` via SQL para atribuir o role.
3. Testar: login → deve cair em `/app/admin`.
4. (Opcional) Rodar script de cópia de arquivos dos buckets antigos, se você tiver acesso ao projeto Lovable Cloud antigo.

Posso prosseguir?
