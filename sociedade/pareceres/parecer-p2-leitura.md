## Resumo

Para: Círdan · De: Barbárvore (Codex/OpenAI) · Etapa: p2-leitura / Reconferência da correção 1.

**Veredito: não aceitar.** O caso original do bloqueador A1 foi corrigido: duas sondas de tela falham com o código anterior e passam no candidato. A2–A6 têm provas locais favoráveis. Porém, dois requisitos expressos da correção de A1 continuam descumpridos: diagnóstico da versão de instalação não impede o selo “em dia”; fonte nula com alteração local vira “defasado”, em vez de “desconhecido”. São pendências do mesmo achado, dentro do escopo fechado, descritas abaixo como relevantes. Não há acordo de adiamento dessas pendências no material entregue.

Foram executados 307 testes do produto, todos aprovados; TypeScript do projeto aprovado; prova negativa de A5 com TS1360; integridade de 183 entradas do inventário e 36 hashes do atestado confirmada. O contraste calculado do título passou de 3,781:1 para 7,193:1. A7 permanece encerrado pela decisão de Odival; não foi reavaliado.

Próximo passo: decisão de Odival/Círdan sobre as pendências de A1, observando o limite de uma correção e uma reconferência. Nenhuma implementação, integração, publicação ou registro de aceite foi feita nesta sessão.

## Evidências

- **S1:** `python3 revisao-saida/sonda-integridade.py` → `integridade.log`, saída 0. Inventário, atestado, delta, governança e dimensões das capturas.
- **S2:** `node node_modules/vitest/vitest.mjs run --config revisao-saida/vitest.config.mts` → `vitest.log`, saída 0: 24 arquivos, 307 testes aprovados, sem pulados. Executado antes da criação das sondas adicionais nesta pasta; o comando sem filtro também descobre essas sondas numa reexecução. Para restringir à entrega, acrescente o filtro `src`.
- **S3:** `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json --tsBuildInfoFile revisao-saida/tsconfig.app.tsbuildinfo` → `tsc.log` vazio, saída 0.
- **S4a/Q86:** `node node_modules/vitest/vitest.mjs run --config revisao-saida/vitest-antes.config.mts` → `a1-antes.log`, saída 1: as duas asserções de A1 falham.
- **S4b/Q86:** `node node_modules/vitest/vitest.mjs run --config revisao-saida/vitest-depois.config.mts` → `a1-depois.log`, saída 0: as mesmas duas asserções passam.
- **S5:** `node node_modules/vitest/vitest.mjs run --config revisao-saida/vitest-residuos.config.mts` → `a1-residuos.log`, saída 1: duas falhas de requisito, com os valores efetivos registrados.
- **S6a:** `node node_modules/typescript/bin/tsc --noEmit --skipLibCheck --strict --target ES2020 --module ESNext --moduleResolution bundler revisao-saida/literal-valido.ts` → `literal-valido.log` vazio, saída 0.
- **S6b:** mesmo comando com `revisao-saida/literal-sem-maquina.ts` → `literal-sem-maquina.log`, saída 2: TS1360, propriedade obrigatória `maquina` ausente. Os dois arquivos são cópias isoladas; só o caminho de importação foi adaptado, e o segundo omite `maquina`.
- **S7:** `python3 revisao-saida/sonda-contraste.py` → `contraste.log`, saída 0: composição sRGB da lateral e conferência da classe real do título.

## Parecer do Revisor Independente
- etapa: p2-leitura
- entrega: candidato congelado, reconferência da correção 1, delta 4812323..2028ff2
- commit: 2028ff234b9c6b7fdd6ba3692117fd56546f08aa
- base..head: 00970bcfce70319863acbec8403f5f67654e03d1..2028ff234b9c6b7fdd6ba3692117fd56546f08aa
- revisor: Barbárvore · Codex · fornecedor: OpenAI · sessão: conversa nova desta ordem; ID não exposto pelas ferramentas
- modelo: GPT-6.1-Sol solicitado na escala; confirmação efetiva não exposta · esforço: high solicitado; confirmação efetiva não exposta
- independência: Nível A documental, fornecedor diferente de Google e Anthropic
- veredito: não aceitar
- data: 24/10/2026 03:05 America/Campo_Grande

### Independência

Não implementei nem corrigi nada desta entrega. A implementação anterior é atribuída a Google/Antigravity; a correção é atribuída a Anthropic/Claude Code pelo usuário e pelo retorno validado. A revisão é OpenAI/Codex, distinta de ambos e também da arquitetura Anthropic. O retorno identifica a exceção R3 como `DEC-p2-leitura-R3-correcao-1`. Esse evento não consta do snapshot de `sociedade/registro.json` entregue; sua existência no registro atualizado é informação do usuário/retorno, não comprovação própria por log. Isso não muda a distinção documental entre os três fornecedores.

