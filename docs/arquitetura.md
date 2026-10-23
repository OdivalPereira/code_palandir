# Complemento da Arquitetura do Painel — Code Palandir (Gandalf / Gemini 4 Argon, 23/10/2026)

Este documento complementa `sociedade/arquitetura-painel.md` (seções 8 e 9.10), consolidando as escolhas técnicas, os desenhos em 360 px e 1280 px no clima RPG da Terra-média e as decisões tomadas por Odival.

---

## 1. Router e migração do Analisador (Ponto 8.1)

- **Escolha:** `react-router-dom` v6 (`^6.28.0`) com `BrowserRouter`. O conteúdo atual de `src/app/App.tsx` vai intacto para `src/app/AnalisadorPage.tsx` (montado em `/analisador`), enquanto `src/app/App.tsx` vira a casca do painel com as rotas `/` (Hoje), `/projetos`, `/projetos/:id` e `/analisador`, mais os itens reservados para `/sociedade`, `/tarefa-nova`, `/perguntas` e `/conversa` (p3).
- **Motivo:**
  1. `react-router-dom` v6 é nativo para React 18 sem exigir o modo de framework/data-router do v7.
  2. O `vercel.json` já possui o rewrite `/(.*) -> /index.html`, habilitando `BrowserRouter` sem configuração extra.
  3. Extrair `AnalisadorPage` sem tocar em `TopBar`, `GraphCanvas`, `DetailSidebar`, `PromptBuilder`, `ForensicsPanel` ou `ImportDialog` preserva 100% do comportamento existente.
  4. Como `src/app/**` pertence inteiramente à F1 da `p2-leitura`, a extração não cruza arquivos com F3 nem F4.
- **Impacto nas ordens:**
  - Na `p2-leitura` (F1): criar `src/app/AnalisadorPage.tsx` e `src/app/PainelShell.tsx`; atualizar `src/app/App.tsx` com as rotas; ajustar `src/__tests__/selfImport.test.ts` para esperar as 4 rotas da fase A (`/`, `/projetos`, `/projetos/:id`, `/analisador`), mantendo o invariante de colapso nível 1 (apenas nós `route` e `page` visíveis inicialmente) e apontando o teste de expansão e geração de prompt para `AnalisadorPage`.

---

## 2. Sessão do Supabase (Ponto 8.2)

- **Escolha:** Na fase A não há sessão real (`FonteFixture` exibe o selo `"Dados de exemplo"`). Na fase B (`p4`), usar PKCE do `@supabase/supabase-js` com persistência no `localStorage` sob chave isolada (`sb-code-palandir-auth`), `autoRefreshToken: true`, JWT de acesso curto (1 hora) e rotação de refresh token com detecção de reuso no GoTrue.
- **Motivo:**
  1. Em SPA estática sem backend próprio (BFF), não há como emitir cookie `HttpOnly` sem criar um proxy de sessão dedicado.
  2. Guardar a sessão apenas em memória ou `sessionStorage` obrigaria Odival a abrir o e-mail e clicar no link mágico a cada abertura do app ou PWA no celular.
  3. O risco de `localStorage` é mitigado pela CSP estrita (`script-src 'self'`), pela ausência de scripts de terceiros e pela varredura de segredos (`redactSecrets`).
- **Impacto nas ordens:**
  - Na `p1-fundacao` (F1): em `supabase/config.toml`, manter `enable_signup = false`, `jwt_expiry = 3600` e `enable_refresh_token_rotation = true`.
  - Na `p2-leitura` (F1): o guarda de rota na casca verifica o modo da fonte e, com `FonteFixture`, exibe o selo `"Dados de exemplo"` no topo sem bloquear a navegação.

---

## 3. Modelo de dados, retenção, idempotência e espaço para o Centro de Comando (Ponto 8.3)

- **Escolha:** Manter na `p1-fundacao` o modelo bruto (`instantaneos.corpo jsonb`) com a view `v_ultimo_instantaneo` (`SELECT DISTINCT ON (maquina_id) ... ORDER BY maquina_id, coletado_em DESC, recebido_em DESC` com `security_invoker = true`), sem criar views normalizadas (`v_projetos`, `v_pendencias`) agora. Deixar convenção de chaves pronta (`dono uuid`, `maquina_id uuid`, `projeto_id text`, `etapa_id text`) para que as tabelas transacionais `tarefas`, `acoes`, `eventos` e `perguntas` entrem por migração aditiva na fase B sem alterar as tabelas da p1.
- **Motivo:**
  1. O contrato `painel/1` ainda é rascunho e só congela na etapa B do pacote; normalizar em tabelas ou views SQL agora geraria migrações descartáveis.
  2. Um instantâneo tem no máximo 256 KB e o painel é de dono único, logo extrair listas no cliente sobre `v_ultimo_instantaneo` tem custo desprezível.
  3. As entidades da seção 9.2 (`tarefas`, `acoes`, `eventos`, `perguntas`) nascem no plano de controle e não dentro do `instantaneos.corpo`, ligando-se a `maquinas(id)` e ao par lógico `(projeto_id, etapa_id)`.
- **Impacto nas ordens:**
  - Na `p1-fundacao` (F2): criar apenas `maquinas`, `instantaneos`, `cotas` e a view `v_ultimo_instantaneo` (`security_invoker = true`), com índice `idx_instantaneos_maquina_coletado ON public.instantaneos (maquina_id, coletado_em DESC, recebido_em DESC)`.
  - Na `p1-fundacao` (F3): idempotência via `UPSERT` em `(maquina_id, coletado_em)` atualizando `recebido_em`, `corpo` e `bytes`; retenção executada após o `upsert` apagando registros daquela `maquina_id` além dos 20 mais recentes em `ORDER BY coletado_em DESC, recebido_em DESC`.

---

## 4. Ajv na Edge Function e testes da `ingest` (Ponto 8.4)

