# code_palandir

<!-- sociedade-do-codigo:inicio nucleo=3.1.0 perfil=sociedade/perfil.md pasta=sociedade jules=nao sha=4d750321ac18 -->
## Sociedade do Código (núcleo 3.1.0)

O método geral **não está neste repositório**: vem da skill `sociedade-do-codigo`, instalada na sua ferramenta. Aqui ficam só o perfil (`sociedade/perfil.md`), o registro e as ordens.

- **A Sociedade fica calada até ser chamada.** Pergunta, análise, dúvida e correção pedida direto: responda normalmente, sem carregar skill e sem escrever arquivo.
- **Quando o usuário acionar a Sociedade do Código, ou você receber uma ordem da Sociedade** (arquivo em `sociedade/ordens/` ou texto que começa com "Para: <papel>"), carregue a skill `sociedade-do-codigo` e siga a ordem. Sem a skill, avise o usuário e siga só este bloco.
- **Seu papel neste projeto** está na tabela "Papel × ferramenta" de `sociedade/perfil.md`. Se a mensagem pedir outro papel, pare e pergunte ao usuário.
- Estado de uma tela: `sociedade/estado.md`. Leia a ordem e só os caminhos que ela listar; não varra o repositório.
- Peça confirmação humana antes de: integrar, publicar, enviar, gastar, mudar credencial, MCP ou modelo, contatar terceiro ou tocar dado real. Quem revisa nunca integra nem publica.
- A memória da sua ferramenta guarda só preferências pessoais do usuário. Decisões e estado do projeto ficam em `sociedade/`.
- Nunca estime nem relate consumo de tokens, cota ou custo.
<!-- sociedade-do-codigo:fim -->

## Projeto

- Stack: TypeScript 5, React 18, Vite 5, Vitest, TailwindCSS, XYFlow (React Flow), Zustand; servidor Node em `server/`.
- Estrutura: `src/engine` (parsers e análise), `src/stores` (estado), `src/features` e `src/ui` (interface), `src/services` (ingestão e exportação), `src/__tests__` (Vitest).
- Comandos: `npm test` · `npx tsc --noEmit` · `npm run build` · `npm run dev`.
