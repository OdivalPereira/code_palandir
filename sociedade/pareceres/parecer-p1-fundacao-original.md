## Resumo

Para: Círdan · De: Barbárvore · Etapa: p1-fundacao

Situação: **não aceitar** o candidato 5adfa29d32a36991d3e17b758c4bac70a938fae3. F01 confirma que duas requisições simultâneas da mesma máquina recebem 200 e gravam dois instantâneos dentro da mesma janela. F02 confirma gravação parcial com resposta 500 e retenção/janela inconsistentes. F03 confirma consumo integral do corpo antes da autenticação e do limite de 256 KiB. F04 corrige a contagem declarada no retorno.

Feito: conferência de 157 hashes do inventário e dos 13 artefatos do atestado; 12 sondas offline; nove testes unitários entregues passaram; CLIs reais executadas com fetch simulado. Nenhum arquivo do candidato foi alterado. Sem rede, instalação, dados reais, integração, publicação ou registro do parecer.

Pendente: corrigir os achados e executar o fluxo Supabase/Ajv/pgTAP/PKCE em ambiente habilitado. O teste de integração foi executado com rede explicitamente bloqueada: falhou, sem skip. Há limitações de isolamento e de comprovação dos logs, declaradas abaixo.

Próximo passo: Círdan encaminha o parecer e as correções ao responsável; a decisão e eventual registro são operações posteriores. Não implementei correções.

## Evidências

Todos os caminhos abaixo estão nesta cópia. Os comandos foram executados na raiz da revisão.

| ID | Execução própria / arquivo | Resultado e alcance |
|---|---|---|
| S00 | `python3 revisao-saida/conferir.py` → `conferencia.json` e `conferencia.log` | Código 0. Hashes, diff, config e assertivas textuais; **não** executa SQL ou login. |
| S01–S12 | `node --experimental-vm-modules revisao-saida/sondas.mjs` → `sondas.log`, `sondas-resultados.json` | Código 0; 12 sondas completadas. Os asserts dos achados confirmam a presença do defeito, não sua correção. |
| T00 | `node --import ./revisao-saida/bloquear-rede.mjs --test supabase/functions/` → `testes-entregues.log` | Código 1, um processo de teste falhou sem detalhamento útil. O harness também encontrou `spawnSync ... EPERM`; processo filho indisponível. |
| T00b | `node --import ./revisao-saida/bloquear-rede.mjs --test-isolation=none --test supabase/functions/` → `testes-sem-isolamento.log` | Código 1, ERR_UNSUPPORTED_DIR_IMPORT nesse modo. Não classificado como defeito do candidato. |
| T01 | `node --import ./revisao-saida/bloquear-rede.mjs --test-isolation=none --test supabase/functions/ingest.test.mjs` → `testes-explicitos.log` | 10 testes, 9 passaram, 1 falhou, 0 pulados; código 1. A integração falhou em REDE_BLOQUEADA_PELA_REVISAO. |
| T02 | `node --import ./revisao-saida/cli-preload.mjs scripts/nova-maquina.mjs maquina-revisao-exemplo` e `node --import ./revisao-saida/cli-preload.mjs scripts/enviar-exemplo.mjs` → `cli-nova.log`, `cli-enviar.log` | Ambos código 0, transporte interceptado, sem sockets. Hash e emissão única conferidos; token sintético omitido do log final. |

O núcleo TypeScript original é importado diretamente nas sondas. S07/S08/S12 carregam o `index.ts` original com remoção de tipos, capturam `Deno.serve` e substituem apenas ambiente, transporte e imports npm. O validador dessas sondas é o fallback estrutural extraído do teste entregue; **não é Ajv real**. S09/S10 também executam os arquivos originais das CLIs em VM com argv/env e fetch controlados; T02 os executa como programas Node. Não se substituiu o algoritmo de autenticação, rate limit, gravação, retenção ou leitura de corpo do candidato.

S01: fluxo legítimo, token ausente/vazio/inválido, JSON ausente/corrompido, raiz escalar/array/null, schema legado e campos extras; S02: limite 59999/60000 ms, relógio anterior e token revogado; S03: repetição, atualização e retenção sequencial; S04: dois leitores sincronizados do mesmo estado; S05: falhas após upsert em listagem/remoção/atualização; S06: segredos em quatro posições, bytes UTF-8 e fronteira de tamanho; S07: handler HTTP e adaptação PostgREST, métodos/configuração; S08: PATCH de máquina falha com 503 após persistir; S09: CLIs legítimas, persistência de hash e saída de erro; S10: URL/ambiente/argumento ausente; S11: validação precede 429 mesmo com janela ativa; S12: stream de 2 MiB integralmente consumido antes da autenticação, com token válido e inválido.