- **Escolha:** Na Edge Function, `supabase/functions/ingest/index.ts` importa `npm:ajv@8/dist/2020.js` e `npm:ajv-formats@3` (suportados nativamente pelo runtime Deno do Supabase) e injeta a função validadora compilada no módulo puro `supabase/functions/_shared/ingest.ts` (que não importa `Deno.*` nem `npm:*`). Nos testes locais do portão `banco` (`node --test supabase/functions/`), o arquivo de teste importa `ajv/dist/2020.js` do `node_modules` (ou um validador estrutural caso `node_modules` ainda não tenha `ajv` na worktree da p1) e confere o hash SHA-256 de `_shared/painel-1.schema.json` contra `sociedade/central/painel-1.schema.json`.
- **Motivo:**
  1. O Node 24 (`node --test`) não resolve o prefixo `npm:` do Deno; isolar os imports `npm:ajv` no `index.ts` permite que `_shared/ingest.ts` rode diretamente em Node 24 e em Deno.
  2. Injetar `validarEsquema` e `repositorio` em `processarIngest()` permite testar todos os códigos HTTP (200, 400, 401, 413, 422 esquema, 422 segredo, 429) em milissegundos e sem rede.
  3. A fumaça local (`node scripts/enviar-exemplo.mjs` contra `supabase start`) prova a integração real do Deno com `npm:ajv` e Postgres.
- **Impacto nas ordens:**
  - No fecho das ordens em `painel/base` (recomendado) ou na `p2-leitura`: se `ajv` e `ajv-formats` já forem instalados em `painel/base` antes de ramificar `p1` e `p2`, o `node --test supabase/functions/` na `p1` já roda com o Ajv 2020 real sem a `p1` tocar em `package.json`.
  - Na `p1-fundacao` (F3): incluir `supabase/functions/ingest.test.mjs` cobrindo os 7 códigos de resposta, retenção de 20, idempotência e igualdade byte a byte do schema.

---

## 5. Tipos TypeScript do `painel/1` (Ponto 8.5)

- **Escolha:** Escrever os tipos à mão em `src/painel/contrato/painel1.types.ts` (dispensando `json-schema-to-typescript`, conforme decisão de Odival na Pergunta 3) e conferi-los por teste triplo em `src/__tests__/painelContrato.test.ts`.
- **Motivo:**
  1. O esquema `painel/1` tem 199 linhas e gera cerca de 110 linhas de interfaces TypeScript claras, com uniões literais exatas e `| null` explícito (regra D08).
  2. Dispensa `json-schema-to-typescript` e sua árvore pesada de dependências transitivas no `node_modules`.
  3. O compilador (`tsc --noEmit`) mais o Ajv 2020 garantem alinhamento entre o tipo estático, o esquema JSON e as fixtures.
- **Impacto nas ordens:**
  - Na `p2-leitura`: remover `json-schema-to-typescript` da lista de dependências; na F2, `painelContrato.test.ts` confere (a) igualdade byte a byte entre `src/painel/contrato/painel-1.schema.json` e `sociedade/central/painel-1.schema.json`, (b) atribuição tipada `const ex: Painel1 = exemploOficial` e (c) validação Ajv 2020 nos cenários válido, vazio, só desconhecidos, limites e inválido.

---

## 6. Desenho das telas Hoje e Projetos em 360 px e 1280 px no clima RPG (Ponto 8.6)

- **Escolha:** Desenhar **Hoje ("O Conselho")** e **Projetos ("Mapa de Regiões e Jornada")** na estética RPG da Terra-média (seção 5.6), com layout de 2 colunas + barra lateral em `>= 1280 px` (versão principal web, Q217) e coluna única + barra inferior de 4 abas com alvos de toque `>= 44 px` em `360 px`, sem rolagem horizontal.
- **Motivo:**
  1. Segue a decisão Q217 (web como versão principal e celular 360 px sem perda de informação) e Q215 (clima RPG da Terra-média).
  2. Em 360 px, as cantoneiras ornamentais encolhem para bordas simples de `1px` antes de comprimir qualquer texto, garantindo leitura imediata (D05).
  3. Separa visualmente e por rótulo textual os projetos com diagnósticos (`"Terras em Névoa · Desconhecido"`) para que nunca pareçam em dia (D08).
- **Impacto nas ordens:**
  - Na `p2-leitura` (F1, F3, F4 e F5): usar a estrutura e os tokens visuais abaixo nas telas Hoje e Projetos e gerar as capturas Playwright em `1280x800` e `360x820`.

### 6.1 Capturas vetoriais de referência (`docs/painel/`)
- **Tela Hoje (360 px):** [`docs/painel/hoje-360-rpg.svg`](painel/hoje-360-rpg.svg)
- **Tela Projetos (360 px):** [`docs/painel/projetos-360-rpg.svg`](painel/projetos-360-rpg.svg)
- **Carta de Agente (360 px):** [`docs/painel/carta-agente-rpg.svg`](painel/carta-agente-rpg.svg)

### 6.2 Descrição por tela (360 px e 1280 px, com dados de `painel-1.exemplo.json`)

#### A. Casca comum (`PainelShell`)
- **Topo (`52 px`):** emblema da pedra vidente (Palantír dourado), título `"CODE PALANDIR"`, subtítulo com a máquina (`notebook-exemplo`) e horário da coleta (`23/10 15:00Z`), mais o selo âmbar `"Dados de exemplo"` (fase A).
- **Navegação:**
  - Em `1280 px`: coluna lateral esquerda fixa (`240 px`) com 4 entradas ativas/reservadas: **Conselho (Hoje)**, **Regiões (Projetos)**, **Palantír (Analisador)** e **Sociedade (Cartas — p3)**, mais seção reservada do Centro de Comando (`Tarefa nova`, `Perguntas`, `Conversa` com selo `"Fase B · p3"`).
  - Em `360 px`: barra inferior fixa (`56 px`) com 4 botões de `>= 44 px` de altura (`Conselho`, `Regiões`, `Palantír`, `Sociedade (p3)`).

#### B. Tela Hoje — "O Conselho" (`/`)
1. **Seção I — Espera pelo Conselho (`pendencias` ordenadas):**
   - Ordem estrita da seção 5.3: `aprovar_ordem` → `decidir` → `revisao_devida` → `passagem_a_levar` → `troca_vencendo` → `divergencia` → `versao_defasada` → `outro`.
   - Com o exemplo fictício, exibe os 5 itens:
     1. `[APROVAR ORDEM]` **App Receitas · r1-busca** — *"Ordem r1-busca escrita pelo Círdan; falta a sua aprovação"*;
     2. `[REVISÃO DEVIDA]` **Loja Exemplo · e3-carrinho** — *"Revisão da e3-carrinho em andamento no Codex"*;
     3. `[TROCA VENCENDO]` **Loja Exemplo** — *"Coordenador temporário no Antigravity até 24/10"*;
     4. `[DIVERGÊNCIA]` **Loja Exemplo** — *"A pasta loja-exemplo-codex parece um clone da canônica; confirme no mapa de projetos"*;
     5. `[VERSÃO DEFASADA]` **App Receitas** — *"Núcleo 3.1.0 no projeto; a fonte está em 3.4.0"*.
