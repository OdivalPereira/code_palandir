## Resumo

Para: Círdan · De: Barbárvore · Etapa: p2-leitura

Situação: **parecer parcial; recomendação de não aceitar** o candidato congelado. Há um bloqueador de D08 e seis achados relevantes. A interface real não pôde ser executada: a cópia não contém node_modules e `npm test` termina em `vitest: not found`. Não instalei dependências nem usei rede.

Feito: conferência dos 175 hashes do inventário e dos 31 artefatos do atestado, comparação base/candidato, inspeção das seis capturas e sondas isoladas do código TypeScript. Mensagem-ouro, ordem das pendências e filtragem antes do clipboard substituído passaram. As sondas identificaram falso “em dia” com fonte desconhecida, etapa fabricada, mensagem com escala vazia, seleção de subagentes sem filtro por nível/plataforma, prova estática anulada por cast, contraste insuficiente e desvio do teto de linhas.

Pendente: execução real de React/Vitest/Ajv/Playwright, tipos/build, interação pelo navegador, logs de delegação/conversa nova e confirmação independente da configuração efetiva de modelo/esforço. Próximo passo: Círdan encaminhar os achados e preparar eventual correção e reconferência delimitadas; este documento não encerra a revisão completa.

## Evidências

Arquivos reproduzíveis nesta pasta:

- `python3 revisao-saida/sonda-integridade.py` → `sonda-integridade.log` (S1/S2).
- `node revisao-saida/sonda-logica.mjs` → `sonda-logica.log` (S3/S4/S5).
- `python3 revisao-saida/sonda-contraste.py` → `sonda-contraste.log` (S6).
- `npm test` → `npm-test.log` (P1: tentativa, sem testes executados).
- `entrada-fonte-desconhecida.json`: variação exclusivamente fictícia do exemplo oficial.

As primeiras duas tentativas de extração do ouro na sonda falharam por seleção do bloco Markdown e sua quebra final; a sonda foi ajustada, sem tocar no produto. A comparação final usa as cinco linhas da seção 5.3, retirando somente a quebra de fechamento do bloco Markdown.

## Parecer do Revisor Independente
- etapa: p2-leitura
- entrega: candidato congelado 481232353de2cf04bd3a3f93c721ba1c2b538742
- commit: 481232353de2cf04bd3a3f93c721ba1c2b538742
- base..head: 00970bcfce70319863acbec8403f5f67654e03d1..481232353de2cf04bd3a3f93c721ba1c2b538742
- revisor: Barbárvore · Codex · fornecedor: OpenAI · sessão: conversa nova desta ordem, ID não exposto pelas ferramentas
- modelo: GPT-6.1-Sol solicitado na escala; confirmação efetiva não exposta · esforço: high solicitado; confirmação efetiva não exposta
- independência: Nível A documental (implementação Google; revisão OpenAI)
- veredito: não aceitar
- cobertura: parcial
- data: 24/10/2026 02:22 America/Campo_Grande

### Independência

Não implementei nem corrigi nada desta entrega. A governança validada e o retorno atribuem a implementação a Google/Antigravity e a arquitetura a Anthropic/Claude Code. Esta revisão usa OpenAI/Codex, fornecedor distinto. Não tive acesso aos logs originais dos implementadores para atestar identidade de cada sessão. A escala solicitada foi respeitada como ordem, sem mudar modelo; o ambiente não expõe uma confirmação independente de modelo/esforço ou o ID desta sessão.

Nenhuma memória foi consultada ou gravada. As únicas leituras de arquivos fora da cópia foram os três SKILL.md globais exigidos pelas instruções do ambiente: sociedade-do-codigo, sc-papeis e sc-revisao, em `/home/odival/.agents/skills/`. Essa exceção à contenção pedida está declarada para auditoria. Não li outros worktrees nem arquivos de dados reais. Todas as gravações próprias ficaram em revisao-saida/; não houve correção, instalação, integração ou publicação.

### Mapa da entrega

Motivo: ordem validada p2-leitura, Objetivo, e arquitetura-painel.md §§5–6: colocar Conselho/Regiões no centro do produto com leitura de dados fictícios, abrir agentes por mensagem igual à CLI e preservar o analisador.

