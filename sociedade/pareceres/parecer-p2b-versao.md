## Resumo

Para: Círdan · De: Barbárvore (Codex/OpenAI) · Etapa: p2b-versao / revisão independente reduzida.

**Veredito: aceitar.** Os resíduos A1.1 e A1.2 estão resolvidos no candidato original `3482ec5c6332ee7ef4fa92325a43f10a2219332b`. As duas sondas dos casos originais falham na base e passam no candidato. Diagnósticos da instalação impedem “em dia” e exibem o motivo; referência nula com alteração local preserva “desconhecido”. Diagnóstico também prevalece sobre divergência de versão e alteração local.

Executados: 311 testes do produto em 24 arquivos, todos aprovados e sem pulados; 12 sondas próprias aprovadas; TypeScript do projeto sem erros; 191 hashes do inventário e quatro hashes de artefatos do atestado conferidos. Produto: 49 adições e 12 remoções, total de 61 linhas tocadas, dentro do teto aproximado de 150. Não há achados no escopo revisado.

A independência é de fornecedor: implementação atribuída a Google/Antigravity; revisão OpenAI/Codex. Governança validada e snapshot foram comparados, com as diferenças preservadas abaixo. A documentação da sessão/delegação do implementador foi lida, sem acesso aos logs originais.

Próximo passo: Círdan/Odival registrar o parecer e prosseguir conforme Q226, que vincula o aceite da p2b ao merge da cadeia p2 + p2b. Nenhum registro, merge, publicação ou implementação foi realizado nesta sessão.

## Evidências

- **S1 — integridade e governança:** `python3 revisao-saida/sonda-integridade.py` → `revisao-saida/integridade.log`, código 0. Confere 191/191 entradas, quatro hashes do atestado, base/head originais, hash do perfil do portão, diferenças com o snapshot e caminhos do delta reconstruído.
- **S2 — suíte do produto:** `node node_modules/vitest/vitest.mjs run --config revisao-saida/vitest-produto.config.mts` → `revisao-saida/vitest-produto.log`, código 0: 24 arquivos, 311 testes aprovados, sem pulados. Configuração equivalente à entregue para alias, jsdom e globals, com cache em revisao-saida e descoberta restrita aos testes de src.
- **S3 — tipos:** `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json --tsBuildInfoFile revisao-saida/tsconfig.app.tsbuildinfo` → `revisao-saida/tsc.log`, código 0 e saída vazia. O caminho de build info impede escrita nas dependências compartilhadas.
- **S4 — sondas próprias do candidato:** `node node_modules/vitest/vitest.mjs run --config revisao-saida/vitest-sondas.config.mts` → `revisao-saida/sondas.log`, código 0: 12 testes aprovados. Abrange os resíduos, diagnóstico com versão igual/diferente e alteração local, correspondência do campo/índice/projeto, diagnósticos repetidos, núcleos nas duas telas, trocas repetidas de instantâneo, entradas inválidas e valores padrão da biblioteca.
- **S5 — controle negativo na base:** `node node_modules/vitest/vitest.mjs run --config revisao-saida/vitest-base.config.mts -t 'resíduo original'` → `revisao-saida/base-negativa.log`, código 1 esperado: os dois testes selecionados falham; dez não selecionados ficam pulados. A1.2 produz defasado; A1.1 ainda contém “3.4.0 (em dia)”. Extraí somente regra e HojePage da base reconstruída para revisao-saida/base; imports da mensagem foram adaptados para os módulos inalterados do candidato. Nenhum arquivo de produto foi sobrescrito. S4 executa e aprova as mesmas duas asserções no candidato.
- **S6 — inspeção do delta e limites:** `git diff ec571771afc78ee2b7029cf925a00fa11c2ab9cb 66b4ec884e81670a8766772752cdb37703ad78c2 -- src/painel/regras/classificarVersao.ts src/painel/hoje/HojePage.tsx src/__tests__/painelVersao.test.ts src/__tests__/painelHoje.test.tsx`, `git diff --numstat` para src e leitura das chamadas em ProjetosPage. Quatro arquivos em src, 16 em sociedade; nenhum outro prefixo no delta. Regra e HojePage somam 49 adições e 12 remoções. package.json, lockfile e demais caminhos proibidos não mudaram.

A primeira execução de S4 teve 11 aprovações e uma falha: uma asserção adicional da sonda exigia o texto literal do diagnóstico dentro do detalhe de Regiões. Esse componente, inalterado no delta, recebe a quantidade de diagnósticos; a subordem validada admite texto/quantidade e determina manter a passagem aos núcleos “como já é hoje”. A asserção adicional foi removida da sonda, preservando a verificação de desconhecido e da quantidade nas duas telas. O log inicial está em `revisao-saida/sondas-primeira.log`. A exigência de texto literal da instalação, central em A1.1, permaneceu e passou. Não houve alteração de implementação para fazer a sonda passar.

