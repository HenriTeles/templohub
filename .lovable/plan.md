## Diagnóstico

Do I know what the issue is? Sim.

O erro atual não é senha nem tela de login: a autenticação acontece, mas o carregamento da conta falha no Supabase externo porque as permissões de execução foram revogadas de funções usadas pelas políticas RLS.

Evidências capturadas:

- `permission denied for function user_templo` ao ler os dados da conta.
- fallback por server function falhando com `Not found` em uma rota `/_serverFn`.
- tentativa de cadastro/onboarding falhando com `permission denied for function create_templo_request`.

Resultado: o app recebe sessão válida, mas não consegue descobrir se o usuário é administrador geral ou pertence ao templo Vajaro; por isso cai novamente na tela de “Cadastro do Templo”.

## Plano de correção

1. **Corrigir a causa no Supabase externo**
   - Gerar um SQL de reparo para restaurar `EXECUTE` apenas nas funções necessárias ao login/RLS:
     - helpers de leitura/autorização usados por políticas, como `user_templo`, `is_super_admin`, `can_write_templo`, `has_role`.
     - `create_templo_request`, mantendo validação por `auth.uid()` para onboarding legítimo.
   - Manter RPCs administrativas sensíveis, como aprovação/exclusão/edição de templos, restritas ao fluxo seguro já existente.
   - Incluir consultas de diagnóstico/backfill para reconciliar perfis sem `templo_id` quando houver vínculo em `user_roles`.

2. **Blindar o redirecionamento pós-login**
   - No login, se a senha estiver correta mas a conta administrativa não carregar, não enviar para `/onboarding`.
   - Exibir uma tela de erro de conta carregada parcialmente, com origem técnica visível.
   - Só permitir `/onboarding` quando realmente não existir vínculo de templo, papel ou erro de leitura.

3. **Mostrar a causa do erro na tela a partir de agora**
   - Criar um painel reutilizável de erro de conta para `/`, `/login` e `/onboarding`.
   - Exibir:
     - origem: Supabase/RLS, server function ou sessão;
     - detalhe bruto seguro, por exemplo `permission denied for function user_templo`;
     - ação sugerida: tentar novamente ou sair.
   - Preservar logs no console, mas não depender deles para o usuário entender o problema.

4. **Reduzir dependência do fallback instável**
   - Tratar o fallback `getCurrentSessionData` como diagnóstico auxiliar, não como caminho obrigatório para o login.
   - Quando o fallback der `Not found`, mostrar isso na tela junto com o erro primário do Supabase.

5. **Validação**
   - Confirmar que uma conta autenticada nunca é enviada ao cadastro enquanto houver erro de leitura de perfil/templo.
   - Confirmar que, se o banco ainda estiver mal configurado, a tela mostra exatamente a função/permissão que causou a falha.
   - Confirmar que após executar o SQL no Supabase externo, administrador geral e templo Vajaro seguem para suas áreas corretas.

## Observação importante

Como a causa principal está no Supabase externo, a parte definitiva exige executar o SQL de reparo no SQL Editor do Supabase. A alteração no app vai impedir o redirecionamento errado e mostrar a causa real na tela mesmo antes do banco ser corrigido.

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>