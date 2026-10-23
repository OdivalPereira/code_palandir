# Arquitetura do painel — Code Palandir (proposta do Círdan, 23/10/2026)

O Argon complementa este texto em `docs/arquitetura.md` (seção 8 aqui). Onde os dois divergirem, vale o que Odival decidir no fecho das ordens.

## 1. Objetivo
O Code Palandir passa a ser o painel da Sociedade do Código: Odival abre na web (versão principal) ou no celular e vê, em todos os projetos, o que espera por ele, em que estação está cada etapa, quem passou o bastão para quem, e copia a mensagem de abertura pronta para o próximo agente. A análise visual de código continua como uma das telas.

**Origem:** Q178, Q188 e Q190, e Q202 a Q208 do pacote (entrevista de 23/10, registrada em `sociedade_do_codigo/sociedade/planejamento-4-0.md`, seção 9).

## 2. Princípios
Estão no perfil como D06 a D10. Em resumo:
- **D06, contrato único:** só entra no painel o que cabe no `painel/1`.
- **D07, só metadados:** no desenvolvimento, só dado fictício.
- **D08, desconhecido não é vazio.**
- **D09, dono único:** login em tudo, RLS de dono, token por máquina guardado como hash.
- **D10, nada estimado.**

## 3. Visão geral

```
máquina de Odival                         nuvem (fase B)                    navegador / celular
┌──────────────────────┐   POST painel/1   ┌──────────────────────────┐      ┌─────────────────────┐
│ sc.py painel coletar │ ────────────────▶ │ Edge Function `ingest`   │      │ Code Palandir (SPA) │
│ (pacote, etapa D)    │  x-painel-token   │  token → hash → máquina  │      │  casca + rotas      │
└──────────────────────┘                   │  Ajv painel/1, tamanho,  │      │  Hoje · Projetos ·  │
                                           │  segredos, 1/min         │      │  Analisador · ...   │
   fase A: `enviar-exemplo`                │  grava `instantaneos`    │      │  Fonte ─┬ Fixture   │
   manda o exemplo fictício                └────────────┬─────────────┘      │         └ Supabase  │
                                                        ▼                    └──────────▲──────────┘
                                           ┌──────────────────────────┐   supabase-js   │
                                           │ Postgres + RLS de dono   │ ────────────────┘
                                           │ views do último retrato  │  (sessão do link mágico)
                                           └──────────────────────────┘
```

**Na fase A**, tudo roda local:
- o Supabase sobe pelo Docker (`supabase start`);
- o app lê o exemplo fictício pela `FonteFixture`.

A ligação do app com o Supabase (login real e `FonteSupabase`) e a publicação ficam para a fase B.

## 4. Fundação (etapa p1-fundacao)

### 4.1 Tabelas (schema `public`)
| Tabela | Colunas principais | Quem escreve |
|---|---|---|
| `maquinas` | `id uuid`, `dono uuid → auth.users`, `apelido text único por dono`, `token_hash text` (SHA-256 hex), `criado_em`, `ultimo_envio_em` | script `nova-maquina` (service role) |
| `instantaneos` | `id`, `maquina_id`, `dono` (copiado da máquina), `coletado_em timestamptz`, `recebido_em`, `esquema text = 'painel/1'`, `corpo jsonb`, `bytes int`; único em (`maquina_id`, `coletado_em`) | só a `ingest` (service role) |
| `cotas` | `id`, `dono`, `plataforma`, `estado` (`normal`, `baixa`, `esgotada`, `janela`), `ate timestamptz null`, `nota text`, `atualizado_em` | Odival, pelo app (fase B) |

- **Retenção:** guardar os 20 últimos instantâneos por máquina, apagados pela própria `ingest` depois de gravar.
- **Leitura:** a view `v_ultimo_instantaneo` traz o último por máquina, com `security_invoker = true`. As views derivadas, como `v_projetos` e `v_pendencias`, ficam a critério do complemento: o `painel/1` ainda é rascunho e congela na etapa B do pacote, e normalizar antes disso gera migração à toa.

