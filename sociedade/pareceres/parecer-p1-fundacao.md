## Resumo

Para: Círdan · De: Barbárvore · Etapa: p1-fundacao · Reconferência da correção 1

Situação: **aceitar com ressalvas** o delta do candidato `073f620d77234c5eaf61a19fec3fecac3e80249c`. F01 e F02 têm correção coerente por RPC transacional; F03 autentica antes da leitura e limita o stream; F04 e C01 correspondem ao escopo. Há uma ressalva opcional de F03: Content-Length decimal acima do inteiro seguro não é recusado antes da leitura, embora continue limitado e resulte em 413.

Feito: 162 hashes de inventário e 16 de atestado conferidos; dez sondas próprias, 13 unitários entregues verdes; os testes de regressão F01/F02/F03 falham no código anterior e os cenários passam no atual, com persistência/transporte simulados. O banco real não foi reexecutado. Atestado histórico aprovado corresponde aos artefatos.

Pendente: ressalvas de comprovação dinâmica (PostgreSQL/Deno/Ajv e Vitest real), fornecedor/modelo documentais e isolamento, detalhadas abaixo. Nenhum bloqueador demonstrado no delta; nenhum achado relevante novo. A prioridade de R01 é opcional porque não resta leitura ilimitada nem leitura por remetente não autenticado no fluxo de produção sondado.

Próximo passo: Círdan recebe este parecer e submete as ressalvas à decisão humana. Esta foi a única reconferência prevista; não abri outra correção, não registrei o parecer e não integrei/publicuei nada.

## Evidências

Comandos executados na raiz desta cópia; saída, sondas e cópias de teste somente em `revisao-saida/`. O preload bloqueia fetch/sockets e imports de pacotes externos. Os comandos de prova com exit 1 são intencionais ou têm causa ambiental explícita.

| ID | Comando próprio / artefato | Resultado e alcance |
|---|---|---|
| S00 | `python3 revisao-saida/conferir.py` → conferencia.log/json, numstat-etapa.txt, numstat-correcao.txt | Exit 0. 162/162 hashes de inventário, 16/16 de atestado; seis arquivos autorizados; base/head/status corretos; contagens reproduzidas. Hash não prova execução histórica. |
| S01–S07 | `node --import ./revisao-saida/bloquear-rede.mjs --experimental-vm-modules revisao-saida/sondas.mjs` → sondas.log, sondas-candidato.json | Exit 0, sete sondas. Núcleo e handler originais, com ambiente/imports npm/transporte simulados. |
| S08–S10 | `node --import ./revisao-saida/bloquear-rede.mjs --experimental-vm-modules revisao-saida/estrutura.mjs` → estrutura.log/json | Exit 0. Config Vitest executada com imports simulados; assertivas textuais do SQL; observação da borda de Content-Length. A variante inicial com execFileSync de Git falhou; extração passou a ser feita pelo shell, sem subprocesso no harness Node. |
| CL01 | `node --import ./revisao-saida/bloquear-rede.mjs revisao-saida/content-length.mjs` → content-length.log | Exit 1 esperado: assert de zero leitura recebe 327680 bytes para Content-Length 9007199254740992. |
| R-F01 | `node --import ./revisao-saida/bloquear-rede.mjs --experimental-vm-modules revisao-saida/sondas.mjs anterior F01` → regressao-F01.log, sondas-anterior-F01.json | Exit 1 esperado: [200,200], duas linhas. No candidato S04 recebe [200,429], uma linha, usando contrato atômico simulado. |
| R-F02 | Mesmo comando anterior, trocando F01 por F02 → regressao-F02.log | Exit 1 esperado: HTTP 500 com detalhe e uma linha persistida após falha no PATCH. S05 no candidato: HTTP 500 genérico, zero linhas, RPC simulada falha sem commit. |
| R-F03 | Mesmo comando anterior, trocando F01 por F03 → regressao-F03.log | Exit 1 esperado: 2097152 bytes consumidos antes da busca, tanto no 401 quanto no 413. S06 no candidato: zero bytes antes da busca, zero bytes no 401, 327680 bytes e cancelamento no 413. |
| T01 | `node --import ./revisao-saida/bloquear-rede.mjs --test-isolation=none --test supabase/functions/` → testes-diretorio.log | Exit 1: ERR_UNSUPPORTED_DIR_IMPORT. Variante sem isolamento não resolve o diretório; não é achado de produto. |
| T02 | `node --import ./revisao-saida/bloquear-rede.mjs --test supabase/functions/` → testes-portao.log | Exit 1: processo de teste reporta uma falha sem detalhe útil. Portão padrão não reproduzido nesta sandbox. |
| T03 | `node --import ./revisao-saida/bloquear-rede.mjs --test-isolation=none --test supabase/functions/ingest.test.mjs` → testes-explicitos.log | 17 testes: 13 passam, 4 falham em REDE_BLOQUEADA_PELA_REVISAO, zero pulados; exit 1. Testes unitários usam fallback estrutural, não Ajv real. |