Candidato/base locais reconstruídos para inspeção: `4cb65a45d616942b5b1ac29b5f3102fa08d8f560` / `35c2eda6b5a0f78dd554859b19b35ffef8b8bb6d`. Os SHAs do cabeçalho são os originais da ordem. O diff tem 35 caminhos; nenhum nas superfícies proibidas da ordem. A extração do analisador muda nome/export e o contêiner externo para se ajustar à altura da casca; os demais conteúdos coincidem (S2).

Superfícies de entrada: BrowserRouter em `/`, `/projetos`, `/projetos/:id`, `/analisador`; seletores do Pergaminho, botão Copiar, seleção de projeto e expansão de passagens; `FonteFixture` com válido, vazio, só desconhecidos, limites, parcial e inválido; `validarPainel1`, `carregar`, `carregarDadoBruto`, `selecionarCenario`, `definirEstado`, `selecionarProjeto`, `resetar`; gerador de mensagem e funções de ordenação/cardápio. Padrões: fixture válido, loja-exemplo/e3-carrinho, coordenador, Antigravity, nível moderada e subagentes incluídos.

Estados/transições: carregando/vazio/erro/parcial/sucesso no store; navegação troca rota/projeto; passagens começam recolhidas e alternam expansão; seletores recompõem a prévia e Copiar envia ao clipboard. Não há transição de estação, decisão, publicação ou mutação do registro pelo painel. O usuário só lê metadados e monta mensagens. A função assíncrona carregar existe, mas não foi submetida a corrida; a tela atual parte da fixture síncrona.

Fontes de verdade: contrato e exemplo em sociedade/central, copiados/importados no front; governança de aceite em REVISAO-GOVERNANCA; estado transitório no Zustand. Derivados: classificações visuais, listas ordenadas, prévia, clipboard, capturas e testes. O cabeçalho da casca contém máquina/horário literais do exemplo, sem vínculo dinâmico com o store; não há gravação de dados do painel em disco.

### Critérios e evidências

A lista abaixo desdobra todos os aceites das cinco fatias, paradas e entregas E1–E5. “Lida” não afirma teste aprovado. Evidência de trecho executado em isolamento não equivale a tela executada.