Sem rede, instalação, memórias, alteração de modelo ou acesso deliberado a outro worktree. As três leituras globais de SKILL.md (sociedade-do-codigo, sc-revisao e sc-papeis), exigidas pelo ambiente, ocorreram antes da análise; são a exceção declarada à contenção das leituras. A execução usou exclusivamente as dependências disponibilizadas nesta cópia; os stack traces de bibliotecas resolvem alguns caminhos para a pasta de origem dos node_modules. Não inspecionei essa pasta nem seu código de produto. Configurações temporárias, logs, build info, fontes extraídas e sondas foram escritos somente em `revisao-saida/`. Não alterei arquivos da entrega. `git diff --exit-code` terminou com saída 0.

### Mapa da entrega

**Motivo:** a ordem p2-leitura coloca Conselho/Regiões e montagem de mensagem sobre metadados fictícios no centro do painel, preservando o analisador. Esta reconferência cobre apenas o delta contra A1–A6 do parecer anterior e os aceites da subordem validada de correção 1 (Q85/Q86). A7 foi decidido por Odival e está fora da revisão.

**Mapa do delta:** 22 arquivos: seis capturas, sete arquivos de teste e nove arquivos de produto/fixture. Inspeção local usa anterior `bb30d48c8354b7bc200d208e467800e03ab6c8b6` e candidato `e1dafd23c8350b7c44af9a7eab129a8db8a74f0d`; SHAs originais constam do cabeçalho. Produto sem fixtures: +577/−473 linhas, compatível com o teto aproximado de 600 adições da correção. Nenhum caminho proibido pela subordem aparece no delta; lockfile e dependências permanecem iguais entre esses candidatos.

**Superfícies:** `classificarVersao`/formatação; classificações em HojePage e ProjetosPage; seletores, prévia e botão Copiar em PergaminhoAbertura; regras puras `montarAbertura`, normalização e troca de plataforma; literal `exemploOficialLiteral`; classes de cor da casca/tema; testes e PNGs. Fontes de entrada são o instantâneo fictício, cardápio, diagnósticos, seleções e props/store. Não se adicionaram rotas, endpoints ou escrita persistente.

**Estados/transições:** versões em `em_dia`, `defasado`, `desconhecido`; seleção inicial deriva dos dados; troca explícita de projeto reinicia a etapa; troca de plataforma revalida escala e subagentes. Escolhas explícitas que somem bloqueiam a cópia e permanecem indicadas até nova escolha. Falta de projeto/etapa/cardápio bloqueia prévia e cópia; nível de subagente ausente omite o grupo opcional com aviso; cópia válida apresenta confirmação. Nenhuma estação do método é promovida pelo painel.

**Fontes e derivados:** esquema/JSON em `sociedade/central/` são a referência do contrato; literal tipado é conferido por igualdade; governança validada define aceite; store e seleções são transitórios; selos, mensagem e capturas são derivados. As classificações são centralizadas, mas a passagem dos diagnósticos às instalações é incompleta (A1.1).

### Critérios e evidências

Todos os aceites abaixo pertencem à subordem de correção. “Executada” indica que a verificação aconteceu, inclusive quando seu resultado reprova o critério. A2–A6 referem-se aos IDs do parecer anterior.