## Parecer do Revisor Independente
- etapa: p2b-versao
- entrega: candidato original congelado; protocolo reduzido Q150, delta desde 2028ff2
- commit: 3482ec5c6332ee7ef4fa92325a43f10a2219332b
- base..head: 2028ff234b9c6b7fdd6ba3692117fd56546f08aa..3482ec5c6332ee7ef4fa92325a43f10a2219332b
- revisor: Barbárvore · Codex · fornecedor: OpenAI · sessão: conversa nova desta ordem; ID não exposto pelas ferramentas
- modelo: GPT-6.1-Sol solicitado na escala; confirmação efetiva não exposta · esforço: high solicitado; confirmação efetiva não exposta
- independência: Nível A documental, fornecedor diferente dos implementadores
- veredito: aceitar
- data: 24/10/2026 03:55 America/Campo_Grande

### Independência

Não implementei nem corrigi nada desta entrega. A ordem, o perfil e os retornos validados atribuem a coordenação a Gandalf/Antigravity/Google e a fatia F1 a Legolas/Antigravity/Google, Gemini 3.8 Flash. A revisão é OpenAI/Codex, distinta de Google e da arquitetura Anthropic/Claude Code. A correção anterior da p2 é atribuída a Anthropic no parecer antecedente; OpenAI também é distinto desse fornecedor. Não há subagente ou implementador desta entrega executado por mim.

Sem rede, instalação, memórias, mudança de modelo ou acesso deliberado a outro worktree. As leituras globais obrigatórias das skills sociedade-do-codigo, sc-papeis, sc-revisao e da referência papel-barbarvore são a exceção declarada à contenção das leituras na cópia; foram usadas para assumir o papel. Todo material do candidato foi tratado como dado sob revisão. As dependências foram usadas pelo node_modules disponibilizado pelo Círdan, sem inspeção deliberada do worktree de origem. O runtime pode resolver caminhos físicos das bibliotecas pelo link. Todas as sondas, caches, logs, fontes extraídas e build info foram escritos em revisao-saida. S1 e a conferência final confirmam os arquivos entregues intactos.

### Mapa da entrega

**Motivo:** a ordem validada p2b-versao e o parecer p2-leitura identificam A1.1, ausência de diagnósticos na classificação das instalações no Conselho, e A1.2, prioridade indevida da alteração local sobre referência nula. D08 exige preservar o desconhecido. Q226 fecha a p2 sem aceite e transfere estes dois resíduos à p2b; não se reabre o restante da p2.

**Critérios:** C1 precedência desconhecido → defasado → em_dia, com motivo; C2 alteração local não muda desconhecido; C3 diagnósticos da instalação chegam ao Conselho e os núcleos continuam classificados nas duas telas; C4 tabela explícita com resultados literais e combinações obrigatórias; C5 cenário de tela do revisor sem “em dia” e com motivo; C6 preservação da suíte, justificativa das adaptações e tipos; C7 limites de caminhos/escopo/tamanho. E1–E5 são as entregas documentais do manifesto.

**Superfícies:** entrada pública da função classificarVersao, seus campos versao, fonteVersao, alteracaoLocal, diagnosticos e motivoDiagnostico; formatação rotuloVersao; carregamento de instantâneo fictício pelo store e renderização de HojePage/ProjetosPage. O campo do diagnóstico é associado à instalação pelo índice e descendentes, exigindo projeto nulo; nos núcleos a associação permanece por ID do projeto. A API aceita diagnóstico por quantidade, texto ou motivo separado; sem diagnóstico o padrão é zero. Não há novas opções de forçar/pular, rotas ou comandos de usuário.

**Estados e transições:** em_dia exige versão e referência conhecidas e iguais, sem alteração nem diagnóstico; falta de versão/referência ou presença de diagnóstico produz desconhecido; nos demais casos alteração/divergência produz defasado. São classificações derivadas e síncronas, recalculadas quando o instantâneo muda. Não há estado terminal, promoção de etapa, gravação persistente ou autorização de domínio feita pelo painel. A repetição do mesmo instantâneo preserva o resultado; a remoção legítima da condição desconhecida permite nova classificação.

