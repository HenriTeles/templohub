Substituir o símbolo ✦ no cabeçalho da página de login pelo logo TemploHub enviado.

## Passos

1. Fazer upload do arquivo `user-uploads://file_000000003e78720ea08f39b96902bb6d.png` para o CDN via `lovable-assets create`, gerando `src/assets/templohub-logo.png.asset.json`.
2. Em `src/routes/login.tsx` (linhas 57–60):
   - Remover o `<div>` com o caractere `✦` e o `CardTitle` "TemploHub".
   - Renderizar `<img src={logoAsset.url} alt="TemploHub" className="mx-auto h-24 w-auto" />` importando `logoAsset from "@/assets/templohub-logo.png.asset.json"`.
   - O título textual "TemploHub" fica embutido no próprio logo, então o `CardTitle` é dispensável (ou mantido como `sr-only` para acessibilidade).
3. Nenhuma outra tela é afetada (o `AppShell` continua com o texto "TemploHub").