S01 cobre JSON degradado, raiz null/array/escalar, extra, segredo, token ausente e validação antes do 429. S02 cobre limites exato/+1, tamanho em bytes, UTF-8 entre blocos, cabeçalho ausente/malformado/enganoso. S03 executa o handler/adaptador e confere GET de autenticação + um POST RPC, argumentos e respostas inválidas. S04 sincroniza duas leituras da máquina e compara o algoritmo anterior com o contrato atual. S05 injeta erro de persistência pelo adaptador. S06 usa Request/ReadableStream reais do Node, highWaterMark zero e contadores, com token válido/inválido. S07 injeta HTTP 503, JSON inválido em respostas do banco, interrupção de stream e métodos HTTP. S08 confere exclusão e preservação dos defaults com sentinela; não é execução do Vitest. S09 confere texto SQL e 27+28 asserções pgTAP; não é execução de SQL. S10 mede cabeçalhos decimais enormes.

Q86: `conferir.py` extraiu do Git reconstruído o módulo e handler anteriores para arquivos `anterior-*` em revisao-saida; os arquivos do candidato ficaram intactos. O teste de bloqueador R-F01 falha ao usar essas cópias anteriores, e S04 passa com o módulo novo. A comparação confirma o defeito anterior e a ligação nova ao contrato; o armazenamento novo é falso. **Não prova por execução própria a exclusão mútua ou o rollback no PostgreSQL.** Esses pontos têm inspeção de SQL e atestado histórico correspondente, somente.

## Parecer do Revisor Independente
- etapa: p1-fundacao
- entrega: candidato original 073f620d77234c5eaf61a19fec3fecac3e80249c; delta fechado desde 5adfa29d32a36991d3e17b758c4bac70a938fae3; cópia reconstruída d84645277aeb6e722e50d866b86265fe9c30ae60
- commit: 073f620d77234c5eaf61a19fec3fecac3e80249c
- base..head: 00970bcfce70319863acbec8403f5f67654e03d1..073f620d77234c5eaf61a19fec3fecac3e80249c
- revisor: Barbárvore · Codex · fornecedor: OpenAI · sessão: 01a16cb4-99e2-7ec3-8be6-d657f2030314
- modelo: GPT-6.1-Sol conforme escala solicitada; identidade efetiva não auditada por log externo · esforço: xhigh solicitado, não exposto por log nesta cópia
- independência: Nível A (fornecedor diferente dos implementadores declarados)
- veredito: aceitar com ressalvas
- protocolo: completo Q150 em escopo fechado Q85/Q86; oito lentes aplicadas, com limites de execução real discriminados
- data: 24/10/2026 03:10 -0400

### Independência

Não implementei nem corrigi nada desta entrega. A ordem e o retorno atribuem o candidato anterior a Google/Antigravity e esta correção a Anthropic/Claude Code, com decisão R3 `DEC-p1-fundacao-R3-correcao-1`. O fornecedor desta revisão é OpenAI/Codex, distinto dos dois; a plataforma do arquiteto é Claude Code. A independência é documental: não auditei logs de execução dos implementadores, da revisão interna nem de modelo/esforço. A decisão R3 é declarada pelo usuário e pelo retorno validado; a busca pelo ID no registro do snapshot não a encontrou, e não a inventei. Nenhum subagente foi usado nesta revisão.

