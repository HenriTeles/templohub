## Escopo

Ajustes solicitados na dashboard do templo e na ficha do médium.

### 1. Dashboard — contadores por gênero (`src/routes/app.dashboard.tsx`)
- Substituir a contagem baseada em `funcao === "mestre"` / `funcao === "ninfa"` por contagem baseada em `sexo`:
  - **Mestres** = médiuns com `sexo === "masculino"`
  - **Ninfas** = médiuns com `sexo === "feminino"`
- Incluir `sexo` no `select` da query.
- "Quantidade por Falange" já usa `falange_id` correto — verificar que Henrique aparece porque a query já faz `.or(templo_id.eq.X, templo_id.is.null)` em `falanges`. Nenhuma mudança adicional necessária além de garantir que a falange "Magos" esteja cadastrada como falange do templo ou global (isso já é o caso).

### 2. Ficha do médium — foto e ícones (`src/routes/app.mediuns.$id.index.tsx`)
- Reduzir a foto para metade do tamanho atual: alterar o grid de `md:grid-cols-[60px_1fr]` para `md:grid-cols-[30px_1fr]` (mantendo `aspect-square`). Ajustar tamanhos de fonte dos badges proporcionalmente se necessário.
- Adicionar ícone de mediunidade abaixo da foto e dos badges:
  - Se `polaridade === "doutrinador"` → miniatura do crucifixo (`user-uploads://images_d2cefe16-d6ef-45.jpg`)
  - Se `polaridade === "apara"` → miniatura do triângulo vermelho (`user-uploads://vale-do-amanhecer-apara-logo-png_seeklogo-275617.png`)
- As duas imagens serão importadas como Lovable Assets (`lovable-assets create ...`) e importadas via JSON pointer em `src/assets/`.
- Renderizar como `<img>` centralizada, ~24×24px, com `alt` descritivo.

### 3. Formatação de datas em toda a ficha (`src/routes/app.mediuns.$id.index.tsx`)
- Criar helper local `fmtDate(iso)` que converte `YYYY-MM-DD` (ou ISO completo) em `DD/MM/AAAA`, retornando `"—"` para nulos/inválidos.
- Aplicar em todos os campos de data exibidos na ficha:
  - `data_nascimento`, `data_ingresso`, `data_ultima_classificacao`
  - `data_emplacamento`, `data_iniciacao`
  - `data_elevacao_espadas`
  - `data_centuria`
  - `data_setimo`, `data_recebimento_cavaleiro`
- Formatar `historico[].created_at` com `toLocaleString("pt-BR")` (já usa, manter).

### 4. Datas em outros pontos visíveis
- `src/routes/app.mediuns.index.tsx`: se listar `data_nascimento`/`data_ingresso`, aplicar mesma formatação.
- `src/routes/app.buscar.tsx`: idem para colunas de data exibidas nos resultados.
- Dashboard já formata via `toLocaleDateString("pt-BR")` — sem mudança.

## Detalhes técnicos

- Helper `fmtDate`:
  ```ts
  const fmtDate = (v: unknown): string => {
    if (!v || typeof v !== "string") return "—";
    const [y, m, d] = v.slice(0, 10).split("-");
    return y && m && d ? `${d}/${m}/${y}` : "—";
  };
  ```
  Preferível a `new Date(...).toLocaleDateString("pt-BR")` para colunas `date` (evita shift de timezone que joga o dia para o anterior).

- Ícones: usar `lovable-assets create` a partir de `/mnt/user-uploads/` e importar os pointers `.asset.json` para não versionar os binários.

## Fora de escopo
- Nenhuma mudança de schema, RLS ou lógica de backend.
- Nenhuma alteração no formulário de edição além do necessário.