2. **Seção II — Terras em Névoa · Desconhecido (`diagnosticos`, D08):**
   - Moldura violeta-escuro com selo explícito `"NUNCA EM DIA"` e ícone `?`.
   - Destaca **Diário de Campo** (que tem `pendencias: []`, mas 3 diagnósticos) com cada campo e motivo: `nucleo` (*AGENTS.md sem o bloco da Sociedade*), `etapas` (*sociedade/registro.json ilegível na linha 3*) e `pastas[0].ramo` (*pasta sem repositório Git*), além do diagnóstico global `pacote.instalacoes[2].origem` (*instalação do Antigravity sem registro de origem*).
3. **Seção III — Forjas e Núcleos (Versões):**
   - Compara `pacote.fonte_versao` (`3.4.0`) com as instalações (`claude 3.4.0 ✓`, `codex 3.4.0 ✓`, `antigravity 3.3.0 ! com alteração local e origem desconhecida`) e com o `nucleo` de cada projeto (`Loja Exemplo 3.4.0 ✓`, `App Receitas 3.1.0 defasado !`, `Diário de Campo: desconhecido ?`).
4. **Seção IV — Pergaminho de Abertura ("Montar mensagem de abertura"):**
   - Seletores acessíveis (`<select>` com rótulo visível e `min-h-[44px]`): Projeto, Etapa, Papel, Plataforma, Modelo e Esforço (filtrados pelo `cardapio` do instantâneo), e Subagentes por nível (`alta`, `moderada`, `simples`).
   - Caixa de pré-visualização em fonte monoespaçada com as 5 linhas exatas do `sc.py abertura` (idêntica ao teste-ouro da seção 5.3) e botão **"Copiar mensagem"** (`min-h-[44px]`), que aplica `redactSecrets()` antes de enviar ao `clipboard.ts`.
   - Em `1280 px`, as Seções I–III ficam na coluna esquerda (`7/12`) e o Pergaminho de Abertura fica fixo na coluna direita (`5/12`).

#### C. Tela Projetos — "Mapa de Regiões e Jornada" (`/projetos` e `/projetos/:id`)
1. **Lista de Regiões:**
   - Em `1280 px`, fica na coluna esquerda (`360 px`); em `360 px`, aparece no topo como seletor de cartões ou navega para `/projetos/:id`.
   - Exibe: **Loja Exemplo** (núcleo `3.4.0`, estação `revisao`, `3 pendências`), **App Receitas** (núcleo `3.1.0 !`, estação `ordem`, `2 pendências`) e **Diário de Campo** (núcleo `desconhecido ?`, estação `desconhecida ?`, selo `"3 diagnósticos · estado desconhecido"`).
2. **Detalhe da Região (ex.: `Loja Exemplo`):**
   - **Marcos da Jornada (Etapas):** stepper horizontal das 6 estações (`1. Pedido` → `2. Ordem` → `3. Execução` → `4. Conferência` → `5. Revisão` → `6. Decisão`, mais `Encerrada` e `Desconhecida`). Mostra `e3-carrinho` iluminada no marco **5. Revisão** e `e2-catalogo` como **Encerrada (aceitar · Grau A)**.
   - **Acampamentos (Pastas por ferramenta):** lista `claude` (`canonica`, `main @ abc1234`, `limpa ✓`), `codex` (`clone !`, `main @ 9f8e7d6`, `suja !` com destaque de alerta) e `antigravity` (`worktree`, `etapa/e3-carrinho @ 1a2b3c4`, `limpa ✓`). Em `Diário de Campo`, mostra `ramo: desconhecido`, `sha: desconhecido`, `limpa: desconhecida`.
   - **Companhia (Ocupantes recentes / `interacoes`):** mostra papel, plataforma, modelo, esforço e subagentes. Na interação do `revisor` (`Codex · GPT-6.1-Sol · xhigh`), exibe alerta destacado: `modelo_no_log: desconhecido (null)` mais o texto de `avisos[0]` (*"modelo do log ainda não lido: conversa em andamento"*).
   - **Mensagens de Gwaihir (`passagens`):** cartões expansíveis (`<details>` / botão `>= 44 px`) iniciando **recolhidos**, mostrando no cabeçalho `coordenador → arquiteto (22/10 18:20Z)` e `arquiteto → revisor (23/10 09:50Z)`, e revelando o `bloco` ao expandir.

---

## 7. Linha `Worktree:` da mensagem de abertura (Ponto 8.7)

- **Escolha:** Manter na `p2-leitura` a linha `Worktree: ~/.sociedade/trabalho/<id do projeto>/<etapa>`, idêntica ao `sc.py abertura` 3.4.0 e ao teste-ouro da seção 5.3, e registrar proposta ao pacote para que na etapa B/D ambos passem juntos a resolver a pasta real do papel/ferramenta a partir de `projeto.pastas`.
- **Motivo:**
  1. Decisão direta de Odival nesta conversa (Pergunta 1).
  2. Garante igualdade byte a byte imediata com a saída-ouro do `sc.py abertura` 3.4.0 na `p2-leitura`.
  3. Evita divergência entre o texto gerado pelo painel e o texto gerado pela CLI até que o pacote atualize `cmd_abertura`.
- **Impacto nas ordens:**
  - Na `p2-leitura` (F3): nenhuma mudança no teste-ouro da seção 5.3; `painelMensagem.test.ts` valida igualdade exata com as 5 linhas especificadas.
  - No retorno ao Círdan: proposta formal de evolução conjunta para `sc_interacao.py` (`cmd_abertura`) e para o painel na fase B.

---

## 8. Fatias e níveis das duas ordens (`p1-fundacao` e `p2-leitura`) (Ponto 8.8)

- **Escolha:** Confirmar as 5 fatias de cada ordem e sua disjunção estrita de arquivos, com dois ajustes de blindagem: (1) instalar as dependências npm aprovadas por Odival no commit de fecho de `painel/base` (ou manter o fallback sem npm externo no teste Node da F3 da `p1`); (2) na `p2-leitura`, incluir os tokens e componentes visuais RPG base dentro de `src/app/` (F1) ou `src/painel/` sem tocar em `src/ui/`, mantendo a disjunção entre F1, F2, F3, F4 e F5.
- **Motivo:**
  1. Os conjuntos de arquivos de F1–F5 na `p1-fundacao` e de F1–F5 na `p2-leitura` já são totalmente disjuntos (`verificar_disjuncao.py` passa sem colisão).
  2. Os níveis atribuídos pelo Círdan respeitam o cardápio (Argon `high` para F2 e F3 na `p1` e F3 na `p2`; Flash `medium` para as moderadas; Flash `low` para a F1 da `p1`).
  3. Colocar os estilos/molduras RPG da casca em `src/app/rpgTheme.tsx` (F1) evita editar `src/ui/*` e preserva o teto de ~1.500 linhas.
