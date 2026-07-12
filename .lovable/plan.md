
## Mudanças

### 1. Ficha do médium (`src/routes/app.mediuns.$id.edit.tsx` + `src/lib/medium-fields.ts` + `src/routes/app.mediuns.$id.index.tsx`)

- **Falange missionária (feminino)**: em `medium-fields.ts`, remover `"Nityama/Madruxa"` e inserir no topo `"Nityama"` e `"Nityama Madruxa"`.
- **Janda (feminino)**: só renderizar o dropdown quando `form.falange_missionaria === "Yuricy"` ou `"Yuricy Lua"`. Ao trocar a falange para outra opção, limpar `form.janda`. Também esconder o campo no detalhe (`app.mediuns.$id.index.tsx`) quando não se aplicar.
- **Turno** vira dropdown:
  - Feminino: `Doragana`, `Sabarana`.
  - Masculino: `Reili`, `Dubali`.
- **Turno de trabalho** (ambos os gêneros) vira dropdown com: Adelanos, Adonares, Aganaros, Ajouros, Amoros, Galero, Gramouros, Maturos, Muranos, Savanos, Valúrios, Venário, Venário especial, Vogues.
- **Foto na ficha (`app.mediuns.$id.index.tsx`)**: reduzir o container de foto de 350×350 para 175×175 (e a Card wrapper `w-[370px]` → `w-[195px]`). **Manter** o tamanho atual dos badges de Mediunidade, Situação e dos ícones (crucifixo/triângulo `w-12 h-12`).

### 2. Persistência do formulário quando o navegador é minimizado

Sintoma real: hoje se o usuário troca de aba/minimiza, o Supabase dispara `TOKEN_REFRESHED`/`SIGNED_IN` ao voltar, o `SessionProvider` re-renderiza tudo, o `useEffect` do edit dispara e sobrescreve `form` com o que está no banco, perdendo o que foi digitado.

Correção: em `app.mediuns.$id.edit.tsx`, guardar o carregamento inicial por `id` com uma `ref` (`loadedIdRef`) para que o `useEffect` só popule `form`/`customValues` uma única vez por registro. Não recarregar novamente enquanto o mesmo médium estiver aberto, mesmo que `s.templo?.id` mude de referência.

### 3. Logo da tela de login não atualiza

Em `src/routes/login.tsx`, hoje a logo provavelmente é carregada uma vez sem ouvir o evento `templohub:branding-logo-updated` disparado pelo painel do Administrador Geral. Vou:

- Extrair a lógica do `useBrandingLogo` de `AppShell.tsx` para `src/lib/branding.ts` (hook reutilizável).
- Usar esse hook no `login.tsx` (e manter em `AppShell.tsx`) para que ambos escutem o mesmo evento e recarreguem a URL assinada quando o Administrador Geral trocar a logo.

### 4. Ornamentos decorativos no menu lateral (`src/components/AppShell.tsx`)

Baseado na imagem de referência, adicionar apenas dois ornamentos dourados (sem reintroduzir o botão "X"):

- **Diamante dourado** ao lado direito do rótulo `NAVEGAÇÃO`: uma linha `<div className="mt-4 flex items-center gap-3">` com o texto + um SVG/ícone Lucide (`Diamond` girado ou `Sparkle`) na cor `text-sidebar-primary` seguido de uma linha fina dourada expandindo até a borda.
- **Sol/leque ornamental** acima do card de e-mail no rodapé: uma pequena arte SVG inline (semi-círculo com raios dourados centralizado) entre o `nav` e o footer, flanqueado por duas linhas finas com um diamante pequeno em cada ponta.

Ambos elementos puramente decorativos, sem interação.

## Detalhes técnicos

- Adicionar 2 constantes em `src/lib/medium-fields.ts`: `TURNOS_MASC`, `TURNOS_FEM`, `TURNOS_TRABALHO` — exportadas para uso no edit e no detalhe.
- No detalhe (`app.mediuns.$id.index.tsx`), os campos `turno` e `turno_trabalho` continuam sendo renderizados via `info()` porque só armazenamos a string escolhida.
- Nenhuma mudança de schema no Supabase — todos os campos já existem como texto/boolean.
- Nenhum arquivo novo além de `src/lib/branding.ts` (hook compartilhado).

## Arquivos tocados

- `src/lib/medium-fields.ts`
- `src/lib/branding.ts` (novo)
- `src/routes/app.mediuns.$id.edit.tsx`
- `src/routes/app.mediuns.$id.index.tsx`
- `src/routes/login.tsx`
- `src/components/AppShell.tsx`
