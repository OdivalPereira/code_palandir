# Ordem p2-leitura — o painel no centro: casca, Hoje com "montar mensagem" e Projetos

> **RASCUNHO de 23/10/2026.** O Argon complementa (`docs/arquitetura.md`); o Círdan fecha a ordem, e Odival aprova (com as dependências novas) antes do `sc.py abrir`.

Para: Gandalf (Antigravity, Gemini 4 Argon, esforço high) · De: Círdan · CONVERSA NOVA
Etapa: p2-leitura · Base: `<commit do fecho das ordens em painel/base>` · Worktree: `~/.sociedade/trabalho/code_palandir/p2-leitura` · Ramo: `etapa/p2-leitura`
Especialistas: Legolas (F1, F3, F4), Elrond (F2), Galadriel (F5) · Revisão interna: F3, pela Galadriel no nível alto · Jules: nenhuma
Portão: por fatia (padrão); área `app` do perfil
Trilho: enxuto (telas de leitura sobre dado fictício)

## Objetivo
Ao abrir o Code Palandir, Odival cai na tela **Hoje**:
- vê o que espera por ele em todos os projetos, o que está desconhecido e o que está defasado;
- monta e copia a mensagem de abertura de um agente, igual à do `sc.py abertura`;
- passa para **Projetos**, com pastas, etapas e ocupantes;
- o analisador de código continua inteiro em **Analisador**.

Tudo isso com o exemplo fictício e no celular (360 px).

**Como Odival percebe:**
- `npm run dev` abre a Hoje com o selo "dados de exemplo";
- o projeto "Diário de Campo" aparece como desconhecido, e não como em dia;
- a mensagem copiada para `loja-exemplo/e3-carrinho` é idêntica à saída-ouro da seção 5.3 da arquitetura;
- o analisador abre e funciona como antes.

## Leia só
1. `sociedade/arquitetura-painel.md`, seções 2, 5 e 6 (e `docs/arquitetura.md`)
2. `sociedade/perfil.md`, seções "Papéis locais", "Regras de domínio" (D05–D10) e "Portão por área"
3. `sociedade/central/` (esquema e exemplo fictício)
4. `src/app/App.tsx`, `src/index.tsx`, `src/stores/uiStore.ts` e `src/__tests__/selfImport.test.ts`
5. `src/features/prompt/usePromptGenerator.ts` (`redactSecrets`, `createSafeMarkdownFence`), `src/services/clipboard.ts` e `src/ui/*`

## Dependências novas (aprovação de Odival no fecho)
- `react-router-dom`, numa versão compatível com React 18;
- `ajv` e `ajv-formats`;
- opcionais, se o complemento justificar:
  - `@playwright/test` (dev; os navegadores já estão em `~/.cache/ms-playwright`, então não há download);
  - `@testing-library/react` (dev);
  - `json-schema-to-typescript` (dev).

## Fatias
*Nível e modelo pelo cardápio do perfil: alta = Gemini 4 Argon high; moderada = Gemini 3.8 Flash medium; simples = Gemini 3.8 Flash low.*
1. **Casca e rotas**
   - especialista: Legolas · nível: moderada · modelo: Gemini 3.8 Flash · esforço: medium
   - escreva só: `package.json`, `package-lock.json`, `src/index.tsx`, `src/app/**`, `src/__tests__/selfImport.test.ts`
   - aceite (E):
     - rotas `/`, `/projetos`, `/projetos/:id` e `/analisador`;
     - o analisador é idêntico ao de antes (os testes antigos seguem verdes, e o `selfImport` é ajustado com justificativa);
     - barra inferior em 360 px e lateral a partir de `md`;
     - sem rolagem horizontal em 360 px;
     - as dependências aprovadas são instaladas aqui.
2. **Contrato e fonte no front**
   - especialista: Elrond · nível: moderada · modelo: Gemini 3.8 Flash · esforço: medium
   - escreva só: `src/painel/contrato/**`, `src/painel/fonte/**`, `src/painel/fixtures/**`, `src/stores/painelStore.ts`, `src/__tests__/painelContrato.test.ts`
   - aceite (E):
     - o exemplo oficial passa na validação;
     - instantâneo inválido vira estado de erro com a lista de erros;
     - `null` chega à tela como `null`;
     - cenários vazio, só desconhecidos e inválido em `fixtures/`;
     - teste de igualdade com o esquema oficial, se houver cópia.
3. **Hoje e "montar mensagem"**
   - especialista: Legolas · nível: alta · modelo: Gemini 4 Argon · esforço: high
   - escreva só: `src/painel/hoje/**`, `src/painel/mensagem/**`, `src/__tests__/painelHoje.test.tsx`, `src/__tests__/painelMensagem.test.ts`
   - aceite (E):
     - teste-ouro idêntico à saída da seção 5.3;
     - `redactSecrets` aplicado antes de copiar;
     - as pendências na ordem da seção 5.3;
     - a seção "Desconhecido" mostra os diagnósticos (D08);
     - as versões mostram o que está defasado;
     - modelo e esforço só a partir do cardápio do instantâneo.
4. **Projetos**
   - especialista: Legolas · nível: moderada · modelo: Gemini 3.8 Flash · esforço: medium
   - escreva só: `src/painel/projetos/**`, `src/__tests__/painelProjetos.test.tsx`
   - aceite (E):
     - lista e detalhe como na seção 5.4;
     - as seis estações mais encerrada e desconhecida;
     - aviso quando `modelo_no_log` diverge ou é `null`;
     - bloco de passagem recolhido.
5. **Acessibilidade e capturas**
   - especialista: Galadriel · nível: moderada · modelo: Gemini 3.8 Flash · esforço: medium
   - escreva só: `e2e/**`, `playwright.config.ts`, `src/__tests__/painelA11y.test.tsx`
   - aceite (E):
     - D05 nas três telas: foco visível, rótulos ARIA, toque de 44 px ou mais, e os estados carregando, vazio, erro, parcial e sucesso;
     - capturas em 360 px de Hoje, Projetos e Analisador, anexadas ao retorno.

**Ordem das fatias:** a F1 vem primeiro e a F2 em seguida. A F3 e a F4 rodam juntas, e a F5 fecha. Os arquivos não se cruzam.

## Paradas
- **Escopo, contrato ou instalação:** volta ao arquiteto e a Odival. Dependência fora da lista aprovada também para.
- **Esta etapa não toca** `supabase/`, `scripts/`, `server/`, `vercel.json` nem `index.html` (a CSP muda na fase B, junto com o login real).
- **Na fase A não há `FonteSupabase` nem login real:** o guarda de rota deixa passar com o selo "dados de exemplo".
- O teto é de cerca de 1.500 linhas de produto, fora o lockfile e as fixtures.
- Sem push, PR ou merge: Odival faz.

## Entregas verificáveis
`Preencher no manifesto p2-leitura-entregas.md, não na ordem.`

```entregas
E1 | commit_existe | etapa/p2-leitura
E2 | arquivos_em | <base>..etapa/p2-leitura | src/ | e2e/ | package.json | package-lock.json | playwright.config.ts | sociedade/
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
