## Mudanças

### 1. Botão flutuante "Salvar" na ficha do médium
Em `src/routes/app.mediuns.$id.edit.tsx`, adicionar um botão flutuante fixo (posição `fixed bottom-6 right-6`, com sombra e cor primária) que dispara o mesmo `save()` do formulário e acompanha a rolagem. Manter também os botões atuais no fim da página. Assim, mesmo que o navegador seja minimizado e a sessão renove, o usuário salva rapidamente antes de perder o foco.

*Obs.: a persistência automática do formulário já existe via `loadedIdRef` (não reseta ao renovar sessão). O botão flutuante ataca o pedido de "não perder o que já foi digitado".*

### 2. Logo da tela de login refletindo a "Identidade visual do TemploHub"
O `login.tsx` já usa `useBrandingLogo()`, mas o hook só recarrega quando o evento `templohub:branding-logo-updated` é disparado, e o listener é montado dentro do `AppShell`. Vou:
- Confirmar que `app.admin.tsx` dispara o evento após upload.
- Garantir que o hook em `login.tsx` também recarregue após navegação (o hook já faz `load()` no mount, então basta o listener global existente — validar que a foto trocada aparece imediatamente na próxima visita à tela de login).

### 3. Remover chevrons (`>`) e reduzir fonte do e-mail no menu lateral
Em `src/components/AppShell.tsx`:
- Remover `<ChevronRight />` do card do templo (linha ~109).
- Remover `<ChevronRight />` do card do e-mail no rodapé (linha ~191).
- Alterar a classe do e-mail de `text-sm truncate` para `text-xs break-all leading-tight` (ou `text-[11px]`) para caber sem truncar.

### 4. Badges coloridos + ícone de mediunidade na lista de médiuns
Em `src/routes/app.mediuns.index.tsx`:
- Trocar o badge de **situação** para usar `situacaoBadgeClass()` de `@/lib/status.ts` (mesmas cores da ficha).
- Colorir o badge de **polaridade**: vermelho suave para `apara` (`bg-red-100 text-red-800`), preto/cinza para `doutrinador` (`bg-neutral-200 text-neutral-800`).
- Ao lado (ou como parte) do badge de polaridade, exibir a miniatura correspondente (~14px):
  - Apará → `src/assets/triangulo-apara.png.asset.json`
  - Doutrinador(a) → `src/assets/crucifixo.jpg.asset.json`
- Ajustar labels: mostrar "APARÁ" / "DOUTRINADOR(A)" em vez do valor cru, e usar `SITUACAO_LABEL[r.situacao]` para o label da situação.

## Arquivos alterados
- `src/routes/app.mediuns.$id.edit.tsx` — botão flutuante Salvar.
- `src/components/AppShell.tsx` — remover 2 chevrons; reduzir fonte do e-mail.
- `src/routes/app.mediuns.index.tsx` — badges com cor + ícones de mediunidade.
- (validação) `src/routes/login.tsx` / `src/lib/branding.ts` — confirmar sincronização da logo.
