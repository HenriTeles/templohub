## Objetivo

Adicionar à ficha de cada médium um campo **Emissão** que permita enviar (upload) e baixar (download) um arquivo PDF, JPG ou JPEG.

## Como vai funcionar

- Na tela de **edição/cadastro** do médium: um seletor de arquivo "Emissão" aceitando `.pdf, .jpg, .jpeg` (limite de 8 MB), mostrando o nome do arquivo já enviado e opção de substituir ou remover.
- Na tela de **visualização** da ficha: uma linha "Emissão" com botão de download/abrir. Sem arquivo, mostra "—".
- O arquivo fica no bucket privado `mediuns-docs`, organizado por templo (`{templo_id}/emissoes/...`), e o link de download é uma URL assinada gerada no servidor.

## Detalhes técnicos

1. **Banco (migração)**: adicionar em `public.mediuns` as colunas `emissao_path text` e `emissao_nome text` (nulláveis).
2. **Escrita** (`src/lib/mediums.functions.ts` → `saveMediumRecord`): aceitar um campo opcional `emissao` (nome, contentType, base64) e `removerEmissao`. Validar tipo (`application/pdf`, `image/jpeg`) e tamanho (8 MB), fazer upload via `supabaseAdmin` no bucket `mediuns-docs` e gravar `emissao_path`/`emissao_nome`.
3. **Leitura** (`src/lib/mediuns-read.server.ts` → `readMediumDetail`): gerar `emissaoUrl` assinada (1h) a partir de `emissao_path` e retornar junto com `emissaoNome`.
4. **UI**:
   - `src/routes/app.mediuns.$id.edit.tsx`: input de arquivo, preview do nome atual, botão remover, conversão para base64 no envio (mesmo padrão já usado para a foto).
   - `src/routes/app.mediuns.$id.index.tsx`: seção/linha "Emissão" com link de download quando houver arquivo.

Todas as operações continuam passando pelas server functions autenticadas (validando o vínculo do usuário com o templo), evitando os bloqueios de RLS do banco externo.