Diagnóstico ambiental: Docker respondeu `permission denied while trying to connect to the docker API at unix:///var/run/docker.sock`; Node é v24.20.0; Deno, psql, tsc e rg não estão disponíveis; node_modules local ausente. Nenhuma ferramenta foi instalada. Após a falha com processo filho e a falha de importação de diretório sem isolamento, a terceira variante da suíte usou o arquivo explícito, com sucesso dos nove unitários. O harness passou a VM em vez de subprocessos. As tentativas iniciais ficaram preservadas em `sondas-primeira-tentativa.log`. Não houve tentativa de elevar permissões.

## Parecer do Revisor Independente
- etapa: p1-fundacao
- entrega: candidato original congelado 5adfa29d32a36991d3e17b758c4bac70a938fae3; cópia reconstruída c04da71327918f4cd636a189b8333726edd294ad
- commit: 5adfa29d32a36991d3e17b758c4bac70a938fae3
- base..head: 00970bcfce70319863acbec8403f5f67654e03d1..5adfa29d32a36991d3e17b758c4bac70a938fae3
- revisor: Barbárvore · Codex · fornecedor: OpenAI · sessão: 01a16c8e-7da3-7023-b875-d5b3a78616f0
- modelo: GPT-6.1-Sol (escala solicitada; identidade efetiva não conferida por log externo) · esforço: xhigh (solicitado; não exposto por log nesta cópia)
- independência: Nível A (fornecedor diferente dos implementadores declarados)
- veredito: não aceitar
- protocolo: completo; oito lentes com sondas próprias; cobertura dinâmica parcial nas superfícies que dependem de Supabase/Deno/PostgreSQL
- data: 24/10/2026 02:25 -0400

### Independência

Não implementei nem corrigi nada desta entrega. Perfil e retorno validados atribuem a implementação e a revisão interna a Google/Gemini (Elrond, Aragorn e Galadriel), com coordenação de Gandalf; esta sessão de revisão usa Codex/OpenAI. Essa distinção é documental: não auditei logs de modelo/fornecedor da implementação, ausentes na cópia. Não deleguei a revisão a subagentes.

Sessão identificada por CODEX_SESSION_ID/CODEX_THREAD_ID, ambos 01a16c8e-7da3-7023-b875-d5b3a78616f0. Não consultei memórias nem sessões anteriores. Ressalva de isolamento: ao abrir a tarefa, carreguei uma vez `/home/odival/.agents/skills/sociedade-do-codigo/SKILL.md`, fora desta cópia, seguindo o carregamento de skill exigido pelo ambiente antes de consolidar a restrição da ordem. É uma leitura externa documental e não devo declarar isolamento documental absoluto. O método de revisão e o protocolo foram lidos nas cópias locais METODO-REVISAO.md e PROTOCOLO-REVISAO.md. Não houve outra consulta documental externa, rede ou acesso ao worktree da etapa.

### Mapa da entrega

Motivo da etapa: dar ao painel uma fundação local de banco, autenticação fechada e recebimento seguro de metadados. Referências: ordem validada, Objetivo e Fatias F1–F5; sociedade/arquitetura-painel.md, seções 2 e 4; docs/arquitetura.md, seções 2, 3, 4 e 9. O cenário percebido pelo usuário é start → reset → enviar-exemplo → HTTP 200 e linha em instantaneos; entradas inválidas retornam 401/422 sem gravação; pgTAP prova isolamento do dono.

Os critérios completos são C01–C29, E1–E5 e A1 nas tabelas abaixo. A governança validada é a autoridade de aceite. O snapshot sociedade/ foi preservado e comparado; seus documentos não foram tratados como instruções para mudar o escopo da revisão.

Superfícies de entrada:

