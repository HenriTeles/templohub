# Item 1.2 — Autorização das RPCs administrativas: fonte única de verdade

## 1. Diagnóstico do estado atual (o que consegui verificar)

Verificado por leitura de código e do dump de funções do projeto:

- As quatro RPCs administrativas são chamadas **exclusivamente** pelo servidor com o cliente de serviço, em `src/lib/templo-admin.functions.ts`: `approve_templo` (l.17), `reject_templo` (l.28), `delete_templo` (l.39), `update_templo` (l.60). Não há nenhuma chamada dessas funções a partir do navegador.
- Cada uma dessas server functions já executa `assertSuperAdmin(context.userId)` antes da chamada — essa é, hoje, a única verificação de permissão que realmente reflete quem está agindo.
- No corpo SQL, as quatro funções fazem `IF NOT public.is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'forbidden'`. Chamadas pela chave de serviço, `auth.uid()` é nulo, então essa checagem **não protege nada** e ainda tende a derrubar a ação com "forbidden" (bate com os relatos anteriores de "ações administrativas falhando").
- O dump atual de funções mostra `public.is_super_admin`, `has_role`, `user_templo` e `can_write_templo` ainda como `SECURITY DEFINER` no schema `public`, com o corpo original — ou seja, o script `harden-security-definer-2026-08-11.sql` (wrappers em `app_private`) **não está aplicado**. O schema `app_private` já existe parcialmente (é referenciado por `apply_admin_password_reset`).

O que **não** consegui verificar daqui: os GRANT/REVOKE efetivos (`proacl`) de cada função. Esta sessão não tem acesso SQL ao banco externo — a senha de `EXTERNAL_SUPABASE_DB_URL` é rejeitada pelo host direto e o tenant não resolve no pooler; a chave anon não pode ler o metadado do PostgREST e a sessão de navegador injetada está expirada. Portanto **não afirmo** se o `harden-security-definer-2026-08-04.sql` foi aplicado; o alerta ainda aberto no scanner sugere que não (ou que foi aplicado só em parte).

Primeiro passo do plano, então, é uma consulta somente-leitura que você roda no SQL Editor (ou eu rodo, se você me passar acesso ao banco) para fotografar o estado real antes de qualquer alteração.

## 2. Passo 1 — consulta de diagnóstico (somente leitura, nada muda)

```sql
select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' as funcao,
       case when p.prosecdef then 'DEFINER' else 'INVOKER' end as tipo,
       coalesce(array_to_string(p.proacl, E'\n'), 'PADRÃO (PUBLIC pode executar)') as privilegios
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname in ('public','app_private')
order by 1;
```

Leitura do resultado: para `approve_templo`, `reject_templo`, `update_templo`, `delete_templo` e `promote_super_admin_by_email`, o esperado após o hardening é aparecer apenas `service_role=X/postgres` (mais o dono) — qualquer `anon=X` ou `authenticated=X` significa que o script de 04/08 não está aplicado.

## 3. Passo 2 — mudança proposta (a aplicar só com sua autorização)

Fonte única de verdade: **a autorização vive no server function** (`assertSuperAdmin`), e o banco garante que essas RPCs sejam tecnicamente inalcançáveis por qualquer papel que não seja `service_role`.

Um único script novo, `supabase/manual/rpc-admin-service-role-only-2026-08-13.sql`, idempotente, com três blocos:

1. **Remover a checagem interna de `auth.uid()`** das quatro RPCs (`CREATE OR REPLACE FUNCTION` mantendo assinatura, `SECURITY DEFINER` e corpo idênticos, sem o `IF NOT is_super_admin(auth.uid()) ... forbidden`). Motivo: ela é falsa proteção e é justamente o que faz a ação falhar quando chamada pela chave de serviço.
2. **Revogar execução** de `PUBLIC`, `anon` e `authenticated` nas quatro funções + `promote_super_admin_by_email`, e conceder `EXECUTE` só a `service_role`. Isso repete o que o script de 04/08 já pretendia — reaplicar é seguro e idempotente.
3. **Comentário `COMMENT ON FUNCTION`** em cada uma registrando "somente service_role; autorização feita em assertSuperAdmin", para a próxima pessoa não reintroduzir a checagem.

Nenhuma alteração no código da aplicação é necessária: `templo-admin.functions.ts` já valida o Administrador Geral e já usa `supabaseAdmin`.

### Por que isso não quebra o login

Os incidentes anteriores de login vieram de mexer nos **helpers de RLS** (`is_super_admin`, `user_templo`, `can_write_templo`, `has_role`) — as policies são avaliadas com os privilégios do usuário chamador, e revogar `EXECUTE` desses helpers de `authenticated` derruba toda leitura. Este script **não toca em nenhum desses helpers**, nem em policies, nem em grants de tabela. Ele altera apenas quatro RPCs administrativas que só o servidor chama, mais uma função de promoção que ninguém chama do cliente. O carregamento de conta hoje já passa por `getCurrentSessionData`, que usa a chave de serviço e não depende dessas RPCs.

### Escopo intocado

Sem mudanças em: `create_templo_request`, helpers de RLS, `app_settings`, `admin_password_resets`, grants de tabela, buckets, ou qualquer arquivo fora do novo `.sql`.

## 4. Validação depois de aplicar

1. Rodar de novo a consulta do passo 1 e confirmar que as cinco funções mostram só `service_role`.
2. Login em produção com o Administrador Geral e com a conta do templo — dashboards carregando, sem erro de conta.
3. Painel Global: editar um templo (`update_templo`) e verificar que salva; aprovar/rejeitar em um templo de teste; `delete_templo` só se você quiser, em um templo de teste criado para isso.
4. Confirmar que uma chamada direta a `/rest/v1/rpc/approve_templo` com a chave anon/usuário logado retorna erro de permissão.
5. Reexecutar o scanner de segurança e reportar o alerta.
