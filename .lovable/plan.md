## Objetivo
Garantir que, após login com credenciais corretas, cada usuário seja enviado sempre para a página correta:
- Administrador Geral → `/app/admin`
- Conta de templo ativa → `/app/dashboard`
- Conta de templo pendente/suspensa → tela de status do templo
- Somente conta realmente sem templo/permissão → cadastro de templo

## Causa identificada
O login em si está funcionando. O erro vem do banco: a chamada a `profiles` está retornando `500 stack depth limit exceeded`, causado por recursão nas políticas RLS/funções auxiliares (`profiles_select`, `user_roles_select`, `is_super_admin`, `user_templo`, `has_role`). Quando essa leitura falha, o app fica sem `profile/templo` e interpreta a conta existente como se fosse uma conta nova, exibindo “Cadastro do Templo”.

## Plano de correção
1. **Corrigir a recursão RLS no Supabase externo**
   - Criar um script SQL de reparo para as funções `is_super_admin`, `has_role`, `user_templo` e `can_write_templo` usando `SECURITY DEFINER` com `search_path` fixo, para que elas possam consultar `profiles/user_roles` sem disparar novamente as próprias políticas RLS.
   - Manter `EXECUTE` restrito apenas aos papéis necessários (`authenticated` e `service_role`) nessas funções usadas pelas políticas.
   - Ajustar as políticas de `profiles` e `user_roles` para não entrarem em ciclo entre si.

2. **Blindar o carregamento de sessão no frontend**
   - Transformar o estado de sessão em uma decisão explícita: `signed_out`, `loading`, `ready`, `needs_onboarding`, `templo_pending/suspended`, `account_error`.
   - Nunca redirecionar para `/onboarding` quando uma consulta de conta falhar; falha de leitura deve mostrar erro/retry, não cadastro.
   - Só permitir `/onboarding` quando a sessão carregou com sucesso e não existe `profile.templo_id`, nem `user_roles.templo_id`, nem papel de Administrador Geral.

3. **Centralizar redirecionamentos**
   - Criar uma função única de destino pós-login baseada em sessão/roles/templo.
   - Usar essa função em `/`, `/login`, `/onboarding` e `AppShell`, evitando regras duplicadas que possam divergir em melhorias futuras.
   - Depois de `signInWithPassword`, aguardar `refresh()`/carregamento da sessão antes de navegar, em vez de mandar cegamente para `/`.

4. **Proteger rotas do app**
   - Em `/app`, bloquear renderização até `SessionProvider` terminar de carregar.
   - Redirecionar usuário deslogado para `/login`.
   - Redirecionar usuário sem autorização real para a tela correta sem cair em cadastro por erro temporário.

5. **Adicionar documentação de estabilidade**
   - Registrar no código, próximo à função central de redirecionamento, a regra: “não enviar conta existente para onboarding em caso de erro de leitura”.
   - Assim futuras alterações de UI/funcionalidade não mexem novamente no comportamento crítico de autenticação.

## Validação
- Verificar no preview que a requisição a `profiles` não retorna mais `stack depth limit exceeded`.
- Testar login e refresh em `/`, `/login`, `/app/dashboard` e `/app/admin`.
- Confirmar que uma conta existente não vê mais “Cadastro do Templo” quando já possui vínculo ou papel.
- Confirmar que apenas conta nova, sem templo e sem role, continua indo para cadastro.