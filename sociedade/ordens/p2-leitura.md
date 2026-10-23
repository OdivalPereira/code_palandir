# Ordem p2-leitura — o painel no centro: casca RPG, Hoje com "montar mensagem" e Projetos

Para: Gandalf (Antigravity, Gemini 4 Argon, esforço high) · De: Círdan · CONVERSA NOVA
Etapa: p2-leitura · Base: `00970bc` · Worktree: `~/.sociedade/trabalho/code_palandir/p2-leitura` · Ramo: `etapa/p2-leitura`
Especialistas: Legolas (F1, F3, F4), Elrond (F2), Galadriel (F5) · Revisão interna: F3, pela Galadriel no nível alto · Jules: nenhuma
Portão: por fatia (padrão); área `app` do perfil
Revisão independente: Barbárvore (Codex, GPT-6.1-Sol, high), protocolo reduzido (Q150: telas de leitura sobre dado fictício)

## Objetivo
Ao abrir o Code Palandir, Odival cai em **"O Conselho"** (Hoje), no clima RPG da Terra-média:
- vê o que espera por ele em todos os projetos, o que está desconhecido e o que está defasado;
- monta e copia a mensagem de abertura de um agente, igual à do `sc.py abertura`;
- passa para **"Regiões"** (Projetos), com acampamentos (pastas), marcos da jornada (etapas) e companhia (ocupantes);
- o analisador de código continua inteiro em **"Palantír"** (`/analisador`).

Tudo isso com o exemplo fictício, na web (versão principal, 1280 px) e no celular (360 px).

**Como Odival percebe:**
- `npm run dev` abre o Conselho com o selo "Dados de exemplo";
- o "Diário de Campo" aparece em "Terras em Névoa · Desconhecido", com o selo "NUNCA EM DIA";
- a mensagem copiada para `loja-exemplo/e3-carrinho` é idêntica à saída-ouro da seção 5.3 da arquitetura;
- o analisador abre e funciona como antes;
- a navegação já mostra, como reservados para a p3, Sociedade (Cartas), Tarefa nova, Perguntas e Conversa.

## Leia só
1. `sociedade/arquitetura-painel.md`, seções 2, 5 e 6
2. `docs/arquitetura.md` (complemento do Argon), seções 1, 2, 5, 6, 7, 9 e 9-B, mais as capturas em `docs/painel/`
3. `sociedade/perfil.md`, seções "Papéis locais", "Regras de domínio" (D05–D10) e "Portão por área"
4. `sociedade/central/` (esquema e exemplo fictício)
5. Código:
   - `src/app/App.tsx`, `src/index.tsx`, `src/stores/uiStore.ts`, `src/__tests__/selfImport.test.ts`;
   - `src/features/prompt/usePromptGenerator.ts` (`redactSecrets`, `createSafeMarkdownFence`), `src/services/clipboard.ts`, `src/ui/*`.

## Dependências novas (aprovadas por Odival em 23/10, pergunta 3 do complemento)
- `react-router-dom` v6;
- `ajv` e `ajv-formats`;
- `@testing-library/react` (dev);
- `@playwright/test` (dev, usando os navegadores já em `~/.cache/ms-playwright`, sem baixar);
- **nada mais.** Os tipos do `painel/1` são escritos à mão (sem `json-schema-to-typescript`).

## Fatias
*Nível e modelo pelo cardápio do perfil: alta = Gemini 4 Argon high; moderada = Gemini 3.8 Flash medium; simples = Gemini 3.8 Flash low.*
1. **Casca RPG e rotas**
   - especialista: Legolas · nível: moderada · modelo: Gemini 3.8 Flash · esforço: medium
   - escreva só: `package.json`, `package-lock.json`, `src/index.tsx`, `src/app/**`, `src/__tests__/selfImport.test.ts`
   - aceite (E):
     - o conteúdo de `src/app/App.tsx` vai intacto para `src/app/AnalisadorPage.tsx`, e o `App.tsx` vira a casca com as rotas `/`, `/projetos`, `/projetos/:id` e `/analisador` (`BrowserRouter`);
     - `PainelShell.tsx` e `rpgTheme.tsx` em `src/app/`, com a paleta "Noite de Valfenda e Ouro Velho" e títulos em `'Cinzel', Georgia, 'Times New Roman', serif`, sem baixar fonte da rede;
     - `src/ui/*` não é tocado;
     - lateral fixa a partir de 1280 px e barra inferior em 360 px, com alvos de 44 px e sem rolagem horizontal (Q217);
     - itens Sociedade (Cartas), Tarefa nova, Perguntas e Conversa aparecem como reservados, com o selo "Fase B · p3", sem página nova;
     - casca em `h-screen w-screen overflow-hidden flex flex-col`, com `flex-1 min-h-0` no `<main>` do analisador, para o XYFlow não perder altura;
     - o analisador é idêntico ao de antes: os testes antigos seguem verdes, e o `selfImport.test.ts` é ajustado às rotas da casca e aponta o teste de expansão e prompt para `AnalisadorPage`, com justificativa no retorno;
     - o `selfImport.test.ts` confere as rotas pela lista exata, mas não depende do número de componentes que a F3 e a F4 vão criar em `src/painel/` (limite inferior, não contagem exata), para nenhuma fatia seguinte precisar editá-lo;
     - só as dependências aprovadas acima são instaladas.