Não consultei memórias, dados reais, credenciais ou o worktree da etapa. Não usei rede nem instalei ferramentas. Ressalva de isolamento documental: o ambiente exigiu a leitura de quatro arquivos de skill fora da cópia (núcleo, sc-papeis, sc-revisao e papel-barbarvore); método/protocolo/modelo da revisão foram lidos nas cópias locais. Além disso, antes de reconhecer a divergência de node_modules, `import.meta.resolve` e consultas de metadados seguiram o link externo; portanto não declaro isolamento absoluto de leituras. Nenhum código dessas dependências foi executado. Depois da descoberta, imports externos foram bloqueados nas sondas e na suíte. Todas as gravações desta sessão ficaram em revisao-saida/.

### Mapa da entrega

Motivo: a etapa original fornece banco, autenticação fechada e ingestão local segura do painel. A correção responde a F01 (corrida na janela), F02 (gravação parcial), F03 (corpo ilimitado antes da autenticação), F04 (volume declarado) e C01 do arquiteto (Vitest passa a exigir Supabase). Referências de aceite: ordem validada p1-fundacao, parecer anterior — Achados, subordem p1-fundacao-correcao-1 — Fatias e Retorno. A arquitetura 4.4 exige token → máquina → tamanho → JSON → schema → segredo → janela/persistência.

O escopo desta reconferência é exatamente o delta reconstruído `a547019d0bd29060993017e11214a6e89a12838e..d84645277aeb6e722e50d866b86265fe9c30ae60`: ingest.ts puro, handler index.ts, ingest.test.mjs, migração atômica nova, pgTAP 002 e vitest.config.ts. Não reabri a revisão das superfícies sem delta. A lista completa dos critérios aplicáveis desta correção é K01–K26 abaixo. Critérios originais de configuração/start/PKCE, tabelas/view/RLS existentes, scripts e seed permanecem os do parecer anterior, sem nova comprovação ou conclusão nesta reconferência. Os critérios originais afetados são C13–C19/C21 (ingestão/testes), C28 (escopo), C29 (volume) e E3 (atestado); C20 é preservado por hash e teste.

Superfícies:

