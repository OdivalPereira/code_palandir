# code_palandir

<!-- sociedade-do-codigo:inicio nucleo=3.4.0 perfil=sociedade/perfil.md pasta=sociedade jules=nao sha=fe33ffcc756b -->
## Sociedade do Código (núcleo 3.4.0)

O método vem da skill `sociedade-do-codigo`. Aqui ficam perfil (`sociedade/perfil.md`), registro e ordens.

- **A Sociedade fica calada até ser chamada.** Dúvidas responda sem carregar skill nem gravar arquivo.
- **Quando o usuário acionar a Sociedade do Código, ou você receber uma ordem** (em `sociedade/ordens/` ou iniciada por "Para: <papel>"), carregue a skill `sociedade-do-codigo`. Sem ela, avise e siga este bloco.
- **Papel:** tabela "Papel × ferramenta" de `sociedade/perfil.md`. Se pedirem outro, pergunte.
- **Estado e leitura:** resumo em `sociedade/estado.md`. Leia só caminhos da ordem; não varra o repositório.
- **Autorização humana:** exija para integrar, publicar, gastar, mudar credencial/MCP/modelo, contatar terceiro ou usar dados reais, salvo autorização prévia. Segredos fora de arquivos, dados reais fora do Git, Jules sem dados reais; revisor nunca publica.
- **Memória:** guarda preferências pessoais; decisões e estado ficam em `sociedade/`.
- Nunca estime nem relate consumo de tokens, cota ou custo.
<!-- sociedade-do-codigo:fim -->

## Projeto

- Produto: o painel da Sociedade do Código, com a análise visual de código como uma das telas. Arquitetura em `sociedade/arquitetura-painel.md`.
- Stack: TypeScript 5, React 18, Vite 5, Vitest, TailwindCSS, XYFlow (React Flow), Zustand; Supabase local (Postgres, Auth, Edge Functions) nas etapas do painel; servidor Node em `server/`.
- Estrutura: `src/engine` (parsers e análise), `src/stores` (estado), `src/features` e `src/ui` (interface), `src/services` (ingestão e exportação), `src/__tests__` (Vitest).
- Comandos: `npm test` · `npx tsc --noEmit` · `npm run build` · `npm run dev`.