- **Impacto nas ordens:**
  - **`p1-fundacao` (confirmada):**
    - **F1 (Elrond · simples · Flash low):** `supabase/config.toml`, `supabase/.gitignore`, `.gitignore`.
    - **F2 (Elrond · alta · Argon high):** `supabase/migrations/*.sql`, `supabase/tests/*.sql`.
    - **F3 (Aragorn · alta · Argon high):** `supabase/functions/ingest/**`, `supabase/functions/_shared/**`.
    - **F4 (Aragorn · moderada · Flash medium):** `scripts/nova-maquina.mjs`, `scripts/enviar-exemplo.mjs`.
    - **F5 (Elrond · moderada · Flash medium):** `supabase/seed.sql`.
  - **`p2-leitura` (confirmada com tema RPG em F1/F3/F4 e dependências decididas por Odival):**
    - **F1 (Legolas · moderada · Flash medium):** `package.json`, `package-lock.json`, `src/index.tsx`, `src/app/**`, `src/__tests__/selfImport.test.ts` (inclui a moldura/tema RPG na casca e a reserva visual dos itens da p3).
    - **F2 (Elrond · moderada · Flash medium):** `src/painel/contrato/**`, `src/painel/fonte/**`, `src/painel/fixtures/**`, `src/stores/painelStore.ts`, `src/__tests__/painelContrato.test.ts`.
    - **F3 (Legolas · alta · Argon high):** `src/painel/hoje/**`, `src/painel/mensagem/**`, `src/__tests__/painelHoje.test.tsx`, `src/__tests__/painelMensagem.test.ts`.
    - **F4 (Legolas · moderada · Flash medium):** `src/painel/projetos/**`, `src/__tests__/painelProjetos.test.tsx`.
    - **F5 (Galadriel · moderada · Flash medium):** `e2e/**`, `playwright.config.ts`, `src/__tests__/painelA11y.test.tsx`.

---

## 9. Riscos adicionais não listados na seção 6 (Ponto 8.9)

- **Escolha:** Tratar preventivamente cinco riscos técnicos nas ordens `p1-fundacao` e `p2-leitura`: (1) ausência de `ajv` no `node_modules` da `p1` ao rodar `node --test supabase/functions/`; (2) colisão do rate limit de 1/minuto com o `seed.sql` e com os testes de erro da fumaça; (3) vazamento de segredo na mensagem de erro 422 da `ingest`; (4) perda de altura (`0px`) do `GraphCanvas` (XYFlow) dentro da nova casca; (5) bloqueio de fonte externa pela CSP ou falta de rede local.
- **Motivo:**
  1. Na `p1`, a parada proíbe tocar em `package.json`; se `ajv` só for instalado na `p2`, `node --test` na `p1` falha se tentar importar `ajv` do `node_modules`.
  2. Se o `seed.sql` definir `ultimo_envio_em = now()`, rodar `enviar-exemplo.mjs` após `supabase db reset` receberá `429` em vez de `200`.
  3. Se a `ingest` cobrar o limite de 1/minuto antes de validar o corpo, testar 400/422 e em seguida 200 na fumaça bateria em `429`.
  4. O XYFlow exige contêiner pai com altura explícita (`flex-1 min-h-0 h-full`).
- **Impacto nas ordens:**
  - **`p1-fundacao` (F3 e F5):** (a) na `ingest`, checar e atualizar a janela de 1/minuto **somente após** o corpo passar por tamanho (413), JSON (400), esquema (422) e segredos (422); (b) no erro 422 de segredo, retornar apenas `{ erro: "segredo_detectado", caminho, regra }` sem ecoar o valor; (c) no `seed.sql` (F5), definir `ultimo_envio_em = '2026-10-23T15:00:00Z'` (no passado).
  - **`p2-leitura` (F1):** garantir `h-screen w-screen overflow-hidden flex flex-col` na casca e `flex-1 min-h-0` no `<main>` que envolve `/analisador`; usar pilha tipográfica local (`'Cinzel', Georgia, 'Times New Roman', serif`) sem depender de rede nos testes Playwright.

---

## 9-B. Sistema visual RPG, Cartas dos agentes e esquema `cartas.json` (Ponto 8.10 / Seções 5.6 e 5.7)

- **Escolha:** Aplicar já na `p2-leitura` a identidade visual **"Noite de Valfenda e Ouro Velho"** nas telas Hoje, Projetos e Casca sobre o kit `src/ui`, e levar a tela **"Sociedade" (Cartas dos agentes)** com `sociedade/central/cartas.json` para a `p3` (decisão de Odival na Pergunta 2), mantendo o item visível na navegação da casca como `"Sociedade (p3)"`.
- **Motivo:**
  1. Decisão direta de Odival (Pergunta 2): traz o clima RPG já na `p2` sem estourar o teto de ~1.500 linhas nem adicionar uma 6ª fatia.
  2. Os tokens de cor usam classes utilitárias do Tailwind (`stone-950`, `stone-900`, `amber-500/700`, `emerald-400`, `purple-400`) com razão de contraste `>= 4.8:1` (WCAG AA).
  3. O esquema `cartas.json` separa a curadoria humana (poderes, forças, fraquezas) dos atributos medidos em `painel/1` (D08, D10).
- **Impacto nas ordens:**
  - Na `p2-leitura` (F1, F3, F4): aplicar a paleta, tipografia e componentes abaixo; reservar o item `/sociedade` na navegação.
  - Na `p3`: implementar a rota `/sociedade`, ler `sociedade/central/cartas.json` e cruzar com o instantâneo (`interacoes` e o campo proposto `atributos_agentes`).