- Supabase CLI: start, db reset e test db; configuração, migração, seed e suíte SQL. Entradas dependem de Docker e do runtime local.
- HTTP: POST /functions/v1/ingest; cabeçalho x-painel-token; corpo UTF-8 com limite declarado de 262144 bytes; OPTIONS retorna 204 e demais métodos 405. Não exige JWT do usuário: autentica a máquina por SHA-256.
- Biblioteca: processarIngest(requisicao, {validarEsquema, repositorio}); calcularSha256Hex e varrerSegredos. Corpo, token e relógio são parâmetros; agora assume new Date(); token é trimado. O campo metodo não é aplicado pelo núcleo, mas o handler HTTP impõe POST.
- Repositório injetado: buscarMaquinaPorTokenHash, upsertInstantaneo, listarInstantaneosDaMaquina, removerInstantaneos e atualizarUltimoEnvio; o adaptador usa requisições PostgREST separadas com service_role.
- nova-maquina: apelido posicional, --url; SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e PAINEL_DONO_ID. Padrão da URL http://127.0.0.1:55321; se dono não é fornecido busca dono@exemplo.test, senão o primeiro usuário retornado. Gera 32 bytes aleatórios; usa upsert por dono/apelido, portanto repetir apelido substitui o hash e revoga o token anterior. Credencial service_role de demonstração é o fallback local, não uma chave real.
- enviar-exemplo: --url, --token, --maquina; SUPABASE_URL, PAINEL_TOKEN e PAINEL_MAQUINA. Lê o exemplo versionado, troca coletado_em pela hora atual, permite trocar o apelido do payload; token padrão é o de teste do seed. Imprime status/corpo e sai 1 em resposta diferente de 200. Flags desconhecidas são ignoradas; valores vazios recaem nos defaults por `||`.
- Auth: e-mail, link mágico previsto, signup desabilitado, redirecionamento local, JWT de 3600 s e refresh rotativo. O complemento remete cliente/sessão PKCE real à p4; a p1 não fornece uma interface de login navegável.

Estados e transições:

- Banco vazio → migração/seed → dono, máquina e instantâneo de exemplo. Migração cria somente três tabelas, uma view e um índice específico de instantâneos.
- Usuário anônimo não lê/escreve as tabelas; authenticated lê somente os próprios dados e só escreve cotas próprias. Somente a administração cria máquinas e a ingest escreve instantâneos. O service_role não depende da RLS; o núcleo copia dono e maquina_id da linha encontrada pelo hash, não do corpo enviado.
- Máquina sem envio recente → validações → upsert → retenção → atualização da janela → 200. Token inválido → 401; bytes excessivos → 413; JSON inválido → 400; schema/segredo → 422; janela ativa → 429. Estados recusados não devem gravar. Reenvio da mesma coleta substitui a linha; nova coleta cria outra; retenção remove as excedentes. O estado intermediário após upsert não é transacional (F02), e dois leitores podem usar simultaneamente uma janela antiga (F01).
- Token armazenado só como hash; recriar o mesmo dono/apelido troca a credencial. Cotas permitem normal, baixa, esgotada e janela por decisão do dono; esta etapa não exige terminalidade nem transições irreversíveis nessas classificações.

Fontes de verdade e derivados: auth.users/auth.identities para a identidade; maquinas para dono/token_hash/ultimo_envio_em; instantaneos para o corpo bruto e sua identidade por máquina/coleta; cotas para a declaração humana. A view deriva o último instantâneo de cada máquina. O schema oficial é sociedade/central/painel-1.schema.json; o compartilhado é uma cópia. O seed é massa fictícia inicial. Inventário, retorno e atestado são evidências históricas, não resultados desta execução.

Não há opção de force, skip, dry-run ou reprocessamento nesta entrega. Os escapes examinados foram service_role no adaptador, verify_jwt=false, validadores injetados, aliases/defaults de CLI, troca de token por apelido e repetição de coleta. A injeção de dependências não é exposta na interface HTTP; nela o validador é compilado no index.

### Proveniência e divergências de governança

S00 confirma 157/157 hashes do inventário e 13/13 hashes dos artefatos do atestado, base/head originais corretos. Os objetos Git desta cópia são reconstruídos: base 8a8ae36cf0b373e957e329972d8551d31361954f e candidato c04da71327918f4cd636a189b8333726edd294ad. Executei o diff desses objetos, sem apresentar os SHAs reconstruídos como o commit original revisado. Não existe CI do projeto segundo a arquitetura; o atestado local é a prova histórica disponível.

Ordem, adendo 1 e perfil em sociedade/ são idênticos às cópias validadas. Manifesto de entregas, atestado e retorno existem somente sob REVISAO-GOVERNANCA/ e estão ausentes no snapshot sociedade/. Não os copiei para dentro do candidato. sociedade/estado.md permanece o resumo gerado em 07/10, com referências anteriores à p1; não o tomei por prova de conclusão atual. Há ainda referência antiga a 54321 nos riscos da arquitetura, superada pelo adendo validado que fixa 55321.

