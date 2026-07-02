## Objetivo

Corrigir 4 pontos: (1) super admin sendo tratado como templo, (2) lentidão de carregamento, (3) formulário de médium condicional por função + novos campos, (4) falanges duplicadas no dropdown.

---

## 1. Super admin não é um templo

**Backend (migração)**
- Se `henriquetelesdorosario@hotmail.com` tem `templo_id` no `profiles`, limpar (`UPDATE profiles SET templo_id = NULL WHERE id = <super_admin>`), remover o vínculo `admin` do templo criado por engano em `user_roles`, e apagar o `templo` órfão (o que ficou pendente/ativo criado por ele).
- Ajustar `create_templo_request` para bloquear super admins (`IF is_super_admin(auth.uid()) THEN RAISE EXCEPTION 'super admins do not belong to templos'`).

**Frontend**
- `src/routes/index.tsx`: se `roles.includes('super_admin')`, redirecionar direto para `/app/admin` (nunca para `/onboarding`).
- `AppShell.tsx`: para super admin, ocultar itens do menu específicos de templo (Dashboard/Médiuns/Buscar/Configurações) e mostrar apenas "Super Admin"; o rótulo da sidebar deve dizer "Super Administração" sem exigir templo.
- `onboarding.tsx`: se super admin cair aqui, redirecionar para `/app/admin`.

---

## 2. Dashboard do super admin (visão global + edição de templos)

Reformular `src/routes/app.admin.tsx` para virar o dashboard do super admin:
- **KPIs globais**: total de templos (ativos/pendentes/suspensos), total de médiuns em todo o sistema, total de mestres/ninfas, novos templos e médiuns nos últimos 30 dias.
- **Gráfico**: médiuns por templo (top 10).
- **Lista de templos** com busca por nome/cidade/UF, filtros por status, e ações inline: aprovar, rejeitar/suspender, reativar, **editar** (nome, cidade, estado, status) via modal, e ver contagem de médiuns do templo.
- Ações extras: alternar status ativo/suspenso, editar dados básicos do templo.
- Adicionar RPC `update_templo(_id, _nome, _cidade, _estado, _status)` restrita a super admin (a policy atual já bloqueia UPDATE geral). Alternativamente, ajustar policy de UPDATE em `templos` para permitir `is_super_admin(auth.uid())`.

---

## 3. Corrigir lentidão de carregamento

Causas identificadas em `src/lib/session.ts` e no fluxo de gateway:
- `useSession` roda `load()` duas vezes na entrada: uma no `getSession()` e outra no `onAuthStateChange` (evento `INITIAL_SESSION`).
- Cada `load()` faz 3 queries sequenciais (profiles, user_roles, templos).
- Cada rota do app (`AppShell`, `index`, `dashboard`, `onboarding`) instancia `useSession` independente → refazendo tudo do zero N vezes.

**Correções**
- Compartilhar sessão via `React Context` (`SessionProvider` no `__root.tsx`) — um único fetch para toda a app.
- No `load()`, filtrar `onAuthStateChange` para reagir apenas a `SIGNED_IN`/`SIGNED_OUT`/`USER_UPDATED` (ignorar `INITIAL_SESSION` e `TOKEN_REFRESHED`), como recomenda o guia.
- Buscar profile + user_roles + templo em paralelo (uma única promise combinada).
- Mostrar o `AppShell` renderizado imediatamente enquanto sessão carrega (skeleton) em vez de tela em branco central que remonta a árvore.

---

## 4. Formulário de médium — Particularidades Mediúnicas condicional

**Seed de falanges (migração)**
- Limpar as falanges globais atuais e reinserir com a categoria correta:
  - `categoria = 'ninfa'`: Nityama, Samaritana, Grega, Maya, Yurici, Muruayci, Dharman Oxinto, Jaçanã, Ariana da Estrela Testemunha, Madalena de Cássia, Franciscana, Narayama, Rochana, Cayçara, Tupinambá, Cigana Aganara, Cigana Tagana, Agulha Ysmênia, Nyatra.
  - `categoria = 'mestre'`: Magos, Príncipe Maya.
- Remover cópias duplicadas por templo (o `approve_templo` copiava globais para o templo — remover essa cópia e sempre ler do global). Ajustar `approve_templo` para não replicar mais.
- Novas colunas em `mediuns` (nullable, texto livre): `guia_missionaria`, `ministro`, `cavaleiro`, `preto_velho`, `caboclo`, `medico_cura`.

**Frontend (`app.mediuns.$id.edit.tsx`)**
- Carregar falanges filtrando por `categoria` = função selecionada; se função vazia, dropdown desabilitado.
- Renomear rótulo "Polaridade" → "Mediunidade" (valores continuam `apara`/`doutrinador` internamente).
- Substituir o bloco Particularidades Mediúnicas por layout condicional:

  Comum (sempre exibido, nesta ordem):
  1. Função (Mestre / Ninfa)
  2. Mediunidade (Apará / Doutrinador)
  3. Falange (dropdown filtrado por função)

  Se `funcao = 'ninfa'`:
  4. Guia Missionária (dropdown — placeholder por enquanto, será preenchido pelo usuário depois; renderizar como Select vazio com aviso "Em breve" ou input livre)

  Se `funcao = 'mestre'`:
  4. Ministro (input texto livre)
  5. Cavaleiro (input texto livre)

  Ambos (na sequência final):
  6. Preto-velho / Preta-velha (input texto livre)
  7. Caboclo / Cabocla (input texto livre)
  8. Médico(a) de cura (input texto livre)

- Remover o segundo "Falange Missionária" duplicado (bug do dropdown repetido).
- Corrigir também o fato do dropdown atual listar templo-scoped + global juntos: passar a ler somente `templo_id IS NULL` (globais) filtrado por categoria.

---

## Fora do escopo
- Não mexer no CRUD geral de médiuns, dashboard normal, busca, storage, RLS de storage — já validados.
- Guias missionárias ficam como campo em branco/placeholder; o usuário fornecerá a lista depois.
