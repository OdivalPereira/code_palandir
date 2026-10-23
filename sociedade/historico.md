# Histórico — Code Palandir

## 07/10/2026 14:16 · Círdan · adoção da Sociedade do Código
Adoção do núcleo 3.1.0 via sc_init. O núcleo 2.0.0 (rodadas R-01 e R-02) foi arquivado fora do repositório; as entregas de produto estão no commit 418e385.

## 23/10/2026 · Círdan · o Code Palandir vira o painel da Sociedade
Entrevista com Odival no pacote (Q202–Q208): o painel fica no centro, o analisador vira uma das telas, login só de Odival, e o Gemini 4 Argon entra nas etapas do painel. Bloco do AGENTS.md levado à 3.4.0; perfil com D06–D10, cardápio e área `banco`; `e1-limpeza` retirada (em `arquivo/`); arquitetura em `arquitetura-painel.md`, contrato em `central/` e rascunhos das ordens `p1-fundacao` e `p2-leitura`.

## 23/10/2026 · Círdan · complemento do Argon e fecho das ordens p1 e p2
O Argon (Gandalf no Antigravity) complementou a arquitetura em `docs/arquitetura.md`, com capturas RPG em `docs/painel/`, e colheu quatro decisões de Odival:
1. a linha `Worktree:` continua igual à do `sc.py abertura` 3.4.0 na p2 e muda junto com o pacote depois;
2. o tema RPG entra já na p2, e a tela Sociedade (Cartas) vai para a p3;
3. as dependências aprovadas são `react-router-dom` v6, `ajv`, `ajv-formats`, `@testing-library/react` e `@playwright/test`, sem `json-schema-to-typescript`;
4. a sequência da fase B fica: p3 Cartas, Tarefa nova com compositor visual, Perguntas e Conversa; p4 login real, ponte local, Gwaihir e PWA; p5 nuvem e outras máquinas; p6 cadeia autônoma e modelo local.

O Círdan fechou as ordens com os ajustes do Argon, com uma exceção: o `ajv` não é instalado no `painel/base`, porque a Q192 deixa o arquiteto só com `sociedade/`. Na p1, o Ajv real entra por teste de integração contra a função local. Também acrescentou o aceite do `selfImport.test.ts` estável à F1 da p2.