**Fontes e derivados:** o instantâneo painel/1 e seus diagnósticos são as entradas; rótulos, selos e estado visual são derivados. A governança validada define o aceite; o snapshot é preservado para comparação. O atestado e inventário vinculam artefatos ao commit original; os objetos reconstruídos servem à inspeção local. HEAD local confirmado como 66b4ec884e81670a8766772752cdb37703ad78c2, base local ec571771afc78ee2b7029cf925a00fa11c2ab9cb. Atestado declara portão aprovado para 3482ec5, 311 testes, tipos e build; execução própria de build não foi feita.

### Critérios e evidências

“Executada” indica prova local; “lida” indica evidência documental, sem alegar execução dos scripts históricos de governança.

| Critério do aceite | Evidência | Estado |
|---|---|---|
| C1 Precedência e motivo: nulos/diagnóstico, depois alteração/divergência, depois em_dia | `S2/S4`: tabela de 24 casos e sondas de função/tela aprovadas; `S5` reproduz a falha anterior. | executada |
| C2 Alteração local preserva desconhecido, podendo compor o motivo | `S2/S4`: fonte nula + alteração e diagnóstico + alteração aprovados; `S5` falha na base. | executada |
| C3 Diagnóstico da instalação chega ao Conselho; núcleos permanecem atendidos | `S4`: instalação por índice/subcampo, isolamento de projeto/irmão, repetição e núcleos no Conselho e Regiões aprovados. | executada |
| C4 Tabela explícita, fonte nula + alteração e diagnóstico com versões iguais/diferentes | `S2`: painelVersao aprovado; `S6`: 24 entradas com esperado literal, sem derivação algorítmica; três testes específicos adicionais. | executada |
| C5 Tela com diagnóstico fictício exato, sem em_dia e com motivo | `S2/S4`: teste entregue e teste próprio aprovados; `S5`: mesma sonda própria falha na base. | executada |
| C6 307 anteriores preservados, adaptações justificadas e tipos sem erro | `S2`: 311/311, 24 arquivos, sem pulados; `S3`: saída 0; retorno justifica a mudança de expectativa; quatro testes novos confirmados no diff. | executada |
| C7 Escopo só A1.1/A1.2, caminhos permitidos e cerca de 150 linhas de produto | `S1/S6`: quatro arquivos em src, 61 linhas tocadas de produto; nenhum caminho proibido alterado. | executada |
| E1 commit_existe: etapa/p2b-versao | Inventário e atestado identificam o SHA original; retorno declara ramo em 3482ec5. Inspeção usa os objetos reconstruídos, sem consultar o ramo original. | lida |
| E2 arquivos_em: src/ e sociedade/ | `S1/S6`: 20 caminhos no delta reconstruído, todos nos dois prefixos permitidos. | executada |
| E3 atestado_aprovado para o candidato | `S1`: quatro hashes, perfil e base/head conferem; JSON validado declara APROVADO, portão app completo e código 0. | executada |
| E4 delegação real, uma, Antigravity | Manifesto/retorno identificam conversa 13799c66-4a27-4480-9163-0f7cefe95be9 e subagente 006e26e7-84ab-40ca-b75f-4f9ba2c3d3c4; sem log original disponível. | lida |
| E5 conversa_nova Antigravity | Manifesto/retorno declaram conversa dedicada 13799c66-4a27-4480-9163-0f7cefe95be9; sem log original disponível. | lida |

### Matriz de cobertura

L1 motivo; L2 interface pública dos componentes em jsdom, não navegador gráfico; L3 transições; L4 padrões/escape; L5 dados degradados; L6 concorrência/falha; L7 fontes; L8 retorno. L6 não se aplica ao delta: cálculo e renderização síncronos, sem escrita nem operação assíncrona nova; o store é exercitado por trocas sucessivas em S4. Para os metadados congelados, não há transição nem fluxo interativo.