| Critério do aceite | Evidência | Estado |
|---|---|---|
| C1 A1 regra pura única, usada em instalações/núcleos e nas duas telas | `S2`: painelVersao/Hoje/Projetos aprovados; imports e chamadas do delta lidos. | executada |
| C2 A1 em_dia só com versões conhecidas, iguais, sem alteração e sem diagnóstico do campo | `S5`: instalação claude com diagnóstico de sua versão continua “3.4.0 (em dia)”; A1.1. | executada |
| C3 A1 fonte nula dá desconhecido com motivo, inclusive combinações | `S4a/S4b`: cenário original reproduzido e corrigido; `S5`: fonte nula + alteração local ainda dá defasado; A1.2. | executada |
| C4 A1 testes combinatórios e telas com fonte desconhecida | `S2`: 48 combinações geradas mais três testes da função; telas aprovadas. Quatro combinações da tabela priorizam alteração sobre fonte nula, em desacordo com C3. | executada |
| C5 A2 sem etapa/projeto não inventar ID; bloquear cópia | `S2`: testes puros e 11 testes React de painelPergaminho; disabled, aria-disabled, motivo e ausência de prévia parcial conferidos. | executada |
| C6 A3 cardápio vazio/ausente/sem plataforma; padrão só do cardápio | `S2`: fixtures so_desconhecidos, lista vazia, plataforma única e plataforma removida; cópia bloqueada/reliberada por seleção válida. | executada |
| C7 A4 filtrar plataforma e nível, revalidar na troca e omitir subagentes incompletos com aviso | `S2`: opções DOM e mensagem após troca para Codex; plataforma única sem simples omite subagentes e mantém abertura legítima disponível. | executada |
| C8 A2–A4 preservar ouro de cinco linhas e redigir antes de copiar | `S2`: ouro de painelMensagem e prévia/copiar de painelPergaminho aprovados; texto comparado por leitura ao ouro da arquitetura §5.3. Clipboard substituído por spy. | executada |
| C9 A5 sem cast integral, prova estática eficaz, igualdade ao JSON e contrato triplo | `S2/S3/S6a/S6b`: runtime/igualdade, tipos aprovados; retirar maquina produz TS1360. | executada |
| C10 A6 título acima de 4,5:1 e suíte de pares da casca/selos | `S2`: 45 pares compostos mais cobertura de classes aprovados; `S7`: título real stone-400 sobre lateral composta = 7,193:1. | executada |
| C11 A6 seis capturas novas nas mesmas dimensões | `S1`: seis PNGs diferentes do candidato anterior, dimensões 1280×800/360×820 e hashes do atestado compatíveis. Recaptura histórica somente documentada no retorno. | executada |
| C12 limites do delta e vínculo ao candidato/atestado | `S1` e `git diff --stat bb30d48c8354b7bc200d208e467800e03ab6c8b6 e1dafd23c8350b7c44af9a7eab129a8db8a74f0d`: 22 caminhos permitidos; 183/183 e 36/36 hashes compatíveis. | executada |

### Matriz de cobertura

L1 motivo; L2 interface pública dos componentes renderizada em jsdom, sem navegador gráfico; L3 estados/transições; L4 padrões/escapes; L5 entradas degradadas; L6 concorrência/falha; L7 consistência; L8 retorno. O protocolo reduzido e fechado não requer nova aprovação ponta a ponta do navegador. “Lida” registra inspeção, não execução. L6 é inaplicável aos cálculos puros e artefatos estáticos desta correção; a API assíncrona de clipboard não foi alterada.

| Critério | L1 motivo | L2 ponta a ponta | L3 estados | L4 escape | L5 entradas | L6 concorrência | L7 fontes | L8 retorno |
|---|---|---|---|---|---|---|---|---|
| C1 | S2/S4b | S2/S4b | S2 | S2 | S2 | n/a (cálculo puro) | lida | S2 |
| C2 | S5 | S5 | S5 | S2 | S5 | n/a (cálculo puro) | S5 | S5 |
| C3 | S4b/S5 | S4b | S5 | S2 | S4b/S5 | n/a (cálculo puro) | S5 | S5 |
| C4 | S2 | S2/S4b | S2/S5 | S2 | S2/S5 | n/a (tabela determinística) | lida | S2/S5 |
| C5 | S2 | S2 | S2 | S2 | S2 | n/a (seleção síncrona) | S2 | S2 |
| C6 | S2 | S2 | S2 | S2 | S2 | n/a (troca síncrona de props/store) | S2 | S2 |
| C7 | S2 | S2 | S2 | S2 | S2 | n/a (normalização síncrona) | S2 | S2 |
| C8 | S2 | S2 | S2 | S2 | S2 | n/a (serviço assíncrono inalterado) | lida/S2 | S2 |
| C9 | S2/S6b | n/a (contrato estático/runtime) | n/a (sem transição) | S6b | S2/S6b | n/a (literal imutável) | S2 | S2/S3/S6b |
| C10 | S7 | lida (classes; sem CSS computado) | S2 | n/a (sem opção de escape) | n/a (paleta fixa) | n/a (estilos estáticos) | S2/S7 | S2/S7 |
| C11 | S1 | lida (retorno; sem recaptura) | n/a (PNG estático) | n/a (sem opção) | S1 | n/a (artefatos estáticos) | S1 | S1 |
| C12 | S1 | n/a (metadados Git) | n/a (sem transição) | n/a (sem opção) | S1 | n/a (cópia congelada) | S1 | S1 |

### Achados