### 4.2 RLS
- RLS ligada em todas as tabelas.
- `maquinas` e `instantaneos`: `select` só se `dono = auth.uid()`; `authenticated` não tem `insert`, `update` nem `delete`.
- `cotas`: as quatro operações só para o dono.
- `anon`: nada.
- Testes pgTAP em `supabase/tests/` cobrem:
  - anônimo negado;
  - outro usuário negado;
  - dono lê;
  - `authenticated` não insere em `instantaneos`;
  - a view respeita a RLS.

### 4.3 Auth
- Link mágico por e-mail com PKCE.
- `enable_signup = false`.
- O dono é criado pelo seed (local, `dono@exemplo.test`) ou convidado pelo painel do Supabase (nuvem, fase B).
- `site_url` e `additional_redirect_urls` com `http://localhost:5174` na fase A.

### 4.4 Edge Function `ingest`
- `POST /functions/v1/ingest`, `verify_jwt = false` (a identidade é o token da máquina).
- **Fluxo:**
  1. Lê `x-painel-token`.
  2. Calcula o SHA-256 e acha a máquina; sem máquina, responde 401.
  3. Recusa corpo acima de 256 KB (413).
  4. Faz o parse do JSON (400) e valida com Ajv 2020 contra a cópia do `painel/1`; falha dá 422, com até 10 erros resumidos.
  5. Varre os segredos: os padrões do `redactSecrets` (`src/features/prompt/usePromptGenerator.ts`) aplicados a todas as strings; achou, responde 422 e não grava.
  6. Limita a 1 envio por minuto por máquina (429).
  7. Faz `upsert` em (`maquina_id`, `coletado_em`), aplica a retenção, atualiza `ultimo_envio_em` e responde 200 com `{id, recebido_em}`.
- **Organização:** a lógica fica num módulo puro (`supabase/functions/_shared/ingest.ts`, sem Deno nem rede), testado no Vitest. O `index.ts` só liga o módulo ao `Deno.serve` e ao cliente Supabase.
- **Contrato:** a cópia do esquema usada pela função fica em `supabase/functions/_shared/painel-1.schema.json`; um teste confere que ela é igual, byte a byte, a `sociedade/central/painel-1.schema.json`.

### 4.5 Scripts locais (`scripts/`)
- `nova-maquina <apelido>`:
  - gera um token aleatório de 32 bytes;
  - grava só o hash;
  - imprime o token uma vez;
  - na fase A, só fala com o Supabase local.
- `enviar-exemplo`: posta `sociedade/central/painel-1.exemplo.json` (com o `coletado_em` trocado pela hora atual) na `ingest` local e mostra o código de resposta. É a fumaça da fundação.
- Seed (`supabase/seed.sql`):
  - dono fictício `dono@exemplo.test`;
  - máquina `notebook-exemplo`, com o hash de um token fixo de teste documentado só no seed;
  - um instantâneo igual ao exemplo.

## 5. App (etapa p2-leitura)

### 5.1 Casca e rotas
- **A web é a versão principal, e o celular tem de ficar muito bem feito (Q217):**
  - o desenho parte da tela larga (1280 px ou mais), com lateral a partir de `md`;
  - em 360 px, tudo funciona sem perda (Q169), com barra inferior e toque de 44 px;
  - as capturas saem nas duas larguras.
- **Rotas:**
  - `/` Hoje;
  - `/projetos` e `/projetos/:id`;
  - `/analisador`, com o app atual inteiro, sem mudar o comportamento.
- As rotas `/etapas/:projeto/:etapa`, `/evolucao` e `/cotas` ficam reservadas para a fase B.
- O router é dependência nova (aprovação de Odival na ordem). O `src/__tests__/selfImport.test.ts`, que analisa o próprio `src` e hoje espera uma rota e uma página, precisa ser atualizado com justificativa no retorno.
- **Login na fase A:** a casca já tem o guarda de rota, mas com a `FonteFixture` ele deixa passar com o aviso "dados de exemplo". O login real entra com a `FonteSupabase` (fase B).