O diff tem 18 caminhos; o atestado inspeciona os 13 de produto, e os outros cinco são de governança. A alegação de volume no retorno diverge: 1242 declaradas contra **1304** linhas adicionadas calculadas com os mesmos filtros, incluindo testes (F04). O retorno lista 28 asserções pgTAP e 10 testes Node; o atestado registra 160 em app e 10 no totalizador de banco, sem incorporar as 28 asserções pgTAP nessa soma. Portanto 170 é o total declarado pelo portão, não a soma de todas as asserções de todos os comandos. Não recomputei a suíte app.

### Critérios e evidências

| Critério do aceite | Evidência | Estado |
|---|---|---|
| C01 — F1 — Supabase inicia sem erro, project_id code_palandir e portas 553xx, coexistindo com o outro projeto | Configuração conferida por `python3 revisao-saida/conferir.py` (S00); start/coexistência não executados: Docker inacessível. | não verificada |
| C02 — F1 — Auth por e-mail, cadastro fechado, JWT 3600 s e rotação de refresh | S00 confere os valores de supabase/config.toml:48–79; comportamento do GoTrue não executado. | lida |
| C03 — F1 — Link mágico com PKCE | sociedade/arquitetura-painel.md:66 e docs/arquitetura.md:20: PKCE é fluxo de cliente; o complemento coloca a sessão real em p4. Não há cliente PKCE nesta p1 nem execução de login. | não verificada |
| C04 — F1 — site_url e redirects http://localhost:5174 | S00 confere supabase/config.toml:50–51. | lida |
| C05 — F1 — ingest com verify_jwt=false | S00 confere supabase/config.toml:92–93; S07/S08 exercitam o handler com token de máquina, sem gateway real. | lida |
| C06 — F1 — supabase db reset passa | Comando não executado: sem acesso ao daemon Docker; seed e migração apenas inspecionados. | não verificada |
| C07 — F2 — Só maquinas, instantaneos e cotas, com dono NOT NULL DEFAULT auth.uid() REFERENCES auth.users | S00 faz assertivas textuais sobre a migração:9–43; não executa SQL. | lida |
| C08 — F2 — View DISTINCT ON, ordem coletado/recebido DESC, security_invoker e nenhuma view normalizada | Migração:45–58 e testes pgTAP:4–31 lidos; estrutura parcialmente conferida por S00, sem execução SQL. | lida |
| C09 — F2 — Índice maquina_id, coletado_em DESC, recebido_em DESC | S00 confere o texto da migração:31–32; índice não criado neste ambiente. | lida |
| C10 — F2 — Comentário de migração aditiva para tarefas, acoes, eventos e perguntas | Migração:3–7 lida; nenhuma tabela da fase B foi introduzida. | lida |
| C11 — F2 — RLS: anon nada; dono SELECT em maquinas/instantaneos; cotas CRUD só do dono | Migração:60–127 e pgTAP:128–284 lidos. Grants e USING/WITH CHECK correspondem ao desenho; não há prova dinâmica de autorização nesta revisão. | lida |
| C12 — F2 — pgTAP verde: anon, outro usuário, dono, escrita bloqueada e view sob RLS | S00 conta 28 assertivas e plan(28); atestado/retorno alegam PASS. Não executei supabase test db. | não verificada |
| C13 — F3 — Fluxo e sete respostas: 200, 400, 401, 413, 422 esquema, 422 segredo, 429 | `node --experimental-vm-modules revisao-saida/sondas.mjs`: S01/S06/S07/S11/S12 e nove testes unitários entregues; Ajv/serviços reais não exercitados. F01 e F03 expõem variações defeituosas. | executada |
| C14 — F3 — Um envio por minuto, conferido e atualizado só depois de tamanho/JSON/esquema/segredos | `node --experimental-vm-modules revisao-saida/sondas.mjs`: S02/S11 confirmam ordem e fronteira; S04 confirma dois 200 simultâneos; S05/S08 confirmam janela não atualizada após gravação parcial. Critério violado (F01/F02). | executada |
| C15 — F3 — 422 de segredo só com erro/caminho/regra, sem eco do valor | `node --import ./revisao-saida/bloquear-rede.mjs --test-isolation=none --test supabase/functions/ingest.test.mjs`: teste dos 12 padrões passou; S06 cobre quatro posições aninhadas e ausência de gravação. | executada |
| C16 — F3 — Upsert idempotente por máquina e coletado_em | `node --experimental-vm-modules revisao-saida/sondas.mjs`: S03 confirma mesmo ID e substituição do corpo; S07 confere on_conflict no adaptador. Persistência PostgreSQL não exercitada. | executada |
| C17 — F3 — Retenção dos 20 mais recentes por máquina | `node --experimental-vm-modules revisao-saida/sondas.mjs`: S03 e teste entregue passam no caminho sequencial; S05 deixa 21 linhas quando a remoção falha (F02). Sem transação PostgreSQL executada. | executada |
| C18 — F3 — Imports npm Ajv/formats só no index; módulo puro e validador injetado | S00 e leitura dos imports do index:1–12 e interfaces do núcleo:19–24; execução do núcleo em Node sem Deno nas sondas S01–S06. | lida |
| C19 — F3 — node --test supabase/functions/ roda sem alterar package.json e cobre respostas, retenção e idempotência | `node --import ./revisao-saida/bloquear-rede.mjs --test supabase/functions/` terminou 1; execução explícita sem isolamento executou 10 testes: 9 passaram, 1 falhou por rede bloqueada, 0 pulados. S00 confirma package.json/package-lock intactos. Portão padrão não reproduzido. | executada |
| C20 — F3 — Schema compartilhado idêntico byte a byte e por SHA-256 ao oficial | `python3 revisao-saida/conferir.py` (S00) e teste entregue passaram; SHA-256 fdf345d7dbfd654e8cd64f2f432b500ae02a5de2004af553148a63c4e7d56a2c. | executada |
| C21 — F3 — Integração real Ajv/Supabase: válido 200, extra 422, segredo 422; indisponibilidade falha sem pular | Teste:309–360 lido. Execução explícita com fetch bloqueado falhou em REDE_BLOQUEADA_PELA_REVISAO, sem skip. Os três resultados contra Ajv/Deno/Postgres reais não foram verificados. | não verificada |
| C22 — F4 — nova-maquina gera 32 bytes, grava só SHA-256 e imprime token uma vez | `node --import ./revisao-saida/cli-preload.mjs scripts/nova-maquina.mjs maquina-revisao-exemplo` e S09: token de 64 hex, hash confere, token ausente das requisições de persistência; transporte fictício. | executada |
| C23 — F4 — enviar-exemplo posta exemplo com new Date().toISOString() e mostra código | `node --import ./revisao-saida/cli-preload.mjs scripts/enviar-exemplo.mjs` e S09: corpo igual exceto hora, HTTP 200; S09 também verifica saída 1 em HTTP 401 simulado. | executada |
| C24 — F4/adendo — Scripts recusam URL não local, padrões locais na porta 55321 | `node --experimental-vm-modules revisao-saida/sondas.mjs`: S10 confere aliases permitidos, host remoto, subdomínio, userinfo enganoso, formato inválido, IPv6 fora da lista e variável de ambiente; nenhuma chamada nas recusas. | executada |
| C25 — F5 — db reset cria dono@exemplo.test, notebook-exemplo e instantâneo igual ao exemplo | S00 extrai e compara os dois literais JSON do seed, ambos iguais ao exemplo; dono/máquina lidos no seed:4–112. SQL/reset não executados. | lida |
| C26 — F5 — Hash de token de TESTE, ultimo_envio_em fixo em 2026-10-23T15:00:00Z e primeiro envio 200 | S00 confere hash e literais; S02 cobre a janela com relógio fictício. O primeiro envio contra seed realmente aplicado não foi verificado. | lida |
| C27 — F5/D07 — Nenhum dado real | Seed/exemplo lidos: e-mails .test e identidades fictícias; dados das sondas são sintéticos. Não houve acesso a dados de usuário nem uso de arquivos de credenciais. | lida |
| C28 — Paradas — Escopo permitido; sem alterar package.json/package-lock/src/server nem schema oficial | `python3 revisao-saida/conferir.py`: S00 confere diff reconstruído e todos os hashes; alterações só em .gitignore, scripts/, supabase/ e sociedade/. Sem dependências instaladas nesta revisão. | executada |
| C29 — Paradas — Cerca de 1500 linhas, excluídos schema e seed | `python3 revisao-saida/conferir.py`: S00 soma 1304 linhas adicionadas fora schema/seed/governança, incluindo testes; retorno afirma 1242 (F04). Ambos abaixo do teto. | executada |
| E1 — Entregável — Commit candidato existe | `git log -2 --format=...` e S00: cópia reconstruída c04da713 corresponde ao original 5adfa29 pelo inventário, sem objeto original nesta cópia. | executada |
| E2 — Entregável — Arquivos nos prefixos permitidos | `python3 revisao-saida/conferir.py`: S00, 18 caminhos no diff, nenhum fora dos prefixos da ordem. | executada |
| E3 — Entregável — Atestado aprovado para base/head corretos | `python3 revisao-saida/conferir.py`: S00, status APROVADO lido, base/head corretos e 13 hashes conferidos; resultados históricos não reexecutados integralmente. | executada |
| E4 — Entregável — Cinco delegações identificadas no Antigravity | Manifesto/retorno validados declaram a sessão f531266e-18b3-44ba-99a0-2dbc37e7129a e cinco fatias. Logs de delegação não entregues na cópia; não consultei sessões externas. | não verificada |
| E5 — Entregável — Conversa nova da implementação | Retorno validado relata objeção do conferidor e a explicação do coordenador sobre duas entradas USER_INPUT. Sem log da implementação, não é possível confirmar ou rejeitar essa explicação. | não verificada |
| A1 — Adendo — Não parar/alterar containers de outro projeto | Nenhum comando de mutação Docker/Supabase executado por mim. Configuração lida não contém rotinas de parada; ações históricas da implementação não auditáveis sem logs. | não verificada |

