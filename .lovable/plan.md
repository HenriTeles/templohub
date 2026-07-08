## Objetivos

1. Reentregar a migration SQL da ficha do médium.
2. Corrigir de vez o bug "não consegue logar / templo Vajaro é recriado".
3. Ajustar a aparência para bater com o mockup (ícones em tiles arredondados + ícone de perfil no topo direito).

---

## 1. Migration da ficha (reentrega)

Já existe em `/mnt/documents/migration-ficha-medium.sql`. Vou reexpor como artefato baixável na mensagem seguinte:

```
<presentation-artifact path="migration-ficha-medium.sql" mime_type="application/sql"></presentation-artifact>
```

Rode uma única vez no SQL Editor do Supabase para criar as colunas novas em `public.mediuns`.

---

## 2. Bug de login recriando o templo Vajaro

**Causa raiz** (confirmada por leitura do código + logs):

- A função `handle_new_user()` existe mas **não há trigger ativo em `auth.users`** (a seção `<db-triggers>` do Supabase informa "There are no triggers in the database"). Resultado: usuários novos **não recebem linha em `public.profiles`**.
- No login, `SessionProvider.load()` faz `select ... from profiles` → volta `null` → `templo_id` fica `null` → `Gateway` manda para `/onboarding`.
- No `/onboarding`, o RPC `create_templo_request` cria o templo (por isso aparece no painel do super admin), mas o `UPDATE public.profiles SET templo_id = ... WHERE id = _uid` **afeta 0 linhas** (perfil inexistente). Na próxima sessão, `templo_id` continua `null` → volta pra tela de cadastro → templo é criado de novo → duplicata "Templo Vajaro".
- O erro do React `Encountered two children with the same key: Templo Vajaro` em `app.admin.tsx:147` (`key={f.nome}`) é sintoma do mesmo problema — existem múltiplos templos com o mesmo nome.

**Correções (uma migration + dois arquivos):**

a) **Migration** (schema/DDL, via ferramenta de migração):
   - Criar `trigger on_auth_user_created AFTER INSERT ON auth.users EXECUTE FUNCTION public.handle_new_user()`.
   - Backfill: `INSERT INTO public.profiles (id, email, nome) SELECT id, email, split_part(email,'@',1) FROM auth.users WHERE id NOT IN (SELECT id FROM public.profiles) ON CONFLICT DO NOTHING`.
   - Endurecer `create_templo_request`: fazer `INSERT ... ON CONFLICT DO NOTHING` em `profiles` no início da função (garante linha antes do UPDATE), e checar `FOUND` no UPDATE.
   - **Não** deletar os templos duplicados automaticamente — deixar para o super admin resolver na tela `/app/admin`.

b) **`src/routes/app.admin.tsx`**: trocar `key={f.nome}` por `key={f.id}` (e no restante do arquivo, garantir keys por id) para eliminar o warning e permitir remover duplicatas corretamente.

c) **`src/routes/onboarding.tsx`**: após `create_templo_request` bem-sucedido, se `s.refresh()` ainda retornar `templo_id === null`, mostrar mensagem de erro em vez de deixar o botão disponível para reenviar — evita duplicatas mesmo em cenários futuros.

---

## 3. Aparência conforme mockup

Observações do usuário: "os elementos gráficos (ícones)" e "ícone de perfil do usuário (bonequinho) no canto superior direito".

Ajustes só em UI:

a) **`src/components/AppShell.tsx`** — cabeçalho mobile:
   - Adicionar botão redondo com ícone `User` (lucide) no canto direito da top-bar, abrindo um pequeno menu (email + "Sair") — hoje o topbar só tem o hamburger e o título "TemploHub".
   - Manter o hamburger à esquerda e o título centralizado/à esquerda como está.

b) **`src/routes/app.admin.tsx`** (Painel Global — a tela do mockup) e **`src/routes/app.dashboard.tsx`**:
   - Padronizar os KPIs com **tiles de ícone quadrados arredondados** (`rounded-xl`, `p-3`, cor semântica de fundo suave) como no mockup — hoje o admin usa esse padrão mas o dashboard usa cores hardcoded (`bg-[oklch(...)]`). Trocar por tokens (`bg-primary/10`, `bg-accent/20`, `bg-destructive/10`) para ficar coeso com o mockup.
   - Alinhar o espaçamento interno dos cards (mockup: número grande em cima, label em cinza embaixo).

Sem mudanças de layout, cores globais, tipografia ou reorganização — só os ajustes de ícones e o botão de perfil pedidos.

---

## Arquivos tocados

- migration SQL nova (trigger + backfill + hardening do RPC) — via ferramenta de migração
- `src/routes/app.admin.tsx` (key + tiles)
- `src/routes/app.dashboard.tsx` (tiles com tokens)
- `src/routes/onboarding.tsx` (guarda contra reenvio)
- `src/components/AppShell.tsx` (botão de perfil no topo)
- reentrega de `/mnt/documents/migration-ficha-medium.sql`

## Fora do escopo

- Não deletar templos duplicados automaticamente.
- Não mexer em RLS, autenticação, ou nas telas de médium.
