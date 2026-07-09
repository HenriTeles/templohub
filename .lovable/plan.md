
## 1. Tela de login
- **Remover** o link/botão "Voltar" (`<Link to="/">Voltar</Link>`) em `src/routes/login.tsx`.
- **Logo dinâmica**: em vez do import estático `templohub-logo.png.asset.json`, ler `app_settings.logo_path` (bucket `app-branding`) via `db.storage.createSignedUrl` no `useEffect` da página de login. Fallback para o asset atual quando não houver logo cadastrada. Assim, quando o administrador geral trocar a logo no painel, a tela de login reflete a alteração.

## 2. Customização de paleta (Configurações do templo)
Nova seção "Customização" em `src/routes/app.configuracoes.tsx` (visível apenas para admin do templo).

**Persistência**
- Adicionar coluna `theme jsonb` em `public.templos` (migration) para guardar `{ primary, secondary, accent, background, foreground }` em OKLCH/HEX.

**UI (novo componente `src/components/TempleThemeCustomizer.tsx`)**
- **Roda de cores estilo Adobe Color**: canvas SVG com uma cor base arrastável e geração automática das harmonias (análoga, complementar, tríade, quadrada, monocromática) — 5 swatches editáveis.
- **Upload de imagem**: input `<file>` → carrega imagem em `<canvas>` → extrai paleta dominante com algoritmo median-cut simples em JS puro (sem dependência nova pesada; se necessário adicionar `colorthief` via `bun add`) → preenche os 5 swatches.
- Botão "Aplicar" grava em `templos.theme` e injeta as variáveis CSS (`--primary`, `--accent`, etc.) no `document.documentElement` via um provider `TempleThemeProvider` montado dentro de `AppShell`, para que a UI daquele templo passe a usar as cores escolhidas em tempo real.
- Pré-visualização (botões, cards) usando as cores selecionadas antes de salvar.

## 3. Busca inteligente reflete a ficha do médium
Em `src/routes/app.buscar.tsx`, substituir os campos atuais pela lista canônica de campos da ficha (mesma origem que `src/lib/medium-fields.ts` + colunas de `public.mediuns`), agrupados pelas 6 seções da ficha (Dados Gerais, Mentores/Iniciação, Particularidades Mediúnicas, Classificação, Dados Complementares, Saúde). Cada campo vira filtro pesquisável (texto, select, data range, boolean conforme o tipo). Incluir também os `medium_custom_fields` do templo atual.

## 4. Ajustes na ficha do médium
Em `src/routes/app.mediuns.$id.index.tsx`:
- **Foto**: reduzir novamente à metade (de ~120px para ~60px de largura no grid).
- **Situação sob a foto**: badge com o texto capitalizado colorido conforme regra:
  - `ativo` → verde
  - `desligado` → vermelho
  - `desenvolvimento` → amarelo
  - `afastado` → laranja
  (usar classes Tailwind `text-emerald-600 / text-red-600 / text-yellow-500 / text-orange-500`).

Em `src/routes/app.mediuns.$id.edit.tsx`:
- Remover a opção **"licenciado"** do dropdown de situação. Manter as 4 opções acima. Migration adicional: se o enum `mediun_situacao` incluir `licenciado`, apenas removê-lo da UI (não dropar do enum para não quebrar dados legados; converter registros existentes com `licenciado` para `afastado` opcionalmente — confirmar antes).

## Detalhes técnicos
- Migration: `ALTER TABLE public.templos ADD COLUMN theme jsonb;` (nullable, sem default).
- `TempleThemeProvider`: lê `session.templo.theme` e aplica CSS vars ao root. Se `null`, mantém tokens padrão do `src/styles.css`.
- Extração de paleta: implementação leve em JS (quantização k-means com ~5 centróides sobre pixels amostrados a cada 10). Se preferir, adiciono `colorthief` (~5kb).
- Busca inteligente: definição centralizada em um novo `src/lib/medium-search-schema.ts` reutilizado por busca e (futuramente) exportações.

## Perguntas antes de codar
1. Registros existentes de médiuns com `situacao = 'licenciado'` devem ser migrados para `afastado` ou mantidos como estão (só somem do dropdown)?
2. Para a roda de cores, prefere que eu implemente a extração da paleta em código puro (sem dependência nova) ou posso adicionar `colorthief`?