### Matriz de cobertura

Cada ID Sxx/Txx corresponde a execução definida em Evidências. “lida” não prova execução do comportamento. “n/a” traz o motivo; indisponibilidade ambiental é registrada como pendência de execução, nunca como inaplicabilidade. O preenchimento da matriz não transforma as integrações pendentes em critérios atendidos.

| Critério | L1 motivo | L2 ponta a ponta | L3 estados | L4 escape | L5 entradas | L6 concorrência | L7 fontes | L8 retorno |
|---|---|---|---|---|---|---|---|---|
| C01 | lida S00 | lida config; start pendente | lida config | lida config | lida config | lida config; coexistência pendente | S00 | lida retorno |
| C02 | lida S00 | lida config; GoTrue pendente | lida config | lida config | lida config | lida config | S00 | lida retorno |
| C03 | lida arquitetura | lida; login pendente | lida; sessão pendente | lida; fluxo cliente pendente | lida; link inválido pendente | lida; rotação pendente | lida arquitetura/complemento | lida; sem teste de login |
| C04 | lida S00 | lida config | n/a (valor estático) | lida config | lida config | n/a (valor estático) | S00 | lida retorno |
| C05 | S07 | S07 (handler simulado) | S07 | S07 | S07 | S08 | S00/S07 | lida retorno |
| C06 | lida migração/seed | lida; reset pendente | lida SQL | n/a (sem opções próprias) | lida SQL | lida; reset interrompido pendente | S00 (textual) | lida atestado |
| C07 | lida S00 | lida SQL | lida SQL | lida SQL/grants | lida constraints | lida constraints | S00 (textual) | lida pgTAP |
| C08 | lida SQL | lida pgTAP | lida ORDER BY | lida security_invoker | lida DISTINCT ON | lida SQL; execução pendente | S00 (textual) | lida pgTAP |
| C09 | lida S00 | lida SQL | n/a (índice estático) | n/a (sem exceções) | n/a (DDL estático) | lida; plano/carga pendentes | S00 (textual) | lida pgTAP |
| C10 | lida comentário | n/a (documentação SQL) | n/a (documentação SQL) | n/a (documentação SQL) | n/a (documentação SQL) | n/a (documentação SQL) | lida arquitetura | lida retorno |
| C11 | lida RLS/grants | lida; banco pendente | lida USING/WITH CHECK | lida roles/grants | lida constraints/roles | lida; banco pendente | lida SQL/pgTAP | lida 28 assertivas |
| C12 | lida pgTAP | lida; execução pendente | lida pgTAP | lida roles | lida pgTAP | lida; banco pendente | S00 (contagem) | lida atestado/retorno |
| C13 | S01/S06 | S07 (HTTP simulado) | S02/S04 | S07/S11 | S01/S06/S12 | S04/S05/S08/S12 | S03/S07/S08 | T01 (9 unitários) |
| C14 | S01/S11 | S07 (HTTP simulado) | S02/S04 | S11 | S01/S11 | S04/S05/S08 | S05/S08 | T01/S04 |
| C15 | S06 | S07 (HTTP simulado) | S11 | S11 | S06/T01 | S06 (sem escrita) | S06 | T01 (12 padrões) |
| C16 | S03 | S07 (HTTP simulado) | S03 | S03 | S01 | S04/S05 | S03/S07 | T01 |
| C17 | S03 | S07 (HTTP simulado) | S03 | S03 | S01 | S05 | S03/S05 | T01 |
| C18 | S01 | S07 (imports simulados) | n/a (fronteira de módulos) | lida imports | lida imports | n/a (fronteira de módulos) | S00/lida imports | T01 |
| C19 | T01 | T00/T01 | S02/S03 | T01 (sem skip) | T01 (rede bloqueada) | T00 (falha ambiental) | S00/T01 | T01 |
| C20 | S00/T01 | T01 | n/a (comparação estática) | n/a (sem bypass configurável) | S00 (hashes) | n/a (arquivos congelados) | S00/T01 | T01 |
| C21 | lida teste | lida; serviço real pendente | lida teste | T01 (falha sem skip) | T01 (serviço indisponível) | lida; serviço real pendente | lida atestado | T01/lida retorno |
| C22 | S09 | T02/S09 (transporte simulado) | S09 | S10 | S10 | lida; gravação real pendente | S09 (hash/body/stdout) | S09 |
| C23 | S09 | T02/S09 (transporte simulado) | S09 | S10 | S09/S10 | lida; rede/queda real pendentes | S09 | S09 |
| C24 | S10 | S10 (CLI em VM) | S10 | S10 | S10 | n/a (validação local síncrona) | S10 | S10 |
| C25 | lida seed/S00 | lida; reset pendente | lida ON CONFLICT | lida defaults | S00 (JSON) | lida; reset interrompido pendente | S00 (JSON) | lida retorno |
| C26 | S02/lida seed | lida; reset/envio pendentes | S02 | lida seed | S00 (hash) | lida; banco pendente | S00/lida seed | lida retorno |
| C27 | lida seed/exemplo | S09 (dados sintéticos) | n/a (classificação documental) | lida fixtures | S06 (segredos sintéticos) | n/a (proveniência documental) | S00/lida seed | lida retorno |
| C28 | S00 | n/a (critério de diff) | S00 | S00 | S00 | n/a (snapshot congelado) | S00 | S00 |
| C29 | S00 | n/a (contagem estática) | n/a (contagem estática) | n/a (contagem estática) | S00 | n/a (snapshot congelado) | S00 | S00 (1304 vs 1242) |
| E1 | S00 | n/a (objeto Git local) | n/a (cópia congelada) | lida mapeamento original | S00 (hashes) | n/a (snapshot congelado) | S00 | S00 |
| E2 | S00 | n/a (diff local) | n/a (cópia congelada) | S00 | S00 | n/a (snapshot congelado) | S00 | S00 |
| E3 | S00 | lida; portão histórico | n/a (atestado histórico) | S00 (base/head) | S00 (hashes) | n/a (atestado congelado) | S00 | S00/T01 |
| E4 | lida manifesto | lida; logs ausentes | lida retorno | n/a (metadado de sessão) | lida manifesto | n/a (metadado histórico) | lida manifesto/retorno | lida; não comprovado |
| E5 | lida manifesto | lida; log ausente | lida retorno | n/a (metadado de sessão) | lida retorno | n/a (metadado histórico) | lida manifesto/retorno | lida; não comprovado |
| A1 | lida adendo | lida; histórico indisponível | lida adendo | lida adendo | n/a (proibição operacional) | lida; coexistência pendente | S00/lida adendo | lida retorno |