### 9-B.1 Paleta, tipografia, ornamentos e componentes (sobre `src/ui`)
- **Paleta (WCAG AA garantido):**
  - Fundo principal (Noite): `#0c0a09` (`bg-stone-950`) e superfície de pergaminho escuro `#1c1917` (`bg-stone-900`).
  - Moldura e ornamentos (Ouro Velho / Bronze): borda padrão `#78350f` (`border-amber-900/80`), borda de destaque `#d97706` (`border-amber-600`), título `#fef3c7` (`text-amber-100`, contraste `16.4:1` sobre `#0c0a09`).
  - Texto de corpo: `#e7e5e4` (`text-stone-200`, contraste `14.1:1`) e secundário `#a8a29e` (`text-stone-400`, contraste `6.3:1`).
  - Semântica (sempre acompanhada de ícone e rótulo textual, nunca só cor):
    - Em dia / Concluído: verde élfico `#10b981` + símbolo `✓`;
    - Pendência / Atenção: âmbar `#f59e0b` + símbolo `!`;
    - Desconhecido / Névoa (D08): violeta `#a855f7` (`bg-purple-950/60 border-purple-500 text-purple-200`) + símbolo `?` + texto `"desconhecido"`;
    - Erro / Bloqueio: carmim `#ef4444` + símbolo `✕`.
- **Tipografia:**
  - Títulos de seção, cabeçalhos e nomes de cartas: `font-serif tracking-wide uppercase` (`'Cinzel', Georgia, 'Times New Roman', serif`).
  - Corpo, tabelas e controles: `font-sans` (`Inter, system-ui, sans-serif`).
  - Caminhos, SHAs, diagnósticos e mensagem de abertura: `font-mono` (`'JetBrains Mono', monospace`).
- **Componentes RPG (compostos sobre `Card` e `Badge` de `src/ui`):**
  1. **`MolduraPergaminho`:** envolve `Card` com borda `border-amber-900/80 bg-stone-900/95` e cantoneiras duplas discretas em `md:` (que colapsam para borda simples em `360 px`).
  2. **`MarcoJornada`:** stepper acessível (`role="list"`) das 6 estações (`pedido`, `ordem`, `execucao`, `conferencia`, `revisao`, `decisao`) mais os estados `encerrada` e `desconhecida`.
  3. **`RegiaoMapa`:** cartão de projeto com cabeçalho em ouro velho, contadores de pendências/diagnósticos e lista compacta de acampamentos (`pastas`).
  4. **`SeloPapel`:** insígnia sobre `Badge` com ícone SVG próprio por papel (navio/compasso para Círdan, árvore para Barbárvore, cajado/chama para Gandalf, espada/passos para Aragorn, anel/arquivo para Elrond, espelho/estrela para Galadriel, arco/folha para Legolas, águia para Gwaihir, forja nas nuvens para Jules).

### 9-B.2 Esboço da Carta do Agente (seção 5.7)
- **Visualização:** ver captura em [`docs/painel/carta-agente-rpg.svg`](painel/carta-agente-rpg.svg).
- **Frente da carta:**
  - **Cabeçalho:** ícone do papel, nome e título (ex.: *"Círdan, o Armador · Arquiteto"* ou *"Gwaihir, o Senhor dos Ventos · Mensageiro e Tutor"*), e pílula de estado (`ativo`, `reserva` ou `espera`).
  - **Ocupante atual:** plataforma, fornecedor, modelo, esforço e data `"Desde"`, lidos do perfil/instantâneo.
  - **Poderes:** 3 bullets objetivos extraídos da definição do papel (`sc-papeis`).
  - **Forças e fraquezas:** bullets curados por Odival (com sinal `+` e `−`), distinguindo características do papel e do modelo atual.
  - **Atributos medidos (D08 / D10):** `etapas_atuadas`, `aceites_de_primeira`, `achados_bloqueadores` (para revisor) e `passagens_feitas`. Se o campo for `null` ou ausente no instantâneo (como na fase A), exibe literalmente `"desconhecido"` em destaque violeta, nunca `0`.
- **Verso da carta (acionado por botão `>= 44 px` com `aria-pressed`):**
  - Linhagem de ocupantes (histórico de trocas de modelo/fornecedor daquele papel) e as últimas interações registradas no instantâneo (com projeto, etapa, data e confirmação de `modelo_no_log`).

