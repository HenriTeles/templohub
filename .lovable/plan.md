## Diagnóstico (confirmado)

As requisições do navegador para o Supabase externo estão retornando **403** em praticamente tudo:

```
GET /rest/v1/profiles  → 42501 permission denied for function user_templo
GET /rest/v1/mediuns   → 42501 permission denied for function user_templo
GET /rest/v1/falanges / centurias → mesmo erro
POST /storage/v1/object/sign/templos-logos/... → 403 permission denied for function user_templo
```

Ou seja: os dados **estão** no lugar certo (o servidor lê tudo corretamente — a server function de sessão retornou perfil, papéis, templo e `logo_path`). O que falta é o `GRANT EXECUTE` para o papel `authenticated` nas funções auxiliares de RLS (`user_templo`, `is_super_admin`, `has_role`, `can_write_templo`) no banco externo — removido em um hardening anterior. Sem isso, toda política que chama essas funções falha.

Isso explica os dois sintomas exatos:
- Após salvar (o salvamento passa, pois vai por server function com service role) a navegação vai para a ficha, cuja leitura é client-side → 403 → o componente fica eternamente em "Carregando…".
- As fotos/logos somem porque `createSignedUrl` nos buckets `templos-logos`, `app-branding` e `mediuns-fotos` também depende dessas funções.

## Correção

### 1. Reparo definitivo no banco (SQL para você executar)

O acesso SQL direto ao banco externo falha por autenticação, então vou gerar um script pronto para colar no SQL Editor do Supabase:

```sql
GRANT EXECUTE ON FUNCTION public.user_templo(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_write_templo(uuid, uuid) TO authenticated;
-- + service_role nas mesmas funções
```

(Essas funções são `SECURITY DEFINER` e apenas respondem "sim/não" sobre o próprio usuário — conceder `EXECUTE` a `authenticated` é o uso previsto e não expõe dados.)

### 2. Blindagem no aplicativo (independe do passo 1)

Para que o app funcione mesmo enquanto o SQL não é aplicado, mover as leituras críticas para server functions autenticadas (que já funcionam):

- **Nova server function `getMediumDetail`** — retorna o médium, histórico, trino, campos e valores personalizados, além de uma **URL assinada da foto** gerada no backend. A ficha (`app.mediuns.$id.index.tsx`) passa a consumi-la, com estado de erro visível em vez de "Carregando…" infinito.
- **Nova server function `getMediunsList`** — alimenta a listagem `/app/mediuns` (hoje também 403).
- **Nova server function `getBrandingUrls`** — devolve URLs assinadas do logo global (`app-branding`) e do logo do templo (`templos-logos`); `useBrandingLogo` e o avatar do `AppShell` passam a usá-la, restaurando as fotos.
- Todas validam o vínculo do usuário com o templo antes de retornar qualquer coisa (mesmo padrão já usado em `mediums.functions.ts`).

### 3. Anti-tela-branca

Adicionar tratamento de erro nas telas afetadas: se a leitura falhar, exibir mensagem com o motivo e botão "Tentar novamente", em vez de travar em "Carregando…".

## Detalhes técnicos

- Novos arquivos: `src/lib/mediuns-read.functions.ts`, `src/lib/branding.functions.ts` (apenas declarações `createServerFn`, helpers em `.server.ts` correspondentes, conforme a regra de splitting do TanStack).
- Arquivos alterados: `src/routes/app.mediuns.$id.index.tsx`, `src/routes/app.mediuns.index.tsx`, `src/lib/branding.ts`, `src/components/AppShell.tsx`.
- Script SQL salvo em `/mnt/documents/fix-grants-rls.sql` para você executar no SQL Editor.
- Validação: navegar no preview autenticado até a listagem e a ficha de um médium e confirmar render + foto.