### 5.2 Dados no front
- Uma interface `Fonte` com `carregar(): Promise<Resultado<Painel1>>`, nos estados carregando, vazio, erro, parcial e sucesso (D05).
  - `FonteFixture` lê `sociedade/central/painel-1.exemplo.json` e cenários extras em `src/painel/fixtures/`: vazio, só desconhecidos, limites de tamanho e inválido.
  - `FonteSupabase` lê `v_ultimo_instantaneo` (fase B).
- Validação Ajv na carga. Instantâneo inválido vira estado de erro com a lista de erros, e nunca renderiza pela metade.
- Os tipos TypeScript saem do esquema, gerados ou escritos à mão (decisão do complemento), e um teste confere que o exemplo passa.
- O `painelStore` (Zustand) é independente do `graphStore` e do `projectStore`.

### 5.3 Tela Hoje
- **"Espera por você":** as `pendencias` de todos os projetos, agrupadas por tipo, com o projeto e a etapa. A ordem é `aprovar_ordem`, `decidir`, `revisao_devida`, `passagem_a_levar`, `troca_vencendo`, `divergencia`, `versao_defasada` e `outro`.
- **"Desconhecido":** os projetos com `diagnosticos`, cada um com o campo e o motivo (D08). Projeto sem pendências e com diagnóstico **nunca** aparece como "em dia".
- **Versões:** a `fonte_versao` contra as `instalacoes` e o `nucleo` de cada projeto, com destaque para o que está defasado.
- **"Montar mensagem de abertura"** (Q188):
  - Odival escolhe o projeto, a etapa e o papel;
  - escolhe também a plataforma, o modelo e o esforço, pelo `cardapio` do instantâneo e filtrados pelo nível;
  - e escolhe os subagentes por nível.
  - O texto gerado tem as cinco linhas do `sc.py abertura` (pacote, `sc_interacao.py`, `cmd_abertura`).
  - O botão copia com o `src/services/clipboard.ts`.
  - O texto passa pelo `redactSecrets` antes de ir para a área de transferência.
- **Teste-ouro** (entradas fictícias; saída gerada pelo `sc.py abertura` do pacote 3.4.0 em 23/10):

```
Para: coordenador (Antigravity, Gemini 3.8 Flash, esforço medium) · Etapa: e3-carrinho · CONVERSA NOVA
Worktree: ~/.sociedade/trabalho/loja-exemplo/e3-carrinho
Escala: papel=coordenador, plataforma=Antigravity, modelo=Gemini 3.8 Flash, esforço=medium, subagentes: alta=Gemini 4 Argon,moderada=Gemini 3.8 Flash,simples=Gemini 3.8 Flash
Assumir: sc.py assumir coordenador --etapa e3-carrinho --plataforma "Antigravity" --modelo "Gemini 3.8 Flash" --esforco "medium" --subagentes "alta=Gemini 4 Argon,moderada=Gemini 3.8 Flash,simples=Gemini 3.8 Flash"
Ação: leia a ordem da etapa (sociedade/ordens/e3-carrinho.md).
```

  - Entradas: projeto `loja-exemplo`, etapa `e3-carrinho`, papel `coordenador`, Antigravity, Gemini 3.8 Flash, medium, subagentes `alta=Gemini 4 Argon,moderada=Gemini 3.8 Flash,simples=Gemini 3.8 Flash`.
  - A linha `Worktree:` usa `~/.sociedade/trabalho/<id do projeto>/<etapa>`, como o script. Mostrar a pasta daquela ferramenta (Q188) fica como pergunta do complemento; a mudança, se houver, vai também para o pacote, para os dois continuarem iguais.

### 5.4 Tela Projetos
- **Lista:** nome, núcleo (com "desconhecido" quando `null`), estação da etapa mais recente e o número de pendências.
- **Detalhe:**
  - pastas por ferramenta: tipo, caminho, ramo, SHA curto, limpa ou suja ou desconhecida;
  - etapas com as seis estações: pedido, ordem, execução, conferência, revisão e decisão, mais encerrada e desconhecida;
  - ocupantes recentes (`interacoes`): papel, plataforma, modelo e esforço, aviso quando `modelo_no_log` diverge ou é `null`;
  - passagens "de → para", com o bloco recolhido.