### 9-B.3 Esquema proposto para `sociedade/central/cartas.json`
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "sociedade-do-codigo/cartas/1",
  "title": "Cartas dos Agentes da Sociedade do Código (cartas/1)",
  "type": "object",
  "additionalProperties": false,
  "required": ["esquema", "atualizado_em", "cartas"],
  "properties": {
    "esquema": { "const": "cartas/1" },
    "atualizado_em": { "type": "string", "format": "date-time" },
    "cartas": {
      "type": "array",
      "minItems": 1,
      "maxItems": 16,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "required": ["id", "papel", "nome", "titulo", "icone", "estado_padrao", "poderes", "forcas", "fraquezas"],
        "properties": {
          "id": { "enum": ["cirdan", "barbarvore", "gandalf", "aragorn", "elrond", "galadriel", "legolas", "gwaihir", "jules", "celebrimbor", "radagast", "faramir", "bilbo"] },
          "papel": { "type": "string", "maxLength": 60 },
          "nome": { "type": "string", "maxLength": 60 },
          "titulo": { "type": "string", "maxLength": 80 },
          "icone": { "enum": ["navio", "arvore", "cajado", "passos", "pergaminho", "espelho", "arco", "aguia", "nuvem", "bigorna"] },
          "estado_padrao": { "enum": ["ativo", "reserva", "espera"] },
          "ocupante_padrao": {
            "type": ["object", "null"],
            "additionalProperties": false,
            "required": ["plataforma", "fornecedor", "modelo", "esforco"],
            "properties": {
              "plataforma": { "type": "string", "maxLength": 40 },
              "fornecedor": { "type": "string", "maxLength": 40 },
              "modelo": { "type": "string", "maxLength": 60 },
              "esforco": { "type": "string", "maxLength": 20 },
              "desde": { "type": ["string", "null"], "format": "date" }
            }
          },
          "poderes": { "type": "array", "minItems": 1, "maxItems": 5, "items": { "type": "string", "maxLength": 140 } },
          "forcas": { "type": "array", "minItems": 1, "maxItems": 5, "items": { "type": "string", "maxLength": 140 } },
          "fraquezas": { "type": "array", "minItems": 1, "maxItems": 5, "items": { "type": "string", "maxLength": 140 } }
        }
      }
    }
  }
}
```

---

## 10. Centro de comando (Complemento da seção 9.10, pontos 1 a 8)

### 10.1 Onde mora a ponte local (Ponto 9.10.1)
- **Escolha:** A **ponte local** mora no pacote `sociedade_do_codigo` (em Python 3, usando apenas a biblioteca padrão, como subcomando `sc.py ponte` ao lado de `sc.py painel`), e não em Node dentro do `code_palandir`.
- **Motivo:**
  1. A ponte local administra todos os projetos da máquina de Odival, não apenas o repositório `code_palandir`.
  2. Já compartilha no mesmo repositório a lógica canônica de `sc.py assumir`, `sc.py passar`, `sc.py sessao` e o coletor `sc.py painel coletar`.
  3. Sendo Python puro (biblioteca padrão), roda em qualquer máquina nova sem exigir `npm install` nem runtime Node.
- **Impacto nas ordens:**
  - `p1-fundacao` e `p2-leitura` não mudam; na `p4`, o comando da ponte local entra no pacote e usa o mesmo token de máquina criado pelo `nova-maquina` da `p1`.

### 10.2 Transporte e retomada após queda (Ponto 9.10.2)
- **Escolha:** Consulta periódica HTTPS (long-polling leve via REST no PostgREST/Edge Function a cada `5 s` quando há tarefa ativa e backoff até `30 s` quando ociosa) com estado local em `~/.sociedade/ponte/estado.json` (`ultimo_evento_id`, `acoes_em_execucao`).
- **Motivo:**
  1. A biblioteca padrão do Python (`urllib.request`) fala HTTPS REST nativamente sem precisar de cliente WebSocket/Realtime externo.
  2. Conexão estritamente de saída (seção 9.4), atravessando qualquer NAT/firewall sem abrir porta local.
  3. A reconciliação por cursor + arquivo de PID local torna a retomada após queda determinística e idempotente.
- **Impacto nas ordens:**
  - Na `p4`: ao iniciar após queda, a ponte lê `~/.sociedade/ponte/estado.json`, verifica os PIDs e logs das ações que estavam `em_andamento` naquela máquina: se o processo terminou com sucesso, publica o evento final e marca `feita`; se interrompeu, grava diagnóstico e marca `falhou` (nunca reexecuta disparo às cegas).

### 10.3 Formato de `acoes` e `eventos`: esquema irmão `comando/1` e adições ao `painel/1` (Ponto 9.10.3)
- **Escolha:** Criar um esquema irmão `sociedade-do-codigo/comando/1` (`comando-1.schema.json`) para validar `tarefas`, `acoes`, `eventos` e `perguntas`, mantendo `painel/1` como retrato periódico da máquina com apenas três adições opcionais retrocompatíveis: (1) `"gwaihir"` no enum de `$defs.escala.papel`, (2) `atributos_agentes` (para as Cartas da seção 5.7) e (3) `ponte` (estado da ponte local da máquina).
- **Motivo:**
  1. `painel/1` é um instantâneo unidirecional (máquina → painel), enquanto `tarefas`, `acoes`, `eventos` e `perguntas` são filas transacionais bidirecionais com ciclo de vida por linha no Postgres.
  2. Separar `comando/1` evita inflar cada instantâneo de 1 minuto com histórico de conversas e filas.
  3. Tornar os novos campos de `painel/1` opcionais preserva 100% de compatibilidade com a `p1-fundacao` e a `p2-leitura`.
- **Impacto nas ordens:**
  - `p1-fundacao` e `p2-leitura` usam o `painel/1` atual sem alteração; as propostas de evolução de `painel/1` e o esquema `comando/1` seguem no retorno para a etapa B do pacote e para a `p3`.

#### Resumo do esquema irmão `comando/1` (para `p3`/`p4`)
- **`tarefa`:** `{ id, dono, projeto_id, etapa_id, pedido_uma_frase, receptor_inicial ("gwaihir" | "arquiteto" | "executor"), estado ("rascunho" | "aberta" | "em_execucao" | "aguardando_odival" | "concluida" | "cancelada"), escala, contexto_selecao, criado_em }`.
- **`acao`:** `{ id, tarefa_id, maquina_id, alvo ("local" | "nuvem"), adaptador ("claude" | "codex" | "gemini_cli" | "antigravity_manual" | "ollama" | "sc_py" | "jules"), papel, comando_permitido, argumentos, estado ("pendente" | "aprovada" | "em_andamento" | "feita" | "falhou" | "cancelada"), aprovado_por ("odival" | "autorizacao_previa"), criado_em, iniciado_em, finalizado_em }`.
- **`evento`:** `{ id, tarefa_id, acao_id, origem_papel, tipo ("passagem" | "pergunta" | "resposta" | "progresso" | "erro" | "resumo_gwaihir"), corpo_2kb (maxLength: 2048, filtrado por redactSecrets), criado_em }`.
- **`pergunta`:** `{ id, tarefa_id, acao_id, papel_autor, enunciado, alternativas (string[]), recomendacao_texto, recomendacao_hash_lacre, respondida_por ("odival" | "gwaihir" | null), citacao_decisao (ex.: "Q212"), confianca ("alta" | "media" | "baixa" | null), resposta_escolhida, revogada_por_odival (boolean), criado_em, respondido_em }`.

### 10.4 Antigravity — caminho de disparo (Ponto 9.10.4)
- **Escolha:** Operar com duplo adaptador para o ecossistema Google: (1) na `p3`/`p4` inicial, **adaptador manual assistido** para a IDE Antigravity (a ponte prepara a worktree, grava a subordem em `sociedade/subordens/`, copia a mensagem de abertura pronta e dispara notificação Web Push); (2) em paralelo na `p4`, **adaptador automático via Gemini CLI / Antigravity SDK headless** quando disponível e autenticado na máquina (Q218).
- **Motivo:**
  1. A interface gráfica do Antigravity ainda não expõe flag de CLI estável para abrir conversa nova com prompt injetado sem interação de janela.
  2. O preparo automático da worktree e do arquivo de subordem pela ponte já elimina 80% do trabalho manual mesmo no modo assistido.
  3. O adaptador `gemini_cli` / SDK headless usa a mesma interface da ponte assim que o comando local responder de forma determinística.
- **Impacto nas ordens:**
  - Na `p2-leitura` (F3): o gerador de mensagem já deixa o texto pronto para colar no Antigravity; na `p4`, a ponte local implementa `adaptador = "antigravity_manual"` e `adaptador = "gemini_cli"`.

### 10.5 Riscos do disparo remoto e contenção (Ponto 9.10.5)
- **Escolha:** Conter os cinco vetores de risco do disparo remoto diretamente na ponte local e nas políticas RLS/Edge Functions antes de executar qualquer processo.
- **Motivo:**
  1. Mesmo com conexões só de saída, um plano de controle em nuvem exige que a máquina local valide cada instrução antes de invocar um agente com acesso ao disco.
  2. Garantir isolamento em worktree e lista branca sem `shell=True` impede destruição de código na `main` ou injeção de comandos.
  3. O disjuntor local protege Odival contra loops de agentes e gastos imprevistos.
- **Impacto nas ordens:**
  - Na `p4` e `p6`, a ponte local implementa obrigatoriamente as 5 travas abaixo:

| Risco | Contenção obrigatória na ponte local e no banco |
|---|---|
| **1. Injeção de comando via parâmetros da ação** | Execução sempre com `subprocess.run(lista_args, shell=False)`; `adaptador` e `comando_permitido` validados contra enum fixo; caminhos restritos a `~/.sociedade/trabalho/<projeto>/<etapa>`. |
| **2. Disparo acidental na `main` ou em pasta suja** | Antes de iniciar o adaptador, a ponte confere `git rev-parse --abbrev-ref HEAD` (exige prefixo `etapa/`) e recusa pastas fora de worktree. |
| **3. Execução duplicada em queda/reconexão** | Transição atômica `estado = 'aprovada' -> 'em_andamento'` no banco + lockfile local `~/.sociedade/ponte/locks/<acao_id>.lock` com PID. |
| **4. Vazamento de código, segredo ou dado de cliente nos eventos** | Projetos com `envio_ligado = false` (ou marcados com dado de cliente) nunca enviam trechos à nuvem; todo `corpo_2kb` passa pelo `redactSecrets` e truncamento em 2.048 bytes antes do `POST`. |
| **5. Loop infinito de agentes / consumo descontrolado** | Disjuntor local: máximo de 3 tentativas por bloqueio (Q12) e teto de ações automáticas por etapa; ao atingir o limite, a cadeia pausa e chama Odival via Web Push. |

### 10.6 Gwaihir: chamada pela ponte, formato de resumo/triagem e RAG da persona em duas camadas (Ponto 9.10.6)
- **Escolha:** A ponte local chama o Gwaihir por meio do adaptador do Codex (`codex exec -m gpt-6-luna` com esforço `low` e schema JSON estrito de saída), alimentado por um módulo local `IndicePersona` em duas camadas (`~/.sociedade/persona/caderno.md` + `~/.sociedade/persona/bruto.sqlite` com SQLite FTS5 agora e tabela de vetores pronta para embeddings locais na máquina nova).
- **Motivo:**
  1. O contrato JSON fixo de entrada e saída torna o Gwaihir agnóstico de modelo: trocar `gpt-6-luna` (Codex) por um modelo aberto local (Ollama) na máquina nova exige mudar apenas o adaptador de inferência.
  2. A separação física em duas camadas garante que o bruto (`bruto.sqlite`) jamais saia da máquina (Q219, Q220), enviando ao `gpt-6-luna` apenas o caderno aprovado por Odival e até 5 trechos filtrados de projetos sem dado de cliente.
  3. Toda resposta automática do Gwaihir fica auditável com `citacoes_decisoes` (`Q###`) e botão de revogação no painel.