### Achados

- [bloqueador] **F01 — L1/L3/L6/L8: limite de um envio por minuto contornável por concorrência.** Condição: dois pedidos válidos da mesma máquina leem ultimo_envio_em antes de qualquer atualização. Efeito: ambos recebem 200 e persistem duas coletas na mesma janela. Critérios C13/C14, fluxo 4.4 da arquitetura e F3 da ordem. Local: supabase/functions/_shared/ingest.ts:100–101, 130–134, 141–162; adaptador com GET e PATCH separados em supabase/functions/ingest/index.ts:30–35, 66–72. Reprodução: `node --experimental-vm-modules revisao-saida/sondas.mjs`, S04, sincroniza duas leituras e observa statuses [200,200], linhas=2, mesmo agora; não há lock/compare-and-set no adaptador. Correção esperada: depois das validações, arbitrar a janela atomicamente por máquina no armazenamento, de modo que somente um pedido prossiga e o outro receba 429; cobrir a corrida com teste do repositório real. Nenhuma correção aplicada.
- [relevante] **F02 — L3/L6/L7: gravação parcial deixa instantâneo publicado sem atualizar a janela, inclusive excedendo a retenção.** Condição: falha em listar, apagar excedentes ou atualizar maquina após upsert já concluído. Efeito: handler responde 500, mas a linha já existe; falha no DELETE deixa 21 instantâneos e a máquina continua sem ultimo_envio_em atualizado, aceitando outro pedido na mesma janela. Critérios C14/C16/C17 e estado consistente do fluxo 4.4. Local: supabase/functions/_shared/ingest.ts:141–162; supabase/functions/ingest/index.ts:37–72, 95–97. Reprodução: mesmo comando, S05 injeta falha em cada uma das três operações; S08 executa o handler e o adaptador originais com PATCH retornando 503, obtendo HTTP 500, linhas=1, ultimo_envio_em=null. Correção esperada: garantir consistência da persistência, retenção e atualização da janela diante de falha parcial, com transação ou mecanismo equivalente comprovado; testar rollback/recuperação e resposta coerente ao cliente. O adiamento exige justificativa e acordo humano conforme o método.
- [relevante] **F03 — L1/L4/L5/L6: leitura do corpo é ilimitada e ocorre antes da autenticação.** Condição: POST com stream maior que o limite ou sem token válido. Efeito: req.text() consome e materializa o corpo inteiro antes de buscar a máquina ou retornar 413/401; o limite de 256 KiB não limita essa alocação, permitindo pressão de memória por remetente não autenticado. Critérios C13, ordem do fluxo 4.4 passos 1–3 e limite de tamanho de F3. Local: supabase/functions/ingest/index.ts:89–93, antes de supabase/functions/_shared/ingest.ts:97–106. Reprodução: mesmo comando, S12 envia stream sintético de 2097152 bytes; todos os 32 blocos são consumidos antes da busca do token, tanto no caso 413 quanto no caso 401. A sonda é offline e usa o Request/ReadableStream reais do Node com o handler original. Correção esperada: autenticar antes da leitura integral e impor contagem de bytes durante a leitura do stream, interrompendo acima de 262144, inclusive sem Content-Length confiável; testar corpo chunked e remetente inválido.
- [opcional] **F04 — L7/L8: volume de linhas declarado no retorno não corresponde ao candidato.** Condição: comparar a alegação “1242 linhas adicionadas fora o JSON do esquema e o seed, incluindo todos os testes” com o diff reconstruído. Efeito: evidência quantitativa imprecisa; não excede o teto aproximado de 1500. Critério C29 e lente L8 de contagens declaradas. Local: REVISAO-GOVERNANCA/sociedade/subordens/p1-fundacao-retorno.md, item “Volume total”. Reprodução: `python3 revisao-saida/conferir.py`, S00 → diff.adicoes_fora_schema_seed_governanca=1304, diferença de 62; numstat completo em conferencia.json. Correção esperada: atualizar a contagem ou explicitar outro filtro reproduzível no retorno posterior, preservando a proveniência da governança entregue.