- [relevante] A1.1 · L1/L2/L5/L7/L8 · **Critério de diagnóstico de A1 não concluído nas instalações.** Condição: exemplo oficial válido com diagnóstico fictício `{projeto:null,campo:'pacote.instalacoes[0].versao',motivo:'versão não confirmada (fictício)'}`. O store aceita o instantâneo; HojePage renderiza a instalação claude como `3.4.0 (em dia)`. A chamada em `src/painel/hoje/HojePage.tsx:288` passa versão, fonte e alteração, mas não passa diagnósticos; a função assume zero em `src/painel/regras/classificarVersao.ts:23`. Efeito: a interface declara confirmação positiva apesar do diagnóstico do próprio campo. Afeta C2, D08 e o aceite expresso “sem diagnóstico do campo” da fatia 1. Evidência reproduzível: S5, segundo teste em `a1-residuos.test.tsx`, falha por conter `(em dia)`; `a1-residuos.log` contém o texto DOM efetivo. Correção esperada: levar os diagnósticos pertinentes à classificação da instalação e impedir em_dia nesse caso, com o motivo visível. É pendência da correção de A1, não abertura de outra área da etapa.
- [relevante] A1.2 · L1/L3/L5/L8 · **Fonte nula perde o estado desconhecido quando há alteração local.** Condição: `classificarVersao({versao:'3.4.0',fonteVersao:null,alteracaoLocal:true})`. Resultado executado: `{estado:'defasado',motivo:'alteração local'}`. O retorno por alteração em `src/painel/regras/classificarVersao.ts:27` ocorre antes do teste de fonte nula. Efeito: deixa de indicar a ausência da referência e descumpre o aceite explícito “fonte_versao nula dá desconhecido com o diagnóstico”. Afeta C3/C4 e D08. Evidência reproduzível: S5, primeiro teste, falha `defasado` versus `desconhecido`; a tabela de `src/__tests__/painelVersao.test.ts:12` reproduz essa precedência e, por isso, passa sem provar o requisito. Correção esperada: preservar desconhecido e o motivo da referência nula nessa combinação, podendo informar adicionalmente a alteração local. É outro caso do A1 já mandado corrigir, dentro da única reconferência.

O cenário específico que motivou o bloqueador original A1 foi resolvido. S4 extrai apenas as duas telas do commit anterior para esta pasta, adapta imports relativos para os mesmos módulos do candidato e usa as mesmas asserções antes/depois; as telas originais da entrega nunca são sobrescritas. Antes, Conselho tem quatro rótulos de versão “em dia” e Regiões não explica a referência ausente; depois, as duas asserções passam. Esta prova não afirma que todas as combinações de A1 estejam resolvidas. A2–A6 não apresentam pendência reproduzida no escopo reconferido. Não há novo achado bloqueador ou reabertura de A7.

### Retorno contra evidências e governança

S1 confirma os 183 hashes inventariados, os 36 hashes do atestado consolidado, base/head originais e hash do perfil. Ordem e perfil do snapshot coincidem com a governança validada. O snapshot não contém manifesto de entregas, atestados, parecer anterior, subordem de correção nem retornos; esses documentos estão apenas em REVISAO-GOVERNANCA. O evento R3 indicado no retorno também não está no registro congelado. A divergência foi preservada e declarada; usei a governança validada para os critérios, conforme a ordem local.

Os 307 testes declarados pelo retorno foram reproduzidos, com 24 arquivos aprovados. O retorno fala em “24 combinações” da regra; o código gera 48 (3×2×2×2×2), além de três testes específicos. A contagem menor do texto não demonstra cumprimento de C3: as expectativas dão prioridade à alteração local. O contraste independente confirma a correção do título; os 45 pares e a cobertura das classes foram executados, sem medição de estilos computados. Os seis PNGs mudaram, têm as dimensões pedidas e batem com o atestado; data/sequência da recaptura e Playwright aprovado permanecem alegações do retorno, sem execução própria.

### O que não verifiquei

- Playwright, build, navegador gráfico, CSS computado, foco por teclado, recaptura ou inspeção visual integral dos seis PNGs: dispensados para esta reconferência pelo usuário; não se reivindica aprovação visual completa da etapa. A prova de interação é React/jsdom com clipboard simulado.
- Não reabri critérios gerais da revisão anterior sem alteração no delta, A7, comportamento de produção, login, banco, rede ou dados reais. Não auditei corridas/rejeições do clipboard preexistente, nem concorrência da fonte assíncrona inalterada.
- Logs das sessões de implementação, delegações e decisão R3 atualizada não foram entregues; autoria e exceção são documentais. Os objetos Git originais não estão nesta cópia: o vínculo usa o inventário, os hashes e os commits reconstruídos fornecidos.
- Não executei scripts de registro/integração da Sociedade. Modelo, esforço e ID efetivos desta sessão não são confirmados por ferramenta; o cabeçalho distingue a escala pedida dessa limitação. As leituras de skills e a resolução das dependências estão declaradas em Independência.

### Veredito e limite

**Não aceitar a correção como integralmente concluída.** Os dois itens relevantes de A1 estão nos critérios já autorizados e não têm decisão de adiamento no material recebido. A1 original foi corrigido no cenário reproduzido; A2–A6 têm evidências favoráveis nos limites acima. O parecer vale somente para o commit original do cabeçalho e para o delta da correção 1. A decisão seguinte cabe a Odival, com o limite Q85 preservado; não se autoriza outra rodada automaticamente.