- **Impacto nas ordens:**
  - Na `p3`: a tabela e a tela `Perguntas` já preveem os campos `respondida_por: "gwaihir" | "odival"`, `citacao_decisao`, `confianca` e a ação **"Revogar resposta do Gwaihir"**.
  - Na `p4`: a ponte local implementa o módulo `gwaihir.py` e o índice SQLite FTS5 em `~/.sociedade/persona/`.

#### Especificação do formato de saída do Gwaihir e do RAG em duas camadas
1. **Saída JSON do Gwaihir (resumo e triagem):**
   ```json
   {
     "tipo": "triagem_pergunta",
     "resumo_evento_2kb": "Aragorn concluiu F3 (ingest) e pergunta se o erro 422 deve listar os caminhos JSON em português.",
     "decisao_triagem": "responder_por_persona",
     "confianca": "alta",
     "citacoes_decisoes": ["Q178", "CADERNO-ESTILO-02"],
     "resposta_proposta": "Sim: retorne mensagens curtas em português com o caminho do campo, sem ecoar o valor rejeitado.",
     "motivo_escalonamento": null,
     "nota_tutoria": null
   }
   ```
   - **Regra de corte:** se `confianca !== "alta"`, se `citacoes_decisoes` estiver vazia, ou se a pergunta tocar em escopo, aprovação de ordem, aceite de etapa, dependência nova, gasto, publicação, credencial ou dado real, a própria ponte força `decisao_triagem = "subir_para_odival"` e dispara aviso PWA (Web Push).
2. **Arquitetura do RAG da Persona em duas camadas (`~/.sociedade/persona/`):**
   - **Camada 2 — Destilada e aprovada (`caderno.md` e `aprendizado.md`):** preferências de Odival, padrões de decisão `Q###` (incluindo divergências dos lacres), vocabulário e o caderno de tutoria (o que o Gwaihir já explicou a Odival sobre programação e agentes). Vai sempre no prompt do Gwaihir.
   - **Camada 1 — Bruta local (`bruto.sqlite`):** tabela virtual `conversas_fts USING fts5(id, ferramenta, projeto, data, papel, texto_filtrado, dado_cliente UNINDEXED)` + tabela `conversas_embeddings (id TEXT PRIMARY KEY, vetor BLOB)` reservada para a máquina nova. Na importação, todo texto passa pelo `redactSecrets`.
   - **Chaveamento de provedor sem refatoração (`IndicePersona.montar_contexto(consulta, modo_provedor)`):**
     - Quando `modo_provedor == "nuvem_luna"`: inclui `caderno.md` + `aprendizado.md` + top 5 trechos do FTS5 com `WHERE dado_cliente = 0`, truncados em 1,5 KB e refiltrados por `redactSecrets`.
     - Quando `modo_provedor == "local_aberto"` (máquina nova): ativa a busca híbrida FTS5 + cosseno em `conversas_embeddings` sobre toda a base local.

### 10.7 Compositor visual da tarefa (Ponto 9.10.7 / Seção 9.8)
- **Escolha:** Montar o grafo localmente no navegador (reaproveitando `src/engine/` e `useSelectionStore`), adicionar o parser puro `src/engine/parser/sqlMigrationParser.ts` para transformar migrações SQL em nós `table` e `column`, e converter a seleção do grafo num pacote enxuto de metadados (`contexto_selecao`, sem `codeSnippet`) que preenche a tela **Tarefa nova** nos modos **Arquiteto (Círdan)** ou **Gwaihir**.
- **Motivo:**
  1. Reaproveita diretamente o que o Code Palandir já tem de mais forte (`GraphCanvas`, `useSelectionStore` e `PromptBuilder`), conectando o Analisador ao Centro de Comando.
  2. Fazer o parse das migrações SQL (`supabase/migrations/*.sql`) no cliente mantém código e esquema bruto na máquina, enviando para a `tarefa` apenas nomes de tabelas, colunas, rotas, componentes e caminhos de arquivos (fronteira da Q178).
  3. Entrega ao Círdan o bloco `"Leia só"` já recortado a partir dos nós selecionados no grafo (seção 9.5).