### O que não verifiquei

- Não executei supabase start/db reset/test db, migração/seed, pgTAP, consultas com roles reais nem a view no PostgreSQL: daemon Docker negado, sem psql/Deno e sem rede por ordem. As leituras e assertivas textuais não substituem esses testes. Também não exerci falhas reais de conexão, transações ou locks do banco.
- Não executei Ajv real nem o runtime Deno/gateway. O teste entregue de integração foi executado com fetch bloqueado e falhou antes de contatar o serviço, sem pular. S07/S08/S12 são testes do código original com dependências simuladas; seus 200/422 não são prova do aceite de integração real C21.
- Não completei o fluxo real start → reset → enviar-exemplo → consulta da linha, nem login por link mágico/PKCE, renovação/expiração da sessão e recusa de signup pelo GoTrue. A documentação coloca o cliente real na p4, mas a exigência PKCE da ordem permanece sem comprovação dinâmica nesta revisão.
- Não executei npm test, tsc ou build: dependências locais ausentes e instalação proibida sem autorização. O atestado histórico corresponde aos hashes, e src/server/package files não mudaram. Os 160 testes app, o build e os tipos são resultados lidos, não meus.
- Não auditei os logs externos das cinco delegações, da revisão interna ou da conversa nova da implementação; E4/E5 e a identidade efetiva dos modelos continuam não comprovados nesta cópia. O retorno validado relata uma objeção do conferidor em E5; não a ocultei nem a resolvi por suposição.
- Não confirmei por execução histórica que a implementação preservou containers do outro projeto. Nesta revisão não houve mutação do Docker nem leitura do outro worktree. Coexistência de portas foi verificada apenas por configuração.
- O isolamento documental estrito tem a ressalva da leitura inicial da skill de núcleo fora desta cópia, registrada em Independência. Nenhuma memória ou dado real foi consultado. O restante da inspeção documental permaneceu na cópia; todos os artefatos de saída foram escritos apenas em revisao-saida/.
- Não fiz correção nem reconferência e não registrei este parecer no sistema da Sociedade. A aceitação não está autorizada por esta revisão: F01 reproduz um bloqueador independentemente das provas ambientais pendentes. O conteúdo observado vale apenas para o SHA original indicado no cabeçalho.
