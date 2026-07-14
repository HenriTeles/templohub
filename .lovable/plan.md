## Diagnóstico

A tela "Conta não carregada" mostra:
> Missing Supabase environment variable(s): SUPABASE_SERVICE_ROLE_KEY

Isso vem de `src/integrations/supabase/client.server.ts → resolveSupabaseSecretKey()`, chamado pela server function `getCurrentSessionData` (via `supabaseAdmin`).

Os secrets do projeto (Supabase externo `vuqogpswsdzlxuaeidcw`) contêm:
- `SUPABASE_SECRET_KEYS` ✅
- `SUPABASE_SERVICE_ROLE_KEY` ✅ (listado, mas aparentemente vazio/indisponível no runtime do Worker — a mensagem de erro confirma que `process.env.SUPABASE_SERVICE_ROLE_KEY` retorna `undefined`)
- `SUPABASE_PUBLISHABLE_KEYS` ✅ (novo formato)

O código atual de `resolveSupabaseSecretKey()` tenta:
1. `SUPABASE_SECRET_KEYS` como JSON com chave `default`
2. Fallback: `SUPABASE_SERVICE_ROLE_KEY`

O formato real de `SUPABASE_SECRET_KEYS` injetado pelo Lovable NÃO usa a chave `"default"` — é um objeto indexado por project ref, algo como `{"vuqogpswsdzlxuaeidcw":"sb_secret_..."}`. Por isso `parsed.default` é `undefined`, e o fallback também falha porque `SUPABASE_SERVICE_ROLE_KEY` não está populada no runtime (só o novo formato foi injetado).

Nada disso tem a ver com "Lovable Cloud" — o projeto já está 100% no Supabase externo. O problema é puramente a leitura da chave secreta no lado do servidor.

## Plano de correção

**1. Robustecer `resolveSupabaseSecretKey()` em `src/integrations/supabase/client.server.ts`**

Ordem de tentativa:
1. `SUPABASE_SERVICE_ROLE_KEY` (legado, texto puro) — se existir e não vazio.
2. `SUPABASE_SECRET_KEYS` como JSON:
   - se tiver `default`, usar.
   - senão, se tiver a chave `process.env.SUPABASE_PROJECT_ID` (ou `VITE_SUPABASE_PROJECT_ID`), usar.
   - senão, pegar o **primeiro valor** do objeto que comece com `sb_secret_` ou pareça um JWT.
3. Se `SUPABASE_SECRET_KEYS` for uma string simples (não JSON), usar direto.

Mensagem de erro mais clara quando nada for encontrado, listando quais envs foram tentadas (sem vazar valores).

**2. Verificação**

Após o deploy da correção, recarregar `/` autenticado. A tela "Conta não carregada" deve desaparecer e o dashboard deve renderizar. Se ainda falhar, os logs da server function mostrarão exatamente qual env está ausente.

## Fora de escopo

- Nenhuma alteração de schema, RLS, ou rotas.
- Nenhuma mudança no cliente browser (`client.ts`), que já está correto após o fix de SSR.
- Não há nenhuma conexão remanescente com "Lovable Cloud" — o `.env` e todos os clients apontam para `vuqogpswsdzlxuaeidcw.supabase.co`.
