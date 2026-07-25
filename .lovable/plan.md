## Plano para corrigir o erro “Conta não carregada”

1. **Confirmar a falha real no login**
   - Reproduzir o acesso com sessão autenticada no preview.
   - Coletar o detalhe técnico exibido pela tela “Conta não carregada”.
   - Verificar logs de server function e chamadas Supabase relacionadas ao carregamento de `profiles`, `user_roles` e `templos`.

2. **Corrigir a causa no banco/RLS**
   - Ajustar permissões mínimas de execução dos helpers usados pelas políticas RLS, especialmente funções como `user_templo`, `has_role`, `is_super_admin` e `can_write_templo`, sem reabrir RPCs administrativas inseguras.
   - Garantir que as políticas de `profiles`, `user_roles` e `templos` permitam que cada usuário autenticado leia somente sua própria conta/templo, e que o Administrador Geral consiga carregar seu papel global.
   - Se houver perfil/papel órfão após a migração do Lovable Cloud para o Supabase externo, reconciliar os vínculos por e-mail/UUID sem expor dados entre templos.

3. **Fortalecer o carregamento de sessão no código**
   - Ajustar o fluxo de `SessionProvider`/`getCurrentSessionData` para não cair em “Conta não carregada” quando a leitura direta via browser for bloqueada por RLS mas a server function autenticada puder resolver a conta.
   - Manter a regra de segurança: conta com vínculo real não deve ser enviada para cadastro/onboarding por falha temporária de leitura.
   - Melhorar o tratamento de erro para diferenciar: permissão RLS, função não registrada, perfil inexistente, papel inexistente e templo inexistente.

4. **Testar os dois tipos de conta**
   - Testar login da conta de templo e confirmar redirecionamento para `/app/dashboard` com menu/dados do templo carregados.
   - Testar login da conta de Administrador Geral e confirmar redirecionamento para `/app/admin` com painel global carregado.
   - Testar logout/login alternado entre as duas contas para garantir que cache/localStorage não mantenha estado antigo.
   - Validar que a tela “Conta não carregada” não retorna após atualizar a página.

5. **Validar segurança após a correção**
   - Verificar que a correção não reabre execução pública/autenticada de funções administrativas `SECURITY DEFINER`.
   - Manter apenas os helpers estritamente necessários às políticas RLS acessíveis para `authenticated`.
   - Conferir que usuários de templo continuam isolados por `templo_id`.