### 5.5 Reaproveitado do Code Palandir
- Kit `src/ui` (Badge, Button, Card, Dialog, Input), tema slate/indigo e `cn`.
- `ErrorBoundary`.
- `redactSecrets` e `createSafeMarkdownFence` (`usePromptGenerator.ts`).
- `clipboard.ts`.
- Na fase B, o `GraphCanvas` com dagre para desenhar a etapa como grafo (papéis como nós, passagens como arestas).

### 5.6 Identidade visual: RPG da Terra-média (pedido de Odival, Q215)
- **Clima:** um RPG que lembra a Terra-média, com mapa e pergaminho, tons de noite e ouro velho, ornamentos discretos e ícones de papel. O desenho é próprio, sem copiar arte nem fonte oficial (uso pessoal, Q49).
- **Metáforas que orientam as telas:**
  - **Projetos** são regiões do mapa;
  - **a etapa é uma jornada**, e as seis estações são os marcos do caminho;
  - **a passagem é uma mensagem** levada pelo Gwaihir;
  - **Hoje** é o conselho: o que espera a decisão de Odival.
- **A leitura vem primeiro (D05):**
  - fonte decorativa só em títulos, e corpo em fonte legível;
  - contraste AA nos dois temas;
  - nada de informação só na cor ou só no ornamento;
  - em 360 px, o ornamento encolhe antes do conteúdo.
- **O analisador** entra na moldura da casca, e o interior dele continua como está na fase A.

### 5.7 Cartas dos agentes (tela "Sociedade")
- **Uma carta por papel**, nos papéis do perfil mais o Gwaihir:
  - nome e título (por exemplo, "Círdan, o Armador · Arquiteto");
  - ilustração ou ícone;
  - ocupante atual (plataforma, fornecedor, modelo e esforço) e estado (ativo, reserva ou espera);
  - **poderes:** o que o papel faz, tirado da definição do papel (`sc-papeis`);
  - **forças e fraquezas:** texto curado por Odival e pela experiência das etapas, como "o Flash é rápido, mas deixa escapar casos de borda";
  - **atributos medidos:** etapas em que atuou, aceites de primeira, achados bloqueadores (revisor), passagens feitas. Só números medidos no registro (D10); sem dado, aparece "desconhecido" (D08).
- **Verso da carta:** histórico de ocupantes (Q176: ocupante por interação) e as últimas interações.
- **Fonte:** os textos ficam num arquivo da governança (`sociedade/central/cartas.json`, a propor no complemento), e os atributos medidos pedem um campo novo no contrato (proposta ao `painel/1`). Na fase A, os atributos ficam como "desconhecido".

## 6. Riscos herdados (levantados em 23/10)
- **CSP duplicada:** está no `vercel.json` e num `<meta>` do `index.html`, e as duas precisam de `https://*.supabase.co` no `connect-src` quando o app ligar ao Supabase (fase B). Na fase A, o local usa `http://127.0.0.1:54321`.
- **`polyfills.ts`:** troca `window.process` e `global`; conferir que o supabase-js e o Ajv não se confundem.
- **`@google/genai: "latest"`:** a versão não é fixa e só é usada pelo `server/`.
- **`server/`:** é órfão, porque o front não o chama e ele não roda na Vercel. Fica intocado na fase A; o destino é decisão da fase B.
- **`tsc -b` com `noUnusedLocals`:** pega sobra em código novo.
- **`selfImport.test.ts`:** sensível a rotas e páginas novas.
- **CI:** não existe; o portão local é a prova até haver CI.

## 7. Fora do escopo da fase A
- Publicação (projeto Supabase na nuvem, Vercel, domínio), login real no app, `FonteSupabase`, escrita de cotas.
- Ações que voltam aos projetos, telas Etapa, Evolução e Cotas.
- Coletor real (pacote, etapa D).
- Qualquer mudança no `server/` e no analisador além de movê-lo para uma rota.