| Critério do aceite | Evidência | Estado |
|---|---|---|
| C01 F1 extrair analisador intacto e criar quatro rotas BrowserRouter | S2: `python3 revisao-saida/sonda-integridade.py`; extração só renomeia/exporta e adapta contêiner. App.tsx:78–89 contém rotas. | executada |
| C02 F1 PainelShell/rpgTheme, paleta e títulos locais sem baixar fonte | Lida rpgTheme.tsx:5–7 e classes da casca; nenhuma fonte externa nova observada. | lida |
| C03 F1 não tocar src/ui | S2: `python3 revisao-saida/sonda-integridade.py`; nenhum caminho proibido alterado. | executada |
| C04 F1 lateral 1280, barra 360, alvos 44 e sem rolagem horizontal | Classes e capturas lidas; Playwright não executado. | não verificada |
| C05 F1 Sociedade/Tarefa nova/Perguntas/Conversa reservados com Fase B · p3 e sem páginas | PainelShell.tsx:145–229 e 300–314 lidos; três últimos só na lateral; barra móvel segue as quatro entradas do complemento. | lida |
| C06 F1 casca h-screen/w-screen/overflow-hidden/flex e main flex-1/min-h-0 | PainelShell.tsx:18 e 233–239; AnalisadorPage.tsx:17 lidos; altura calculada não executada. | lida |
| C07 F1 analisador preservado, testes antigos verdes e ajuste justificado do selfImport | Extração S2 e retorno lidos; `npm test` falhou antes da suíte. | não verificada |
| C08 F1 selfImport com lista exata de rotas, limites inferiores e expansão/prompt AnalisadorPage | Diff do teste lido: quatro rotas exatas, contagens inferiores e mudança de alvo. | lida |
| C09 F1 somente cinco dependências aprovadas | S2: `python3 revisao-saida/sonda-integridade.py`; adições diretas exatas da ordem. | executada |
| C10 F2 tipos escritos à mão e teste de atribuição estática do exemplo | Types e painelContrato.test.ts:65 lidos; cast em cenarios.ts:7 torna a prova circular (A5). | lida |
| C11 F2 esquema byte a byte/SHA-256 igual ao oficial | S1: `python3 revisao-saida/sonda-integridade.py`; ambos fdf345d7dbfd654e8cd64f2f432b500ae02a5de2004af553148a63c4e7d56a2c. | executada |
| C12 F2 Ajv 2020 valida válido/vazio/só desconhecidos/limites/inválido | Código do validador/teste lido; Ajv ausente no ambiente de execução. | não verificada |
| C13 F2 instantâneo inválido vira erro com lista, sem render parcial | validador.ts:30–37, painelStore.ts:76–86, guardas das telas lidos. | lida |
| C14 F2 null preservado e desconhecido não promovido a válido/em dia | S5: `node revisao-saida/sonda-logica.mjs`; falso em_dia com fonte null, A1. Não há prova DOM. | executada |
| C15 F3 quatro seções I–IV, Névoa/Diário/NUNCA EM DIA e versões | HojePage.tsx e seis capturas inspecionadas; UI não executada. | lida |
| C16 F3 pendências na ordem da seção 5.3 | S3: `node revisao-saida/sonda-logica.mjs`; ordem exata dos cinco itens do exemplo. Teste de oito tipos apenas lido. | executada |
| C17 F3 Worktree da CLI e ouro exato de cinco linhas | S3/S4: `node revisao-saida/sonda-logica.mjs`; gerador e cálculo inicial coincidem com ouro documental. CLI do pacote não incluída. | executada |
| C18 F3 redactSecrets antes de copiar | S3: `node revisao-saida/sonda-logica.mjs`; redator original executado, serviço de clipboard substituído registra só texto filtrado. | executada |
| C19 F3 modelo/esforço só do cardápio, escolhas por nível | S4: `node revisao-saida/sonda-logica.mjs`; lista mescla plataformas/níveis e cardápio vazio gera escala vazia, A3/A4. | executada |
| C20 F3 colunas 7/12 e 5/12 em 1280 | HojePage.tsx:94–96 e 398–405 lidos; captura 1280 inspecionada, sem nova medição. | lida |
| C21 F4 Regiões/lista/detalhe, oito estações, pastas, companhia e passagens recolhidas | ProjetosPage.tsx e MarcoJornada lidos; passagensExpandidas inicia {}; capturas inspecionadas. | lida |
| C22 F4 aviso modelo_no_log divergente ou null | ProjetosPage.tsx:482–505 e testes correspondentes lidos, sem execução React. | lida |
| C23 F5 D05 nas três telas: foco/ARIA/toque e cinco estados | Testes e e2e lidos; fluxo real, estados renderizados e foco não executados. | não verificada |
| C24 F5 contraste AA mínimo 4.5:1 | S6: `python3 revisao-saida/sonda-contraste.py`; título da lateral 3.781:1, A6. Pares da suíte não cobrem esse texto. | executada |
| C25 F5 estados com ícone e rótulo, sem depender só de cor | SeloEstado/MarcoJornada e chamadas lidos; capturas contêm símbolos e texto. | lida |
| C26 F5 seis capturas nas dimensões pedidas, anexadas ao retorno | S2: `python3 revisao-saida/sonda-integridade.py`; seis PNGs com dimensões corretas e hashes do atestado; imagens vistas, sem recaptura. | executada |
| C27 limite aproximado de 1500 linhas de produto sem lock/fixtures | S2: `python3 revisao-saida/sonda-integridade.py`; 3281 linhas TS/TSX, 2880 sem vazias/comentários por aproximação; A7. | executada |
| C28 paradas: não tocar supabase/scripts/server/src-ui/vercel/index e não expandir instalação/contrato | S2: `python3 revisao-saida/sonda-integridade.py`; diff e adições diretas compatíveis. Atividade externa histórica não auditada. | executada |
| C29 dado fictício; sem FonteSupabase/login real nem páginas p3 | Imports da fixture/casca/App e diff lidos; sem telas p3 ou fonte remota na entrega. | lida |
| E1 commit congelado existe | S1/S2: `python3 revisao-saida/sonda-integridade.py`; árvore reconstruída e inventário conferidos. Objetos originais não disponíveis nesta cópia. | executada |
| E2 arquivos nas superfícies permitidas do manifesto | Diff dos 35 caminhos e manifesto validados por leitura; não rodei sc.py conferir, ausente da cópia. | lida |
| E3 atestado aprovado do head correto e portão por área | S1: `python3 revisao-saida/sonda-integridade.py`; status APROVADO, base/head e 31 hashes compatíveis. Execução histórica de 212 testes só documentada. | executada |
| E4 cinco delegações em sessão identificável | Manifesto/retorno atribuem cinco delegações à sessão 390eb5af-b5d6-4926-9a2e-a02e2f7b652c; logs não entregues. | não verificada |
| E5 conversa nova do executor | Manifesto/retorno lidos; próprio retorno informa alerta de duas ordens na mesma conversa. Sem logs para resolver. | não verificada |

