# TemploHub — Plano do MVP

Sistema SaaS multi-tenant para gestão administrativa de templos do Vale do Amanhecer. Este primeiro build entrega uma base sólida (auth, isolamento por templo, cadastro completo de médiuns com foto, tabelas administrativas configuráveis, dashboard e busca). Histórico automático, observações com anexos, relatórios avançados, PDF/carteirinha e portal do médium ficam para iterações seguintes.

## Identidade visual

- Paleta: branco `#FFFFFF`, azul profundo `#0B1F4D`, dourado `#C9A24B`, violeta suave `#B7A7D9`, cinza claro `#F2F3F7`.
- Tipografia: Playfair Display (títulos, tom espiritual/editorial) + Inter (UI/corpo).
- Estética sóbria: cartões arredondados, muito espaço em branco, detalhes dourados discretos, sem ícones místicos exagerados.
- Layout com sidebar fixa (colapsável) + header com busca rápida.

## Escopo desta entrega (MVP enxuto)

**Incluído**
- Autenticação e-mail/senha (Lovable Cloud) + recuperação de senha em `/reset-password`.
- Onboarding: qualquer visitante cria conta e solicita registro de um templo → fica `pendente` até aprovação do super admin.
- Papéis: `super_admin` (global), `admin` (do templo), `secretario` (cadastra/edita), `consulta` (somente leitura).
- Multi-tenant com isolamento absoluto via RLS (usuário só enxerga o próprio templo; super admin enxerga todos).
- Cadastro completo de médiuns com todos os campos pedidos (dados pessoais, doutrinários, desenvolvimento, particularidades, mentores).
- Upload de foto do médium com crop + compressão + miniatura no Storage.
- Tabelas administrativas configuráveis: falanges, centúrias, mentores, situações, adjurações, trinos, povos, legiões, reinos.
- Dashboard: totais (médiuns, mestres, ninfas, aparás, doutrinadores), quantidade por falange e centúria, últimos cadastros, próximos aniversariantes, busca rápida.
- Perfil do médium em cartões (Dados Pessoais, Doutrinários, Desenvolvimento, Particularidades, Mentores). Blocos de Histórico/Observações/Documentos ficam como placeholders "em breve".
- Pesquisa com filtros: nome, CPF, falange, situação, mestre/ninfa, apará/doutrinador, centúria, cidade.
- Tela de administração do super admin: aprovar/rejeitar templos pendentes, listar templos.
- Tela de administração do admin do templo: gerenciar usuários do próprio templo e editar tabelas configuráveis.
- Responsivo (desktop, tablet, mobile).

**Fora do MVP (próximas iterações)**
- Timeline de histórico automático com auditoria de alterações.
- Observações ricas com anexos (PDF/imagens) no Storage.
- Geração de PDF (ficha, carteirinha) e relatórios avançados.
- Notificações WhatsApp, portal do médium, QR Code, assinatura eletrônica, financeiro, agenda, etc.

## Detalhes técnicos

**Stack:** TanStack Start + React + TypeScript + Tailwind v4 + shadcn/ui + TanStack Query + Lovable Cloud (Supabase gerenciado).

**Modelo de dados (schema `public`):**
- `templos` — id, nome, cidade, estado, status (`pendente`|`ativo`|`suspenso`), created_by, timestamps.
- `profiles` — id (=auth.users.id), templo_id (nullable até aprovação), nome, email, created_at.
- `app_role` enum: `super_admin`, `admin`, `secretario`, `consulta`.
- `user_roles` — (user_id, role, templo_id nullable). Roles NUNCA ficam em `profiles`.
- `mediuns` — todos os campos pessoais + doutrinários + desenvolvimento + particularidades + FKs para falange/centúria/mentores. templo_id obrigatório. Índices em (templo_id, nome), (templo_id, cpf), (templo_id, situacao).
- Tabelas configuráveis (todas com `templo_id` para permitir customização por templo, mais seed global copiado no onboarding): `falanges`, `centurias`, `mentores` (com tipo: cavaleiro, ministro, preto_velho, caboclo, medico_cura, guia_missionaria, princesa, preta_velha, cabocla, medica_cura), `situacoes`, `adjuracoes`, `trinos`, `povos`, `legioes`, `reinos`.
- `mediun_mentores` — join table (mediun_id, mentor_id, papel) para mapear os mentores por médium conforme sexo/função.
- Placeholders para expansão futura: `historico`, `anexos`, `configuracoes` (criadas vazias com RLS pronta).

**Segurança:**
- Função `SECURITY DEFINER` `public.has_role(_user_id, _role)` e `public.user_templo(_user_id)` para evitar recursão nas policies.
- RLS em todas as tabelas. Padrão: `SELECT/INSERT/UPDATE/DELETE` permitido apenas quando `templo_id = user_templo(auth.uid())` OU `has_role(auth.uid(), 'super_admin')`. Escrita adicionalmente exige papel `admin`/`secretario` (consulta = só SELECT).
- `GRANT`s explícitos em todas as tabelas do `public` para `authenticated` e `service_role` (sem `anon`).
- Trigger em `auth.users` cria `profiles` automaticamente.
- Super admin promovido manualmente via migration (primeiro usuário definido pelo dono do projeto) — combinamos qual e-mail após aprovar o plano.
- Storage: bucket privado `mediuns-fotos` com policies que só permitem ao usuário ler/gravar arquivos sob o prefixo do seu `templo_id`.

**Rotas (TanStack Router, file-based):**
- Públicas: `/`, `/auth` (login/cadastro), `/reset-password`, `/onboarding` (registrar novo templo após signup).
- Protegidas (`/_authenticated/...`): `/dashboard`, `/mediuns`, `/mediuns/novo`, `/mediuns/$id`, `/mediuns/$id/editar`, `/admin` (usuários e tabelas configuráveis), `/admin/templos` (só super admin: aprovações), `/perfil`.

**Componentização:** formulários divididos em seções (`DadosPessoaisForm`, `DadosDoutrinariosForm`, `DesenvolvimentoForm`, `ParticularidadesForm`, `MentoresForm`) reutilizando um `MediumForm` para novo/editar. Hook `useMediuns`, `useTemplo`, `useRole`.

## Etapas de implementação

1. Habilitar Lovable Cloud, configurar tema Tailwind (paleta + fontes) e shell autenticado (sidebar + header).
2. Migration inicial: enums, tabelas, funções `has_role`/`user_templo`, RLS, GRANTs, trigger de profile, seed de falanges/situações/mentores padrão do Vale do Amanhecer.
3. Fluxo de auth: `/auth`, `/reset-password`, `/onboarding` (cria templo pendente), gate `_authenticated`, tela "aguardando aprovação".
4. Área super admin: aprovar/rejeitar templos.
5. CRUD de médiuns + upload de foto (crop/compressão) no Storage.
6. Perfil do médium em cartões.
7. Dashboard com totais e aniversariantes.
8. Busca com filtros.
9. Admin do templo: gerenciar usuários e tabelas configuráveis.
10. Ajustes de responsividade e polimento visual.

## Pergunta pendente para começar

Preciso do e-mail que deve virar `super_admin` inicial (posso deixar um placeholder e você me diz depois — mas se já souber, aplico direto na migration).