## 8. Pontos para o complemento do Argon
Responda cada um em `docs/arquitetura.md`, com a escolha e o motivo em até 5 linhas. Pergunte a Odival só o que for decisão dele.
1. **Router:** qual, e como mover o analisador para `/analisador` sem mudar o comportamento, incluindo o que fazer com o `selfImport.test.ts`.
2. **Sessão do Supabase:** onde guardar. O app evita `localStorage` para segredos, e o padrão do supabase-js é `localStorage`. Considere o uso no celular: link mágico a cada sessão cansa.
3. **Modelo de dados:** bruto mais views (seção 4.1) ou normalizar já. Inclua retenção e idempotência.
4. **Ajv na Edge Function** (Deno, `npm:` ou bundle) e a forma de testar a `ingest` só com Vitest mais a fumaça local.
5. **Tipos do `painel/1`:** gerados (qual ferramenta, dependência de desenvolvimento) ou à mão, e como conferir.
6. **Desenho das telas Hoje e Projetos em 360 px:** pode usar o Stitch com os dados do exemplo fictício. Inclua uma captura ou descrição por tela.
7. **Linha `Worktree:`** da mensagem: manter igual ao script ou mostrar a pasta daquela ferramenta (seção 5.3).
8. **Fatias e níveis das duas ordens:** confirme ou ajuste a divisão, o nível de cada fatia (alta para o Argon; moderada para o Flash medium; simples para o Flash low) e os arquivos de cada uma, sem cruzamento.
9. **Riscos que eu não vi.**
10. **Sistema visual RPG** (seção 5.6): paleta, tipografia, ornamentos e componentes (moldura, marco, mapa, selo), feitos sobre o kit `src/ui`. Inclua o esboço da carta (seção 5.7) e o esquema do `cartas.json`. Pode usar o Stitch.

## 9. Centro de comando (fase B; desenho em construção, adendo 1 de 23/10)

**Visão de Odival (Q210, Q211):** o Code Palandir integra todos os agentes.
- Odival começa uma tarefa nova por ele, e dali tudo se decide: modelos, o que fazer, ideias e as perguntas que ele responde.
- Ali ele acompanha a comunicação entre os fornecedores e orienta até o arquiteto, para gastar menos e decidir melhor.
- Aproveita as melhores ideias de cada aplicativo nativo (Claude, Antigravity, Codex) e integra Stitch, Jules, modelos abertos, frameworks e plugins.
- **Base:** o painel hospedado conversa com os aplicativos da máquina de Odival (pastas de projeto e modelos locais). Ele também aciona execução na nuvem e em outras máquinas.

### 9.1 Peças
1. **Painel (plano de controle, hospedado):** o Supabase e o app das fases A e B. Telas novas:
   - **Tarefa nova:** a entrada única; Odival escolhe, por tarefa, quem recebe primeiro: Gwaihir, arquiteto ou um executor direto (Q216);
   - **Perguntas:** a caixa de entrada de Odival;
   - **Conversa:** a linha do tempo entre fornecedores, por tarefa.
   - **Avisos (Q217):** o app é instalável (PWA) e manda notificação pelo navegador (Web Push) quando uma pergunta ou decisão espera Odival. O Gwaihir decide o que merece aviso, sem serviço de terceiro.
2. **Executores**, de vários tipos, todos no mesmo protocolo:
   - **local:** uma *ponte local* por máquina (o processo que liga o painel aos aplicativos), com o token de máquina da p1 (`maquinas`). Os adaptadores começam por:
     - Claude Code (`claude -p` ou Agent SDK);
     - Codex (`codex exec`);
     - Gemini CLI;
     - Ollama (modelos abertos);
     - os comandos do método (`sc.py`, git no worktree).
     O Antigravity ainda não tem disparo confiável por linha de comando. Até ter, o adaptador dele é *manual*: o painel monta a mensagem, e Odival cola.
   - **nuvem:** Jules (API), Codex na nuvem, rotinas do Claude Code e GitHub Actions, acionados por Edge Function com a credencial no Supabase Vault (cada credencial com o OK de Odival).
   - **outra máquina:** a mesma ponte, registrada com o token dela.
   - **Ferramentas** (Stitch, plugins e MCPs) são capacidades de um adaptador, e não executores.