- **Impacto nas ordens:**
  - `p1-fundacao` e `p2-leitura` não mudam; na `p3` (conforme sequência aprovada por Odival na Pergunta 4), entram `sqlMigrationParser.ts`, os nós visuais `table`/`column` no grafo e o botão **"Abrir como Tarefa Nova"** a partir da seleção do Analisador.

#### Fluxo do Compositor Visual (`p3`)
1. **Analisador de esquema SQL (`sqlMigrationParser.ts`):** varre arquivos `.sql` procurando `CREATE TABLE [public.]<nome>`, colunas (`<col> <tipo>`), `PRIMARY KEY`, `REFERENCES <tabela_alvo>(<col>)` e `CREATE POLICY <nome> ON <tabela>`, criando nós `table` e `column` e arestas `fk` (entre tabelas) e `data-access` (quando um arquivo TS/TSX chama `.from('<tabela>')`).
2. **Da seleção para a Tarefa nova (`buildTaskDraftFromSelection`):**
   - Lê `useSelectionStore.getState().selectedElements`;
   - Descarta `codeSnippet` (nunca vai ao banco do painel);
   - Agrupa `filePath` únicos para preencher automaticamente o bloco **"Leia só"** (limitado aos arquivos selecionados);
   - Lista os símbolos selecionados (`[PAGE] HojePage`, `[STORE] painelStore`, `[TABLE] public.instantaneos`) e abre a tela `/tarefa-nova` pronta para Odival digitar apenas o pedido em uma frase e escolher o receptor inicial (`Gwaihir`, `Arquiteto` ou `Executor`).

### 10.8 Autonomia dentro do fluxo combinado (Ponto 9.10.8 / Seção 9.9)
- **Escolha:** Implementar na ponte local um orquestrador determinístico por máquina de estados da etapa, regido por um bloco padronizado `## Autorização prévia` dentro da ordem aprovada por Odival, que avança sozinho entre execução, portão, conferência, revisão independente e até 1 ciclo de correção (Q84, Q85), pausando e notificando Odival via Web Push apenas nos pontos de decisão humana.
- **Motivo:**
  1. Cumpre a decisão Q219 e a regra de autorização delimitada do `AGENTS.md` (finalidade, agentes, ambientes e operações explícitas).
  2. Elimina o trabalho mecânico de Odival carregar passagens entre Gandalf, `sc.py conferir` e Barbárvore quando tudo corre dentro do esperado.
  3. Garante parada imediata em qualquer desvio (3 falhas no portão pela Q12, 2ª rodada de correção pela Q84, ou operação vedada como merge na `main` pela Q154).
- **Impacto nas ordens:**
  - As ordens passam a suportar a seção `## Autorização prévia` (formato abaixo); a execução automática da cadeia entra na `p6` (depois de a ponte local e o Gwaihir estarem provados na `p4` e `p5`, conforme decisão de Odival na Pergunta 4).

#### Máquina de estados da cadeia autônoma e pontos de chamada de Odival
```
[Ordem aprovada por Odival]
       │
       ▼
1. EXECUTANDO_FATIAS (Gandalf + especialistas no worktree etapa/<id>)
       │  ├─► (Pergunta que Gwaihir não responde com confiança alta) ──► [PAUSA: Chama Odival (Web Push)]
       │  └─► (3 tentativas falhas no portão / Q12) ───────────────────► [PAUSA: Chama Odival (Web Push)]
       ▼
2. PORTAO_E_ENTREGA (`sc.py entregar` verde por fatia/consolidado)
       │
       ▼
3. CONFERENCIA_AUTOMATICA (`sc.py conferir` valida entregas E1..En e disjunção)
       │  └─► (Falha na conferência) ──────────────────────────────────► [PAUSA: Chama Odival (Web Push)]
       ▼
4. PREPARANDO_REVISAO (`sc.py revisar` cria cópia de revisão isolada)
       │
       ▼
5. EM_REVISAO_INDEPENDENTE (Barbárvore, fornecedor distinto, emite parecer com hash)
       │
       ├──► Parecer = APROVADO ────────────────────────────────────────► [6. AGUARDANDO_DECISAO_ODIVAL (Web Push)]
       │
       └──► Parecer = CORRIGIR (1ª vez; Q84/Q85)
                  │
                  ▼
            5a. CORRIGINDO_ESCOPO_FECHADO (Gandalf corrige só os achados apontados + portão)
                  │
                  ▼
            5b. RECONFERENCIA_REVISOR (Barbárvore reconferi escopo fechado)
                  │
                  └──► Qualquer resultado (aprovado ou pendência) ─────► [6. AGUARDANDO_DECISAO_ODIVAL (Web Push)]
```

#### Formato padronizado da seção `## Autorização prévia` nas ordens (para `p6`)
```markdown
## Autorização prévia
- **Finalidade:** execução, conferência, revisão independente e até 1 correção de escopo fechado da etapa `<id-da-etapa>`.
- **Agentes autorizados:** coordenador (`gandalf`), especialistas da ordem (`aragorn`, `elrond`, `galadriel`, `legolas`), mensageiro (`gwaihir`) e revisor independente (`barbarvore`).
- **Ambiente:** máquina local (`<apelido-da-maquina>`), worktree `~/.sociedade/trabalho/<projeto>/<id-da-etapa>` e cópia de revisão em `~/.sociedade/revisao/<projeto>/<id-da-etapa>`.
- **Ramo permitido:** `etapa/<id-da-etapa>` (nunca `main`).
- **Operações permitidas:** `assumir`, `executar_fatias`, `rodar_portao`, `commit_no_ramo_etapa`, `entregar`, `conferir`, `preparar_copia_revisao`, `disparar_revisor`, `corrigir_escopo_fechado_1x`, `reconferir_1x`, `resumir_evento`, `responder_pergunta_confianca_alta`.
- **Operações vedadas (exigem "sim" explícito de Odival):** `merge_main`, `push_remoto`, `abrir_pr_final`, `publicar_deploy`, `instalar_dependencia_fora_da_ordem`, `alterar_contrato_oficial`, `gasto_extra`, `usar_dado_real`.
```