| Critério | L1 motivo | L2 ponta a ponta | L3 estados | L4 escape | L5 entradas | L6 concorrência | L7 fontes | L8 retorno |
|---|---|---|---|---|---|---|---|---|
| C1 | S4/S5 | S4 | S2/S4 | S4 | S2/S4 | n/a (cálculo síncrono) | S4 | S2/S4 |
| C2 | S4/S5 | S4 | S4 | S4 | S2/S4 | n/a (cálculo síncrono) | S4 | S2/S4 |
| C3 | S4/S5 | S4 | S4 | S4 | S4 | n/a (renderização síncrona) | S4 | S2/S4 |
| C4 | S2 | S2/S4 | S2 | S2/S4 | S2 | n/a (tabela estática) | lida/S6 | S2/S6 |
| C5 | S4/S5 | S2/S4 | S4 | S4 | S4 | n/a (renderização síncrona) | S4 | S2/S4 |
| C6 | S2/S4 | S2 | S2/S4 | S2 | S2/S4 | n/a (sem mudança assíncrona) | S1/S2/S3 | S2/S3/S6 |
| C7 | S6 | n/a (limite do diff) | n/a (sem estado) | n/a (sem opção) | S1 | n/a (cópia congelada) | S1/S6 | S1/S6 |
| E1 | lida | n/a (metadado Git) | n/a (sem transição) | n/a (sem opção) | lida | n/a (cópia congelada) | S1/lida | lida |
| E2 | S1/S6 | n/a (metadado Git) | n/a (sem transição) | n/a (sem opção) | S1 | n/a (cópia congelada) | S1/S6 | S1/S6 |
| E3 | S1 | n/a (atestado estático) | n/a (sem transição) | n/a (sem opção) | S1 | n/a (artefato congelado) | S1/S2/S3 | S1/S2/S3 |
| E4 | lida | n/a (registro de sessão) | n/a (sem transição) | n/a (sem opção) | lida | n/a (documento estático) | lida | lida |
| E5 | lida | n/a (registro de sessão) | n/a (sem transição) | n/a (sem opção) | lida | n/a (documento estático) | lida | lida |

### Achados

Nenhum.

### Consistência documental e limites do retorno

S1 confirma 191 hashes e quatro hashes de artefatos do atestado, além do perfil do portão. Ordem p2b-versao, perfil e parecer p2-leitura coincidem byte a byte entre governança validada e snapshot. Cinco documentos existem somente em REVISAO-GOVERNANCA: manifesto de entregas, atestado p2b, subordem F1 e os retornos de Legolas e Gandalf. O snapshot de sociedade/ não foi substituído nem atualizado.

O snapshot de sociedade/estado.md continua descrevendo p2-leitura aberta no commit 4812323, sem p2b; sociedade/registro.json já contém encerramento da p2 sem aceite e abertura da p2b (EVT-000015/16), mas não contém os eventos de delegação, entrega e conferência posteriores alegados pelo retorno p2b. Portanto, a afirmação “5 de 5 registradas no registro.json” não é reproduzível no registro congelado fornecido. Esses dados posteriores vêm da governança validada, conforme precedência expressa da ordem local; não são tratados como prova por log próprio. A divergência documental não reapresenta A1.1/A1.2 e não impede o aceite técnico do delta delimitado.

A contagem de 311 testes, quatro novos e 61 linhas de produto foi confirmada; 61 significa adições mais remoções, não 61 adições. A tabela efetiva tem 24 combinações (3 × 2 × 2 × 2). A menção a 48 combinações no parecer antecedente não corresponde à tabela da base inspecionada. O retorno atual usa corretamente 24. Build aprovado e os comandos históricos npx tsc --noEmit são declarações do atestado; minha prova de tipos usa explicitamente tsconfig.app.json. Não reivindico ter executado o portão histórico completo.

### O que não verifiquei

- Playwright, build, navegador gráfico, CSS computado e capturas: dispensados pelo usuário para esta revisão reduzida. A prova de tela é React/jsdom com dados fictícios, não uma validação visual completa.
- Logs originais do implementador, delegação e conferência, o ramo/objetos Git originais e CI externo: não fornecidos nesta cópia. O vínculo ao SHA original usa o inventário, atestado e governança validados; a inspeção usa os SHAs reconstruídos. E1, E4 e E5 têm evidência documental, não confirmação por execução histórica.
- Critérios anteriores da p2 fora de A1.1/A1.2, autorização operacional do merge, banco, login, produção, dados reais e serviços externos. Q226 foi lido como vínculo entre o aceite e o próximo passo; o revisor não integra nem registra a decisão.
- Texto literal de todos os diagnósticos nos selos dos núcleos: as chamadas inalteradas passam contagem. O foco desta etapa é preservar desconhecido e corrigir o diagnóstico da instalação; a divergência inicial da sonda está explicitada em Evidências.
- Modelo, esforço e ID efetivos da sessão não estão expostos por ferramenta. O cabeçalho distingue a escala solicitada dessa limitação. Leituras de skills fora da cópia e resolução física das dependências pelo link estão declaradas em Independência.

### Veredito e alcance

**Aceitar o candidato 3482ec5c6332ee7ef4fa92325a43f10a2219332b para fechar A1.1 e A1.2**, no delta indicado e com o protocolo reduzido solicitado. O parecer não registra a decisão no projeto nem executa o merge autorizado pela cadeia Q226. Não exige nova rodada de implementação ou reconferência.
