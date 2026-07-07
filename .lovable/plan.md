# Plano: Refazer ficha do médium + edit/remove de campos personalizados

## Parte 1 — Editar/remover campos personalizados

Em `src/components/CustomFieldsManager.tsx`:

- Adicionar botão **Editar** (ícone lápis) em cada linha de `FieldRow`, ao lado do "remover".
- Criar `EditFieldDialog` (baseado no `AddFieldDialog`) permitindo alterar **tudo**: rótulo (label), chave (regerada a partir do label ou editável manualmente com aviso), tipo, opções (para select), obrigatoriedade.
- Aviso claro ao trocar o **tipo** ("valores já preenchidos podem ficar inválidos") exigindo confirmação.
- Aviso ao trocar a **chave** ("pode quebrar integrações que dependem dela").
- Ao salvar, `UPDATE medium_custom_fields SET ... WHERE id = ...`.
- Botão remover já existe; manter.

Nenhuma migração necessária — a tabela `medium_custom_fields` já suporta esses updates via RLS existente.

## Parte 2 — Refazer a ficha fixa do médium

Reestruturar `src/routes/app.mediuns.new.tsx`, `app.mediuns.$id.edit.tsx` e `app.mediuns.$id.index.tsx` em **6 seções** conforme especificado, com **regras condicionais por gênero**.

### Migração de schema (`mediuns`)

Colunas novas (todas nullable, defaults seguros):

```
data_ultima_classificacao   date
data_iniciacao              date
classe_elevacao             text   -- mestre_lua|mestre_sol|ninfa_lua|ninfa_sol
falange_mestrado            text
nome_emissao_centuria       text   -- (renomear/uso de nome_emissao existente)
adjunto                     text
falange_missionaria         text   -- enum textual (lista fixa por gênero)
adjunto_devas               text
lanca                       text
adjunto_transito            text
turno                       text
turno_trabalho              text
classificacao_medium        text
data_setimo                 date
data_recebimento_cavaleiro  date
trino_id                    uuid references trinos(id)  -- já existe? verificar
adjunto_povo                text
filho_de_devas              text
recepcionista               boolean default false
```

Verificar antes o que já existe em `mediuns` (56 colunas) — usar as existentes quando o nome bater (`data_emplacamento`, `data_elevacao_espadas`, `data_centuria`, `data_consagracao`, `ministro`, `cavaleiro`, `polaridade`, `funcao`, `guia_missionaria`, etc.) e só criar as que faltam. Renomear evitando quebrar dados existentes.

### Seções na UI (ordem)

1. **Dados Gerais** — nome_completo, sexo (M/F), data_nascimento, nome_mae, nome_pai, data_ingresso, templo (readonly do templo atual), data_ultima_classificacao.
2. **Mentores / Iniciação** — mentores (multi via `mediun_mentores` existente), data_emplacamento, data_iniciacao, polaridade (Apará | Doutrinador(a)).
3. **Elevação de Espadas** — data_elevacao_espadas, classe_elevacao (dropdown filtrado por sexo: masc → mestre lua/sol; fem → ninfa lua/sol), falange_mestrado.
4. **Centúria** — data_centuria, nome_emissao, povo, adjunto, **falange_missionaria** (dropdown; masc → Mago | Príncipe Maya; fem → lista fixa das 21 falanges), adjunto_devas, lanca, adjunto_transito, turno, turno_trabalho, ministro, cavaleiro.
5. **Classificação do Médium** — classificacao_medium (texto).
6. **Dados complementares** — data_ultima_classificacao, data_setimo, data_recebimento_cavaleiro, trino, adjunto_povo, filho_de_devas, recepcionista (checkbox).

### Regras condicionais

Componente helper `<GenderConditional sexo={...}>` ou lógica no form:

- `classe_elevacao` recalcula opções quando `sexo` muda; se o valor atual não pertence às opções novas → limpa.
- `falange_missionaria` idem, com as duas listas fixas em constante:

```ts
const FALANGES_FEM = ["Nityama/Madruxa", "Samaritana", "Grega", "Maya", "Yuricy", "Yuricy Lua", "Dharman-Oxinto", "Muruaicy", "Jaçanã", "Ariana da Estrela", "Testemunha", "Madalena de Cássia", "Franciscana", "Narayama", "Rochana", "Cayçara", "Tupinambás", "Cigana Aganara", "Cigana Tagana", "Agulha Ismênia", "Nyatra"];
const FALANGES_MASC = ["Mago", "Príncipe Maya"];
```

### Página de detalhe

`app.mediuns.$id.index.tsx` re-renderizado nas mesmas 6 seções (cards) na mesma ordem, ocultando campos vazios opcionalmente.

## Arquivos a tocar

- `src/components/CustomFieldsManager.tsx` — botão editar + dialog.
- Migração SQL — colunas novas em `mediuns`.
- `src/routes/app.mediuns.new.tsx` — formulário reorganizado em 6 seções.
- `src/routes/app.mediuns.$id.edit.tsx` — mesma estrutura, prefill.
- `src/routes/app.mediuns.$id.index.tsx` — detalhe nas 6 seções.
- (possível) `src/lib/medium-fields.ts` — constantes de listas fixas e helpers de gênero.

## Fora do escopo

- Não altero a lista de tabelas doutrinárias (falanges/centúrias/etc.) já em Configurações.
- Não mudo permissões nem RLS.
- Anexos, histórico e campos personalizados continuam nas seções extras existentes na página de detalhe.