### Matriz de cobertura

L1 motivo, L2 interface real, L3 estados, L4 escapes/padrões, L5 degradação, L6 concorrência/falhas, L7 fontes, L8 retorno. “Lida/P1” significa leitura com execução pendente por dependências ausentes; não é aprovação. A matriz completa registra as lacunas, mas a cobertura permanece parcial. No protocolo reduzido não há alteração de estações nem escrita de dados do painel; concorrência do carregador assíncrono não foi ensaiada.

| Critério | L1 motivo | L2 ponta a ponta | L3 estados | L4 escape | L5 entradas | L6 concorrência | L7 fontes | L8 retorno |
|---|---|---|---|---|---|---|---|---|
| C01 | S2 | n/a (artefato estático) | n/a (sem transição) | n/a (sem opção) | lida | n/a (artefato imutável) | S2 | S2 |
| C02 | lida | lida/P1 | lida/P1 | lida | lida/P1 | n/a (sem escrita persistente) | lida | lida/P1 |
| C03 | S2 | n/a (artefato estático) | n/a (sem transição) | n/a (sem opção) | lida | n/a (artefato imutável) | S2 | S2 |
| C04 | lida | lida/P1 | lida/P1 | lida | lida/P1 | n/a (sem escrita persistente) | lida | lida/P1 |
| C05 | lida | lida/P1 | lida/P1 | lida | lida/P1 | n/a (sem escrita persistente) | lida | lida/P1 |
| C06 | lida | lida/P1 | lida/P1 | lida | lida/P1 | n/a (sem escrita persistente) | lida | lida/P1 |
| C07 | lida | lida/P1 | lida/P1 | lida | lida/P1 | n/a (sem escrita persistente) | lida | lida/P1 |
| C08 | lida | lida/P1 | lida/P1 | lida | lida/P1 | n/a (sem escrita persistente) | lida | lida/P1 |
| C09 | S2 | n/a (artefato estático) | n/a (sem transição) | n/a (sem opção) | lida | n/a (artefato imutável) | S2 | S2 |
| C10 | lida | lida/P1 | lida/P1 | lida | lida/P1 | n/a (sem escrita persistente) | lida | lida/P1 |
| C11 | S1 | n/a (artefato estático) | n/a (sem transição) | n/a (sem opção) | lida | n/a (artefato imutável) | S1 | S1 |
| C12 | lida/P1 | lida/P1 | lida/P1 | lida | lida/P1 | lida/P1 | lida | lida/P1 |
| C13 | lida/P1 | lida/P1 | lida/P1 | lida | lida/P1 | lida/P1 | lida | lida/P1 |
| C14 | S5 | lida/P1 | S5 | lida | S5 | n/a (classificação sem escrita) | S5 | S5 |
| C15 | lida | lida/P1 | lida/P1 | lida | lida/P1 | n/a (sem escrita persistente) | lida | lida/P1 |
| C16 | S3 | lida/P1 | S3 | S3 | lida | n/a (função sem persistência) | S3 | S3 |
| C17 | S3 | lida/P1 | S3 | S3 | lida | n/a (função sem persistência) | S3 | S3 |
| C18 | S3 | lida/P1 | S3 | S3 | lida | n/a (função sem persistência) | S3 | S3 |
| C19 | S4 | lida/P1 | S4 | S4 | S4 | n/a (seleção local) | S4 | S4 |
| C20 | lida | lida/P1 | lida/P1 | lida | lida/P1 | n/a (sem escrita persistente) | lida | lida/P1 |
| C21 | lida | lida/P1 | lida/P1 | lida | lida/P1 | n/a (sem escrita persistente) | lida | lida/P1 |
| C22 | lida | lida/P1 | lida/P1 | lida | lida/P1 | n/a (sem escrita persistente) | lida | lida/P1 |
| C23 | lida | lida/P1 | lida/P1 | lida | lida/P1 | n/a (sem escrita persistente) | lida | lida/P1 |
| C24 | S6 | lida/P1 | n/a (texto fixo) | n/a (sem opção) | n/a (texto fixo) | n/a (sem escrita) | S6 | S6 |
| C25 | lida | lida/P1 | lida/P1 | lida | lida/P1 | n/a (sem escrita persistente) | lida | lida/P1 |
| C26 | S2 | n/a (artefato estático) | n/a (sem transição) | n/a (sem opção) | lida | n/a (artefato imutável) | S2 | S2 |
| C27 | S2 | n/a (artefato estático) | n/a (sem transição) | n/a (sem opção) | lida | n/a (artefato imutável) | S2 | S2 |
| C28 | S2 | n/a (artefato estático) | n/a (sem transição) | n/a (sem opção) | lida | n/a (artefato imutável) | S2 | S2 |
| C29 | lida | lida/P1 | lida/P1 | lida | lida/P1 | n/a (sem escrita persistente) | lida | lida/P1 |
| E1 | S1 | n/a (artefato estático) | n/a (sem transição) | n/a (sem opção) | lida | n/a (artefato imutável) | S1 | S1 |
| E2 | S2 | n/a (artefato estático) | n/a (sem transição) | n/a (sem opção) | lida | n/a (artefato imutável) | S2 | S2 |
| E3 | S1 | n/a (artefato estático) | n/a (sem transição) | n/a (sem opção) | lida | n/a (artefato imutável) | S1 | S1 |
| E4 | lida | n/a (log de processo) | lida | lida | lida | n/a (sem operação na cópia) | lida | lida/P1 |
| E5 | lida | n/a (log de processo) | lida | lida | lida | n/a (sem operação na cópia) | lida | lida/P1 |