- HTTP público POST /functions/v1/ingest: x-painel-token, Content-Length opcional e stream; OPTIONS 204, outros métodos 405. Config usa SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
- Biblioteca: processarIngest recebe tokenMaquina e lerCorpo preguiçoso; opções validarEsquema, repositorio e registrarErro opcional. lerCorpoLimitado aceita stream, limite padrão 262144 e Content-Length opcional. interpretarRespostaRegistrar adapta o retorno da RPC. O módulo deixa de receber relógio para arbitrar a janela.
- Persistência: buscarMaquinaPorTokenHash consulta a máquina; registrarEnvio faz POST /rest/v1/rpc/ingest_registrar. A função recebe p_maquina_id, p_coletado_em, p_corpo e p_bytes; retorna resultado/id/recebido_em. EXECUTE só para service_role, invoker e search_path vazio.
- Operação/testes: supabase db reset, supabase test db, node --test supabase/functions/ e npm test. Migrações/pgTAP são arquivos lidos pelo Supabase; teste Node lê schema oficial/compartilhado e exemplo fictício. A config Vitest exclui supabase/** além dos defaults.

Estados e transições: token ausente/inválido → 401 sem chamar leitor; máquina válida → leitura limitada (413) → parse (400) → schema/segredo (422) → RPC. No banco, janela livre → UPDATE condicional reserva → upsert → retenção → ok/200; janela ocupada → limite/429 sem escrita; erro SQL deve reverter tudo e produzir 500 genérico pelo handler. A reserva adquire o lock da linha da máquina; concorrentes esperam e a condição é reavaliada após a atualização concorrente. O SQL não captura a exceção: a atomicidade deriva da transação da chamada PostgREST. Essas semânticas foram inspecionadas, sem PostgreSQL próprio nesta sessão. Reenvio depois da janela atualiza a mesma identidade máquina/coleta; a retenção remove as excedentes. Entradas inválidas não alcançam a RPC.

Fontes e derivados: maquinas/instantaneos são fontes persistidas; ultimo_envio_em e linhas retidas passam a mudar na mesma transação. v_ultimo_instantaneo continua derivada e sem delta. Schema central é autoridade e cópia compartilhada continua byte a byte idêntica. Resposta HTTP deriva da RPC. Retorno/atestado são evidências históricas, não execução do revisor. O snapshot sociedade/ foi preservado: ordem, adendo e perfil coincidem com governança validada; manifesto, atestado, parecer anterior, retorno original, subordem e retorno da correção estão ausentes no snapshot e existem somente na governança validada. São seis ausências, não arquivos ocultados. Arquitetura ainda diz módulo testado no Vitest, enquanto a correção autorizada C01 usa node:test; essa documentação sem delta fica registrada como desatualizada, sem ampliar o escopo.

### Critérios e evidências

| Critério do aceite | Evidência | Estado |
|---|---|---|
| K01 — Migração aditiva; migração de 23/10 preservada | `python3 revisao-saida/conferir.py`: S00, diff e hashes; S09, texto SQL. | executada |
| K02 — Assinatura RPC, plpgsql, SECURITY INVOKER e search_path vazio | S09 confere texto e testes pgTAP; banco não executado. | lida |
| K03 — Reserva por UPDATE condicional único; uma janela por máquina | S04: concorrência com contrato atômico simulado; S09: UPDATE lido; atestado histórico corresponde. | lida |
| K04 — Upsert por máquina/coleta, dono obtido da máquina | S03 confere argumentos da RPC; S09 lê upsert e testes de dono/idempotência. | lida |
| K05 — Retenção de 20, ordem coletado_em/recebido_em DESC | S09 confere DELETE e pgTAP; execução PostgreSQL somente lida no atestado. | lida |
| K06 — Erro desfaz gravação, retenção e reserva da janela | S05: adaptador com RPC falhando; S09: função sem captura de erro e pgTAP de rollback lidos. | lida |
| K07 — EXECUTE somente service_role, revogado de PUBLIC/anon/authenticated | S09 confere grants e asserções de privilégios; roles reais não executadas. | lida |
| K08 — pgTAP: primeiro/segundo envio, fronteira da janela, retenção e rollback | S09 conta 27 asserções; retorno declara PASS em 55 ao incluir suíte anterior. | lida |
| K09 — 28 asserções anteriores de RLS preservadas | S00 confere hash/diff intactos; S09 confere plan(28); PASS histórico lido. | lida |
| K10 — Uma operação registrarEnvio e uma RPC substituem as quatro gravações | `node --import ./revisao-saida/bloquear-rede.mjs --experimental-vm-modules revisao-saida/sondas.mjs`: S03/S05, GET de autenticação seguido de um POST RPC. | executada |
| K11 — limite vira 429; módulo puro deixa de decidir janela por relógio | `node --import ./revisao-saida/bloquear-rede.mjs --experimental-vm-modules revisao-saida/sondas.mjs`: S01/S03/S04; diff remove relógio/janela do núcleo. | executada |
| K12 — Erro de banco responde 500 somente com erro_interno | `node --import ./revisao-saida/bloquear-rede.mjs --experimental-vm-modules revisao-saida/sondas.mjs`: S05/S07; T03 também passa no teste entregue. | executada |
| K13 — Token e máquina antes da leitura; token ausente/inválido lê zero bytes | `node --import ./revisao-saida/bloquear-rede.mjs --experimental-vm-modules revisao-saida/sondas.mjs`: S06; T03 cobre token ausente/vazio/inválido. | executada |
| K14 — Stream conta bytes e para acima de 262144, inclusive sem Content-Length | `node --import ./revisao-saida/bloquear-rede.mjs --experimental-vm-modules revisao-saida/sondas.mjs`: S02/S06: 2 MiB recusados após 5 blocos de 64 KiB, cancelamento confirmado. | executada |
| K15 — Content-Length acima do limite recusa antes de ler | `node --import ./revisao-saida/bloquear-rede.mjs revisao-saida/content-length.mjs`: falha esperada da sonda, 327680 bytes em vez de zero quando o decimal excede o inteiro seguro; S10. Ressalva R01. | executada |
| K16 — Leitura limitada no módulo puro, Web Streams, sem Deno/npm | S02/T03 executam núcleo em Node; imports e diff lidos; sem import npm/Deno no módulo. | lida |
| K17 — Unitários: falso ok/limite, sete códigos, zero leituras no 401 e limite no 413 | `node --import ./revisao-saida/bloquear-rede.mjs --test-isolation=none --test supabase/functions/ingest.test.mjs`: T03, 13 unitários passam; S01/S02 ampliam entradas. | executada |
| K18 — Integração real: extra 422, segredo 422, válido 200, paralelo 200/429 com uma linha; serviço ausente falha | T03: os quatro casos falham antes de qualquer rede, sem skip; implementação do teste e resultado verde histórico lidos. Execução real não refeita. | não verificada |
| K19 — Vitest exclui supabase/** preservando defaults; suíte ingest usa só node:test | `node --import ./revisao-saida/bloquear-rede.mjs --experimental-vm-modules revisao-saida/estrutura.mjs`: S08 executa config em VM com imports simulados; lê imports da suíte. | executada |
| K20 — npm test verde sem Supabase e sem ingest; node --test diretório inclui integração | Atestado e retorno registram app 140/banco 17. T01/T02 não reproduzem o portão; T03 executa arquivo explícito. Vitest real não usado por symlink externo. | não verificada |
| K21 — F04: contagem reproduzível da etapa inteira e da correção | `python3 revisao-saida/conferir.py`: S00 confirma produto +773, testes +1053; correção produto +224/−101, com filtros do retorno. | executada |
| K22 — Escopo fechado; nenhum arquivo proibido alterado | `python3 revisao-saida/conferir.py`: S00, exatamente seis arquivos autorizados; schema/package/lock/migração anterior intactos. | executada |
| K23 — Retorno: especialistas, revisão interna, atestado e antes/depois S04/S05/S08/S12 | Retorno validado lido; contém nomes, commits, decisão R3 e resultados. Não contém logs externos completos; decisão R3 não aparece no registro do snapshot. | lida |
| K24 — Candidato/base originais, inventário e atestado correspondentes | `python3 revisao-saida/conferir.py`: S00, 162/162 hashes e 16/16 artefatos; status/base/head conferidos. | executada |
| K25 — Teto aproximado: correção 500 linhas de produto, etapa 1500 | `python3 revisao-saida/conferir.py`: S00, +224 nesta correção e +773 na etapa; schema/seed/governança e testes conforme filtros documentados. | executada |
| K26 — Q86: teste de F01 falha ao desfazer a correção na cópia | `node --import ./revisao-saida/bloquear-rede.mjs --experimental-vm-modules revisao-saida/sondas.mjs anterior F01`: exit 1, dois 200 e duas linhas; S04 passa no candidato com RPC simulada. | executada |

### Matriz de cobertura

Cada célula identifica execução acima, leitura explícita ou inaplicabilidade pelo escopo/superfície. “Lida” e “textual” não significam SQL, Ajv, Vitest ou serviço real executado. Indisponibilidade ambiental aparece como limitação, nunca como n/a. As oito lentes têm sondas próprias no delta; a cobertura dinâmica de banco e app permanece limitada.

| Critério | L1 motivo | L2 ponta a ponta | L3 estados | L4 escape | L5 entradas | L6 concorrência/falha | L7 fontes | L8 retorno |
|---|---|---|---|---|---|---|---|---|
| K01 | S00 | n/a (diff estático) | n/a (snapshot congelado) | S00 | S00 | n/a (diff estático) | S00 | S00 |
| K02 | S09 textual | lida SQL/atestado | lida pgTAP | S09 textual | lida pgTAP | lida SQL | S09 textual | lida retorno |
| K03 | S04/S09 | S03; lida atestado | S04 contrato | lida SQL | S01/S07 | S04 simulado; lida SQL | S09 textual | lida atestado |
| K04 | S03/S09 | S03 simulado | lida pgTAP | S03 argumentos | S01/S03 | lida SQL | S03/S09 | T03; lida retorno |
| K05 | S09 textual | lida pgTAP/atestado | lida pgTAP | lida SQL | lida SQL | lida SQL | S09 textual | lida retorno |
| K06 | S05/S09 | S05 simulado | S05; lida pgTAP | lida SQL | S07 | S05 simulado; lida SQL | S05/S09 | lida retorno |
| K07 | S09 textual | lida pgTAP | lida pgTAP | S09 textual | lida pgTAP | n/a (grants fixos) | S09 textual | lida atestado |
| K08 | S09 textual | lida atestado | lida pgTAP | lida pgTAP | lida pgTAP | lida SQL | S09 textual | S09; lida retorno |
| K09 | S00/S09 | lida atestado | lida pgTAP anterior | n/a (sem delta) | S00 | n/a (sem delta) | S00 | S09; lida retorno |
| K10 | S03/S05 | S03 simulado | S04 contrato | S03 | S03/S07 | S04/S05 simulados | S03/S05 | T03; lida retorno |
| K11 | S01/S04 | S03 simulado | S01/S04 | S01 | S01 | S04 simulado | S03 | T03; lida retorno |
| K12 | S05/S07 | S05/S07 simulados | S05 | S07 | S03/S07 | S05/S07 falhas simuladas | S05/S07 | T03 |
| K13 | S06 | S06 HTTP em VM | S06 | T03 | S06/T03 | S06 | S06 | T03 |
| K14 | S02/S06 | S06 HTTP em VM | S02 | S02 | S02/S06 | S07 leitura interrompida | S02/S06 | T03 |
| K15 | S02/S10 | S06 HTTP em VM | S02 | S10 | S10/CL01 | S10 consumo limitado | CL01 | T03/S10 |
| K16 | S02/T03 | S06 HTTP em VM | n/a (fronteira de módulo) | lida imports | S02 | S07 | S00; lida imports | T03 |
| K17 | T03/S01 | S03/S06 simulados | S01/S04 | S01/S02 | S01/S02 | S04/S07 simulados | S03/T03 | T03/S08 |
| K18 | T03; lida teste | T03: rede bloqueada | lida teste | T03: sem skip | T03: indisponibilidade | lida paralelo; S04 simulado | lida atestado | T03; lida retorno |
| K19 | S08 | S08 config em VM | n/a (config estática) | S08 defaults | S08 imports | n/a (config estática) | S08/S00 | S08; lida retorno |
| K20 | lida atestado | T01/T02/T03; lida npm | n/a (execução de suíte) | T03 sem skip | T01/T02 ambientais | lida atestado | S00/S08 | T03; lida retorno |
| K21 | S00 | n/a (contagem Git) | n/a (contagem Git) | S00 filtros | S00 | n/a (snapshot) | S00 | S00 |
| K22 | S00 | n/a (diff estático) | n/a (snapshot) | S00 | S00 | n/a (snapshot) | S00 | S00 |
| K23 | lida retorno | lida retorno | n/a (registro histórico) | lida R3 | lida snapshot divergente | n/a (registro histórico) | S00; lida registro | lida retorno |
| K24 | S00 | n/a (artefatos estáticos) | n/a (snapshot) | S00 | S00 | n/a (snapshot) | S00 | S00 |
| K25 | S00 | n/a (contagem Git) | n/a (contagem Git) | S00 filtros | S00 | n/a (snapshot) | S00 | S00 |
| K26 | R-F01/S04 | S03 simulado | R-F01/S04 | S00 snapshots | R-F01 | R-F01/S04 simulado | S00/S09 textual | R-F01/S04 |

### Disposição dos achados anteriores

| Achado | Resultado desta reconferência |
|---|---|
| F01 bloqueador | Defeito anterior reproduzido e teste falha ao desfazer a correção. Janela sai do módulo e fica no UPDATE condicional transacional. Nenhum bypass demonstrado no código novo; prova própria de corrida do banco indisponível, atestado correspondente lido. |
| F02 relevante | Quatro gravações separadas removidas; uma RPC. Handler novo mantém 500 genérico. Rollback é coerente no SQL e coberto por teste pgTAP lido, com resultado histórico lido. Não simulei PostgreSQL como se fosse prova real. |
| F03 relevante | Autenticação precede leitura e o stream é limitado/cancelado; regressão anterior reproduzida. Permanece a borda opcional R01 do Content-Length enorme, sem retorno da falha de segurança original. |
| F04 opcional | Corrigido: filtros reproduzem +773 produto, +1053 testes na etapa e +224/−101 produto na correção. “test no caminho” inclui vitest.config.ts; categoria está explícita. |
| C01 do arquiteto | Config e executor Node conferidos. O sucesso real de npm test sem Supabase permanece evidência histórica; não foi reexecutado pela restrição de leitura. |

### Achados

- [opcional] **R01 — F03/K15, L4/L5/L8: Content-Length decimal acima do inteiro seguro não é recusado antes da leitura.** Condição: `lerCorpoLimitado(stream, 262144, '9007199254740992')`; o teste usa a função original, sem modificar seu parser. Em supabase/functions/_shared/ingest.ts:96–100, Number.isSafeInteger converte o valor em ausência de cabeçalho, desviando do teste antecipado de tamanho em :112–115. Efeito: 327680 bytes lidos em cinco blocos de 65536, em vez dos zero exigidos pela subordem; ainda responde 413 e cancela, e a autenticação já ocorreu. Evidência: CL01/content-length.log e S10/estrutura.json; `node --import ./revisao-saida/bloquear-rede.mjs revisao-saida/content-length.mjs` termina 1 no assert de zero bytes; com Content-Length '262145', S10 mede zero. Correção esperada: reconhecer decimal válido acima do limite independentemente da precisão de Number, mantendo tamanho inválido sujeito à contagem; cobrir o decimal enorme. Severidade opcional: recusa, autenticação e limite por stream permanecem eficazes; o resíduo é leitura antecipável limitada, sem reproduzir a pressão de memória ilimitada de F03. Não é novo bloqueador nem ampliação de escopo. Nenhuma correção aplicada.

### O que não verifiquei

- Não executei PostgreSQL, pgTAP, supabase start/db reset/test db, roles reais, locks ou rollback real. Docker foi informado indisponível; psql, postgres e Deno não estão no PATH. Atestado do candidato é APROVADO, com 16 hashes corretos e áreas app/banco verdes; resultados e histórico são lidos. A saída do banco no atestado contém apenas o resumo Node. As 55 asserções pgTAP verdes são uma alegação do retorno, não log bruto próprio. As 157 contadas pelo portão são 140 app +17 Node; não incluem 55 pgTAP, como o retorno reconhece.
- Não executei Ajv real, runtime Deno/gateway ou integração Supabase. Nas sondas do handler, substituí apenas imports npm/ambiente/transporte; o validador é fallback estrutural extraído da suíte entregue. Os quatro testes de integração falharam com rede explicitamente bloqueada, zero skips. S04/S05 usam persistência falsa e não validam locks/atomicidade do banco por si sós. Não executei perda real de conexão entre commit e resposta; 500 por falha de transporte não garante ausência de commit remoto.
- Não executei npm test, tsc ou build. node_modules é um link para /home/odival/Documentos/Projetos/code_palandir/node_modules, contrariando a descrição de hardlinks locais; consumi somente a inspeção inicial de resolução/metadados antes de identificá-lo. Não removi nem recriei o link. Executar suas dependências ampliaria a leitura para fora desta cópia. S08 é execução da config com dependências simuladas, não prova de 140 testes nem da coleta real do Vitest. Os testes app/build/tipos seguem sustentados pelo atestado histórico correspondente.
- Não auditei a sessão dos implementadores, as delegações, a revisão interna ou a decisão R3 no registro atualizado; os logs e o registro atualizado não foram entregues. A independência de fornecedor e a execução por Anthropic nesta correção vêm da ordem do usuário, perfil e retorno. A identidade efetiva de modelo/esforço do revisor também não é verificável por log externo nesta cópia.
- Não refiz critérios sem delta da revisão anterior: configuração, PKCE/login real, seed, CLIs, RLS/view anteriores e coexistência com containers de outro projeto. As limitações anteriores nessas superfícies continuam anteriores; este parecer não as transforma em comprovação. Não consultei nem alterei containers, worktree da etapa ou dados reais.
- O isolamento documental tem as exceções de skills e resolução/metadados de dependências descritas em Independência. Não houve rede, instalação, memória, correção de produto, integração, publicação ou registro do parecer. A aceitação com ressalvas vale somente para este SHA e este delta, com R01 opcional e limites de evidência explícitos; a decisão humana posterior permanece necessária conforme a governança.
