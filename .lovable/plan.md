## Diagnóstico

Os três pontos têm a mesma causa raiz — visível nos logs de rede: as consultas retornam **403 `permission denied for function user_templo`**.

Em correções de segurança anteriores, o `EXECUTE` das funções `SECURITY DEFINER` (`user_templo`, `has_role`, `is_super_admin`, `can_write_templo`) foi revogado de `authenticated`. Como as políticas RLS de `profiles` e `user_roles` chamam essas funções durante o SELECT, toda leitura do usuário logado falha com 403.

Consequências observadas:
1. **Loading infinito / lento** → `SessionProvider` tenta carregar `profiles` e `user_roles`, ambos retornam 403; o estado nunca resolve corretamente.
2. **Redireciona para cadastro após login** → como `profiles` retorna vazio (403), `templo_id` é lido como `null` e o gateway manda para `/onboarding`, mesmo para o super admin e para o admin do templo Vajaro (que já existem no banco).
3. **App está conectado?** Sim — está conectado via **Lovable Cloud** (nosso backend gerenciado). Você não precisa configurar nada; URL e chave pública já estão no `.env` e funcionando (o login retorna 200). O problema é puramente de permissão nas funções do banco.

## Correção

**Passo único — migração SQL:**

```sql
GRANT EXECUTE ON FUNCTION public.user_templo(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_templo(uuid, uuid) TO authenticated;
```

Essas funções são `SECURITY DEFINER` com `search_path` fixo e apenas leem `user_roles`/`profiles` do próprio usuário — são helpers necessários para o RLS avaliar as políticas. Conceder `EXECUTE` a `authenticated` é o padrão correto (e já está documentado no `@security-memory` como invariante).

## Atualização do `@security-memory`

Reforçar o invariante: "As funções helper de RLS (`user_templo`, `has_role`, `is_super_admin`, `can_write_templo`) **devem** ter `EXECUTE` concedido a `authenticated`; revogá-las quebra toda leitura autenticada." Isso previne que um futuro scan sugira revogar novamente.

## Validação

1. Recarregar a página logada → `profiles` e `user_roles` retornam 200.
2. Super admin (`henriquetelesdorosario@hotmail.com`) → cai em `/app/admin`, não em `/onboarding`.
3. Admin do Vajaro → cai em `/app/dashboard`, não em `/onboarding`.
4. Tela de "Carregando…" resolve imediatamente após o login.

## Sobre a conexão

O app **está** conectado ao backend (Lovable Cloud). Não é preciso fornecer URL ou chaves — tudo já está configurado. O erro que você observa não é falta de conexão, é permissão de função no banco.