### Achados

- [bloqueador] A1 · L1/L3/L5/L7 · Fonte desconhecida é promovida a “em dia”. Condição: exemplo oficial com pacote.fonte_versao=null e diagnóstico global desse campo (entrada-fonte-desconhecida.json), mantendo versões de instalações e núcleos conhecidas. S5 executa os predicados originais: versaoDesconhecida=false/defasadaOuSuja=false e nucleoNull=false/nucleoDefasado=false/temDiagnostico=false; os ramos JSX lidos mostram “em dia”. Regiões usa o mesmo fallback. Efeito: ausência da referência vira confirmação positiva de atualização; o mesmo projeto tem classificação impossível de justificar. Afeta C14/C15/C21 e D08, arquitetura §5.3. Evidência: `node revisao-saida/sonda-logica.mjs`, S5; HojePage.tsx:286–291, 328–332, 353–385; ProjetosPage.tsx:205–208, 255–263. Correção esperada: comparação sem fonte conhecida deve ficar desconhecida, com o diagnóstico; só declarar em dia com todas as informações necessárias. Execução é dos predicados, não do DOM.
- [relevante] A2 · L1/L4/L5/L7 · Diário de Campo recebe etapa inventada. Condição: selecionar o projeto fictício diario-campo, que tem etapas=[]. resolverEtapaPadrao retorna e1-inicial e a opção “sem etapas registradas” permite gerar/copy a ordem sociedade/ordens/e1-inicial.md. Efeito: uma ausência conhecida vira caminho de ordem que não existe no instantâneo, produzindo abertura incorreta no próprio exemplo de aceite. Afeta C14/C17/C19, D08 e escolha de projeto/etapa da arquitetura §5.3. Evidência: S4, `node revisao-saida/sonda-logica.mjs`; PergaminhoAbertura.tsx:27–29, 264 e 463–468. Correção esperada: indicar que nenhuma etapa foi coletada, sem fabricar ID e sem habilitar cópia até existir seleção válida.
- [relevante] A3 · L3/L4/L5/L8 · Cardápio vazio ainda produz mensagem copiável com modelo/esforço vazios. Condição: cardapio=[] ou ausente, permitido pelo contrato e usado pela fixture so_desconhecidos. S4 resulta em “Para: coordenador (Antigravity, , esforço )”, com plataforma padrão não obtida do cardápio. O botão Copiar não tem guarda/disabled. Efeito: a interface aparenta ter montado uma escala válida sem dados para ela. Afeta C14/C19 e D08; o teste de cardápio cobre somente a fixture completa. Evidência: S4, `node revisao-saida/sonda-logica.mjs`; PergaminhoAbertura.tsx:72–81, 86–90, 159–160, 463–468. Correção esperada: estado explícito de cardápio indisponível e cópia condicionada a escala completa proveniente do instantâneo.
- [relevante] A4 · L2/L4/L7/L8 · Subagentes não são filtrados por nível nem plataforma. Condição: abrir o Pergaminho padrão; a lista do seletor alta no Antigravity inclui Gemini 3.8 Flash, GPT-6-Luna e modelos Claude. Os três selects usam a mesma união de todo o cardápio. Efeito: permite uma escala incompatível com os níveis da plataforma selecionada, embora cada texto isolado exista em algum ponto do instantâneo. Afeta C19 e arquitetura §5.3/§6.2-B. Evidência: S4 executa a lista original; `node revisao-saida/sonda-logica.mjs`; PergaminhoAbertura.tsx:95–100, 386, 409, 432. Correção esperada: opções derivadas do par plataforma/nível correspondente, com revalidação das seleções quando o cardápio muda. A abertura e seleção pelo navegador permanecem pendentes.
- [relevante] A5 · L7/L8 · O teste de contrato estático confirma uma afirmação já forçada. Condição: exemploOficialJson é convertido por “as unknown as Painel1” antes de `const ex: Painel1 = exemploOficial`. Efeito: eventual incompatibilidade estrutural entre os tipos escritos à mão e o JSON deixa de ser detectada nessa prova, mesmo que os dois testes de runtime continuem verdes. Afeta C10, teste triplo F2(b). Evidência lida: cenarios.ts:7 e painelContrato.test.ts:65; não rodei tsc. Correção esperada: prova que preserve a estrutura inferida do exemplo e confira sua compatibilidade com Painel1 sem passar por unknown/assertion do tipo inteiro; não basta atribuir uma variável já declarada Painel1.
- [relevante] A6 · L1/L7/L8 · Texto fixo da casca não atinge contraste AA. Condição: título “Centro de Comando”, text-stone-500 (10 px), sobre aside stone-900/75 sobre stone-950. Cálculo sRGB dá 3.781:1, inferior a 4.5:1. O título não está marcado como controle desativado. Efeito: parte do texto da paleta obrigatória não passa no critério, embora os dez pares escolhidos pela suíte sejam aprováveis. Afeta C23/C24. Evidência: `python3 revisao-saida/sonda-contraste.py`, S6; PainelShell.tsx:174–175 e painelA11y.test.tsx:65–87. Correção esperada: cor com contraste suficiente e cobertura dos pares realmente usados. Cálculo por classes locais; CSS computado não executado.
- [relevante] A7 · L7/L8 · Entrega ultrapassa substancialmente o teto de produto. Condição: contar os 13 arquivos TS/TSX de produto modificados, sem testes, fixture, lockfile ou JSON de esquema. Total de 3281 linhas físicas; descontando as 98 linhas do analisador reaproveitado, 3183. Mesmo a contagem textual sem linhas vazias/comentários fica em 2880. Efeito: escopo/manutenção mais que dobram o teto aproximado de 1500 definido na ordem; não foi entregue justificativa ou autorização de mudança desse limite. Afeta C27 e parada de escopo. Evidência: `python3 revisao-saida/sonda-integridade.py`, S2; ordem validada:99, rpgTheme.tsx (608), ProjetosPage.tsx (638), PergaminhoAbertura.tsx (487). Correção esperada: adequar o tamanho do produto ao escopo aprovado ou obter decisão explícita do responsável pelo escopo antes de aceitar; não minimizar por excluir apenas comentários.

