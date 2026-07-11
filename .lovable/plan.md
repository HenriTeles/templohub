## Plano

### 1. Migração de banco (novas colunas em `public.mediuns`)
- `estrela` text (feminino)
- `janda` boolean default false (feminino)
- `data_recebimento_guia_missionaria` date (feminino)

`guia_missionaria` já existe. `data_recebimento_cavaleiro` permanece (usado para masculino).

### 2. Ficha do médium — `src/routes/app.mediuns.$id.index.tsx`
- Aumentar foto para **350px** (card e imagem).
- Se `sexo === "feminino"`:
  - Em Mentores/Iniciação: label "Mentores" → **"Princesa"**.
  - Em Centúria (após "Adjunto em Trânsito"): mostrar **Estrela, Turno, Turno de Trabalho, Guia Missionária** — ocultar Ministro/Cavaleiro.
  - Ocultar a seção **"Classificação do Médium"**.
  - Em Dados Complementares: trocar "Data do recebimento do Cavaleiro" por **"Data de recebimento da Guia Missionária"** e adicionar campo **Janda** (Sim/Não).
- Se masculino: mantém layout atual (Ministro/Cavaleiro, Cavaleiro na complementar, sem Janda, com seção Classificação).

### 3. Formulário — `src/routes/app.mediuns.$id.edit.tsx`
- Foto preview ampliado (não crítico, mas ajustar upload UI se necessário).
- Centúria: `adjunto_devas` vira **Select** com opções "Alufã" / "Adejã" (ambos os gêneros).
- Se feminino:
  - Label "Mentores" → **"Princesa"** (mesmo campo `mentores`).
  - Após "Adjunto em Trânsito": inputs `estrela`, `turno`, `turno_trabalho`, `guia_missionaria` — ocultar `ministro` e `cavaleiro`.
  - Ocultar seção **Classificação do Médium**.
  - Em Dados Complementares: substituir `data_recebimento_cavaleiro` por `data_recebimento_guia_missionaria` e adicionar checkbox **Janda**.
- Masculino mantém como está.

### Detalhes técnicos
- Migração SQL rodada via migration tool (com GRANTs se necessário — colunas herdam grants da tabela).
- Sem alteração em RLS.
- Datas continuam com `fmtDate` DD/MM/AAAA.
