## 1. Logotipo do TemploHub (somente super admin)

- Nova tabela singleton `app_settings` (`id=1`, `logo_path text`, `updated_at`, `updated_by`).
  - GRANT `SELECT` a `anon` e `authenticated` (marca é pública).
  - `UPDATE` restrito a super_admin via RLS (`is_super_admin(auth.uid())`).
- Novo bucket público `app-branding` (leitura pública, escrita apenas super_admin via policy em `storage.objects`).
- Nova seção no `/app/admin` "Identidade Visual": upload da imagem, preview e botão "Remover".
- `AppShell` e `login.tsx` passam a ler `app_settings.logo_path`. Quando houver logo salvo, ele substitui a imagem local `templohub-logo.png` já usada hoje na tela de login (fallback continua sendo essa imagem).

## 2. Foto de perfil do templo (admin do próprio templo)

- Nova coluna `templos.logo_path text`.
- Novo bucket público `templos-logos`; policies em `storage.objects` usando `can_write_templo(auth.uid(), (storage.foldername(name))[1]::uuid)` para insert/update/delete; SELECT público.
- Em `/app/configuracoes`, nova seção "Foto do templo" (visível para admin/secretário): upload, preview, remover. Persiste `logo_path` em `templos` (RLS existente já cobre).
- Super admin edita a mesma foto pelo modal de edição de templo em `/app/admin`.
- `AppShell` exibe miniatura da foto do templo no header quando o usuário estiver dentro de um templo.

## 3. Campos personalizados da ficha do médium

- Nova tabela `medium_custom_fields`:
  - `id uuid pk`, `templo_id uuid null` (NULL = campo global do super admin; UUID = campo local do templo),
  - `parent_field_id uuid null` (auto-FK para permitir 1 nível de subcampos),
  - `label text`, `key text` (slug), `tipo text` (`text|number|date|select|textarea|boolean`), `opcoes jsonb` (para select), `ordem int`, `obrigatorio bool`, timestamps.
  - Unicidade: `(coalesce(templo_id,'00...'), coalesce(parent_field_id,'00...'), key)`.
- Nova tabela `medium_custom_values`:
  - `mediun_id`, `field_id`, `valor text`, unique(`mediun_id`,`field_id`).
- RLS:
  - `medium_custom_fields` SELECT: usuário lê globais (templo_id null) + do seu próprio templo; super_admin lê tudo.
  - INSERT/UPDATE/DELETE: super_admin pode tudo (inclusive globais); admin/secretário somente com `templo_id = user_templo(auth.uid())` (nunca globais nem de outro templo).
  - `medium_custom_values` seguem o `templo_id` do médium (via `can_write_templo`).
- Nova rota `/app/admin/campos` (super admin): CRUD de campos globais + botão "Adicionar subcampo" em cada linha.
- Nova rota `/app/configuracoes/campos` (admin do templo): CRUD apenas de campos do próprio templo (o formulário sempre injeta `templo_id = user_templo`). Campos globais aparecem como somente-leitura.
- `app.mediuns.$id.edit.tsx` e detalhe passam a listar dinamicamente os campos (globais + do templo) e ler/gravar em `medium_custom_values` no submit.

## 4. Reorganização da ficha do médium

- Migration em `mediuns`:
  - Adiciona: `tipo_sanguineo text`, `medicamentos text`, `posologia text`, `medicamento_controlado boolean`, `medico_prescritor text`, `medico_crm text`, `possui_doenca boolean`, `doenca_descricao text`.
  - Colunas `cpf`, `rg`, `profissao`, `nacionalidade`, `estado_civil` são mantidas fisicamente (para não perder dados históricos) mas removidas da UI.
- Formulário (`app.mediuns.$id.edit.tsx`) passa a ter apenas duas seções principais:
  1. **Informações Pessoais**: nome_completo, nome_emissao, nome_pai, nome_mae, sexo, data_nascimento, telefone, whatsapp, email, endereço/cidade/estado/cep, tipo sanguíneo, medicamentos, posologia, medicamento controlado (checkbox), médico prescritor, CRM, possui doença (checkbox) + descrição.
  2. **Informações Doutrinárias**: nº ficha, data ingresso, situação, datas de desenvolvimento (início, emplacamento, elevação de espadas, centúria, consagração), função, mediunidade, falange, guia missionária/ministro/cavaleiro conforme função, preto-velho, caboclo, médico de cura, centúria — além dos campos personalizados renderizados aqui.
- A página de detalhe (`app.mediuns.$id.index.tsx`) espelha essas duas seções e remove os campos que saíram da UI.

## 5. Ajustes de UI

- Foto do médium na página de detalhe: reduzir para metade — grid muda de `240px` para `120px`, mantendo `aspect-square`.
- `login.tsx`: já foi feito na etapa anterior; nada a alterar aqui.

## Detalhes técnicos

- Todas as migrations seguem: `CREATE TABLE` → `GRANT` → `ENABLE RLS` → `CREATE POLICY`.
- Buckets criados via `supabase--storage_create_bucket`; policies em `storage.objects` via migration.
- Uploads no frontend usam `db.storage.from(...).upload(...)` + `getPublicUrl` (buckets públicos de branding/templo) ou `createSignedUrl` (privados).
- Tipos regenerados em `src/integrations/supabase/types.ts` após as migrations.
- A rota `/app/admin/*` continua usando checagem de `super_admin` no componente (não há gate próprio de rota).