### Retorno contra evidências e divergências de governança

S1 confirmou 175/175 hashes do inventário e 31/31 hashes do atestado consolidado, head/base originais corretos e hash do perfil compatível com o portão. Ordem e perfil do snapshot são idênticos às cópias validadas. Entretanto o snapshot sociedade/ não contém os seis atestados F1–F5/consolidado, o manifesto de entregas nem o retorno; só foram entregues em REVISAO-GOVERNANCA. O registro original tem apenas o evento etapa_aberta para p2-leitura, não o encerramento alegado. Isso é uma divergência entre fonte congelada e governança complementar; foi preservada e não constitui, isoladamente, defeito de UI ou adulteração do atestado.

O atestado declara 212 testes/0 pulados/0 falhos e tipos/build aprovados; hashes compatíveis dão vínculo ao candidato, mas não reproduzem execução. O retorno declara seis Playwright aprovados; dimensões, hashes, existência das seis imagens e inspeção visual foram confirmados, a aprovação histórica do navegador não. Os testes e2e só verificam navegação, presença parcial de textos e screenshots; não copiam a mensagem nem exercitam importação/expansão/prompt no analisador. A11y valida pares selecionados de cores e atributos, sem medir todos os estilos computados. Portanto as alegações de fluxo completo/AA não foram demonstradas integralmente por essas provas.