### 9.2 Protocolo (tabelas novas, todas com RLS de dono)
| Tabela | Papel |
|---|---|
| `tarefas` | pedido em uma frase, projeto, estado, escala escolhida (papel → plataforma, modelo, esforço, subagentes) e etapa ligada |
| `acoes` | fila: tarefa, executor alvo (máquina ou nuvem), adaptador, papel, parâmetros da lista permitida, estado (`pendente`, `aprovada`, `em_andamento`, `feita`, `falhou`, `cancelada`), quem aprovou e quando |
| `eventos` | linha do tempo da tarefa: passagem, pergunta, resposta, progresso e erro; cada corpo com até 2 KB, filtrado por segredos |
| `perguntas` | do agente para Odival, com alternativas, recomendação (visível ou lacrada por hash, como nas entrevistas) e resposta; a resposta volta ao executor como evento |

### 9.3 Fronteira de conteúdo (a Q178 continua valendo)
- Da máquina saem só metadado, passagem, pergunta e resumo, com até 2 KB e filtrados.
- Código, diff e conversa inteira ficam no executor; o painel mostra o caminho e o resumo.
- Qualquer exceção é decisão de Odival, projeto a projeto.

### 9.4 Segurança do disparo
- **Conexão só de saída:** a ponte puxa as ações (Realtime ou consulta periódica), e nada escuta na máquina.
- **Lista permitida:** de adaptadores e de comandos por projeto, sempre em worktree, nunca na `main`.
- **Um clique de Odival por disparo no começo:** aviso e registro. Cadeias automáticas por tipo de ação ficam para quando houver confiança, e também por decisão.
- **O registro do método continua local, por script:** a ponte chama `sc.py assumir` e `sc.py passar`, e o painel nunca grava no `registro.json`.
- Toda ação externa ou irreversível (push, PR, merge, publicação, gasto) continua pedindo o "sim" de Odival.

### 9.5 Arquiteto mais barato
- A tarefa nova gera o pacote de contexto: objetivo, "Leia só", decisões por ID, nível e escala.
- A mensagem de abertura do Círdan já chega recortada, e ele não precisa varrer.
- O consumo aparece só medido pelo log (`sc.py sessao`, regra 8), nunca estimado.

### 9.6 Sequência sugerida (a confirmar com Odival)
- **p3:** Tarefa nova, Perguntas e Conversa, sem disparo; Odival ainda cola a mensagem, mas ela nasce no painel.
- **p4:** ponte local com Claude e Codex, por clique, e o Gwaihir resumindo; logo depois, o caminho do Google, para disparar o Gandalf e os especialistas sem Odival colar a mensagem (Antigravity ou Gemini CLI, o que funcionar; Q218).
- **p5:** nuvem (Jules primeiro) e outras máquinas.
- **p6:** cadeias automáticas e modelos abertos.

### 9.7 Gwaihir, o mensageiro (papel novo; Q212 a Q214)
- **O que faz:**
  1. Resume cada interação e passagem em até 2 KB, que viram os `eventos` da Conversa.
  2. Faz a triagem das perguntas dos agentes. Responde com a persona de Odival o que der, citando a decisão de origem e o grau de confiança, e sobe a Odival só o que for decisão dele ou de baixa confiança.
  3. Redige a próxima mensagem no estilo de Odival, e Odival aprova.
  4. Mantém a persona.
- **Modelo:** agora, GPT-6-Luna (Codex, low). Depois, um modelo aberto local, treinado para a tarefa, quando a máquina nova de Odival estiver montada (Q213).
- **Persona, em duas camadas (Q219, Q220):**
  - **Fontes:**
    - o histórico completo de Odival, exportado de todas as ferramentas;
    - as conversas seguintes e toda interação com a Sociedade;
    - as decisões Q### e as entrevistas, com as divergências dos lacres;
    - as respostas dele no painel;
    - o que o Gwaihir ensina a Odival sobre programação e agentes de IA, num caderno de aprendizado: o Gwaihir também é tutor.
  - **Camada bruta:**
    - fica só na máquina (`~/.sociedade/persona/`), fora do Git e do painel hospedado;
    - indexada localmente: SQLite FTS5 agora, embeddings locais com a máquina nova;
    - na importação, passa pela varredura de segredos e pela marcação dos projetos com dado de cliente.
  - **Caderno da persona:**
    - destilado da camada bruta: preferências, padrões de decisão, vocabulário e o que Odival já aprendeu;
    - revisado e aprovado por Odival.
  - **O que vai ao GPT-6-Luna, enquanto o Gwaihir rodar nele:** só o caderno e trechos filtrados de projetos sem dado de cliente. O bruto inteiro só vai a modelo local.
  - **Uso:** cada resposta da persona fica marcada "respondida por Gwaihir", e Odival pode revogá-la; a revogação também ensina a persona.