2. **Contrato e fonte no front**
   - especialista: Elrond · nível: moderada · modelo: Gemini 3.8 Flash · esforço: medium
   - escreva só: `src/painel/contrato/**`, `src/painel/fonte/**`, `src/painel/fixtures/**`, `src/stores/painelStore.ts`, `src/__tests__/painelContrato.test.ts`
   - aceite (E):
     - `painel1.types.ts` escrito à mão;
     - `painelContrato.test.ts` confere três coisas:
       - (a) `src/painel/contrato/painel-1.schema.json` igual byte a byte (SHA-256) à cópia de `sociedade/central/`;
       - (b) `const ex: Painel1 = exemploOficial` compila;
       - (c) o Ajv 2020 valida os cenários válido, vazio, só desconhecidos, limites e inválido;
     - instantâneo inválido vira estado de erro com a lista de erros;
     - `null` chega à tela como `null`.
3. **O Conselho (Hoje) e o Pergaminho de Abertura**
   - especialista: Legolas · nível: alta · modelo: Gemini 4 Argon · esforço: high
   - escreva só: `src/painel/hoje/**`, `src/painel/mensagem/**`, `src/__tests__/painelHoje.test.tsx`, `src/__tests__/painelMensagem.test.ts`
   - aceite (E):
     - as seções I a IV da seção 6.2-B do complemento: "Espera pelo Conselho", "Terras em Névoa · Desconhecido" com o selo "NUNCA EM DIA", "Forjas e Núcleos" e "Pergaminho de Abertura";
     - as pendências na ordem da seção 5.3;
     - a linha `Worktree:` igual à do `sc.py abertura` 3.4.0, e o teste-ouro idêntico às cinco linhas da seção 5.3;
     - `redactSecrets` aplicado antes de copiar;
     - modelo e esforço só a partir do cardápio do instantâneo;
     - em 1280 px, seções I a III à esquerda (7/12) e o Pergaminho à direita (5/12).
4. **Regiões (Projetos)**
   - especialista: Legolas · nível: moderada · modelo: Gemini 3.8 Flash · esforço: medium
   - escreva só: `src/painel/projetos/**`, `src/__tests__/painelProjetos.test.tsx`
   - aceite (E):
     - a seção 6.2-C do complemento: lista de Regiões, Marcos da Jornada (as seis estações mais encerrada e desconhecida), Acampamentos (pastas), Companhia (ocupantes) e Mensagens de Gwaihir (passagens recolhidas por padrão);
     - aviso quando `modelo_no_log` diverge ou é `null`.
5. **Acessibilidade e capturas**
   - especialista: Galadriel · nível: moderada · modelo: Gemini 3.8 Flash · esforço: medium
   - escreva só: `e2e/**`, `playwright.config.ts`, `src/__tests__/painelA11y.test.tsx`
   - aceite (E):
     - D05 nas três telas: foco visível, rótulos ARIA, toque de 44 px ou mais, e os estados carregando, vazio, erro, parcial e sucesso;
     - contraste AA (4,5:1 ou mais) na paleta noite e ouro velho;
     - nenhum estado (em dia, defasado, desconhecido, erro) depende só de cor ou ornamento: sempre ícone mais rótulo;
     - capturas Playwright em 1280×800 e em 360×820 de Conselho, Regiões e Palantír, anexadas ao retorno.

**Ordem das fatias:** a F1 vem primeiro e a F2 em seguida. A F3 e a F4 rodam juntas, e a F5 fecha. Os arquivos não se cruzam.

## Paradas
- **Escopo, contrato ou instalação:** volta ao arquiteto e a Odival. Dependência fora da lista aprovada também para.
- **Esta etapa não toca** `supabase/`, `scripts/`, `server/`, `src/ui/`, `vercel.json` nem `index.html` (a CSP muda na p4, junto com o login real).
- **Fica para a p3 e a p4:** a tela Sociedade (Cartas), Tarefa nova, Perguntas, Conversa, `FonteSupabase` e o login real. Nesta etapa, o guarda de rota deixa passar com o selo "Dados de exemplo".
- O teto é de cerca de 1.500 linhas de produto, fora o lockfile e as fixtures.
- Sem push, PR ou merge: Odival faz.

## Entregas verificáveis
`Preencher no manifesto p2-leitura-entregas.md, não na ordem.`

```entregas
E1 | commit_existe | etapa/p2-leitura
E2 | arquivos_em | 00970bc..etapa/p2-leitura | src/ | e2e/ | package.json | package-lock.json | playwright.config.ts | sociedade/
E3 | atestado_aprovado | sociedade/pareceres/atestado-p2-leitura.json | etapa/p2-leitura
E4 | delegacoes | antigravity | <id da conversa> | 5
E5 | conversa_nova | antigravity | <id da conversa>
```

## Retorno
Formato: `Para · De · Etapa / Situação / Feito / Pendente ou decisão pedida / Próximo passo de quem recebe / Detalhe`.

O retorno vai para `sociedade/subordens/p2-leitura-retorno.md`, com:
- `## Resumo` (até 25 linhas);
- `## Evidências`, com o portão, as capturas e a saída do teste-ouro.

No chat, até 2 KB.