As contagens de cinco fatias/delegações e a revisão interna de F3 constam do retorno e da governança. Não há logs originais no pacote para atestar sessões separadas. O próprio retorno registra E5 com alerta “2 ordens na mesma conversa”, atribuído a retomada após reinício; não confirmei essa explicação e não converti o aviso em cumprimento de conversa nova.

### O que não verifiquei

- Execução da interface pública real (L2), fluxo de copiar/colar no navegador, teclado/leitor de tela, todos os estados renderizados, layout/ausência de clipping ou rolagem horizontal e altura/funcionamento do XYFlow em 360/1280. As imagens foram apenas inspecionadas, sem interação ou recaptura.
- Vitest, validação Ajv, compilação de tipos/build e suíte Playwright: dependências ausentes. `npm test` foi tentado e falhou antes de qualquer teste; não usei npx para evitar busca de pacotes nem instalei ferramentas. Não há aprovação própria do portão nesta sessão.
- S3 roda o código original de funções após retirada de imports e tipos pelo stripTypeScriptTypes do Node 24; clipboard foi substituído por registrador. S4 roda apenas cálculos anteriores ao JSX com hooks mínimos, sem React e sem efeitos. S5 executa declarações/predicados originais e confronta seus resultados com os ramos JSX lidos. Nenhuma dessas sondas substitui L2 ou a suíte oficial.
- Concorrência/interrupção de carregar, rejeição de Promise, troca de cenário durante carregamento e erros de clipboard: não ensaiados. Não há gravação persistente do painel nem operação de publicação no escopo fictício, mas isso não prova robustez de toda API assíncrona.
- Compatibilidade estrutural estática do exemplo (A5), toda a matriz de valores degradados, duplicados/identidades divergentes, formatos legados e preservação sob falha: leitura sem execução integral. Inspecionei os pontos de entrada de validação e as fixtures; não declaro validação exaustiva.
- Não executei sc.py abertura/conferir/revisar nem registro posterior do parecer; esses scripts do pacote não foram entregues nesta cópia. O ouro usado é o bloco documental autorizado. Não auditei push/merge históricos, CI remoto, cadeia criptográfica interna do atestado, sessões de delegação ou logs do executor.
- Modelo/esforço e ID efetivos desta sessão não expostos. Leituras globais das três skills foram declaradas em Independência; isso impede alegar contenção absoluta de todas as leituras à cópia.

### Veredito e limite do parecer

**Parcial — recomendação: não aceitar.** A1 impede aceite por contrariar D08; A2–A7 também precisam de correção ou, onde cabível, decisão explícita de adiamento. Nenhuma correção foi feita pelo revisor. As lacunas de execução acima permanecem abertas e não autorizam considerar a revisão completa.

O protocolo permite o rótulo “parcial”, mas o lint local aceita apenas aceitar/aceitar com ressalvas/não aceitar. Por isso o cabeçalho usa “não aceitar” e registra separadamente cobertura parcial; não se trata de aprovação nem de alegação de que todas as lentes foram executadas. A validade deste parecer limita-se ao SHA original do cabeçalho.