- **Limites:**
  - nunca decide o que é de Odival: aprovar ordem, aceitar etapa, gasto, publicação, credencial ou dado real;
  - em projeto com dado de cliente, lê só metadados e passagens já filtradas, nunca a conversa inteira (Q24, Q57);
  - não revisa e não implementa;
  - não estima consumo.

### 9.8 Compositor visual da tarefa (o grafo a serviço do pedido; Q219)
- **Para que serve:** Odival junta a informação visualmente para pedir ao arquiteto ou ao Gwaihir de forma direta e precisa.
- **Como funciona:**
  - no grafo do projeto, ele seleciona as partes que quer mudar: telas, componentes, rotas, stores e também tabelas e colunas do banco;
  - a seleção preenche sozinha os caminhos, os detalhes técnicos e o contexto da tarefa nova.
  - É o que o Code Palandir já faz com o `selectionStore` e o `PromptBuilder`, que passam a alimentar a Tarefa nova.
- **Peças novas:**
  - um analisador de esquema de banco (as migrações SQL viram nós de tabela e coluna);
  - um modelo de pedido para o arquiteto e outro para o Gwaihir;
  - o grafo de um projeto da Sociedade aberto a partir da tela Projetos.
- **Fronteira (Q178):**
  - o grafo é montado na máquina (no navegador, pela pasta local, ou pela ponte);
  - para a tarefa vão só a seleção, os caminhos e os nomes, nunca o conteúdo dos arquivos.

### 9.9 Autonomia dentro do fluxo combinado (Q219)
- Depois que Odival e o arquiteto decidem o fluxo e Odival aprova a ordem, a execução corre sozinha, sem clique por disparo. Isso cobre execução, portão, conferência, revisão e correção dentro dos limites Q84 e Q85.
- A ordem traz uma seção "Autorização prévia", que é a autorização delimitada do AGENTS.md: o que a cadeia pode fazer (finalidade, agentes, ambientes e operações), por exemplo commit e push do ramo da etapa e PR em rascunho.
- O Gwaihir registra cada passo de forma legível na Conversa, e Odival lê se quiser. Ele chama Odival só quando a decisão ou a opinião dele for de fato necessária: decisão de etapa, mudança de escopo, falha depois de 3 tentativas (Q12), ou ação fora da autorização.
- **Continua com Odival:** o merge na `main` (Q154), a publicação, o gasto, a credencial e o dado real.

### 9.10 Pontos para o complemento (seção 10 do `docs/arquitetura.md`)
1. **Onde mora a ponte local:** no pacote (Python, só biblioteca padrão, ao lado do coletor `sc.py painel`) ou no code_palandir (Node).
2. **Transporte:** Realtime ou consulta periódica, e como retomar depois de queda.
3. **Formato de `acoes` e `eventos`:** proponha um `painel/2` ou um esquema irmão, e diga o que o `painel/1` precisa ganhar.
4. **Antigravity:** qual o melhor caminho de disparo hoje (CLI, arquivo de tarefa, MCP); se não houver, mantenha o manual.
5. **Riscos do disparo remoto** e como cada um é contido.
6. **Gwaihir:** como a ponte o chama (adaptador do Codex com GPT-6-Luna), o formato do resumo e da triagem de perguntas, e o desenho do RAG da persona em duas camadas para trocar o modelo depois sem refazer nada.
7. **Compositor visual** (seção 9.8): como a seleção vira tarefa, o analisador de esquema SQL e onde o grafo é montado.
8. **Autonomia** (seção 9.9): a máquina de estados da cadeia, os pontos de chamada de Odival e o formato da seção "Autorização prévia" da ordem.
